(function () {
  "use strict";

  let recipes = [];
  let selectedArea = "all";
  let activeRun = null;
  let toastTimer = null;

  const recipeGrid = document.getElementById("recipe-grid");
  const areaNav = document.getElementById("area-nav");
  const searchInput = document.getElementById("recipe-search");
  const libraryHeading = document.getElementById("library-heading");
  const libraryStats = document.getElementById("library-stats");
  const librarySection = document.querySelector(".library-section");
  const recipeHome = document.getElementById("recipe-home");
  const runDialog = document.getElementById("run-dialog");
  const runPanel = document.getElementById("run-panel");

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

  function validateRecipes(data) {
    if (!Array.isArray(data)) throw new Error("The recipe library must be a JSON array.");
    const recipeIds = new Set();
    data.forEach(function (recipe) {
      if (!recipe || typeof recipe.id !== "string" || !recipe.id || typeof recipe.name !== "string" || !recipe.name ||
          typeof recipe.area !== "string" || !recipe.area || !Array.isArray(recipe.steps) || recipe.steps.length === 0) {
        throw new Error("Every recipe needs an id, name, area, and at least one step.");
      }
      if (recipeIds.has(recipe.id)) throw new Error("Recipe ids must be unique.");
      recipeIds.add(recipe.id);
      const stepIds = new Set();
      const stepLabels = new Set();
      recipe.steps.forEach(function (step) {
        if (!step || typeof step.id !== "string" || !step.id || typeof step.title !== "string" || !step.title ||
            typeof step.instructions !== "string" || !step.instructions ||
            !["acknowledge", "action", "check"].includes(step.type)) {
          throw new Error("Every step needs a unique id, title, instructions, and a valid type.");
        }
        if (stepIds.has(step.id)) throw new Error("Step ids must be unique within a recipe.");
        stepIds.add(step.id);
        if (step.label !== undefined) {
          if (typeof step.label !== "string" || !step.label.trim() || stepLabels.has(step.label)) {
            throw new Error("Step labels must be non-empty and unique within a recipe.");
          }
          stepLabels.add(step.label);
        }
      });
      recipe.steps.forEach(function (step) {
        if (step.type !== "check") return;
        ["yesNext", "noNext"].forEach(function (routeName) {
          const route = step[routeName] || "next";
          if (!["next", "complete", "stop"].includes(route) && !stepIds.has(route)) {
            throw new Error("A check routes to a step that does not exist.");
          }
        });
      });
    });
    return data;
  }

  async function loadRecipes() {
    try {
      const response = await fetch(new URL("recipes.json", window.location.href), { cache: "no-cache" });
      if (!response.ok) throw new Error("Recipe request failed with status " + response.status + ".");
      recipes = validateRecipes(await response.json());
      renderRecipes();
    } catch (error) {
      console.error("Could not load the published training recipes.", error);
      document.getElementById("load-error").hidden = false;
      document.getElementById("stat-recipes").textContent = "—";
      document.getElementById("stat-areas").textContent = "—";
      document.getElementById("stat-ready").textContent = "—";
    }
  }

  function renderAreaNavigation() {
    const counts = {};
    recipes.forEach(function (recipe) { counts[recipe.area] = (counts[recipe.area] || 0) + 1; });
    const areas = Object.keys(counts).sort(function (a, b) { return a.localeCompare(b); });
    document.getElementById("recipe-count").textContent = String(recipes.length);
    areaNav.innerHTML = areas.map(function (area) {
      return '<button class="area-link' + (selectedArea === area ? " active" : "") + '" type="button" data-area="' + escapeHtml(area) + '">' +
        '<span class="area-dot"></span><span>' + escapeHtml(area) + '</span><span class="area-total">' + counts[area] + '</span></button>';
    }).join("");
    return areas.length;
  }

  function renderRecipes() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = recipes.filter(function (recipe) {
      const matchesArea = selectedArea === "all" || recipe.area === selectedArea;
      const matchesQuery = !query || (recipe.name + " " + (recipe.description || "") + " " + recipe.area).toLowerCase().includes(query);
      return matchesArea && matchesQuery;
    });
    document.getElementById("stat-recipes").textContent = String(recipes.length);
    document.getElementById("stat-areas").textContent = String(renderAreaNavigation());
    document.getElementById("stat-ready").textContent = String(recipes.filter(function (recipe) { return recipe.steps.length > 0; }).length);
    document.getElementById("library-title").textContent = selectedArea === "all" ? "Published recipes" : selectedArea + " recipes";
    document.getElementById("library-description").textContent = selectedArea === "all" ? "Choose a workflow to preview or practice." : "Recipes organized for " + selectedArea + ".";
    document.getElementById("page-title").textContent = selectedArea === "all" ? "Recipe library" : selectedArea;
    document.getElementById("page-subtitle").textContent = selectedArea === "all" ? "A safe place to learn each workflow, one step at a time." : "Practice the published training recipes for this area.";
    document.getElementById("empty-state").hidden = recipes.length > 0;
    document.getElementById("no-results").hidden = recipes.length === 0 || filtered.length > 0;
    recipeGrid.hidden = filtered.length === 0;
    recipeGrid.innerHTML = filtered.map(function (recipe) {
      return '<article class="recipe-card">' +
        '<div class="recipe-card-top"><span class="area-tag"><span></span>' + escapeHtml(recipe.area) + '</span></div>' +
        '<h3>' + escapeHtml(recipe.name) + '</h3><p class="recipe-description">' + escapeHtml(recipe.description || "No description yet.") + '</p>' +
        '<div class="recipe-card-bottom"><div class="recipe-meta"><span>☷ ' + recipe.steps.length + ' steps</span><span>◷ ' + escapeHtml(recipe.duration || "—") + '</span></div>' +
        '<div class="card-actions"><button class="small-button start" type="button" data-action="view-recipe" data-id="' + escapeHtml(recipe.id) + '">View flow <span aria-hidden="true">→</span></button></div></div></article>';
    }).join("");
  }

  function stepTypeLabel(type) {
    return { acknowledge: "Acknowledge / sign", action: "Instruction / action", check: "Yes / no check" }[type] || "Instruction / action";
  }

  function getStepLabels(recipe) {
    const counts = {};
    return recipe.steps.map(function (step) {
      if (step.label) return step.label;
      const prefix = step.type === "acknowledge" ? "Signiture" : (step.type === "check" ? "Check" : (/check in.*equipment/i.test(step.title) ? "CheckInEquipment" : "OperatorInstruction"));
      counts[prefix] = (counts[prefix] || 0) + 1;
      return prefix + counts[prefix];
    });
  }

  function startRun(recipe) {
    if (!recipe || !recipe.steps || recipe.steps.length === 0) {
      showToast("This recipe has no steps to practice.");
      return;
    }
    activeRun = { recipe: recipe, currentStepId: recipe.steps[0].id, answers: {}, signature: "", visited: [], skipped: [], result: null };
    renderRecipeHome();
  }

  function renderRecipeHome() {
    if (!activeRun) return;
    libraryHeading.hidden = true;
    libraryStats.hidden = true;
    librarySection.hidden = true;
    recipeHome.hidden = false;

    const recipe = activeRun.recipe;
    document.getElementById("breadcrumb-current").textContent = recipe.name;
    const visited = new Set(activeRun.visited);
    const skipped = new Set(activeRun.skipped);
    document.getElementById("detail-area").innerHTML = "<span></span>" + escapeHtml(recipe.area);
    document.getElementById("detail-title").textContent = recipe.name;
    document.getElementById("detail-description").textContent = recipe.description || "Practice this recipe in a simulated environment.";
    document.getElementById("detail-duration").textContent = "◷ " + (recipe.duration || "—");

    const progress = activeRun.visited.length;
    document.getElementById("flow-progress").textContent = progress + " of " + recipe.steps.length + " steps completed";
    const status = document.getElementById("flow-status");
    const isComplete = activeRun.result === "complete";
    const isStopped = activeRun.result === "stopped";
    status.textContent = isComplete ? "Complete" : (isStopped ? "Stopped" : "In progress");
    status.className = "flow-status" + (isComplete ? " complete" : (isStopped ? " stopped" : ""));
    document.getElementById("flow-complete").hidden = !isComplete;
    document.getElementById("flow-stopped").hidden = !isStopped;
    const labels = getStepLabels(recipe);
    document.getElementById("recipe-flowchart").innerHTML = recipe.steps.map(function (step, index) {
      const completed = visited.has(step.id);
      const wasSkipped = skipped.has(step.id);
      const isCurrent = !activeRun.result && step.id === activeRun.currentStepId;
      const stepState = completed ? "completed" : (wasSkipped ? "skipped" : (isCurrent ? "current" : "locked"));
      const statusText = completed ? "Completed" : (wasSkipped ? "Skipped by route" : (isCurrent ? "Ready — select to begin" : (isStopped ? "Not reached" : "Locked")));
      const icon = completed ? "✓" : (wasSkipped ? "↪" : String(index + 1));
      return '<li class="flow-step ' + stepState + (step.type === "check" ? " decision" : "") + '">' +
        '<button class="flow-step-button" type="button" data-action="open-step" data-id="' + escapeHtml(step.id) + '" ' + (isCurrent ? "" : "disabled") + ' aria-current="' + (isCurrent ? "step" : "false") + '">' +
        '<span class="flow-step-icon" aria-hidden="true">' + icon + '</span><span class="flow-step-content">' +
        '<strong class="flow-step-code">' + escapeHtml(labels[index]) + '</strong><span class="flow-step-status">' + escapeHtml(statusText) + '</span>' +
        '</span><span class="flow-step-action" aria-hidden="true">' + (isCurrent ? "Open prompt →" : (completed ? "✓" : (wasSkipped ? "Skipped" : "Locked"))) + '</span></button></li>';
    }).join("");
    document.getElementById("main-content").focus();
  }

  function openRunStep(stepId) {
    if (!activeRun || activeRun.result || activeRun.currentStepId !== stepId) return;
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
      return '<button class="button button-primary" type="button" data-action="continue" ' + (selected ? "" : "disabled") + '>Complete prompt &amp; return to flow <span aria-hidden="true">→</span></button>';
    }
    if (step.type === "acknowledge") {
      return '<button class="button button-primary" type="button" data-action="continue" ' + (activeRun.signature ? "" : "disabled") + '>Sign &amp; complete step <span aria-hidden="true">✓</span></button>';
    }
    return '<button class="button button-primary" type="button" data-action="continue">Complete step &amp; return to flow <span aria-hidden="true">→</span></button>';
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
      const route = activeRun.answers[step.id] === "Yes" ? (step.yesNext || "next") : (step.noNext || "next");
      if (route === "complete") {
        activeRun.result = "complete";
        const index = activeRun.recipe.steps.findIndex(function (candidate) { return candidate.id === step.id; });
        activeRun.skipped = activeRun.skipped.concat(activeRun.recipe.steps.slice(index + 1).map(function (candidate) { return candidate.id; }));
        runDialog.close();
        renderRecipeHome();
        return;
      }
      if (route === "stop") {
        activeRun.result = "stopped";
        renderRun();
        return;
      }
      if (route !== "next") {
        const targetIndex = activeRun.recipe.steps.findIndex(function (candidate) { return candidate.id === route; });
        if (targetIndex < 0) {
          showToast("This check routes to a step that no longer exists. Please contact the site owner.");
          return;
        }
        const index = activeRun.recipe.steps.findIndex(function (candidate) { return candidate.id === step.id; });
        if (targetIndex > index) {
          const visited = new Set(activeRun.visited);
          const skipped = new Set(activeRun.skipped);
          activeRun.recipe.steps.slice(index + 1, targetIndex).forEach(function (candidate) {
            if (!visited.has(candidate.id)) skipped.add(candidate.id);
          });
          activeRun.skipped = Array.from(skipped);
        }
        activeRun.currentStepId = route;
        runDialog.close();
        renderRecipeHome();
        return;
      }
    }
    const index = activeRun.recipe.steps.findIndex(function (candidate) { return candidate.id === step.id; });
    if (index >= activeRun.recipe.steps.length - 1) activeRun.result = "complete";
    else activeRun.currentStepId = activeRun.recipe.steps[index + 1].id;
    runDialog.close();
    renderRecipeHome();
  }

  function renderRunResult(result) {
    const answered = Object.keys(activeRun.answers).length;
    runPanel.innerHTML = '<header class="run-header"><div class="run-brand"><span class="run-brand-mark">T</span> Technician Training</div><div class="run-header-actions"><span class="run-badge">SIMULATION</span><button class="icon-button" type="button" data-action="close-run" aria-label="Exit practice">×</button></div></header>' +
      '<section class="run-result"><span class="result-icon stopped">Ⅱ</span><h2>Practice stopped</h2>' +
      '<p>This practice ended at the configured stop point. Follow your approved site escalation process for real events.</p>' +
      '<div class="result-summary"><strong>' + escapeHtml(activeRun.recipe.name) + '</strong><br>' + activeRun.visited.length + " of " + activeRun.recipe.steps.length + " steps visited · " + answered + ' check' + (answered === 1 ? "" : "s") + ' answered<br>' + (activeRun.signature ? "Acknowledged by " + escapeHtml(activeRun.signature) + " (simulation only)" : "No live signature recorded") + '</div>' +
      '<div class="card-actions"><button class="button button-secondary" type="button" data-action="close-run">Back to flowchart</button><button class="button button-primary" type="button" data-action="restart-run">Restart practice</button></div></section>';
  }

  document.addEventListener("click", function (event) {
    const target = event.target.closest("[data-action], [data-area]");
    if (!target) return;
    if (target.dataset.area) {
      activeRun = null;
      recipeHome.hidden = true;
      libraryHeading.hidden = false;
      libraryStats.hidden = false;
      librarySection.hidden = false;
      document.getElementById("breadcrumb-current").textContent = "Recipe library";
      selectedArea = target.dataset.area;
      searchInput.value = "";
      renderRecipes();
      document.getElementById("main-content").focus();
      return;
    }
    switch (target.dataset.action) {
      case "home":
      case "back-library":
        activeRun = null;
        recipeHome.hidden = true;
        libraryHeading.hidden = false;
        libraryStats.hidden = false;
        librarySection.hidden = false;
        document.getElementById("breadcrumb-current").textContent = "Recipe library";
        selectedArea = "all";
        searchInput.value = "";
        renderRecipes();
        break;
      case "view-recipe":
        startRun(recipes.find(function (item) { return item.id === target.dataset.id; }));
        break;
      case "open-step":
        openRunStep(target.dataset.id);
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
        renderRecipeHome();
        break;
      case "restart-run":
        if (activeRun) startRun(activeRun.recipe);
        break;
    }
  });

  searchInput.addEventListener("input", renderRecipes);
  runDialog.addEventListener("click", function (event) {
    if (event.target === runDialog) {
      runDialog.close();
      renderRecipeHome();
    }
  });

  loadRecipes();
}());
