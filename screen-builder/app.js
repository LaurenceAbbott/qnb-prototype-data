/*
  Screen Builder — Fixed Template Components (JS)
  ------------------------------------------------
  Paste your current full .JS file below this header.

  Plan for what we’ll implement in this canvas:
  - Hard-coded template blocks for special pages (Quote / Summary / Payment)
  - These blocks always render (even if no builder questions exist)
  - Template blocks can read/playback answers captured earlier (risk summary)
  - Builder-defined question blocks still render underneath/around templates
  - Hooks + stable CSS classnames so you can style everything in your .css

  Instructions:
  1) Paste your current full JS beneath this comment.
  2) Leave this header intact so we can find the insertion points.
*/

// ===== FIXED TEMPLATE RENDERERS (SYSTEM OWNED) =====

function renderQuoteTemplate(page) {
  const wrap = document.createElement("div");
  wrap.className = "qnb-template qnb-template-quote";

  wrap.innerHTML = `
    <div class="qnb-preview-card qnb-quote-card">
      <div class="qnb-preview-group-title">Your quote</div>
      <div class="qnb-quote-priceCard">Quote price will appear here</div>
      <div class="qnb-quote-coverSummary">Cover summary will appear here</div>
    </div>
  `;

  return wrap;
}

function renderSummaryTemplate(page) {
  const wrap = document.createElement("div");
  wrap.className = "qnb-template qnb-template-summary";

  wrap.innerHTML = `
    <div class="qnb-preview-card qnb-summary-card">
      <div class="qnb-preview-group-title">Check your answers</div>
      <div class="qnb-summary-reviewTable">Answer playback will appear here</div>
    </div>
  `;

  return wrap;
}

function renderPaymentTemplate(page) {
  const wrap = document.createElement("div");
  wrap.className = "qnb-template qnb-template-payment";

  wrap.innerHTML = `
    <div class="qnb-preview-card qnb-payment-card">
      <div class="qnb-preview-group-title">Payment</div>
      <div class="qnb-payment-summaryCard">Payment summary will appear here</div>
    </div>
  `;

  return wrap;
}

// ===== PASTE YOUR CURRENT FULL JS BELOW THIS LINE =====
/* =============================================================================
SCREEN BUILDER — CHAPTERD FILE (Insert-only scaffolding)

How to use:
1) Paste your FULL current working JS file below the marker:
      // === PASTE ORIGINAL CODE BELOW ===
   (replace everything below that marker).
2) Tell me “pasted” in chat.
3) I will then re-organise the file by inserting chapter headers + patch hooks
   WITHOUT changing any executable code.

NOTE: Right now this file is only a scaffold because I don’t yet have your JS.
============================================================================= */

/* =============================================================================
TABLE OF CONTENTS (Chapters)

CH 0  Boot / Globals
CH 1  State (defaults, load/save, migrate)
CH 2  Data Models (Page/Group/Question schemas)
CH 3  Templates
     3.1  Form pages
     3.2  Fixed checkout pages (Quote/Summary/Payment)
CH 4  UI Rendering
     4.1  Left nav (page list)
     4.2  Main editor (page/group/question)
     4.3  Preview / runtime
CH 5  Actions (add/rename/delete/duplicate/move)
CH 6  Logic (validation, conditional display)
CH 7  Utilities (ids, cloning, formatting)
CH 8  Event wiring (listeners)
CH 9  Dev / debug helpers

Patch hooks we’ll use later:
- [PATCH-HOOK: NAV_PAGES_SOURCE]
- [PATCH-HOOK: FIXED_PAGES_APPEND]
- [PATCH-HOOK: PAGE_TYPE_RENDER_SWITCH]
============================================================================= */

// === PASTE ORIGINAL CODE BELOW ===

/* Product-grade Form Builder (vanilla JS)
   - Pages + groups + questions
   - Options editor
   - Conditional logic
   - Typeform-style preview (one question at a time, progress bar)
   - Autosave + export/import JSON
*/

/* =============================================================================
CH 0  Boot / Globals
- IIFE boot, storage key, global helpers
============================================================================= */

