/* =========================================================
   Screen Builder (Option B / iframe shell)
   Excalidraw-ish: simple, clean, editable via link
   - LOB title big editable
   - Rename pages/groups inline
   - Full component palette
   - Edit options for select/radio/checkbox groups
   - Conditional logic (show/hide) + preview answers
   - No focus-loss typing bug
   - Share link via URL hash + localStorage
   ========================================================= */

const LS_KEY = "screenbuilder:doc:v2";
const HASH_KEY = "data";

const $ = (id) => document.getElementById(id);

function uid() {
  // Safari-safe unique id
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* -------------------------
   Components
-------------------------- */
const COMPONENTS = [
  { key: "text", label: "Text", type: "text", hasPlaceholder: true },
  { key: "textarea", label: "Textarea", type: "textarea", hasPlaceholder: true },
  { key: "email", label: "Email", type: "email", hasPlaceholder: true },
  { key: "number", label: "Number", type: "number", hasPlaceholder: true },
  { key: "date", label: "Date", type: "date", hasPlaceholder: false },
  { key: "time", label: "Time", type: "time", hasPlaceholder: false },
  { key: "select", label: "Select", type: "select", hasOptions: true },
  { key: "radioGroup", label: "Radio", type: "radioGroup", hasOptions: true },
  { key: "checkboxGroup", label: "Checkbox", type: "checkboxGroup", hasOptions: true },
];

/* -------------------------
   Encode / Decode for share links
-------------------------- */
function encodeDoc(doc) {
  const json = JSON.stringify(doc);
  return btoa(unescape(encodeURIComponent(json)));
}
function decodeDoc(b64) {
  const json = decodeURIComponent(escape(atob(b64)));
  return JSON.parse(json);
}
function getHashParam() {
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  const params = new URLSearchParams(hash);
  return params.get(HASH_KEY);
}
function setHashParam(value) {
  const params = new URLSearchParams(location.hash.slice(1));
  params.set(HASH_KEY, value);
  location.hash = params.toString();
}
function saveLocal(doc) {
  localStorage.setItem(LS_KEY, JSON.stringify(doc));
}
function loadLocal() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/* -------------------------
   Default doc
-------------------------- */
function defaultDoc() {
  const pageId = uid();
  const groupId = uid();
  return {
    version: 2,
    id: uid(),
    lobTitle: "Home Insurance",
    selected: { pageId, groupId, fieldId: null },
    // used to make conditional logic “feel real” while building
    previewAnswers: {}, // fieldId -> value OR array
    pages: [
      {
        id: pageId,
        title: "Page 1",
        groups: [
          {
            id: groupId,
            title: "Group 1",
            fields: []
          }
        ]
      }
    ]
  };
}

let doc = (function loadDoc() {
  const fromHash = getHashParam();
  if (fromHash) {
    try { return decodeDoc(fromHash); } catch {}
  }
  const fromLocal = loadLocal();
  if (fromLocal) return fromLocal;
  return defaultDoc();
})();

/* -------------------------
   Access helpers
-------------------------- */
function getPage(pageId = doc.selected.pageId) {
  return doc.pages.find(p => p.id === pageId) || doc.pages[0];
}
function getGroup(page, groupId = doc.selected.groupId) {
  return page.groups.find(g => g.id === groupId) || page.groups[0];
}
function getAllFieldsOnPage(page) {
  const out = [];
  page.groups.forEach(g => g.fields.forEach(f => out.push(f)));
  return out;
}
function findFieldOnPage(page, fieldId) {
  for (const g of page.groups) {
    const f = g.fields.find(x => x.id === fieldId);
    if (f) return f;
  }
  return null;
}
function ensureSelection() {
  const page = getPage(doc.selected.pageId);
  doc.selected.pageId = page.id;
  const group = getGroup(page, doc.selected.groupId);
  doc.selected.groupId = group.id;
}

/* -------------------------
   Conditional logic evaluation (preview)
-------------------------- */
function isFieldVisibleOnPage(page, field) {
  const rules = field.visibilityRules || [];
  if (!rules.length) return true;

  for (const r of rules) {
    const answer = doc.previewAnswers[r.whenFieldId];

    if (r.op === "isAnswered") {
      const ok = Array.isArray(answer) ? answer.length > 0 : (answer !== undefined && String(answer).trim() !== "");
      if (!ok) return false;
      continue;
    }

    const ruleVal = (r.value ?? "").toString();
    if (answer === undefined || answer === null) return false;

    if (Array.isArray(answer)) {
      // checkboxGroup answer
      if (r.op === "equals") {
        if (!answer.includes(ruleVal)) return false;
      } else if (r.op === "notEquals") {
        if (answer.includes(ruleVal)) return false;
      } else if (r.op === "contains") {
        if (!answer.join(" ").toLowerCase().includes(ruleVal.toLowerCase())) return false;
      }
    } else {
      const a = String(answer);
      if (r.op === "equals") {
        if (a !== ruleVal) return false;
      } else if (r.op === "notEquals") {
        if (a === ruleVal) return false;
      } else if (r.op === "contains") {
        if (!a.toLowerCase().includes(ruleVal.toLowerCase())) return false;
      }
    }
  }
  return true;
}

/* -------------------------
   Render
-------------------------- */
function renderAll() {
  ensureSelection();
  renderTop();
  renderPagination();
  renderLists();
  renderComponents();
  renderCanvas();
  renderInspector();
  renderShareState();
}

function renderTop() {
  const el = $("lobTitle");
  // Don’t stomp while user is editing
  if (document.activeElement !== el) {
    el.textContent = doc.lobTitle || "";
  }

  const page = getPage();
  const group = getGroup(page);
  $("crumbs").textContent = `${page.title}  /  ${group.title}`;
}

function renderPagination() {
  const el = $("pagination");
  el.innerHTML = "";
  doc.pages.forEach(p => {
    const dot = document.createElement("div");
    dot.className = "pageDot" + (p.id === doc.selected.pageId ? " active" : "");
    dot.title = p.title;
    dot.onclick = () => {
      doc.selected.pageId = p.id;
      doc.selected.groupId = p.groups[0]?.id || null;
      doc.selected.fieldId = null;
      commit("Changed page");
    };
    el.appendChild(dot);
  });
}

function renderLists() {
  const page = getPage();

  // Pages list (inline rename)
  const pageList = $("pageList");
  pageList.innerHTML = "";
  doc.pages.forEach((p, idx) => {
    const item = document.createElement("div");
    item.className = "listItem" + (p.id === doc.selected.pageId ? " active" : "");
    item.onclick = () => {
      doc.selected.pageId = p.id;
      doc.selected.groupId = p.groups[0]?.id || null;
      doc.selected.fieldId = null;
      commit("Selected page");
    };

    const titleWrap = document.createElement("div");
    titleWrap.style.flex = "1";
    const title = document.createElement("div");
    title.className = "listItemTitle";
    title.textContent = p.title;
    titleWrap.appendChild(title);

    title.ondblclick = (ev) => {
      ev.stopPropagation();
      startInlineEdit(titleWrap, p.title, (val) => {
        p.title = val || p.title;
        commit("Renamed page", { soft: true });
      });
    };

    const meta = document.createElement("div");
    meta.className = "listItemMeta";
    meta.textContent = String(idx + 1);

    item.appendChild(titleWrap);
    item.appendChild(meta);
    pageList.appendChild(item);
  });

  // Groups list (inline rename)
  const groupList = $("groupList");
  groupList.innerHTML = "";
  page.groups.forEach((g, idx) => {
    const item = document.createElement("div");
    item.className = "listItem" + (g.id === doc.selected.groupId ? " active" : "");
    item.onclick = () => {
      doc.selected.groupId = g.id;
      doc.selected.fieldId = null;
      commit("Selected group");
    };

    const titleWrap = document.createElement("div");
    titleWrap.style.flex = "1";
    const title = document.createElement("div");
    title.className = "listItemTitle";
    title.textContent = g.title;
    titleWrap.appendChild(title);

    title.ondblclick = (ev) => {
      ev.stopPropagation();
      startInlineEdit(titleWrap, g.title, (val) => {
        g.title = val || g.title;
        commit("Renamed group", { soft: true });
      });
    };

    const meta = document.createElement("div");
    meta.className = "listItemMeta";
    meta.textContent = String(idx + 1);

    item.appendChild(titleWrap);
    item.appendChild(meta);
    groupList.appendChild(item);
  });
}

function renderComponents() {
  const wrap = $("componentList");
  wrap.innerHTML = "";
  COMPONENTS.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "compBtn";
    btn.textContent = c.label;
    btn.onclick = () => addField(c);
    wrap.appendChild(btn);
  });
}

