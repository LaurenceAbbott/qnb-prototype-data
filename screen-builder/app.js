
// --- ITEM LABEL HELPERS ---
const DISPLAY_VARIANT_LABELS = {
  info: "Alert",
  bigPrice: "Big price",
  hero: "Hero",
  divider: "Divider",
};

const DISPLAY_VARIANT_DEFAULTS = {
  bigPrice: {
    title: "£1,250",
    subtitle: "per year",
    bodyHtml: "",
    prefix: "",
    suffix: "",
  },
  info: {
    title: "Title",
    subtitle: "",
    bodyHtml: "<p>Use this block to highlight key information.</p>",
    prefix: "",
    suffix: "",
  },
  hero: {
    title: "Hero title",
    subtitle: "",
    bodyHtml: "<p>Supporting copy goes here.</p>",
    prefix: "",
    suffix: "",
  },
  divider: {
    title: "",
    subtitle: "",
    bodyHtml: "",
    prefix: "",
    suffix: "",
  },
};

function normalizeDisplayVariant(variant) {
  if (variant === "price") return "bigPrice";
  if (!variant || !DISPLAY_VARIANT_LABELS[variant]) return "info";
  return variant;
}

function displaySupportsTone(variant) {
  return normalizeDisplayVariant(variant) === "info";
}

function applyDisplayDefaults(display, variant) {
  const normalized = normalizeDisplayVariant(variant);
  const defaults = DISPLAY_VARIANT_DEFAULTS[normalized] || DISPLAY_VARIANT_DEFAULTS.info;
    const supportsTone = displaySupportsTone(normalized);
  return {
    ...display,
    variant: normalized,
    tone: supportsTone ? display?.tone || "neutral" : "neutral",
    title: defaults.title,
    subtitle: defaults.subtitle,
    bodyHtml: defaults.bodyHtml,
    prefix: defaults.prefix,
    suffix: defaults.suffix,
  };
}

function getDisplayCardTitle(display) {
  const normalized = normalizeDisplayVariant(display?.variant);
  const base = DISPLAY_VARIANT_LABELS[normalized] || "Display";
  if (normalized === "divider") return base;
  const title = String(display?.title || "").trim();
  return title ? `${base}: ${title}` : base;
}

