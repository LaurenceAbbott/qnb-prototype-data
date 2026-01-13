.followUp.name || "", (val) => {
            q.followUp.name = val;
            saveSchemaDebounced();
          })
        );

        // Repeatable instances
        inspectorEl.appendChild(divider());
        inspectorEl.appendChild(sectionTitle("Repeatable set"));
        inspectorEl.appendChild(
          pEl(
            "Allow users to add multiple instances of these follow-up questions (e.g. multiple convictions).",
            "inlineHelp"
          )
        );

        inspectorEl.appendChild(
          toggleRow("Allow multiple (Add another)", q.followUp.repeat.enabled === true, (on) => {
            q.followUp.repeat.enabled = on;
            if (!Number.isFinite(Number(q.followUp.repeat.min))) q.followUp.repeat.min = 1;
            if (!Number.isFinite(Number(q.followUp.repeat.max))) q.followUp.repeat.max = 5;
            saveSchema();
            isTypingInspector = false;
            renderAll(true);
          })
        );

        if (q.followUp.repeat.enabled) {
          inspectorEl.appendChild(fieldText("Item label", q.followUp.repeat.itemLabel || "Item", (val) => {
            q.followUp.repeat.itemLabel = val || "Item";
            saveSchemaDebounced();
          }));

          inspectorEl.appendChild(fieldText("Add button label", q.followUp.repeat.addLabel || "Add another", (val) => {
            q.followUp.repeat.addLabel = val || "Add another";
            saveSchemaDebounced();
          }));

          // min/max as text inputs (keeps component set small)
          inspectorEl.appendChild(fieldText("Minimum items", String(q.followUp.repeat.min ?? 1), (val) => {
            const n = Number(val);
            q.followUp.repeat.min = Number.isFinite(n) ? clamp(n, 0, 50) : 1;
            q.followUp.repeat.max = clamp(Number(q.followUp.repeat.max ?? 5), q.followUp.repeat.min, 50);
            saveSchema();
            renderAll(true);
          }));

          inspectorEl.appendChild(fieldText("Maximum items", String(q.followUp.repeat.max ?? 5), (val) => {
            const n = Number(val);
            q.followUp.repeat.max = Number.isFinite(n) ? clamp(n, q.followUp.repeat.min ?? 1, 50) : 5;
            saveSchema();
            renderAll(true);
          }));
        }

        inspectorEl.appendChild(divider());
        inspectorEl.appendChild(followUpQuestionsEditor(q));

        inspectorEl.appendChild(
          buttonRow([
            {
              label: "Delete follow-up array",
              kind: "ghost",
              onClick: () => {
                if (!confirm("Delete these follow-up questions?")) return;
                q.followUp.enabled = false;
                q.followUp.name = "";
                q.followUp.questions = [];
                saveSchema();
                renderAll(true);
              },
            },
          ])
        );
      }
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

  // -------------------------
  // Follow-up questions (nested array inside a question)
  // - Supports optional repeatable instances ("Add another")
  // -------------------------

  function followUpIsEnabled(q) {
    return !!(
      q &&
      q.followUp &&
      q.followUp.enabled === true &&
      Array.isArray(q.followUp.questions) &&
      q.followUp.questions.length
    );
  }

  // ----- Repeatable instances storage (preview-only)
  // We store instance ids inside preview.answers under a reserved key.
  const FU_INSTANCES_KEY = "__fu_instances__";

  function getFuInstanceMap(answers) {
    if (!answers || typeof answers !== "object") return {};
    answers[FU_INSTANCES_KEY] =
      answers[FU_INSTANCES_KEY] && typeof answers[FU_INSTANCES_KEY] === "object"
        ? answers[FU_INSTANCES_KEY]
        : {};
    return answers[FU_INSTANCES_KEY];
  }

  function getFollowUpInstanceIds(parentQ, answers) {
    const map = getFuInstanceMap(answers);
    const arr = Array.isArray(map[parentQ.id]) ? map[parentQ.id] : [];
    return arr;
  }

  function setFollowUpInstanceIds(parentQ, answers, ids) {
    const map = getFuInstanceMap(answers);
    map[parentQ.id] = Array.isArray(ids) ? ids : [];
  }

  function followUpIsRepeatable(parentQ) {
    return !!(parentQ?.followUp?.repeat?.enabled === true);
  }

  function ensureMinFollowUpInstances(parentQ, answers) {
    if (!followUpIsEnabled(parentQ)) return;
    if (!followUpMatches(parentQ, answers)) return;

    if (!followUpIsRepeatable(parentQ)) {
      // Non-repeatable = no instances list
      setFollowUpInstanceIds(parentQ, answers, []);
      return;
    }

    const min = clamp(Number(parentQ.followUp?.repeat?.min ?? 1), 0, 50);
    const max = clamp(Number(parentQ.followUp?.repeat?.max ?? 5), min, 50);

    let ids = getFollowUpInstanceIds(parentQ, answers);
    ids = ids.filter(Boolean);

    while (ids.length < min) {
      ids.push(uid("fuinst"));
    }

    if (ids.length > max) ids = ids.slice(0, max);

    setFollowUpInstanceIds(parentQ, answers, ids);
  }

  function makeFollowUpAnswerId(parentQId, baseFollowUpQuestionId, instanceId) {
    return `fu_${parentQId}__${baseFollowUpQuestionId}__${instanceId}`;
  }

  function clearFollowUpAnswersForQuestion(parentQ, answers) {
    if (!answers || typeof answers !== "object") return;

    // Clear any repeat instance answers
    const ids = getFollowUpInstanceIds(parentQ, answers);
    (parentQ.followUp?.questions || []).forEach((fq) => {
      ids.forEach((instId) => {
        const aid = makeFollowUpAnswerId(parentQ.id, fq.id, instId);
        if (aid in answers) delete answers[aid];
      });
    });

    // Clear any non-repeatable answers (legacy behaviour uses fq.id)
    (parentQ.followUp?.questions || []).forEach((fq) => {
      if (fq?.id && fq.id in answers) delete answers[fq.id];
    });

    // Clear instance list
    const map = getFuInstanceMap(answers);
    delete map[parentQ.id];
  }

  function addFollowUpInstance(parentQ, answers) {
    ensureMinFollowUpInstances(parentQ, answers);
    const min = clamp(Number(parentQ.followUp?.repeat?.min ?? 1), 0, 50);
    const max = clamp(Number(parentQ.followUp?.repeat?.max ?? 5), min, 50);

    const ids = getFollowUpInstanceIds(parentQ, answers).slice();
    if (ids.length >= max) return false;
    ids.push(uid("fuinst"));
    setFollowUpInstanceIds(parentQ, answers, ids);
    return true;
  }

  function removeFollowUpInstance(parentQ, answers, instanceId) {
    ensureMinFollowUpInstances(parentQ, answers);
    const min = clamp(Number(parentQ.followUp?.repeat?.min ?? 1), 0, 50);

    let ids = getFollowUpInstanceIds(parentQ, answers).slice();
    if (ids.length <= min) return false;

    ids = ids.filter((x) => x !== instanceId);
    setFollowUpInstanceIds(parentQ, answers, ids);

    // delete answers for removed instance
    (parentQ.followUp?.questions || []).forEach((fq) => {
      const aid = makeFollowUpAnswerId(parentQ.id, fq.id, instanceId);
      if (aid in answers) delete answers[aid];
    });

    return true;
  }

  function followUpMatches(q, answers) {
    if (!followUpIsEnabled(q)) return false;
    const trig = String(q.followUp.triggerValue || "Yes");
    return String(answers?.[q.id] || "") === trig;
  }

  function getActiveFollowUps(q, answers) {
    return followUpMatches(q, answers) ? (q.followUp.questions || []) : [];
  }

  function getActiveFollowUpSteps(parentQ, answers) {
    // Returns an array of step objects with stable unique ids for answers.
    const fqs = getActiveFollowUps(parentQ, answers);
    if (!fqs.length) return [];

    if (followUpIsRepeatable(parentQ)) {
      ensureMinFollowUpInstances(parentQ, answers);
      const instIds = getFollowUpInstanceIds(parentQ, answers);
      const steps = [];

      instIds.forEach((instId, instIndex) => {
        fqs.forEach((fq) => {
          steps.push({
            ...fq,
            id: makeFollowUpAnswerId(parentQ.id, fq.id, instId),
            baseId: fq.id,
            instanceId: instId,
            instanceIndex: instIndex,
            parentQuestionId: parentQ.id,
            isFollowUp: true,
            isRepeatInstance: true,
            followUpName: parentQ.followUp?.name || "",
            followUpItemLabel: parentQ.followUp?.repeat?.itemLabel || "Item",
          });
        });
      });

      return steps;
    }

    // Non-repeatable follow-ups (answers keyed by fq.id)
    return fqs.map((fq) => ({
      ...fq,
      parentQuestionId: parentQ.id,
      isFollowUp: true,
      isRepeatInstance: false,
      followUpName: parentQ.followUp?.name || "",
    }));
  }

  function followUpQuestionsEditor(parentQ) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "10px";

    const ensure = () => {
      parentQ.followUp = parentQ.followUp || {
        enabled: false,
        triggerValue: "Yes",
        name: "",
        questions: [],
        repeat: { enabled: false, min: 1, max: 5, addLabel: "Add another", itemLabel: "Item" },
      };
      parentQ.followUp.questions = Array.isArray(parentQ.followUp.questions)
        ? parentQ.followUp.questions
        : [];
    };

    const render = () => {
      ensure();
      list.innerHTML = "";

      (parentQ.followUp.questions || []).forEach((fq, idx) => {
        const card = document.createElement("div");
        card.className = "toggleRow";
        card.style.flexDirection = "column";
        card.style.alignItems = "stretch";

        // Title
        card.appendChild(
          fieldText("Question text", fq.title || "", (val) => {
            fq.title = val || "Untitled follow-up";
            saveSchemaDebounced();
            renderCanvas();
          })
        );

        // Help
        card.appendChild(
          fieldTextArea("Help text", fq.help || "", (val) => {
            fq.help = val;
            saveSchemaDebounced();
          })
        );

        // Type
        card.appendChild(
          fieldSelect(
            "Type",
            fq.type || "text",
            QUESTION_TYPES.map((t) => ({ value: t.key, label: t.label })),
            (val) => {
              fq.type = val;
              if (!isOptionType(fq.type)) fq.options = [];
              if (isOptionType(fq.type) && (!fq.options || !fq.options.length)) {
                fq.options = ["Option 1", "Option 2", "Option 3"];
              }
              saveSchema();
              renderAll(true);
            }
          )
        );

        // Placeholder
        if (["text", "email", "number", "currency", "percent", "tel", "postcode", "date"].includes(fq.type)) {
          card.appendChild(
            fieldText("Placeholder", fq.placeholder || "", (val) => {
              fq.placeholder = val;
              saveSchemaDebounced();
            })
          );
        }

        // Required
        card.appendChild(
          toggleRow("Required", fq.required === true, (on) => {
            fq.required = on;
            if (fq.required && !fq.errorText) fq.errorText = "This field is required.";
            saveSchema();
            renderAll(true);
          })
        );

        if (fq.required) {
          card.appendChild(
            fieldTextArea("Error message", fq.errorText || "This field is required.", (val) => {
              fq.errorText = val;
              saveSchemaDebounced();
            })
          );
        }

        // Options if needed
        if (isOptionType(fq.type)) {
          card.appendChild(divider());
          card.appendChild(sectionTitle("Options"));
          card.appendChild(optionsEditor(fq));
        }

        // Actions
        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "10px";
        actions.style.justifyContent = "flex-end";
        actions.style.marginTop = "10px";

        const up = document.createElement("button");
        up.type = "button";
        up.className = "btn ghost";
        up.textContent = "Move up";
        up.disabled = idx === 0;
        up.addEventListener("click", () => {
          moveItem(parentQ.followUp.questions, idx, idx - 1);
          saveSchema();
          renderAll(true);
        });

        const down = document.createElement("button");
        down.type = "button";
        down.className = "btn ghost";
        down.textContent = "Move down";
        down.disabled = idx === parentQ.followUp.questions.length - 1;
        down.addEventListener("click", () => {
          moveItem(parentQ.followUp.questions, idx, idx + 1);
          saveSchema();
          renderAll(true);
        });

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn ghost";
        del.textContent = "Delete";
        del.addEventListener("click", () => {
          parentQ.followUp.questions.splice(idx, 1);
          saveSchema();
          renderAll(true);
        });

        actions.appendChild(up);
        actions.appendChild(down);
        actions.appendChild(del);
        card.appendChild(actions);

        list.appendChild(card);
      });

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn";
      addBtn.textContent = "+ Add follow-up question";
      addBtn.addEventListener("click", () => {
        ensure();
        parentQ.followUp.questions.push({
          id: uid("fq"),
          type: "text",
          title: "New follow-up question",
          help: "",
          placeholder: "",
          required: false,
          errorText: "This field is required.",
          options: [],
          logic: { enabled: false, rules: [] },
          content: { enabled: false, html: "" },
        });
        saveSchema();
        renderAll(true);
      });

      list.appendChild(addBtn);
    };

    render();
    wrap.appendChild(list);
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
    group.logic.rules = Array.isArray(grou
