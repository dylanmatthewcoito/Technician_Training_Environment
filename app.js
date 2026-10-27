(function () {
  "use strict";

  const STORAGE_KEY = "technician-training-recipes-v1";
  const AREAS_KEY = "technician-training-areas-v1";
  const DEFAULT_AREAS = ["Autoclave", "General"];

  function makeId() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function makeStep(type, title, instructions, extra) {
    return Object.assign({
      id: makeId(),
      type: type,
      title: title || "",
      instructions: instructions || "",
      yesNext: "next",
      noNext: "next"
    }, extra || {});
  }

  function starterRecipes() {
    return [{
      id: "autoclave-readiness",
      name: "Autoclave readiness check",
      area: "Autoclave",
      description: "Practice the simulated equipment check, cycle start, and readiness review.",
      duration: "15 min",
      steps: [
        makeStep("acknowledge", "Review autoclave safety", "Acknowledge the autoclave safety prompt. Follow your approved site procedures before working with equipment."),
        makeStep("action", "Check in autoclave equipment", "In this simulation, check the autoclave equipment in to the training system."),
        makeStep("action", "Load the test pack and close the doors", "In this simulation, place the test pack inside and confirm the autoclave doors are shut. Follow your approved site procedures for real equipment."),
        makeStep("action", "Press Start", "Simulate pressing Start to begin the training cycle."),
        makeStep("check", "Was there an alarm?", "Record whether an alarm occurred during the simulated cycle. Follow the configured training route and your site's approved procedures.", { yesNext: "stop", noNext: "next" }),
        makeStep("check", "Did the autoclave pass the air removal test?", "Record the simulated air removal test result. Follow the configured training route and your site's approved procedures.", { yesNext: "next", noNext: "stop" }),
        makeStep("action", "Assign autoclave status", "In this simulation, assign the autoclave status as Available.")
      ]
    }];
  }

  function loadArray(key, fallback) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return fallback;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
      console.error("Could not load training library data.", error);
      return fallback;
    }
  }

  let areas = loadArray(AREAS_KEY, DEFAULT_AREAS.slice());
  let recipes = loadArray(STORAGE_KEY, null);
  if (!recipes) {
    recipes = starterRecipes();
    persistRecipes();
  }
  if (!areas.includes("Autoclave")) areas.unshift("Autoclave");
  if (!areas.includes("General")) areas.push("General");

  let selectedArea = "all";
  let editingRecipeId = null;
  let activeRun = null;
  let toastTimer = null;

  const recipeGrid = document.getElementById("recipe-grid");
  const areaNav = document.getElementById("area-nav");
  const searchInput = document.getElementById("recipe-search");
  const recipeDialog = document.getElementById("recipe-dialog");
  const recipeForm = document.getElementById("recipe-form");
  const areaDialog = document.getElementById("area-dialog");
  const areaForm = document.getElementById("area-form");
  const stepEditorList = document.getElementById("step-editor-list");
  const runDialog = document.getElementById("run-dialog");
  const runPanel = document.getElementById("run-panel");

  function persistRecipes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
    } catch (error) {
      console.error("Could not save training recipes.", error);
      showToast("Could not save recipes in this browser. Check browser storage settings.");
    }
  }

  function persistAreas() {
    try {
      localStorage.setItem(AREAS_KEY, JSON.stringify(areas));
    } catch (error) {
      console.error("Could not save training areas.", error);
      showToast("Could not save areas in this browser. Check browser storage settings.");
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("visible"); }, 2800);
  }

  function renderAreaNavigation() {
    const counts = {};
    recipes.forEach(function (recipe) { counts[recipe.area] = (counts[recipe.area] || 0) + 1; });
    document.getElementById("recipe-count").textContent = String(recipes.length);
    areaNav.innerHTML = areas.map(function (area) {
      return '<button class="area-link' + (selectedArea === area ? " active" : "") + '" type="button" data-area="' + escapeHtml(area) + '">' +
        '<span class="area-dot"></span><span>' + escapeHtml(area) + '</span><span class="area-total">' + (counts[area] || 0) + '</span></button>';
    }).join("");
    updateAreaSelect();
  }

  function updateAreaSelect() {
    const select = document.getElementById("recipe-area-select");
    if (!select) return;
    const previous = select.value;
    select.innerHTML = areas.map(function (area) { return '<option value="' + escapeHtml(area) + '">' + escapeHtml(area) + '</option>'; }).join("");
    if (areas.includes(previous)) select.value = previous;
  }

  function renderRecipes() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = recipes.filter(function (recipe) {
      const matchesArea = selectedArea === "all" || recipe.area === selectedArea;
      const matchesQuery = !query || (recipe.name + " " + recipe.description + " " + recipe.area).toLowerCase().includes(query);
      return matchesArea && matchesQuery;
    });
    document.getElementById("stat-recipes").textContent = String(recipes.length);
    document.getElementById("stat-areas").textContent = String(areas.length);
    document.getElementById("stat-ready").textContent = String(recipes.filter(function (recipe) { return recipe.steps && recipe.steps.length; }).length);
    document.getElementById("library-title").textContent = selectedArea === "all" ? "Your recipes" : selectedArea + " recipes";
    document.getElementById("library-description").textContent = selectedArea === "all" ? "Choose a workflow to preview or practice." : "Recipes organized for " + selectedArea + ".";
    document.getElementById("page-title").textContent = selectedArea === "all" ? "Recipe library" : selectedArea;
    document.getElementById("page-subtitle").textContent = selectedArea === "all" ? "A safe place to learn each workflow, one step at a time." : "Practice and manage training recipes for this area.";
    document.getElementById("empty-state").hidden = recipes.length > 0;
    document.getElementById("no-results").hidden = recipes.length === 0 || filtered.length > 0;
    recipeGrid.hidden = filtered.length === 0;
    recipeGrid.innerHTML = filtered.map(function (recipe) {
      const steps = Array.isArray(recipe.steps) ? recipe.steps.length : 0;
      return '<article class="recipe-card">' +
        '<div class="recipe-card-top"><span class="area-tag"><span></span>' + escapeHtml(recipe.area) + '</span><button class="menu-trigger" type="button" data-action="edit-recipe" data-id="' + escapeHtml(recipe.id) + '" aria-label="Edit ' + escapeHtml(recipe.name) + '" title="Edit recipe">···</button></div>' +
        '<h3>' + escapeHtml(recipe.name) + '</h3><p class="recipe-description">' + escapeHtml(recipe.description || "No description yet.") + '</p>' +
        '<div class="recipe-card-bottom"><div class="recipe-meta"><span>☷ ' + steps + ' steps</span><span>◷ ' + escapeHtml(recipe.duration || "—") + '</span></div>' +
        '<div class="card-actions"><button class="small-button" type="button" data-action="edit-recipe" data-id="' + escapeHtml(recipe.id) + '">Edit</button><button class="small-button start" type="button" data-action="start-recipe" data-id="' + escapeHtml(recipe.id) + '">Practice <span aria-hidden="true">→</span></button></div></div></article>';
    }).join("");
    renderAreaNavigation();
  }

  function stepTypeLabel(type) {
    return { acknowledge: "Acknowledge / sign", action: "Instruction / action", check: "Yes / no check" }[type] || "Instruction / action";
  }

  function addEditorStep(step) {
    const number = stepEditorList.children.length + 1;
    const model = step || makeStep("action");
    const node = document.createElement("section");
    node.className = "step-editor";
    node.dataset.stepId = model.id || makeId();
    node.innerHTML = '<div class="step-editor-top"><span class="step-number">' + number + '</span>' +
      '<input class="step-title" aria-label="Step ' + number + ' title" maxlength="100" placeholder="Step title" value="' + escapeHtml(model.title) + '">' +
      '<select class="step-type" aria-label="Step ' + number + ' type"><option value="acknowledge">Acknowledge / sign</option><option value="action">Instruction / action</option><option value="check">Yes / no check</option></select>' +
      '<button class="remove-step" type="button" data-action="remove-step" aria-label="Remove step ' + number + '" title="Remove step">×</button></div>' +
      '<textarea class="step-instructions" aria-label="Step ' + number + ' instructions" rows="2" maxlength="600" placeholder="What should the trainee read or do?">' + escapeHtml(model.instructions) + '</textarea>' +
      '<div class="route-grid" hidden><label>If Yes<select class="yes-route" aria-label="Route if yes"></select></label><label>If No<select class="no-route" aria-label="Route if no"></select></label></div>' +
      '<p class="route-hint" hidden>Routes apply after the trainee records their answer. End this recipe marks it complete; Stop ends the practice without marking it complete.</p>';
    node.querySelector(".step-type").value = ["acknowledge", "action", "check"].includes(model.type) ? model.type : "action";
    node.dataset.yesNext = model.yesNext || "next";
    node.dataset.noNext = model.noNext || "next";
    stepEditorList.appendChild(node);
    renderStepEditors();
  }

  function renderStepEditors() {
    const editorNodes = Array.from(stepEditorList.querySelectorAll(".step-editor"));
    document.getElementById("step-count").textContent = editorNodes.length + (editorNodes.length === 1 ? " step" : " steps");
    editorNodes.forEach(function (node, index) {
      const countBadge = node.querySelector(".step-number");
      countBadge.textContent = String(index + 1);
      node.querySelector(".step-title").setAttribute("aria-label", "Step " + (index + 1) + " title");
      node.querySelector(".step-instructions").setAttribute("aria-label", "Step " + (index + 1) + " instructions");
      const routeGrid = node.querySelector(".route-grid");
      const routeHint = node.querySelector(".route-hint");
      const isCheck = node.querySelector(".step-type").value === "check";
      routeGrid.hidden = !isCheck;
      routeHint.hidden = !isCheck;
      if (isCheck) {
        ["yes-route", "no-route"].forEach(function (className) {
          const select = node.querySelector("." + className);
          const oldValue = node.dataset[className === "yes-route" ? "yesNext" : "noNext"] || "next";
          select.innerHTML = '<option value="next">Continue to next step</option><option value="complete">End recipe as complete</option><option value="stop">Stop practice</option>' +
            editorNodes.map(function (other, otherIndex) {
              return other === node ? "" : '<option value="' + escapeHtml(other.dataset.stepId) + '">Go to step ' + (otherIndex + 1) + "</option>";
            }).join("");
          select.value = Array.from(select.options).some(function (option) { return option.value === oldValue; }) ? oldValue : "next";
          node.dataset[className === "yes-route" ? "yesNext" : "noNext"] = select.value;
        });
      }
    });
  }

  function openRecipeEditor(recipe) {
    editingRecipeId = recipe ? recipe.id : null;
    recipeForm.reset();
    stepEditorList.innerHTML = "";
    document.getElementById("dialog-title").textContent = recipe ? "Edit recipe" : "Create a recipe";
    updateAreaSelect();
    if (recipe) {
      recipeForm.elements.name.value = recipe.name;
      recipeForm.elements.area.value = recipe.area;
      recipeForm.elements.duration.value = recipe.duration || "";
      recipeForm.elements.description.value = recipe.description || "";
      (recipe.steps || []).forEach(addEditorStep);
    } else {
      recipeForm.elements.area.value = areas.includes(selectedArea) ? selectedArea : (areas[0] || "General");
      addEditorStep(makeStep("acknowledge"));
    }
    recipeDialog.showModal();
  }

  function collectSteps() {
    return Array.from(stepEditorList.querySelectorAll(".step-editor")).map(function (node) {
      const type = node.querySelector(".step-type").value;
      return {
        id: node.dataset.stepId,
        type: type,
        title: node.querySelector(".step-title").value.trim(),
        instructions: node.querySelector(".step-instructions").value.trim(),
        yesNext: type === "check" ? node.querySelector(".yes-route").value : "next",
        noNext: type === "check" ? node.querySelector(".no-route").value : "next"
      };
    });
  }

  function saveRecipe(event) {
    event.preventDefault();
    const steps = collectSteps();
    if (!steps.length) {
      showToast("Add at least one step before saving.");
      return;
    }
    const missing = steps.findIndex(function (step) { return !step.title || !step.instructions; });
    if (missing !== -1) {
      showToast("Add a title and instructions to step " + (missing + 1) + ".");
      const field = stepEditorList.children[missing].querySelector(stepEditorList.children[missing].querySelector(".step-title").value.trim() ? ".step-instructions" : ".step-title");
      field.focus();
      return;
    }
    const existing = recipes.find(function (item) { return item.id === editingRecipeId; });
    const recipe = {
      id: editingRecipeId || makeId(),
      name: recipeForm.elements.name.value.trim(),
      area: recipeForm.elements.area.value,
      duration: recipeForm.elements.duration.value.trim() || "—",
      description: recipeForm.elements.description.value.trim(),
      steps: steps,
      createdAt: existing ? existing.createdAt : new Date().toISOString()
    };
    if (existing) recipes = recipes.map(function (item) { return item.id === editingRecipeId ? recipe : item; });
    else recipes.unshift(recipe);
    persistRecipes();
    recipeDialog.close();
    renderRecipes();
    showToast(existing ? "Recipe updated." : "Recipe added to your library.");
  }

  function startRun(recipe) {
    if (!recipe || !recipe.steps || recipe.steps.length === 0) {
      showToast("Add steps to this recipe before starting practice.");
      return;
    }
    activeRun = { recipe: recipe, currentStepId: recipe.steps[0].id, answers: {}, signature: "", visited: [], result: null };
    renderRun();
    runDialog.showModal();
  }

  function currentRunStep() {
    return activeRun && activeRun.recipe.steps.find(function (step) { return step.id === activeRun.currentStepId; });
  }

  function runProgress() {
    const total = activeRun.recipe.steps.length;
    const index = activeRun.recipe.steps.findIndex(function (step) { return step.id === activeRun.currentStepId; });
    return { total: total, index: Math.max(index, 0), current: Math.max(index, 0) + 1 };
  }

  function renderRun() {
    const recipe = activeRun.recipe;
    const step = currentRunStep();
    if (!step || activeRun.result) {
      renderRunResult(activeRun.result || "complete");
      return;
    }
    const progress = runProgress();
    const percent = Math.max(4, Math.round(progress.index / progress.total * 100));
    const typeLabel = stepTypeLabel(step.type);
    const typeIcon = step.type === "check" ? "?" : (step.type === "acknowledge" ? "✓" : "→");
    let interaction = "";
    if (step.type === "acknowledge") {
      interaction = '<label class="signature-field">Trainee name for simulated acknowledgement<input id="signature-input" maxlength="80" autocomplete="name" placeholder="Type your name"></label>';
    } else if (step.type === "check") {
      const answer = activeRun.answers[step.id];
      interaction = '<div class="answer-buttons" role="group" aria-label="Select yes or no">' +
        '<button class="answer-button' + (answer === "Yes" ? " selected" : "") + '" type="button" data-action="answer" data-answer="Yes" aria-pressed="' + (answer === "Yes") + '">Yes</button>' +
        '<button class="answer-button' + (answer === "No" ? " selected" : "") + '" type="button" data-action="answer" data-answer="No" aria-pressed="' + (answer === "No") + '">No</button></div>';
    }
    runPanel.innerHTML = '<header class="run-header"><div class="run-brand"><span class="run-brand-mark">T</span> Technician Training</div><div class="run-header-actions"><span class="run-badge">SIMULATION</span><button class="icon-button" type="button" data-action="close-run" aria-label="Exit practice">×</button></div></header>' +
      '<div class="run-body"><p class="run-crumb">Recipe library <span> / </span>' + escapeHtml(recipe.area) + ' <span> / </span><strong>' + escapeHtml(recipe.name) + '</strong></p>' +
      '<h2 class="run-recipe-title">' + escapeHtml(recipe.name) + '</h2><p class="run-recipe-description">' + escapeHtml(recipe.description || "Practice this recipe in a simulated environment.") + '</p>' +
      '<div class="progress-wrap"><div class="progress-track" role="progressbar" aria-label="Recipe progress" aria-valuenow="' + progress.current + '" aria-valuemin="1" aria-valuemax="' + progress.total + '"><div class="progress-fill" style="width:' + percent + '%"></div></div><span class="progress-label">Step ' + progress.current + ' of ' + progress.total + '</span></div>' +
      '<section class="run-step-card"><div class="run-step-type"><span>' + typeIcon + '</span>' + escapeHtml(typeLabel) + '</div><h3 class="run-step-title">' + escapeHtml(step.title) + '</h3><p class="run-instructions">' + escapeHtml(step.instructions) + '</p>' +
      '<div class="run-callout"><span aria-hidden="true">i</span><span>This is a training simulation only. Do not use this practice screen to operate equipment or replace approved procedures.</span></div>' +
      interaction + '</section><footer class="run-footer"><span class="run-footer-note">' + (activeRun.visited.length ? "Your practice answers stay in this session." : "No live system or equipment is connected.") + '</span>' + runButton(step) + '</footer></div>';
    const signatureInput = document.getElementById("signature-input");
    if (signatureInput) {
      signatureInput.value = activeRun.signature;
      signatureInput.addEventListener("input", function () {
        activeRun.signature = signatureInput.value.trim();
        const continueButton = runPanel.querySelector('[data-action="continue"]');
        if (continueButton) continueButton.disabled = !activeRun.signature;
      });
    }
  }

  function runButton(step) {
    if (step.type === "check") {
      const selected = activeRun.answers[step.id];
      return '<button class="button button-primary" type="button" data-action="continue" ' + (selected ? "" : "disabled") + '>Record answer &amp; continue <span aria-hidden="true">→</span></button>';
    }
    if (step.type === "acknowledge") {
      return '<button class="button button-primary" type="button" data-action="continue" ' + (activeRun.signature ? "" : "disabled") + '>Sign &amp; continue <span aria-hidden="true">→</span></button>';
    }
    return '<button class="button button-primary" type="button" data-action="continue">Next step <span aria-hidden="true">→</span></button>';
  }

  function advanceRun() {
    const step = currentRunStep();
    if (!step) return;
    if (step.type === "acknowledge" && !activeRun.signature) {
      showToast("Enter your name to sign this simulated acknowledgement.");
      return;
    }
    if (step.type === "check" && !activeRun.answers[step.id]) {
      showToast("Select Yes or No before continuing.");
      return;
    }
    if (!activeRun.visited.includes(step.id)) activeRun.visited.push(step.id);
    if (step.type === "check") {
      const route = activeRun.answers[step.id] === "Yes" ? step.yesNext : step.noNext;
      if (route === "complete") {
        activeRun.result = "complete";
        renderRun();
        return;
      }
      if (route === "stop") {
        activeRun.result = "stopped";
        renderRun();
        return;
      }
      if (route !== "next") {
        if (!activeRun.recipe.steps.some(function (candidate) { return candidate.id === route; })) {
          showToast("This check routes to a step that no longer exists. Edit the recipe to fix its route.");
          return;
        }
        activeRun.currentStepId = route;
        renderRun();
        return;
      }
    }
    const index = activeRun.recipe.steps.findIndex(function (candidate) { return candidate.id === step.id; });
    if (index >= activeRun.recipe.steps.length - 1) activeRun.result = "complete";
    else activeRun.currentStepId = activeRun.recipe.steps[index + 1].id;
    renderRun();
  }

  function renderRunResult(result) {
    const completed = result === "complete";
    const answered = Object.keys(activeRun.answers).length;
    runPanel.innerHTML = '<header class="run-header"><div class="run-brand"><span class="run-brand-mark">T</span> Technician Training</div><div class="run-header-actions"><span class="run-badge">SIMULATION</span><button class="icon-button" type="button" data-action="close-run" aria-label="Exit practice">×</button></div></header>' +
      '<section class="run-result"><span class="result-icon' + (completed ? "" : " stopped") + '">' + (completed ? "✓" : "Ⅱ") + '</span><h2>' + (completed ? "Practice complete" : "Practice stopped") + '</h2>' +
      '<p>' + (completed ? "You reached the end of this simulated recipe. No equipment or production records were changed." : "This practice ended at the configured stop point. Follow your approved site escalation process for real events.") + '</p>' +
      '<div class="result-summary"><strong>' + escapeHtml(activeRun.recipe.name) + '</strong><br>' + activeRun.visited.length + " of " + activeRun.recipe.steps.length + " steps visited · " + answered + ' check' + (answered === 1 ? "" : "s") + ' answered<br>' + (activeRun.signature ? "Acknowledged by " + escapeHtml(activeRun.signature) + " (simulation only)" : "No live signature recorded") + '</div>' +
      '<div class="card-actions"><button class="button button-secondary" type="button" data-action="close-run">Back to library</button><button class="button button-primary" type="button" data-action="restart-run">Practice again</button></div></section>';
  }

  function addArea() {
    const value = areaForm.elements.area.value.trim();
    if (!value) return;
    if (areas.some(function (area) { return area.toLowerCase() === value.toLowerCase(); })) {
      showToast("That area already exists.");
      return;
    }
    areas.push(value);
    persistAreas();
    areaForm.reset();
    areaDialog.close();
    selectedArea = value;
    renderRecipes();
    showToast("Area added.");
  }

  document.addEventListener("click", function (event) {
    const target = event.target.closest("[data-action], [data-area]");
    if (!target) return;
    if (target.dataset.area) {
      selectedArea = target.dataset.area;
      searchInput.value = "";
      renderRecipes();
      document.getElementById("main-content").focus();
      return;
    }
    switch (target.dataset.action) {
      case "home":
        selectedArea = "all";
        searchInput.value = "";
        renderRecipes();
        break;
      case "new-recipe":
        openRecipeEditor(null);
        break;
      case "edit-recipe": {
        const recipe = recipes.find(function (item) { return item.id === target.dataset.id; });
        if (recipe) openRecipeEditor(recipe);
        break;
      }
      case "start-recipe":
        startRun(recipes.find(function (item) { return item.id === target.dataset.id; }));
        break;
      case "add-step":
        addEditorStep(makeStep("action"));
        stepEditorList.lastElementChild.querySelector(".step-title").focus();
        break;
      case "remove-step":
        target.closest(".step-editor").remove();
        renderStepEditors();
        break;
      case "close-dialog":
        recipeDialog.close();
        break;
      case "add-area":
        areaDialog.showModal();
        areaForm.elements.area.focus();
        break;
      case "close-area":
        areaDialog.close();
        break;
      case "dismiss-notice":
        target.closest(".notice-banner").remove();
        break;
      case "answer": {
        const step = currentRunStep();
        if (!step) break;
        activeRun.answers[step.id] = target.dataset.answer;
        renderRun();
        break;
      }
      case "continue":
        advanceRun();
        break;
      case "close-run":
        runDialog.close();
        activeRun = null;
        break;
      case "restart-run":
        if (activeRun) startRun(activeRun.recipe);
        break;
    }
  });

  stepEditorList.addEventListener("change", function (event) {
    if (event.target.matches(".step-type")) renderStepEditors();
    if (event.target.matches(".yes-route, .no-route")) {
      const node = event.target.closest(".step-editor");
      node.dataset[event.target.classList.contains("yes-route") ? "yesNext" : "noNext"] = event.target.value;
    }
  });

  searchInput.addEventListener("input", renderRecipes);
  recipeForm.addEventListener("submit", saveRecipe);
  areaForm.addEventListener("submit", function (event) { event.preventDefault(); addArea(); });
  recipeDialog.addEventListener("click", function (event) { if (event.target === recipeDialog) recipeDialog.close(); });
  areaDialog.addEventListener("click", function (event) { if (event.target === areaDialog) areaDialog.close(); });
  runDialog.addEventListener("click", function (event) { if (event.target === runDialog) { runDialog.close(); activeRun = null; } });

  renderRecipes();
}());
