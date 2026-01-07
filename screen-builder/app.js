/* Screen Builder MVP (Excalidraw-inspired)
   - Doc stored in URL hash (#data=...) and localStorage
   - No backend, no extra JSON files
*/

const LS_KEY = "screenbuilder:lastDocV1";
const HASH_KEY = "data";

const $ = (sel) => document.querySelector(sel);

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

function defaultDoc() {
  const pageId = uid();
  const groupId = uid();
  return {
    version: 1,
    id: uid(),
    title: "Home",
    selected: { pageId, groupId, elementId: null },
    pages: [
      {
        id: pageId,
        title: "Page 1",
        groups: [
          { id: groupId, title: "Group 1", elements: [] }
        ],
      },
    ],
  };
}

/** Simple hash encoding (base64 of JSON). MVP first.
    If URLs get too long, we swap this encoder for LZ compression later. */
function encodeDoc(doc) {
  const json = JSON.stringify(doc);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64;
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

function loadDoc() {
  const fromHash = getHashParam();
  if (fromHash) {
    try { return decodeDoc(fromHash); } catch {}
  }
  const fromLocal = loadLocal();
  if (fromLocal) return fromLocal;
  return defaultDoc();
}

let doc = loadDoc();

/* -------------------- helpers to access selection -------------------- */
function getPage(pageId) {
  return doc.pages.find(p => p.id === pageId) || doc.pages[0];
}
function getGroup(page, groupId) {
  return page.groups.find(g => g.id === groupId) || page.groups[0];
}
function getElement(group, elementId) {
  return group.elements.find(e => e.id === elementId) || null;
}

function ensureSelection() {
  const page = getPage(doc.selected.pageId);
  doc.selected.pageId = page.id;
  const group = getGroup(page, doc.selected.groupId);
  doc.selected.groupId = group.id;
}

/* -------------------- rendering -------------------- */
function render() {
  ensureSelection();

  // title
  $("#formTitle").value = doc.title || "";

  const page = getPage(doc.selected.pageId);
  const group = getGroup(page, doc.selected.groupId);

  // crumbs
  $("#crumbs").textContent = `${page.title}  /  ${group.title}`;

  // left lists
  renderPageList();
  renderGroupList();

  // centre elements
  renderCanvas(group);

  // right inspector
  renderInspector(page, group);

  // share indicator
  $("#shareState").textContent = getHashParam() ? "Link" : "Local";
}

function renderPageList() {
  const el = $("#pageList");
  el.innerHTML = "";
  doc.pages.forEach((p, idx) => {
    const item = document.createElement("div");
    item.className = "listItem" + (p.id === doc.selected.pageId ? " is-active" : "");
    item.innerHTML = `
      <div class="listItem__title">${escapeHtml(p.title)}</div>
      <div class="listItem__meta">${idx + 1}</div>
    `;
    item.onclick = () => {
      doc.selected.pageId = p.id;
      doc.selected.groupId = p.groups[0]?.id || null;
      doc.selected.elementId = null;
      commit("Selected page");
    };
    el.appendChild(item);
  });
}

function renderGroupList() {
  const el = $("#groupList");
  el.innerHTML = "";

  const page = getPage(doc.selected.pageId);
  page.groups.forEach((g, idx) => {
    const item = document.createElement("div");
    item.className = "listItem" + (g.id === doc.selected.groupId ? " is-active" : "");
    item.innerHTML = `
      <div class="listItem__title">${escapeHtml(g.title)}</div>
      <div class="listItem__meta">${idx + 1}</div>
    `;
    item.onclick = () => {
      doc.selected.groupId = g.id;
      doc.selected.elementId = null;
      commit("Selected group");
    };
    el.appendChild(item);
  });
}

function renderCanvas(group) {
  const wrap = $("#canvasBody");
  wrap.innerHTML = "";

  if (!group.elements.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.style.padding = "24px 8px";
    empty.textContent = "Add an element from the toolbar.";
    wrap.appendChild(empty);
    return;
  }

  group.elements.forEach((e, idx) => {
    const card = document.createElement("div");
    card.className = "el" + (e.id === doc.selected.elementId ? " is-selected" : "");
    card.onclick = () => {
      doc.selected.elementId = e.id;
      commit("Selected element", { silentHash: true }); // avoid noisy hash changes
    };

    card.innerHTML = `
      <div class="el__row">
        <div>
          <div class="el__label">${escapeHtml(e.label || "(No label)")}</div>
          <div class="el__type">${e.type}</div>
        </div>

        <div class="el__controls">
          <button class="smallBtn" data-act="up" ${idx === 0 ? "disabled" : ""} title="Move up">↑</button>
          <button class="smallBtn" data-act="down" ${idx === group.elements.length - 1 ? "disabled" : ""} title="Move down">↓</button>
          <button class="smallBtn" data-act="del" title="Delete">×</button>
        </div>
      </div>
      ${e.help ? `<div class="el__help">${escapeHtml(e.help)}</div>` : ``}
    `;

    card.querySelectorAll("button").forEach(btn => {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        const act = btn.getAttribute("data-act");
        if (act === "del") {
          group.elements = group.elements.filter(x => x.id !== e.id);
          if (doc.selected.elementId === e.id) doc.selected.elementId = null;
          commit("Deleted element");
        }
        if (act === "up") {
          moveInArray(group.elements, idx, idx - 1);
          commit("Reordered");
        }
        if (act === "down") {
          moveInArray(group.elements, idx, idx + 1);
          commit("Reordered");
        }
      };
    });

    wrap.appendChild(card);
  });
}

