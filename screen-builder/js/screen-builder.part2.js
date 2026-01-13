ns : [];
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
        (p.id === selection.pageId ? " 
