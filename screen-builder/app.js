/* Product-grade Form Builder (vanilla JS)
   - Pages + groups + questions
   - Options editor
   - Conditional logic
   - Typeform-style preview (one question at a time, progress bar)
   - Autosave + export/import JSON
*/

(function () {
  const STORAGE_KEY = "og-formbuilder-schema-v1";

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
  // Schema model
  // -------------------------
  const QUESTION_TYPES = [
    { key: "text", label: "Short text" },
    { key: "textarea", label: "Long text" },
    { key: "number", label: "Number" },
    { key: "email", label: "Email" },
    { key: "date", label: "Date" },
    { key: "select", label: "Select (dropdown)" },
    { key: "radio", label: "Radio group" },
    { key: "checkboxes", label: "Checkboxes" },
    { key: "yesno", label: "Yes / No" },
  ];

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

    return {
      meta: {
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      lineOfBusiness: "Motor Insurance",
      pages: [
        {
          id: pageId,
          name: "About you",
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
      ],
    };
  }

  function isOptionType(type) {
    return type === "select" || type === "radio" || type === "checkboxes";
  }

  // -------------------------
  // App state
  // -------------------------
  let schema = loadSchema() || newDefaultSchema();

  // Normalise schema for page flow (groups + text blocks)
  normaliseSchemaForFlow();

  // Phase 1 migration/normalisation: ensure each page has a valid flow (groups + text blocks)
  function normaliseSchemaForFlow() {
    if (!schema || !Array.isArray(schema.pages)) return;

    schema.pages.forEach((p) => {
      p.groups = Array.isArray(p.groups) ? p.groups : [];
      p.flow = Array.isArray(p.flow) ? p.flow : [];

      // If no flow exists (older schema), create it from existing groups in order
      if (p.flow.length === 0) {
        p.flow = p.groups.map((g) => ({ type: "group", id: g.id }));
      }

      // Ensure every group appears at least once in flow
      const inFlow = new Set(p.flow.filter((x) => x?.type === "group").map((x) => x.id));
      p.groups.forEach((g) => {
        if (!inFlow.has(g.id)) p.flow.push({ type: "group", id: g.id });
      });

      // Ensure every flow item is well-formed
      p.flow = p.flow
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          if (it.type === "group") {
            return { type: "group", id: it.id };
          }
          if (it.type === "text") {
            return {
              type: "text",
              id: it.id || uid("txt"),
              title: typeof it.title === "string" ? it.title : "",
              level: ["h1", "h2", "h3", "h4", "body"].includes(String(it.level || "").toLowerCase())
                ? String(it.level).toLowerCase()
                : "body",
              html: typeof it.html === "string" ? it.html : "",
            };
          }
          return null;
        })
        .filter(Boolean);

      // Remove dangling group refs (if group deleted but flow item remains)
      const groupIds = new Set(p.groups.map((g) => g.id));
      p.flow = p.flow.filter((it) => it.type !== "group" || groupIds.has(it.id));

      // If we removed everything, keep at least one group (or create one)
      if (p.flow.length === 0) {
        if (p.groups.length === 0) {
          const gid = uid("group");
          p.groups.push({
            id: gid,
            name: "New group",
            description: { enabled: false, html: "" },
            logic: { enabled: false, rules: [] },
            questions: [],
          });
        }
        p.flow = p.groups.map((g) => ({ type: "group", id: g.id }));
      }
    });
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
            if (questionShouldShow(qq, byId, preview.answers)) visibleQ.push(qq);
          });
        });

        // Validate required questions
        for (const qq of visibleQ) {
          if (!qq.required) continue;
          const ans = preview.answers[qq.id];
          const empty =
            ans === undefined ||
            ans === null ||
            (typeof ans === "string" && ans.trim() === "") ||
            (Array.isArray(ans) && ans.length === 0);
          if (empty) {
            preview.lastError = qq.errorText || "This field is required.";
            renderPreview();
            return;
          }
        }

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
  renderAll();

  // Auto-create friendly initial values if schema is empty or corrupted
  if (!schema.lineOfBusiness) schema.lineOfBusiness = "New Journey";
  if (!Array.isArray(schema.pages)) schema.pages = [];
})();