function getItemLabel(item) {
  if (item.type === "display") {
    const base = DISPLAY_VARIANT_LABELS[item.variant] || "Display";
    return item.title ? `${base}: ${item.title}` : base;
  }
  return getItemLabel(item);
}


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
      "H5",
      "A",
      "HR",
      "BLOCKQUOTE",
      "SMALL",
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

        // Strip attributes by default (prevents XSS via on* handlers, style, etc.)
        // Allow safe links on <a> only (href + target + rel).
        if (el.tagName === "A") {
          const href = el.getAttribute("href") || "";
          const safe = /^(https?:\/\/|mailto:|tel:)/i.test(href.trim());
          // remove everything first
          [...el.attributes].forEach((a) => el.removeAttribute(a.name));
          if (safe) {
            el.setAttribute("href", href.trim());
            el.setAttribute("target", "_blank");
            el.setAttribute("rel", "noopener noreferrer");
          }
        } else {
          [...el.attributes].forEach((a) => el.removeAttribute(a.name));
        }

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

  // Display elements (non-input blocks that can be placed inside groups)
  // These render in Preview but do not collect answers.
  const DISPLAY_VARIANTS = [
    { key: "hero", label: "Hero / banner" },
    { key: "bigPrice", label: "Big price" },
    { key: "info", label: "Alert" },
    { key: "divider", label: "Divider" },
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
// -------------------------
// Fixed checkout pages removed
// -------------------------
// Quote/Summary/Payment are no longer treated as special fixed pages.
// If you want a Quote/Summary/Payment page, import it as a page template JSON.
const isFixedPage = () => false;

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
  // -------------------------
  // Page templates
  // -------------------------
  // Page templates are now imported/exported as JSON at page level.
  // The designer no longer contains built-in page presets or generators.

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
                                 defaultAnswer: null,
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

   function normalizeDefaultAnswerForQuestion(question) {
    if (!question || typeof question !== "object") return null;
    const type = question.type;
    const options = Array.isArray(question.options) ? question.options : [];
    const raw = question.defaultAnswer;

    if (type === "yesno") {
      return raw === "Yes" || raw === "No" ? raw : null;
    }

    if (type === "checkboxes") {
      const values = Array.isArray(raw) ? raw.filter((opt) => options.includes(opt)) : [];
      return values.length ? values : null;
    }

    if (type === "radio" || type === "select") {
      return options.includes(raw) ? raw : null;
    }

    return null;
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
    if (!["page", "question"].includes(schema.meta.previewMode)) {
      schema.meta.previewMode = "page";
    }
    
    if (!Array.isArray(schema.pages)) schema.pages = [];

    // --- Ensure fixed checkout pages always exist (and remain at the end)
    
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
                    if (q.defaultAnswer === undefined) q.defaultAnswer = null;
          if (q.logic == null) q.logic = { enabled: false, rules: [] };
          if (q.content == null) q.content = { enabled: false, html: "" };
          if (q.type === "display") {
            q.display = q.display && typeof q.display === "object" ? q.display : {};
            const normalizedVariant = normalizeDisplayVariant(q.display.variant);
            const defaults = DISPLAY_VARIANT_DEFAULTS[normalizedVariant] || DISPLAY_VARIANT_DEFAULTS.info;
            q.display.variant = normalizedVariant;
                        q.display.tone = displaySupportsTone(normalizedVariant)
              ? q.display.tone || "neutral"
              : "neutral";
            q.display.title = q.display.title ?? defaults.title;
            q.display.subtitle = q.display.subtitle ?? defaults.subtitle;
            q.display.bodyHtml = q.display.bodyHtml ?? defaults.bodyHtml;
            q.display.prefix = q.display.prefix ?? defaults.prefix;
            q.display.suffix = q.display.suffix ?? defaults.suffix;
          }
          
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
                        if (fq.defaultAnswer === undefined) fq.defaultAnswer = null;
            if (fq.logic == null) fq.logic = { enabled: false, rules: [] };
            if (fq.content == null) fq.content = { enabled: false, html: "" };

            if (isOptionType(fq.type)) {
              fq.options = Array.isArray(fq.options) ? fq.options : [];
              if (fq.options.length === 0) fq.options = ["Option 1", "Option 2", "Option 3"];
            } else {
              fq.options = [];
            }
                        fq.defaultAnswer = normalizeDefaultAnswerForQuestion(fq);
          });

          // Ensure options are present for option types
          if (isOptionType(q.type)) {
            q.options = Array.isArray(q.options) ? q.options : [];
            if (q.options.length === 0) q.options = ["Option 1", "Option 2", "Option 3"];
          } else {
            q.options = [];
          }
                    q.defaultAnswer = normalizeDefaultAnswerForQuestion(q);
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
    mode: "page", // "question" | "page"
    steps: [],
    index: 0,
    answers: {}, // qid -> value (shared across modes)
    lastError: "",
    pageErrors: {}, // page mode: qid -> errorText
        lastCardScrollTop: 0,
  };

  // Small UI-only state (not persisted)
  let uiState = {
    selectedArrayId: null,
    newArrayName: "",
    groupOptionsOpen: false,
    aiQuestionAssistOpen: {},
    aiQuestionAssistChats: {},
  };

    let inspectorAccordionState = {
    page: false,
    group: false,
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

  // Logic operators used across the builder (rules editor + AI capability contract).
  // The AI Assist reads this list to avoid generating unsupported operators.
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

      const normalized = {
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
            normalized.defaultAnswer = normalizeDefaultAnswerForQuestion({
        ...normalized,
        defaultAnswer: q.defaultAnswer,
      });

      return normalized;
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
             "id","type","title","help","placeholder","required","errorText","options","logic","content","defaultAnswer","display","followUp"
      ],
      groupFields: ["id","name","description","logic","questions"],
            pageFields: ["id","name","groups","flow","template"],
      textBlockFields: ["type","id","title","level","bodyHtml"],
      displayVariants: ["hero","bigPrice","info","divider"],
      logicOperators: OPERATORS.map(o => o.key),
      guidance: {
         intent: "Generate a realistic UK insurance quote journey appropriate to the requested line of business and context",

        qualityBar: "Best-in-class, believable, production-grade journey using real UK broker and aggregator patterns (without copying proprietary text)",

        strictness: "Assume this output will be demoed to a UK insurance broker tomorrow. It must look, read, and behave like a real live insurance journey with no placeholder gaps, thin option lists, or vague help text.",

        journeyDepth: {
          default: "Best-practice market standard",
          guidance: [
            "Optimise for speed only when the prompt explicitly implies a quick quote.",
            "Include full rating, eligibility, and compliance detail when appropriate to the journey.",
            "Never artificially shorten or simplify the journey unless explicitly instructed."
          ]
        },
        
         tone: "Broker-friendly, plain English, confident and clear (use standard UK insurance terminology where appropriate, but avoid unnecessary jargon)",

        outputRules: [
          "Use ONLY the provided schema and allowed components (pages, groups, questions, text blocks, and the approved display elements).",
          "Do NOT invent question types, fields, or components that are not supported by the framework.",
                  "Populate everything fully: titles, descriptions, help text, placeholders, required flags, defaults (including defaultAnswer), and validation hints.",
          "Structure content exactly as a real quote & buy journey would be structured — not a theoretical or simplified form.",
          "Use conditional logic and progressive disclosure where supported by the schema to keep the journey realistic and efficient.",
          "Never output TODOs, stubs, or placeholders (e.g., 'TBD', 'lorem ipsum', 'add options here')."
        ],

        hallucinationGuard: {
          rules: [
            "Do NOT invent regulatory requirements, FCA/ICO wording, or compliance statements. Use neutral, standard phrasing unless the prompt provides specific approved wording.",
            "Do NOT invent insurer-specific underwriting rules (e.g., 'we do not cover X' or 'must have Y alarm') unless explicitly provided by the prompt or by an allowed rules dataset.",
            "Do NOT invent pricing logic, premiums, discounts, or rating calculations.",
            "If something is normally product/insurer-specific (eligibility rules, endorsements, exact declarations, add-on availability), keep it generic and believable."
          ],
          safeFallbackStyle: [
            "Use language like 'This helps us confirm eligibility and calculate your quote' instead of asserting hard rules.",
            "For declarations, use generic attestations without referencing specific legal clauses."
          ]
        },

         realism: {
          journeyStyle: [
            "Begin with high-signal eligibility and rating-critical questions.",
            "Use logical sequencing and progressive disclosure to reduce cognitive load.",
            "Group questions as real insurer/aggregator journeys do (clear sections, short guidance text, sensible ordering).",
            "Include realistic friction points: assumptions, disclosures, declarations, and consent at the points they normally appear.",
            "If the framework supports it, include summary/playback and quote presentation patterns using the provided display elements."
          ],
          ukSpecific: [
            "Use UK address conventions (postcode-first lookup pattern where supported).",
            "Use UK insurance concepts appropriate to the line of business (terminology, cover options, excesses, common question sets).",
            "Use UK consent patterns (privacy notice acknowledgement, marketing consent, declarations) in a believable and minimal-friction way."
          ]
        },

    completeness: {
          defaultMode: "Comprehensive (as complete as it needs to be to feel real and best-practice for the LOB)",

          mustInclude: [
            "Detailed pages and groups with clear headings and short, helpful guidance text.",
            "Rich help text for non-obvious questions (what it means, why it matters, examples).",
            "Placeholders that look like real UI copy (e.g., 'e.g., AB12 3CD', 'e.g., 12,000').",
            "Required flags aligned to realistic rating/eligibility/compliance needs (don’t mark everything as required by default).",
            "Realistic option lists for selects/radios (include 'Other' only where it’s genuinely common).",
            "Validation nuance (bounds, formats, date windows, step values) where supported by the schema."
          ],

    optionLists: {
            principle: "No shortcuts on lists that materially affect realism.",
            requirement: [
              "When a question expects a known industry codelist (e.g., occupation, relationship, licence type, employment status, business type, property type), provide a comprehensive insurer-style list.",
              "If the framework supports external codelists, reference them properly using the schema method (preferred).",
              "If codelists must be embedded, include a large, realistic UK list (hundreds of entries where appropriate), not a tiny sample."
            ]
          }
        },

        modeling: "Use UK market patterns as inspiration (comparison sites and major carriers) but write original copy and options. Never copy proprietary wording.",

 assumptions: {
          whenPromptIsBrief: "Infer a best-practice journey for the requested line of business with all core sections for that LOB, realistic sequencing, and appropriate compliance/consent steps."
        },

  constraints: [
          "Do not add unsupported fields, question types, or components.",
          "Do not remove required compliance steps (consent/declarations) if the journey includes quote/buy.",
          "Do not over-collect: only ask for detail that is realistic for the journey depth and LOB context — but never simplify to the point it feels fake.",
          "Do not produce placeholder-only content (e.g., 'Option 1/2/3'). All options and help text must be meaningful and believable."
        ],

  displayElements: {
          instruction: "Use the provided display elements intentionally (hero/intro blocks, info boxes, key details summaries, quote/price components, playback blocks) to make screens feel like real insurance journeys, not just forms."
        },

        selfValidation: {
          instruction: "Before finalising output, run a self-check and silently fix issues.",
          checks: [
            "Schema compliance: every object matches the provided schema; no unknown fields or unsupported question types.",
            "Realism check: would a UK broker recognise this as a believable journey for the given LOB?",
            "Completeness check: no thin option lists where a realistic codelist is expected; no vague help text; required flags make sense.",
            "Flow check: pages/groups are logically ordered; progressive disclosure used where supported; no duplicated or contradictory questions.",
            "Copy check: original wording only; no proprietary text or brand-specific copy."
          ],
          fixPolicy: "If any check fails, revise the journey until all checks pass (without changing the user’s requested LOB or scope)."
        }
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

    function getQuestionAiState(questionId) {
    if (!questionId) return null;
    uiState.aiQuestionAssistChats = uiState.aiQuestionAssistChats || {};
    if (!uiState.aiQuestionAssistChats[questionId]) {
      uiState.aiQuestionAssistChats[questionId] = {
        messages: [],
        draft: "",
        status: "",
        loading: false,
        lastSuggestion: null,
      };
    }
    return uiState.aiQuestionAssistChats[questionId];
  }

  function extractJsonFromText(text) {
    if (!text) return null;
    const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (blockMatch?.[1]) {
      try { return JSON.parse(blockMatch[1]); } catch {}
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const slice = text.slice(start, end + 1);
      try { return JSON.parse(slice); } catch {}
    }
    return null;
  }

  function normalizeQuestionSuggestion(raw) {
    if (!raw || typeof raw !== "object") return null;
    const source = raw.suggestion && typeof raw.suggestion === "object" ? raw.suggestion : raw;
    const suggestion = {};
    const title = source.title || source.questionText;
    if (typeof title === "string" && title.trim()) suggestion.title = title.trim();
    const help = source.help || source.helperText || source.helpText;
    if (typeof help === "string") suggestion.help = help.trim();
    const placeholder = source.placeholder;
    if (typeof placeholder === "string") suggestion.placeholder = placeholder.trim();
    const errorText = source.errorText || source.errorMessage;
    if (typeof errorText === "string") suggestion.errorText = errorText.trim();
    const contentHtml = source.contentHtml || source.explanatoryContent || source.content;
    if (typeof contentHtml === "string" && contentHtml.trim()) {
      suggestion.contentHtml = contentHtml.trim();
    }
    const options = source.options || source.items || source.choices;
    if (Array.isArray(options)) {
      const cleaned = options.map((opt) => String(opt || "").trim()).filter(Boolean);
      if (cleaned.length) suggestion.options = cleaned;
    }
    if (typeof source.required === "boolean") suggestion.required = source.required;
    return Object.keys(suggestion).length ? suggestion : null;
  }

    function isLikelyJsonText(text) {
    const trimmed = String(text || "").trim();
    return trimmed.startsWith("{") || trimmed.startsWith("[");
  }

  function formatSuggestionSummary(suggestion, promptText) {
    if (!suggestion) return "";
    const parts = [];
    if (suggestion.title) parts.push(`Improved label: “${suggestion.title}”.`);
    if (suggestion.help != null && suggestion.help !== "") {
      parts.push(`Help text: “${suggestion.help}”.`);
    }
    if (suggestion.placeholder != null && suggestion.placeholder !== "") {
      parts.push(`Placeholder: “${suggestion.placeholder}”.`);
    }
    if (suggestion.errorText != null && suggestion.errorText !== "") {
      parts.push(`Validation advice: “${suggestion.errorText}”.`);
    }
    if (typeof suggestion.required === "boolean") {
      parts.push(suggestion.required ? "Marked the question as required." : "Marked the question as optional.");
    }
    if (Array.isArray(suggestion.options) && suggestion.options.length) {
      parts.push(`Option ideas: ${suggestion.options.map((opt) => `“${opt}”`).join(", ")}.`);
    }
    if (suggestion.contentHtml) {
      parts.push("Added explanatory content for builders or brokers.");
    }
    if (!parts.length) return "";
    const intro = promptText ? "Here’s a quick pass based on your prompt: " : "Here’s a quick pass: ";
    return `${intro}${parts.join(" ")}`;
  }

  function applyQuestionSuggestion(question, suggestion) {
    if (!question || !suggestion) return;
    if (suggestion.title) question.title = suggestion.title;
    if (suggestion.help != null) question.help = suggestion.help;
    if (suggestion.placeholder != null) question.placeholder = suggestion.placeholder;
    if (suggestion.errorText != null) question.errorText = suggestion.errorText;
    if (typeof suggestion.required === "boolean") question.required = suggestion.required;
    if (suggestion.options && isOptionType(question.type)) {
      question.options = suggestion.options;
      question.defaultAnswer = normalizeDefaultAnswerForQuestion(question);
    }
    if (suggestion.contentHtml) {
      question.content = question.content || { enabled: false, html: "" };
      question.content.enabled = true;
      question.content.html = sanitizeRichHtml(suggestion.contentHtml);
    }
  }

  async function requestAiQuestionAssist(promptText, question) {
    const AI_QUESTION_CAPABILITIES = {
      intent: "Question assist",
      questionTypes: ["text","textarea","number","currency","percent","email","tel","postcode","date","select","radio","checkboxes","yesno"],
      optionTypes: ["select","radio","checkboxes"],
      questionFields: ["title","help","placeholder","required","errorText","options","content"],
            responseGuidance:
        "Reply in conversational natural language (no JSON). You can include improved labels, help text, validation advice, alternative phrasing, warnings, or an explanation of why the question exists and how it affects pricing. Structured suggestions should live in the suggestion object only.",
      responseFormat: {
        message: "Short reply for the user",
        suggestion: {
          title: "string",
          help: "string",
          placeholder: "string",
          required: "boolean",
          errorText: "string",
          options: ["string"],
          contentHtml: "string"
        }
      }
    };

    const res = await fetch(AI_JOURNEY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: String(promptText || "").slice(0, 8000),
        builderCapabilities: AI_QUESTION_CAPABILITIES,
        schemaVersion: schema?.meta?.version || 1,
        questionContext: {
          title: question?.title || "",
          type: question?.type || "text",
          help: question?.help || "",
          placeholder: question?.placeholder || "",
          errorText: question?.errorText || "",
          options: Array.isArray(question?.options) ? question.options : [],
          content: question?.content?.html || ""
        }
      }),
    });

    const rawText = await res.text().catch(() => "");
    if (!res.ok) {
      console.error("AI HTTP error:", res.status, rawText);
      throw new Error(rawText || `AI request failed (${res.status})`);
    }

    let data = rawText;
    try { data = rawText ? JSON.parse(rawText) : {}; } catch {}

    let candidate = data;
    if (candidate && typeof candidate === "object") {
      candidate = candidate.result || candidate.reply || candidate.response || candidate;
    }
    if (typeof candidate === "string") {
      const extracted = extractJsonFromText(candidate);
      if (extracted) candidate = extracted;
    }

    let suggestion = normalizeQuestionSuggestion(candidate);
    if (!suggestion) {
      const extracted = extractJsonFromText(typeof data === "string" ? data : rawText);
      suggestion = normalizeQuestionSuggestion(extracted);
    }

    const candidateMessage =
      (data && typeof data === "object" && (data.message || data.summary)) ||
      (candidate && typeof candidate === "object" && (candidate.message || candidate.summary)) ||
      (typeof candidate === "string" ? candidate : "") ||
      String(rawText || "");

     const formattedSummary = formatSuggestionSummary(suggestion, promptText);
    const assistantText =
      (candidateMessage && !isLikelyJsonText(candidateMessage) && String(candidateMessage).trim()) ||
formattedSummary ||
      "I’ve drafted a few ideas you can apply to this question.";

    return { assistantText, suggestion };
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

    
    const ensureGroupBarStyles = () => {
      if (document.getElementById("ogGroupBarStyles")) return;
      const style = document.createElement("style");
      style.id = "ogGroupBarStyles";
      style.textContent = `
        .groupBar{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; margin:0 0 12px 0; border-radius:14px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); }
        .groupBarLeft{ display:flex; align-items:center; gap:12px; min-width:0; }
        .groupBarLabel{ font-weight:600; opacity:0.85; }
        .groupPills{ display:flex; gap:8px; flex-wrap:wrap; }
        .groupPill{ border:1px solid rgba(255,255,255,0.14); background:rgba(0,0,0,0.15); color:inherit; padding:6px 10px; border-radius:999px; cursor:pointer; font-size:13px; }
         .groupPill.isTextBlock{ border-style:dashed; color:rgba(255,255,255,0.82); background:rgba(255,255,255,0.04); }
        .groupPill.selected{ border-color: rgba(130,222,250,0.65); box-shadow: 0 0 0 3px rgba(130,222,250,0.12); }
        .groupBarRight{ display:flex; align-items:center; gap:8px; }
        .btn.tiny{ padding:6px 10px; min-width:36px; }
      `;
      document.head.appendChild(style);
    };
    ensureGroupBarStyles();

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

  // Page header controls (injected next to #pageNameDisplay)
  let pageHeaderControlsEl = null;
  let pageNameInputEl = null;
  let pageActionsRowEl = null;
  let pagePreviewSelectEl = null;

  // Group options now render inline in the Inspector

  const btnAddPage = $("#btnAddPage");
  const btnAddGroup = $("#btnAddGroup");
  const btnAddQuestion = $("#btnAddQuestion");
  const btnPreview = $("#btnPreview");
  const btnExport = $("#btnExport");
  const btnImport = $("#btnImport");
  const btnImportPages = $("#btnImportPages");
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

    // Allow explicit page selection (used by the header "Page settings" affordance)
    if (selection.blockType === "page" && selection.groupId == null) {
      selection.blockId = null;
      selection.questionId = null;
      return;
    }

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
      if (groupNameDisplayEl?.parentElement) {
      groupNameDisplayEl.parentElement.style.display = selection.blockType === "text" ? "none" : "";
    }

    renderPageHeaderControls();
  }



  function renderGroupOptionsPopover() {
    // no-op: group options now render inline in the Inspector (page -> group -> question)
  }

