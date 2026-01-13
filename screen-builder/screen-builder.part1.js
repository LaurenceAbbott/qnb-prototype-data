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
        g.questions = Array.isArray(g.questions) ? g.questio