function renderCanvas() {
  const page = getPage();
  const canvas = $("canvas");
  canvas.innerHTML = "";

  page.groups.forEach(group => {
    const groupCard = document.createElement("div");
    groupCard.className = "groupCard";

    const gh = document.createElement("div");
    gh.className = "groupHeader";

    const gt = document.createElement("div");
    gt.className = "groupTitle";
    gt.textContent = group.title;

    gh.appendChild(gt);
    groupCard.appendChild(gh);

    if (!group.fields.length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "Add components from the left.";
      groupCard.appendChild(empty);
    }

    group.fields.forEach(field => {
      if (!isFieldVisibleOnPage(page, field)) return;

      const card = document.createElement("div");
      card.className = "fieldCard" + (field.id === doc.selected.fieldId ? " selected" : "");
      card.onclick = () => {
        doc.selected.fieldId = field.id;
        renderInspector(); // no full rerender needed
      };

      const top = document.createElement("div");
      top.className = "fieldTop";

      const label = document.createElement("div");
      label.className = "fieldLabel";
      label.textContent = field.label || "(No label)";

      const type = document.createElement("div");
      type.className = "fieldType";
      type.textContent = field.type;

      top.appendChild(label);
      top.appendChild(type);
      card.appendChild(top);

      if (field.help) {
        const help = document.createElement("div");
        help.className = "fieldHelp";
        help.textContent = field.help;
        card.appendChild(help);
      }

      const preview = document.createElement("div");
      preview.className = "preview";

      preview.appendChild(renderPreviewControl(page, field));

      card.appendChild(preview);
      groupCard.appendChild(card);
    });

    canvas.appendChild(groupCard);
  });
}

