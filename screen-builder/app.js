/* =========================================================
   Screen Builder – Stable Core JS
   Option B (iframe shell)
   No crypto.randomUUID
   No focus-breaking re-renders
   ========================================================= */

/* -------------------------
   Utilities
-------------------------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const $ = (id) => document.getElementById(id);

/* -------------------------
   Component Registry
-------------------------- */
const COMPONENTS = {
  text:      { label: "Text",      input: "text",     placeholder: "Enter text" },
  textarea:  { label: "Textarea",  input: "textarea", placeholder: "Enter text" },
  select:    { label: "Select",    input: "select",   options: ["Option 1","Option 2"] },
  radio:     { label: "Radio",     input: "radio",    options: ["Option 1","Option 2"] },
  checkbox:  { label: "Checkbox",  input: "checkbox", options: ["Option 1"] },
  date:      { label: "Date",      input: "date" },
  time:      { label: "Time",      input: "time" },
  number:    { label: "Number",    input: "number" },
  email:     { label: "Email",     input: "email" }
};

/* -------------------------
   Document State
-------------------------- */
let doc = {
  title: "",
  pages: [
    {
      id: uid(),
      title: "Page 1",
      groups: [
        {
          id: uid(),
          title: "Group 1",
          fields: []
        }
      ]
    }
  ],
  selected: {
    pageId: null,
    groupId: null,
    fieldId: null
  }
};

doc.selected.pageId  = doc.pages[0].id;
doc.selected.groupId = doc.pages[0].groups[0].id;

/* -------------------------
   Rendering
-------------------------- */
function render() {
  renderTop();
  renderPagination();
  renderPages();
  renderGroups();
  renderComponents();
  renderCanvas();
  renderInspector();
}

/* ---------- Top ---------- */
function renderTop() {
  $("lobTitle").value = doc.title;
}

/* ---------- Pagination ---------- */
function renderPagination() {
  const el = $("pagination");
  el.innerHTML = "";

  doc.pages.forEach(p => {
    const dot = document.createElement("div");
    dot.className = "page-dot" + (p.id === doc.selected.pageId ? " active" : "");
    dot.onclick = () => {
      doc.selected.pageId  = p.id;
      doc.selected.groupId = p.groups[0]?.id || null;
      doc.selected.fieldId = null;
      render();
    };
    el.appendChild(dot);
  });
}

/* ---------- Pages ---------- */
function renderPages() {
  const el = $("pageList");
  el.innerHTML = "";

  doc.pages.forEach(p => {
    const item = document.createElement("div");
    item.className = "list-item" + (p.id === doc.selected.pageId ? " active" : "");
    item.textContent = p.title;
    item.onclick = () => {
      doc.selected.pageId  = p.id;
      doc.selected.groupId = p.groups[0]?.id || null;
      doc.selected.fieldId = null;
      render();
    };
    el.appendChild(item);
  });
}

/* ---------- Groups ---------- */
function renderGroups() {
  const el = $("groupList");
  el.innerHTML = "";

  const page = getPage();
  if (!page) return;

  page.groups.forEach(g => {
    const item = document.createElement("div");
    item.className = "list-item" + (g.id === doc.selected.groupId ? " active" : "");
    item.textContent = g.title;
    item.onclick = () => {
      doc.selected.groupId = g.id;
      doc.selected.fieldId = null;
      render();
    };
    el.appendChild(item);
  });
}

/* ---------- Component Palette ---------- */
function renderComponents() {
  const el = $("componentList");
  el.innerHTML = "";

  Object.keys(COMPONENTS).forEach(key => {
    const btn = document.createElement("button");
    btn.textContent = COMPONENTS[key].label;
    btn.onclick = () => addField(key);
    el.appendChild(btn);
  });
}

/* ---------- Canvas (ALL groups visible) ---------- */
function renderCanvas() {
  const el = $("canvas");
  el.innerHTML = "";

  const page = getPage();
  if (!page) return;

  page.groups.forEach(group => {
    const wrap = document.createElement("div");
    wrap.className = "group";

    const h = document.createElement("h4");
    h.textContent = group.title;
    wrap.appendChild(h);

    group.fields.forEach(field => {
      const ff = document.createElement("div");
      ff.className = "form-field";
      ff.onclick = () => {
        doc.selected.fieldId = field.id;
        renderInspector();
      };

      const label = document.createElement("label");
      label.textContent = field.label;
      ff.appendChild(label);

      let input;
      if (field.type === "textarea") {
        input = document.createElement("textarea");
      } else if (field.type === "select") {
        input = document.createElement("select");
        field.options.forEach(o => {
          const opt = document.createElement("option");
          opt.textContent = o;
          input.appendChild(opt);
        });
      } else if (field.type === "radio" || field.type === "checkbox") {
        input = document.createElement("div");
        field.options.forEach(o => {
          const row = document.createElement("label");
          const i = document.createElement("input");
          i.type = field.type;
          row.appendChild(i);
          row.append(" " + o);
          input.appendChild(row);
        });
      } else {
        input = document.createElement("input");
        input.type = field.type;
      }

      if (input.placeholder !== undefined) {
        input.placeholder = field.placeholder || "";
      }

      ff.appendChild(input);
      wrap.appendChild(ff);
    });

    el.appendChild(wrap);
  });
}

/* ---------- Inspector (NO re-render on input) ---------- */
function renderInspector() {
  const el = $("inspector");
  el.innerHTML = "";

  const field = getField();
  if (!field) {
    el.innerHTML = `<div class="hint">Select a field to edit</div>`;
    return;
  }

  const label = document.createElement("input");
  label.value = field.label;

  const placeholder = document.createElement("input");
  placeholder.value = field.placeholder || "";

  label.oninput = (e) => field.label = e.target.value;
  placeholder.oninput = (e) => field.placeholder = e.target.value;

  el.appendChild(makeInspector("Label", label));
  el.appendChild(makeInspector("Placeholder", placeholder));
}

/* -------------------------
   Actions
-------------------------- */
function addField(typeKey) {
  const group = getGroup();
  if (!group) return;

  const cfg = COMPONENTS[typeKey];

  group.fields.push({
    id: uid(),
    type: cfg.input,
    label: cfg.label,
    placeholder: cfg.placeholder || "",
    options: cfg.options ? [...cfg.options] : []
  });

  render();
}

/* -------------------------
   Helpers
-------------------------- */
function getPage() {
  return doc.pages.find(p => p.id === doc.selected.pageId);
}

function getGroup() {
  const page = getPage();
  return page?.groups.find(g => g.id === doc.selected.groupId);
}

function getField() {
  const group = getGroup();
  return group?.fields.find(f => f.id === doc.selected.fieldId);
}

function makeInspector(labelText, input) {
  const wrap = document.createElement("div");
  wrap.className = "inspector-field";

  const l = document.createElement("label");
  l.textContent = labelText;

  wrap.appendChild(l);
  wrap.appendChild(input);
  return wrap;
}

/* -------------------------
   Wiring
-------------------------- */
$("lobTitle").oninput = (e) => doc.title = e.target.value;

$("addPage").onclick = () => {
  doc.pages.push({
    id: uid(),
    title: `Page ${doc.pages.length + 1}`,
    groups: []
  });
  render();
};

$("addGroup").onclick = () => {
  const page = getPage();
  page.groups.push({
    id: uid(),
    title: `Group ${page.groups.length + 1}`,
    fields: []
  });
  render();
};

/* -------------------------
   Boot
-------------------------- */
render();
