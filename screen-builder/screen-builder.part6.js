.content.html || "") : "";
    contentEl.innerHTML = contentHtml;
    contentEl.style.display = contentHtml ? "block" : "none";

    const errEl = document.createElement("div");
    errEl.className = cx("pError", "qnb-preview-error");
    errEl.textContent = preview.lastError || "";
    errEl.style.display = preview.lastError ? "block" : "none";

    const inputWrap = document.createElement("div");
    inputWrap.className = cx("pInputWrap", "qnb-preview-input-wrap");

    // Build input control per type
    const setAnswer = (v) => {
      preview.answers[step.id] = v;
    };
    const getAnswer = () => preview.answers[step.id];

    buildPreviewInputControl(step, inputWrap, setAnswer, getAnswer, () => renderPreview());

    card.appendChild(qEl);
    if (contentHtml) card.appendChild(contentEl);
    if (step.help) card.appendChild(helpEl);
    card.appendChild(inputWrap);
    card.appendChild(errEl);
    previewStage.appendChild(card);

    // Ensure Next button is re-enabled if previously disabled by completion view
    if (btnNext) btnNext.disabled = false;
  }

  function buildPreviewInputControl(step, inputWrap, setAnswer, getAnswer, rerender) {
    if (["text", "email", "number", "currency", "percent", "tel", "postcode", "date"].includes(step.type)) {
      const input = document.createElement("input");
      input.className = "pInput";

      // For custom date picker, render as text input and attach Flatpickr
      if (step.type === "date") {
        input.type = "text";
        input.inputMode = "numeric";
        input.placeholder = step.placeholder || "dd/mm/yyyy";
        input.autocomplete = "off";
      } else if (step.type === "tel") {
        input.type = "tel";
        input.inputMode = "tel";
        input.placeholder = step.placeholder || "e.g. 07700 900123";
        input.autocomplete = "tel";
      } else if (step.type === "postcode") {
        input.type = "text";
        input.inputMode = "text";
        input.placeholder = step.placeholder || "e.g. SW1A 1AA";
        input.autocomplete = "postal-code";
        // Light normalisation to UK-style formatting (upper-case + trim)
        input.addEventListener("blur", () => {
          const v = (input.value || "").trim().toUpperCase();
          input.value = v;
          setAnswer(v);
        });
      } else if (step.type === "currency") {
        input.type = "text";
        input.inputMode = "decimal";
        input.placeholder = step.placeholder || "e.g. 1,250.00";
      } else if (step.type === "percent") {
        input.type = "text";
        input.inputMode = "decimal";
        input.placeholder = step.placeholder || "e.g. 10";
      } else {
        input.type = step.type === "text" ? "text" : step.type;
        input.placeholder = step.placeholder || "";
      }

      input.value = getAnswer() ?? "";
      input.addEventListener("input", () => setAnswer(input.value));
      inputWrap.appendChild(input);

      if (step.type === "date") {
        // Attach Flatpickr if it's loaded (safe no-op if not)
        initFlatpickrDateInput(input, input.value, (v) => {
          setAnswer(v);
          input.value = v;
        });
      }
      if (preview.mode === "question") {
        setTimeout(() => {
          if (!shouldSuppressAutoFocus()) input.focus();
        }, 0);
      }
      return;
    }

    if (step.type === "textarea") {
      const ta = document.createElement("textarea");
      ta.className = "pTextarea";
      ta.placeholder = step.placeholder || "";
      ta.value = getAnswer() ?? "";
      ta.addEventListener("input", () => setAnswer(ta.value));
      inputWrap.appendChild(ta);
      if (preview.mode === "question") {
        setTimeout(() => {
          if (!shouldSuppressAutoFocus()) ta.focus();
        }, 0);
      }
      return;
    }

    if (step.type === "yesno") {
      const row = document.createElement("div");
      row.className = "choiceGrid";

      const mk = (label, val) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "choiceBtn" + (getAnswer() === val ? " selected" : "");
        b.textContent = label;
        b.addEventListener("click", () => {
          // Prevent any auto-focus during the re-render (page mode can render many controls)
          suppressAutoFocusUntil = Date.now() + 300;

          // If user changes the parent answer, reset follow-up instances + answers
          const prev = getAnswer();
          setAnswer(val);
          if (prev !== val && step.followUp?.enabled) {
            clearFollowUpAnswersForQuestion(step, preview.answers);
            // If repeatable and still matches after change, ensure min instances
            ensureMinFollowUpInstances(step, preview.answers);
          }

          rerender();
        });
        return b;
      };

      row.appendChild(mk("Yes", "Yes"));
      row.appendChild(mk("No", "No"));
      inputWrap.appendChild(row);
      return;
    }

    if (isOptionType(step.type)) {
      const opts = Array.isArray(step.options) ? step.options : [];

      if (step.type === "select") {
        const sel = document.createElement("select");
        sel.className = "pSelect";
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "— Select —";
        sel.appendChild(blank);
        opts.forEach((o) => {
          const op = document.createElement("option");
          op.value = o;
          op.textContent = o;
          sel.appendChild(op);
        });
        sel.value = getAnswer() ?? "";
        sel.addEventListener("change", () => setAnswer(sel.value));
        inputWrap.appendChild(sel);
        if (preview.mode === "question") {
          setTimeout(() => {
            if (!shouldSuppressAutoFocus()) sel.focus();
          }, 0);
        }
        return;
      }

      if (step.type === "radio") {
        const list = document.createElement("div");
        list.className = "choiceGrid";
        const cur = getAnswer() ?? "";
        opts.forEach((o) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "choiceBtn" + (cur === o ? " selected" : "");
          b.textContent = o;
          b.addEventListener("click", () => {
            // Prevent re-render from auto-focusing a different control (e.g. a textarea elsewhere)
            suppressAutoFocusUntil = Date.now() + 300;
            setAnswer(o);
            rerender();
          });
          list.appendChild(b);
        });
        inputWrap.appendChild(list);
        return;
      }

      if (step.type === "checkboxes") {
        const list = document.createElement("div");
        list.className = "choiceGrid";

        const cur = Array.isArray(getAnswer()) ? getAnswer() : [];

        opts.forEach((o, idx) => {
          const id = `chk_${step.id}_${idx}`;

          const label = document.createElement("label");
          label.className = "choiceBtn choiceCheck" + (cur.includes(o) ? " selected" : "");
          label.setAttribute("for", id);

          const cb = document.createElement("input");
          cb.className = "choiceCheckBox";
          cb.type = "checkbox";
          cb.id = id;
          cb.checked = cur.includes(o);

          const txt = document.createElement("span");
          txt.className = "choiceCheckText";
          txt.textContent = o;

          cb.addEventListener("change", () => {
            const next = new Set(Array.isArray(getAnswer()) ? getAnswer() : []);
            if (cb.checked) next.add(o);
            else next.delete(o);
            const arr = Array.from(next);
            setAnswer(arr);
            label.classList.toggle("selected", cb.checked);
          });

          label.appendChild(cb);
          label.appendChild(txt);
          list.appendChild(label);
        });

        inputWrap.appendChild(list);
        return;
      }
    }

    // fallback
    const input = document.createElement("input");
    input.className = "pInput";
    input.type = "text";
    input.value = getAnswer() ?? "";
    input.addEventListener("input", () => setAnswer(input.value));
    inputWrap.appendChild(input);

    if (preview.mode === "question") {
      setTimeout(() => {
        if (!shouldSuppressAutoFocus()) input.focus();
      }, 0);
    }
    return;
  }

  function renderPreviewPage(pageId) {
    const p = getPage(pageId);
    if (!p) return;

    // Build visibility maps
    const all = getAllQuestionsInOrder(schema);
    const byId = Object.fromEntries(all.map((q) => [q.id, q]));
    const groupVisible = {};
    p.groups.forEach((g) => {
      groupVisible[g.id] = groupShouldShow(g, byId, preview.answers);
    });

    const card = document.createElement("div");
    card.className = cx(
      "previewCard",
      "qnb-preview-card",
      tplClass(p?.template || "form", "card")
    );

    // Page header
    const header = document.createElement("div");
    header.className = "pQ";
    header.textContent = p.name || "Untitled page";
    card.appendChild(header);

    const stack = document.createElement("div");
    stack.className = cx("previewPageStack", "qnb-preview-page-stack");

    // Render page flow (text blocks + groups)
    (p.flow || []).forEach((it) => {
      if (it.type === "text") {
        const level = it.level || "h3";
        const title = (it.title || "").trim();
        const body = sanitizeRichHtml(it.bodyHtml || "");

        const block = document.createElement("div");
        block.className = cx("previewTextBlock", "qnb-preview-text-block");

        const titleEl = document.createElement(level === "body" ? "div" : level);
        titleEl.className = cx("previewTextBlockTitle", "qnb-preview-text-title");
        titleEl.textContent = title;
        if (title) block.appendChild(titleEl);

        if (body) {
          const bodyEl = document.createElement("div");
          bodyEl.className = cx("pHelp", "previewTextBlockBody", "qnb-preview-text-body");
          bodyEl.innerHTML = body;
          block.appendChild(bodyEl);
        }

        if (title || body) stack.appendChild(block);
        return;
      }

      if (it.type === "group") {
        const g = p.groups.find((gg) => gg.id === it.id);
        if (!g) return;
        if (groupVisible[g.id] === false) return;

        const groupWrap = document.createElement("div");
        groupWrap.className = cx("previewGroup", "qnb-preview-group");

        const gTitle = document.createElement("div");
        gTitle.className = cx("previewGroupTitle", "qnb-preview-group-title");
        gTitle.textContent = g.name || "Untitled group";
        groupWrap.appendChild(gTitle);

        if (g.description?.enabled) {
          const d = sanitizeRichHtml(g.description.html || "");
          if (d) {
            const dEl = document.createElement("div");
            dEl.className = cx("pHelp", "previewGroupDesc", "qnb-preview-group-desc");
            dEl.innerHTML = d;
            groupWrap.appendChild(dEl);
          }
        }

        const visibleQuestions = (g.questions || []).filter((qq) => questionShouldShow(qq, byId, preview.answers));

        visibleQuestions.forEach((qq) => {
          const qBlock = document.createElement("div");
          qBlock.className = cx("previewQuestion", "qnb-preview-question");

          const qTitle = document.createElement("div");
          qTitle.className = cx("previewQuestionTitle", "qnb-preview-question-title");
          qTitle.textContent = qq.title || "Untitled question";
          qBlock.appendChild(qTitle);

          if (qq.content?.enabled) {
            const c = sanitizeRichHtml(qq.content.html || "");
            if (c) {
              const cEl = document.createElement("div");
              cEl.className = cx("previewQuestionContent", "qnb-preview-question-content");
              cEl.innerHTML = c;
              qBlock.appendChild(cEl);
            }
          }

          if (qq.help) {
            const h = document.createElement("div");
            h.className = "pHelp";
            h.textContent = qq.help;
            qBlock.appendChild(h);
          }

          const inputWrap = document.createElement("div");
          inputWrap.className = "pInputWrap";

          const setA = (v) => {
            preview.answers[qq.id] = v;

            // Clear error on change (page mode)
            if (preview.pageErrors?.[qq.id]) {
              delete preview.pageErrors[qq.id];
              // Re-render to hide the inline message immediately
              renderPreview();
            }
          };

          const getA = () => preview.answers[qq.id];

          buildPreviewInputControl(qq, inputWrap, setA, getA, () => renderPreview());

          qBlock.appendChild(inputWrap);

          // Inline field error (page mode)
          const fieldErr = preview.pageErrors?.[qq.id] || "";
          const errEl = document.createElement("div");
          errEl.className = "pError";
          errEl.textContent = fieldErr;
          errEl.style.display = fieldErr ? "block" : "none";
          qBlock.appendChild(errEl);

          // Follow-up questions (nested under this question)
          if (followUpMatches(qq, preview.answers)) {
            const fWrap = document.createElement("div");
            fWrap.className = "previewFollowUp";
            fWrap.style.marginTop = "12px";
            fWrap.style.paddingLeft = "14px";
            fWrap.style.borderLeft = "1px solid rgba(255,255,255,0.12)";

            const fuName = String(qq.followUp?.name || "").trim();
            const isRepeat = followUpIsRepeatable(qq);
            if (isRepeat) ensureMinFollowUpInstances(qq, preview.answers);

            // Optional name label
            if (fuName) {
              const nm = document.createElement("div");
              nm.className = "label";
              nm.style.marginBottom = "6px";
              nm.textContent = fuName;
              fWrap.appendChild(nm);
            }

            const renderInstance = (instId, instIndex) => {
              const instanceHeader = document.createElement("div");
              instanceHeader.style.display = "flex";
              instanceHeader.style.alignItems = "center";
              instanceHeader.style.justifyContent = "space-between";
              instanceHeader.style.gap = "10px";
              instanceHeader.style.marginTop = instIndex === 0 ? "0" : "14px";

              const itemLabel = String(qq.followUp?.repeat?.itemLabel || "Item").trim() || "Item";
              const title = document.createElement("div");
              title.className = "label";
              title.textContent = `${itemLabel} ${instIndex + 1}`;
              instanceHeader.appendChild(title);

              if (isRepeat) {
                const min = clamp(Number(qq.followUp?.repeat?.min ?? 1), 0, 50);
                const removeBtn = document.createElement("button");
                removeBtn.type = "button";
                removeBtn.className = "btn ghost";
                removeBtn.textContent = "Remove";
                removeBtn.disabled = getFollowUpInstanceIds(qq, preview.answers).length <= min;
                removeBtn.addEventListener("click", () => {
                  removeFollowUpInstance(qq, preview.answers, instId);
                  renderPreview();
                });
                instanceHeader.appendChild(removeBtn);
              }

              fWrap.appendChild(instanceHeader);

              const fqs = getActiveFollowUps(qq, preview.answers);
              fqs.forEach((fq) => {
                const sub = document.createElement("div");
                sub.className = "previewQuestion";
                sub.style.marginTop = "10px";

                const t = document.createElement("div");
                t.className = "previewQuestionTitle";
                t.textContent = fq.title || "Untitled question";
                sub.appendChild(t);

                if (fq.content?.enabled) {
                  const c2 = sanitizeRichHtml(fq.content.html || "");
                  if (c2) {
                    const cEl2 = document.createElement("div");
                    cEl2.className = "previewQuestionContent";
                    cEl2.innerHTML = c2;
                    sub.appendChild(cEl2);
                  }
                }

                if (fq.help) {
                  const h2 = document.createElement("div");
                  h2.className = "pHelp";
                  h2.textContent = fq.help;
                  sub.appendChild(h2);
                }

                const iw2 = document.createElement("div");
                iw2.className = "pInputWrap";

                const answerId = isRepeat ? makeFollowUpAnswerId(qq.id, fq.id, instId) : fq.id;

                const setF = (v) => {
                  preview.answers[answerId] = v;
                  if (preview.pageErrors?.[answerId]) {
                    delete preview.pageErrors[answerId];
                    renderPreview();
                  }
                };
                const getF = () => preview.answers[answerId];

                // Build control using a cloned step object so it reads correct type/options
                const stepObj = { ...fq, id: answerId };
                buildPreviewInputControl(stepObj, iw2, setF, getF, () => renderPreview());
                sub.appendChild(iw2);

                const ferr = preview.pageErrors?.[answerId] || "";
                const fe = document.createElement("div");
                fe.className = "pError";
                fe.textContent = ferr;
                fe.style.display = ferr ? "block" : "none";
                sub.appendChild(fe);

                fWrap.appendChild(sub);
              });
            };

            if (isRepeat) {
              const instIds = getFollowUpInstanceIds(qq, preview.answers);
              instIds.forEach((instId, idx) => renderInstance(instId, idx));

              const addBtn = document.createElement("button");
              addBtn.type = "button";
              addBtn.className = "btn";
              addBtn.style.marginTop = "12px";
              addBtn.textContent = String(qq.followUp?.repeat?.addLabel || "Add another");

              const min = clamp(Number(qq.followUp?.repeat?.min ?? 1), 0, 50);
              const max = clamp(Number(qq.followUp?.repeat?.max ?? 5), min, 50);
              addBtn.disabled = instIds.length >= max;

              addBtn.addEventListener("click", () => {
                addFollowUpInstance(qq, preview.answers);
                renderPreview();
              });

              fWrap.appendChild(addBtn);
            } else {
              // Single (non-repeatable) follow-up set
              renderInstance("single", 0);
            }

            qBlock.appendChild(fWrap);
          }

          // IMPORTANT: keep group title/description ABOVE its questions
          groupWrap.appendChild(qBlock);
        });

        // If a group has no visible questions/content, avoid rendering empty blocks
        if (groupWrap.childNodes.length > 2 || visibleQuestions.length) {
          stack.appendChild(groupWrap);
        }

        return;
      }
    });

    card.appendChild(stack);

    // Error banner (page mode)
    if (preview.lastError) {
      const err = document.createElement("div");
      err.className = "pError";
      err.style.marginTop = "12px";
      err.textContent = preview.lastError;
      card.appendChild(err);
    }

    previewStage.appendChild(card);
  }

  // -------------------------
  // (Reserved) Completion renderer
  // -------------------------
  // Note: completion UI is handled inline in the Next button handler.

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

  /* =============================================================================
CH 8  Event wiring (listeners)
============================================================================= */

  // -------------------------
  // Event wiring
  // -------------------------
  function wire() {
    // Track inspector focus to prevent rebuild while typing (fixes 1-letter issue)
    document.addEventListener("focusin", (e) => {
      if (!e.target.closest("#inspector")) return;
      // Only treat as "typing" when focusing a text-editing control
      isTypingInspector = isTextEditingElement(e.target);
    });

    document.addEventListener("focusout", (e) => {
      if (!e.target.closest("#inspector")) return;
      // If focus stays within inspector, keep flag only if the new active element is a typing control
      setTimeout(() => {
        const ae = document.activeElement;
        if (ae && ae.closest && ae.closest("#inspector")) {
          isTypingInspector = isTextEditingElement(ae);
        } else {
          isTypingInspector = false;
        }
        renderAll();
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
      preview.answers = {};
      openPreview();
    });

    // Preview nav
    btnPrev.addEventListener("click", () => {
      if (!preview.open) return;
      preview.lastError = "";
      preview.pageErrors = {};
      preview.index = clamp(preview.index - 1, 0, Math.max(0, preview.steps.length - 1));
      renderPreview();
    });

    btnNext.addEventListener("click", () => {
      if (!preview.open) return;

      // PAGE MODE: validate all required visible questions on this page, then advance page
      if (preview.mode === "page") {
        preview.steps = buildPreviewPageSteps();
        preview.index = clamp(preview.index, 0, Math.max(0, preview.steps.length - 1));
        const step = preview.steps[preview.index];
        if (!step) return;

        const p = getPage(step.pageId);
        if (!p) return;

        const all = getAllQuestionsInOrder(schema);
        const byId = Object.fromEntries(all.map((q) => [q.id, q]));

        // Determine which questions are visible on this page right now
        const visibleQ = [];
        (p.flow || []).forEach((it) => {
          if (it.type !== "group") return;
          const g = p.groups.find((gg) => gg.id === it.id);
          if (!g) return;
          if (groupShouldShow(g, byId, preview.answers) === false) return;
          (g.questions || []).forEach((qq) => {
            if (!questionShouldShow(qq, byId, preview.answers)) return;
            visibleQ.push(qq);

            // If the follow-up is active, include nested questions in page-level validation
            if (followUpMatches(qq, preview.answers)) {
              const fuSteps = getActiveFollowUpSteps(qq, preview.answers);
              fuSteps.forEach((fqStep) => visibleQ.push(fqStep));
            }
          });
        });

        // Validate required questions (page mode: collect per-field errors)
        const errors = {};
        for (const qq of visibleQ) {
          if (!qq.required) continue;
          const ans = preview.answers[qq.id];
          const empty =
            ans === undefined ||
            ans === null ||
            (typeof ans === "string" && ans.trim() === "") ||
            (Array.isArray(ans) && ans.length === 0);
          if (empty) {
            errors[qq.id] = qq.errorText || "This field is required.";
          }
        }

        if (Object.keys(errors).length) {
          preview.pageErrors = errors;
          preview.lastError = "";
          renderPreview();
          return;
        }

        preview.pageErrors = {};
        preview.lastError = "";

        if (preview.index >= preview.steps.length - 1) {
          // completion
          previewStage.innerHTML = "";
          const wrap = document.createElement("div");
          wrap.className = "previewCard";
          wrap.innerHTML = `
            <div class="pQ">All done</div>
            <div class="pHelp">You reached the end of the preview flow.</div>
          `;
          previewStage.appendChild(wrap);
          btnNext.disabled = true;
          return;
        }

        preview.index = clamp(preview.index + 1, 0, preview.steps.length - 1);
        renderPreview();
        return;
      }

      // QUESTION MODE (existing)
      // rebuild steps before validating (logic can change)
      preview.steps = buildPreviewSteps();
      preview.index = clamp(preview.index, 0, Math.max(0, preview.steps.length - 1));

      const step = preview.steps[preview.index];
      if (!step) return;

      // required validation
      if (step.required) {
        const ans = preview.answers[step.id];
        const empty =
          ans === undefined ||
          ans === null ||
          (typeof ans === "string" && ans.trim() === "") ||
          (Array.isArray(ans) && ans.length === 0);
        if (empty) {
          preview.lastError = step.errorText || "This field is required.";
          renderPreview();
          return;
        }
      }

      preview.lastError = "";
      if (preview.index >= preview.steps.length - 1) {
        // show completion
        previewStage.innerHTML = "";
        const wrap = document.createElement("div");
        wrap.className = "previewCard";
        wrap.innerHTML = `
          <div class="pQ">All done</div>
          <div class="pHelp">You reached the end of the preview flow.</div>
        `;
        previewStage.appendChild(wrap);
        btnNext.disabled = true;
        return;
      }

      preview.index = clamp(preview.index + 1, 0, preview.steps.length - 1);
      renderPreview();
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

  // Restore preview mode preference if present
  if (schema?.meta?.previewMode) {
    preview.mode = schema.meta.previewMode;
  }

  wire();
  // Builder-only AI Assist (safe even if CSS/DOM doesn't have specific hooks)
  try { mountAiAssistUI(); } catch { /* no-op */ }
  renderAll();

  // Auto-create friendly initial values if schema is empty or corrupted
  if (!schema.lineOfBusiness) schema.lineOfBusiness = "New Journey";
  if (!Array.isArray(schema.pages)) schema.pages = [];
})();



// ------------------------------
// TEMPLATE REGISTRY
// ------------------------------
// Defines editable, schema-driven page templates for the Screen Builder.
// Each template provides:
// - label: human-friendly name
// - schema: fields shown in the editor
// - defaults: initial values
// - render(values): returns HTML string for preview/export
//
// NOTE: This registry is safe to extend—add new template keys alongside `quote`.
const TEMPLATE_DEFS = {
  quote: {
    label: "Quote page",
    schema: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "intro", label: "Intro text", type: "textarea" },
      { key: "showPrice", label: "Show premium", type: "toggle" },
      { key: "priceLabel", label: "Premium label", type: "text" },
      { key: "ctaText", label: "CTA button text", type: "text" }
    ],
    defaults: {
      heading: "Your quote",
      intro: "Here’s your price based on the details you’ve provided.",
      showPrice: true,
      priceLabel: "Total premium",
      ctaText: "Continue"
    },
    render(values) {
      const v = values || {};
      return `
        <div class="template template-quote">
          <div class="template-header">
            <h1 class="template-title">${escapeHtml(v.heading ?? "")}</h1>
            <p class="template-intro">${escapeHtml(v.intro ?? "")}</p>
          </div>

          ${v.showPrice ? `
            <div class="template-panel">
              <div class="template-row">
                <div class="template-label">${escapeHtml(v.priceLabel ?? "")}</div>
                <div class="template-value">£1,234.56</div>
              </div>
            </div>
          ` : ""}

          <div class="template-actions">
            <button class="btn primary" type="button">${escapeHtml(v.ctaText ?? "Continue")}</button>
          </div>
        </div>
      `;
    }
  }

  // Add more templates later...
  // summary: { ... }
};