function renderPreviewControl(page, field) {
  const type = field.type;

  // Text-like
  if (["text","email","number","date","time"].includes(type)) {
    const input = document.createElement("input");
    input.type = type === "text" ? "text" : type;
    input.placeholder = field.placeholder || "";
    input.value = doc.previewAnswers[field.id] ?? "";
    input.oninput = (e) => {
      doc.previewAnswers[field.id] = e.target.value;
      saveLocal(doc);
      // conditional logic may change visibility
      renderCanvas();
    };
    return input;
  }

  if (type === "textarea") {
    const ta = document.createElement("textarea");
    ta.rows = 3;
    ta.placeholder = field.placeholder || "";
    ta.value = doc.previewAnswers[field.id] ?? "";
    ta.oninput = (e) => {
      doc.previewAnswers[field.id] = e.target.value;
      saveLocal(doc);
      renderCanvas();
    };
    return ta;
  }

  if (type === "select") {
    const sel = document.createElement("select");
    const opts = field.options || [];
    opts.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      sel.appendChild(opt);
    });
    const current = doc.previewAnswers[field.id];
    if (current !== undefined) sel.value = current;
    sel.onchange = (e) => {
      doc.previewAnswers[field.id] = e.target.value;
      saveLocal(doc);
      renderCanvas();
    };
    return sel;
  }

  if (type === "radioGroup") {
    const wrap = document.createElement("div");
    const opts = field.options || [];
    const current = doc.previewAnswers[field.id] ?? "";
    opts.forEach(o => {
      const row = document.createElement("div");
      row.className = "choiceRow";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = field.id;
      input.value = o.value;
      input.checked = current === o.value;
      input.onchange = (e) => {
        doc.previewAnswers[field.id] = e.target.value;
        saveLocal(doc);
        renderCanvas();
      };
      const lab = document.createElement("label");
      lab.textContent = o.label;
      row.appendChild(input);
      row.appendChild(lab);
      wrap.appendChild(row);
    });
    return wrap;
  }

  if (type === "checkboxGroup") {
    const wrap = document.createElement("div");
    const opts = field.options || [];
    const current = Array.isArray(doc.previewAnswers[field.id]) ? doc.previewAnswers[field.id] : [];
    opts.forEach(o => {
      const row = document.createElement("div");
      row.className = "choiceRow";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = o.value;
      input.checked = current.includes(o.value);
      input.onchange = (e) => {
        const next = new Set(current);
        if (e.target.checked) next.add(o.value);
        else next.delete(o.value);
        doc.previewAnswers[field.id] = Array.from(next);
        saveLocal(doc);
        renderCanvas();
      };
      const lab = document.createElement("label");
      lab.textContent = o.label;
      row.appendChild(input);
      row.appendChild(lab);
      wrap.appendChild(row);
    });
    return wrap;
  }

  // fallback
  const input = document.createElement("input");
  input.type = "text";
  return input;
}

