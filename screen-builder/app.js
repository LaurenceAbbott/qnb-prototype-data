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

      // Ensure text blocks have required fields
      p.flow.forEach((it) => {
        if (it?.type !== "text") return;
        if (!it.id) it.id = uid("txt");
        if (!it.title) it.title = "";
        if (!it.level) it.level = "h3"; // h1/h2/h3/body
        if (!it.bodyHtml) it.bodyHtml = "<p></p>";
      });

      // Ensure questions have content/errorText fields (older imports)
      p.groups.forEach((g) => {
        g.questions = Array.isArray(g.questions) ? g.questions : [];
        // Phase: group-level description + logic
        if (g.description == null) g.description = { enabled: false, html: "" };
        if (g.logic == null) g.logic = { enabled: false, rules: [] };
        g.questions.forEach((q) => {
          if (!q) return;
          if (q.content == null) q.content = { enabled: false, html: "" };
          if (q.errorText == null) q.errorText = "This field is required.";
          if (q.logic == null) q.logic = { enabled: false, rules: [] };
        });
      });
    });

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
  };

  // Prevent inspector re-render while typing
  let isTypingInspector = false;

  // -------------------------
  // DOM
  // -------------------------
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
    editorTitleEl.textContent = p ? `Editor · ${p.name}` : "Editor";
    pageNameDisplayEl.textContent = p ? p.name : "—";
    groupNameDisplayEl.textContent = g ? g.name : "—";
  }

  function renderPagesList() {
    pagesListEl.innerHTML = "";

    schema.pages.forEach((p, pIdx) => {
      p.flow = Array.isArray(p.flow) ? p.flow : p.groups.map((g) => ({ type: "group", id: g.id }));

      const pageDiv = document.createElement("div");
      pageDiv.className = "pageItem" + (p.id === selection.pageId ? " active" : "");

      const top = document.createElement("div");
      top.className = "pageTop";

      const left = document.createElement("div");
      left.style.flex = "1";
      left.style.minWidth = "0";

      const name = document.createElement("div");
      name.className = "pageName";
      name.contentEditable = "true";
      name.spellcheck = false;
      name.setAttribute("role", "textbox");
      name.setAttribute("aria-label", "Page name");
      name.title = "Click to rename";
      name.textContent = p.name;

      // CRITICAL: prevent parent click from re-rendering while editing
      name.addEventListener("mousedown", (e) => {
        e.stopPropagation();
      });
      name.addEventListener("click", (e) => {
        e.stopPropagation();
      });

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

      const meta = document.createElement("div");
      meta.className = "pageMeta";
      const qCount = p.groups.reduce((acc, g) => acc + (g.questions?.length || 0), 0);
      meta.textContent = `${p.groups.length} group${p.groups.length !== 1 ? "s" : ""} · ${qCount} question${qCount !== 1 ? "s" : ""}`;

      left.appendChild(name);
      left.appendChild(meta);

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
      downBtn.disabled = pIdx === schema.pages.length - 1;
      downBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveItem(schema.pages, pIdx, pIdx + 1);
        saveSchema();
        renderAll();
      });

      const delBtn = iconButton("✕", "Delete page");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm(`Delete page "${p.name}"? This cannot be undone.`)) return;
        schema.pages = schema.pages.filter((x) => x.id !== p.id);
        saveSchema();
        ensureSelection();
        renderAll();
      });

      actions.appendChild(renameBtn);
      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
      actions.appendChild(delBtn);

      top.appendChild(left);
      top.appendChild(actions);
      pageDiv.appendChild(top);

      // Flow chips (Groups + Text blocks)
      const chips = document.createElement("div");
      chips.className = "groupsMini";

      p.flow.forEach((it) => {
        if (it.type === "group") {
        const g = p.groups.find((gg) => gg.id === it.id);
        if (!g) return;
        if (groupVisible[g.id] === false) return;

        const groupWrap = document.createElement("div");
        groupWrap.className = "previewGroup";

        // Group title + description should appear BEFORE the questions in this group
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

          const qTitle = document.createElement("div");
          qTitle.className = "previewQuestionTitle";
          qTitle.textContent = qq.title || "Untitled question";
          qBlock.appendChild(qTitle);

          if (qq.content?.enabled) {
            const c = sanitizeRichHtml(qq.content.html || "");
            if (c) {
              const cEl = document.createElement("div");
              cEl.className = "pHelp previewQuestionContent";
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

          const setA = (v) => (preview.answers[qq.id] = v);
          const getA = () => preview.answers[qq.id];

          buildPreviewInputControl(qq, inputWrap, setA, getA, () => renderPreview());

          qBlock.appendChild(inputWrap);

          // Append questions INSIDE the group wrapper so the header is always above them
          groupWrap.appendChild(qBlock);
        });

        // Avoid rendering empty groups (no visible questions and no description)
        const hasDesc = !!(g.description?.enabled && sanitizeRichHtml(g.description.html || "").trim());
        if (visibleQuestions.length || hasDesc) {
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
