p.logic.rules) ? group.logic.rules : [];

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
    const contentHtml = step.content?.enabled ? sanitizeRichHtml(step