function renderInspector() {
  const wrap = $("inspector");
  wrap.innerHTML = "";

  const page = getPage();
  const field = findFieldOnPage(page, doc.selected.fieldId);

  if (!field) {
    wrap.innerHTML = `<div class="hint">Select a field to edit its properties.</div>`;
    return;
  }

  // Basic fields
  wrap.appendChild(fieldBlock("Label", textInput(field.label || "", (v) => { field.label = v; softSave(); renderCanvas(); })));
  wrap.appendChild(fieldBlock("Help text", textArea(field.help || "", (v) => { field.help = v; softSave(); renderCanvas(); })));
  wrap.appendChild(fieldBlock("Placeholder", textInput(field.placeholder || "", (v) => { field.placeholder = v; softSave(); renderCanvas(); })));

  // Options editor for select/radio/checkbox groups
  if (["select","radioGroup","checkboxGroup"].includes(field.type)) {
    const lines = (field.options || []).map(o => `${o.value} | ${o.label}`).join("\n");
    const ta = textArea(lines, (v) => {
      field.options = parseOptions(v);
      softSave();
      renderCanvas();
      renderInspector(); // keep textarea consistent if formatting changes
    });
    ta.rows = 7;
    wrap.appendChild(fieldBlock("Options (one per line: value | label)", ta));
  }

  // Conditional logic
  wrap.appendChild(renderConditionalEditor(page, field));

  // Delete
  const del = document.createElement("button");
  del.className = "smallBtn";
  del.textContent = "Delete field";
  del.onclick = () => {
    deleteField(page, field.id);
    doc.selected.fieldId = null;
    commit("Deleted field");
  };
  wrap.appendChild(del);
}

