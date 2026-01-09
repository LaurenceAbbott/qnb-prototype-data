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

      // click page selects it
      pageDiv.addEventListener("click", () => {
        selection.pageId = p.id;
        // choose first flow item
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
    });
  }

  function renderCanvas() {
    canvasEl.innerHTML = "";

    const p = getPage(selection.pageId);
    if (!p) return;

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
    if (q.type === "text" || q.type === "email" || q.type === "number") {
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

    schema.pages.push({
      id: pid,
      name: `Page ${schema.pages.length + 1}`,
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
    });

    selection.pageId = pid;
    selection.blockType = "group";
    selection.blockId = gid;
    selection.groupId = gid;
    selection.questionId = qid;
    saveSchema();
    renderAll();
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
    const mightBeNumeric = referencedQuestion?.type === "number";
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
    // Question mode: returns visible questions (existing behaviour)
    const all = getAllQuestionsInOrder(schema);
    const byId = Object.fromEntries(all.map((q) => [q.id, q]));

    // Pre-compute group visibility
    const groupVisible = {};
    schema.pages.forEach((p) => {
      p.groups.forEach((g) => {
        groupVisible[g.id] = groupShouldShow(g, byId, preview.answers);
      });
    });

    const visible = all.filter((q) => {
      if (groupVisible[q.groupId] === false) return false;
      return questionShouldShow(q, byId, preview.answers);
    });

    return visible;
  }

  function buildPreviewPageSteps() {
    // Page mode: one step per page (layout preview)
    return schema.pages.map((p) => ({ id: p.id, pageId: p.id, pageName: p.name }));
  }

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
    // Steps depend on mode
    preview.steps = preview.mode === "page" ? buildPreviewPageSteps() : buildPreviewSteps();
    preview.index = clamp(preview.index, 0, Math.max(0, preview.steps.length - 1));

    const steps = preview.steps;
    const step = steps[preview.index];

    if (previewTitle) previewTitle.textContent = schema.lineOfBusiness || "Preview";

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
    if (["text", "email", "number", "date"].includes(step.type)) {
      const input = document.createElement("input");
      input.className = "pInput";

      // For custom date picker, render as text input and attach Flatpickr
      if (step.type === "date") {
        input.type = "text";
        input.inputMode = "numeric";
        input.placeholder = step.placeholder || "dd/mm/yyyy";
        input.autocomplete = "off";
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

      setTimeout(() => input.focus(), 0);
      return;
    }

    if (step.type === "textarea") {
      const ta = document.createElement("textarea");
      ta.className = "pTextarea";
      ta.placeholder = step.placeholder || "";
      ta.value = getAnswer() ?? "";
      ta.addEventListener("input", () => setAnswer(ta.value));
      inputWrap.appendChild(ta);
      setTimeout(() => ta.focus(), 0);
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
          setAnswer(val);
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
        setTimeout(() => sel.focus(), 0);
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
    setTimeout(() => input.focus(), 0);
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

          const qTitle = document.createElement("div");
          qTitle.className = "previewQuestionTitle";
          qTitle.textContent = qq.title || "Untitled question";
          qBlock.appendChild(qTitle);

          if (qq.content?.enabled) {
            const c = sanitizeRichHtml(qq.content.html || "");
            if (c) {
              const cEl = document.createElement("div");
              cEl.className = "previewQuestionC
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