function renderInspector(page, group) {
  const wrap = $("#inspector");
  wrap.innerHTML = "";

  const element = getElement(group, doc.selected.elementId);

  if (!element) {
    wrap.innerHTML = `
      <div class="field">
        <label>Page title</label>
        <input id="inpPageTitle" type="text" value="${escapeAttr(page.title)}" />
      </div>
      <div class="field">
        <label>Group title</label>
        <input id="inpGroupTitle" type="text" value="${escapeAttr(group.title)}" />
      </div>
      <div class="hint">Select an element to edit its properties.</div>
    `;

    $("#inpPageTitle").oninput = (e) => {
      page.title = e.target.value;
      commit("Edited page title", { silentHash: true });
    };
    $("#inpGroupTitle").oninput = (e) => {
      group.title = e.target.value;
      commit("Edited group title", { silentHash: true });
    };
    return;
  }

  // build inspector form
  const base = document.createElement("div");
  base.innerHTML = `
    <div class="field">
      <label>Label</label>
      <input id="inpLabel" type="text" value="${escapeAttr(element.label || "")}" />
    </div>

    <div class="field">
      <label>Help text</label>
      <textarea id="inpHelp" rows="3">${escapeHtml(element.help || "")}</textarea>
    </div>

    <div class="row">
      <div class="field">
        <label>Required</label>
        <select id="inpRequired">
          <option value="false" ${!element.required ? "selected" : ""}>No</option>
          <option value="true" ${element.required ? "selected" : ""}>Yes</option>
        </select>
      </div>

      <div class="field">
        <label>Type</label>
        <input type="text" value="${escapeAttr(element.type)}" disabled />
      </div>
    </div>

    <div id="optionsBlock"></div>

    <div class="field">
      <label>Conditional logic</label>
      <div class="hint">Show this element only when all rules match.</div>
      <div id="rulesBlock"></div>
      <button class="btn" id="btnAddRule" style="margin-top:8px;">Add rule</button>
    </div>
  `;
  wrap.appendChild(base);

  $("#inpLabel").oninput = (e) => { element.label = e.target.value; commit("Edited label", { silentHash: true }); };
  $("#inpHelp").oninput = (e) => { element.help = e.target.value; commit("Edited help", { silentHash: true }); };
  $("#inpRequired").onchange = (e) => { element.required = (e.target.value === "true"); commit("Edited required", { silentHash: true }); };

  // options for select
  const optionsBlock = $("#optionsBlock");
  if (element.type === "select") {
    const opts = element.options || [];
    optionsBlock.innerHTML = `
      <div class="field">
        <label>Options</label>
        <div class="hint">One per line. “value | label” supported.</div>
        <textarea id="inpOptions" rows="6">${escapeHtml(opts.map(o => o.label ? `${o.value} | ${o.label}` : o.value).join("\n"))}</textarea>
      </div>
    `;
    $("#inpOptions").oninput = (e) => {
      const lines = e.target.value.split("\n").map(s => s.trim()).filter(Boolean);
      element.options = lines.map(line => {
        const parts = line.split("|").map(p => p.trim());
        return parts.length >= 2
          ? { value: parts[0], label: parts.slice(1).join(" | ") }
          : { value: parts[0], label: parts[0] };
      });
      commit("Edited options", { silentHash: true });
    };
  } else {
    optionsBlock.innerHTML = "";
  }

  // rules
  element.visibilityRules = element.visibilityRules || [];
  renderRules(group, element);

  $("#btnAddRule").onclick = () => {
    element.visibilityRules.push({
      id: uid(),
      whenElementId: pickFirstQuestionId(group, element.id),
      op: "equals",
      value: ""
    });
    commit("Added rule");
  };
}