(function () {
  const STORAGE_KEY = "og-formbuilder-schema-v1";

  /* =============================================================================
CH 7  Utilities (ids, cloning, formatting, sanitise)
============================================================================= */

  // -------------------------
  // Utilities
  // -------------------------
  const uid = (prefix = "id") =>
    `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Debounce helper (prevents re-render on every keystroke)
  function debounce(fn, ms = 150) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function safeText(el) {
    return (el?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------------------------------------------------------------------------
  // Classname bridge
  // WHY: Your CSS has moved to the new qnb-* naming, but some preview DOM nodes
  // were still using legacy .preview* classnames only.
  // Fix: Always output BOTH class sets so old and new CSS can style the same DOM.
  // ---------------------------------------------------------------------------
  const cx = (...names) => names.filter(Boolean).join(" ");
  const tplClass = (tpl, suffix) => `qnb-${String(tpl || "form").toLowerCase()}-${suffix}`;

  // Very small, safe rich-text sanitizer (allows only basic formatting + lists)
  function sanitizeRichHtml(inputHtml) {
    const html = String(inputHtml || "");
    if (!html.trim()) return "";

    // Allow only basic formatting + lists. Everything else gets unwrapped.
    const allowed = new Set([
      "DIV",
      "P",
      "BR",
      "B",
      "STRONG",
      "I",
      "EM",
      "U",
      "UL",
      "OL",
      "LI",
      "SPAN",
      // Phase 1: allow headings for text blocks
      "H1",
      "H2",
      "H3",
      "H4",
    ]);

    // Use a detached container instead of DOMParser (more robust across embeds/iframes).
    const container = document.createElement("div");
    container.innerHTML = html;

    const walk = (node) => {
      // 8 = COMMENT_NODE
      if (node.nodeType === 8) {
        node.remove();
        return;
      }

      // 1 = ELEMENT_NODE
      if (node.nodeType === 1) {
        const el = node;

        // Strip ALL attributes (prevents XSS via on* handlers, style, href, etc.)
        // If we later want to allow safe links, we can whitelist attributes.
        [...el.attributes].forEach((a) => el.removeAttribute(a.name));

        // Disallowed tags: unwrap (keep text/children)
        if (!allowed.has(el.tagName)) {
          const parent = el.parentNode;
          if (!parent) return;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          return;
        }
      }

      const kids = [...node.childNodes];
      kids.forEach(walk);
    };

    walk(container);

    // Trim and normalise
    return (container.innerHTML || "").trim();
  }

  function selectAllContent(el) {
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      // no-op
    }
  }

  function isTextEditingElement(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea") return true;
    if (tag === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      // treat these as "typing" inputs
      return ["text", "email", "number", "search", "tel", "url", "password"].includes(type);
    }
    return false;
  }

  // -------------------------
  // Date picker (Flatpickr)
  // -------------------------
  function initFlatpickrDateInput(inputEl, initialValue, onValue) {
    // Only runs if Flatpickr is loaded on the page.
    const fp = window.flatpickr;
    if (!fp || !inputEl) return;

    // Prevent double-init if a DOM node is somehow reused
    if (inputEl._flatpickr) return;

    // Anchor the calendar to the input wrapper so it stays "attached" in scrollable layouts
    const anchor =
      inputEl.closest(".pInputWrap") ||
      inputEl.parentElement ||
      document.body;

    // Ensure the anchor is a positioning context
    try {
      const cs = window.getComputedStyle(anchor);
      if (cs.position === "static") anchor.style.position = "relative";
    } catch {
      // no-op
    }

    const positionToAnchor = (instance) => {
      const cal = instance?.calendarContainer;
      if (!cal) return;

      // If appended into our anchor, position using offsets relative to that anchor.
      if (anchor && anchor.contains(cal)) {
        cal.style.position = "absolute";
        cal.style.top = `${inputEl.offsetTop + inputEl.offsetHeight + 10}px`;
        cal.style.left = `${inputEl.offsetLeft}px`;
      } else {
        // Otherwise fall back to Flatpickr's own positioning
        instance.positionCalendar();
      }
    };

    fp(inputEl, {
      allowInput: true,
      dateFormat: "d/m/Y",
      defaultDate: initialValue || null,
      // Render inside the nearest input wrapper so positioning is stable
      appendTo: anchor,

      onOpen: function (_selectedDates, _dateStr, instance) {
        const reposition = () => positionToAnchor(instance);

        // Capture scroll events from any scrollable parent (and the window)
        window.addEventListener("scroll", reposition, true);
        window.addEventListener("resize", reposition);

        instance._og_cleanupPositioning = () => {
          window.removeEventListener("scroll", reposition, true);
          window.removeEventListener("resize", reposition);
        };

        // Ensure correct position immediately on open
        reposition();
      },

      onChange: function (_selectedDates, dateStr) {
        onValue(dateStr || "");
      },

      onClose: function (_selectedDates, dateStr, instance) {
        // keep answer in sync even if user typed
        onValue(dateStr || inputEl.value || "");

        // cleanup scroll/resize listeners
        if (instance && instance._og_cleanupPositioning) {
          instance._og_cleanupPositioning();
          instance._og_cleanupPositioning = null;
        }
      },
    });

    // One more nudge after init (flatpickr builds DOM async-ish)
    try {
      setTimeout(() => {
        if (inputEl._flatpickr) positionToAnchor(inputEl._flatpickr);
      }, 0);
    } catch {
      // no-op
    }
  }

  /* =============================================================================
CH 2  Data Models (schemas, types, templates)
============================================================================= */

  // -------------------------
  // Schema model
  // -------------------------
  const QUESTION_TYPES = [
    { key: "text", label: "Text" },
    { key: "textarea", label: "Long text" },
    { key: "number", label: "Number" },
    { key: "currency", label: "Currency" },
    { key: "percent", label: "Percent" },
    { key: "email", label: "Email" },
    { key: "tel", label: "Telephone" },
    { key: "postcode", label: "Postcode" },
    { key: "date", label: "Date" },
    { key: "select", label: "Dropdown" },
    { key: "radio", label: "Radio" },
    { key: "checkboxes", label: "Checkboxes" },
    { key: "yesno", label: "Yes / No" },
  ];

  /* =============================================================================
CH 3  Templates
     3.1  Form pages
     3.2  Fixed checkout pages (Quote/Summary/Payment)

We treat Quote/Summary/Payment as FIXED pages:
- They always exist.
- They always appear at the end of the left nav.
- They cannot be deleted or re-ordered.
- They keep a starter template (editable, but the page itself remains).
============================================================================= */

  /* =============================================================================
CH 3  Templates
     3.1  Form pages
     3.2  Fixed checkout pages (Quote/Summary/Payment)

We treat Quote/Summary/Payment as FIXED pages:
- They always exist.
- They always appear at the end of the left nav.
- They cannot be deleted or re-ordered.
- They keep a starter template (editable, but the page itself remains).
============================================================================= */

// -------------------------
// Fixed checkout pages (always present)
// -------------------------
const FIXED_CHECKOUT_PAGES = [
  { id: "__fixed_quote__", name: "Quote", template: "quote" },
  { id: "__fixed_summary__", name: "Summary", template: "summary" },
  { id: "__fixed_payment__", name: "Payment", template: "payment" },
];

const isFixedPage = (p) => !!p && (p.isFixed === true || FIXED_CHECKOUT_PAGES.some((x) => x.id === p.id));

const templateLabel = (tpl) => {
  const t = String(tpl || "form");
  if (t === "quote") return "Quote page";
  if (t === "summary") return "Summary page";
  if (t === "payment") return "Payment page";
  return "Form page";
};

// Apply a template context attribute/class so CSS can target special pages.
// Your CSS can now reliably target:
//  - [data-page-template="quote"] ...
//  - [data-page-template="summary"] ...
//  - [data-page-template="payment"] ...
//  - .tpl-quote / .tpl-summary / .tpl-payment
function setTemplateContext(template) {
  const t = String(template || "form").toLowerCase();

  // Put the attribute in a few obvious places so existing CSS selectors have the best chance of matching.
  try {
    document.body.dataset.pageTemplate = t;
    document.documentElement.dataset.pageTemplate = t;
  } catch {}

  const targets = [
    canvasEl,
    inspectorEl,
    pagesListEl,
    previewBackdrop,
    previewStage,
  ].filter(Boolean);

  targets.forEach((el) => {
    try {
      el.dataset.pageTemplate = t;
      el.classList.remove("tpl-form", "tpl-quote", "tpl-summary", "tpl-payment");
      el.classList.add(`tpl-${t}`);
    } catch {}
  });
}



  // -------------------------
  // Page template presets
  // -------------------------
  function buildTemplatePreset(template) {
    const t = String(template || "form");

    // Helper to make a question with sane defaults
    const q = (type, title, extra = {}) => ({
      id: uid("q"),
      type,
      title,
      help: extra.help || "",
      placeholder: extra.placeholder || "",
      required: !!extra.required,
      errorText: extra.errorText || (extra.required ? "This field is required." : "This field is required."),
      options: Array.isArray(extra.options) ? extra.options : [],
      logic: { enabled: false, rules: [] },
      content: { enabled: false, html: "" },
      followUp: {
        enabled: false,
        triggerValue: "Yes",
        name: "",
        questions: [],
        repeat: { enabled: false, min: 1, max: 5, addLabel: "Add another", itemLabel: "Item" },
      },
    });

    if (t === "payment") {
      const gid = uid("group");
      return {
        flow: [
          {
            type: "text",
            id: uid("txt"),
            title: "Payment",
            level: "h2",
            bodyHtml: "<p>Pay securely to complete your purchase.</p>",
          },
          { type: "group", id: gid },
        ],
        groups: [
          {
            id: gid,
            name: "Payment details",
            description: {
              enabled: true,
              html: "<p>We’ll take payment securely. Your details are encrypted in transit.</p>",
            },
            logic: { enabled: false, rules: [] },
            questions: [
              q("text", "Name on card", { placeholder: "e.g. Alex Taylor", required: true }),
              q("text", "Card number", { placeholder: "1234 5678 9012 3456", required: true }),
              q("text", "Expiry date", { placeholder: "MM/YY", required: true }),
              q("text", "Security code (CVC)", { placeholder: "e.g. 123", required: true }),
              q("postcode", "Billing postcode", { placeholder: "e.g. SW1A 1AA", required: true }),
              q("email", "Email for receipt", { placeholder: "e.g. name@example.com", required: true }),
              q("yesno", "Do you accept the terms and conditions?", {
                required: true,
                errorText: "You must accept the terms and conditions to continue.",
              }),
            ],
          },
        ],
      };
    }
    if (t === "quote") {
      // Quote page template (generic Q&B pattern)
      const gid1 = uid("group");
      const gid2 = uid("group");
      const gid3 = uid("group");

      return {
        flow: [
          {
            type: "text",
            id: uid("txt"),
            title: "Your quote",
            level: "h2",
            bodyHtml:
              "<p>This is a generic <strong>Quote</strong> page template. Use it to present premium, cover and optional add-ons before the customer proceeds.</p>",
          },
          {
            type: "text",
            id: uid("txt"),
            title: "Price and payment",
            level: "h3",
            bodyHtml:
              "<p>In a live journey this section is typically populated from rating. For now, use these fields as placeholders you can edit.</p>",
          },
          { type: "group", id: gid1 },
          {
            type: "text",
            id: uid("txt"),
            title: "Cover and add-ons",
            level: "h3",
            bodyHtml:
              "<p>Customers usually choose a cover level and any optional extras here.</p>",
          },
          { type: "group", id: gid2 },
          {
            type: "text",
            id: uid("txt"),
            title: "Declarations",
            level: "h3",
            bodyHtml:
              "<p>Use clear declarations before continuing to the summary and payment steps.</p>",
          },
          { type: "group", id: gid3 },
        ],
        groups: [
          {
            id: gid1,
            name: "Premium & payment",
            description: {
              enabled: true,
              html: "<p>Show the premium and allow the customer to choose how they want to pay.</p>",
            },
            logic: { enabled: false, rules: [] },
            questions: [
              q("currency", "QuotePriceBlock", {
                placeholder: "e.g. 350.00",
                required: false,
                help: "Placeholder for the quote price block (typically populated from rating).",
              }),
              q("currency", "Monthly premium", {
                placeholder: "e.g. 32.50",
                required: false,
                help: "Typically set by rating for monthly payment plans.",
              }),
              q("select", "Payment frequency", {
                required: true,
                options: ["Annually", "Monthly"],
                help: "Choose how you’d like to pay.",
              }),
            ],
          },
          {
            id: gid2,
            name: "Cover options",
            description: {
              enabled: true,
              html: "<p>Pick a cover level and any optional add-ons.</p>",
            },
            logic: { enabled: false, rules: [] },
            questions: [
              q("radio", "Cover level", {
                required: true,
                options: ["Standard", "Plus", "Premium"],
                help: "Select the level of cover you want.",
              }),
              q("currency", "Voluntary excess", {
                placeholder: "e.g. 250",
                required: false,
                help: "Increasing excess can reduce premium.",
              }),
              q("checkboxes", "Optional add-ons", {
                required: false,
                options: [
                  "Breakdown cover",
                  "Legal expenses",
                  "Courtesy car",
                  "Key cover",
                  "Windscreen cover",
                ],
                help: "Select any optional extras you want to include.",
              }),
            ],
          },
          {
            id: gid3,
            name: "Confirm and continue",
            description: {
              enabled: true,
              html: "<p>Confirm key declarations before continuing.</p>",
            },
            logic: { enabled: false, rules: [] },
            questions: [
              q("yesno", "I confirm the information provided is correct", {
                required: true,
                errorText: "You must confirm before continuing.",
              }),
              q("yesno", "I understand this quote is based on the details provided", {
                required: true,
                errorText: "You must confirm before continuing.",
              }),
            ],
          },
        ],
      };
    }

    if (t === "summary") {
      // Summary page template (generic answers check pattern)
      const gid1 = uid("group");
      const gid2 = uid("group");

      return {
        flow: [
          {
            type: "text",
            id: uid("txt"),
            title: "Check your answers",
            level: "h2",
            bodyHtml:
              "<p>This is a generic <strong>Summary</strong> page template. In a live journey, this often shows an answers review table with ‘Change’ links.</p>",
          },
          { type: "group", id: gid1 },
          {
            type: "text",
            id: uid("txt"),
            title: "Declarations",
            level: "h3",
            bodyHtml:
              "<p>Capture final confirmations before moving to payment.</p>",
          },
          { type: "group", id: gid2 },
        ],
        groups: [
          {
            id: gid1,
            name: "Review",
            description: {
              enabled: true,
              html: "<p>Review the details you’ve entered. If something is wrong, go back and update it before continuing.</p>",
            },
            logic: { enabled: false, rules: [] },
            questions: [
              q("yesno", "Is everything correct?", {
                required: true,
                errorText: "Confirm your answers to continue.",
                help: "Select Yes to proceed to payment.",
              }),
            ],
          },
          {
            id: gid2,
            name: "Final confirmations",
            description: {
              enabled: true,
              html: "<p>Make sure the customer understands key points before purchase.</p>",
            },
            logic: { enabled: false, rules: [] },
            questions: [
              q("yesno", "I confirm I have read and understood the key information", {
                required: true,
                errorText: "You must confirm before continuing.",
              }),
              q("yesno", "I agree to receive documents electronically", {
                required: false,
                help: "Optional (edit/remove depending on your product).",
              }),
            ],
          },
        ],
      };
    }

    if (t === "payment") {
      // Payment page template (generic checkout pattern)
      const gid1 = uid("group");
      const gid2 = uid("group");
      const gid3 = uid("group");

      return {
        flow: [
          {
            type: "text",
            id: uid("txt"),
            title: "Payment",
            level: "h2",
            bodyHtml:
              "<p>This is a generic <strong>Payment</strong> page template. In production, card fields are usually provided by a payment provider (hosted fields).</p>",
          },
          { type: "group", id: gid1 },
          { type: "group", id: gid2 },
          {
            type: "text",
            id: uid("txt"),
            title: "Terms",
            level: "h3",
            bodyHtml:
              "<p>Capture acceptance of terms and any final consents.</p>",
          },
          { type: "group", id: gid3 },
        ],
        groups: [
          {
            id: gid1,
            name: "Payment method",
            description: {
              enabled: true,
              html: "<p>Select how you’d like to pay.</p>",
            },
            logic: { enabled: false, rules: [] },
            questions: [
              q("radio", "Choose payment method", {
                required: true,
                options: ["Card", "Direct Debit"],
                help: "Payment method options depend on your product.",
              }),
              q("email", "Email for receipt", {
                placeholder: "e.g. name@example.com",
                required: true,
                help: "We’ll send confirmation and documents to this address.",
              }),
            ],
          },
          {
            id: gid2,
            name: "Billing details",
            description: {
              enabled: true,
              html: "<p>These details are used for billing and verification.</p>",
            },
            logic: { enabled: false, rules: [] },
            questions: [
              q("text", "Name on card", { placeholder: "e.g. Alex Taylor", required: true }),
              q("text", "Address line 1", { placeholder: "e.g. 10 High Street", required: true }),
              q("text", "Address line 2", { placeholder: "Optional", required: false }),
              q("text", "Town or city", { placeholder: "e.g. London", required: true }),
              q("postcode", "Postcode", { placeholder: "e.g. SW1A 1AA", required: true }),
              q("text", "Card number", { placeholder: "1234 5678 9012 3456", required: true }),
              q("text", "Expiry date", { placeholder: "MM/YY", required: true }),
              q("text", "Security code (CVC)", { placeholder: "e.g. 123", required: true }),
            ],
          },
          {
            id: gid3,
            name: "Accept and pay",
            description: {
              enabled: true,
              html: "<p>Confirm acceptance of terms to complete purchase.</p>",
            },
            logic: { enabled: false, rules: [] },
            questions: [
              q("yesno", "Do you accept the terms and conditions?", {
                required: true,
                errorText: "You must accept the terms and conditions to continue.",
              }),
              q("yesno", "Would you like to receive marketing communications?", {
                required: false,
                help: "Optional (edit/remove depending on your product and compliance requirements).",
              }),
            ],
          },
        ],
      };
    }

    // default "form" = no preset
    return null;
  }

  function applyPageTemplate(pageId, template) {
    const p = getPage(pageId);
    if (!p) return;

    const t = String(template || "form");
    p.template = t;

    const preset = buildTemplatePreset(t);
    if (!preset) {
      // Keep existing structure for non-preset templates
      saveSchema();
      return;
    }

    // Replace groups + flow with preset
    p.groups = preset.groups;
    p.flow = preset.flow;

    // Update selection to first group/question
    const firstGroup = p.groups[0];
    selection.pageId = p.id;
    selection.blockType = "group";
    selection.blockId = firstGroup?.id || null;
    selection.groupId = firstGroup?.id || null;
    selection.questionId = firstGroup?.questions?.[0]?.id || null;

    saveSchema();
  }

  const OPERATORS = [
    { key: "equals", label: "equals" },
    { key: "not_equals", label: "does not equal" },
    { key: "contains", label: "contains" },
    { key: "not_contains", label: "does not contain" },
    { key: "gt", label: ">" },
    { key: "gte", label: ">=" },
    { key: "lt", label: "<" },
    { key: "lte", label: "<=" },
    { key: "is_answered", label: "is answered" },
    { key: "is_not_answered", label: "is not answered" },
  ];

  function newDefaultSchema() {
    const pageId = uid("page");
    const groupId = uid("group");
    const q1 = uid("q");

    // Base starter journey + ALWAYS appended fixed checkout pages
    return {
      meta: {
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        questionArrays: [],
      },
      lineOfBusiness: "Motor Insurance",
      pages: [
        {
          id: pageId,
          name: "About you",
          template: "form",
          // Phase 1: allow text blocks between groups via a page-level flow list
          // Backwards compatible: groups remain the source of truth for questions.
          flow: [{ type: "group", id: groupId }],
          groups: [
            {
              id: groupId,
              name: "Basics",
              description: { enabled: false, html: "" },
              logic: { enabled: false, rules: [] },
              questions: [
                {
                  id: q1,
                  type: "text",
                  title: "What is your full name?",
                  help: "Use your legal name as it appears on official documents.",
                  placeholder: "e.g. Alex Taylor",
                  required: true,
                  errorText: "This field is required.",
                  options: [],
                  logic: { enabled: false, rules: [] },
                  content: { enabled: false, html: "" },
                },
              ],
            },
          ],
        },
      ]
    };
  }

  function isOptionType(type) {
    return type === "select" || type === "radio" || type === "checkboxes";
  }

  /* =============================================================================
CH 1  State (defaults, load/save, migrate)
============================================================================= */

  // -------------------------
  // App state
  // -------------------------
  let schema = loadSchema() || newDefaultSchema();

  // Phase 1 migration/normalisation: ensure each page has a valid flow (groups + text blocks)
  function normaliseSchemaForFlow() {
    if (!schema || typeof schema !== "object") return;

    // Ensure meta exists (AI imports may omit it)
    schema.meta = schema.meta || {};
    schema.meta.questionArrays = Array.isArray(schema.meta.questionArrays)
      ? schema.meta.questionArrays
      : [];

    if (!schema.meta.version) schema.meta.version = 1;
    if (!schema.meta.createdAt) schema.meta.createdAt = new Date().toISOString();
    schema.meta.updatedAt = new Date().toISOString();

    if (!Array.isArray(schema.pages)) schema.pages = [];

    // --- Ensure fixed checkout pages always exist (and remain at the end)
    ensureFixedCheckoutPages();

    schema.pages.forEach((p) => {
      // Page template (form | quote | summary | payment)
      if (!p.template) p.template = "form";
      if (!p || typeof p !== "object") return;
      if (!p.id) p.id = uid("page");
      if (!p.name) p.name = "Untitled page";

      p.groups = Array.isArray(p.groups) ? p.groups : [];
      p.flow = Array.isArray(p.flow) ? p.flow : [];

      // Ensure each group has an id/name/questions
      p.groups.forEach((g) => {
        if (!g || typeof g !== "object") return;
        if (!g.id) g.id = uid("group");
        if (!g.name) g.name = "Untitled group";
        g.questions = Array.isArray(g.questions) ? g.questions : [];
        if (g.description == null) g.description = { enabled: false, html: "" };
        if (g.logic == null) g.logic = { enabled: false, rules: [] };

        g.questions.forEach((q) => {
          if (!q || typeof q !== "object") return;
          if (!q.id) q.id = uid("q");
          if (!q.type) q.type = "text";
          if (!q.title) q.title = "Untitled question";
          if (q.help == null) q.help = "";
          if (q.placeholder == null) q.placeholder = "";
          if (q.required == null) q.required = false;
          if (q.errorText == null) q.errorText = "This field is required.";
          if (q.options == null) q.options = [];
          if (q.logic == null) q.logic = { enabled: false, rules: [] };
          if (q.content == null) q.content = { enabled: false, html: "" };

          // Follow-up question arrays (nested questions shown when parent answer matches)
          if (q.followUp == null || typeof q.followUp !== "object") {
            q.followUp = {
              enabled: false,
              triggerValue: "Yes",
              name: "",
              questions: [],
              repeat: {
                enabled: false,
                min: 1,
                max: 5,
                addLabel: "Add another",
                itemLabel: "Item",
              },
            };
          }
          q.followUp.enabled = q.followUp.enabled === true;
          q.followUp.triggerValue = String(q.followUp.triggerValue || "Yes");
          q.followUp.name = String(q.followUp.name || "");
          q.followUp.questions = Array.isArray(q.followUp.questions) ? q.followUp.questions : [];
          q.followUp.repeat = q.followUp.repeat && typeof q.followUp.repeat === "object" ? q.followUp.repeat : {};
          q.followUp.repeat.enabled = q.followUp.repeat.enabled === true;
          q.followUp.repeat.min = Number.isFinite(Number(q.followUp.repeat.min)) ? Number(q.followUp.repeat.min) : 1;
          q.followUp.repeat.max = Number.isFinite(Number(q.followUp.repeat.max)) ? Number(q.followUp.repeat.max) : 5;
          q.followUp.repeat.min = clamp(q.followUp.repeat.min, 0, 50);
          q.followUp.repeat.max = clamp(q.followUp.repeat.max, q.followUp.repeat.min || 0, 50);
          q.followUp.repeat.addLabel = String(q.followUp.repeat.addLabel || "Add another");
          q.followUp.repeat.itemLabel = String(q.followUp.repeat.itemLabel || "Item");

          q.followUp.questions.forEach((fq) => {
            if (!fq || typeof fq !== "object") return;
            if (!fq.id) fq.id = uid("fq");
            if (!fq.type) fq.type = "text";
            if (!fq.title) fq.title = "Untitled follow-up";
            if (fq.help == null) fq.help = "";
            if (fq.placeholder == null) fq.placeholder = "";
            if (fq.required == null) fq.required = false;
            if (fq.errorText == null) fq.errorText = "This field is required.";
            if (fq.options == null) fq.options = [];
            if (fq.logic == null) fq.logic = { enabled: false, rules: [] };
            if (fq.content == null) fq.content = { enabled: false, html: "" };

            if (isOptionType(fq.type)) {
              fq.options = Array.isArray(fq.options) ? fq.options : [];
              if (fq.options.length === 0) fq.options = ["Option 1", "Option 2", "Option 3"];
            } else {
              fq.options = [];
            }
          });

          // Ensure options are present for option types
          if (isOptionType(q.type)) {
            q.options = Array.isArray(q.options) ? q.options : [];
            if (q.options.length === 0) q.options = ["Option 1", "Option 2", "Option 3"];
          } else {
            q.options = [];
          }
        });
      });

      // If no flow exists (older schema), create it from existing groups in order
      if (p.flow.length === 0) {
        p.flow = p.groups.map((g) => ({ type: "group", id: g.id }));
      }

      // Ensure text blocks have required fields
      p.flow.forEach((it) => {
        if (it?.type !== "text") return;
        if (!it.id) it.id = uid("txt");
        if (!it.title) it.title = "";
        if (!it.level) it.level = "h3";
        if (!it.bodyHtml) it.bodyHtml = "<p></p>";
      });

      // Remove flow items referencing missing groups
      const groupIds = new Set(p.groups.map((g) => g.id));
      p.flow = p.flow.filter((it) => {
        if (!it || typeof it !== "object") return false;
        if (it.type === "group") return groupIds.has(it.id);
        if (it.type === "text") return true;
        return false;
      });

      // Ensure every group appears at least once in flow
      const inFlow = new Set(p.flow.filter((x) => x?.type === "group").map((x) => x.id));
      p.groups.forEach((g) => {
        if (!inFlow.has(g.id)) p.flow.push({ type: "group", id: g.id });
      });
    });

    // Final: keep fixed pages at the end
    ensureFixedCheckoutPages();

    saveSchema();
  }

  normaliseSchemaForFlow();
  let selection = {
    pageId: schema.pages[0]?.id || null,
    // Phase 1: selection can be a group or a text block within a page
    blockType: "group", // "group" | "text"
    blockId: schema.pages[0]?.flow?.[0]?.id || schema.pages[0]?.groups[0]?.id || null,
    groupId: schema.pages[0]?.groups[0]?.id || null,
    questionId: schema.pages[0]?.groups[0]?.questions[0]?.id || null,
  };

  // Preview state
  let preview = {
    open: false,
    mode: "question", // "question" | "page"
    steps: [],
    index: 0,
    answers: {}, // qid -> value (shared across modes)
    lastError: "",
    pageErrors: {}, // page mode: qid -> errorText
  };

  // Small UI-only state (not persisted)
  let uiState = {
    selectedArrayId: null,
    newArrayName: "",
  };

  // Prevent auto-focus stealing when an option click triggers a rerender (e.g. radio -> jumps to a textarea)
// Use a time-based guard so multiple inputs rendered in one cycle can't "clear" the flag for each other.
let suppressAutoFocusUntil = 0;
const shouldSuppressAutoFocus = () => Date.now() < suppressAutoFocusUntil;

  // Drag state (builder-only; preview unaffected)
  let isDraggingUI = false;
  const markDragging = (on) => {
    isDraggingUI = on;
    if (!on) {
      // allow click events to settle after drop
      setTimeout(() => (isDraggingUI = false), 0);
    }
  };

  // Prevent inspector re-render while typing
  let isTypingInspector = false;

  /* =============================================================================
CH 4  UI Rendering
     4.1  Left nav (page list)
     4.2  Main editor (page/group/question)
     4.3  Preview / runtime
============================================================================= */

  // -------------------------
  // DOM
  // -------------------------

  // -------------------------
  // AI Assist (builder-only)
  // -------------------------
  // Simple: user describes the journey → we POST to your Worker → it returns a schema.
  // Endpoint is hard-coded here (so users don't see settings/auth fields).

  const AI_JOURNEY_ENDPOINT = "https://screen-builder-ai.laurence-ogi.workers.dev";
  // Expose for quick DevTools checks
  window.AI_JOURNEY_ENDPOINT = AI_JOURNEY_ENDPOINT;

  function isValidSchemaShape(s) {
    return !!(s && typeof s === "object" && Array.isArray(s.pages));
  }

  // Coerce common AI outputs into the schema this builder expects.
  // This fixes issues like "(Missing group)" chips and "no journey as such".
  function coerceAiSchema(input) {
    // Goal: accept a wide variety of AI outputs and coerce into OUR schema shape.
    // Our builder expects:
    // { meta, lineOfBusiness, pages:[{id,name,flow,groups:[{id,name,description,logic,questions:[{...}]}]}] }

    const mapType = (t) => {
      const x = String(t || "").toLowerCase().trim();
      if (!x) return "text";
      if (["text", "short_text", "short", "string"].includes(x)) return "text";
      if (["textarea", "long_text", "long", "paragraph"].includes(x)) return "textarea";
      if (["number", "numeric", "int", "integer", "float"].includes(x)) return "number";
      if (["currency", "money", "amount", "sum_insured", "suminsured", "premium"].includes(x)) return "currency";
      if (["percent", "percentage", "rate"].includes(x)) return "percent";
      if (["email"].includes(x)) return "email";
      if (["tel", "phone", "telephone", "mobile"].includes(x)) return "tel";
      if (["postcode", "postal_code", "zip", "zip_code"].includes(x)) return "postcode";
      if (["date", "dob"].includes(x)) return "date";
      if (["select", "dropdown"].includes(x)) return "select";
      if (["radio", "single_select", "single"].includes(x)) return "radio";
      if (["checkbox", "checkboxes", "multi_select", "multi"].includes(x)) return "checkboxes";
      if (["yesno", "yes_no", "boolean", "bool"].includes(x)) return "yesno";
      // fall back to text
      return "text";
    };

    const normaliseOptions = (raw) => {
      if (!raw) return [];
      // strings
      if (Array.isArray(raw)) {
        return raw
          .map((o) => {
            if (typeof o === "string") return o;
            if (o && typeof o === "object") return o.label || o.text || o.value || o.name || "";
            return "";
          })
          .map((s) => String(s || "").trim())
          .filter(Boolean);
      }
      // object map {key:label}
      if (raw && typeof raw === "object") {
        return Object.values(raw)
          .map((v) => String(v || "").trim())
          .filter(Boolean);
      }
      return [];
    };

    const normaliseQuestion = (rawQ) => {
      const q = rawQ && typeof rawQ === "object" ? rawQ : {};

      const type = mapType(q.type || q.component || q.inputType || q.kind || q.widget);

      const title =
        q.title ||
        q.label ||
        q.question ||
        q.text ||
        q.name ||
        q.prompt ||
        "Untitled question";

      const help = q.help || q.description || q.hint || "";
      const placeholder = q.placeholder || q.example || "";
      const required = q.required ?? q.mandatory ?? q.isRequired ?? false;
      const errorText = q.errorText || q.error || (required ? "This field is required." : "");

      // Options might be in options/choices/values/items
      const options = isOptionType(type)
        ? normaliseOptions(q.options || q.choices || q.values || q.items)
        : [];

      return {
        id: q.id || q.key || uid("q"),
        type,
        title: String(title || "Untitled question").trim() || "Untitled question",
        help: String(help || ""),
        placeholder: String(placeholder || ""),
        required: !!required,
        errorText: String(errorText || "This field is required."),
        options: options.length ? options : isOptionType(type) ? ["Option 1", "Option 2", "Option 3"] : [],
        logic: q.logic && typeof q.logic === "object" ? q.logic : { enabled: false, rules: [] },
        content: q.content && typeof q.content === "object" ? q.content : { enabled: false, html: "" },
      };
    };

    const normaliseGroup = (rawG) => {
      const g = rawG && typeof rawG === "object" ? rawG : {};

      // Questions might be nested under questions/items/fields
      const rawQuestions =
        (Array.isArray(g.questions) && g.questions) ||
        (Array.isArray(g.items) && g.items) ||
        (Array.isArray(g.fields) && g.fields) ||
        (Array.isArray(g.inputs) && g.inputs) ||
        [];

      return {
        id: g.id || g.key || uid("group"),
        name: String(g.name || g.title || g.label || "Untitled group").trim() || "Untitled group",
        description:
          g.description && typeof g.description === "object"
            ? g.description
            : { enabled: false, html: "" },
        logic: g.logic && typeof g.logic === "object" ? g.logic : { enabled: false, rules: [] },
        questions: rawQuestions.map(normaliseQuestion),
      };
    };

    const normalisePage = (rawP, idx) => {
      const p = rawP && typeof rawP === "object" ? rawP : {};

      // Groups might be under groups/sections/steps/blocks
      let rawGroups =
        (Array.isArray(p.groups) && p.groups) ||
        (Array.isArray(p.sections) && p.sections) ||
        (Array.isArray(p.steps) && p.steps) ||
        (Array.isArray(p.blocks) && p.blocks) ||
        [];

      // Some AIs return a flat questions array per page
      const pageQuestions =
        (Array.isArray(p.questions) && p.questions) ||
        (Array.isArray(p.fields) && p.fields) ||
        [];

      if (!rawGroups.length && pageQuestions.length) {
        rawGroups = [{ name: "Basics", questions: pageQuestions }];
      }

      const groups = rawGroups.map(normaliseGroup);

      const pageId = p.id || p.key || uid("page");
      const pageName = String(p.name || p.title || p.label || `Page ${idx + 1}`).trim() || `Page ${idx + 1}`;

      // Flow: if AI provided a flow, keep text blocks; otherwise derive from groups
      let flow = Array.isArray(p.flow) ? p.flow : [];

      // Coerce any "text blocks" style items if present
      if (Array.isArray(p.contentBlocks) && p.contentBlocks.length) {
        p.contentBlocks.forEach((tb) => {
          if (!tb || typeof tb !== "object") return;
          flow.push({
            type: "text",
            id: tb.id || uid("txt"),
            title: tb.title || "",
            level: tb.level || "h3",
            bodyHtml: tb.bodyHtml || tb.html || "<p></p>",
          });
        });
      }

      // Ensure group flow items exist
      const groupIds = new Set(groups.map((g) => g.id));
      const inFlow = new Set(flow.filter((x) => x && x.type === "group").map((x) => x.id));
      groups.forEach((g) => {
        if (!inFlow.has(g.id)) flow.push({ type: "group", id: g.id });
      });

      // Filter out any broken flow items
      flow = flow.filter((it) => {
        if (!it || typeof it !== "object") return false;
        if (it.type === "group") return groupIds.has(it.id);
        if (it.type === "text") {
          if (!it.id) it.id = uid("txt");
          if (!it.level) it.level = "h3";
          if (!it.title) it.title = "";
          if (!it.bodyHtml) it.bodyHtml = "<p></p>";
          return true;
        }
        return false;
      });

      return {
        id: pageId,
        name: pageName,
        template: String(p.template || p.pageType || p.type || "form").toLowerCase(),
        flow,
        groups,
      };
    };

    // 1) If input is a JSON string, parse
    let s = input;
    if (typeof s === "string") {
      try {
        s = JSON.parse(s);
      } catch {
        return newDefaultSchema();
      }
    }

    if (!s || typeof s !== "object") return newDefaultSchema();

    // 2) Common wrappers
    if (s.schema) s = s.schema;
    if (s.journey) s = s.journey;

    // 3) If the worker returns { result: "{...}" }
    if (typeof s.result === "string") {
      try {
        s = JSON.parse(s.result);
      } catch {
        // If it isn't JSON, give up safely
        return newDefaultSchema();
      }
    } else if (s.result && typeof s.result === "object") {
      s = s.result;
    }

    // 4) If AI returned just an array of pages
    if (Array.isArray(s)) {
      s = { pages: s };
    }

    // 5) If AI returned just questions
    if (!Array.isArray(s.pages) && Array.isArray(s.questions)) {
      s.pages = [{ name: "About you", questions: s.questions }];
    }

    // 6) Normalise final shape
    const pages = Array.isArray(s.pages) ? s.pages.map(normalisePage) : [];

    const out = {
      meta: {
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      lineOfBusiness: String(s.lineOfBusiness || s.name || s.title || "New Journey").trim() || "New Journey",
      pages,
    };

    return out.pages.length ? out : newDefaultSchema();
  }

  async function requestAiTemplate(promptText) {
    const AI_CAPABILITIES = {
      schemaContract: "Must return a JSON object with { pages: [...] }",
      questionTypes: ["text","textarea","number","currency","percent","email","tel","postcode","date","select","radio","checkboxes","yesno"],
      optionTypes: ["select","radio","checkboxes"],
      questionFields: [
        "id","type","title","help","placeholder","required","errorText","options","logic","content"
      ],
      groupFields: ["id","name","description","logic","questions"],
      pageFields: ["id","name","groups","flow"],
      logicOperators: OPERATORS.map(o => o.key),
      guidance: {
        intent: "Generate a realistic insurance QUICK QUOTE journey, not a full underwriting form",
        preferredLength: "3–6 pages, ~25–45 questions total",
        tone: "Broker-friendly, plain English",
        completeness: "Populate titles, help text, placeholders, required flags and sensible option lists",
        constraints: "Do not invent unsupported question types or fields"
      }
    };

    const res = await fetch(AI_JOURNEY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: String(promptText || "").slice(0, 8000),
        builderCapabilities: AI_CAPABILITIES,
        schemaVersion: schema?.meta?.version || 1
      }),
    });

    const rawText = await res.text().catch(() => "");

    if (!res.ok) {
      console.error("AI HTTP error:", res.status, rawText);
      throw new Error(rawText || `AI request failed (${res.status})`);
    }

    let data = rawText;
    try { data = rawText ? JSON.parse(rawText) : {}; } catch {}

    console.log("AI RAW RESPONSE:", data);
    window.__AI_LAST_RAW = data;
    window.__AI_LAST_RAW_TEXT = rawText;

    let candidate = data;

    if (typeof candidate === "string") {
      try { candidate = JSON.parse(candidate); } catch {}
    }

    if (candidate && typeof candidate === "object") {
      if (candidate.schema) candidate = candidate.schema;
      if (candidate.journey) candidate = candidate.journey;

      if (typeof candidate.result === "string") {
        try {
          candidate = JSON.parse(candidate.result);
        } catch {
          throw new Error("AI returned invalid JSON in result field");
        }
      } else if (typeof candidate.result === "object") {
        candidate = candidate.result;
      }
    }

    window.__AI_LAST_CANDIDATE = candidate;

    const coerced = coerceAiSchema(candidate);
    window.__AI_LAST_SCHEMA = coerced;

    if (!isValidSchemaShape(coerced)) {
      console.error("AI schema shape invalid. Expected { pages: [...] }. Got:", coerced);
      throw new Error("AI returned an invalid schema. Expected { pages: [...] }.");
    }

    return coerced;
  }

  function importJourneyTemplate(schemaFromAI) {
    // Replace current schema with AI schema, then normalise + re-render.
    const next = coerceAiSchema(schemaFromAI);

    if (!next || typeof next !== "object" || !Array.isArray(next.pages)) {
      throw new Error("AI returned an invalid schema. Expected { pages: [...] }.");
    }

    schema = next;

    // Ensure essential fields exist
    schema.meta = schema.meta || {};
    if (!schema.meta.version) schema.meta.version = 1;
    if (!schema.meta.createdAt) schema.meta.createdAt = new Date().toISOString();
    schema.meta.updatedAt = new Date().toISOString();
    if (!schema.lineOfBusiness) schema.lineOfBusiness = "New Journey";

    normaliseSchemaForFlow();
    ensureSelection();
    saveSchema();
    renderAll(true);
  }

  function mountAiAssistUI() {
    // Mount AI Assist at the top of the Structure panel.
    const mount = pagesListEl?.parentElement || lobTitleEl?.parentElement;
    if (!mount) return;

    // Avoid double-mount
    if (mount.querySelector(".aiAssist")) return;

    const wrap = document.createElement("div");
    wrap.className = "aiAssist";

    wrap.innerHTML = `
      <div class="aiAssistTitle">AI Assist</div>
      <div class="aiAssistHelp">Describe the journey you want. We'll generate a starter template you can edit.</div>
      <textarea class="aiAssistInput" rows="3" placeholder="e.g. Travel insurance quick quote: destination, policy type, email, dates, medical declaration, add-ons. Keep it short and broker-friendly."></textarea>
      <div class="aiAssistActions" style="margin-top:10px; display:flex; gap:10px; align-items:center;">
        <button type="button" class="btn ghost aiAssistBtn">Generate template</button>
        <div class="aiAssistStatus muted" style="margin-left:auto; display:none;"></div>
      </div>
    `;

    // Insert above the pages list
    if (pagesListEl && pagesListEl.parentElement === mount) {
      mount.insertBefore(wrap, pagesListEl);
    } else {
      mount.insertBefore(wrap, mount.firstChild);
    }

    const input = wrap.querySelector(".aiAssistInput");
    const btn = wrap.querySelector(".aiAssistBtn");
    const status = wrap.querySelector(".aiAssistStatus");

    const setStatus = (msg, isError = false) => {
      if (!status) return;
      status.style.display = msg ? "block" : "none";
      status.textContent = msg || "";
      status.style.opacity = isError ? "1" : "0.9";
    };

    // Minimal spinner styling (self-contained, injected once)
    const ensureAiAssistSpinnerStyles = () => {
      if (document.getElementById("ogAiAssistSpinnerStyles")) return;
      const style = document.createElement("style");
      style.id = "ogAiAssistSpinnerStyles";
      style.textContent = `
        .aiAssistBtn.isLoading{ position:relative; opacity:0.9; }
        .aiAssistBtn .ogSpinner{ display:inline-block; width:14px; height:14px; border:2px solid currentColor; border-right-color:transparent; border-radius:999px; margin-right:8px; vertical-align:-2px; animation:ogSpin 0.8s linear infinite; }
        @keyframes ogSpin{ to{ transform:rotate(360deg); } }
      `;
      document.head.appendChild(style);
    };

    const setButtonLoading = (on) => {
      if (!btn) return;
      ensureAiAssistSpinnerStyles();

      if (on) {
        btn.dataset._label = btn.dataset._label || btn.textContent || "Generate template";
        btn.classList.add("isLoading");
        btn.setAttribute("aria-busy", "true");
        btn.innerHTML = `<span class="ogSpinner" aria-hidden="true"></span><span>Generating…</span>`;
      } else {
        btn.classList.remove("isLoading");
        btn.removeAttribute("aria-busy");
        const label = btn.dataset._label || "Generate template";
        btn.textContent = label;
      }
    };

    // Tiny UX: Cmd/Ctrl+Enter to generate
    input?.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        btn?.click();
      }
    });

    btn?.addEventListener("click", async () => {
      const promptText = (input?.value || "").trim();
      if (!promptText) {
        setStatus("Add a short description first.", true);
        input?.focus();
        return;
      }

      const hasExisting = schema?.pages?.length > 0;
      if (hasExisting) {
        const ok = confirm("Generate a new template and REPLACE your current journey?");
        if (!ok) return;
      }

      try {
        btn.disabled = true;
        setButtonLoading(true);
        setStatus("");

        const nextSchema = await requestAiTemplate(promptText);
        importJourneyTemplate(nextSchema);

        setStatus("Template applied.");
      } catch (e) {
        setStatus(e?.message || "AI template generation failed.", true);
      } finally {
        setButtonLoading(false);
        btn.disabled = false;
      }
    });
  }

  const $ = (sel) => document.querySelector(sel);

  const lobTitleEl = $("#lobTitle");
  const pagesListEl = $("#pagesList");
  const canvasEl = $("#canvas");
  const inspectorEl = $("#inspector");
  const inspectorSubEl = $("#inspectorSub");
  const editorTitleEl = $("#editorTitle");
  const emptyStateEl = $("#emptyState");
  const editorEl = $("#editor");
  const pageNameDisplayEl = $("#pageNameDisplay");
  const groupNameDisplayEl = $("#groupNameDisplay");
  const miniStatsEl = $("#miniStats");

  const btnAddPage = $("#btnAddPage");
  const btnAddGroup = $("#btnAddGroup");
  const btnAddQuestion = $("#btnAddQuestion");
  const btnPreview = $("#btnPreview");
  const btnExport = $("#btnExport");
  const btnImport = $("#btnImport");
  const fileInput = $("#fileInput");
  const emptyAddPage = $("#emptyAddPage");

  // Preview modal DOM
  const previewBackdrop = $("#previewBackdrop");
  const btnClosePreview = $("#btnClosePreview");
  const btnPrev = $("#btnPrev");
  const btnNext = $("#btnNext");
  const previewStage = $("#previewStage");
  const previewTitle = $("#previewTitle");
  const previewSub = $("#previewSub");
  const progressFill = $("#progressFill");
  const progressText = $("#progressText");

  // -------------------------
  // Persistence
  // -------------------------
  function saveSchema() {
    // Ensure meta exists (AI imports may omit it)
    schema.meta = schema.meta || {};
    if (!schema.meta.version) schema.meta.version = 1;
    if (!schema.meta.createdAt) schema.meta.createdAt = new Date().toISOString();
    schema.meta.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
  }

  const saveSchemaDebounced = debounce(saveSchema, 120);

  function loadSchema() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.pages)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  // -------------------------
  // Find helpers
  // -------------------------
  function getPage(pid) {
    return schema.pages.find((p) => p.id === pid) || null;
  }
  function getGroup(pid, gid) {
    const p = getPage(pid);
    return p?.groups?.find((g) => g.id === gid) || null;
  }
  function getQuestion(pid, gid, qid) {
    const g = getGroup(pid, gid);
    return g?.questions?.find((q) => q.id === qid) || null;
  }

  function ensureSelection() {
    if (!schema.pages.length) {
      selection = { pageId: null, blockType: "group", blockId: null, groupId: null, questionId: null };
      return;
    }

    const p = getPage(selection.pageId) || schema.pages[0];
    selection.pageId = p.id;
    p.flow = Array.isArray(p.flow) ? p.flow : p.groups.map((g) => ({ type: "group", id: g.id }));

    // Determine the selected flow item
    let flowItem = p.flow.find((it) => it.id === selection.blockId) || null;

    // If no flow item selected, default to first flow item
    if (!flowItem) {
      flowItem = p.flow[0] || null;
      selection.blockId = flowItem?.id || null;
      selection.blockType = flowItem?.type || "group";
    }

    // If selected is a text block
    if (flowItem && flowItem.type === "text") {
      selection.blockType = "text";
      selection.blockId = flowItem.id;
      selection.groupId = null;
      selection.questionId = null;
      return;
    }

    // Otherwise selected is a group
    selection.blockType = "group";
    selection.blockId = flowItem?.id || selection.groupId;

    if (!p.groups?.length) {
      selection.groupId = null;
      selection.questionId = null;
      return;
    }

    const g = getGroup(p.id, selection.groupId) || p.groups.find((gg) => gg.id === selection.blockId) || p.groups[0];
    selection.groupId = g.id;

    if (!g.questions?.length) {
      selection.questionId = null;
      return;
    }

    const q = getQuestion(p.id, g.id, selection.questionId) || g.questions[0];
    selection.questionId = q.id;
  }

  // -------------------------
  // Rendering
  // -------------------------
  function renderAll(forceInspector = false) {
    ensureSelection();

    // Empty state
    const hasAnything = schema.pages.length > 0;
    emptyStateEl.classList.toggle("show", !hasAnything);
    editorEl.style.display = hasAnything ? "block" : "none";

    // LoB title (avoid cursor jumps)
    if (lobTitleEl && safeText(lobTitleEl) !== schema.lineOfBusiness) {
      lobTitleEl.textContent = schema.lineOfBusiness || "Line of Business";
    }

    renderPagesList();
    renderCanvas();

    // CRITICAL: do not rebuild inspector while user is actively typing in a text field (prevents 1-letter bug)
    const ae = document.activeElement;
    const typingNow = ae && ae.closest && ae.closest("#inspector") && isTextEditingElement(ae);
    if (forceInspector || (!typingNow && !isTypingInspector)) {
      renderInspector();
    }

    renderMiniStats();

    // Header labels
    const p = getPage(selection.pageId);
    const g = getGroup(selection.pageId, selection.groupId);

    // ✅ Key: expose the selected page template to the DOM for CSS targeting
    setTemplateContext(p?.template || "form");

    editorTitleEl.textContent = p ? `Editor · ${p.name}` : "Editor";
    pageNameDisplayEl.textContent = p ? p.name : "—";
    groupNameDisplayEl.textContent = g ? g.name : "—";
  }

  function renderPagesList() {
    /* ----------------------------------------------------------------------
    CH 4.1  Left nav (page list)

    Fixed pages:
    - Quote / Summary / Payment always exist and are always last.
    ---------------------------------------------------------------------- */
    pagesListEl.innerHTML = "";

    // DnD helpers (pages)
    const canStartDragFrom = (el) => {
      if (!el) return true;
      if (el.closest && el.closest(".pageName")) return false;
      if (el.closest && el.closest(".iconBtn")) return false;
      if (el.isContentEditable) return false;
      return true;
    };

    // Split editable pages vs fixed checkout pages
    const editablePages = (schema.pages || []).filter((p) => !isFixedPage(p));
    const fixedPages = FIXED_CHECKOUT_PAGES
      .map((fp) => schema.pages.find((p) => p.id === fp.id))
      .filter(Boolean);

    // IMPORTANT:
    // We must store *schema index* for drag/drop moves (because schema.pages includes fixed pages).
    // We also keep an *editable index* for enabling/disabling move up/down buttons.
    const renderPageItem = (p, schemaIdx, editableIdx, isFixed) => {
      p.flow = Array.isArray(p.flow) ? p.flow : p.groups.map((g) => ({ type: "group", id: g.id }));

      const pageDiv = document.createElement("div");
      pageDiv.className =
        "pageItem" +
        (p.id === selection.pageId ? " active" : "") +
        (isFixed ? " fixed" : "") +
        ` tpl-${String(p.template || "form").toLowerCase()}`;

      // Expose template to CSS selectors
      pageDiv.dataset.pageTemplate = String(p.template || "form").toLowerCase();

      // Make page draggable (builder-only) — but never for fixed pages
      pageDiv.draggable = !preview.open && !isFixed;
      pageDiv.dataset.pageId = p.id;
      pageDiv.dataset.schemaIndex = String(schemaIdx);

      pageDiv.addEventListener("dragstart", (e) => {
        if (preview.open || isFixed) {
          e.preventDefault();
          return;
        }
        if (!canStartDragFrom(e.target)) {
          e.preventDefault();
          return;
        }
        markDragging(true);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/og-page", p.id);
        e.dataTransfer.setData("text/og-page-schema-index", String(schemaIdx));
        pageDiv.classList.add("isDragging");
      });

      pageDiv.addEventListener("dragend", () => {
        pageDiv.classList.remove("isDragging");
        markDragging(false);
      });

      pageDiv.addEventListener("dragover", (e) => {
        if (isFixed) return;
        if (!e.dataTransfer.types.includes("text/og-page")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        pageDiv.classList.add("isDragOver");
      });

      pageDiv.addEventListener("dragleave", () => {
        pageDiv.classList.remove("isDragOver");
      });

      pageDiv.addEventListener("drop", (e) => {
        if (isFixed) return;
        if (!e.dataTransfer.types.includes("text/og-page")) return;
        e.preventDefault();
        pageDiv.classList.remove("isDragOver");

        const fromIdx = Number(e.dataTransfer.getData("text/og-page-schema-index"));
        const toIdx = Number(pageDiv.dataset.schemaIndex);
        if (!Number.isFinite(fromIdx) || !Number.isFinite(toIdx)) return;
        if (fromIdx === toIdx) return;

        // Move within schema.pages by schema indices, then re-enforce fixed pages at end
        moveItem(schema.pages, fromIdx, toIdx);
        ensureFixedCheckoutPages();
        saveSchema();
        renderAll();
      });

      const top = document.createElement("div");
      top.className = "pageTop";

      const left = document.createElement("div");
      left.style.flex = "1";
      left.style.minWidth = "0";

      const name = document.createElement("div");
      name.className = "pageName";
      name.contentEditable = isFixed ? "false" : "true";
      name.spellcheck = false;
      name.setAttribute("role", "textbox");
      name.setAttribute("aria-label", "Page name");
      name.title = isFixed ? "Fixed page" : "Click to rename";
      name.textContent = p.name;

      if (!isFixed) {
        name.addEventListener("mousedown", (e) => e.stopPropagation());
        name.addEventListener("click", (e) => e.stopPropagation());

        name.addEventListener("focus", (e) => {
          e.stopPropagation();
          selection.pageId = p.id;
          ensureSelection();
          requestAnimationFrame(() => selectAllContent(name));
        });

        name.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            name.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            name.textContent = p.name;
            name.blur();
          }
        });

        name.addEventListener("blur", () => {
          const next = safeText(name) || "Untitled page";
          name.textContent = next;
          p.name = next;
          saveSchema();
          renderAll();
        });

        name.addEventListener("input", () => {
          p.name = safeText(name) || "Untitled page";
          saveSchemaDebounced();
          editorTitleEl.textContent = `Editor · ${p.name}`;
          pageNameDisplayEl.textContent = p.name;
          renderMiniStats();
        });
      }

      const meta = document.createElement("div");
      meta.className = "pageMeta";
      const qCount = p.groups.reduce((acc, g) => acc + (g.questions?.length || 0), 0);
      meta.textContent = `${templateLabel(p.template)} · ${p.groups.length} group${p.groups.length !== 1 ? "s" : ""} · ${qCount} question${qCount !== 1 ? "s" : ""}`;

      left.appendChild(name);
      left.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "pageActions";

      if (!isFixed) {
        const renameBtn = iconButton("✎", "Rename page");
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          name.focus();
          requestAnimationFrame(() => selectAllContent(name));
        });

        const upBtn = iconButton("↑", "Move up");
        upBtn.disabled = editableIdx === 0;
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          // Move within schema.pages by schema index
          moveItem(schema.pages, schemaIdx, schemaIdx - 1);
          ensureFixedCheckoutPages();
          saveSchema();
          renderAll();
        });

        const downBtn = iconButton("↓", "Move down");
        downBtn.disabled = editableIdx === editablePages.length - 1;
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveItem(schema.pages, schemaIdx, schemaIdx + 1);
          ensureFixedCheckoutPages();
          saveSchema();
          renderAll();
        });

        const delBtn = iconButton("✕", "Delete page");
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!confirm(`Delete page "${p.name}"? This cannot be undone.`)) return;
          schema.pages = schema.pages.filter((x) => x.id !== p.id);
          ensureFixedCheckoutPages();
          saveSchema();
          ensureSelection();
          renderAll();
        });

        actions.appendChild(renameBtn);
        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        actions.appendChild(delBtn);
      }

      top.appendChild(left);
      top.appendChild(actions);
      pageDiv.appendChild(top);

      // Flow chips (only for editable pages; fixed pages are treated as templates)
      if (!isFixed) {
        const chips = document.createElement("div");
        chips.className = "groupsMini";

        p.flow.forEach((it) => {
          if (it.type === "group") {
            const g = p.groups.find((gg) => gg.id === it.id);
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className =
              "groupChip" +
              (p.id === selection.pageId && selection.blockType === "group" && selection.groupId === g?.id ? " active" : "");
            chip.textContent = g?.name || "(Missing group)";
            chip.addEventListener("click", (e) => {
              e.stopPropagation();
              selection.pageId = p.id;
              selection.blockType = "group";
              selection.blockId = it.id;
              selection.groupId = it.id;
              selection.questionId = g?.questions?.[0]?.id || null;
              renderAll();
            });
            chips.appendChild(chip);
          }

          if (it.type === "text") {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className =
              "groupChip" +
              (p.id === selection.pageId && selection.blockType === "text" && selection.blockId === it.id ? " active" : "");
            chip.textContent = it.title ? `📝 ${it.title}` : "📝 Text block";
            chip.addEventListener("click", (e) => {
              e.stopPropagation();
              selection.pageId = p.id;
              selection.blockType = "text";
              selection.blockId = it.id;
              selection.groupId = null;
              selection.questionId = null;
              renderAll();
            });
            chips.appendChild(chip);
          }
        });

        const addTextChip = document.createElement("button");
        addTextChip.type = "button";
        addTextChip.className = "groupChip";
        addTextChip.textContent = "+ Text";
        addTextChip.addEventListener("click", (e) => {
          e.stopPropagation();
          selection.pageId = p.id;
          addTextBlockToPage(p.id);
        });
        chips.appendChild(addTextChip);

        const addGroupChip = document.createElement("button");
        addGroupChip.type = "button";
        addGroupChip.className = "groupChip";
        addGroupChip.textContent = "+ Group";
        addGroupChip.addEventListener("click", (e) => {
          e.stopPropagation();
          selection.pageId = p.id;
          addGroupToPage(p.id);
        });
        chips.appendChild(addGroupChip);

        pageDiv.appendChild(chips);
      }

      // click page selects it
      pageDiv.addEventListener("click", () => {
        if (isDraggingUI) return;
        selection.pageId = p.id;

        if (isFixed) {
          // Fixed pages: default to first group
          const g0 = p.groups[0];
          selection.blockType = "group";
          selection.blockId = g0?.id || null;
          selection.groupId = g0?.id || null;
          selection.questionId = g0?.questions?.[0]?.id || null;
          renderAll(true);
          return;
        }

        const first = p.flow[0];
        if (first?.type === "text") {
          selection.blockType = "text";
          selection.blockId = first.id;
          selection.groupId = null;
          selection.questionId = null;
        } else {
          const g0 = p.groups.find((gg) => gg.id === first?.id) || p.groups[0];
          selection.blockType = "group";
          selection.blockId = g0?.id || null;
          selection.groupId = g0?.id || null;
          selection.questionId = g0?.questions?.[0]?.id || null;
        }
        renderAll();
      });

      pagesListEl.appendChild(pageDiv);
    };

    // Render editable pages (in order)
    editablePages.forEach((p, editableIdx) => {
      const schemaIdx = schema.pages.findIndex((x) => x.id === p.id);
      renderPageItem(p, schemaIdx, editableIdx, false);
    });

    // Divider label
    if (fixedPages.length) {
      const div = document.createElement("div");
      div.className = "sectionTitle";
      div.style.marginTop = "14px";
      div.style.opacity = "0.9";
      div.textContent = "Checkout pages";
      pagesListEl.appendChild(div);
    }

    // Render fixed pages (Quote, Summary, Payment)
    fixedPages.forEach((p) => {
      renderPageItem(p, -1, true);
    });
  }

  function renderCanvas() {
    /* ----------------------------------------------------------------------
    CH 4.2  Main editor (page/group/question)
    ---------------------------------------------------------------------- */
    canvasEl.innerHTML = "";

    const p = getPage(selection.pageId);
    if (!p) return;

    // DnD helpers (questions)
    const canStartDragFromQ = (el) => {
      if (!el) return true;
      if (el.closest && el.closest(".iconBtn")) return false;
      if (el.isContentEditable) return false;
      return true;
    };

    // Phase 1: if a text block is selected, show a simple preview card
    if (selection.blockType === "text") {
      const tb = (p.flow || []).find((x) => x.type === "text" && x.id === selection.blockId);

      const card = document.createElement("div");
      card.className = "tip";

      const level = tb?.level || "h3";
      const title = tb?.title || "Text block";
      const body = sanitizeRichHtml(tb?.bodyHtml || "");

      card.innerHTML = `
        <div class="tipTitle">📝 ${escapeHtml(title)}</div>
        <div class="muted">This is a text block separator. It will be used when we switch Preview to page-by-page mode.</div>
        <div style="margin-top:10px">${body || "<p class='muted'>No content yet.</p>"}</div>
      `;

      canvasEl.appendChild(card);
      return;
    }

    const g = getGroup(selection.pageId, selection.groupId);
    if (!g) return;

    // Canvas header: show Page title, then Group title + description at the top
    const canvasHeader = document.createElement("div");
    canvasHeader.className = "canvasHeader";

    const pageTitle = document.createElement("div");
    pageTitle.className = "canvasPageTitle";
    pageTitle.textContent = p.name || "Untitled page";

    const groupTitle = document.createElement("div");
    groupTitle.className = "canvasGroupTitle";
    groupTitle.textContent = g.name || "Untitled group";

    canvasHeader.appendChild(pageTitle);
    canvasHeader.appendChild(groupTitle);

    if (g.description?.enabled) {
      const descHtml = sanitizeRichHtml(g.description.html || "");
      if (descHtml) {
        const groupDesc = document.createElement("div");
        groupDesc.className = "canvasGroupDesc";
        groupDesc.innerHTML = descHtml;
        canvasHeader.appendChild(groupDesc);
      }
    }

    canvasEl.appendChild(canvasHeader);

    // Helper: render the contextual "+ Question" button under the list
    const renderAddQuestionCTA = () => {
      const wrap = document.createElement("div");
      wrap.className = "canvasAddRow";
      wrap.style.marginTop = "14px";
      wrap.style.display = "flex";
      wrap.style.justifyContent = "flex-end";

      btnAddQuestion.classList.add("btn");
      wrap.appendChild(btnAddQuestion);
      canvasEl.appendChild(wrap);
    };

    if (!g.questions.length) {
      const empty = document.createElement("div");
      empty.className = "tip";
      empty.innerHTML = `
        <div class="tipTitle">No questions in this group</div>
        <p class="muted">Add your first question to start building a Typeform-style journey.</p>
      `;
      canvasEl.appendChild(empty);
      renderAddQuestionCTA();
      return;
    }

    g.questions.forEach((q, qIdx) => {
      const card = document.createElement("div");
      card.className = "qCard" + (q.id === selection.questionId ? " active" : "");

      // Make question cards draggable (builder-only)
      card.draggable = !preview.open; // builder canvas only
      card.dataset.qId = q.id;
      card.dataset.qIndex = String(qIdx);

      card.addEventListener("dragstart", (e) => {
        if (preview.open) { e.preventDefault(); return; }
        if (!canStartDragFromQ(e.target)) {
          e.preventDefault();
          return;
        }
        markDragging(true);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/og-q", q.id);
        e.dataTransfer.setData("text/og-q-index", String(qIdx));
        card.classList.add("isDragging");
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("isDragging");
        markDragging(false);
      });

      card.addEventListener("dragover", (e) => {
        if (!e.dataTransfer.types.includes("text/og-q")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        card.classList.add("isDragOver");
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("isDragOver");
      });

      card.addEventListener("drop", (e) => {
        if (!e.dataTransfer.types.includes("text/og-q")) return;
        e.preventDefault();
        card.classList.remove("isDragOver");

        const fromIdx = Number(e.dataTransfer.getData("text/og-q-index"));
        const toIdx = Number(card.dataset.qIndex);
        if (!Number.isFinite(fromIdx) || !Number.isFinite(toIdx)) return;
        if (fromIdx === toIdx) return;

        moveItem(g.questions, fromIdx, toIdx);
        saveSchema();
        renderAll();
      });

      const left = document.createElement("div");
      left.className = "qLeft";

      const title = document.createElement("div");
      title.className = "qTitle";
      title.textContent = q.title || "Untitled question";

      const meta = document.createElement("div");
      meta.className = "qMeta";

      const typeBadge = document.createElement("span");
      typeBadge.className = "badge";
      typeBadge.textContent = QUESTION_TYPES.find((t) => t.key === q.type)?.label || q.type;
      meta.appendChild(typeBadge);

      if (q.required) {
        const req = document.createElement("span");
        req.className = "badge req";
        req.textContent = "Required";
        meta.appendChild(req);
      }

      if (q.logic?.enabled && (q.logic.rules?.length || 0) > 0) {
        const lg = document.createElement("span");
        lg.className = "badge logic";
        lg.textContent = "Logic";
        meta.appendChild(lg);
      }

      left.appendChild(title);
      left.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "qActions";

      const upBtn = iconButton("↑", "Move up");
      upBtn.disabled = qIdx === 0;
      upBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveItem(g.questions, qIdx, qIdx - 1);
        saveSchema();
        renderAll();
      });

      const downBtn = iconButton("↓", "Move down");
      downBtn.disabled = qIdx === g.questions.length - 1;
      downBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveItem(g.questions, qIdx, qIdx + 1);
        saveSchema();
        renderAll();
      });

      const dupBtn = iconButton("⧉", "Duplicate");
      dupBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const copy = deepClone(q);
        copy.id = uid("q");
        g.questions.splice(qIdx + 1, 0, copy);
        selection.questionId = copy.id;
        saveSchema();
        renderAll();
      });

      const delBtn = iconButton("✕", "Delete");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm("Delete this question?")) return;
        g.questions = g.questions.filter((x) => x.id !== q.id);
        if (selection.questionId === q.id) selection.questionId = g.questions[0]?.id || null;
        saveSchema();
        renderAll();
      });

      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
      actions.appendChild(dupBtn);
      actions.appendChild(delBtn);

      card.appendChild(left);
      card.appendChild(actions);

      card.addEventListener("click", () => {
        // Ignore click selection during/just-after drag
        if (isDraggingUI) return;
        selection.questionId = q.id;
        renderAll();
      });

      canvasEl.appendChild(card);
    });

    renderAddQuestionCTA();
  }

  function renderInspector() {
    inspectorEl.innerHTML = "";
    const p = getPage(selection.pageId);
    const g = getGroup(selection.pageId, selection.groupId);
    const q = getQuestion(selection.pageId, selection.groupId, selection.questionId);

    if (!p) {
      inspectorSubEl.textContent = "Create a page to get started";
      return;
    }

    // Page settings (always available)
    inspectorEl.appendChild(sectionTitle("Page"));

    inspectorEl.appendChild(fieldText("Page name", p.name || "Untitled page", (val) => {
      // Fixed pages cannot be renamed
      if (isFixedPage(p)) return;
      p.name = val || "Untitled page";
      saveSchemaDebounced();
      renderPagesList();
      editorTitleEl.textContent = `Editor · ${p.name}`;
      pageNameDisplayEl.textContent = p.name;
    }));

    if (isFixedPage(p)) {
      inspectorEl.appendChild(pEl(`This is a fixed checkout page (${templateLabel(p.template)}). It will always exist and always stay at the end of the left nav. You can still edit its groups/questions.`, "inlineHelp"));
    }

    inspectorEl.appendChild(divider());

    // If a text block is selected, show a dedicated inspector
    if (selection.blockType === "text") {
      const tb = (p.flow || []).find((x) => x.type === "text" && x.id === selection.blockId);
      inspectorSubEl.textContent = "Editing text block";

      inspectorEl.appendChild(sectionTitle("Text block"));

      // Title + level
      inspectorEl.appendChild(fieldText("Title", tb?.title || "", (val) => {
        if (!tb) return;
        tb.title = val;
        saveSchemaDebounced();
        renderPagesList();
        renderCanvas();
      }));

      inspectorEl.appendChild(fieldSelect(
        "Heading size",
        tb?.level || "h3",
        [
          { value: "h1", label: "H1" },
          { value: "h2", label: "H2" },
          { value: "h3", label: "H3" },
          { value: "body", label: "Body" },
        ],
        (val) => {
          if (!tb) return;
          tb.level = val;
          saveSchema();
          renderCanvas();
          renderPagesList();
        }
      ));

      // Body content
      inspectorEl.appendChild(richTextEditor("Body", tb?.bodyHtml || "<p></p>", (html) => {
        if (!tb) return;
        tb.bodyHtml = sanitizeRichHtml(html);
        saveSchemaDebounced();
        renderCanvas();
      }));

      // Arrange + duplicate + delete
      inspectorEl.appendChild(divider());

      inspectorEl.appendChild(buttonRow([
        { label: "Move up", kind: "ghost", onClick: () => moveFlowItem(p.id, tb?.id, -1) },
        { label: "Move down", kind: "ghost", onClick: () => moveFlowItem(p.id, tb?.id, +1) },
        { label: "Duplicate", kind: "ghost", onClick: () => duplicateTextBlock(p.id, tb?.id) },
      ]));

      inspectorEl.appendChild(buttonRow([
        {
          label: "Delete text block",
          kind: "ghost",
          onClick: () => {
            if (!tb) return;
            if (!confirm("Delete this text block?")) return;
            deleteFlowItem(p.id, tb.id);
          },
        },
      ]));

      return;
    }

    if (!g) {
      inspectorSubEl.textContent = "Select or add a group";
      inspectorEl.appendChild(sectionTitle("Page"));
      inspectorEl.appendChild(fieldText("Page name", p.name, (val) => {
        p.name = val || "Untitled page";
        saveSchemaDebounced();
        renderPagesList();
        editorTitleEl.textContent = `Editor · ${p.name}`;
        pageNameDisplayEl.textContent = p.name;
      }));
      inspectorEl.appendChild(buttonRow([{ label: "+ Group", kind: "primary", onClick: () => addGroupToPage(p.id) }]));
      inspectorEl.appendChild(buttonRow([{ label: "+ Text block", kind: "ghost", onClick: () => addTextBlockToPage(p.id) }]));
      return;
    }

    // Global preview settings (small step #4)
    inspectorEl.appendChild(sectionTitle("Preview settings"));
    inspectorEl.appendChild(fieldSelect(
      "Preview mode",
      preview.mode || "question",
      [
        { value: "question", label: "Question-by-question (Typeform)" },
        { value: "page", label: "Page-at-a-time (layout)" },
      ],
      (val) => {
        preview.mode = val;
        // Persist mode inside schema meta for convenience
        schema.meta = schema.meta || {};
        schema.meta.previewMode = val;
        saveSchema();
      }
    ));

    inspectorEl.appendChild(divider());

    // Group editor (always visible)
    inspectorSubEl.textContent = q ? "Editing question" : "Editing group";

    inspectorEl.appendChild(sectionTitle("Group"));

    inspectorEl.appendChild(fieldText("Group name", g.name, (val) => {
      g.name = val || "Untitled group";
      saveSchemaDebounced();
      renderPagesList();
      groupNameDisplayEl.textContent = g.name;
    }));

    // Group description (small step #2)
    g.description = g.description || { enabled: false, html: "" };
    inspectorEl.appendChild(toggleRow("Add group description", g.description.enabled === true, (on) => {
      g.description.enabled = on;
      if (!g.description.html) g.description.html = "<p></p>";
      saveSchema();
      isTypingInspector = false;
      renderAll(true);
    }));

    if (g.description.enabled) {
      inspectorEl.appendChild(richTextEditor("Description", g.description.html || "", (html) => {
        g.description.html = sanitizeRichHtml(html);
        saveSchemaDebounced();
      }));
    }

    // Group conditional logic (small step #3)
    inspectorEl.appendChild(divider());
    inspectorEl.appendChild(sectionTitle("Group visibility"));
    inspectorEl.appendChild(pEl("Show this group only if the rule(s) match. (Hides all questions in the group in Preview)", "inlineHelp"));

    inspectorEl.appendChild(toggleRow("Enable group logic", g.logic?.enabled === true, (on) => {
      g.logic = g.logic || { enabled: false, rules: [] };
      g.logic.enabled = on;
      saveSchema();
      isTypingInspector = false;
      renderAll(true);
    }));

    if (g.logic?.enabled) {
      inspectorEl.appendChild(groupLogicEditor(schema, p, g));
    }

    // Move group + delete group
    inspectorEl.appendChild(buttonRow([
      { label: "Move group up", kind: "ghost", onClick: () => moveGroup(p.id, g.id, -1) },
      { label: "Move group down", kind: "ghost", onClick: () => moveGroup(p.id, g.id, +1) },
    ]));

    inspectorEl.appendChild(buttonRow([
      {
        label: "Delete group",
        kind: "ghost",
        onClick: () => {
          if (!confirm(`Delete group "${g.name}"?`)) return;
          p.groups = p.groups.filter((x) => x.id !== g.id);
          // also remove from flow
          p.flow = (p.flow || []).filter((x) => !(x.type === "group" && x.id === g.id));
          selection.blockType = "group";
          selection.blockId = p.flow[0]?.id || p.groups[0]?.id || null;
          selection.groupId = p.groups[0]?.id || null;
          selection.questionId = p.groups[0]?.questions?.[0]?.id || null;
          saveSchema();
          renderAll();
        },
      },
    ]));

    // (Removed) Question arrays section — follow-ups can now be repeatable inside questions.

    inspectorEl.appendChild(divider());

    // If no question selected
    if (!q) {
      inspectorEl.appendChild(sectionTitle("Questions"));
      inspectorEl.appendChild(pEl("Select a question in the canvas to edit its settings.", "inlineHelp"));
      return;
    }

    // Question inspector
    inspectorEl.appendChild(sectionTitle("Question"));

    inspectorEl.appendChild(fieldText("Question text", q.title, (val) => {
      q.title = val || "Untitled question";
      saveSchemaDebounced();
      renderCanvas();
      renderPagesList();
    }));

    inspectorEl.appendChild(fieldTextArea("Help text", q.help || "", (val) => {
      q.help = val;
      saveSchemaDebounced();
    }));

    // Explanatory content (rich text block shown above the answer control in Preview)
    q.content = q.content || { enabled: false, html: "" };
    inspectorEl.appendChild(toggleRow("Add explanatory content", q.content.enabled === true, (on) => {
      q.content.enabled = on;
      if (!q.content.html) q.content.html = "<p></p>";
      saveSchema();
      isTypingInspector = false;
      renderAll(true);
    }));

    if (q.content.enabled) {
      inspectorEl.appendChild(richTextEditor("Content", q.content.html || "", (html) => {
        q.content.html = sanitizeRichHtml(html);
        saveSchemaDebounced();
      }));
    }

    inspectorEl.appendChild(fieldSelect("Type", q.type, QUESTION_TYPES.map(t => ({ value: t.key, label: t.label })), (val) => {
      q.type = val;
      if (!isOptionType(q.type)) q.options = [];
      if (isOptionType(q.type) && (!q.options || !q.options.length)) {
        q.options = ["Option 1", "Option 2", "Option 3"];
      }
      saveSchema();
      renderAll();
    }));

    // Placeholder
    if (
      q.type === "text" ||
      q.type === "email" ||
      q.type === "number" ||
      q.type === "currency" ||
      q.type === "percent" ||
      q.type === "tel" ||
      q.type === "postcode"
    ) {
      inspectorEl.appendChild(fieldText("Placeholder", q.placeholder || "", (val) => {
        q.placeholder = val;
        saveSchema();
      }));
    }

    // Required toggle
    inspectorEl.appendChild(toggleRow("Required", q.required === true, (on) => {
      q.required = on;
      // Ensure default error text exists when toggling required on
      if (q.required && !q.errorText) q.errorText = "This field is required.";
      saveSchema();
      renderAll();
    }));

    // Custom error message (shown in Preview when validation fails)
    // Only show this control when Required is enabled (keeps UI clean)
    if (q.required === true) {
      inspectorEl.appendChild(fieldTextArea("Error message", q.errorText || "This field is required.", (val) => {
        q.errorText = val;
        saveSchemaDebounced();
      }));
    }

    // Options editor
    if (isOptionType(q.type)) {
      inspectorEl.appendChild(divider());
      inspectorEl.appendChild(sectionTitle("Options"));
      inspectorEl.appendChild(pEl("Add, rename, reorder, or delete options.", "inlineHelp"));
      inspectorEl.appendChild(optionsEditor(q));
    }

    // Follow-up questions (nested array) — only for Yes/No
    inspectorEl.appendChild(divider());

    if (q.type === "yesno") {
      inspectorEl.appendChild(sectionTitle("Follow-up questions"));
      inspectorEl.appendChild(
        pEl(
          "Show a nested set of questions when the answer matches (e.g. Yes → capture conviction details).",
          "inlineHelp"
        )
      );

      q.followUp = q.followUp || {
        enabled: false,
        triggerValue: "Yes",
        name: "",
        questions: [],
        repeat: { enabled: false, min: 1, max: 5, addLabel: "Add another", itemLabel: "Item" },
      };
      q.followUp.repeat = q.followUp.repeat && typeof q.followUp.repeat === "object" ? q.followUp.repeat : { enabled: false, min: 1, max: 5, addLabel: "Add another", itemLabel: "Item" };

      inspectorEl.appendChild(
        toggleRow("Enable follow-up questions", q.followUp.enabled === true, (on) => {
          q.followUp.enabled = on;
          saveSchema();
          isTypingInspector = false;
          renderAll(true);
        })
      );

      if (q.followUp.enabled) {
        inspectorEl.appendChild(
          fieldSelect(
            "Trigger answer",
            q.followUp.triggerValue || "Yes",
            [
              { value: "Yes", label: "Yes" },
              { value: "No", label: "No" },
            ],
            (val) => {
              q.followUp.triggerValue = val;
              saveSchema();
              renderAll(true);
            }
          )
        );

        inspectorEl.appendChild(
          fieldText("Array name", q.followUp.name || "", (val) => {
            q.followUp.name = val;
            saveSchemaDebounced();
          })
        );

        // Repeatable instances
        inspectorEl.appendChild(divider());
        inspectorEl.appendChild(sectionTitle("Repeatable set"));
        inspectorEl.appendChild(
          pEl(
            "Allow users to add multiple instances of these follow-up questions (e.g. multiple convictions).",
            "inlineHelp"
          )
        );

        inspectorEl.appendChild(
          toggleRow("Allow multiple (Add another)", q.followUp.repeat.enabled === true, (on) => {
            q.followUp.repeat.enabled = on;
            if (!Number.isFinite(Number(q.followUp.repeat.min))) q.followUp.repeat.min = 1;
            if (!Number.isFinite(Number(q.followUp.repeat.max))) q.followUp.repeat.max = 5;
            saveSchema();
            isTypingInspector = false;
            renderAll(true);
          })
        );

        if (q.followUp.repeat.enabled) {
          inspectorEl.appendChild(fieldText("Item label", q.followUp.repeat.itemLabel || "Item", (val) => {
            q.followUp.repeat.itemLabel = val || "Item";
            saveSchemaDebounced();
          }));

          inspectorEl.appendChild(fieldText("Add button label", q.followUp.repeat.addLabel || "Add another", (val) => {
            q.followUp.repeat.addLabel = val || "Add another";
            saveSchemaDebounced();
          }));

          // min/max as text inputs (keeps component set small)
          inspectorEl.appendChild(fieldText("Minimum items", String(q.followUp.repeat.min ?? 1), (val) => {
            const n = Number(val);
            q.followUp.repeat.min = Number.isFinite(n) ? clamp(n, 0, 50) : 1;
            q.followUp.repeat.max = clamp(Number(q.followUp.repeat.max ?? 5), q.followUp.repeat.min, 50);
            saveSchema();
            renderAll(true);
          }));

          inspectorEl.appendChild(fieldText("Maximum items", String(q.followUp.repeat.max ?? 5), (val) => {
            const n = Number(val);
            q.followUp.repeat.max = Number.isFinite(n) ? clamp(n, q.followUp.repeat.min ?? 1, 50) : 5;
            saveSchema();
            renderAll(true);
          }));
        }

        inspectorEl.appendChild(divider());
        inspectorEl.appendChild(followUpQuestionsEditor(q));

        inspectorEl.appendChild(
          buttonRow([
            {
              label: "Delete follow-up array",
              kind: "ghost",
              onClick: () => {
                if (!confirm("Delete these follow-up questions?")) return;
                q.followUp.enabled = false;
                q.followUp.name = "";
                q.followUp.questions = [];
                saveSchema();
                renderAll(true);
              },
            },
          ])
        );
      }
    }

    // Conditional logic
    inspectorEl.appendChild(divider());
    inspectorEl.appendChild(sectionTitle("Conditional logic"));
    inspectorEl.appendChild(pEl("Show this question only if the rule(s) match.", "inlineHelp"));

    inspectorEl.appendChild(toggleRow("Enable logic", q.logic?.enabled === true, (on) => {
      q.logic = q.logic || { enabled: false, rules: [] };
      q.logic.enabled = on;
      saveSchema();
      // this changes inspector structure, so force a rebuild
      isTypingInspector = false;
      renderAll(true);
    }));

    if (q.logic?.enabled) {
      inspectorEl.appendChild(logicEditor(p, q));
    }
  }

  function renderMiniStats() {
    const pages = schema.pages.length;
    const groups = schema.pages.reduce((a, p) => a + p.groups.length, 0);
    const questions = schema.pages.reduce(
      (a, p) => a + p.groups.reduce((b, g) => b + g.questions.length, 0),
      0
    );

    miniStatsEl.innerHTML = `
      <div class="statRow"><span class="muted">Pages</span><span class="statVal">${pages}</span></div>
      <div class="statRow"><span class="muted">Groups</span><span class="statVal">${groups}</span></div>
      <div class="statRow"><span class="muted">Questions</span><span class="statVal">${questions}</span></div>
      <div class="statRow"><span class="muted">Autosaved</span><span class="statVal">Yes</span></div>
    `;
  }

  // -------------------------
  // Components (Inspector)
  // -------------------------
  function sectionTitle(text) {
    const d = document.createElement("div");
    d.className = "sectionTitle";
    d.textContent = text;
    return d;
  }

  function pEl(text, className) {
    const p = document.createElement("p");
    p.className = className || "";
    p.textContent = text;
    p.style.margin = "0";
    return p;
  }

  function divider() {
    const d = document.createElement("div");
    d.className = "hr";
    return d;
  }

  function fieldText(label, value, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const lab = document.createElement("div");
    lab.className = "label";
    lab.textContent = label;

    const input = document.createElement("input");
    input.className = "input";
    input.type = "text";
    input.value = value || "";

    input.addEventListener("focus", () => {
      isTypingInspector = true;
    });

    input.addEventListener("input", () => {
      onChange(input.value);
    });

    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  function fieldTextArea(label, value, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const lab = document.createElement("div");
    lab.className = "label";
    lab.textContent = label;

    const ta = document.createElement("textarea");
    ta.className = "textarea";
    ta.value = value || "";

    ta.addEventListener("focus", () => {
      isTypingInspector = true;
    });

    ta.addEventListener("input", () => {
      onChange(ta.value);
    });

    wrap.appendChild(lab);
    wrap.appendChild(ta);
    return wrap;
  }

  // Simple rich text editor (B/I/U + bullet list) using contentEditable.
  // NOTE: This is intentionally minimal and sanitised before saving.
  function richTextEditor(label, html, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const lab = document.createElement("div");
    lab.className = "label";
    lab.textContent = label;

    const toolbar = document.createElement("div");
    toolbar.style.display = "flex";
    toolbar.style.gap = "8px";
    toolbar.style.flexWrap = "wrap";
    toolbar.style.marginBottom = "8px";

    const mkBtn = (txt, title, cmd) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn ghost";
      b.textContent = txt;
      b.title = title;
      b.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in editor
      b.addEventListener("click", () => {
        try {
          document.execCommand(cmd, false, null);
        } catch {
          // no-op
        }
        editor.focus();
        // emit
        onChange(editor.innerHTML);
      });
      return b;
    };

    toolbar.appendChild(mkBtn("B", "Bold", "bold"));
    toolbar.appendChild(mkBtn("I", "Italic", "italic"));
    toolbar.appendChild(mkBtn("U", "Underline", "underline"));
    toolbar.appendChild(mkBtn("•", "Bulleted list", "insertUnorderedList"));

    const mkBlockBtn = (txt, title, tag) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn ghost";
      b.textContent = txt;
      b.title = title;
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        try {
          document.execCommand("formatBlock", false, tag);
        } catch {
          // no-op
        }
        editor.focus();
        onChange(editor.innerHTML);
      });
      return b;
    };

    // Phase 1: heading controls (useful for text blocks)
    toolbar.appendChild(mkBlockBtn("H1", "Heading 1", "h1"));
    toolbar.appendChild(mkBlockBtn("H2", "Heading 2", "h2"));
    toolbar.appendChild(mkBlockBtn("H3", "Heading 3", "h3"));
    toolbar.appendChild(mkBlockBtn("P", "Paragraph", "p"));

    const editor = document.createElement("div");
    editor.className = "textarea"; // reuse existing textarea styling
    editor.contentEditable = "true";
    editor.spellcheck = true;
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.style.minHeight = "120px";
    editor.style.whiteSpace = "normal";
    editor.style.overflow = "auto";
    editor.innerHTML = sanitizeRichHtml(html || "");

    editor.addEventListener("focus", () => {
      isTypingInspector = true;
    });

    editor.addEventListener("input", () => {
      onChange(editor.innerHTML);
    });

    editor.addEventListener("blur", () => {
      // normalise + prevent junk markup
      const clean = sanitizeRichHtml(editor.innerHTML);
      editor.innerHTML = clean;
      onChange(clean);
      // allow inspector to rebuild after leaving editor
      isTypingInspector = false;
    });

    wrap.appendChild(lab);
    wrap.appendChild(toolbar);
    wrap.appendChild(editor);
    return wrap;
  }

  function fieldSelect(label, value, options, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const lab = document.createElement("div");
    lab.className = "label";
    lab.textContent = label;

    const sel = document.createElement("select");
    sel.className = "select";
    options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === value) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => onChange(sel.value));

    wrap.appendChild(lab);
    wrap.appendChild(sel);
    return wrap;
  }

  function toggleRow(label, on, onToggle) {
    const row = document.createElement("div");
    row.className = "toggleRow";

    const left = document.createElement("div");
    left.innerHTML = `<div style="font-weight:740">${escapeHtml(label)}</div>`;

    const t = document.createElement("div");
    t.className = "toggle" + (on ? " on" : "");
    t.setAttribute("role", "switch");
    t.setAttribute("aria-checked", on ? "true" : "false");
    t.tabIndex = 0;

    const toggle = () => {
      on = !on;
      t.classList.toggle("on", on);
      t.setAttribute("aria-checked", on ? "true" : "false");

      // If user toggles logic while a text input is focused, we must allow inspector to rebuild
      // so the logic editor appears immediately.
      isTypingInspector = false;

      onToggle(on);
    };

    t.addEventListener("click", toggle);
    t.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    row.appendChild(left);
    row.appendChild(t);
    return row;
  }

  function buttonRow(btns) {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.gap = "10px";
    wrap.style.flexWrap = "wrap";

    btns.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn " + (b.kind === "primary" ? "primary" : "ghost");
      btn.textContent = b.label;
      btn.addEventListener("click", b.onClick);
      wrap.appendChild(btn);
    });

    return wrap;
  }

  function optionsEditor(q) {
    const wrap = document.createElement("div");
    wrap.className = "optList";

    q.options = Array.isArray(q.options) ? q.options : [];

    const render = () => {
      wrap.innerHTML = "";

      q.options.forEach((opt, idx) => {
        const row = document.createElement("div");
        row.className = "optItem";

        const input = document.createElement("input");
        input.className = "input";
        input.type = "text";
        input.value = opt;
        input.addEventListener("input", () => {
          q.options[idx] = input.value;
          saveSchema();
          renderCanvas(); // keep snappy without full rerender
        });

        const up = iconButton("↑", "Up");
        up.disabled = idx === 0;
        up.addEventListener("click", () => {
          moveItem(q.options, idx, idx - 1);
          saveSchema();
          render();
        });

        const down = iconButton("↓", "Down");
        down.disabled = idx === q.options.length - 1;
        down.addEventListener("click", () => {
          moveItem(q.options, idx, idx + 1);
          saveSchema();
          render();
        });

        const del = iconButton("✕", "Delete option");
        del.addEventListener("click", () => {
          q.options.splice(idx, 1);
          saveSchema();
          render();
        });

        row.appendChild(input);
        row.appendChild(up);
        row.appendChild(down);
        row.appendChild(del);

        wrap.appendChild(row);
      });

      const addWrap = document.createElement("div");
      addWrap.style.display = "flex";
      addWrap.style.gap = "10px";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn";
      addBtn.textContent = "+ Add option";
      addBtn.addEventListener("click", () => {
        q.options.push(`Option ${q.options.length + 1}`);
        saveSchema();
        render();
      });

      const seedBtn = document.createElement("button");
      seedBtn.type = "button";
      seedBtn.className = "btn ghost";
      seedBtn.textContent = "Seed 3 options";
      seedBtn.addEventListener("click", () => {
        q.options = ["Option 1", "Option 2", "Option 3"];
        saveSchema();
        render();
      });

      addWrap.appendChild(addBtn);
      addWrap.appendChild(seedBtn);
      wrap.appendChild(addWrap);
    };

    render();
    return wrap;
  }

  // -------------------------
  // Follow-up questions (nested array inside a question)
  // - Supports optional repeatable instances ("Add another")
  // -------------------------

  function followUpIsEnabled(q) {
    return !!(
      q &&
      q.followUp &&
      q.followUp.enabled === true &&
      Array.isArray(q.followUp.questions) &&
      q.followUp.questions.length
    );
  }

  // ----- Repeatable instances storage (preview-only)
  // We store instance ids inside preview.answers under a reserved key.
  const FU_INSTANCES_KEY = "__fu_instances__";

  function getFuInstanceMap(answers) {
    if (!answers || typeof answers !== "object") return {};
    answers[FU_INSTANCES_KEY] =
      answers[FU_INSTANCES_KEY] && typeof answers[FU_INSTANCES_KEY] === "object"
        ? answers[FU_INSTANCES_KEY]
        : {};
    return answers[FU_INSTANCES_KEY];
  }

  function getFollowUpInstanceIds(parentQ, answers) {
    const map = getFuInstanceMap(answers);
    const arr = Array.isArray(map[parentQ.id]) ? map[parentQ.id] : [];
    return arr;
  }

  function setFollowUpInstanceIds(parentQ, answers, ids) {
    const map = getFuInstanceMap(answers);
    map[parentQ.id] = Array.isArray(ids) ? ids : [];
  }

  function followUpIsRepeatable(parentQ) {
    return !!(parentQ?.followUp?.repeat?.enabled === true);
  }

  function ensureMinFollowUpInstances(parentQ, answers) {
    if (!followUpIsEnabled(parentQ)) return;
    if (!followUpMatches(parentQ, answers)) return;

    if (!followUpIsRepeatable(parentQ)) {
      // Non-repeatable = no instances list
      setFollowUpInstanceIds(parentQ, answers, []);
      return;
    }

    const min = clamp(Number(parentQ.followUp?.repeat?.min ?? 1), 0, 50);
    const max = clamp(Number(parentQ.followUp?.repeat?.max ?? 5), min, 50);

    let ids = getFollowUpInstanceIds(parentQ, answers);
    ids = ids.filter(Boolean);

    while (ids.length < min) {
      ids.push(uid("fuinst"));
    }

    if (ids.length > max) ids = ids.slice(0, max);

    setFollowUpInstanceIds(parentQ, answers, ids);
  }

  function makeFollowUpAnswerId(parentQId, baseFollowUpQuestionId, instanceId) {
    return `fu_${parentQId}__${baseFollowUpQuestionId}__${instanceId}`;
  }

  function clearFollowUpAnswersForQuestion(parentQ, answers) {
    if (!answers || typeof answers !== "object") return;

    // Clear any repeat instance answers
    const ids = getFollowUpInstanceIds(parentQ, answers);
    (parentQ.followUp?.questions || []).forEach((fq) => {
      ids.forEach((instId) => {
        const aid = makeFollowUpAnswerId(parentQ.id, fq.id, instId);
        if (aid in answers) delete answers[aid];
      });
    });

    // Clear any non-repeatable answers (legacy behaviour uses fq.id)
    (parentQ.followUp?.questions || []).forEach((fq) => {
      if (fq?.id && fq.id in answers) delete answers[fq.id];
    });

    // Clear instance list
    const map = getFuInstanceMap(answers);
    delete map[parentQ.id];
  }

  function addFollowUpInstance(parentQ, answers) {
    ensureMinFollowUpInstances(parentQ, answers);
    const min = clamp(Number(parentQ.followUp?.repeat?.min ?? 1), 0, 50);
    const max = clamp(Number(parentQ.followUp?.repeat?.max ?? 5), min, 50);

    const ids = getFollowUpInstanceIds(parentQ, answers).slice();
    if (ids.length >= max) return false;
    ids.push(uid("fuinst"));
    setFollowUpInstanceIds(parentQ, answers, ids);
    return true;
  }

  function removeFollowUpInstance(parentQ, answers, instanceId) {
    ensureMinFollowUpInstances(parentQ, answers);
    const min = clamp(Number(parentQ.followUp?.repeat?.min ?? 1), 0, 50);

    let ids = getFollowUpInstanceIds(parentQ, answers).slice();
    if (ids.length <= min) return false;

    ids = ids.filter((x) => x !== instanceId);
    setFollowUpInstanceIds(parentQ, answers, ids);

    // delete answers for removed instance
    (parentQ.followUp?.questions || []).forEach((fq) => {
      const aid = makeFollowUpAnswerId(parentQ.id, fq.id, instanceId);
      if (aid in answers) delete answers[aid];
    });

    return true;
  }

  function followUpMatches(q, answers) {
    if (!followUpIsEnabled(q)) return false;
    const trig = String(q.followUp.triggerValue || "Yes");
    return String(answers?.[q.id] || "") === trig;
  }

  function getActiveFollowUps(q, answers) {
    return followUpMatches(q, answers) ? (q.followUp.questions || []) : [];
  }

  function getActiveFollowUpSteps(parentQ, answers) {
    // Returns an array of step objects with stable unique ids for answers.
    const fqs = getActiveFollowUps(parentQ, answers);
    if (!fqs.length) return [];

    if (followUpIsRepeatable(parentQ)) {
      ensureMinFollowUpInstances(parentQ, answers);
      const instIds = getFollowUpInstanceIds(parentQ, answers);
      const steps = [];

      instIds.forEach((instId, instIndex) => {
        fqs.forEach((fq) => {
          steps.push({
            ...fq,
            id: makeFollowUpAnswerId(parentQ.id, fq.id, instId),
            baseId: fq.id,
            instanceId: instId,
            instanceIndex: instIndex,
            parentQuestionId: parentQ.id,
            isFollowUp: true,
            isRepeatInstance: true,
            followUpName: parentQ.followUp?.name || "",
            followUpItemLabel: parentQ.followUp?.repeat?.itemLabel || "Item",
          });
        });
      });

      return steps;
    }

    // Non-repeatable follow-ups (answers keyed by fq.id)
    return fqs.map((fq) => ({
      ...fq,
      parentQuestionId: parentQ.id,
      isFollowUp: true,
      isRepeatInstance: false,
      followUpName: parentQ.followUp?.name || "",
    }));
  }

  function followUpQuestionsEditor(parentQ) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "10px";

    const ensure = () => {
      parentQ.followUp = parentQ.followUp || {
        enabled: false,
        triggerValue: "Yes",
        name: "",
        questions: [],
        repeat: { enabled: false, min: 1, max: 5, addLabel: "Add another", itemLabel: "Item" },
      };
      parentQ.followUp.questions = Array.isArray(parentQ.followUp.questions)
        ? parentQ.followUp.questions
        : [];
    };

    const render = () => {
      ensure();
      list.innerHTML = "";

      (parentQ.followUp.questions || []).forEach((fq, idx) => {
        const card = document.createElement("div");
        card.className = "toggleRow";
        card.style.flexDirection = "column";
        card.style.alignItems = "stretch";

        // Title
        card.appendChild(
          fieldText("Question text", fq.title || "", (val) => {
            fq.title = val || "Untitled follow-up";
            saveSchemaDebounced();
            renderCanvas();
          })
        );

        // Help
        card.appendChild(
          fieldTextArea("Help text", fq.help || "", (val) => {
            fq.help = val;
            saveSchemaDebounced();
          })
        );

        // Type
        card.appendChild(
          fieldSelect(
            "Type",
            fq.type || "text",
            QUESTION_TYPES.map((t) => ({ value: t.key, label: t.label })),
            (val) => {
              fq.type = val;
              if (!isOptionType(fq.type)) fq.options = [];
              if (isOptionType(fq.type) && (!fq.options || !fq.options.length)) {
                fq.options = ["Option 1", "Option 2", "Option 3"];
              }
              saveSchema();
              renderAll(true);
            }
          )
        );

        // Placeholder
        if (["text", "email", "number", "currency", "percent", "tel", "postcode", "date"].includes(fq.type)) {
          card.appendChild(
            fieldText("Placeholder", fq.placeholder || "", (val) => {
              fq.placeholder = val;
              saveSchemaDebounced();
            })
          );
        }

        // Required
        card.appendChild(
          toggleRow("Required", fq.required === true, (on) => {
            fq.required = on;
            if (fq.required && !fq.errorText) fq.errorText = "This field is required.";
            saveSchema();
            renderAll(true);
          })
        );

        if (fq.required) {
          card.appendChild(
            fieldTextArea("Error message", fq.errorText || "This field is required.", (val) => {
              fq.errorText = val;
              saveSchemaDebounced();
            })
          );
        }

        // Options if needed
        if (isOptionType(fq.type)) {
          card.appendChild(divider());
          card.appendChild(sectionTitle("Options"));
          card.appendChild(optionsEditor(fq));
        }

        // Actions
        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "10px";
        actions.style.justifyContent = "flex-end";
        actions.style.marginTop = "10px";

        const up = document.createElement("button");
        up.type = "button";
        up.className = "btn ghost";
        up.textContent = "Move up";
        up.disabled = idx === 0;
        up.addEventListener("click", () => {
          moveItem(parentQ.followUp.questions, idx, idx - 1);
          saveSchema();
          renderAll(true);
        });

        const down = document.createElement("button");
        down.type = "button";
        down.className = "btn ghost";
        down.textContent = "Move down";
        down.disabled = idx === parentQ.followUp.questions.length - 1;
        down.addEventListener("click", () => {
          moveItem(parentQ.followUp.questions, idx, idx + 1);
          saveSchema();
          renderAll(true);
        });

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn ghost";
        del.textContent = "Delete";
        del.addEventListener("click", () => {
          parentQ.followUp.questions.splice(idx, 1);
          saveSchema();
          renderAll(true);
        });

        actions.appendChild(up);
        actions.appendChild(down);
        actions.appendChild(del);
        card.appendChild(actions);

        list.appendChild(card);
      });

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn";
      addBtn.textContent = "+ Add follow-up question";
      addBtn.addEventListener("click", () => {
        ensure();
        parentQ.followUp.questions.push({
          id: uid("fq"),
          type: "text",
          title: "New follow-up question",
          help: "",
          placeholder: "",
          required: false,
          errorText: "This field is required.",
          options: [],
          logic: { enabled: false, rules: [] },
          content: { enabled: false, html: "" },
        });
        saveSchema();
        renderAll(true);
      });

      list.appendChild(addBtn);
    };

    render();
    wrap.appendChild(list);
    return wrap;
  }

  function logicEditor(page, q) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    q.logic = q.logic || { enabled: true, rules: [] };
    q.logic.rules = Array.isArray(q.logic.rules) ? q.logic.rules : [];

    const availableQuestions = getAllQuestionsInOrder(schema);

    // only allow referencing questions that appear before this question in order
    const thisIndex = availableQuestions.findIndex((x) => x.id === q.id);
    const earlier = thisIndex > 0 ? availableQuestions.slice(0, thisIndex) : [];

    const hint = document.createElement("div");
    hint.className = "inlineHelp";
    hint.textContent = earlier.length
      ? "Rules can reference questions that appear before this one in the flow."
      : "Add more questions before this one to use conditional logic.";

    wrap.appendChild(hint);

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "10px";
    list.style.marginTop = "10px";

    function renderRules() {
      list.innerHTML = "";

      q.logic.rules.forEach((r, idx) => {
        const row = document.createElement("div");
        row.className = "toggleRow";
        row.style.flexDirection = "column";
        row.style.alignItems = "stretch";

        const top = document.createElement("div");
        top.style.display = "grid";
        top.style.gridTemplateColumns = "1fr 1fr";
        top.style.gap = "10px";

        const qSel = makeSelect(
          earlier.map((x) => ({
            value: x.id,
            label: `${x.title || "Untitled"} (${x.type})`,
          })),
          r.questionId || ""
        );
        qSel.addEventListener("change", () => {
          r.questionId = qSel.value;
          saveSchema();
          renderRules();
        });

        const opSel = makeSelect(
          OPERATORS.map((o) => ({ value: o.key, label: o.label })),
          r.operator || "equals"
        );
        opSel.addEventListener("change", () => {
          r.operator = opSel.value;
          saveSchema();
          renderRules();
        });

        top.appendChild(wrapField("If question", qSel));
        top.appendChild(wrapField("Operator", opSel));

        row.appendChild(top);

        const targetQ = earlier.find((x) => x.id === r.questionId);
        const needsValue = !["is_answered", "is_not_answered"].includes(r.operator);

        if (needsValue) {
          const valueWrap = document.createElement("div");
          valueWrap.style.marginTop = "10px";

          // If referenced question is options-based, offer dropdown
          if (targetQ && isOptionType(targetQ.type)) {
            const vSel = makeSelect(
              (targetQ.options || []).map((o) => ({ value: o, label: o })),
              r.value || ""
            );
            vSel.addEventListener("change", () => {
              r.value = vSel.value;
              saveSchema();
            });
            valueWrap.appendChild(wrapField("Value", vSel));
          } else {
            const input = document.createElement("input");
            input.className = "input";
            input.type = "text";
            input.value = r.value || "";
            input.placeholder = "Value to compare against";
            input.addEventListener("input", () => {
              r.value = input.value;
              saveSchema();
            });
            valueWrap.appendChild(wrapField("Value", input));
          }

          row.appendChild(valueWrap);
        }

        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "10px";
        actions.style.marginTop = "10px";
        actions.style.justifyContent = "flex-end";

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn ghost";
        del.textContent = "Delete rule";
        del.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          q.logic.rules.splice(idx, 1);
          saveSchema();
          // force inspector refresh (otherwise typing-guard can keep stale UI)
          isTypingInspector = false;
          renderAll(true);
        });

        actions.appendChild(del);
        row.appendChild(actions);

        list.appendChild(row);
      });

      const add = document.createElement("button");
      add.type = "button";
      add.className = "btn";
      add.textContent = "+ Add rule";
      add.disabled = earlier.length === 0;
      if (add.disabled) {
        add.title = "Add at least one question before this one to create conditional rules.";
      }
      add.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        q.logic.rules.push({
          id: uid("rule"),
          questionId: earlier[0]?.id || "",
          operator: "equals",
          value: "",
        });
        saveSchema();
        isTypingInspector = false;
        renderAll(true);
      });

      list.appendChild(add);
    }

    renderRules();
    wrap.appendChild(list);
    return wrap;
  }

  // Group logic editor (small step #3)
  function groupLogicEditor(s, page, group) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    group.logic = group.logic || { enabled: true, rules: [] };
    group.logic.rules = Array.isArray(group.logic.rules) ? group.logic.rules : [];

    const availableQuestions = getAllQuestionsInOrder(s);

    // Determine the earliest question index in this group; if group has no questions, allow referencing any earlier question
    const indices = availableQuestions
      .map((q, idx) => ({ q, idx }))
      .filter((x) => x.q.groupId === group.id)
      .map((x) => x.idx);

    const groupStart = indices.length ? Math.min(...indices) : availableQuestions.length;
    const earlier = groupStart > 0 ? availableQuestions.slice(0, groupStart) : [];

    const hint = document.createElement("div");
    hint.className = "inlineHelp";
    hint.textContent = earlier.length
      ? "Rules can reference questions that appear before this group in the flow."
      : "Add questions before this group to use group visibility logic.";
    wrap.appendChild(hint);

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "10px";
    list.style.marginTop = "10px";

    const byId = Object.fromEntries(availableQuestions.map((q) => [q.id, q]));

    function renderRules() {
      list.innerHTML = "";

      group.logic.rules.forEach((r, idx) => {
        const row = document.createElement("div");
        row.className = "toggleRow";
        row.style.flexDirection = "column";
        row.style.alignItems = "stretch";

        const top = document.createElement("div");
        top.style.display = "grid";
        top.style.gridTemplateColumns = "1fr 1fr";
        top.style.gap = "10px";

        const qSel = makeSelect(
          earlier.map((x) => ({
            value: x.id,
            label: `${x.title || "Untitled"} (${x.type})`,
          })),
          r.questionId || ""
        );
        qSel.addEventListener("change", () => {
          r.questionId = qSel.value;
          saveSchema();
          renderRules();
        });

        const opSel = makeSelect(
          OPERATORS.map((o) => ({ value: o.key, label: o.label })),
          r.operator || "equals"
        );
        opSel.addEventListener("change", () => {
          r.operator = opSel.value;
          saveSchema();
          renderRules();
        });

        top.appendChild(wrapField("If question", qSel));
        top.appendChild(wrapField("Operator", opSel));
        row.appendChild(top);

        const refQ = byId[r.questionId];
        const needsValue = !["is_answered", "is_not_answered"].includes(r.operator);

        if (needsValue) {
          const valueWrap = document.createElement("div");
          valueWrap.style.marginTop = "10px";

          if (refQ && isOptionType(refQ.type)) {
            const vSel = makeSelect(
              (refQ.options || []).map((o) => ({ value: o, label: o })),
              r.value || ""
            );
            vSel.addEventListener("change", () => {
              r.value = vSel.value;
              saveSchema();
            });
            valueWrap.appendChild(wrapField("Value", vSel));
          } else {
            const input = document.createElement("input");
            input.className = "input";
            input.type = "text";
            input.value = r.value || "";
            input.placeholder = "Value to compare against";
            input.addEventListener("input", () => {
              r.value = input.value;
              saveSchema();
            });
            valueWrap.appendChild(wrapField("Value", input));
          }

          row.appendChild(valueWrap);
        }

        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "10px";
        actions.style.marginTop = "10px";
        actions.style.justifyContent = "flex-end";

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn ghost";
        del.textContent = "Delete rule";
        del.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          group.logic.rules.splice(idx, 1);
          saveSchema();
          isTypingInspector = false;
          renderAll(true);
        });

        actions.appendChild(del);
        row.appendChild(actions);

        list.appendChild(row);
      });

      const add = document.createElement("button");
      add.type = "button";
      add.className = "btn";
      add.textContent = "+ Add rule";
      add.disabled = earlier.length === 0;
      if (add.disabled) add.title = "Add questions before this group to enable rules.";
      add.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        group.logic.rules.push({
          id: uid("rule"),
          questionId: earlier[0]?.id || "",
          operator: "equals",
          value: "",
        });
        saveSchema();
        isTypingInspector = false;
        renderAll(true);
      });

      list.appendChild(add);
    }

    renderRules();
    wrap.appendChild(list);
    return wrap;
  }

  function wrapField(labelText, el) {
    const w = document.createElement("div");
    w.className = "field";
    const lab = document.createElement("div");
    lab.className = "label";
    lab.textContent = labelText;
    w.appendChild(lab);
    w.appendChild(el);
    return w;
  }

  function makeSelect(options, value) {
    const sel = document.createElement("select");
    sel.className = "select";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "— Select —";
    sel.appendChild(blank);

    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      if (o.value === value) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  function iconButton(text, title) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "iconBtn";
    b.title = title || "";
    b.textContent = text;
    // disable styling
    Object.defineProperty(b, "disabled", {
      set(v) {
        if (v) {
          b.style.opacity = "0.35";
          b.style.pointerEvents = "none";
        } else {
          b.style.opacity = "1";
          b.style.pointerEvents = "auto";
        }
      },
    });
    return b;
  }

  function moveItem(arr, from, to) {
    if (to < 0 || to >= arr.length) return;
    const [it] = arr.splice(from, 1);
    arr.splice(to, 0, it);
  }

  function moveGroup(pageId, groupId, dir) {
    const p = getPage(pageId);
    if (!p) return;
    const idx = p.groups.findIndex((g) => g.id === groupId);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= p.groups.length) return;
    moveItem(p.groups, idx, to);
    saveSchema();
    renderAll();
  }

  /* =============================================================================
CH 5  Actions (add/rename/delete/duplicate/move)
============================================================================= */

  // -------------------------
  // Actions
  // -------------------------

  function addTextBlockToPage(pageId) {
    const p = getPage(pageId);
    if (!p) return;

    p.flow = Array.isArray(p.flow) ? p.flow : p.groups.map((g) => ({ type: "group", id: g.id }));

    const tid = uid("txt");
    const item = {
      type: "text",
      id: tid,
      title: "",
      level: "h3",
      bodyHtml: "<p></p>",
    };

    // Insert after the currently selected flow item (in this page), otherwise append
    let insertAt = p.flow.length;
    if (selection.pageId === p.id && selection.blockId) {
      const idx = p.flow.findIndex((x) => x.id === selection.blockId);
      if (idx >= 0) insertAt = idx + 1;
    }

    p.flow.splice(insertAt, 0, item);

    selection.pageId = p.id;
    selection.blockType = "text";
    selection.blockId = tid;
    selection.groupId = null;
    selection.questionId = null;

    saveSchema();
    renderAll(true);
  }

  function moveFlowItem(pageId, itemId, dir) {
    const p = getPage(pageId);
    if (!p) return;
    p.flow = Array.isArray(p.flow) ? p.flow : [];
    const idx = p.flow.findIndex((x) => x.id === itemId);
    if (idx < 0) return;
    const to = idx + dir;
    if (to < 0 || to >= p.flow.length) return;
    moveItem(p.flow, idx, to);
    saveSchema();
    renderAll();
  }

  function deleteFlowItem(pageId, itemId) {
    const p = getPage(pageId);
    if (!p) return;
    p.flow = (p.flow || []).filter((x) => x.id !== itemId);

    // Reset selection to nearest sensible thing
    const first = p.flow[0];
    if (first?.type === "text") {
      selection.blockType = "text";
      selection.blockId = first.id;
      selection.groupId = null;
      selection.questionId = null;
    } else {
      const g0 = p.groups.find((gg) => gg.id === first?.id) || p.groups[0];
      selection.blockType = "group";
      selection.blockId = g0?.id || null;
      selection.groupId = g0?.id || null;
      selection.questionId = g0?.questions?.[0]?.id || null;
    }

    saveSchema();
    renderAll(true);
  }

  function duplicateTextBlock(pageId, textId) {
    const p = getPage(pageId);
    if (!p || !textId) return;
    p.flow = Array.isArray(p.flow) ? p.flow : [];

    const idx = p.flow.findIndex((x) => x.type === "text" && x.id === textId);
    if (idx < 0) return;

    const src = p.flow[idx];
    const copy = deepClone(src);
    copy.id = uid("txt");
    // Keep title/body, but nudge title if empty
    if (!copy.title) copy.title = "";

    p.flow.splice(idx + 1, 0, copy);

    selection.pageId = p.id;
    selection.blockType = "text";
    selection.blockId = copy.id;
    selection.groupId = null;
    selection.questionId = null;

    saveSchema();
    renderAll(true);
  }
  function addPage() {
    const pid = uid("page");
    const gid = uid("group");
    const qid = uid("q");

    const newPage = {
      id: pid,
      name: `Page ${schema.pages.filter((p) => !isFixedPage(p)).length + 1}`,
      template: "form",
      flow: [{ type: "group", id: gid }],
      groups: [
        {
          id: gid,
          name: "Group 1",
          description: { enabled: false, html: "" },
          logic: { enabled: false, rules: [] },
          questions: [
            {
              id: qid,
              type: "text",
              title: "New question",
              help: "",
              placeholder: "",
              required: false,
              errorText: "This field is required.",
              options: [],
              logic: { enabled: false, rules: [] },
              content: { enabled: false, html: "" },
            },
          ],
        },
      ],
    };

    // Insert BEFORE the fixed checkout pages
    const firstFixedIdx = schema.pages.findIndex((p) => isFixedPage(p));
    if (firstFixedIdx >= 0) schema.pages.splice(firstFixedIdx, 0, newPage);
    else schema.pages.push(newPage);

    ensureFixedCheckoutPages();

    selection.pageId = pid;
    selection.blockType = "group";
    selection.blockId = gid;
    selection.groupId = gid;
    selection.questionId = qid;
    saveSchema();
    renderAll();
  }

  // Ensure Quote / Summary / Payment pages always exist and stay last
  function ensureFixedCheckoutPages() {
    if (!Array.isArray(schema.pages)) schema.pages = [];

    // 1) Create missing fixed pages
    FIXED_CHECKOUT_PAGES.forEach((fp) => {
      let p = schema.pages.find((x) => x.id === fp.id);
      if (!p) {
        p = {
          id: fp.id,
          name: fp.name,
          template: fp.template,
          isFixed: true,
          flow: [],
          groups: [],
        };
        // Append for now; we reorder at the end anyway
        schema.pages.push(p);
      }

      // Always enforce identity
      p.isFixed = true;
      p.template = fp.template;
      p.name = fp.name;

      // If empty, seed with a preset
      const hasStructure = (p.groups && p.groups.length) || (p.flow && p.flow.length);
      if (!hasStructure) {
        const preset = buildTemplatePreset(fp.template);
        if (preset) {
          p.groups = preset.groups;
          p.flow = preset.flow;
        }
      }

      // Ensure flow exists if groups exist
      p.groups = Array.isArray(p.groups) ? p.groups : [];
      p.flow = Array.isArray(p.flow) ? p.flow : [];
      if (p.flow.length === 0 && p.groups.length) {
        p.flow = p.groups.map((g) => ({ type: "group", id: g.id }));
      }
    });

    // 2) Keep fixed pages at the end and keep their order Quote->Summary->Payment
    const fixedIds = new Set(FIXED_CHECKOUT_PAGES.map((x) => x.id));
    const editable = schema.pages.filter((p) => !fixedIds.has(p.id));
    const fixed = FIXED_CHECKOUT_PAGES.map((fp) => schema.pages.find((p) => p.id === fp.id)).filter(Boolean);
    schema.pages = [...editable, ...fixed];
  }

  function addGroupToPage(pageId) {
    const p = getPage(pageId);
    if (!p) return;

    const gid = uid("group");
    p.groups.push({
      id: gid,
      name: `Group ${p.groups.length + 1}`,
      description: { enabled: false, html: "" },
      logic: { enabled: false, rules: [] },
      questions: [],
    });

    // Ensure flow exists and add group at the end
    p.flow = Array.isArray(p.flow) ? p.flow : p.groups.map((g) => ({ type: "group", id: g.id }));
    p.flow.push({ type: "group", id: gid });

    selection.pageId = p.id;
    selection.blockType = "group";
    selection.blockId = gid;
    selection.groupId = gid;
    selection.questionId = null;

    saveSchema();
    renderAll();
  }

  function addQuestion() {
    const p = getPage(selection.pageId);
    const g = getGroup(selection.pageId, selection.groupId);
    if (!p || !g) return;

    // If user is currently on a text block, add the question to the nearest group (next group, else previous)
    if (selection.blockType === "text") {
      const flow = Array.isArray(p.flow) ? p.flow : [];
      const idx = flow.findIndex((x) => x.id === selection.blockId);
      const nextGroupId = flow.slice(idx + 1).find((x) => x.type === "group")?.id;
      const prevGroupId = [...flow.slice(0, idx)].reverse().find((x) => x.type === "group")?.id;
      const targetGroupId = nextGroupId || prevGroupId;
      const target = targetGroupId ? getGroup(p.id, targetGroupId) : g;
      if (target) selection.groupId = target.id;
    }

    const group = getGroup(selection.pageId, selection.groupId);
    if (!group) return;

    const qid = uid("q");
    const q = {
      id: qid,
      type: "text",
      title: "New question",
      help: "",
      placeholder: "",
      required: false,
      errorText: "This field is required.",
      options: [],
      logic: { enabled: false, rules: [] },
      content: { enabled: false, html: "" },
    };

    group.questions.push(q);
    selection.blockType = "group";
    selection.blockId = group.id;
    selection.questionId = qid;

    saveSchema();
    renderAll();
  }

  // -------------------------
  // Question arrays (reusable templates)
  // -------------------------

  function ensureQuestionArrays() {
    schema.meta = schema.meta || {};
    schema.meta.questionArrays = Array.isArray(schema.meta.questionArrays)
      ? schema.meta.questionArrays
      : [];
    return schema.meta.questionArrays;
  }

  function stripQuestionForArray(q) {
    // Store a clean, ID-less version
    const qq = deepClone(q);
    delete qq.id;
    // Keep logic, but it will be remapped on insert (for internal references)
    return qq;
  }

  function createQuestionArrayFromGroup(pageId, groupId, name) {
    const p = getPage(pageId);
    const g = getGroup(pageId, groupId);
    if (!p || !g) return;

    const arrays = ensureQuestionArrays();
    const arr = {
      id: uid("qa"),
      name: String(name || g.name || "Question array").trim() || "Question array",
      createdAt: new Date().toISOString(),
      questions: (g.questions || []).map(stripQuestionForArray),
    };

    arrays.push(arr);
    uiState.selectedArrayId = arr.id;
    saveSchema();
    renderAll(true);
  }

  function insertQuestionArrayIntoGroup(pageId, groupId, arrayId, insertAfterQuestionId) {
    const p = getPage(pageId);
    const g = getGroup(pageId, groupId);
    if (!p || !g) return;

    const arrays = ensureQuestionArrays();
    const src = arrays.find((a) => a.id === arrayId);
    if (!src) return;

    const srcQs = Array.isArray(src.questions) ? src.questions : [];
    if (!srcQs.length) return;

    // 1) Create new questions + map oldIndex->newId and oldId->newId (if any persisted old ids exist)
    const idMap = {};
    const newQs = srcQs.map((q, idx) => {
      const next = deepClone(q);
      const newId = uid("q");
      // In case the stored template still had an id for any reason
      const oldId = next.id || `__idx_${idx}`;
      idMap[oldId] = newId;
      idMap[`__idx_${idx}`] = newId;
      next.id = newId;
      // Ensure required fields exist
      if (!next.type) next.type = "text";
      if (!next.title) next.title = "Untitled question";
      if (next.help == null) next.help = "";
      if (next.placeholder == null) next.placeholder = "";
      if (next.required == null) next.required = false;
      if (next.errorText == null) next.errorText = "This field is required.";
      if (next.options == null) next.options = [];
      if (next.logic == null) next.logic = { enabled: false, rules: [] };
      if (next.content == null) next.content = { enabled: false, html: "" };
      // Options sanity
      if (isOptionType(next.type)) {
        next.options = Array.isArray(next.options) && next.options.length ? next.options : ["Option 1", "Option 2", "Option 3"];
      } else {
        next.options = [];
      }
      return next;
    });

    // 2) Remap any internal logic references (rules that point to questions within the inserted set)
    newQs.forEach((q, idx) => {
      if (!q.logic?.enabled || !Array.isArray(q.logic.rules)) return;
      q.logic.rules.forEach((r) => {
        if (!r || !r.questionId) return;
        // If the rule references an old question ID in this template, remap it
        if (idMap[r.questionId]) r.questionId = idMap[r.questionId];
      });
    });

    // 3) Insert into group at the requested point
    let insertAt = g.questions.length;
    if (insertAfterQuestionId) {
      const idx = g.questions.findIndex((qq) => qq.id === insertAfterQuestionId);
      if (idx >= 0) insertAt = idx + 1;
    }

    g.questions.splice(insertAt, 0, ...newQs);

    // Select first inserted question
    selection.pageId = p.id;
    selection.blockType = "group";
    selection.blockId = g.id;
    selection.groupId = g.id;
    selection.questionId = newQs[0]?.id || null;

    saveSchema();
    renderAll(true);
  }

  function deleteQuestionArray(arrayId) {
    const arrays = ensureQuestionArrays();
    schema.meta.questionArrays = arrays.filter((a) => a.id !== arrayId);
    if (uiState.selectedArrayId === arrayId) uiState.selectedArrayId = schema.meta.questionArrays[0]?.id || null;
    saveSchema();
    renderAll(true);
  }

  /* =============================================================================
CH 6  Logic (validation, conditional display) + Flow building
============================================================================= */

  // -------------------------
  // Flow building (Preview steps)
  // -------------------------
  function getAllQuestionsInOrder(s) {
    const list = [];
    s.pages.forEach((p) => {
      p.groups.forEach((g) => {
        g.questions.forEach((q) => {
          list.push({
            id: q.id,
            pageId: p.id,
            groupId: g.id,
            pageName: p.name,
            groupName: g.name,
            ...q,
          });
        });
      });
    });
    return list;
  }

  function evaluateRule(rule, answers, referencedQuestion) {
    const ans = answers[rule.questionId];
    const op = rule.operator;

    const isEmpty =
      ans === undefined ||
      ans === null ||
      (typeof ans === "string" && ans.trim() === "") ||
      (Array.isArray(ans) && ans.length === 0);

    if (op === "is_answered") return !isEmpty;
    if (op === "is_not_answered") return isEmpty;

    const val = rule.value;

    // Normalize for comparisons
    const asString = (v) => (v === undefined || v === null ? "" : String(v));
    const asNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    };

    // If answer is array (checkboxes), treat contains checks against array
    if (Array.isArray(ans)) {
      if (op === "contains") return ans.includes(val);
      if (op === "not_contains") return !ans.includes(val);
      // equals/not_equals can compare joined
      if (op === "equals") return ans.join(",") === String(val);
      if (op === "not_equals") return ans.join(",") !== String(val);
    }

    // Number comparisons
    const mightBeNumeric = ["number", "currency", "percent"].includes(referencedQuestion?.type);
    if (["gt", "gte", "lt", "lte"].includes(op) || mightBeNumeric) {
      const a = asNumber(ans);
      const b = asNumber(val);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (op === "gt") return a > b;
      if (op === "gte") return a >= b;
      if (op === "lt") return a < b;
      if (op === "lte") return a <= b;
    }

    // String comparisons
    const aStr = asString(ans).toLowerCase();
    const bStr = asString(val).toLowerCase();

    if (op === "equals") return aStr === bStr;
    if (op === "not_equals") return aStr !== bStr;
    if (op === "contains") return aStr.includes(bStr);
    if (op === "not_contains") return !aStr.includes(bStr);

    return false;
  }

  function questionShouldShow(q, allQuestionsById, answers) {
    if (!q.logic?.enabled) return true;
    const rules = q.logic.rules || [];
    if (!rules.length) return true;

    // AND logic (all rules must match) — best practice default.
    return rules.every((r) => {
      const refQ = allQuestionsById[r.questionId];
      return evaluateRule(r, answers, refQ);
    });
  }

  function groupShouldShow(group, allQuestionsById, answers) {
    if (!group?.logic?.enabled) return true;
    const rules = group.logic.rules || [];
    if (!rules.length) return true;
    return rules.every((r) => {
      const refQ = allQuestionsById[r.questionId];
      return evaluateRule(r, answers, refQ);
    });
  }

  function buildPreviewSteps() {
    // Question mode: returns visible questions + any active follow-up questions,
    // BUT for fixed checkout pages (Quote/Summary/Payment) we insert a SINGLE
    // page-step so Question-by-question renders IDENTICALLY to Page-at-a-time.

    const all = getAllQuestionsInOrder(schema);
    const byId = Object.fromEntries(all.map((q) => [q.id, q]));

    // Pre-compute group visibility
    const groupVisible = {};
    schema.pages.forEach((p) => {
      p.groups.forEach((g) => {
        groupVisible[g.id] = groupShouldShow(g, byId, preview.answers);
      });
    });

    // Helper: determine if a page is one of our special checkout templates
    const isCheckoutTemplate = (tpl) => {
      const t = String(tpl || "").toLowerCase();
      return t === "quote" || t === "summary" || t === "payment";
    };

    const steps = [];

    // Build steps in PAGE order so we can inject checkout page-steps.
    schema.pages.forEach((p) => {
      const tpl = String(p.template || "form").toLowerCase();

      // ✅ Checkout pages: one step per page (identical rendering to page mode)
      if (isCheckoutTemplate(tpl)) {
        steps.push({
          id: `__page__${p.id}`,
          type: "__page__",
          pageId: p.id,
          pageName: p.name,
          groupName: "",
        });
        return;
      }

      // Normal pages: question-by-question
      p.groups.forEach((g) => {
        if (groupVisible[g.id] === false) return;

        (g.questions || []).forEach((q) => {
          // Respect question conditional logic
          const qCtx = byId[q.id];
          if (!questionShouldShow(qCtx, byId, preview.answers)) return;

          // Main question step
          steps.push({
            id: q.id,
            pageId: p.id,
            groupId: g.id,
            pageName: p.name,
            groupName: g.name,
            ...q,
          });

          // Follow-ups (if active)
          if (followUpMatches(q, preview.answers)) {
            const fuSteps = getActiveFollowUpSteps(q, preview.answers);
            fuSteps.forEach((fqStep) => {
              steps.push({
                ...fqStep,
                pageId: p.id,
                groupId: g.id,
                pageName: p.name,
                groupName: g.name,
              });
            });
          }
        });
      });
    });

    return steps;
  }

  function buildPreviewPageSteps() {
    // Page mode: one step per page (layout preview)
    return schema.pages.map((p) => ({ id: p.id, pageId: p.id, pageName: p.name }));
  }

  /* =============================================================================
CH 4.3  Preview / runtime (continued)
============================================================================= */

  // -------------------------
  // Preview UI
  // -------------------------

  function openPreview() {
    if (!previewBackdrop) return;

    // Load persisted preview mode if present
    if (schema?.meta?.previewMode) preview.mode = schema.meta.previewMode;

    preview.open = true;
    preview.index = 0;
    preview.lastError = "";
    preview.pageErrors = {};

    // Reset answers per preview session
    preview.answers = {};

    // Show modal via CSS class only
    previewBackdrop.classList.add("isOpen");
    document.body.style.overflow = "hidden";

    renderPreview();
    setTimeout(() => previewStage?.focus(), 20);
  }

  function closePreview() {
    if (!previewBackdrop) return;

    preview.open = false;
    previewBackdrop.classList.remove("isOpen");
    document.body.style.overflow = "";
    if (!previewStage) return;

    previewStage.innerHTML = "";
  }

  function setProgress() {
    const steps = preview.steps;
    const total = steps.length || 1;
    const current = clamp(preview.index + 1, 1, total);
    const pct = (current / total) * 100;

    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) {
      const label = preview.mode === "page" ? "Page" : "Q";
      progressText.textContent = `${label} ${current} / ${total}`;
    }
  }

  function renderPreview() {
    /* ----------------------------------------------------------------------
    CH 4.3  Preview / runtime
    ---------------------------------------------------------------------- */
    // Steps depend on mode
    preview.steps = preview.mode === "page" ? buildPreviewPageSteps() : buildPreviewSteps();
    preview.index = clamp(preview.index, 0, Math.max(0, preview.steps.length - 1));

    const steps = preview.steps;
    const step = steps[preview.index];

    if (previewTitle) previewTitle.textContent = schema.lineOfBusiness || "Preview";

    // ✅ Expose the *current* page template to the DOM for CSS targeting
    const currentPage = step?.pageId ? getPage(step.pageId) : null;
    setTemplateContext(currentPage?.template || "form");

    if (preview.mode === "page") {
      if (previewSub) previewSub.textContent = step ? `${step.pageName}` : "No pages";
      setProgress();
      if (btnPrev) btnPrev.disabled = preview.index === 0;
      if (btnNext) btnNext.disabled = steps.length === 0;
      previewStage.innerHTML = "";
      if (!step) {
        const wrap = document.createElement("div");
        wrap.className = "previewCard";
        wrap.innerHTML = `
          <div class="pQ">No pages to preview</div>
          <div class="pHelp">Add pages in the builder, then open Preview again.</div>
        `;
        previewStage.appendChild(wrap);
        return;
      }
      renderPreviewPage(step.pageId);
      if (btnNext) btnNext.disabled = false;
      return;
    }

    // Question mode (Typeform-style)
    if (previewSub) previewSub.textContent = step ? `${step.pageName} · ${step.groupName}` : "No questions yet";

    setProgress();

    if (btnPrev) btnPrev.disabled = preview.index === 0;
    if (btnNext) btnNext.disabled = steps.length === 0;

    previewStage.innerHTML = "";
    if (!step) {
      const wrap = document.createElement("div");
      wrap.className = "previewCard";
      wrap.innerHTML = `
        <div class="pQ">No questions to preview</div>
        <div class="pHelp">Add questions in the builder, then open Preview again.</div>
      `;
      previewStage.appendChild(wrap);
      return;
    }

    // Render the current step
    const card = document.createElement("div");
    card.className = cx(
      "previewCard",
      "qnb-preview-card",
      tplClass(currentPage?.template || "form", "card")
    );

    // Header: Page title, then Group title + description (matches page mode layout)
    const pageTitleEl = document.createElement("div");
    pageTitleEl.className = cx("pQ", "qnb-preview-page-title");
    pageTitleEl.textContent = step.pageName || "Untitled page";
    card.appendChild(pageTitleEl);

    const groupTitleEl = document.createElement("div");
    groupTitleEl.className = cx("previewGroupTitle", "qnb-preview-group-title");
    groupTitleEl.textContent = step.groupName || "Untitled group";
    card.appendChild(groupTitleEl);

    const liveGroup = getGroup(step.pageId, step.groupId);
    if (liveGroup?.description?.enabled) {
      const gd = sanitizeRichHtml(liveGroup.description.html || "");
      if (gd) {
        const groupDescEl = document.createElement("div");
        groupDescEl.className = "pHelp previewGroupDesc";
        groupDescEl.innerHTML = gd;
        card.appendChild(groupDescEl);
      }
    }

    // IMPORTANT: question title must NOT reuse the page title class
    const qEl = document.createElement("div");
    qEl.className = cx("previewQuestionTitle", "qnb-preview-question-title");
    qEl.textContent = step.title || "Untitled question";

    const helpEl = document.createElement("div");
    helpEl.className = cx("pHelp", "qnb-preview-help");
    helpEl.textContent = step.help || "";

    const contentEl = document.createElement("div");
    contentEl.className = cx("previewQuestionContent", "qnb-preview-question-content");
    const contentHtml = step.content?.enabled ? sanitizeRichHtml(step.content.html || "") : "";
    contentEl.innerHTML = contentHtml;
    contentEl.style.display = contentHtml ? "block" : "none";

    const errEl = document.createElement("div");
    errEl.className = cx("pError", "qnb-preview-error");
    errEl.textContent = preview.lastError || "";
    errEl.style.display = preview.lastError ? "block" : "none";

    const inputWrap = document.createElement("div");
    inputWrap.className = cx("pInputWrap", "qnb-preview-input-wrap");

    // Build input control per type
    const setAnswer = (v) => {
      preview.answers[step.id] = v;
    };
    const getAnswer = () => preview.answers[step.id];

    buildPreviewInputControl(step, inputWrap, setAnswer, getAnswer, () => renderPreview());

    card.appendChild(qEl);
    if (contentHtml) card.appendChild(contentEl);
    if (step.help) card.appendChild(helpEl);
    card.appendChild(inputWrap);
    card.appendChild(errEl);
    previewStage.appendChild(card);

    // Ensure Next button is re-enabled if previously disabled by completion view
    if (btnNext) btnNext.disabled = false;
  }

  function buildPreviewInputControl(step, inputWrap, setAnswer, getAnswer, rerender) {
    if (["text", "email", "number", "currency", "percent", "tel", "postcode", "date"].includes(step.type)) {
      const input = document.createElement("input");
      input.className = "pInput";

      // For custom date picker, render as text input and attach Flatpickr
      if (step.type === "date") {
        input.type = "text";
        input.inputMode = "numeric";
        input.placeholder = step.placeholder || "dd/mm/yyyy";
        input.autocomplete = "off";
      } else if (step.type === "tel") {
        input.type = "tel";
        input.inputMode = "tel";
        input.placeholder = step.placeholder || "e.g. 07700 900123";
        input.autocomplete = "tel";
      } else if (step.type === "postcode") {
        input.type = "text";
        input.inputMode = "text";
        input.placeholder = step.placeholder || "e.g. SW1A 1AA";
        input.autocomplete = "postal-code";
        // Light normalisation to UK-style formatting (upper-case + trim)
        input.addEventListener("blur", () => {
          const v = (input.value || "").trim().toUpperCase();
          input.value = v;
          setAnswer(v);
        });
      } else if (step.type === "currency") {
        input.type = "text";
        input.inputMode = "decimal";
        input.placeholder = step.placeholder || "e.g. 1,250.00";
      } else if (step.type === "percent") {
        input.type = "text";
        input.inputMode = "decimal";
        input.placeholder = step.placeholder || "e.g. 10";
      } else {
        input.type = step.type === "text" ? "text" : step.type;
        input.placeholder = step.placeholder || "";
      }

      input.value = getAnswer() ?? "";
      input.addEventListener("input", () => setAnswer(input.value));
      inputWrap.appendChild(input);

      if (step.type === "date") {
        // Attach Flatpickr if it's loaded (safe no-op if not)
        initFlatpickrDateInput(input, input.value, (v) => {
          setAnswer(v);
          input.value = v;
        });
      }
      if (preview.mode === "question") {
        setTimeout(() => {
          if (!shouldSuppressAutoFocus()) input.focus();
        }, 0);
      }
      return;
    }

    if (step.type === "textarea") {
      const ta = document.createElement("textarea");
      ta.className = "pTextarea";
      ta.placeholder = step.placeholder || "";
      ta.value = getAnswer() ?? "";
      ta.addEventListener("input", () => setAnswer(ta.value));
      inputWrap.appendChild(ta);
      if (preview.mode === "question") {
        setTimeout(() => {
          if (!shouldSuppressAutoFocus()) ta.focus();
        }, 0);
      }
      return;
    }

    if (step.type === "yesno") {
      const row = document.createElement("div");
      row.className = "choiceGrid";

      const mk = (label, val) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "choiceBtn" + (getAnswer() === val ? " selected" : "");
        b.textContent = label;
        b.addEventListener("click", () => {
          // Prevent any auto-focus during the re-render (page mode can render many controls)
          suppressAutoFocusUntil = Date.now() + 300;

          // If user changes the parent answer, reset follow-up instances + answers
          const prev = getAnswer();
          setAnswer(val);
          if (prev !== val && step.followUp?.enabled) {
            clearFollowUpAnswersForQuestion(step, preview.answers);
            // If repeatable and still matches after change, ensure min instances
            ensureMinFollowUpInstances(step, preview.answers);
          }

          rerender();
        });
        return b;
      };

      row.appendChild(mk("Yes", "Yes"));
      row.appendChild(mk("No", "No"));
      inputWrap.appendChild(row);
      return;
    }

    if (isOptionType(step.type)) {
      const opts = Array.isArray(step.options) ? step.options : [];

      if (step.type === "select") {
        const sel = document.createElement("select");
        sel.className = "pSelect";
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "— Select —";
        sel.appendChild(blank);
        opts.forEach((o) => {
          const op = document.createElement("option");
          op.value = o;
          op.textContent = o;
          sel.appendChild(op);
        });
        sel.value = getAnswer() ?? "";
        sel.addEventListener("change", () => setAnswer(sel.value));
        inputWrap.appendChild(sel);
        if (preview.mode === "question") {
          setTimeout(() => {
            if (!shouldSuppressAutoFocus()) sel.focus();
          }, 0);
        }
        return;
      }

      if (step.type === "radio") {
        const list = document.createElement("div");
        list.className = "choiceGrid";
        const cur = getAnswer() ?? "";
        opts.forEach((o) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "choiceBtn" + (cur === o ? " selected" : "");
          b.textContent = o;
          b.addEventListener("click", () => {
            // Prevent re-render from auto-focusing a different control (e.g. a textarea elsewhere)
            suppressAutoFocusUntil = Date.now() + 300;
            setAnswer(o);
            rerender();
          });
          list.appendChild(b);
        });
        inputWrap.appendChild(list);
        return;
      }

      if (step.type === "checkboxes") {
        const list = document.createElement("div");
        list.className = "choiceGrid";

        const cur = Array.isArray(getAnswer()) ? getAnswer() : [];

        opts.forEach((o, idx) => {
          const id = `chk_${step.id}_${idx}`;

          const label = document.createElement("label");
          label.className = "choiceBtn choiceCheck" + (cur.includes(o) ? " selected" : "");
          label.setAttribute("for", id);

          const cb = document.createElement("input");
          cb.className = "choiceCheckBox";
          cb.type = "checkbox";
          cb.id = id;
          cb.checked = cur.includes(o);

          const txt = document.createElement("span");
          txt.className = "choiceCheckText";
          txt.textContent = o;

          cb.addEventListener("change", () => {
            const next = new Set(Array.isArray(getAnswer()) ? getAnswer() : []);
            if (cb.checked) next.add(o);
            else next.delete(o);
            const arr = Array.from(next);
            setAnswer(arr);
            label.classList.toggle("selected", cb.checked);
          });

          label.appendChild(cb);
          label.appendChild(txt);
          list.appendChild(label);
        });

        inputWrap.appendChild(list);
        return;
      }
    }

    // fallback
    const input = document.createElement("input");
    input.className = "pInput";
    input.type = "text";
    input.value = getAnswer() ?? "";
    input.addEventListener("input", () => setAnswer(input.value));
    inputWrap.appendChild(input);

    if (preview.mode === "question") {
      setTimeout(() => {
        if (!shouldSuppressAutoFocus()) input.focus();
      }, 0);
    }
    return;
  }

  function renderPreviewPage(page) {
    previewContentEl.innerHTML = "";

    const tpl = String(page.template || "form").toLowerCase();

    // ---- FIXED TEMPLATE BLOCKS (always render first) ----
    if (tpl === "quote") {
      previewContentEl.appendChild(renderQuoteTemplate(page));
    }
    if (tpl === "summary") {
      previewContentEl.appendChild(renderSummaryTemplate(page));
    }
    if (tpl === "payment") {
      previewContentEl.appendChild(renderPaymentTemplate(page));
    }

    // ---- EXISTING GROUP / TEXT RENDERING ----
    page.flow.forEach((it) => {
      if (it.type === "text") {
        renderTextBlock(it);
        return;
      }

      if (it.type === "group") {
        const g = page.groups.find((gg) => gg.id === it.id);
        if (!g) return;

        // Respect group visibility (used by preview modes)
        if (typeof groupVisible === "object" && groupVisible[g.id] === false) return;

        renderGroup(g, page);
      }
    });
  }

        if (title || body) stack.appendChild(block);
        return;
      }

      if (it.type === "group") {
        const g = p.groups.find((gg) => gg.id === it.id);
        if (!g) return;
        if (groupVisible[g.id] === false) return;

        const groupWrap = document.createElement("div");
        groupWrap.className = cx("previewGroup", "qnb-preview-group");

        const gTitle = document.createElement("div");
        gTitle.className = cx("previewGroupTitle", "qnb-preview-group-title");
        gTitle.textContent = g.name || "Untitled group";
        groupWrap.appendChild(gTitle);

        if (g.description?.enabled) {
          const d = sanitizeRichHtml(g.description.html || "");
          if (d) {
            const dEl = document.createElement("div");
            dEl.className = cx("pHelp", "previewGroupDesc", "qnb-preview-group-desc");
            dEl.innerHTML = d;
            groupWrap.appendChild(dEl);
          }
        }

        const visibleQuestions = (g.questions || []).filter((qq) => questionShouldShow(qq, byId, preview.answers));

        visibleQuestions.forEach((qq) => {
          const qBlock = document.createElement("div");
          qBlock.className = cx("previewQuestion", "qnb-preview-question");

          const qTitle = document.createElement("div");
          qTitle.className = cx("previewQuestionTitle", "qnb-preview-question-title");
          qTitle.textContent = qq.title || "Untitled question";
          qBlock.appendChild(qTitle);

          if (qq.content?.enabled) {
            const c = sanitizeRichHtml(qq.content.html || "");
            if (c) {
              const cEl = document.createElement("div");
              cEl.className = cx("previewQuestionContent", "qnb-preview-question-content");
              cEl.innerHTML = c;
              qBlock.appendChild(cEl);
            }
          }

          if (qq.help) {
            const h = document.createElement("div");
            h.className = "pHelp";
            h.textContent = qq.help;
            qBlock.appendChild(h);
          }

          const inputWrap = document.createElement("div");
          inputWrap.className = "pInputWrap";

          const setA = (v) => {
            preview.answers[qq.id] = v;

            // Clear error on change (page mode)
            if (preview.pageErrors?.[qq.id]) {
              delete preview.pageErrors[qq.id];
              // Re-render to hide the inline message immediately
              renderPreview();
            }
          };

          const getA = () => preview.answers[qq.id];

          buildPreviewInputControl(qq, inputWrap, setA, getA, () => renderPreview());

          qBlock.appendChild(inputWrap);

          // Inline field error (page mode)
          const fieldErr = preview.pageErrors?.[qq.id] || "";
          const errEl = document.createElement("div");
          errEl.className = "pError";
          errEl.textContent = fieldErr;
          errEl.style.display = fieldErr ? "block" : "none";
          qBlock.appendChild(errEl);

          // Follow-up questions (nested under this question)
          if (followUpMatches(qq, preview.answers)) {
            const fWrap = document.createElement("div");
            fWrap.className = "previewFollowUp";
            fWrap.style.marginTop = "12px";
            fWrap.style.paddingLeft = "14px";
            fWrap.style.borderLeft = "1px solid rgba(255,255,255,0.12)";

            const fuName = String(qq.followUp?.name || "").trim();
            const isRepeat = followUpIsRepeatable(qq);
            if (isRepeat) ensureMinFollowUpInstances(qq, preview.answers);

            // Optional name label
            if (fuName) {
              const nm = document.createElement("div");
              nm.className = "label";
              nm.style.marginBottom = "6px";
              nm.textContent = fuName;
              fWrap.appendChild(nm);
            }

            const renderInstance = (instId, instIndex) => {
              const instanceHeader = document.createElement("div");
              instanceHeader.style.display = "flex";
              instanceHeader.style.alignItems = "center";
              instanceHeader.style.justifyContent = "space-between";
              instanceHeader.style.gap = "10px";
              instanceHeader.style.marginTop = instIndex === 0 ? "0" : "14px";

              const itemLabel = String(qq.followUp?.repeat?.itemLabel || "Item").trim() || "Item";
              const title = document.createElement("div");
              title.className = "label";
              title.textContent = `${itemLabel} ${instIndex + 1}`;
              instanceHeader.appendChild(title);

              if (isRepeat) {
                const min = clamp(Number(qq.followUp?.repeat?.min ?? 1), 0, 50);
                const removeBtn = document.createElement("button");
                removeBtn.type = "button";
                removeBtn.className = "btn ghost";
                removeBtn.textContent = "Remove";
                removeBtn.disabled = getFollowUpInstanceIds(qq, preview.answers).length <= min;
                removeBtn.addEventListener("click", () => {
                  removeFollowUpInstance(qq, preview.answers, instId);
                  renderPreview();
                });
                instanceHeader.appendChild(removeBtn);
              }

              fWrap.appendChild(instanceHeader);

              const fqs = getActiveFollowUps(qq, preview.answers);
              fqs.forEach((fq) => {
                const sub = document.createElement("div");
                sub.className = "previewQuestion";
                sub.style.marginTop = "10px";

                const t = document.createElement("div");
                t.className = "previewQuestionTitle";
                t.textContent = fq.title || "Untitled question";
                sub.appendChild(t);

                if (fq.content?.enabled) {
                  const c2 = sanitizeRichHtml(fq.content.html || "");
                  if (c2) {
                    const cEl2 = document.createElement("div");
                    cEl2.className = "previewQuestionContent";
                    cEl2.innerHTML = c2;
                    sub.appendChild(cEl2);
                  }
                }

                if (fq.help) {
                  const h2 = document.createElement("div");
                  h2.className = "pHelp";
                  h2.textContent = fq.help;
                  sub.appendChild(h2);
                }

                const iw2 = document.createElement("div");
                iw2.className = "pInputWrap";

                const answerId = isRepeat ? makeFollowUpAnswerId(qq.id, fq.id, instId) : fq.id;

                const setF = (v) => {
                  preview.answers[answerId] = v;
                  if (preview.pageErrors?.[answerId]) {
                    delete preview.pageErrors[answerId];
                    renderPreview();
                  }
                };
                const getF = () => preview.answers[answerId];

                // Build control using a cloned step object so it reads correct type/options
                const stepObj = { ...fq, id: answerId };
                buildPreviewInputControl(stepObj, iw2, setF, getF, () => renderPreview());
                sub.appendChild(iw2);

                const ferr = preview.pageErrors?.[answerId] || "";
                const fe = document.createElement("div");
                fe.className = "pError";
                fe.textContent = ferr;
                fe.style.display = ferr ? "block" : "none";
                sub.appendChild(fe);

                fWrap.appendChild(sub);
              });
            };

            if (isRepeat) {
              const instIds = getFollowUpInstanceIds(qq, preview.answers);
              instIds.forEach((instId, idx) => renderInstance(instId, idx));

              const addBtn = document.createElement("button");
              addBtn.type = "button";
              addBtn.className = "btn";
              addBtn.style.marginTop = "12px";
              addBtn.textContent = String(qq.followUp?.repeat?.addLabel || "Add another");

              const min = clamp(Number(qq.followUp?.repeat?.min ?? 1), 0, 50);
              const max = clamp(Number(qq.followUp?.repeat?.max ?? 5), min, 50);
              addBtn.disabled = instIds.length >= max;

              addBtn.addEventListener("click", () => {
                addFollowUpInstance(qq, preview.answers);
                renderPreview();
              });

              fWrap.appendChild(addBtn);
            } else {
              // Single (non-repeatable) follow-up set
              renderInstance("single", 0);
            }

            qBlock.appendChild(fWrap);
          }

          // IMPORTANT: keep group title/description ABOVE its questions
          groupWrap.appendChild(qBlock);
        });

        // If a group has no visible questions/content, avoid rendering empty blocks
        if (groupWrap.childNodes.length > 2 || visibleQuestions.length) {
          stack.appendChild(groupWrap);
        }

        return;
      }
    });

    card.appendChild(stack);

    // Error banner (page mode)
    if (preview.lastError) {
      const err = document.createElement("div");
      err.className = "pError";
      err.style.marginTop = "12px";
      err.textContent = preview.lastError;
      card.appendChild(err);
    }

    previewStage.appendChild(card);
  }

  // -------------------------
  // (Reserved) Completion renderer
  // -------------------------
  // Note: completion UI is handled inline in the Next button handler.

  // -------------------------
  // Export / Import
  // -------------------------
  function exportJson() {
    saveSchema();
    const data = JSON.stringify(schema, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `form-schema-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  function importJsonFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (!parsed || !Array.isArray(parsed.pages)) throw new Error("Invalid schema format.");
        schema = parsed;
        saveSchema();
        ensureSelection();
        renderAll();
        alert("Imported successfully.");
      } catch (e) {
        alert("Import failed: " + (e?.message || "Unknown error"));
      }
    };
    reader.readAsText(file);
  }

  /* =============================================================================
CH 8  Event wiring (listeners)
============================================================================= */

  // -------------------------
  // Event wiring
  // -------------------------
  function wire() {
    // Track inspector focus to prevent rebuild while typing (fixes 1-letter issue)
    document.addEventListener("focusin", (e) => {
      if (!e.target.closest("#inspector")) return;
      // Only treat as "typing" when focusing a text-editing control
      isTypingInspector = isTextEditingElement(e.target);
    });

    document.addEventListener("focusout", (e) => {
      if (!e.target.closest("#inspector")) return;
      // If focus stays within inspector, keep flag only if the new active element is a typing control
      setTimeout(() => {
        const ae = document.activeElement;
        if (ae && ae.closest && ae.closest("#inspector")) {
          isTypingInspector = isTextEditingElement(ae);
        } else {
          isTypingInspector = false;
        }
        renderAll();
      }, 0);
    });
    // LOB inline title
    lobTitleEl.addEventListener("input", () => {
      schema.lineOfBusiness = safeText(lobTitleEl) || "Line of Business";
      saveSchemaDebounced();
    });
    lobTitleEl.addEventListener("blur", () => {
      schema.lineOfBusiness = safeText(lobTitleEl) || "Line of Business";
      saveSchema();
      renderAll();
    });

    btnAddPage.addEventListener("click", addPage);
    emptyAddPage.addEventListener("click", addPage);

    btnAddGroup.addEventListener("click", () => {
      const p = getPage(selection.pageId);
      if (!p) return;
      addGroupToPage(p.id);
    });

    btnAddQuestion.addEventListener("click", addQuestion);

    btnPreview.addEventListener("click", () => {
      preview.answers = {};
      openPreview();
    });

    // Preview nav
    btnPrev.addEventListener("click", () => {
      if (!preview.open) return;
      preview.lastError = "";
      preview.pageErrors = {};
      preview.index = clamp(preview.index - 1, 0, Math.max(0, preview.steps.length - 1));
      renderPreview();
    });

    btnNext.addEventListener("click", () => {
      if (!preview.open) return;

      // PAGE MODE: validate all required visible questions on this page, then advance page
      if (preview.mode === "page") {
        preview.steps = buildPreviewPageSteps();
        preview.index = clamp(preview.index, 0, Math.max(0, preview.steps.length - 1));
        const step = preview.steps[preview.index];
        if (!step) return;

        const p = getPage(step.pageId);
        if (!p) return;

        const all = getAllQuestionsInOrder(schema);
        const byId = Object.fromEntries(all.map((q) => [q.id, q]));

        // Determine which questions are visible on this page right now
        const visibleQ = [];
        (p.flow || []).forEach((it) => {
          if (it.type !== "group") return;
          const g = p.groups.find((gg) => gg.id === it.id);
          if (!g) return;
          if (groupShouldShow(g, byId, preview.answers) === false) return;
          (g.questions || []).forEach((qq) => {
            if (!questionShouldShow(qq, byId, preview.answers)) return;
            visibleQ.push(qq);

            // If the follow-up is active, include nested questions in page-level validation
            if (followUpMatches(qq, preview.answers)) {
              const fuSteps = getActiveFollowUpSteps(qq, preview.answers);
              fuSteps.forEach((fqStep) => visibleQ.push(fqStep));
            }
          });
        });

        // Validate required questions (page mode: collect per-field errors)
        const errors = {};
        for (const qq of visibleQ) {
          if (!qq.required) continue;
          const ans = preview.answers[qq.id];
          const empty =
            ans === undefined ||
            ans === null ||
            (typeof ans === "string" && ans.trim() === "") ||
            (Array.isArray(ans) && ans.length === 0);
          if (empty) {
            errors[qq.id] = qq.errorText || "This field is required.";
          }
        }

        if (Object.keys(errors).length) {
          preview.pageErrors = errors;
          preview.lastError = "";
          renderPreview();
          return;
        }

        preview.pageErrors = {};
        preview.lastError = "";

        if (preview.index >= preview.steps.length - 1) {
          // completion
          previewStage.innerHTML = "";
          const wrap = document.createElement("div");
          wrap.className = "previewCard";
          wrap.innerHTML = `
            <div class="pQ">All done</div>
            <div class="pHelp">You reached the end of the preview flow.</div>
          `;
          previewStage.appendChild(wrap);
          btnNext.disabled = true;
          return;
        }

        preview.index = clamp(preview.index + 1, 0, preview.steps.length - 1);
        renderPreview();
        return;
      }

      // QUESTION MODE (existing)
      // rebuild steps before validating (logic can change)
      preview.steps = buildPreviewSteps();
      preview.index = clamp(preview.index, 0, Math.max(0, preview.steps.length - 1));

      const step = preview.steps[preview.index];
      if (!step) return;

      // required validation
      if (step.required) {
        const ans = preview.answers[step.id];
        const empty =
          ans === undefined ||
          ans === null ||
          (typeof ans === "string" && ans.trim() === "") ||
          (Array.isArray(ans) && ans.length === 0);
        if (empty) {
          preview.lastError = step.errorText || "This field is required.";
          renderPreview();
          return;
        }
      }

      preview.lastError = "";
      if (preview.index >= preview.steps.length - 1) {
        // show completion
        previewStage.innerHTML = "";
        const wrap = document.createElement("div");
        wrap.className = "previewCard";
        wrap.innerHTML = `
          <div class="pQ">All done</div>
          <div class="pHelp">You reached the end of the preview flow.</div>
        `;
        previewStage.appendChild(wrap);
        btnNext.disabled = true;
        return;
      }

      preview.index = clamp(preview.index + 1, 0, preview.steps.length - 1);
      renderPreview();
    });

    btnClosePreview.addEventListener("click", closePreview);
    previewBackdrop.addEventListener("click", (e) => {
      if (e.target === previewBackdrop) closePreview();
    });

    btnExport.addEventListener("click", exportJson);

    btnImport.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const f = fileInput.files?.[0];
      if (f) importJsonFile(f);
      fileInput.value = "";
    });

    // ESC closes preview
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && previewBackdrop.classList.contains("isOpen")) closePreview();
    });
  }

  // -------------------------
  // Init
  // -------------------------
  // Ensure preview is closed on load (CSS-only control)
  if (previewBackdrop) {
    previewBackdrop.classList.remove("isOpen");
  }

  // Restore preview mode preference if present
  if (schema?.meta?.previewMode) {
    preview.mode = schema.meta.previewMode;
  }

  wire();
  // Builder-only AI Assist (safe even if CSS/DOM doesn't have specific hooks)
  try { mountAiAssistUI(); } catch { /* no-op */ }
  renderAll();

  // Auto-create friendly initial values if schema is empty or corrupted
  if (!schema.lineOfBusiness) schema.lineOfBusiness = "New Journey";
  if (!Array.isArray(schema.pages)) schema.pages = [];
})();



