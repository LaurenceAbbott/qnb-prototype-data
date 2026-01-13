active" : "") +
        (isFixed ? " fixed" : "") +
        ` tpl-${String(p.template || "form").toLowerCase()}`;

      // Expose template to CSS selectors
      pageDiv.dataset.pageTemplate = String(p.template || "form").toLowerCase();

      // Make page draggable (builder-only) — but never for fixed pages
      pageDiv.draggable = !preview.open && !isFixed;
      pageDiv.dataset.pageId = p.id;
      pageDiv.dataset.schemaIndex = String(schemaIdx);

      pageDiv.addEventListener("dragstart", (e) => {
        if (preview.open || isFixed) {
          e.preventDefault();
          return;
        }
        if (!canStartDragFrom(e.target)) {
          e.preventDefault();
          return;
        }
        markDragging(true);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/og-page", p.id);
        e.dataTransfer.setData("text/og-page-schema-index", String(schemaIdx));
        pageDiv.classList.add("isDragging");
      });

      pageDiv.addEventListener("dragend", () => {
        pageDiv.classList.remove("isDragging");
        markDragging(false);
      });

      pageDiv.addEventListener("dragover", (e) => {
        if (isFixed) return;
        if (!e.dataTransfer.types.includes("text/og-page")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        pageDiv.classList.add("isDragOver");
      });

      pageDiv.addEventListener("dragleave", () => {
        pageDiv.classList.remove("isDragOver");
      });

      pageDiv.addEventListener("drop", (e) => {
        if (isFixed) return;
        if (!e.dataTransfer.types.includes("text/og-page")) return;
        e.preventDefault();
        pageDiv.classList.remove("isDragOver");

        const fromIdx = Number(e.dataTransfer.getData("text/og-page-schema-index"));
        const toIdx = Number(pageDiv.dataset.schemaIndex);
        if (!Number.isFinite(fromIdx) || !Number.isFinite(toIdx)) return;
        if (fromIdx === toIdx) return;

        // Move within schema.pages by schema indices, then re-enforce fixed pages at end
        moveItem(schema.pages, fromIdx, toIdx);
        ensureFixedCheckoutPages();
        saveSchema();
        renderAll();
      });

      const top = document.createElement("div");
      top.className = "pageTop";

      const left = document.createElement("div");
      left.style.flex = "1";
      left.style.minWidth = "0";

      const name = document.createElement("div");
      name.className = "pageName";
      name.contentEditable = isFixed ? "false" : "true";
      name.spellcheck = false;
      name.setAttribute("role", "textbox");
      name.setAttribute("aria-label", "Page name");
      name.title = isFixed ? "Fixed page" : "Click to rename";
      name.textContent = p.name;

      if (!isFixed) {
        name.addEventListener("mousedown", (e) => e.stopPropagation());
        name.addEventListener("click", (e) => e.stopPropagation());

        name.addEventListener("focus", (e) => {
          e.stopPropagation();
          selection.pageId = p.id;
          ensureSelection();
          requestAnimationFrame(() => selectAllContent(name));
        });

        name.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            name.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            name.textContent = p.name;
            name.blur();
          }
        });

        name.addEventListener("blur", () => {
          const next = safeText(name) || "Untitled page";
          name.textContent = next;
          p.name = next;
          saveSchema();
          renderAll();
        });

        name.addEventListener("input", () => {
          p.name = safeText(name) || "Untitled page";
          saveSchemaDebounced();
          editorTitleEl.textContent = `Editor · ${p.name}`;
          pageNameDisplayEl.textContent = p.name;
          renderMiniStats();
        });
      }

      const meta = document.createElement("div");
      meta.className = "pageMeta";
      const qCount = p.groups.reduce((acc, g) => acc + (g.questions?.length || 0), 0);
      meta.textContent = `${templateLabel(p.template)} · ${p.groups.length} group${p.groups.length !== 1 ? "s" : ""} · ${qCount} question${qCount !== 1 ? "s" : ""}`;

      left.appendChild(name);
      left.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "pageActions";

      if (!isFixed) {
        const renameBtn = iconButton("✎", "Rename page");
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          name.focus();
          requestAnimationFrame(() => selectAllContent(name));
        });

        const upBtn = iconButton("↑", "Move up");
        upBtn.disabled = editableIdx === 0;
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          // Move within schema.pages by schema index
          moveItem(schema.pages, schemaIdx, schemaIdx - 1);
          ensureFixedCheckoutPages();
          saveSchema();
          renderAll();
        });

        const downBtn = iconButton("↓", "Move down");
        downBtn.disabled = editableIdx === editablePages.length - 1;
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveItem(schema.pages, schemaIdx, schemaIdx + 1);
          ensureFixedCheckoutPages();
          saveSchema();
          renderAll();
        });

        const delBtn = iconButton("✕", "Delete page");
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!confirm(`Delete page "${p.name}"? This cannot be undone.`)) return;
          schema.pages = schema.pages.filter((x) => x.id !== p.id);
          ensureFixedCheckoutPages();
          saveSchema();
          ensureSelection();
          renderAll();
        });

        actions.appendChild(renameBtn);
        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        actions.appendChild(delBtn);
      }

      top.appendChild(left);
      top.appendChild(actions);
      pageDiv.appendChild(top);

      // Flow chips (only for editable pages; fixed pages are treated as templates)
      if (!isFixed) {
        const chips = document.createElement("div");
        chips.className = "groupsMini";

        p.flow.forEach((it) => {
          if (it.type === "group") {
            const g = p.groups.find((gg) => gg.id === it.id);
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className =
              "groupChip" +
              (p.id === selection.pageId && selection.blockType === "group" && selection.groupId === g?.id ? " active" : "");
            chip.textContent = g?.name || "(Missing group)";
            chip.addEventListener("click", (e) => {
              e.stopPropagation();
              selection.pageId = p.id;
              selection.blockType = "group";
              selection.blockId = it.id;
              selection.groupId = it.id;
              selection.questionId = g?.questions?.[0]?.id || null;
              renderAll();
            });
            chips.appendChild(chip);
          }

          if (it.type === "text") {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className =
              "groupChip" +
              (p.id === selection.pageId && selection.blockType === "text" && selection.blockId === it.id ? " active" : "");
            chip.textContent = it.title ? `📝 ${it.title}` : "📝 Text block";
            chip.addEventListener("click", (e) => {
              e.stopPropagation();
              selection.pageId = p.id;
              selection.blockType = "text";
              selection.blockId = it.id;
              selection.groupId = null;
              selection.questionId = null;
              renderAll();
            });
            chips.appendChild(chip);
          }
        });

        const addTextChip = document.createElement("button");
        addTextChip.type = "button";
        addTextChip.className = "groupChip";
        addTextChip.textContent = "+ Text";
        addTextChip.addEventListener("click", (e) => {
          e.stopPropagation();
          selection.pageId = p.id;
          addTextBlockToPage(p.id);
        });
        chips.appendChild(addTextChip);

        const addGroupChip = document.createElement("button");
        addGroupChip.type = "button";
        addGroupChip.className = "groupChip";
        addGroupChip.textContent = "+ Group";
        addGroupChip.addEventListener("click", (e) => {
          e.stopPropagation();
          selection.pageId = p.id;
          addGroupToPage(p.id);
        });
        chips.appendChild(addGroupChip);

        pageDiv.appendChild(chips);
      }

      // click page selects it
      pageDiv.addEventListener("click", () => {
        if (isDraggingUI) return;
        selection.pageId = p.id;

        if (isFixed) {
          // Fixed pages: default to first group
          const g0 = p.groups[0];
          selection.blockType = "group";
          selection.blockId = g0?.id || null;
          selection.groupId = g0?.id || null;
          selection.questionId = g0?.questions?.[0]?.id || null;
          renderAll(true);
          return;
        }

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
        renderAll();
      });

      pagesListEl.appendChild(pageDiv);
    };

    // Render editable pages (in order)
    editablePages.forEach((p, editableIdx) => {
      const schemaIdx = schema.pages.findIndex((x) => x.id === p.id);
      renderPageItem(p, schemaIdx, editableIdx, false);
    });

    // Divider label
    if (fixedPages.length) {
      const div = document.createElement("div");
      div.className = "sectionTitle";
      div.style.marginTop = "14px";
      div.style.opacity = "0.9";
      div.textContent = "Checkout pages";
      pagesListEl.appendChild(div);
    }

    // Render fixed pages (Quote, Summary, Payment)
    fixedPages.forEach((p) => {
      renderPageItem(p, -1, true);
    });
  }

  function renderCanvas() {
    /* ----------------------------------------------------------------------
    CH 4.2  Main editor (page/group/question)
    ---------------------------------------------------------------------- */
    canvasEl.innerHTML = "";

    const p = getPage(selection.pageId);
    if (!p) return;

    // DnD helpers (questions)
    const canStartDragFromQ = (el) => {
      if (!el) return true;
      if (el.closest && el.closest(".iconBtn")) return false;
      if (el.isContentEditable) return false;
      return true;
    };

    // Phase 1: if a text block is selected, show a simple preview card
    if (selection.blockType === "text") {
      const tb = (p.flow || []).find((x) => x.type === "text" && x.id === selection.blockId);

      const card = document.createElement("div");
      card.className = "tip";

      const level = tb?.level || "h3";
      const title = tb?.title || "Text block";
      const body = sanitizeRichHtml(tb?.bodyHtml || "");

      card.innerHTML = `
        <div class="tipTitle">📝 ${escapeHtml(title)}</div>
        <div class="muted">This is a text block separator. It will be used when we switch Preview to page-by-page mode.</div>
        <div style="margin-top:10px">${body || "<p class='muted'>No content yet.</p>"}</div>
      `;

      canvasEl.appendChild(card);
      return;
    }

    const g = getGroup(selection.pageId, selection.groupId);
    if (!g) return;

    // Canvas header: show Page title, then Group title + description at the top
    const canvasHeader = document.createElement("div");
    canvasHeader.className = "canvasHeader";

    const pageTitle = document.createElement("div");
    pageTitle.className = "canvasPageTitle";
    pageTitle.textContent = p.name || "Untitled page";

    const groupTitle = document.createElement("div");
    groupTitle.className = "canvasGroupTitle";
    groupTitle.textContent = g.name || "Untitled group";

    canvasHeader.appendChild(pageTitle);
    canvasHeader.appendChild(groupTitle);

    if (g.description?.enabled) {
      const descHtml = sanitizeRichHtml(g.description.html || "");
      if (descHtml) {
        const groupDesc = document.createElement("div");
        groupDesc.className = "canvasGroupDesc";
        groupDesc.innerHTML = descHtml;
        canvasHeader.appendChild(groupDesc);
      }
    }

    canvasEl.appendChild(canvasHeader);

    // Helper: render the contextual "+ Question" button under the list
    const renderAddQuestionCTA = () => {
      const wrap = document.createElement("div");
      wrap.className = "canvasAddRow";
      wrap.style.marginTop = "14px";
      wrap.style.display = "flex";
      wrap.style.justifyContent = "flex-end";

      btnAddQuestion.classList.add("btn");
      wrap.appendChild(btnAddQuestion);
      canvasEl.appendChild(wrap);
    };

    if (!g.questions.length) {
      const empty = document.createElement("div");
      empty.className = "tip";
      empty.innerHTML = `
        <div class="tipTitle">No questions in this group</div>
        <p class="muted">Add your first question to start building a Typeform-style journey.</p>
      `;
      canvasEl.appendChild(empty);
      renderAddQuestionCTA();
      return;
    }

    g.questions.forEach((q, qIdx) => {
      const card = document.createElement("div");
      card.className = "qCard" + (q.id === selection.questionId ? " active" : "");

      // Make question cards draggable (builder-only)
      card.draggable = !preview.open; // builder canvas only
      card.dataset.qId = q.id;
      card.dataset.qIndex = String(qIdx);

      card.addEventListener("dragstart", (e) => {
        if (preview.open) { e.preventDefault(); return; }
        if (!canStartDragFromQ(e.target)) {
          e.preventDefault();
          return;
        }
        markDragging(true);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/og-q", q.id);
        e.dataTransfer.setData("text/og-q-index", String(qIdx));
        card.classList.add("isDragging");
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("isDragging");
        markDragging(false);
      });

      card.addEventListener("dragover", (e) => {
        if (!e.dataTransfer.types.includes("text/og-q")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        card.classList.add("isDragOver");
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("isDragOver");
      });

      card.addEventListener("drop", (e) => {
        if (!e.dataTransfer.types.includes("text/og-q")) return;
        e.preventDefault();
        card.classList.remove("isDragOver");

        const fromIdx = Number(e.dataTransfer.getData("text/og-q-index"));
        const toIdx = Number(card.dataset.qIndex);
        if (!Number.isFinite(fromIdx) || !Number.isFinite(toIdx)) return;
        if (fromIdx === toIdx) return;

        moveItem(g.questions, fromIdx, toIdx);
        saveSchema();
        renderAll();
      });

      const left = document.createElement("div");
      left.className = "qLeft";

      const title = document.createElement("div");
      title.className = "qTitle";
      title.textContent = q.title || "Untitled question";

      const meta = document.createElement("div");
      meta.className = "qMeta";

      const typeBadge = document.createElement("span");
      typeBadge.className = "badge";
      typeBadge.textContent = QUESTION_TYPES.find((t) => t.key === q.type)?.label || q.type;
      meta.appendChild(typeBadge);

      if (q.required) {
        const req = document.createElement("span");
        req.className = "badge req";
        req.textContent = "Required";
        meta.appendChild(req);
      }

      if (q.logic?.enabled && (q.logic.rules?.length || 0) > 0) {
        const lg = document.createElement("span");
        lg.className = "badge logic";
        lg.textContent = "Logic";
        meta.appendChild(lg);
      }

      left.appendChild(title);
      left.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "qActions";

      const upBtn = iconButton("↑", "Move up");
      upBtn.disabled = qIdx === 0;
      upBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveItem(g.questions, qIdx, qIdx - 1);
        saveSchema();
        renderAll();
      });

      const downBtn = iconButton("↓", "Move down");
      downBtn.disabled = qIdx === g.questions.length - 1;
      downBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveItem(g.questions, qIdx, qIdx + 1);
        saveSchema();
        renderAll();
      });

      const dupBtn = iconButton("⧉", "Duplicate");
      dupBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const copy = deepClone(q);
        copy.id = uid("q");
        g.questions.splice(qIdx + 1, 0, copy);
        selection.questionId = copy.id;
        saveSchema();
        renderAll();
      });

      const delBtn = iconButton("✕", "Delete");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm("Delete this question?")) return;
        g.questions = g.questions.filter((x) => x.id !== q.id);
        if (selection.questionId === q.id) selection.questionId = g.questions[0]?.id || null;
        saveSchema();
        renderAll();
      });

      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
      actions.appendChild(dupBtn);
      actions.appendChild(delBtn);

      card.appendChild(left);
      card.appendChild(actions);

      card.addEventListener("click", () => {
        // Ignore click selection during/just-after drag
        if (isDraggingUI) return;
        selection.questionId = q.id;
        renderAll();
      });

      canvasEl.appendChild(card);
    });

    renderAddQuestionCTA();
  }

  function renderInspector() {
    inspectorEl.innerHTML = "";
    const p = getPage(selection.pageId);
    const g = getGroup(selection.pageId, selection.groupId);
    const q = getQuestion(selection.pageId, selection.groupId, selection.questionId);

    if (!p) {
      inspectorSubEl.textContent = "Create a page to get started";
      return;
    }

    // Page settings (always available)
    inspectorEl.appendChild(sectionTitle("Page"));

    inspectorEl.appendChild(fieldText("Page name", p.name || "Untitled page", (val) => {
      // Fixed pages cannot be renamed
      if (isFixedPage(p)) return;
      p.name = val || "Untitled page";
      saveSchemaDebounced();
      renderPagesList();
      editorTitleEl.textContent = `Editor · ${p.name}`;
      pageNameDisplayEl.textContent = p.name;
    }));

    if (isFixedPage(p)) {
      inspectorEl.appendChild(pEl(`This is a fixed checkout page (${templateLabel(p.template)}). It will always exist and always stay at the end of the left nav. You can still edit its groups/questions.`, "inlineHelp"));
    }

    inspectorEl.appendChild(divider());

    // If a text block is selected, show a dedicated inspector
    if (selection.blockType === "text") {
      const tb = (p.flow || []).find((x) => x.type === "text" && x.id === selection.blockId);
      inspectorSubEl.textContent = "Editing text block";

      inspectorEl.appendChild(sectionTitle("Text block"));

      // Title + level
      inspectorEl.appendChild(fieldText("Title", tb?.title || "", (val) => {
        if (!tb) return;
        tb.title = val;
        saveSchemaDebounced();
        renderPagesList();
        renderCanvas();
      }));

      inspectorEl.appendChild(fieldSelect(
        "Heading size",
        tb?.level || "h3",
        [
          { value: "h1", label: "H1" },
          { value: "h2", label: "H2" },
          { value: "h3", label: "H3" },
          { value: "body", label: "Body" },
        ],
        (val) => {
          if (!tb) return;
          tb.level = val;
          saveSchema();
          renderCanvas();
          renderPagesList();
        }
      ));

      // Body content
      inspectorEl.appendChild(richTextEditor("Body", tb?.bodyHtml || "<p></p>", (html) => {
        if (!tb) return;
        tb.bodyHtml = sanitizeRichHtml(html);
        saveSchemaDebounced();
        renderCanvas();
      }));

      // Arrange + duplicate + delete
      inspectorEl.appendChild(divider());

      inspectorEl.appendChild(buttonRow([
        { label: "Move up", kind: "ghost", onClick: () => moveFlowItem(p.id, tb?.id, -1) },
        { label: "Move down", kind: "ghost", onClick: () => moveFlowItem(p.id, tb?.id, +1) },
        { label: "Duplicate", kind: "ghost", onClick: () => duplicateTextBlock(p.id, tb?.id) },
      ]));

      inspectorEl.appendChild(buttonRow([
        {
          label: "Delete text block",
          kind: "ghost",
          onClick: () => {
            if (!tb) return;
            if (!confirm("Delete this text block?")) return;
            deleteFlowItem(p.id, tb.id);
          },
        },
      ]));

      return;
    }

    if (!g) {
      inspectorSubEl.textContent = "Select or add a group";
      inspectorEl.appendChild(sectionTitle("Page"));
      inspectorEl.appendChild(fieldText("Page name", p.name, (val) => {
        p.name = val || "Untitled page";
        saveSchemaDebounced();
        renderPagesList();
        editorTitleEl.textContent = `Editor · ${p.name}`;
        pageNameDisplayEl.textContent = p.name;
      }));
      inspectorEl.appendChild(buttonRow([{ label: "+ Group", kind: "primary", onClick: () => addGroupToPage(p.id) }]));
      inspectorEl.appendChild(buttonRow([{ label: "+ Text block", kind: "ghost", onClick: () => addTextBlockToPage(p.id) }]));
      return;
    }

    // Global preview settings (small step #4)
    inspectorEl.appendChild(sectionTitle("Preview settings"));
    inspectorEl.appendChild(fieldSelect(
      "Preview mode",
      preview.mode || "question",
      [
        { value: "question", label: "Question-by-question (Typeform)" },
        { value: "page", label: "Page-at-a-time (layout)" },
      ],
      (val) => {
        preview.mode = val;
        // Persist mode inside schema meta for convenience
        schema.meta = schema.meta || {};
        schema.meta.previewMode = val;
        saveSchema();
      }
    ));

    inspectorEl.appendChild(divider());

    // Group editor (always visible)
    inspectorSubEl.textContent = q ? "Editing question" : "Editing group";

    inspectorEl.appendChild(sectionTitle("Group"));

    inspectorEl.appendChild(fieldText("Group name", g.name, (val) => {
      g.name = val || "Untitled group";
      saveSchemaDebounced();
      renderPagesList();
      groupNameDisplayEl.textContent = g.name;
    }));

    // Group description (small step #2)
    g.description = g.description || { enabled: false, html: "" };
    inspectorEl.appendChild(toggleRow("Add group description", g.description.enabled === true, (on) => {
      g.description.enabled = on;
      if (!g.description.html) g.description.html = "<p></p>";
      saveSchema();
      isTypingInspector = false;
      renderAll(true);
    }));

    if (g.description.enabled) {
      inspectorEl.appendChild(richTextEditor("Description", g.description.html || "", (html) => {
        g.description.html = sanitizeRichHtml(html);
        saveSchemaDebounced();
      }));
    }

    // Group conditional logic (small step #3)
    inspectorEl.appendChild(divider());
    inspectorEl.appendChild(sectionTitle("Group visibility"));
    inspectorEl.appendChild(pEl("Show this group only if the rule(s) match. (Hides all questions in the group in Preview)", "inlineHelp"));

    inspectorEl.appendChild(toggleRow("Enable group logic", g.logic?.enabled === true, (on) => {
      g.logic = g.logic || { enabled: false, rules: [] };
      g.logic.enabled = on;
      saveSchema();
      isTypingInspector = false;
      renderAll(true);
    }));

    if (g.logic?.enabled) {
      inspectorEl.appendChild(groupLogicEditor(schema, p, g));
    }

    // Move group + delete group
    inspectorEl.appendChild(buttonRow([
      { label: "Move group up", kind: "ghost", onClick: () => moveGroup(p.id, g.id, -1) },
      { label: "Move group down", kind: "ghost", onClick: () => moveGroup(p.id, g.id, +1) },
    ]));

    inspectorEl.appendChild(buttonRow([
      {
        label: "Delete group",
        kind: "ghost",
        onClick: () => {
          if (!confirm(`Delete group "${g.name}"?`)) return;
          p.groups = p.groups.filter((x) => x.id !== g.id);
          // also remove from flow
          p.flow = (p.flow || []).filter((x) => !(x.type === "group" && x.id === g.id));
          selection.blockType = "group";
          selection.blockId = p.flow[0]?.id || p.groups[0]?.id || null;
          selection.groupId = p.groups[0]?.id || null;
          selection.questionId = p.groups[0]?.questions?.[0]?.id || null;
          saveSchema();
          renderAll();
        },
      },
    ]));

    // (Removed) Question arrays section — follow-ups can now be repeatable inside questions.

    inspectorEl.appendChild(divider());

    // If no question selected
    if (!q) {
      inspectorEl.appendChild(sectionTitle("Questions"));
      inspectorEl.appendChild(pEl("Select a question in the canvas to edit its settings.", "inlineHelp"));
      return;
    }

    // Question inspector
    inspectorEl.appendChild(sectionTitle("Question"));

    inspectorEl.appendChild(fieldText("Question text", q.title, (val) => {
      q.title = val || "Untitled question";
      saveSchemaDebounced();
      renderCanvas();
      renderPagesList();
    }));

    inspectorEl.appendChild(fieldTextArea("Help text", q.help || "", (val) => {
      q.help = val;
      saveSchemaDebounced();
    }));

    // Explanatory content (rich text block shown above the answer control in Preview)
    q.content = q.content || { enabled: false, html: "" };
    inspectorEl.appendChild(toggleRow("Add explanatory content", q.content.enabled === true, (on) => {
      q.content.enabled = on;
      if (!q.content.html) q.content.html = "<p></p>";
      saveSchema();
      isTypingInspector = false;
      renderAll(true);
    }));

    if (q.content.enabled) {
      inspectorEl.appendChild(richTextEditor("Content", q.content.html || "", (html) => {
        q.content.html = sanitizeRichHtml(html);
        saveSchemaDebounced();
      }));
    }

    inspectorEl.appendChild(fieldSelect("Type", q.type, QUESTION_TYPES.map(t => ({ value: t.key, label: t.label })), (val) => {
      q.type = val;
      if (!isOptionType(q.type)) q.options = [];
      if (isOptionType(q.type) && (!q.options || !q.options.length)) {
        q.options = ["Option 1", "Option 2", "Option 3"];
      }
      saveSchema();
      renderAll();
    }));

    // Placeholder
    if (
      q.type === "text" ||
      q.type === "email" ||
      q.type === "number" ||
      q.type === "currency" ||
      q.type === "percent" ||
      q.type === "tel" ||
      q.type === "postcode"
    ) {
      inspectorEl.appendChild(fieldText("Placeholder", q.placeholder || "", (val) => {
        q.placeholder = val;
        saveSchema();
      }));
    }

    // Required toggle
    inspectorEl.appendChild(toggleRow("Required", q.required === true, (on) => {
      q.required = on;
      // Ensure default error text exists when toggling required on
      if (q.required && !q.errorText) q.errorText = "This field is required.";
      saveSchema();
      renderAll();
    }));

    // Custom error message (shown in Preview when validation fails)
    // Only show this control when Required is enabled (keeps UI clean)
    if (q.required === true) {
      inspectorEl.appendChild(fieldTextArea("Error message", q.errorText || "This field is required.", (val) => {
        q.errorText = val;
        saveSchemaDebounced();
      }));
    }

    // Options editor
    if (isOptionType(q.type)) {
      inspectorEl.appendChild(divider());
      inspectorEl.appendChild(sectionTitle("Options"));
      inspectorEl.appendChild(pEl("Add, rename, reorder, or delete options.", "inlineHelp"));
      inspectorEl.appendChild(optionsEditor(q));
    }

    // Follow-up questions (nested array) — only for Yes/No
    inspectorEl.appendChild(divider());

    if (q.type === "yesno") {
      inspectorEl.appendChild(sectionTitle("Follow-up questions"));
      inspectorEl.appendChild(
        pEl(
          "Show a nested set of questions when the answer matches (e.g. Yes → capture conviction details).",
          "inlineHelp"
        )
      );

      q.followUp = q.followUp || {
        enabled: false,
        triggerValue: "Yes",
        name: "",
        questions: [],
        repeat: { enabled: false, min: 1, max: 5, addLabel: "Add another", itemLabel: "Item" },
      };
      q.followUp.repeat = q.followUp.repeat && typeof q.followUp.repeat === "object" ? q.followUp.repeat : { enabled: false, min: 1, max: 5, addLabel: "Add another", itemLabel: "Item" };

      inspectorEl.appendChild(
        toggleRow("Enable follow-up questions", q.followUp.enabled === true, (on) => {
          q.followUp.enabled = on;
          saveSchema();
          isTypingInspector = false;
          renderAll(true);
        })
      );

      if (q.followUp.enabled) {
        inspectorEl.appendChild(
          fieldSelect(
            "Trigger answer",
            q.followUp.triggerValue || "Yes",
            [
              { value: "Yes", label: "Yes" },
              { value: "No", label: "No" },
            ],
            (val) => {
              q.followUp.triggerValue = val;
              saveSchema();
              renderAll(true);
            }
          )
        );

        inspectorEl.appendChild(
          fieldText("Array name", q