function renderConditionalEditor(page, field) {
  field.visibilityRules = field.visibilityRules || [];

  const container = document.createElement("div");
  container.className = "field";
  const lab = document.createElement("label");
  lab.textContent = "Conditional logic";
  container.appendChild(lab);

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Show this field only when all rules match (preview answers drive this).";
  container.appendChild(hint);

  const rulesWrap = document.createElement("div");
  container.appendChild(rulesWrap);

  const candidates = getAllFieldsOnPage(page).filter(f => f.id !== field.id);

  if (!field.visibilityRules.length) {
    const none = document.createElement("div");
    none.className = "hint";
    none.style.marginTop = "8px";
    none.textContent = "No rules yet.";
    rulesWrap.appendChild(none);
  }

  field.visibilityRules.forEach((r) => {
    const rule = document.createElement("div");
    rule.className = "rule";

    const whenSel = document.createElement("select");
    candidates.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label || c.type;
      if (c.id === r.whenFieldId) opt.selected = true;
      whenSel.appendChild(opt);
    });

    const opSel = document.createElement("select");
    [
      ["equals","equals"],
      ["notEquals","not equals"],
      ["contains","contains"],
      ["isAnswered","is answered"]
    ].forEach(([val, txt]) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = txt;
      if (r.op === val) opt.selected = true;
      opSel.appendChild(opt);
    });

    const valInput = document.createElement("input");
    valInput.type = "text";
    valInput.value = r.value || "";
    valInput.placeholder = "Value";

    const del = document.createElement("button");
    del.className = "smallBtn";
    del.textContent = "×";
    del.title = "Delete rule";

    // No full re-render while typing:
    whenSel.onchange = (e) => { r.whenFieldId = e.target.value; softSave(); renderCanvas(); };
    opSel.onchange = (e) => { r.op = e.target.value; softSave(); renderCanvas(); renderInspector(); };
    valInput.oninput = (e) => { r.value = e.target.value; softSave(); renderCanvas(); };
    del.onclick = () => {
      field.visibilityRules = field.visibilityRules.filter(x => x.id !== r.id);
      commit("Deleted rule");
    };

    const row = document.createElement("div");
    row.className = "row";

    const col1 = document.createElement("div");
    col1.className = "field";
    col1.style.marginBottom = "0";
    const l1 = document.createElement("label"); l1.textContent = "When";
    col1.appendChild(l1); col1.appendChild(whenSel);

    const col2 = document.createElement("div");
    col2.className = "field";
    col2.style.marginBottom = "0";
    const l2 = document.createElement("label"); l2.textContent = "Operator";
    col2.appendChild(l2); col2.appendChild(opSel);

    row.appendChild(col1);
    row.appendChild(col2);

    rule.appendChild(row);

    const row2 = document.createElement("div");
    row2.className = "row";
    row2.style.marginTop = "8px";

    const col3 = document.createElement("div");
    col3.className = "field";
    col3.style.marginBottom = "0";
    const l3 = document.createElement("label"); l3.textContent = "Value";
    col3.appendChild(l3);
    col3.appendChild(valInput);

    const col4 = document.createElement("div");
    col4.style.display = "flex";
    col4.style.alignItems = "flex-end";
    col4.style.justifyContent = "flex-end";
    col4.appendChild(del);

    row2.appendChild(col3);
    row2.appendChild(col4);

    rule.appendChild(row2);

    rulesWrap.appendChild(rule);
  });

  const add = document.createElement("button");
  add.className = "btn";
  add.style.marginTop = "10px";
  add.textContent = "Add rule";
  add.onclick = () => {
    const first = candidates[0];
    field.visibilityRules.push({
      id: uid(),
      whenFieldId: first ? first.id : "",
      op: "equals",
      value: ""
    });
    commit("Added rule");
  };
  container.appendChild(add);

  return container;
}

/* -------------------------
   Inline editing helper (page/group names)
-------------------------- */
function startInlineEdit(container, currentValue, onDone) {
  container.innerHTML = "";
  const input = document.createElement("input");
  input.className = "inlineEdit";
  input.value = currentValue;
  container.appendChild(input);
  input.focus();
  input.select();

  const finish = () => {
    const val = input.value.trim();
    onDone(val);
  };

  input.onkeydown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(); }
    if (e.key === "Escape") { e.preventDefault(); onDone(currentValue); }
  };
  input.onblur = finish;
}

/* -------------------------
   Small UI helpers
-------------------------- */
function fieldBlock(label, control) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const l = document.createElement("label");
  l.textContent = label;
  wrap.appendChild(l);
  wrap.appendChild(control);
  return wrap;
}
function textInput(value, onInput) {
  const i = document.createElement("input");
  i.type = "text";
  i.value = value;
  i.oninput = (e) => onInput(e.target.value);
  return i;
}
function textArea(value, onInput) {
  const t = document.createElement("textarea");
  t.value = value;
  t.oninput = (e) => onInput(e.target.value);
  return t;
}
function parseOptions(text) {
  const lines = (text || "").split("\n").map(s => s.trim()).filter(Boolean);
  return lines.map(line => {
    const parts = line.split("|").map(p => p.trim());
    const value = parts[0] || "";
    const label = parts[1] || parts[0] || "";
    return { value, label };
  });
}

