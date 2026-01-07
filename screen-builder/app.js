const COMPONENTS = {
  text: { label: "Text", input: "text", placeholder: "Enter text" },
  textarea: { label: "Textarea", input: "textarea", placeholder: "Enter text" },
  select: { label: "Select", input: "select", options: ["Option 1","Option 2"] },
  radio: { label: "Radio", input: "radio", options: ["Option 1","Option 2"] },
  checkbox: { label: "Checkbox", input: "checkbox", options: ["Option 1"] },
  date: { label: "Date", input: "date" },
  time: { label: "Time", input: "time" },
  number: { label: "Number", input: "number" },
  email: { label: "Email", input: "email" }
};

let doc = {
  title: "",
  pages: [{
    id: crypto.randomUUID(),
    title: "Page 1",
    groups: [{
      id: crypto.randomUUID(),
      title: "Group 1",
      fields: []
    }]
  }],
  selected: { page: null, group: null, field: null }
};

doc.selected.page = doc.pages[0].id;
doc.selected.group = doc.pages[0].groups[0].id;

const el = id => document.getElementById(id);

function render() {
  el("lobTitle").value = doc.title;

  // pagination
  el("pagination").innerHTML = "";
  doc.pages.forEach(p => {
    const d = document.createElement("div");
    d.className = "page-dot" + (p.id === doc.selected.page ? " active" : "");
    d.onclick = () => { doc.selected.page = p.id; doc.selected.group = p.groups[0]?.id; render(); };
    el("pagination").appendChild(d);
  });

  // pages
  el("pageList").innerHTML = "";
  doc.pages.forEach(p => {
    const i = document.createElement("div");
    i.className = "list-item" + (p.id === doc.selected.page ? " active" : "");
    i.textContent = p.title;
    i.onclick = () => { doc.selected.page = p.id; doc.selected.group = p.groups[0]?.id; render(); };
    el("pageList").appendChild(i);
  });

  const page = doc.pages.find(p => p.id === doc.selected.page);

  // groups
  el("groupList").innerHTML = "";
  page.groups.forEach(g => {
    const i = document.createElement("div");
    i.className = "list-item" + (g.id === doc.selected.group ? " active" : "");
    i.textContent = g.title;
    i.onclick = () => { doc.selected.group = g.id; render(); };
    el("groupList").appendChild(i);
  });

  // components
  el("componentList").innerHTML = "";
  Object.entries(COMPONENTS).forEach(([key,cfg]) => {
    const b = document.createElement("button");
    b.textContent = cfg.label;
    b.onclick = () => addField(key);
    el("componentList").appendChild(b);
  });

  // canvas
  el("canvas").innerHTML = "";
  page.groups.forEach(g => {
    const wrap = document.createElement("div");
    wrap.className = "group";
    wrap.innerHTML = `<h4>${g.title}</h4>`;

    g.fields.forEach(f => {
      const ff = document.createElement("div");
      ff.className = "form-field";
      ff.onclick = () => { doc.selected.field = f.id; renderInspector(); };

      ff.innerHTML = `<label>${f.label}</label>`;
      let input;

      if (f.type === "textarea") input = document.createElement("textarea");
      else if (f.type === "select") {
        input = document.createElement("select");
        f.options.forEach(o => {
          const opt = document.createElement("option");
          opt.textContent = o;
          input.appendChild(opt);
        });
      } else {
        input = document.createElement("input");
        input.type = f.type;
      }

      input.placeholder = f.placeholder || "";
      ff.appendChild(input);
      wrap.appendChild(ff);
    });

    el("canvas").appendChild(wrap);
  });

  renderInspector();
}

function addField(type) {
  const page = doc.pages.find(p => p.id === doc.selected.page);
  const group = page.groups.find(g => g.id === doc.selected.group);

  group.fields.push({
    id: crypto.randomUUID(),
    type: COMPONENTS[type].input,
    label: COMPONENTS[type].label,
    placeholder: COMPONENTS[type].placeholder || "",
    options: COMPONENTS[type].options || []
  });

  render();
}

function renderInspector() {
  const wrap = el("inspector");
  wrap.innerHTML = "";

  const page = doc.pages.find(p => p.id === doc.selected.page);
  const group = page.groups.find(g => g.id === doc.selected.group);
  const field = group.fields.find(f => f.id === doc.selected.field);

  if (!field) {
    wrap.innerHTML = `<div class="hint">Select a field to edit</div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="inspector-field">
      <label>Label</label>
      <input value="${field.label}">
    </div>
    <div class="inspector-field">
      <label>Placeholder</label>
      <input value="${field.placeholder || ""}">
    </div>
  `;

  const inputs = wrap.querySelectorAll("input");
  inputs[0].oninput = e => field.label = e.target.value;
  inputs[1].oninput = e => field.placeholder = e.target.value;
}

el("lobTitle").oninput = e => doc.title = e.target.value;
el("addPage").onclick = () => {
  doc.pages.push({
    id: crypto.randomUUID(),
    title: `Page ${doc.pages.length + 1}`,
    groups: []
  });
  render();
};
el("addGroup").onclick = () => {
  const page = doc.pages.find(p => p.id === doc.selected.page);
  page.groups.push({ id: crypto.randomUUID(), title:`Group ${page.groups.length + 1}`, fields:[] });
  render();
};

render();