function ensurePageHeaderControls() {
    if (!pageNameDisplayEl || pageHeaderControlsEl) return;

    const parent = pageNameDisplayEl.parentElement;
    if (!parent) return;

    pageHeaderControlsEl = document.createElement("div");
    pageHeaderControlsEl.className = "pageHeaderControls";
    pageHeaderControlsEl.style.display = "flex";
    pageHeaderControlsEl.style.alignItems = "center";
    pageHeaderControlsEl.style.gap = "10px";
    pageHeaderControlsEl.style.marginTop = "8px";
    pageHeaderControlsEl.style.flexWrap = "wrap";

    // Inline page name editor (shown only when page is selected)
    pageNameInputEl = document.createElement("input");
    pageNameInputEl.type = "text";
    pageNameInputEl.className = "input";
    pageNameInputEl.style.maxWidth = "360px";
    pageNameInputEl.style.display = "none";
    pageNameInputEl.addEventListener("input", (e) => {
      const p = getPage(selection.pageId);
      if (!p) return;
      p.name = (e.target.value || "").trim() || "Untitled page";
      saveSchemaDebounced();
      renderPagesList();
      editorTitleEl.textContent = `Editor · ${p.name}`;
      pageNameDisplayEl.textContent = p.name;
    });
    pageNameInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Exit page edit mode back to group selection if possible
        const p = getPage(selection.pageId);
        const firstGroup = p?.groups?.[0]?.id || null;
        selection.groupId = firstGroup;
        selection.questionId = null;
        selection.blockType = "group";
        renderAll(true);
      }
    });

    // Page actions (export/import)
    pageActionsRowEl = document.createElement("div");
    pageActionsRowEl.className = "row";
    pageActionsRowEl.style.display = "flex";
    pageActionsRowEl.style.gap = "8px";
    pageActionsRowEl.style.flexWrap = "wrap";
    pageActionsRowEl.style.display = "none";

    const btnExportPage = document.createElement("button");
    btnExportPage.type = "button";
    btnExportPage.className = "btn ghost";
    btnExportPage.textContent = "Export pages";
    btnExportPage.addEventListener("click", () => {
      const p = getPage(selection.pageId);
      if (!p) return;
      exportPageJson(p.id);
    });

    const btnImportPage = document.createElement("button");
    btnImportPage.type = "button";
    btnImportPage.className = "btn ghost";
    btnImportPage.textContent = "Import pages";
    btnImportPage.addEventListener("click", () => {
      const p = getPage(selection.pageId);
      if (!p) return;
      importPageJsonInto(p.id);
    });

    pageActionsRowEl.appendChild(btnExportPage);
    pageActionsRowEl.appendChild(btnImportPage);

    // Preview mode (only shown when page is selected)
    pagePreviewSelectEl = document.createElement("select");
    pagePreviewSelectEl.className = "input";
    pagePreviewSelectEl.style.maxWidth = "260px";
    pagePreviewSelectEl.style.display = "none";
    pagePreviewSelectEl.innerHTML = `
      <option value="question">Question-by-question (Typeform)</option>
      <option value="page">Page-at-a-time (layout)</option>
    `;
    pagePreviewSelectEl.addEventListener("change", (e) => {
      preview.mode = e.target.value;
      schema.meta = schema.meta || {};
      schema.meta.previewMode = preview.mode;
      saveSchema();
    });

    // Insert controls directly after the page name display
    parent.appendChild(pageHeaderControlsEl);
    pageHeaderControlsEl.appendChild(pageNameInputEl);
    pageHeaderControlsEl.appendChild(pagePreviewSelectEl);
    pageHeaderControlsEl.appendChild(pageActionsRowEl);

    // Allow selecting the page from the header label
    pageNameDisplayEl.style.cursor = "pointer";
    pageNameDisplayEl.title = "Click to edit page settings";
    pageNameDisplayEl.addEventListener("click", () => {
      selection.blockType = "page";
      selection.blockId = null;
      selection.groupId = null;
      selection.questionId = null;
      renderAll(true);
      // Focus name input after render
      setTimeout(() => {
        pageNameInputEl?.focus();
        pageNameInputEl?.select();
      }, 0);
    });
  }

  function renderPageHeaderControls() {
    // Page settings live in the inspector now; keep the header display-only.
    ensurePageHeaderControls();
    if (pageNameInputEl) pageNameInputEl.style.display = "none";
    if (pageActionsRowEl) pageActionsRowEl.style.display = "none";
    if (pagePreviewSelectEl) pagePreviewSelectEl.style.display = "none";
  }

  function renderPagesList() {
    /* ----------------------------------------------------------------------
    CH 4.1  Left nav (page list)

    Pages are rendered in the order they exist in schema.pages.
    Quote/Summary/Payment are no longer fixed system pages — import them if needed.
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

    const pages = Array.isArray(schema.pages) ? schema.pages : [];

    const renderPageItem = (p, pIdx) => {
      p.flow = Array.isArray(p.flow) ? p.flow : (p.groups || []).map((g) => ({ type: "group", id: g.id }));

      const pageDiv = document.createElement("div");
      pageDiv.className =
        "pageItem" +
        (p.id === selection.pageId ? " active" : "") +
        ` tpl-${String(p.template || "form").toLowerCase()}`;

      // Expose template to CSS selectors (templates can be set via imported JSON)
      pageDiv.dataset.pageTemplate = String(p.template || "form").toLowerCase();

      // Make page draggable (builder-only)
      pageDiv.draggable = !preview.open;
      pageDiv.dataset.pageId = p.id;
      pageDiv.dataset.pageIndex = String(pIdx);

      pageDiv.addEventListener("dragstart", (e) => {
        if (preview.open) {
          e.preventDefault();
          return;
        }
        if (!canStartDragFrom(e.target)) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/og-page", p.id);
        e.dataTransfer.setData("text/og-page-index", String(pIdx));
        pageDiv.classList.add("isDragging");
        isDraggingUI = true;
      });

      pageDiv.addEventListener("dragend", () => {
        pageDiv.classList.remove("isDragging");
        isDraggingUI = false;
      });

      pageDiv.addEventListener("dragover", (e) => {
        if (!e.dataTransfer.types.includes("text/og-page")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        pageDiv.classList.add("isDragOver");
      });

      pageDiv.addEventListener("dragleave", () => {
        pageDiv.classList.remove("isDragOver");
      });

      pageDiv.addEventListener("drop", (e) => {
        if (!e.dataTransfer.types.includes("text/og-page")) return;
        e.preventDefault();
        pageDiv.classList.remove("isDragOver");

        const fromIdx = Number(e.dataTransfer.getData("text/og-page-index"));
        const toIdx = Number(pageDiv.dataset.pageIndex);
        if (!Number.isFinite(fromIdx) || !Number.isFinite(toIdx)) return;
        if (fromIdx === toIdx) return;

        moveItem(schema.pages, fromIdx, toIdx);
        saveSchema();
        renderAll();
      });

      const top = document.createElement("div");
      top.className = "pageTop";

      const left = document.createElement("div");
      left.className = "pageLeft";

      const name = document.createElement("div");
      name.className = "pageName";
      name.contentEditable = String(!preview.open);
      name.spellcheck = false;
      name.textContent = p.name;

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

      left.appendChild(name);

      const actions = document.createElement("div");
      actions.className = "pageActions";

      const renameBtn = iconButton("✎", "Rename page");
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        name.focus();
        requestAnimationFrame(() => selectAllContent(name));
      });

      const upBtn = iconButton("↑", "Move up");
      upBtn.disabled = pIdx === 0;
      upBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveItem(schema.pages, pIdx, pIdx - 1);
        saveSchema();
        renderAll();
      });

      const downBtn = iconButton("↓", "Move down");
      downBtn.disabled = pIdx === pages.length - 1;
      downBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveItem(schema.pages, pIdx, pIdx + 1);
        saveSchema();
        renderAll();
      });

      const delBtn = iconButton("✕", "Delete page");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${p.name}"?`)) return;

        const idx = schema.pages.findIndex((x) => x.id === p.id);
        if (idx >= 0) schema.pages.splice(idx, 1);

        ensureSelection();
        saveSchema();
        renderAll();
      });

      actions.appendChild(renameBtn);
      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
      actions.appendChild(delBtn);

      top.appendChild(left);
      top.appendChild(actions);
      pageDiv.appendChild(top);

      // click page selects it (default to first flow item)
      pageDiv.addEventListener("click", () => {
        if (isDraggingUI) return;
        selection.pageId = p.id;

        const first = (p.flow || [])[0];
        if (first && first.type === "text") {
          selection.blockType = "text";
          selection.blockId = first.id;
          selection.groupId = null;
          selection.questionId = null;
        } else {
          const g0 = (p.groups || []).find((gg) => gg.id === first?.id) || (p.groups || [])[0];
          selection.blockType = "group";
          selection.blockId = g0?.id || null;
          selection.groupId = g0?.id || null;
          selection.questionId = g0?.questions?.[0]?.id || null;
        }
        renderAll();
      });

      pagesListEl.appendChild(pageDiv);
    };

    pages.forEach((p, idx) => renderPageItem(p, idx));
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


    // --- Group switcher bar (tabs) + quick actions ---
    const groupBar = document.createElement("div");
    groupBar.className = "groupBar";

    const groupBarLeft = document.createElement("div");
    groupBarLeft.className = "groupBarLeft";

    const groupBarLabel = document.createElement("div");
    groupBarLabel.className = "groupBarLabel";
    groupBarLabel.textContent = "Groups";

    const groupPills = document.createElement("div");
    groupPills.className = "groupPills";

       const flowItems = Array.isArray(p.flow) ? p.flow : p.groups.map((g) => ({ type: "group", id: g.id }));
    flowItems.forEach((item) => {
      if (!item || typeof item !== "object") return;
      if (item.type === "group") {
        const gg = (p.groups || []).find((g) => g.id === item.id);
        if (!gg) return;
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "groupPill" + (selection.blockType === "group" && selection.blockId === gg.id ? " selected" : "");
        pill.textContent = gg.name || "Group";
        pill.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          selection.pageId = p.id;
          selection.blockType = "group";
          selection.blockId = gg.id;
          selection.groupId = gg.id;
          selection.questionId = null;
          saveSchema();
          renderAll(true);
        });
        groupPills.appendChild(pill);
        return;
      }

      if (item.type === "text") {
        const pill = document.createElement("button");
        const rawLabel = item.title?.trim() || "Text block";
        const label = rawLabel.length > 7 ? `${rawLabel.slice(0, 4)}...` : rawLabel;
        pill.type = "button";
        pill.className = "groupPill isTextBlock" + (selection.blockType === "text" && selection.blockId === item.id ? " selected" : "");
        pill.textContent = label;
        pill.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          selection.pageId = p.id;
          selection.blockType = "text";
          selection.blockId = item.id;
          selection.groupId = null;
          selection.questionId = null;
          saveSchema();
          renderAll(true);
        });
        groupPills.appendChild(pill);
      }
    });

    groupBarLeft.appendChild(groupBarLabel);
    groupBarLeft.appendChild(groupPills);

    const groupBarRight = document.createElement("div");
    groupBarRight.className = "groupBarRight";

    // Reorder buttons (like before)
    const btnUp = document.createElement("button");
    btnUp.type = "button";
    btnUp.className = "btn ghost tiny";
    btnUp.textContent = "↑";
    btnUp.title = "Move item up";
    const selectedFlowIndex = selection.blockId ? flowItems.findIndex((x) => x.id === selection.blockId) : -1;
    btnUp.disabled = selectedFlowIndex <= 0;
    btnUp.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (selection.blockId) moveFlowItem(p.id, selection.blockId, -1);
    });

    const btnDown = document.createElement("button");
    btnDown.type = "button";
    btnDown.className = "btn ghost tiny";
    btnDown.textContent = "↓";
     btnDown.title = "Move item down";
    btnDown.disabled = selectedFlowIndex < 0 || selectedFlowIndex >= flowItems.length - 1;
    btnDown.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (selection.blockId) moveFlowItem(p.id, selection.blockId, +1);
    });

    const btnAddGroup = document.createElement("button");
    btnAddGroup.type = "button";
    btnAddGroup.className = "btn ghost";
    btnAddGroup.textContent = "+ Add new group";
    btnAddGroup.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      addGroupToPage(p.id);
    });

    const btnAddText = document.createElement("button");
    btnAddText.type = "button";
    btnAddText.className = "btn ghost";
    btnAddText.textContent = "+ Text block";
    btnAddText.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      addTextBlockToPage(p.id);
    });

    groupBarRight.appendChild(btnUp);
    groupBarRight.appendChild(btnDown);
    groupBarRight.appendChild(btnAddGroup);
    groupBarRight.appendChild(btnAddText);

    groupBar.appendChild(groupBarLeft);
    groupBar.appendChild(groupBarRight);
    canvasEl.appendChild(groupBar);

        // Phase 1: if a text block is selected, show an editor card
    if (selection.blockType === "text") {
      const tb = (p.flow || []).find((x) => x.type === "text" && x.id === selection.blockId);

      const card = document.createElement("div");
        card.className = "textBlockEditor";

            const header = document.createElement("div");
      header.className = "textBlockHeader";
      const textBlockTitle = tb?.title?.trim() || "Untitled";
      header.innerHTML = `<div class="textBlockTitle">📝 Text Block: ${escapeHtml(textBlockTitle)}</div>`;

            const hint = document.createElement("div");
      hint.className = "muted";
            hint.textContent = "Edit the rich text content and title below.";

            const titleField = fieldText("Title", tb?.title || "", (val) => {
        if (!tb) return;
        tb.title = val;
        saveSchemaDebounced();
      });

      const levelField = fieldSelect("Heading level", tb?.level || "h3", [
        { value: "h1", label: "H1" },
        { value: "h2", label: "H2" },
        { value: "h3", label: "H3" },
        { value: "h4", label: "H4" },
        { value: "p", label: "Paragraph" },
      ], (val) => {
        if (!tb) return;
        tb.level = val;
        saveSchemaDebounced();
      });

      const bodyField = richTextEditor("Body", tb?.bodyHtml || "<p></p>", (html) => {
        if (!tb) return;
        tb.bodyHtml = sanitizeRichHtml(html);
        saveSchemaDebounced();
      });

      card.appendChild(header);
      card.appendChild(hint);
      card.appendChild(titleField);
      card.appendChild(levelField);
      card.appendChild(bodyField);

      canvasEl.appendChild(card);
      return;
    }

    // If the page itself is selected (no group), show a simple page overview
    if (selection.groupId == null) {
      const card = document.createElement("div");
      card.className = "tip";
      card.innerHTML = `
        <div class="tipTitle">Page settings</div>
        <p class="muted">You’re editing the page. Click a group below to edit its questions.</p>
      `;
      canvasEl.appendChild(card);

      const list = document.createElement("div");
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "8px";
      list.style.marginTop = "10px";

      (p.groups || []).forEach((gg) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "btn ghost";
        row.style.justifyContent = "flex-start";
        row.textContent = gg.name || "Untitled group";
        row.addEventListener("click", () => {
          selection.groupId = gg.id;
          selection.questionId = null;
          selection.blockType = "group";
          renderAll(true);
        });
        list.appendChild(row);
      });
      canvasEl.appendChild(list);

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "10px";
      actions.style.marginTop = "14px";
      actions.style.justifyContent = "flex-end";

      const btnAddG = document.createElement("button");
      btnAddG.type = "button";
      btnAddG.className = "btn primary";
      btnAddG.textContent = "+ Group";
      btnAddG.addEventListener("click", () => addGroupToPage(p.id));

      const btnAddT = document.createElement("button");
      btnAddT.type = "button";
      btnAddT.className = "btn ghost";
      btnAddT.textContent = "+ Text block";
      btnAddT.addEventListener("click", () => addTextBlockToPage(p.id));

            const btnGroupOpts = document.createElement("button");
      btnGroupOpts.type = "button";
      btnGroupOpts.className = "btn ghost";
      btnGroupOpts.textContent = "Group options";
      btnGroupOpts.addEventListener("click", () => {
        uiState.groupOptionsOpen = !uiState.groupOptionsOpen;
        // Ensure we have a current group context
        const gCtx = selection.groupId || (p.groups || [])[0]?.id || null;
        if (gCtx) selection.groupId = gCtx;
        renderAll(true);
      });

actions.appendChild(btnGroupOpts);
      actions.appendChild(btnAddT);
      actions.appendChild(btnAddG);
      canvasEl.appendChild(actions);
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
    pageTitle.style.cursor = "pointer";
    pageTitle.title = "Click to edit page settings";
    pageTitle.addEventListener("click", () => {
      selection.blockType = "page";
      selection.blockId = null;
      selection.groupId = null;
      selection.questionId = null;
      renderAll(true);
      setTimeout(() => {
        pageNameInputEl?.focus();
        pageNameInputEl?.select();
      }, 0);
    });

    const isGroupSelected = selection.groupId === g.id && selection.questionId == null && selection.blockType === "group";

    let groupTitle;
    if (isGroupSelected) {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "input canvasGroupTitle";
      inp.value = g.name || "";
      inp.placeholder = "Group name";
      inp.addEventListener("input", (e) => {
        g.name = (e.target.value || "").trim() || "Untitled group";
        saveSchemaDebounced();
        groupNameDisplayEl.textContent = g.name;
        renderPagesList();
      });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          // Move focus into the first question for faster editing
          selection.questionId = g.questions?.[0]?.id || null;
          renderAll(true);
        }
      });
      groupTitle = inp;
    } else {
      const div = document.createElement("div");
      div.className = "canvasGroupTitle";
      div.textContent = g.name || "Untitled group";
      div.style.cursor = "pointer";
      div.title = "Click to edit group settings";
      div.addEventListener("click", () => {
        selection.blockType = "group";
        selection.blockId = g.id;
        selection.groupId = g.id;
        selection.questionId = null;
        renderAll(true);
      });
      groupTitle = div;
    }

    canvasHeader.appendChild(pageTitle);
    canvasHeader.appendChild(groupTitle);

    // Group-level quick actions (live on the group container, not the inspector)
    const groupActions = document.createElement("div");
    groupActions.className = "canvasGroupActions";
    groupActions.style.display = "flex";
    groupActions.style.gap = "8px";
    groupActions.style.marginTop = "10px";

    const btnGUp = document.createElement("button");
    btnGUp.type = "button";
    btnGUp.className = "btn ghost";
    btnGUp.textContent = "Move group up";
    btnGUp.addEventListener("click", () => moveGroup(p.id, g.id, -1));

    const btnGDown = document.createElement("button");
    btnGDown.type = "button";
    btnGDown.className = "btn ghost";
    btnGDown.textContent = "Move group down";
    btnGDown.addEventListener("click", () => moveGroup(p.id, g.id, +1));

    const btnGDel = document.createElement("button");
    btnGDel.type = "button";
    btnGDel.className = "btn ghost";
    btnGDel.textContent = "Delete group";
    btnGDel.addEventListener("click", () => {
      if (!confirm(`Delete group "${g.name}"?`)) return;
      deleteGroupFromPage(p.id, g.id);
    });

    groupActions.appendChild(btnGUp);
    groupActions.appendChild(btnGDown);
    groupActions.appendChild(btnGDel);
    canvasHeader.appendChild(groupActions);

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

      const btnDisplay = document.createElement("button");
      btnDisplay.type = "button";
      btnDisplay.className = "btn ghost";
      btnDisplay.textContent = "+ Display";
      btnDisplay.addEventListener("click", () => addDisplayElement("bigPrice"));
      
      wrap.style.gap = "10px";
      wrap.appendChild(btnDisplay);
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
            title.textContent = q.type === "display"
        ? getDisplayCardTitle(q.display)
        : (q.title || "Untitled question");

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
    // Note: group/question depend on selection; we still show sections in a natural hierarchy.
    const g = getGroup(selection.pageId, selection.groupId);
    const q = getQuestion(selection.pageId, selection.groupId, selection.questionId);

    if (!p) {
      inspectorSubEl.textContent = "Create a page to get started";
      return;
    }

    // -------------------------
    // PAGE (always shown first)
    // -------------------------
    inspectorSubEl.textContent =
      selection.blockType === "text" ? "Editing text block" :
      selection.questionId ? "Editing question" :
      selection.groupId ? "Editing group" :
      "Editing page";

    const pageAccordion = inspectorAccordion("Page", "page");
    inspectorEl.appendChild(pageAccordion.details);

    // Page name
    pageAccordion.body.appendChild(fieldText("Page name", p.name || "", (val) => {
      p.name = val || "Untitled page";
      saveSchemaDebounced();
      renderPagesList();
      renderCanvas();
      renderPageHeader(); // keep header display in sync
    }));

    // Page actions (template workflow)
    pageAccordion.body.appendChild(buttonRow([
      { label: "Export pages", kind: "ghost", onClick: () => exportPageJson(p.id) },
    ]));

    pageAccordion.body.appendChild(divider());

            if (selection.blockType === "text") {
      const tb = (p.flow || []).find((x) => x.type === "text" && x.id === selection.blockId);
      inspectorEl.appendChild(sectionTitle("Text block"));
      inspectorEl.appendChild(pEl("Text blocks are edited directly in the canvas.", "inlineHelp"));
       inspectorEl.appendChild(buttonRow([
        { label: "Move text block up", kind: "ghost", onClick: () => {
            if (!tb) return;
            moveFlowItem(p.id, tb.id, -1);
          } 
        },
        { label: "Move text block down", kind: "ghost", onClick: () => {
            if (!tb) return;
            moveFlowItem(p.id, tb.id, +1);
          } 
        },
      ]));
      inspectorEl.appendChild(buttonRow([
        { label: "Delete text block", kind: "danger", onClick: () => {
            if (!tb) return;
            if (!confirm("Delete this text block?")) return;
            deleteFlowItem(p.id, tb.id);
          } 
        },
      ]));
      return;
    }

    // -------------------------
    // GROUP (shown when a group is selected)
    // -------------------------
    const groupAccordion = inspectorAccordion("Group", "group");
    inspectorEl.appendChild(groupAccordion.details);

    if (!g) {
      groupAccordion.body.appendChild(pEl("Select a group in the canvas, or add a new one.", "inlineHelp"));
      groupAccordion.body.appendChild(buttonRow([
        { label: "+ Group", kind: "primary", onClick: () => addGroupToPage(p.id) },
      ]));
      return;
    }

    // Group name
    groupAccordion.body.appendChild(fieldText("Group name", g.name || "", (val) => {
      g.name = val || "Untitled group";
      saveSchemaDebounced();
      renderCanvas();
      renderPagesList();
      renderGroupHeader(); // keep header display in sync
    }));

    // Group description
    g.description = g.description || { enabled: false, html: "" };
    groupAccordion.body.appendChild(toggleRow("Add group description", g.description.enabled === true, (on) => {
      g.description.enabled = on;
      if (!g.description.html) g.description.html = "<p></p>";
      saveSchema();
      isTypingInspector = false;
      renderAll(true);
    }));

    if (g.description.enabled) {
      groupAccordion.body.appendChild(richTextEditor("Description", g.description.html || "<p></p>", (html) => {
        g.description.html = sanitizeRichHtml(html);
        saveSchemaDebounced();
      }));
    }

    // Group visibility / logic
        groupAccordion.body.appendChild(divider());
    groupAccordion.body.appendChild(sectionTitle("Group visibility"));
    groupAccordion.body.appendChild(pEl("Show this group only if the rule(s) match. (Hides all questions in the group in Preview)", "inlineHelp"));

    groupAccordion.body.appendChild(toggleRow("Enable group logic", g.logic?.enabled === true, (on) => {
      g.logic = g.logic || { enabled: false, rules: [] };
      g.logic.enabled = on;
      saveSchema();
      isTypingInspector = false;
      renderAll(true);
    }));

    if (g.logic?.enabled) {
          groupAccordion.body.appendChild(groupLogicEditor(schema, p, g));
    }

    // Group order / delete (kept here to avoid accidental clicks while editing questions)
    groupAccordion.body.appendChild(divider());
    groupAccordion.body.appendChild(buttonRow([
      { label: "Move group up", kind: "ghost", onClick: () => moveGroup(p.id, g.id, -1) },
      { label: "Move group down", kind: "ghost", onClick: () => moveGroup(p.id, g.id, +1) },
    ]));
    groupAccordion.body.appendChild(buttonRow([
      { label: "Delete group", kind: "danger", onClick: () => {
          if (!confirm(`Delete group "${g.name}"?`)) return;
          deleteGroupFromPage(p.id, g.id);
        } 
      },
    ]));

    groupAccordion.body.appendChild(divider());

    // -------------------------
    // QUESTION / TEXT BLOCK (shown last)
    // -------------------------

    // Text block inspector (page-level content block)
    if (selection.blockType === "text") {
      const tb = (p.flow || []).find((x) => x.type === "text" && x.id === selection.blockId);
      inspectorEl.appendChild(sectionTitle("Text block"));

      inspectorEl.appendChild(fieldText("Title", tb?.title || "", (val) => {
        if (!tb) return;
        tb.title = val;
        saveSchemaDebounced();
        renderPagesList();
        renderCanvas();
      }));

      inspectorEl.appendChild(fieldSelect("Heading level", tb?.level || "h2", [
        { value: "h1", label: "H1" },
        { value: "h2", label: "H2" },
        { value: "h3", label: "H3" },
        { value: "h4", label: "H4" },
        { value: "p", label: "Paragraph" },
      ], (val) => {
        if (!tb) return;
        tb.level = val;
        saveSchemaDebounced();
        renderPagesList();
        renderCanvas();
      }));

      inspectorEl.appendChild(richTextEditor("Body", tb?.bodyHtml || "<p></p>", (html) => {
        if (!tb) return;
        tb.bodyHtml = sanitizeRichHtml(html);
        saveSchemaDebounced();
        renderCanvas();
      }));

      inspectorEl.appendChild(divider());
      inspectorEl.appendChild(buttonRow([
        { label: "Delete text block", kind: "danger", onClick: () => {
            if (!tb) return;
            if (!confirm("Delete this text block?")) return;
            deleteFlowItem(p.id, tb.id);
          } 
        },
      ]));
      
      return;
    }

        const inspectorTitle = q?.type === "display" ? "Display" : "Question";
    
    // If no question selected
    if (!q) {
            inspectorEl.appendChild(sectionTitle(inspectorTitle));
      inspectorEl.appendChild(pEl("Select a question in the canvas to edit its settings.", "inlineHelp"));
      return;
    }

    // Question inspector (existing behaviour)
        inspectorEl.appendChild(sectionTitle(inspectorTitle));

    // Display elements should not show question-only fields
    if (q.type !== "display") {
            inspectorEl.appendChild(questionAssistPanel(q));

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

      // Explanatory content
      q.content = q.content || { enabled: false, html: "" };
      inspectorEl.appendChild(toggleRow("Add explanatory content", q.content.enabled === true, (on) => {
        q.content.enabled = on;
        if (!q.content.html) q.content.html = "<p></p>";
        saveSchema();
        isTypingInspector = false;
        renderAll(true);
      }));

      if (q.content.enabled) {
        inspectorEl.appendChild(richTextEditor("Explanatory content", q.content.html || "<p></p>", (html) => {
          q.content.html = sanitizeRichHtml(html);
          saveSchemaDebounced();
        }));
      }

      // Question type / placeholder
      inspectorEl.appendChild(divider());
      inspectorEl.appendChild(fieldSelect("Type", q.type || "text", QUESTION_TYPES, (val) => {
        q.type = val;
                q.defaultAnswer = null;
        // Reset type-specific
        if (val === "radio" || val === "select" || val === "checkboxes") {
          q.options = q.options && q.options.length ? q.options : ["Option 1", "Option 2"];
        }
        saveSchema();
        isTypingInspector = false;
        renderAll(true);
      }));

      if (q.type === "text" || q.type === "currency" || q.type === "number" || q.type === "date") {
        inspectorEl.appendChild(fieldText("Placeholder", q.placeholder || "", (val) => {
          q.placeholder = val;
          saveSchemaDebounced();
          renderCanvas();
        }));
      }

      if (isOptionType(q.type)) {
        inspectorEl.appendChild(divider());
        inspectorEl.appendChild(sectionTitle("Options"));
        inspectorEl.appendChild(optionsEditor(q));
      }

      if (q.type === "yesno" || isOptionType(q.type)) {
        inspectorEl.appendChild(divider());
        inspectorEl.appendChild(sectionTitle("Default answer"));
        inspectorEl.appendChild(pEl("Choose an option to preselect in Preview.", "inlineHelp"));
        inspectorEl.appendChild(defaultAnswerEditor(q));
      }

      if (q.type === "yesno" || isOptionType(q.type)) {
        q.followUp = q.followUp || {
          enabled: false,
          triggerValue: "Yes",
          name: "",
          questions: [],
          repeat: { enabled: false, min: 1, max: 5, addLabel: "Add another", itemLabel: "Item" },
        };
        q.followUp.repeat = q.followUp.repeat || {
          enabled: false,
          min: 1,
          max: 5,
          addLabel: "Add another",
          itemLabel: "Item",
        };

        inspectorEl.appendChild(divider());
        inspectorEl.appendChild(sectionTitle("Follow-up questions"));
        inspectorEl.appendChild(pEl("Add nested questions that appear when this answer is selected.", "inlineHelp"));

        inspectorEl.appendChild(toggleRow("Enable follow-up questions", q.followUp.enabled === true, (on) => {
          q.followUp.enabled = on;
          saveSchema();
          isTypingInspector = false;
          renderAll(true);
        }));

        if (q.followUp.enabled) {
          const triggerOptions = q.type === "yesno" ? ["Yes", "No"] : q.options || [];
          inspectorEl.appendChild(
            fieldSelect(
              "Show when answer is",
              q.followUp.triggerValue || "",
              triggerOptions.length
                ? triggerOptions.map((opt) => ({ value: opt, label: opt }))
                : [{ value: "", label: "Add options first" }],
              (val) => {
                q.followUp.triggerValue = val;
                saveSchemaDebounced();
              }
            )
          );

          inspectorEl.appendChild(fieldText("Section title", q.followUp.name || "", (val) => {
            q.followUp.name = val;
            saveSchemaDebounced();
          }));

          inspectorEl.appendChild(toggleRow("Allow multiple sets", q.followUp.repeat.enabled === true, (on) => {
            q.followUp.repeat.enabled = on;
            saveSchema();
            isTypingInspector = false;
            renderAll(true);
          }));

          if (q.followUp.repeat.enabled) {
            inspectorEl.appendChild(fieldText("Min items", String(q.followUp.repeat.min ?? 1), (val) => {
              q.followUp.repeat.min = clamp(Number(val || 0), 0, 50);
              if (q.followUp.repeat.max < q.followUp.repeat.min) {
                q.followUp.repeat.max = q.followUp.repeat.min;
              }
              saveSchemaDebounced();
            }));

            inspectorEl.appendChild(fieldText("Max items", String(q.followUp.repeat.max ?? 5), (val) => {
              q.followUp.repeat.max = clamp(Number(val || 0), 0, 50);
              if (q.followUp.repeat.max < q.followUp.repeat.min) {
                q.followUp.repeat.min = q.followUp.repeat.max;
              }
              saveSchemaDebounced();
            }));

            inspectorEl.appendChild(fieldText("Add button label", q.followUp.repeat.addLabel || "Add another", (val) => {
              q.followUp.repeat.addLabel = val;
              saveSchemaDebounced();
            }));

            inspectorEl.appendChild(fieldText("Item label", q.followUp.repeat.itemLabel || "Item", (val) => {
              q.followUp.repeat.itemLabel = val;
              saveSchemaDebounced();
            }));
          }

          inspectorEl.appendChild(divider());
          inspectorEl.appendChild(followUpQuestionsEditor(q));
        }
      }

      // Required
      inspectorEl.appendChild(divider());
      inspectorEl.appendChild(toggleRow("Required", q.required === true, (on) => {
        q.required = on;
        if (q.required && !q.errorText) q.errorText = "This field is required.";
        saveSchema();
        renderAll(true);
      }));

      if (q.required) {
        inspectorEl.appendChild(fieldTextArea("Error message", q.errorText || "This field is required.", (val) => {
          q.errorText = val;
          saveSchemaDebounced();
        }));
      }

      // Question visibility logic
      inspectorEl.appendChild(divider());
      inspectorEl.appendChild(sectionTitle("Question visibility"));
      inspectorEl.appendChild(pEl("Show this question only if the rule(s) match.", "inlineHelp"));

      inspectorEl.appendChild(toggleRow("Enable question logic", q.logic?.enabled === true, (on) => {
        q.logic = q.logic || { enabled: false, rules: [] };
        q.logic.enabled = on;
        saveSchema();
        isTypingInspector = false;
        renderAll(true);
      }));

      if (q.logic?.enabled) {
        inspectorEl.appendChild(logicEditor(p, q));
      }

      return;
    }

    // Display element inspector
    q.display = q.display || { variant: "info", tone: "neutral", title: "", subtitle: "", bodyHtml: "<p></p>" };
    q.display.variant = normalizeDisplayVariant(q.display.variant);
        if (!displaySupportsTone(q.display.variant)) {
      q.display.tone = "neutral";
    }
    
    inspectorEl.appendChild(fieldSelect("Variant", q.display.variant || "info", [
      { value: "info", label: "Alert" },
      { value: "bigPrice", label: "Big price" },
      { value: "hero", label: "Hero" },
      { value: "divider", label: "Divider" },
    ], (val) => {
            const previous = normalizeDisplayVariant(q.display.variant);
      const next = normalizeDisplayVariant(val);
      if (previous !== next) {
        q.display = applyDisplayDefaults(q.display, next);
      } else {
        q.display.variant = next;
      }
            if (!displaySupportsTone(next)) {
        q.display.tone = "neutral";
      }
      saveSchema();
      isTypingInspector = false;
      renderAll(true);
    }));

          if (displaySupportsTone(q.display.variant)) {
      inspectorEl.appendChild(fieldSelect("Tone", q.display.tone || "neutral", [
        { value: "neutral", label: "Neutral" },
        { value: "info", label: "Info" },
        { value: "success", label: "Success" },
        { value: "warning", label: "Warning" },
        { value: "danger", label: "Danger" },
      ], (val) => {
        q.display.tone = val;
        saveSchemaDebounced();
        renderCanvas();
      }));
    }

       const isDivider = q.display.variant === "divider";
    if (!isDivider) {
      inspectorEl.appendChild(fieldText("Title", q.display.title || "", (val) => {
        q.display.title = val;
        saveSchemaDebounced();
        renderCanvas();
        renderPagesList();
      }));

     inspectorEl.appendChild(fieldText("Subtitle", q.display.subtitle || "", (val) => {
        q.display.subtitle = val;
        saveSchemaDebounced();
        renderCanvas();
      }));

       inspectorEl.appendChild(richTextEditor("Body", q.display.bodyHtml || "<p></p>", (html) => {
        q.display.bodyHtml = sanitizeRichHtml(html);
        saveSchemaDebounced();
        renderCanvas();
      }));
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
    function inspectorAccordion(title, key) {
    const details = document.createElement("details");
    details.className = "inspectorAccordion";
    details.open = Boolean(inspectorAccordionState[key]);

    const summary = document.createElement("summary");
    summary.className = "inspectorAccordion__summary";

    const label = document.createElement("span");
    label.textContent = title;

    const chevron = document.createElement("span");
    chevron.className = "inspectorAccordion__chevron";
    chevron.textContent = "＋";

    summary.appendChild(label);
    summary.appendChild(chevron);
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "inspectorAccordion__body";
    details.appendChild(body);

    details.addEventListener("toggle", () => {
      inspectorAccordionState[key] = details.open;
    });

    return { details, body };
  }

  function sectionTitle(text) {
    const d = document.createElement("div");
    d.className = "sectionTitle";
    d.textContent = text;
    return d;
  }

   function sectionTitleRow(titleText, actions = []) {
    const row = document.createElement("div");
    row.className = "sectionTitleRow";
    const title = document.createElement("div");
    title.className = "sectionTitle";
    title.textContent = titleText;
    const actionsWrap = document.createElement("div");
    actionsWrap.className = "sectionTitleActions";
    actions.forEach((action) => actionsWrap.appendChild(action));
    row.appendChild(title);
    row.appendChild(actionsWrap);
    return row;
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
    toolbar.appendChild(mkBtn("1.", "Numbered list", "insertOrderedList"));
    toolbar.appendChild(mkBtn("↤", "Align left", "justifyLeft"));
    toolbar.appendChild(mkBtn("↔", "Align centre", "justifyCenter"));
    toolbar.appendChild(mkBtn("↦", "Align right", "justifyRight"));

    // Link helpers
    const linkBtn = document.createElement("button");
    linkBtn.type = "button";
    linkBtn.className = "btn ghost";
    linkBtn.textContent = "🔗";
    linkBtn.title = "Insert link";
    linkBtn.addEventListener("mousedown", (e) => e.preventDefault());
    linkBtn.addEventListener("click", () => {
      const url = prompt("Link URL (https://, mailto:, tel:)", "https://");
      if (!url) return;
      try { document.execCommand("createLink", false, url); } catch {}
      editor.focus();
      onChange(editor.innerHTML);
    });
    toolbar.appendChild(linkBtn);

    toolbar.appendChild(mkBtn("⛔", "Remove link", "unlink"));

    const hrBtn = document.createElement("button");
    hrBtn.type = "button";
    hrBtn.className = "btn ghost";
    hrBtn.textContent = "—";
    hrBtn.title = "Divider";
    hrBtn.addEventListener("mousedown", (e) => e.preventDefault());
    hrBtn.addEventListener("click", () => {
      try { document.execCommand("insertHorizontalRule", false, null); } catch {}
      editor.focus();
      onChange(editor.innerHTML);
    });
    toolbar.appendChild(hrBtn);

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
    toolbar.appendChild(mkBlockBtn("H4", "Heading 4", "h4"));
    toolbar.appendChild(mkBlockBtn("❝", "Quote", "blockquote"));
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

    // Support both {value,label} and {key,label} option shapes (plus simple strings)
    (options || []).forEach((opt) => {
      const o = document.createElement("option");
      const optValue =
        (opt && typeof opt === "object" && ("value" in opt) ? opt.value : undefined) ??
        (opt && typeof opt === "object" && ("key" in opt) ? opt.key : undefined) ??
        (opt && typeof opt === "object" && ("id" in opt) ? opt.id : undefined) ??
        opt;

      const optLabel =
        (opt && typeof opt === "object" && ("label" in opt) ? opt.label : undefined) ??
        (opt && typeof opt === "object" && ("name" in opt) ? opt.name : undefined) ??
        String(optValue ?? "");

      o.value = String(optValue ?? "");
      o.textContent = optLabel;

      if (String(optValue ?? "") === String(value ?? "")) o.selected = true;
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
                    const prev = q.options[idx];
          q.options[idx] = input.value;
                    if (Array.isArray(q.defaultAnswer)) {
            q.defaultAnswer = q.defaultAnswer.map((value) => (value === prev ? input.value : value));
          } else if (q.defaultAnswer === prev) {
            q.defaultAnswer = input.value;
          }
          q.defaultAnswer = normalizeDefaultAnswerForQuestion(q);
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
                    q.defaultAnswer = normalizeDefaultAnswerForQuestion(q);
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
                q.defaultAnswer = normalizeDefaultAnswerForQuestion(q);
        saveSchema();
        render();
      });

      const seedBtn = document.createElement("button");
      seedBtn.type = "button";
      seedBtn.className = "btn ghost";
      seedBtn.textContent = "Seed 3 options";
      seedBtn.addEventListener("click", () => {
        q.options = ["Option 1", "Option 2", "Option 3"];
                q.defaultAnswer = normalizeDefaultAnswerForQuestion(q);
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

  function questionAssistPanel(q) {
    const aiState = getQuestionAiState(q?.id);
        if (uiState.aiQuestionAssistOpen?.[q?.id] == null) {
      uiState.aiQuestionAssistOpen[q.id] = true;
    }
    const open = uiState.aiQuestionAssistOpen?.[q?.id] === true;
    const wrap = document.createElement("div");
    wrap.className = "aiQuestionAssist";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "iconBtn";
    toggleBtn.setAttribute("aria-label", open ? "Close AI question assist" : "Open AI question assist");
    toggleBtn.title = "AI question assist";
    toggleBtn.innerHTML = "✨";
    toggleBtn.addEventListener("click", () => {
      uiState.aiQuestionAssistOpen[q.id] = !open;
      renderInspector();
    });

    wrap.appendChild(sectionTitleRow("AI question assist", [toggleBtn]));

    if (!open) {
      wrap.appendChild(pEl("Get quick suggestions for help text, error copy, and option ideas.", "inlineHelp"));
      return wrap;
    }

    const chat = document.createElement("div");
    chat.className = "aiQuestionChat";

    const messages = document.createElement("div");
    messages.className = "aiQuestionMessages";

    if (!aiState?.messages?.length) {
      messages.appendChild(pEl("Ask for better helper text, error messages, option lists, or explanatory content.", "inlineHelp"));
    } else {
      aiState.messages.forEach((msg) => {
        const bubble = document.createElement("div");
        bubble.className = `aiQuestionMessage ${msg.role === "user" ? "isUser" : "isAssistant"}`;
        bubble.textContent = msg.text;
        messages.appendChild(bubble);
      });
    }

    chat.appendChild(messages);

    if (aiState?.lastSuggestion) {
            const suggestionCard = document.createElement("div");
      suggestionCard.className = "aiQuestionSuggestionCard";

      const suggestionTitle = document.createElement("div");
      suggestionTitle.className = "aiQuestionSuggestionTitle";
      suggestionTitle.textContent = "Suggestions";
      suggestionCard.appendChild(suggestionTitle);

      const suggestionList = document.createElement("ul");
      suggestionList.className = "aiQuestionSuggestionList";

      const pushItem = (label, value) => {
        if (!value) return;
        const item = document.createElement("li");
        item.innerHTML = `<span>${label}</span><span class="aiQuestionSuggestionValue">${value}</span>`;
        suggestionList.appendChild(item);
      };

      const suggestion = aiState.lastSuggestion;
      pushItem("Label", suggestion.title);
      pushItem("Help text", suggestion.help);
      pushItem("Placeholder", suggestion.placeholder);
      pushItem("Validation copy", suggestion.errorText);
      if (typeof suggestion.required === "boolean") {
        pushItem("Required", suggestion.required ? "Yes" : "No");
      }
      if (Array.isArray(suggestion.options) && suggestion.options.length) {
        pushItem("Options", suggestion.options.join(", "));
      }
      if (suggestion.contentHtml) {
        pushItem("Explanatory content", suggestion.contentHtml.replace(/<[^>]+>/g, "").trim());
      }

      if (!suggestionList.children.length) {
        const fallbackItem = document.createElement("li");
        fallbackItem.textContent = "Suggestion ready to apply.";
        suggestionList.appendChild(fallbackItem);
      }

      suggestionCard.appendChild(suggestionList);

      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "btn small ghost";
      applyBtn.textContent = "Apply suggestions";
      applyBtn.disabled = aiState.loading === true;
      applyBtn.addEventListener("click", () => {
        applyQuestionSuggestion(q, aiState.lastSuggestion);
        aiState.status = "Suggestions applied.";
        saveSchema();
        render();
      });

      suggestionCard.appendChild(applyBtn);
      chat.appendChild(suggestionCard);
    }

    if (aiState?.status) {
      const status = document.createElement("div");
      status.className = `aiQuestionStatus ${aiState.loading ? "isLoading" : ""}`;
      status.textContent = aiState.status;
      chat.appendChild(status);
    }

    const inputRow = document.createElement("div");
    inputRow.className = "aiQuestionInputRow";

    const input = document.createElement("textarea");
    input.className = "textarea aiQuestionInput";
    input.rows = 2;
    input.placeholder = "Ask for error text, option ideas, helper copy…";
    input.value = aiState?.draft || "";
    input.disabled = aiState?.loading === true;
    input.addEventListener("input", () => {
      if (!aiState) return;
      aiState.draft = input.value;
    });

    const sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.className = "btn small";
    sendBtn.textContent = aiState?.loading ? "Thinking…" : "Send";
    sendBtn.disabled = aiState?.loading === true;

    sendBtn.addEventListener("click", async () => {
      if (!aiState) return;
      const promptText = (aiState.draft || "").trim();
      if (!promptText) {
        aiState.status = "Add a prompt first.";
        renderInspector();
        return;
      }

      aiState.messages.push({ role: "user", text: promptText });
      aiState.draft = "";
      aiState.loading = true;
      aiState.status = "Thinking...";
      aiState.lastSuggestion = null;
      renderInspector();

      try {
        const { assistantText, suggestion } = await requestAiQuestionAssist(promptText, q);
        aiState.messages.push({ role: "assistant", text: assistantText || "Suggestion ready." });
        aiState.lastSuggestion = suggestion;
                aiState.status = suggestion ? "Suggestions ready below." : "Response received.";
      } catch (e) {
        aiState.status = e?.message || "AI request failed.";
      } finally {
        aiState.loading = false;
        renderInspector();
      }
    });

    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    chat.appendChild(inputRow);

    wrap.appendChild(chat);
    return wrap;
  }

  function defaultCheckboxesEditor(q) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const lab = document.createElement("div");
    lab.className = "label";
    lab.textContent = "Default selections";
    wrap.appendChild(lab);

    const opts = Array.isArray(q.options) ? q.options : [];
    if (!opts.length) {
      wrap.appendChild(pEl("Add options to enable default selections.", "inlineHelp"));
      return wrap;
    }

   const current = new Set(Array.isArray(q.defaultAnswer) ? q.defaultAnswer : []);

      const select = document.createElement("select");
    select.className = "select";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— Choose option —";
    select.appendChild(placeholder);

    const clearOption = document.createElement("option");
    clearOption.value = "__clear__";
    clearOption.textContent = "Clear selections";
    select.appendChild(clearOption);

    opts.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      select.appendChild(option);
    });

      const selectedSummary = document.createElement("div");
    selectedSummary.className = "inlineHelp";

    const updateSummary = () => {
      const ordered = opts.filter((value) => current.has(value));
      selectedSummary.textContent = ordered.length
        ? `Selected: ${ordered.join(", ")}`
        : "No default selections.";
    };

    updateSummary();

    select.addEventListener("change", () => {
      const value = select.value;
      if (value === "__clear__") {
        current.clear();
      } else if (value) {
        if (current.has(value)) current.delete(value);
        else current.add(value);
      }

      const nextArr = opts.filter((item) => current.has(item));
      q.defaultAnswer = nextArr.length ? nextArr : null;
      q.defaultAnswer = normalizeDefaultAnswerForQuestion(q);
      saveSchema();
      updateSummary();
      select.value = "";
          });

       wrap.appendChild(select);
    wrap.appendChild(selectedSummary);
    return wrap;
}
    
 function defaultAnswerEditor(q) {
    if (q.type === "checkboxes") {
      return defaultCheckboxesEditor(q);
    }

    const options = q.type === "yesno" ? ["Yes", "No"] : q.options || [];
    const selectOptions = [
      { value: "", label: "— None —" },
      ...options.map((opt) => ({ value: opt, label: opt })),
    ];
    const current = typeof q.defaultAnswer === "string" ? q.defaultAnswer : "";

    return fieldSelect("Default selection", current, selectOptions, (val) => {
      q.defaultAnswer = val || null;
      q.defaultAnswer = normalizeDefaultAnswerForQuestion(q);
      saveSchema();
    });
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
                            fq.defaultAnswer = null;
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
                    defaultAnswer: null,
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

  function syncGroupsOrderFromFlow(page) {
    if (!page) return;
    const order = (page.flow || [])
      .filter((item) => item?.type === "group")
      .map((item) => item.id);
    if (!order.length) return;
    const groupMap = new Map((page.groups || []).map((g) => [g.id, g]));
    const next = [];
    order.forEach((id) => {
      const g = groupMap.get(id);
      if (g) next.push(g);
    });
    const leftovers = (page.groups || []).filter((g) => !order.includes(g.id));
    page.groups = [...next, ...leftovers];
  }

  function moveGroup(pageId, groupId, dir) {
    const p = getPage(pageId);
    if (!p) return;
        p.flow = Array.isArray(p.flow) ? p.flow : p.groups.map((g) => ({ type: "group", id: g.id }));
    const idx = p.flow.findIndex((item) => item.type === "group" && item.id === groupId);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= p.flow.length) return;
    moveItem(p.flow, idx, to);
    syncGroupsOrderFromFlow(p);
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
    p.flow = Array.isArray(p.flow) ? p.flow : p.groups.map((g) => ({ type: "group", id: g.id }));
    const idx = p.flow.findIndex((x) => x.id === itemId);
    if (idx < 0) return;
    const item = p.flow[idx];
    const to = idx + dir;
    if (to < 0 || to >= p.flow.length) return;
    moveItem(p.flow, idx, to);
    if (item?.type === "group") {
      syncGroupsOrderFromFlow(p);
    }
    saveSchema();
    renderAll();
  }
  
  function deleteFlowItem(pageId, itemId) {
    const p = getPage(pageId);
    if (!p) return;
    p.flow = (p.flow || []).filter((x) => x.id !== itemId);
        if (p.flow.length === 0 && p.groups?.length) {
      p.flow = p.groups.map((g) => ({ type: "group", id: g.id }));
    }

    // Reset selection to nearest sensible thing
    const first = p.flow[0];
        if (!first) {
      selection.blockType = "page";
      selection.blockId = null;
      selection.groupId = null;
      selection.questionId = null;
      saveSchema();
      renderAll(true);
      return;
    }
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

    function deleteGroupFromPage(pageId, groupId) {
    const p = getPage(pageId);
    if (!p || !groupId) return;

    p.groups = (p.groups || []).filter((g) => g.id !== groupId);
    p.flow = (p.flow || []).filter((item) => !(item.type === "group" && item.id === groupId));
    syncGroupsOrderFromFlow(p);

    if (p.flow.length === 0) {
      selection.blockType = "page";
      selection.blockId = null;
      selection.groupId = null;
      selection.questionId = null;
      saveSchema();
      renderAll(true);
      return;
    }

    const first = p.flow[0];
    if (first.type === "text") {
      selection.blockType = "text";
      selection.blockId = first.id;
      selection.groupId = null;
      selection.questionId = null;
    } else {
      const g0 = p.groups.find((gg) => gg.id === first.id) || p.groups[0];
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
      name: `Page ${schema.pages.length + 1}`,
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

    schema.pages.push(newPage);
    selection.pageId = pid;
    selection.blockType = "group";
    selection.blockId = gid;
    selection.groupId = gid;
    selection.questionId = qid;
    saveSchema();
    renderAll();
  }

  // Fixed checkout pages: removed


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
    uiState.groupOptionsOpen = true;

    saveSchema();
    renderAll(true);
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
            defaultAnswer: null,
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


    function addDisplayElement(variant = "bigPrice") {
    const p = getPage(selection.pageId);
    const g = getGroup(selection.pageId, selection.groupId);
    if (!p || !g) return;

    // If user is currently on a text block, add the element to the nearest group
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
              const normalizedVariant = normalizeDisplayVariant(variant);
    const displayDefaults = DISPLAY_VARIANT_DEFAULTS[normalizedVariant] || DISPLAY_VARIANT_DEFAULTS.info;
    const q = {
      id: qid,
      type: "display",
      title: normalizedVariant === "bigPrice" ? "Big price" : "Display element",
      required: false,
      help: "",
      placeholder: "",
      errorText: "",
      options: [],
      logic: { enabled: false, rules: [] },
      content: { enabled: false, html: "" },
      display: {
                       variant: normalizedVariant,
        tone: "neutral", // used for alert tone presets only
        title: displayDefaults.title,
        subtitle: displayDefaults.subtitle,
        bodyHtml: displayDefaults.bodyHtml,
        prefix: displayDefaults.prefix,
        suffix: displayDefaults.suffix,
      },
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
    // Question mode: returns visible questions + any active follow-up questions
    const all = getAllQuestionsInOrder(schema);
    const byId = Object.fromEntries(all.map((q) => [q.id, q]));

    // Pre-compute group visibility
    const groupVisible = {};
    schema.pages.forEach((p) => {
      p.groups.forEach((g) => {
        groupVisible[g.id] = groupShouldShow(g, byId, preview.answers);
      });
    });

    const mainVisible = all.filter((q) => {
      if (groupVisible[q.groupId] === false) return false;
      return questionShouldShow(q, byId, preview.answers);
    });

    const steps = [];

    mainVisible.forEach((q) => {
      steps.push(q);

      if (followUpMatches(q, preview.answers)) {
        const fuSteps = getActiveFollowUpSteps(q, preview.answers);
        fuSteps.forEach((fqStep) => {
          steps.push({
            ...fqStep,
            pageId: q.pageId,
            groupId: q.groupId,
            pageName: q.pageName,
            groupName: q.groupName,
          });
        });
      }
    });

    return steps;
  }

  function buildPreviewPageSteps() {
    // Page mode: one step per page (layout preview)
    return schema.pages.map((p) => ({ id: p.id, pageId: p.id, pageName: p.name }));
  }

   function applyDefaultAnswers(answers, s) {
    const all = getAllQuestionsInOrder(s);
    all.forEach((q) => {
      const normalized = normalizeDefaultAnswerForQuestion(q);
      if (normalized == null) return;
      answers[q.id] = Array.isArray(normalized) ? [...normalized] : normalized;
    });
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
        applyDefaultAnswers(preview.answers, schema);

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
      const currentCardScrollTop = previewStage?.querySelector(".previewCard")?.scrollTop;
    const previousCardScrollTop =
      typeof currentCardScrollTop === "number" ? currentCardScrollTop : preview.lastCardScrollTop;
    preview.lastCardScrollTop = previousCardScrollTop;
    const restorePreviewCardScroll = () => {
      const card = previewStage?.querySelector(".previewCard");
      if (card) {
        requestAnimationFrame(() => {
          card.scrollTop = previousCardScrollTop;
        });
      }
    };

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
                restorePreviewCardScroll();
        return;
      }
      renderPreviewPage(step.pageId);
            restorePreviewCardScroll();
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
            restorePreviewCardScroll();
      return;
    }

    // Render the current step
    const card = document.createElement("div");
    card.className = "previewCard";

    // Header: Page title, then Group title + description (matches page mode layout)
    const pageTitleEl = document.createElement("div");
    pageTitleEl.className = "pQ";
    pageTitleEl.textContent = step.pageName || "Untitled page";
    card.appendChild(pageTitleEl);

    const groupTitleEl = document.createElement("div");
    groupTitleEl.className = "previewGroupTitle";
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
    qEl.className = "previewQuestionTitle";
    qEl.textContent = step.title || "Untitled question";

    const helpEl = document.createElement("div");
    helpEl.className = "pHelp";
    helpEl.textContent = step.help || "";

    const contentEl = document.createElement("div");
    contentEl.className = "previewQuestionContent";
    const contentHtml = step.content?.enabled ? sanitizeRichHtml(step.content.html || "") : "";
    contentEl.innerHTML = contentHtml;
    contentEl.style.display = contentHtml ? "block" : "none";

    const errEl = document.createElement("div");
    errEl.className = "pError";
    errEl.textContent = preview.lastError || "";
    errEl.style.display = preview.lastError ? "block" : "none";

    const inputWrap = document.createElement("div");
    inputWrap.className = "pInputWrap";

    // Build input control per type
    const setAnswer = (v) => {
      preview.answers[step.id] = v;
    };
    const getAnswer = () => preview.answers[step.id];

    buildPreviewInputControl(step, inputWrap, setAnswer, getAnswer, () => renderPreview());

    if (step.type !== "display") {
      card.appendChild(qEl);
      if (contentHtml) card.appendChild(contentEl);
      if (step.help) card.appendChild(helpEl);
      card.appendChild(inputWrap);
      card.appendChild(errEl);
    } else {
      // Display elements are purely presentational (no question label/help/error)
      card.classList.add("pCardDisplay");
      card.appendChild(inputWrap);
    }
    previewStage.appendChild(card);
        restorePreviewCardScroll();

    // Ensure Next button is re-enabled if previously disabled by completion view
    if (btnNext) btnNext.disabled = false;
  }

  function buildPreviewInputControl(step, inputWrap, setAnswer, getAnswer, rerender) {
    if (step.type === "display") {
      const d = step.display || {};
                  const v = normalizeDisplayVariant(String(d.variant || "info"));
      const tone = String(d.tone || "neutral");
            const supportsTone = displaySupportsTone(v);

      const wrap = document.createElement("div");
            wrap.className = "displayEl" + " display-" + v + (supportsTone && tone !== "neutral" ? " tone-" + tone : "");

      if (v === "divider") {
        const hr = document.createElement("hr");
        hr.className = "displayDivider";
        wrap.appendChild(hr);
        inputWrap.appendChild(wrap);
        return;
      }

      const title = document.createElement("div");
      title.className = "displayTitle";
      title.textContent = (d.title || "") || "";

      const subtitle = document.createElement("div");
      subtitle.className = "displaySubtitle";
            subtitle.textContent = d.subtitle || "";

      const body = document.createElement("div");
      body.className = "displayBody";
      body.innerHTML = sanitizeRichHtml(d.bodyHtml || "");
      body.style.display = body.innerHTML.trim() ? "block" : "none";

            if (v === "bigPrice") {
        // Optional prefix/suffix for price display
        const line = document.createElement("div");
        line.className = "displayPriceLine";

        const prefix = (d.prefix || "").trim();
        const suffix = (d.suffix || "").trim();

        const value = document.createElement("div");
        value.className = "displayPriceValue";
        value.textContent = `${prefix}${d.title || ""}${suffix}`.trim();

        line.appendChild(value);
        wrap.appendChild(line);
        if (d.subtitle) wrap.appendChild(subtitle);
        if (body.style.display !== "none") wrap.appendChild(body);
        inputWrap.appendChild(wrap);
        return;
      }

      if (title.textContent) wrap.appendChild(title);
      if (subtitle.textContent) wrap.appendChild(subtitle);
      if (body.style.display !== "none") wrap.appendChild(body);

      inputWrap.appendChild(wrap);
      return;
    }

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
            sel.addEventListener("change", () => {
          suppressAutoFocusUntil = Date.now() + 300;
          const prev = getAnswer();
          const next = sel.value;
          setAnswer(next);
          if (prev !== next && step.followUp?.enabled) {
            clearFollowUpAnswersForQuestion(step, preview.answers);
            ensureMinFollowUpInstances(step, preview.answers);
          }
          rerender();
        });
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
                        suppressAutoFocusUntil = Date.now() + 300;
            const next = new Set(Array.isArray(getAnswer()) ? getAnswer() : []);
            if (cb.checked) next.add(o);
            else next.delete(o);
            const arr = Array.from(next);
            setAnswer(arr);
            label.classList.toggle("selected", cb.checked);
                        rerender();
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

  function renderPreviewPage(pageId) {
    const p = getPage(pageId);
    if (!p) return;

    // Build visibility maps
    const all = getAllQuestionsInOrder(schema);
    const byId = Object.fromEntries(all.map((q) => [q.id, q]));
    const groupVisible = {};
    p.groups.forEach((g) => {
      groupVisible[g.id] = groupShouldShow(g, byId, preview.answers);
    });

    const card = document.createElement("div");
    card.className = "previewCard";

    // Page header
    const header = document.createElement("div");
    header.className = "pQ";
    header.textContent = p.name || "Untitled page";
    card.appendChild(header);

    const stack = document.createElement("div");
    stack.className = "previewPageStack";

    // Render page flow (text blocks + groups)
    (p.flow || []).forEach((it) => {
      if (it.type === "text") {
        const level = it.level || "h3";
        const title = (it.title || "").trim();
        const body = sanitizeRichHtml(it.bodyHtml || "");

        const block = document.createElement("div");
        block.className = "previewTextBlock";

        const titleEl = document.createElement(level === "body" ? "div" : level);
        titleEl.className = "previewTextBlockTitle";
        titleEl.textContent = title;
        if (title) block.appendChild(titleEl);

        if (body) {
          const bodyEl = document.createElement("div");
          bodyEl.className = "pHelp previewTextBlockBody";
          bodyEl.innerHTML = body;
          block.appendChild(bodyEl);
        }

        if (title || body) stack.appendChild(block);
        return;
      }

      if (it.type === "group") {
        const g = p.groups.find((gg) => gg.id === it.id);
        if (!g) return;
        if (groupVisible[g.id] === false) return;

        const groupWrap = document.createElement("div");
        groupWrap.className = "previewGroup";

        const gTitle = document.createElement("div");
        gTitle.className = "previewGroupTitle";
        gTitle.textContent = g.name || "Untitled group";
        groupWrap.appendChild(gTitle);

        if (g.description?.enabled) {
          const d = sanitizeRichHtml(g.description.html || "");
          if (d) {
            const dEl = document.createElement("div");
            dEl.className = "pHelp previewGroupDesc";
            dEl.innerHTML = d;
            groupWrap.appendChild(dEl);
          }
        }

        const visibleQuestions = (g.questions || []).filter((qq) => questionShouldShow(qq, byId, preview.answers));

        visibleQuestions.forEach((qq) => {
          const qBlock = document.createElement("div");
          qBlock.className = "previewQuestion";

            if (qq.type !== "display") {
            const qTitle = document.createElement("div");
            qTitle.className = "previewQuestionTitle";
            qTitle.textContent = qq.title || "Untitled question";
            qBlock.appendChild(qTitle);

            if (qq.content?.enabled) {
              const c = sanitizeRichHtml(qq.content.html || "");
              if (c) {
                const cEl = document.createElement("div");
                cEl.className = "previewQuestionContent";
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
          } else {
            qBlock.classList.add("pCardDisplay");
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

                    if (qq.type !== "display") {
            // Inline field error (page mode)
            const fieldErr = preview.pageErrors?.[qq.id] || "";
            const errEl = document.createElement("div");
            errEl.className = "pError";
            errEl.textContent = fieldErr;
            errEl.style.display = fieldErr ? "block" : "none";
            qBlock.appendChild(errEl);
          }

          // Follow-up questions (nested under this question)
                    if (qq.type !== "display" && followUpMatches(qq, preview.answers)) {
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
  
  // -------------------------
  // Page-level template JSON (import/export)
  // -------------------------
  function exportPageJson(pageId) {
    const p = getPage(pageId);
    if (!p) { alert("No page selected."); return; }

    // Export only the page object (portable between journeys)
    const payload = {
      _schema: "page@1",
      page: JSON.parse(JSON.stringify(p)),
    };

    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: "application/json" });

    const safeName = String(p.name || "page")
      .toLowerCase()
      .replace(/[^a-z0-9\-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName || "page"}.page.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function importPageJsonInto(pageId) {
    const target = getPage(pageId);
    if (!target) { alert("No page selected."); return; }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;

      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw);

        const incoming = parsed?.page && parsed?._schema ? parsed.page : parsed;

        if (!incoming || typeof incoming !== "object") throw new Error("Invalid JSON");
        if (!Array.isArray(incoming.groups) || !Array.isArray(incoming.flow)) {
          throw new Error("Page JSON must include 'flow' and 'groups' arrays.");
        }

        const imported = JSON.parse(JSON.stringify(incoming));

        // Keep the existing page id in this journey (stable reference)
        const keepId = target.id;

        // Remap all nested IDs to avoid collisions
        remapIdsInObject(imported);

        imported.id = keepId;

        // Replace page in schema
        const idx = schema.pages.findIndex((p) => p.id === keepId);
        if (idx < 0) throw new Error("Target page not found in schema.");

        schema.pages[idx] = imported;

        // Update selection to first item on the imported page
        selection.pageId = keepId;
        const first = (imported.flow || [])[0];
        if (first && first.type === "text") {
          selection.blockType = "text";
          selection.blockId = first.id;
          selection.groupId = null;
          selection.questionId = null;
        } else {
          const g0 = (imported.groups || [])[0];
          selection.blockType = "group";
          selection.blockId = g0?.id || null;
          selection.groupId = g0?.id || null;
          selection.questionId = g0?.questions?.[0]?.id || null;
        }

        saveSchema();
        renderAll(true);
        alert("Page imported.");
      } catch (e) {
        alert("Page import failed: " + (e?.message || "Unknown error"));
      }
    });

    document.body.appendChild(input);
    input.click();
  }

  // Remap IDs in an object tree. Any string value matching a known id gets replaced.
  // This is intentionally generic so it works with questions, logic rules, bindings, etc.
  function remapIdsInObject(root) {
    const idMap = new Map();

    const guessPrefix = (id) => {
      const m = String(id || "").match(/^([a-zA-Z]+)[\-_]/);
      if (!m) return "id";
      const p = m[1].toLowerCase();
      if (p.length > 12) return "id";
      return p;
    };

    const collectIds = (node) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(collectIds);
        return;
      }
      if (typeof node === "object") {
        if (typeof node.id === "string" && node.id) {
          if (!idMap.has(node.id)) idMap.set(node.id, uid(guessPrefix(node.id)));
        }
        Object.values(node).forEach(collectIds);
      }
    };

    const replaceIds = (node) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(replaceIds);
        return;
      }
      if (typeof node === "object") {
        Object.keys(node).forEach((k) => {
          const v = node[k];
          if (typeof v === "string" && idMap.has(v)) {
            node[k] = idMap.get(v);
          } else {
            replaceIds(v);
          }
        });
        if (typeof node.id === "string" && idMap.has(node.id)) {
          node.id = idMap.get(node.id);
        }
      }
    };

    collectIds(root);
    replaceIds(root);
  }

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
          if (qq.type === "display") continue;
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
    
 if (btnImportPages) {
      btnImportPages.addEventListener("click", () => {
        const target = getPage(selection.pageId) || schema.pages[0];
        if (!target) {
          alert("Create a page before importing.");
          return;
        }
        selection.pageId = target.id;
        importPageJsonInto(target.id);
      });
    }

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



// (Template registry removed — pages are imported/exported as JSON templates.)
