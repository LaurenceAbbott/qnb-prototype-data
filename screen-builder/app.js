const COMPONENTS = {
  text:{ label:"Text", type:"text" },
  textarea:{ label:"Textarea", type:"textarea" },
  select:{ label:"Select", type:"select" },
  radio:{ label:"Radio", type:"radio" },
  checkbox:{ label:"Checkbox", type:"checkbox" },
  date:{ label:"Date", type:"date" },
  time:{ label:"Time", type:"time" },
  number:{ label:"Number", type:"number" },
  email:{ label:"Email", type:"email" }
};

let doc = {
  title:"Home Insurance",
  pages:[{
    id:1,title:"Page 1",
    groups:[{
      id:1,title:"Group 1",
      fields:[]
    }]
  }],
  selected:{page:1,group:1,field:null}
};

const qs = id => document.getElementById(id);

function render() {
  qs("lobTitle").value = doc.title;

  // pagination
  qs("pagination").innerHTML="";
  doc.pages.forEach(p=>{
    const d=document.createElement("div");
    d.className="page-dot"+(p.id===doc.selected.page?" active":"");
    qs("pagination").appendChild(d);
  });

  // pages
  qs("pageList").innerHTML="";
  doc.pages.forEach(p=>{
    const div=document.createElement("div");
    div.className="list-item"+(p.id===doc.selected.page?" active":"");
    div.textContent=p.title;
    div.onclick=()=>{doc.selected.page=p.id;render();}
    qs("pageList").appendChild(div);
  });

  const page=doc.pages.find(p=>p.id===doc.selected.page);

  // groups
  qs("groupList").innerHTML="";
  page.groups.forEach(g=>{
    const div=document.createElement("div");
    div.className="list-item"+(g.id===doc.selected.group?" active":"");
    div.textContent=g.title;
    div.onclick=()=>{doc.selected.group=g.id;render();}
    qs("groupList").appendChild(div);
  });

  // canvas
  qs("canvas").innerHTML="";
  page.groups.forEach(g=>{
    const wrap=document.createElement("div");
    wrap.className="group";
    wrap.innerHTML=`<h4>${g.title}</h4>`;
    g.fields.forEach(f=>{
      const ff=document.createElement("div");
      ff.className="form-field";
      ff.innerHTML=`<label>${f.label}</label>`;
      let input;
      if(f.type==="textarea") input=document.createElement("textarea");
      else if(f.type==="select"){
        input=document.createElement("select");
        f.options.forEach(o=>{
          const opt=document.createElement("option");
          opt.textContent=o;
          input.appendChild(opt);
        });
      }
      else{
        input=document.createElement("input");
        input.type=f.type;
      }
      input.placeholder=f.placeholder||"";
      ff.appendChild(input);
      wrap.appendChild(ff);
    });
    qs("canvas").appendChild(wrap);
  });
}

qs("lobTitle").oninput=e=>doc.title=e.target.value;
qs("addPage").onclick=()=>{doc.pages.push({id:Date.now(),title:"Page "+(doc.pages.length+1),groups:[]});render();}
qs("addGroup").onclick=()=>{
  const p=doc.pages.find(p=>p.id===doc.selected.page);
  p.groups.push({id:Date.now(),title:"Group "+(p.groups.length+1),fields:[]});
  render();
};

render();