function renderRules(group, element) {
  const block = $("#rulesBlock");
  block.innerHTML = "";

  const candidates = group.elements.filter(e => e.id !== element.id);

  if (!element.visibilityRules.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.style.marginTop = "8px";
    hint.textContent = "No rules yet.";
    block.appendChild(hint);
    return;
  }

  element.visibilityRules.forEach((r) => {
    const wrap = document.createElement("div");
    wrap.className = "rule";

    const options = candidates.map(c => `<option value="${escapeAttr(c.id)}" ${c.id === r.whenElementId ? "selected" : ""}>${escapeHtml(c.label || c.type)}</option>`).join("");

    wrap.innerHTML = `
      <div class="row">
        <div class="field">
          <label>When</label>
          <select data-k="when">${options || `<option value="">No other elements</option>`}</select>
        </div>
        <div class="field">
          <label>Operator</label>
          <select data-k="op">
            <option value="equals" ${r.op==="equals"?"selected":""}>equals</option>
            <option value="notEquals" ${r.op==="notEquals"?"selected":""}>not equals</option>
            <option value="isAnswered" ${r.op==="isAnswered"?"selected":""}>is answered</option>
          </select>
        </div>
      </div>

      <div class="field" style="margin-bottom:0;">
        <label>Value</label>
        <input data-k="value" type="text" value="${escapeAttr(r.value || "")}" />
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="smallBtn" data-k="del" title="Delete rule">×</button>
      </div>
    `;

    wrap.querySelector('[data-k="when"]').onchange = (e) => { r.whenElementId = e.target.value; commit("Edited rule", { silentHash:true }); };
    wrap.querySelector('[data-k="op"]').onchange = (e) => { r.op = e.target.value; commit("Edited rule", { silentHash:true }); };
    wrap.querySelector('[data-k="value"]').oninput = (e) => { r.value = e.target.value; commit("Edited rule", { silentHash:true }); };
    wrap.querySelector('[data-k="del"]').onclick = () => {
      element.visibilityRules = element.visibilityRules.filter(x => x.id !== r.id);
      commit("Deleted rule");
    };

    block.appendChild(wrap);
  });
}

/* -------------------- actions -------------------- */
function commit(status, opts = {}) {
  $("#statusText").textContent = status;

  // save local always
  saveLocal(doc);

  // update hash (unless silentHash requested)
  if (!opts.silentHash) {
    try {
      const encoded = encodeDoc(doc);
      setHashParam(encoded);
    } catch (e) {
      console.warn("Failed to encode doc:", e);
    }
  }
  render();
}

function addPage() {
  const id = uid();
  const groupId = uid();
  doc.pages.push({
    id,
    title: `Page ${doc.pages.length + 1}`,
    groups: [{ id: groupId, title: "Group 1", elements: [] }],
  });
  doc.selected.pageId = id;
  doc.selected.groupId = groupId;
  doc.selected.elementId = null;
  commit("Added page");
}

function addGroup() {
  const page = getPage(doc.selected.pageId);
  const id = uid();
  page.groups.push({ id, title: `Group ${page.groups.length + 1}`, elements: [] });
  doc.selected.groupId = id;
  doc.selected.elementId = null;
  commit("Added group");
}

function addElement(type) {
  const page = getPage(doc.selected.pageId);
  const group = getGroup(page, doc.selected.groupId);

  const el = {
    id: uid(),
    type,
    label: type === "select" ? "Select" : "Question",
    help: "",
    required: false,
    options: type === "select" ? [{ value: "Option 1", label: "Option 1" }] : undefined,
    visibilityRules: []
  };

  group.elements.push(el);
  doc.selected.elementId = el.id;
  commit(`Added ${type}`);
}

/* -------------------- wiring -------------------- */
function wire() {
  $("#formTitle").addEventListener("input", (e) => {
    doc.title = e.target.value;
    commit("Edited form title", { silentHash: true });
  });

  $("#btnAddPage").onclick = addPage;
  $("#btnAddGroup").onclick = addGroup;

  document.querySelectorAll(".toolBtn").forEach(btn => {
    btn.onclick = () => addElement(btn.getAttribute("data-add"));
  });

  $("#btnNew").onclick = () => {
    doc = defaultDoc();
    // clear hash so it feels like “new”
    history.replaceState(null, "", location.pathname + location.search);
    commit("New document");
  };

  $("#btnCopyLink").onclick = async () => {
    // ensure hash exists
    try {
      const encoded = encodeDoc(doc);
      setHashParam(encoded);
    } catch {}
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      $("#statusText").textContent = "Link copied";
    } catch {
      $("#statusText").textContent = "Copy failed (browser blocked)";
    }
    render();
  };

  window.addEventListener("hashchange", () => {
    // if user pastes a link, load it
    const h = getHashParam();
    if (!h) return;
    try {
      doc = decodeDoc(h);
      saveLocal(doc);
      render();
      $("#statusText").textContent = "Loaded from link";
    } catch {}
  });
}

/* -------------------- utilities -------------------- */
function moveInArray(arr, from, to) {
  if (to < 0 || to >= arr.length) return;
  const item = arr.splice(from, 1)[0];
  arr.splice(to, 0, item);
}

function pickFirstQuestionId(group, currentId) {
  const candidate = group.elements.find(e => e.id !== currentId);
  return candidate ? candidate.id : "";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str) {
  return escapeHtml(str).replaceAll("\n", " ");
}

/* -------------------- boot -------------------- */
wire();
render();
commit("Ready", { silentHash: true });
