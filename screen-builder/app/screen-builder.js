(function(){
  // ===== CONFIG =====
 // ===== CONFIG =====
const CONFIG = window.SB_CONFIG || {
  journeyUrl: "",
  codelistUrls: [],
  publishEndpoint: ""
};


  // ===== STATE =====
  const state = {
    journey: null,
    codelists: new Map(),
    selected: { kind: "journey", pageId: null, groupId: null, questionId: null },
    preview: { pageIndex: 0 },
    answers: {},
    errors: {}
  };

  const uid = (prefix) => prefix + "_" + Math.random().toString(16).slice(2,10);
  const toast = (msg) => {
    const el = document.getElementById("sb-toast");
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(()=> el.style.display="none", 2600);
  };

  // ===== RENDER =====
  function render(){
    const root = document.getElementById("sb-app");
    root.innerHTML = `
      <div class="sb">
        <div class="sb-topbar">
          <div class="sb-brand">
            <div class="sb-dot"></div>
            <div class="sb-title">
              <strong>Screen Builder</strong>
              <span>${state.journey ? `${state.journey.name} • ${state.journey.lob} • schema v${state.journey.schemaVersion}` : "Loading..."}</span>
            </div>
          </div>
          <div class="sb-actions">
            <div class="sb-pill">Source: <code>GitHub</code></div>
            <button class="sb-btn" id="sb-export">Export JSON</button>
            <button class="sb-btn primary" id="sb-publish" ${CONFIG.publishEndpoint ? "" : "disabled"} title="${CONFIG.publishEndpoint ? "" : "Set CONFIG.publishEndpoint to enable publishing"}">
              Publish
            </button>
            <button class="sb-btn danger" id="sb-reset">Reset preview</button>
          </div>
        </div>

        <div class="sb-grid">
          <div class="sb-left">
            <div class="sb-search">
              <input class="sb-input" id="sb-filter" placeholder="Search pages / questions..." />
              <button class="sb-btn" id="sb-add-page">+ Page</button>
            </div>

            <div class="sb-section-title">
              <span>Journey structure</span>
              <span class="sb-mini">${state.journey ? `${state.journey.pages.length} pages` : ""}</span>
            </div>

            <div class="sb-tree" id="sb-tree"></div>
          </div>

          <div class="sb-mid">
            <div class="sb-preview-card">
              <div class="sb-preview-head">
                <div>
                  <h2 id="sb-preview-title">Preview</h2>
                  <p id="sb-preview-sub">Render from the same schema you export.</p>
                </div>
                <div class="sb-page-nav" id="sb-page-nav"></div>
              </div>
              <div class="sb-preview-body" id="sb-preview"></div>
            </div>
          </div>

          <div class="sb-right" id="sb-props"></div>
        </div>
      </div>
      <div class="sb-toast" id="sb-toast"></div>
    `;

    bindTopbar();
    renderTree();
    renderPreview();
    renderProps();
  }

  function renderTree(){
    const tree = document.getElementById("sb-tree");
    if(!state.journey){ tree.innerHTML = ""; return; }
    const filter = (document.getElementById("sb-filter")?.value || "").toLowerCase();

    const nodes = [];
    state.journey.pages.forEach((p, pi) => {
      const pageMatch = (p.title || "").toLowerCase().includes(filter);
      let pageHasMatch = pageMatch;

      const groupHtml = (p.groups||[]).map(g => {
        const qHtml = (g.questions||[]).map(q => {
          const qMatch = (q.label||"").toLowerCase().includes(filter) || (q.key||"").toLowerCase().includes(filter);
          if(qMatch) pageHasMatch = true;
          if(filter && !qMatch && !pageMatch) return "";
          const active = state.selected.kind==="question" && state.selected.questionId===q.id ? "active" : "";
          return `
            <div class="sb-node ${active}" data-kind="question" data-page="${p.id}" data-group="${g.id}" data-question="${q.id}">
              <div><strong>${escapeHtml(q.label || "(Untitled question)")}</strong> <span class="sb-badge">${q.type}</span></div>
              <div class="meta">${escapeHtml(q.key || "")}</div>
            </div>
          `;
        }).join("");

        const gActive = state.selected.kind==="group" && state.selected.groupId===g.id ? "active" : "";
        const gMatch = (g.title||"").toLowerCase().includes(filter);
        if(gMatch) pageHasMatch = true;
        if(filter && !gMatch && !pageHasMatch && !qHtml.trim()) return "";

        return `
          <div class="sb-node ${gActive}" data-kind="group" data-page="${p.id}" data-group="${g.id}">
            <div><strong>${escapeHtml(g.title || "Group")}</strong> <span class="sb-badge">${(g.questions||[]).length} q</span></div>
            <div class="meta">Group</div>
          </div>
          ${qHtml}
        `;
      }).join("");

      if(filter && !pageHasMatch && !groupHtml.trim()) return;

      const pActive = state.selected.kind==="page" && state.selected.pageId===p.id ? "active" : "";
      nodes.push(`
        <div class="sb-node ${pActive}" data-kind="page" data-page="${p.id}">
          <div><strong>${escapeHtml(p.title || "Untitled page")}</strong> <span class="sb-badge">Page ${pi+1}</span></div>
          <div class="meta">${(p.groups||[]).reduce((n,g)=>n+(g.questions||[]).length,0)} questions</div>
        </div>
        ${groupHtml}
      `);
    });

    tree.innerHTML = nodes.join("") || `<div class="sb-mini">No matches.</div>`;

    tree.querySelectorAll(".sb-node").forEach(n => {
      n.addEventListener("click", () => {
        const kind = n.dataset.kind;
        state.selected = {
          kind,
          pageId: n.dataset.page || null,
          groupId: n.dataset.group || null,
          questionId: n.dataset.question || null
        };
        // Sync preview to selected page
        if(state.selected.pageId){
          const idx = state.journey.pages.findIndex(p=>p.id===state.selected.pageId);
          if(idx>=0) state.preview.pageIndex = idx;
        }
        render();
      });
    });

    document.getElementById("sb-filter").addEventListener("input", renderTree);
    document.getElementById("sb-add-page").addEventListener("click", addPage);
  }

  function renderPreview(){
    if(!state.journey) return;

    const nav = document.getElementById("sb-page-nav");
    nav.innerHTML = state.journey.pages.map((p, idx) => `
      <div class="sb-chip ${idx===state.preview.pageIndex ? "active":""}" data-idx="${idx}">${idx+1}: ${escapeHtml(p.title||"Page")}</div>
    `).join("");

    nav.querySelectorAll(".sb-chip").forEach(ch => {
      ch.addEventListener("click", () => {
        state.preview.pageIndex = parseInt(ch.dataset.idx,10);
        state.selected = { kind:"page", pageId: state.journey.pages[state.preview.pageIndex].id, groupId:null, questionId:null };
        render();
      });
    });

    const page = state.journey.pages[state.preview.pageIndex];
    document.getElementById("sb-preview-title").textContent = page ? page.title : "Preview";

    const container = document.getElementById("sb-preview");
    if(!page){ container.innerHTML = `<div class="sb-mini">No page found.</div>`; return; }

    // Render groups/questions, respecting show/hide logic
    const html = (page.groups||[]).map(g => {
      const qHtml = (g.questions||[]).map(q => {
        if(!isVisible(q)) return "";
        const val = state.answers[q.key] ?? "";
        const hasError = !!state.errors[q.key];

        const field = renderField(q, val);
        return `
          <div class="sb-q">
            <label>${escapeHtml(q.label||"")}${q.validation?.required ? ' <span style="color:var(--accent)">*</span>' : ""}</label>
            ${field}
            ${q.helperText ? `<div class="sb-help">${escapeHtml(q.helperText)}</div>` : ""}
            <div class="sb-error" style="${hasError ? "display:block":""}">${escapeHtml(state.errors[q.key]||"")}</div>
          </div>
        `;
      }).join("");

      return `
        <div class="sb-group">
          <h3>${escapeHtml(g.title||"Group")}</h3>
          ${qHtml || `<div class="sb-mini">No visible questions in this group.</div>`}
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="sb-btn" data-addq="${g.id}">+ Question</button>
            <button class="sb-btn" data-delg="${g.id}">Delete group</button>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      ${html}
      <div style="display:flex; gap:10px; justify-content:space-between; margin-top:12px;">
        <button class="sb-btn" id="sb-add-group">+ Group</button>
        <div style="display:flex; gap:10px;">
          <button class="sb-btn" id="sb-validate">Validate page</button>
          <button class="sb-btn primary" id="sb-next">Next</button>
        </div>
      </div>
    `;

    // Bind preview events
    container.querySelectorAll("[data-addq]").forEach(b => b.addEventListener("click", ()=> addQuestion(page.id, b.dataset.addq)));
    container.querySelectorAll("[data-delg]").forEach(b => b.addEventListener("click", ()=> deleteGroup(page.id, b.dataset.delg)));
    document.getElementById("sb-add-group").addEventListener("click", ()=> addGroup(page.id));
    document.getElementById("sb-validate").addEventListener("click", ()=> validatePage(page));
    document.getElementById("sb-next").addEventListener("click", ()=> {
      validatePage(page);
      if(Object.keys(state.errors).length) return;
      state.preview.pageIndex = Math.min(state.preview.pageIndex+1, state.journey.pages.length-1);
      render();
    });

    // Bind inputs
    container.querySelectorAll("[data-qkey]").forEach(el => {
      el.addEventListener("input", () => {
        const key = el.dataset.qkey;
        state.answers[key] = el.type === "checkbox" ? el.checked : el.value;
        // clear error on change
        delete state.errors[key];
        // re-render to apply conditional logic
        renderPreview();
      });
      el.addEventListener("change", () => {
        const key = el.dataset.qkey;
        state.answers[key] = el.type === "checkbox" ? el.checked : el.value;
        delete state.errors[key];
        renderPreview();
      });
    });
  }

  function renderField(q, val){
    const keyAttr = `data-qkey="${escapeAttr(q.key||"")}"`;
    const placeholder = q.placeholder ? `placeholder="${escapeAttr(q.placeholder)}"` : "";
    if(q.type === "select"){
      const cl = q.codelistId ? state.codelists.get(q.codelistId) : null;
      const opts = (cl?.items || []).map(i => `<option value="${escapeAttr(i.value)}">${escapeHtml(i.label)}</option>`).join("");
      return `
        <select class="sb-select" ${keyAttr}>
          <option value="">${escapeHtml(q.placeholder || "Select...")}</option>
          ${opts}
        </select>
      `;
    }
    if(q.type === "radio"){
      const cl = q.codelistId ? state.codelists.get(q.codelistId) : null;
      const items = (cl?.items || []);
      return `
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${items.map(i => `
            <label class="sb-pill" style="cursor:pointer;">
              <input type="radio" name="${escapeAttr(q.key)}" value="${escapeAttr(i.value)}" ${val===i.value ? "checked":""} ${keyAttr} style="margin-right:8px;" />
              ${escapeHtml(i.label)}
            </label>
          `).join("")}
        </div>
      `;
    }
    if(q.type === "toggle"){
      const checked = !!val;
      return `
        <label class="sb-pill" style="cursor:pointer;">
          <input type="checkbox" ${keyAttr} ${checked ? "checked":""} style="margin-right:8px;" />
          ${escapeHtml(q.assistiveText || "Toggle")}
        </label>
      `;
    }
    // default: text
    const v = (val ?? "");
    return `<input class="sb-field" type="text" value="${escapeAttr(v)}" ${placeholder} ${keyAttr} />`;
  }

  function renderProps(){
    const props = document.getElementById("sb-props");
    if(!state.journey){ props.innerHTML=""; return; }

    const sel = state.selected;
    let body = "";

    if(sel.kind === "journey"){
      body = renderJourneyProps();
    } else if(sel.kind === "page"){
      const page = findPage(sel.pageId);
      body = renderPageProps(page);
    } else if(sel.kind === "group"){
      const page = findPage(sel.pageId);
      const group = findGroup(page, sel.groupId);
      body = renderGroupProps(page, group);
    } else if(sel.kind === "question"){
      const page = findPage(sel.pageId);
      const group = findGroup(page, sel.groupId);
      const q = findQuestion(group, sel.questionId);
      body = renderQuestionProps(page, group, q);
    }

    props.innerHTML = body;

    // Bind props inputs
    props.querySelectorAll("[data-bind]").forEach(el => {
      el.addEventListener("input", () => {
        const path = el.dataset.bind.split(".");
        const value = (el.type === "checkbox") ? el.checked : el.value;
        setSelectedValue(path, value);
        render();
      });
      el.addEventListener("change", () => {
        const path = el.dataset.bind.split(".");
        const value = (el.type === "checkbox") ? el.checked : el.value;
        setSelectedValue(path, value);
        render();
      });
    });

    // Logic add/remove
    props.querySelectorAll("[data-add-logic]").forEach(btn => btn.addEventListener("click", addLogicRule));
    props.querySelectorAll("[data-del-logic]").forEach(btn => btn.addEventListener("click", () => deleteLogicRule(parseInt(btn.dataset.delLogic,10))));
    props.querySelectorAll("[data-delete-question]").forEach(btn => btn.addEventListener("click", deleteSelectedQuestion));
    props.querySelectorAll("[data-delete-page]").forEach(btn => btn.addEventListener("click", deleteSelectedPage));
  }

  function renderJourneyProps(){
    return `
      <div class="sb-panel">
        <h4>Journey</h4>
        <div class="sb-kv">
          <div class="k">Name</div>
          <input class="sb-input" data-bind="journey.name" value="${escapeAttr(state.journey.name||"")}" />
        </div>
        <div class="sb-kv">
          <div class="k">LOB</div>
          <input class="sb-input" data-bind="journey.lob" value="${escapeAttr(state.journey.lob||"")}" />
        </div>
        <div class="sb-kv">
          <div class="k">ID</div>
          <input class="sb-input" data-bind="journey.id" value="${escapeAttr(state.journey.id||"")}" />
        </div>
        <div class="sb-mini">Tip: select a page/group/question on the left to edit it.</div>
      </div>
    `;
  }

  function renderPageProps(page){
    if(!page) return `<div class="sb-mini">Select a page.</div>`;
    return `
      <div class="sb-panel">
        <h4>Page <span class="sb-badge">${escapeHtml(page.id)}</span></h4>
        <div class="sb-kv">
          <div class="k">Title</div>
          <input class="sb-input" data-bind="page.title" value="${escapeAttr(page.title||"")}" />
        </div>
        <div class="sb-row">
          <button class="sb-btn" id="sb-add-group-right">+ Group</button>
          <button class="sb-btn danger" data-delete-page="1">Delete page</button>
        </div>
        <div class="sb-mini">Pages control pagination in the live preview.</div>
      </div>
    `;
  }

  function renderGroupProps(page, group){
    if(!group) return `<div class="sb-mini">Select a group.</div>`;
    return `
      <div class="sb-panel">
        <h4>Group <span class="sb-badge">${escapeHtml(group.id)}</span></h4>
        <div class="sb-kv">
          <div class="k">Title</div>
          <input class="sb-input" data-bind="group.title" value="${escapeAttr(group.title||"")}" />
        </div>
        <div class="sb-row">
          <button class="sb-btn" id="sb-add-question-right">+ Question</button>
          <button class="sb-btn" id="sb-select-page">Select page</button>
        </div>
        <div class="sb-mini">Groups let you create “question sets” with shared titles.</div>
      </div>
    `;
  }

  function renderQuestionProps(page, group, q){
    if(!q) return `<div class="sb-mini">Select a question.</div>`;

    const codelistOptions = Array.from(state.codelists.values())
      .map(cl => `<option value="${escapeAttr(cl.id)}" ${q.codelistId===cl.id ? "selected":""}>${escapeHtml(cl.name||cl.id)}</option>`)
      .join("");

    const types = ["text","select","radio","toggle"];
    const typeOptions = types.map(t => `<option value="${t}" ${q.type===t ? "selected":""}>${t}</option>`).join("");

    return `
      <div class="sb-panel">
        <h4>Question <span class="sb-badge">${escapeHtml(q.id)}</span></h4>

        <div class="sb-kv">
          <div class="k">Key</div>
          <input class="sb-input" data-bind="question.key" value="${escapeAttr(q.key||"")}" />
        </div>

        <div class="sb-kv">
          <div class="k">Label</div>
          <input class="sb-input" data-bind="question.label" value="${escapeAttr(q.label||"")}" />
        </div>

        <div class="sb-kv">
          <div class="k">Type</div>
          <select class="sb-select" data-bind="question.type">${typeOptions}</select>
        </div>

        <div class="sb-kv">
          <div class="k">Placeholder</div>
          <input class="sb-input" data-bind="question.placeholder" value="${escapeAttr(q.placeholder||"")}" />
        </div>

        <div class="sb-kv">
          <div class="k">Helper text</div>
          <input class="sb-input" data-bind="question.helperText" value="${escapeAttr(q.helperText||"")}" />
        </div>

        <div class="sb-kv">
          <div class="k">Assistive</div>
          <input class="sb-input" data-bind="question.assistiveText" value="${escapeAttr(q.assistiveText||"")}" />
        </div>

        <div class="sb-kv">
          <div class="k">Required</div>
          <input type="checkbox" data-bind="question.validation.required" ${q.validation?.required ? "checked":""} />
        </div>

        <div class="sb-kv">
          <div class="k">Error msg</div>
          <input class="sb-input" data-bind="question.validation.errorMessage" value="${escapeAttr(q.validation?.errorMessage||"")}" />
        </div>

        <div class="sb-kv">
          <div class="k">Codelist</div>
          <select class="sb-select" data-bind="question.codelistId">
            <option value="">(none)</option>
            ${codelistOptions}
          </select>
        </div>

        <div class="sb-row">
          <button class="sb-btn danger" data-delete-question="1">Delete question</button>
        </div>

        <div class="sb-logic">
          <h4>Conditional logic <button class="sb-btn" style="padding:6px 10px;" data-add-logic="1">+ Rule</button></h4>
          ${(q.logic||[]).map((r, i) => `
            <div class="sb-panel" style="margin:10px 0 0 0;">
              <div class="sb-kv">
                <div class="k">When</div>
                <input class="sb-input" data-bind="question.logic.${i}.whenKey" value="${escapeAttr(r.whenKey||"")}" placeholder="e.g. title" />
              </div>
              <div class="sb-kv">
                <div class="k">Op</div>
                <select class="sb-select" data-bind="question.logic.${i}.operator">
                  ${["equals","notEquals","exists"].map(op => `<option value="${op}" ${r.operator===op?"selected":""}>${op}</option>`).join("")}
                </select>
              </div>
              <div class="sb-kv">
                <div class="k">Value</div>
                <input class="sb-input" data-bind="question.logic.${i}.value" value="${escapeAttr(r.value??"")}" placeholder="e.g. Mr" />
              </div>
              <div class="sb-kv">
                <div class="k">Action</div>
                <select class="sb-select" data-bind="question.logic.${i}.action">
                  ${["show","hide"].map(a => `<option value="${a}" ${r.action===a?"selected":""}>${a}</option>`).join("")}
                </select>
              </div>
              <button class="sb-btn danger" data-del-logic="${i}">Remove rule</button>
              <div class="sb-mini">Rule targets *this question* (simple + powerful for V1).</div>
            </div>
          `).join("") || `<div class="sb-mini">No rules yet. Add one to show/hide this question.</div>`}
        </div>
      </div>
    `;
  }

  function bindTopbar(){
    document.getElementById("sb-export").addEventListener("click", () => {
      const data = JSON.stringify(state.journey, null, 2);
      downloadText(`${state.journey.id||"journey"}.json`, data);
      toast("Exported journey JSON.");
    });

    document.getElementById("sb-reset").addEventListener("click", () => {
      state.answers = {};
      state.errors = {};
      toast("Preview reset.");
      renderPreview();
    });

    document.getElementById("sb-publish").addEventListener("click", publishJourney);
  }

  // ===== CRUD =====
  function addPage(){
    const p = { id: uid("p"), title: "New page", groups: [ { id: uid("g"), title: "New group", questions: [] } ] };
    state.journey.pages.push(p);
    state.preview.pageIndex = state.journey.pages.length - 1;
    state.selected = { kind:"page", pageId: p.id, groupId:null, questionId:null };
    toast("Added a page.");
    render();
  }

  function deleteSelectedPage(){
    const pid = state.selected.pageId;
    state.journey.pages = state.journey.pages.filter(p => p.id !== pid);
    state.preview.pageIndex = Math.max(0, Math.min(state.preview.pageIndex, state.journey.pages.length-1));
    state.selected = { kind:"journey", pageId:null, groupId:null, questionId:null };
    toast("Deleted page.");
    render();
  }

  function addGroup(pageId){
    const page = findPage(pageId);
    if(!page) return;
    const g = { id: uid("g"), title: "New group", questions: [] };
    page.groups = page.groups || [];
    page.groups.push(g);
    state.selected = { kind:"group", pageId, groupId:g.id, questionId:null };
    toast("Added a group.");
    render();
  }

  function deleteGroup(pageId, groupId){
    const page = findPage(pageId);
    if(!page) return;
    page.groups = (page.groups||[]).filter(g => g.id !== groupId);
    state.selected = { kind:"page", pageId, groupId:null, questionId:null };
    toast("Deleted group.");
    render();
  }

  function addQuestion(pageId, groupId){
    const page = findPage(pageId);
    const group = findGroup(page, groupId);
    if(!group) return;
    const q = {
      id: uid("q"),
      key: "new_field_" + Math.random().toString(16).slice(2,6),
      type: "text",
      label: "New question",
      codelistId: "",
      placeholder: "",
      helperText: "",
      assistiveText: "",
      validation: { required: false, errorMessage: "" },
      logic: []
    };
    group.questions.push(q);
    state.selected = { kind:"question", pageId, groupId, questionId:q.id };
    toast("Added a question.");
    render();
  }

  function deleteSelectedQuestion(){
    const page = findPage(state.selected.pageId);
    const group = findGroup(page, state.selected.groupId);
    if(!group) return;
    group.questions = (group.questions||[]).filter(q => q.id !== state.selected.questionId);
    state.selected = { kind:"group", pageId: state.selected.pageId, groupId: state.selected.groupId, questionId:null };
    toast("Deleted question.");
    render();
  }

  function addLogicRule(){
    const q = getSelectedQuestion();
    if(!q) return;
    q.logic = q.logic || [];
    q.logic.push({ whenKey:"", operator:"equals", value:"", action:"show" });
    toast("Added rule.");
    renderProps();
  }

  function deleteLogicRule(index){
    const q = getSelectedQuestion();
    if(!q) return;
    q.logic.splice(index,1);
    toast("Removed rule.");
    renderProps();
    renderPreview();
  }

  // ===== LOGIC + VALIDATION =====
  function isVisible(question){
    const rules = question.logic || [];
    if(!rules.length) return true;

    // V1: if any rule says HIDE and matches -> hidden
    // if any rule says SHOW and matches -> shown (otherwise hidden if any show rules exist)
    const showRules = rules.filter(r => r.action === "show");
    const hideRules = rules.filter(r => r.action === "hide");

    const matches = (r) => {
      const actual = state.answers[r.whenKey];
      if(r.operator === "exists") return actual !== undefined && actual !== null && actual !== "" && actual !== false;
      if(r.operator === "equals") return String(actual ?? "") === String(r.value ?? "");
      if(r.operator === "notEquals") return String(actual ?? "") !== String(r.value ?? "");
      return false;
    };

    for(const r of hideRules){
      if(matches(r)) return false;
    }
    if(showRules.length){
      return showRules.some(matches);
    }
    return true;
  }

  function validatePage(page){
    state.errors = {};
    (page.groups||[]).forEach(g => {
      (g.questions||[]).forEach(q => {
        if(!isVisible(q)) return;
        if(q.validation?.required){
          const v = state.answers[q.key];
          const empty = v === undefined || v === null || v === "" || v === false;
          if(empty){
            state.errors[q.key] = q.validation.errorMessage || "This field is required";
          }
        }
      });
    });
    renderPreview();
    if(Object.keys(state.errors).length) toast("Fix the highlighted errors.");
    else toast("Page valid ✅");
  }

  // ===== BINDING =====
  function setSelectedValue(path, value){
    // path examples:
    // journey.name
    // page.title
    // group.title
    // question.label
    // question.validation.required
    // question.logic.0.whenKey
    const sel = state.selected;

    const setDeep = (obj, keys, val) => {
      let cur = obj;
      for(let i=0;i<keys.length-1;i++){
        const k = keys[i];
        if(cur[k] === undefined){
          cur[k] = (String(keys[i+1]).match(/^\d+$/)) ? [] : {};
        }
        cur = cur[k];
      }
      const last = keys[keys.length-1];
      // coerce booleans for required
      if(last === "required") cur[last] = !!val;
      else cur[last] = val;
    };

    if(path[0] === "journey"){
      setDeep(state.journey, path.slice(1), value);
      return;
    }
    if(path[0] === "page"){
      const page = findPage(sel.pageId);
      if(page) setDeep(page, path.slice(1), value);
      return;
    }
    if(path[0] === "group"){
      const page = findPage(sel.pageId);
      const group = findGroup(page, sel.groupId);
      if(group) setDeep(group, path.slice(1), value);
      return;
    }
    if(path[0] === "question"){
      const q = getSelectedQuestion();
      if(q) setDeep(q, path.slice(1), value);
      return;
    }
  }

  function getSelectedQuestion(){
    const page = findPage(state.selected.pageId);
    const group = findGroup(page, state.selected.groupId);
    return findQuestion(group, state.selected.questionId);
  }

  // ===== FINDERS =====
  function findPage(pageId){ return state.journey.pages.find(p => p.id === pageId); }
  function findGroup(page, groupId){ return (page?.groups||[]).find(g => g.id === groupId); }
  function findQuestion(group, questionId){ return (group?.questions||[]).find(q => q.id === questionId); }

  // ===== PUBLISH =====
  async function publishJourney(){
    if(!CONFIG.publishEndpoint){
      toast("Publish is disabled. Set CONFIG.publishEndpoint.");
      return;
    }
    try{
      const payload = {
        path: `screen-builder/journeys/${state.journey.id}.json`,
        message: `Publish journey: ${state.journey.id}`,
        content: state.journey
      };
      const res = await fetch(CONFIG.publishEndpoint, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(payload)
      });
      if(!res.ok){
        const t = await res.text();
        throw new Error(t || "Publish failed");
      }
      toast("Published to GitHub ✅");
    }catch(e){
      toast("Publish error: " + (e.message || e));
    }
  }

  // ===== LOAD =====
  async function load(){
    const [journey, ...codelists] = await Promise.all([
      fetchJson(CONFIG.journeyUrl),
      ...CONFIG.codelistUrls.map(fetchJson)
    ]);

    state.journey = journey;
    state.codelists.clear();
    codelists.forEach(cl => state.codelists.set(cl.id, cl));

    // Default selection
    state.selected = { kind:"journey", pageId:null, groupId:null, questionId:null };
    state.preview.pageIndex = 0;

    render();
    toast("Loaded from GitHub.");
  }

  async function fetchJson(url){
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error("Failed to load: " + url);
    return res.json();
  }

  function downloadText(filename, text){
    const blob = new Blob([text], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
  }

  function escapeHtml(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
  function escapeAttr(s){ return String(s??"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;"); }

  // Boot
  load().catch(e => {
    document.getElementById("sb-app").innerHTML = `<div style="padding:16px; color:#fff; font-family:system-ui;">
      <strong>Screen Builder failed to load</strong><br/>
      <span style="opacity:.8">${escapeHtml(e.message || String(e))}</span><br/><br/>
      Check CONFIG URLs in the embed.
    </div>`;
  });

})();