// ------------------------------
// TEMPLATE REGISTRY
// ------------------------------
// Defines editable, schema-driven page templates for the Screen Builder.
// Each template provides:
// - label: human-friendly name
// - schema: fields shown in the editor
// - defaults: initial values
// - render(values): returns HTML string for preview/export
//
// NOTE: This registry is safe to extend—add new template keys alongside `quote`.
const TEMPLATE_DEFS = {
  quote: {
    label: "Quote page",
    schema: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "intro", label: "Intro text", type: "textarea" },
      { key: "showPrice", label: "Show premium", type: "toggle" },
      { key: "priceLabel", label: "Premium label", type: "text" },
      { key: "ctaText", label: "CTA button text", type: "text" }
    ],
    defaults: {
      heading: "Your quote",
      intro: "Here’s your price based on the details you’ve provided.",
      showPrice: true,
      priceLabel: "Total premium",
      ctaText: "Continue"
    },
    render(values) {
      const v = values || {};
      return `
        <div class="template template-quote">
          <div class="template-header">
            <h1 class="template-title">${escapeHtml(v.heading ?? "")}</h1>
            <p class="template-intro">${escapeHtml(v.intro ?? "")}</p>
          </div>

          ${v.showPrice ? `
            <div class="template-panel">
              <div class="template-row">
                <div class="template-label">${escapeHtml(v.priceLabel ?? "")}</div>
                <div class="template-value">£1,234.56</div>
              </div>
            </div>
          ` : ""}

          <div class="template-actions">
            <button class="btn primary" type="button">${escapeHtml(v.ctaText ?? "Continue")}</button>
          </div>
        </div>
      `;
    }
  }

  // Add more templates later...
  // summary: { ... }
};


