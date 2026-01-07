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
          groups: [
            {
              id: groupId,
              name: "Basics",
              questions: [
                {
                  id: q1,
                  type: "text",
                  title: "What is your full name?",
                  help: "Use your legal name as it appears on official documents.",
                  required: true,
                  placeholder: "e.g. Alex Taylor",
                  options: [],
                  logic: { enabled: false, rules: [] },
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
  let selection = {
    pageId: schema.pages[0]?.id || null,
    groupId: schema.pages[0]?.groups[0]?.id || null,
    questionId: schema.pages[0]?.groups[0]?.questions[0]?.id || null,
  };

  // Preview state
  let preview = {
    open: false,
    steps: [],
    index: 0,
    answers: {}, // qid -> value
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
      selection = { pageId: null, groupId: null, questionId: null };
      return;
    }

    const p = getPage(selection.pageId) || schema.pages[0];
    selection.pageId = p.id;

    if (!p.groups?.length) {
      selection.groupId = null;
      selection.questionId = null;
      return;
    }

    const g = getGroup(p.id, selection.groupId) || p.groups[0];
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
  function renderAll() {
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

    // CRITICAL: do not rebuild inspector while user is typing in it
    if (!isTypingInspector) {
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
        // Make renaming effortless (no "type fast" race)
        requestAnimationFrame(() => selectAllContent(name));
      });

      name.addEventListener("keydown", (e) => {
        // Enter commits rename
        if (e.key === "Enter") {
          e.preventDefault();
          name.blur();
        }
        // Escape cancels back to stored value
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
        // update header + stats without rebuilding inspector
        editorTitleEl.textContent = `Editor · ${p.name}`;
        pageNameDisplayEl.textContent = p.name;
        renderMiniStats();
      });

      const meta = document.createElement("div");
      meta.className = "pageMeta";
      const qCount = p.groups.reduce((acc, g) => acc + g.questions.length, 0);
      meta.textContent = `${p.groups.length} group${p.groups.length !== 1 ? "s" : ""} · ${qCount} question${qCount !== 1 ? "s" : ""}`;

      left.appendChild(name);
      left.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "pageActions";

      // rename affordance
      const renameBtn = iconButton("✎", "Rename page");
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        name.focus();
        requestAnimationFrame(() => selectAllContent(name));
      });

      // reorder up/down
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

      // Groups chips (select group)
      const chips = document.createElement("div");
      chips.className = "groupsMini";
      p.groups.forEach((g) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "groupChip" + (p.id === selection.pageId && g.id === selection.groupId ? " active" : "");
        chip.textContent = g.name;
        chip.addEventListener("click", () => {
          selection.pageId = p.id;
          selection.groupId = g.id;
          selection.questionId = g.questions[0]?.id || null;
          renderAll();
        });
        chips.appendChild(chip);
      });

      const addGroupChip = document.createElement("button");
      addGroupChip.type = "button";
      addGroupChip.className = "groupChip";
      addGroupChip.textContent = "+ Group";
      addGroupChip.addEventListener("click", () => {
        selection.pageId = p.id;
        addGroupToPage(p.id);
      });
      chips.appendChild(addGroupChip);

      pageDiv.appendChild(chips);

      // click page selects it
      pageDiv.addEventListener("click", () => {
        selection.pageId = p.id;
        // choose first group/question
        selection.groupId = p.groups[0]?.id || null;
        selection.questionId = p.groups[0]?.questions[0]?.id || null;
        renderAll();
      });

      pagesListEl.appendChild(pageDiv);
    });
  }

  function renderCanvas() {
    canvasEl.innerHTML = "";

    const p = getPage(selection.pageId);
    const g = getGroup(selection.pageId, selection.groupId);
    if (!p || !g) return;

    if (!g.questions.length) {
      const empty = document.createElement("div");
      empty.className = "tip";
      empty.innerHTML = `
        <div class="tipTitle">No questions in this group</div>
        <p class="muted">Add your first question to start building a Typeform-style journey.</p>
      `;
      canvasEl.appendChild(empty);
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
        // keep logic but reference still valid
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

    if (!g) {
      inspectorSubEl.textContent = "Select or add a group";
      // group controls
      inspectorEl.appendChild(sectionTitle("Page"));
      inspectorEl.appendChild(fieldText("Page name", p.name, (val) => {
        p.name = val || "Untitled page";
        saveSchemaDebounced();
        renderPagesList();
        editorTitleEl.textContent = `Editor · ${p.name}`;
        pageNameDisplayEl.textContent = p.name;
      }));
      inspectorEl.appendChild(buttonRow([
        { label: "+ Group", kind: "primary", onClick: () => addGroupToPage(p.id) },
      ]));
      return;
    }

    // Group editor (always visible)
    inspectorSubEl.textContent = q ? "Editing question" : "Editing group";

    inspectorEl.appendChild(sectionTitle("Group"));

    inspectorEl.appendChild(fieldText("Group name", g.name, (val) => {
      g.name = val || "Untitled group";
      saveSchemaDebounced();
      renderPagesList();
      groupNameDisplayEl.textContent = g.name;
    }));

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
          selection.groupId = p.groups[0]?.id || null;
          selection.questionId = p.groups[0]?.questions[0]?.id || null;
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
      saveSchema();
      renderAll();
    }));

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
      renderAll();
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
        del.addEventListener("click", () => {
          q.logic.rules.splice(idx, 1);
          saveSchema();
          renderAll();
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
      add.addEventListener("click", () => {
        q.logic.rules.push({
          id: uid("rule"),
          questionId: earlier[earlier.length - 1]?.id || "",
          operator: "equals",
          value: "",
        });
        saveSchema();
        renderAll();
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
  function addPage() {
    const pid = uid("page");
    const gid = uid("group");
    const qid = uid("q");

    schema.pages.push({
      id: pid,
      name: `Page ${schema.pages.length + 1}`,
      groups: [
        {
          id: gid,
          name: "Group 1",
          questions: [
            {
              id: qid,
              type: "text",
              title: "New question",
              help: "",
              required: false,
              placeholder: "",
              options: [],
              logic: { enabled: false, rules: [] },
            },
          ],
        },
      ],
    });

    selection.pageId = pid;
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
      questions: [],
    });

    selection.pageId = p.id;
    selection.groupId = gid;
    selection.questionId = null;

    saveSchema();
    renderAll();
  }

  function addQuestion() {
    const p = getPage(selection.pageId);
    const g = getGroup(selection.pageId, selection.groupId);
    if (!p || !g) return;

    const qid = uid("q");
    const q = {
      id: qid,
      type: "text",
      title: "New question",
      help: "",
      required: false,
      placeholder: "",
      options: [],
      logic: { enabled: false, rules: [] },
    };

    g.questions.push(q);
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

  function buildPreviewSteps() {
    const all = getAllQuestionsInOrder(schema);
    const byId = Object.fromEntries(all.map((q) => [q.id, q]));

    // Decide visibility based on current answers (dynamic)
    const visible = all.filter((q) => questionShouldShow(q, byId, preview.answers));

    // Also remove any steps whose page/group got deleted
    return visible;
  }

  // -------------------------
  // Preview UI
  // -------------------------

  function openPreview() {
    if (!previewBackdrop) return;

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
    previewStage.innerHTML = "";
  }

  function setProgress() {
    const steps = preview.steps;
    const total = steps.length || 1;
    const current = clamp(preview.index + 1, 1, total);
    const pct = (current / total) * 100;

    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${current} / ${total}`;
  }

  function renderPreview() {
    preview.steps = buildPreviewSteps();
    preview.index = clamp(preview.index, 0, Math.max(0, preview.steps.length - 1));

    const steps = preview.steps;
    const step = steps[preview.index];

    previewTitle.textContent = schema.lineOfBusiness || "Preview";
    previewSub.textContent = step ? `${step.pageName} · ${step.groupName}` : "No questions yet";

    setProgress();

    btnPrev.disabled = preview.index === 0;
    btnNext.disabled = steps.length === 0;

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

    // (rest of renderPreview unchanged)
  }

  function renderCompletion() {
    // unchanged
  }

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
      if (e.target.closest("#inspector")) isTypingInspector = true;
    });

    document.addEventListener("focusout", (e) => {
      if (!e.target.closest("#inspector")) return;
      setTimeout(() => {
        if (!document.activeElement.closest("#inspector")) {
          isTypingInspector = false;
          renderAll();
        }
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
      // reset preview answers each time? keep. best: keep within session; but start fresh for consistent testing:
      preview.answers = {};
      openPreview();
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

  wire();
  renderAll();

  // Auto-create friendly initial values if schema is empty or corrupted
  if (!schema.lineOfBusiness) schema.lineOfBusiness = "New Journey";
  if (!Array.isArray(schema.pages)) schema.pages = [];
})();
