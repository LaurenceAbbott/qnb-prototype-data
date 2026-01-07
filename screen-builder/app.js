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
        <input id="inpPag