/* -------------------------
   Mutations
-------------------------- */
function addPage() {
  const id = uid();
  const groupId = uid();
  doc.pages.push({
    id,
    title: `Page ${doc.pages.length + 1}`,
    groups: [{ id: groupId, title: "Group 1", fields: [] }]
  });
  doc.selected.pageId = id;
  doc.selected.groupId = groupId;
  doc.selected.fieldId = null;
  commit("Added page");
}

function addGroup() {
  const page = getPage();
  const id = uid();
  page.groups.push({ id, title: `Group ${page.groups.length + 1}`, fields: [] });
  doc.selected.groupId = id;
  doc.selected.fieldId = null;
  commit("Added group");
}

function addField(component) {
  const page = getPage();
  const group = getGroup(page);

  const base = {
    id: uid(),
    type: component.type,
    label: component.label,
    help: "",
    placeholder: component.hasPlaceholder ? `e.g. ${component.label}` : "",
    options: component.hasOptions ? [
      { value: "Option 1", label: "Option 1" },
      { value: "Option 2", label: "Option 2" },
    ] : [],
    visibilityRules: []
  };

  group.fields.push(base);
  doc.selected.fieldId = base.id;
  commit(`Added ${component.label}`);
}

function deleteField(page, fieldId) {
  page.groups.forEach(g => {
    g.fields = g.fields.filter(f => f.id !== fieldId);
  });
  // Also remove any rules pointing to it
  page.groups.forEach(g => g.fields.forEach(f => {
    f.visibilityRules = (f.visibilityRules || []).filter(r => r.whenFieldId !== fieldId);
  }));
  // Remove preview answer
  delete doc.previewAnswers[fieldId];
}

/* -------------------------
   Persist / Commit
-------------------------- */
let softTimer = null;

function softSave() {
  // save local + hash (debounced) without clobbering focus
  saveLocal(doc);
  if (softTimer) clearTimeout(softTimer);
  softTimer = setTimeout(() => {
    try { setHashParam(encodeDoc(doc)); } catch {}
    renderShareState();
  }, 150);
}

function commit(status, opts = {}) {
  $("statusText").textContent = status;
  saveLocal(doc);

  if (!opts.soft) {
    try { setHashParam(encodeDoc(doc)); } catch {}
  }
  renderAll();
}

function renderShareState() {
  $("shareState").textContent = getHashParam() ? "Link" : "Local";
}

/* -------------------------
   Wiring
-------------------------- */
function wire() {
  // LOB title (big editable)
  const lob = $("lobTitle");
  lob.addEventListener("input", () => {
    doc.lobTitle = lob.textContent.trim();
    softSave();
    $("statusText").textContent = "Edited LOB title";
  });
  lob.addEventListener("blur", () => {
    doc.lobTitle = lob.textContent.trim();
    commit("Updated LOB title", { soft: true });
  });

  $("addPage").onclick = addPage;
  $("addGroup").onclick = addGroup;

  $("btnNew").onclick = () => {
    doc = defaultDoc();
    history.replaceState(null, "", location.pathname + location.search);
    commit("New document");
  };

  $("btnCopy").onclick = async () => {
    try { setHashParam(encodeDoc(doc)); } catch {}
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      $("statusText").textContent = "Link copied";
    } catch {
      $("statusText").textContent = "Copy failed (browser blocked)";
    }
    renderShareState();
  };

  window.addEventListener("hashchange", () => {
    const h = getHashParam();
    if (!h) return;
    try {
      doc = decodeDoc(h);
      saveLocal(doc);
      renderAll();
      $("statusText").textContent = "Loaded from link";
    } catch {}
  });
}

/* -------------------------
   Boot
-------------------------- */
wire();
renderAll();
