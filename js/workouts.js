(() => {
  "use strict";

  const goals = {
    "Build Muscle": "build",
    "Improve Strength": "strength",
    "Improve Overall Fitness": "fitness",
    "Stay Active and Healthy": "active",
  };
  const exerciseFields = { name: "n", sets: "s", reps: "r", duration: "d", rest: "t" };
  const sessionPlans = {
    "session.html": "full-body",
    "session-active-start.html": "active-start",
    "session-upper-lower.html": "upper-lower",
    "session-ppl.html": "ppl",
  };
  const letters = ["a", "b", "c"];
  const notify = (message, type) => window.MuscleHubSnackbar.show(message, type);

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, className, action) {
    const node = element("button", className, text);
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  }

  function readPlans(key) {
    return JSON.parse(localStorage.getItem(key) || "{}");
  }

  function renderExerciseTable(exercises) {
    const table = element("table", "tbl");
    const header = table.createTHead().insertRow();
    for (const label of ["Exercise", "Sets × reps", "Rest"]) {
      const cell = element("th", "", label);
      cell.scope = "col";
      header.append(cell);
    }
    const body = table.createTBody();
    for (const exercise of exercises) {
      const row = body.insertRow();
      const name = row.insertCell();
      if (exercise.libraryId) {
        const link = element("a", "exercise-library-link", exercise.name);
        link.href = "exercise-library.html#" + encodeURIComponent(exercise.libraryId);
        name.append(link);
      } else {
        name.textContent = exercise.name;
      }
      const target = [exercise.reps, exercise.duration].filter(Boolean).join(" / ");
      row.insertCell().textContent = target ? exercise.sets + " × " + target : exercise.sets + " sets";
      const rest = /^\d+(?:\.\d+)?$/.test(exercise.rest) ? exercise.rest + " sec" : exercise.rest;
      row.insertCell().textContent = rest || "—";
    }
    return table;
  }

  function sessionUrl(id, day) {
    return "session.html?" + new URLSearchParams({ plan: id, day: String(day) });
  }

  async function loadExerciseLibrary() {
    const response = await fetch("exercise-library.html");
    if (!response.ok) throw new Error("Exercise Library request failed.");
    const library = new DOMParser().parseFromString(await response.text(), "text/html");
    const exercises = Array.from(library.querySelectorAll('.c-name .xlink[href^="#"]'), (link) => ({
      id: link.getAttribute("href").slice(1),
      name: link.textContent.trim(),
    }));
    if (!exercises.length) throw new Error("Exercise Library is empty.");
    return exercises.sort((first, second) => first.name.localeCompare(second.name));
  }

  function initPlans(storageKey) {
    const plans = document.querySelector("#plans");
    const grid = plans.querySelector(".plans-grid");
    const myGrid = document.querySelector("#my-plans-grid");
    const emptyWorkouts = document.querySelector("#workouts-empty");
    const tablist = document.querySelector(".workout-tabs");
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    let activePanel;

    function selectTab(panel, focus = false) {
      activePanel = panel;
      for (const tab of tabs) {
        const id = tab.getAttribute("aria-controls");
        const selected = id === panel;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        document.getElementById(id).hidden = !selected;
        if (selected && focus) tab.focus();
      }
    }

    function tabFromHash() {
      if (location.hash === "#recommended-workouts" || location.hash === "#plans") return "recommended-workouts";
      if (location.hash === "#my-workouts" || !activePanel) return "my-workouts";
      return activePanel;
    }

    function activateTab(panel) {
      history.replaceState(null, "", "#" + panel);
      selectTab(panel, true);
    }

    tablist.addEventListener("click", (event) => {
      const tab = event.target.closest('[role="tab"]');
      if (tab) activateTab(tab.getAttribute("aria-controls"));
    });
    tablist.addEventListener("keydown", (event) => {
      const index = tabs.indexOf(event.target);
      if (index < 0) return;
      const target = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      activateTab(tabs[target].getAttribute("aria-controls"));
    });
    document.querySelector("#browse-recommended").addEventListener("click", (event) => {
      event.preventDefault();
      activateTab("recommended-workouts");
    });
    const filter = document.querySelector("#fitness-goals");
    const filterMenus = Array.from(filter.querySelectorAll("details"));
    const modal = document.querySelector("#add-plan");
    const editor = modal.querySelector(".form");
    const save = editor.querySelector("#save-custom-plan");
    const list = editor.querySelector(".xlist");
    const rowTemplate = list.querySelector(".xrow").cloneNode(true);
    const field = (suffix) => editor.querySelector("#add-" + suffix);
    const choices = (container, prefix) => Array.from(
      container.querySelectorAll(`input[id^="${prefix}"]:checked`),
      (input) => input.id.slice(prefix.length),
    );
    const readExercise = (row) => {
      const exercise = Object.fromEntries(Object.entries(exerciseFields).map(([name, suffix]) => [
        name,
        row.querySelector(`[id$="-${suffix}"]`).value.trim(),
      ]));
      const libraryId = row.querySelector("select")?.selectedOptions[0]?.dataset.libraryId;
      if (libraryId) exercise.libraryId = libraryId;
      return exercise;
    };
    const defaults = {
      title: "", goal: field("goal").value, level: field("level").value,
      location: "home", frequency: field("freq").value, muscles: [], days: [],
      workouts: [{ name: "", exercises: [] }],
    };
    const builtIns = new Map();
    for (const card of grid.querySelectorAll(".plan-card")) {
      const id = card.querySelector(".st-none").id.slice(0, -5);
      const edit = card.querySelector(".m-edit");
      const prefix = "e-" + id + "-";
      const value = (suffix) => edit.querySelector("#" + prefix + suffix).value;
      const workouts = [];
      for (const child of edit.querySelector(".xlist").children) {
        if (child.classList.contains("xgroup")) workouts.push({ name: child.textContent.trim(), exercises: [] });
        if (child.classList.contains("xrow")) workouts.at(-1).exercises.push(readExercise(child));
      }
      builtIns.set(id, {
        card, title: value("name"), goal: value("goal"), level: value("level"),
        location: choices(edit, prefix + "loc-")[0], frequency: value("freq"),
        muscles: choices(edit, prefix + "m-"), days: choices(edit, prefix + "d-"), workouts,
      });
    }

    let editingId;
    let rowIndex = 0;
    let opener;
    const groups = [];
    let catalog = [];
    let catalogRequest;
    let editorRequest = 0;

    function exercisePicker(exercise) {
      const picker = element("select", "exercise-picker");
      picker.add(new Option(catalog.length ? "Choose an exercise" : "Library unavailable", ""));
      for (const entry of catalog) {
        const option = new Option(entry.name, entry.name);
        option.dataset.libraryId = entry.id;
        picker.add(option);
      }
      const selected = catalog.find(({ id }) => id === exercise.libraryId)
        || catalog.find(({ name }) => name.toLowerCase() === exercise.name?.toLowerCase());
      if (selected) picker.value = selected.name;
      else if (exercise.name) {
        picker.add(new Option(exercise.name + " (saved exercise)", exercise.name));
        picker.value = exercise.name;
      }
      return picker;
    }

    function addRow(group, exercise = {}) {
      const row = rowTemplate.cloneNode(true);
      const index = ++rowIndex;
      row.querySelector(".rm").remove();
      row.querySelector(".xdel").replaceWith(button("×", "xdel", () => row.remove()));
      row.querySelector(".xdel").setAttribute("aria-label", "Remove exercise");
      for (const [name, suffix] of Object.entries(exerciseFields)) {
        const input = row.querySelector(`input[id$="-${suffix}"]`);
        row.querySelector(`label[for="${input.id}"]`).htmlFor = `workout-row-${index}-${suffix}`;
        input.id = `workout-row-${index}-${suffix}`;
        if (name === "name") {
          const picker = exercisePicker(exercise);
          picker.id = input.id;
          input.replaceWith(picker);
        } else {
          input.value = exercise[name] || "";
        }
      }
      group.rows.append(row);
      return row;
    }

    async function openEditor(id, plan, trigger) {
      const request = ++editorRequest;
      catalogRequest ||= loadExerciseLibrary().catch(() => {
        catalogRequest = null;
        return [];
      });
      catalog = await catalogRequest;
      if (request !== editorRequest) return;
      editingId = id;
      opener = trigger;
      modal.querySelector("h2").textContent = id ? "Edit Workout Plan" : "Add Workout Plan";
      for (const [suffix, value] of Object.entries({
        name: plan.title, goal: plan.goal, level: plan.level, freq: plan.frequency,
      })) field(suffix).value = value;
      field("loc-" + plan.location).checked = true;
      for (const [prefix, selected] of [["m-", plan.muscles], ["d-", plan.days]]) {
        for (const input of editor.querySelectorAll(`input[id^="add-${prefix}"]`)) {
          input.checked = selected.includes(input.id.slice(("add-" + prefix).length));
        }
      }
      list.replaceChildren();
      groups.length = 0;
      for (const workout of plan.workouts) {
        const rows = element("div", "workout-exercise-rows");
        const group = { name: workout.name, rows };
        groups.push(group);
        if (workout.name) list.append(element("p", "xgroup", workout.name));
        list.append(rows, button("+ Add Exercise", "btn sec sm", () => addRow(group).querySelector("select").focus()));
        for (const exercise of workout.exercises.length ? workout.exercises : [{}]) addRow(group, exercise);
      }
      for (const link of modal.querySelectorAll('a[href^="#"]')) {
        link.href = "#" + activePanel;
      }
      location.hash = "add-plan";
      requestAnimationFrame(() => field("name").focus({ preventScroll: true }));
      if (!catalog.length) notify("Exercise Library could not be loaded. Reopen the editor to try again.", "warning");
    }

    function validatePlan() {
      const title = field("name").value.trim();
      if (!title) {
        field("name").focus();
        throw new Error("Enter a workout name.");
      }
      const workouts = groups.map(({ name, rows }) => {
        const exercises = [];
        for (const row of rows.children) {
          const exercise = readExercise(row);
          if (!Object.values(exercise).some(Boolean)) continue;
          if (!exercise.name) {
            row.querySelector("select").focus();
            throw new Error("Choose an exercise from the Exercise Library.");
          }
          if (!/^\d+$/.test(exercise.sets) || Number(exercise.sets) < 1 || Number(exercise.sets) > 50) {
            row.querySelector('input[id$="-s"]').focus();
            throw new Error("Enter 1–50 sets for " + exercise.name + ".");
          }
          exercises.push(exercise);
        }
        if (!exercises.length) throw new Error("Add at least one exercise" + (name ? " to " + name : "") + ".");
        return { name, exercises };
      });
      return {
        title, workouts, goal: field("goal").value, level: field("level").value,
        frequency: field("freq").value, location: choices(editor, "add-loc-")[0],
        muscles: choices(editor, "add-m-"), days: choices(editor, "add-d-"),
      };
    }

    function persist(id, plan) {
      const saved = readPlans(storageKey);
      if (plan || builtIns.has(id)) saved[id] = plan;
      else delete saved[id];
      localStorage.setItem(storageKey, JSON.stringify(saved));
      return saved;
    }

    const confirmation = element("dialog", "workout-delete-dialog card");
    const confirmTitle = element("h2", "", "Delete workout plan?");
    confirmTitle.id = "workout-delete-title";
    confirmation.setAttribute("aria-labelledby", confirmTitle.id);
    const confirmMessage = element("p", "muted");
    const confirmActions = element("div", "actions");
    let deletingId;
    confirmActions.append(
      button("Cancel", "btn sec", () => confirmation.close()),
      button("Delete", "btn danger", () => {
        try {
          const saved = persist(deletingId, null);
          confirmation.close();
          render(saved);
          document.querySelector('a[href="#add-plan"]').focus();
          notify("Workout plan deleted.");
        } catch {
          confirmation.close();
          notify("The workout plan could not be deleted.", "error");
        }
      }),
    );
    confirmation.append(confirmTitle, confirmMessage, confirmActions);
    modal.after(confirmation);

    let deleteTrigger;
    confirmation.addEventListener("close", () => {
      if (deleteTrigger?.isConnected) deleteTrigger.focus();
      deleteTrigger = undefined;
    });

    function askDelete(id, plan, trigger) {
      deletingId = id;
      deleteTrigger = trigger;
      confirmMessage.textContent = `Delete “${plan.title}”? This cannot be undone.`;
      confirmation.showModal();
    }

    function renderCard(id, plan, stock) {
      if (stock) return plan.card;
      const card = element("article", `card plan-card lv-${plan.level.toLowerCase()} g-${goals[plan.goal]} w-${plan.location}`);
      const header = element("div", "card-h");
      const menu = element("details", "kebab");
      const trigger = element("summary", "dots", "⋮");
      trigger.setAttribute("aria-label", "Options for " + plan.title);
      const popup = element("div", "menu-pop");
      const items = element("ul");
      for (const [label, className, action] of [
        ["Edit", "", () => openEditor(id, plan, trigger)],
        ["Delete", "danger", () => askDelete(id, plan, trigger)],
      ]) {
        const item = element("li");
        item.append(button(label, className, () => {
          menu.open = false;
          trigger.focus({ preventScroll: true });
          action();
        }));
        items.append(item);
      }
      popup.append(items);
      menu.append(trigger, popup);
      menu.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !menu.open) return;
        event.preventDefault();
        menu.open = false;
        trigger.focus();
      });
      menu.addEventListener("focusout", (event) => {
        if (!menu.contains(event.relatedTarget)) menu.open = false;
      });
      header.append(element("h3", "", plan.title), menu);
      const tags = element("div", "ptags");
      tags.append(
        element("span", `tag level lvl-${plan.level.toLowerCase()}`, plan.level),
        element("span", "tag soft freq", plan.frequency),
      );
      if (plan.muscles.length) tags.append(element("span", "tag neutral muscles", plan.muscles.map(
        (muscle) => muscle[0].toUpperCase() + muscle.slice(1),
      ).join(", ")));
      header.append(tags);
      card.append(header);
      const tabs = element("div", "chips tabs");
      const exercisePanel = element("div", "rt rt-saved");
      const footer = element("div", "pc-foot");
      const start = element("a", "btn sm", "Start Workout");
      const tabButtons = [];
      const select = (index) => {
        exercisePanel.replaceChildren(renderExerciseTable(plan.workouts[index].exercises));
        start.href = sessionUrl(id, index);
        tabButtons.forEach((tab, tabIndex) => {
          const selected = tabIndex === index;
          tab.setAttribute("aria-pressed", String(selected));
          tab.classList.toggle("active", selected);
        });
      };
      if (plan.workouts.length > 1) {
        plan.workouts.forEach((workout, index) => {
          const tab = button(workout.name || plan.title, "chip", () => select(index));
          tabButtons.push(tab);
          tabs.append(tab);
        });
        card.append(tabs);
      }
      select(0);
      footer.append(start);
      card.append(exercisePanel, footer);
      return card;
    }

    function updateFilters() {
      const selected = filterMenus.map((menu) => {
        const choice = menu.querySelector("input:checked");
        menu.querySelector(".dd-v").textContent = choice.labels[0].textContent;
        return choice.id.split("-").at(-1);
      });
      let count = 0;
      for (const card of grid.children) {
        const matches = ["g-", "lv-", "w-"].every((prefix, index) => selected[index] === "any" || card.classList.contains(prefix + selected[index]));
        if (matches) count++;
      }
      const empty = plans.querySelector(".nomatch");
      plans.classList.add("has-workout-crud");
      plans.querySelector(".plan-count").textContent = `Showing ${count} of ${grid.children.length} plans`;
      empty.style.display = count ? "none" : "block";
      empty.textContent = grid.children.length
        ? "No plan matches these choices yet. Try a different goal, level, or location."
        : "No recommended workouts are available.";
    }

    function render(saved) {
      grid.replaceChildren();
      myGrid.replaceChildren();
      for (const [id, plan] of builtIns) {
        if (!Object.hasOwn(saved, id)) grid.append(renderCard(id, plan, true));
        else if (saved[id]) grid.append(renderCard(id, saved[id], false));
      }
      for (const [id, plan] of Object.entries(saved)) {
        if (plan && !builtIns.has(id)) myGrid.append(renderCard(id, plan, false));
      }
      emptyWorkouts.hidden = myGrid.childElementCount > 0;
      updateFilters();
    }

    grid.addEventListener("click", (event) => {
      const label = event.target.closest(".menu-pop label[for]");
      if (!label) return;
      const card = label.closest(".plan-card");
      const id = card.querySelector(".st-none").id.slice(0, -5);
      if (label.htmlFor !== id + "-edit" && label.htmlFor !== id + "-ask") return;
      event.preventDefault();
      card.querySelector(".st-none").checked = true;
      const plan = builtIns.get(id);
      if (label.htmlFor === id + "-edit") openEditor(id, plan, card.querySelector("h3"));
      else askDelete(id, plan);
    });

    for (const trigger of document.querySelectorAll('a[href="#add-plan"]')) {
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        openEditor(null, defaults, trigger);
      });
    }
    window.addEventListener("hashchange", () => {
      selectTab(tabFromHash());
      if (location.hash !== "#add-plan" && opener) {
        opener.focus({ preventScroll: true });
        opener = null;
      }
    });
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") location.hash = activePanel;
      if (event.key === "Enter" && event.target.matches('input[type="text"]')) {
        event.preventDefault();
        save.click();
      }
    });
    save.addEventListener("click", () => {
      let plan;
      try {
        plan = validatePlan();
      } catch (error) {
        notify(error.message, "warning");
        return;
      }
      try {
        const id = editingId || "custom-" + crypto.randomUUID();
        const saved = persist(id, plan);
        const recommended = builtIns.has(id);
        const panel = recommended ? "recommended-workouts" : "my-workouts";
        selectTab(panel);
        location.hash = panel;
        render(saved);
        const savedCard = Array.from((recommended ? grid : myGrid).children).find((card) => card.querySelector(".pc-foot a")?.href.endsWith(sessionUrl(id, 0)));
        (savedCard?.querySelector(".card-h .dots") || document.querySelector('a[href="#add-plan"]')).focus();
        opener = null;
        notify(editingId ? "Workout plan updated." : "Workout plan added.");
      } catch {
        notify("The workout plan could not be saved.", "error");
      }
    });
    for (const menu of filterMenus) {
      menu.addEventListener("toggle", () => {
        if (!menu.open) return;
        for (const other of filterMenus) {
          if (other !== menu) other.open = false;
        }
      });
      menu.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !menu.open) return;
        event.preventDefault();
        menu.open = false;
        menu.querySelector("summary").focus();
      });
    }
    document.addEventListener("click", (event) => {
      for (const menu of document.querySelectorAll("details.kebab[open]")) {
        if (!menu.contains(event.target)) menu.open = false;
      }
      for (const menu of filterMenus) {
        if (!menu.contains(event.target)) menu.open = false;
      }
    });
    filter.addEventListener("change", updateFilters);
    filter.addEventListener("click", (event) => {
      const label = event.target.closest(".dd-panel label");
      if (!label) return;
      const menu = label.closest("details");
      setTimeout(() => {
        menu.open = false;
        menu.querySelector("summary").focus();
      }, 0);
    });
    filter.addEventListener("reset", () => setTimeout(updateFilters, 0));
    selectTab(tabFromHash());
    render(readPlans(storageKey));
    if (location.hash === "#add-plan") openEditor(null, defaults, document.querySelector('a[href="#add-plan"]'));
  }

  function initSession(storageKey, filename) {
    const query = new URLSearchParams(location.search);
    const id = query.get("plan") || sessionPlans[filename];
    const plans = readPlans(storageKey);
    if (!query.has("plan") && !Object.hasOwn(plans, id)) return;
    const plan = plans[id];
    const stack = document.querySelector(".session-stack");
    const header = document.querySelector(".page-head p");
    const back = element("a", "btn sec sm", "Back to Workout Plans");
    back.href = "workout-plans.html#" + (id.startsWith("custom-") ? "my-workouts" : "recommended-workouts");
    stack.replaceChildren();
    document.querySelector(".timer")?.remove();
    if (!plan) {
      header.textContent = "This workout plan is no longer available.";
      stack.append(back);
      return;
    }
    const hashDay = letters.indexOf(location.hash.slice(1, 2));
    const index = Number(query.get("day") ?? Math.max(0, hashDay));
    const workout = plan.workouts[index] || plan.workouts[0];
    header.textContent = [plan.title, workout.name, "Tick each set as you finish it."].filter(Boolean).join(" · ");
    if (plan.workouts.length > 1) {
      const tabs = element("div", "chips");
      plan.workouts.forEach(({ name }, day) => {
        const link = element("a", "btn sec sm", name || plan.title);
        link.href = sessionUrl(id, day);
        if (plan.workouts[day] === workout) link.setAttribute("aria-current", "page");
        tabs.append(link);
      });
      stack.append(tabs);
    }
    for (const exercise of workout.exercises) {
      const card = element("section", "card");
      const details = [exercise.sets + " sets", exercise.rest && "rest " + exercise.rest].filter(Boolean);
      const sets = element("div", "sets");
      for (let index = 1; index <= Number(exercise.sets); index++) {
        const label = element("label");
        const input = element("input");
        input.type = "checkbox";
        const summary = ["Set " + index, exercise.reps && exercise.reps + " reps", exercise.duration].filter(Boolean);
        label.append(input, element("span", "", summary.join(" · ")));
        sets.append(label);
      }
      card.append(element("h3", "", exercise.name), element("p", "muted", details.join(" · ")), sets);
      stack.append(card);
    }
    const controls = element("div", "session-bar card");
    const status = element("div", "sb-item");
    const counter = element("b");
    const total = stack.querySelectorAll('input[type="checkbox"]').length;
    const completed = () => stack.querySelectorAll('input[type="checkbox"]:checked').length;
    const update = () => { counter.textContent = completed() + " / " + total; };
    status.append(element("small", "", "Sets done"), counter);
    const actions = element("div", "sb-actions");
    actions.append(back, button("Finish Workout", "btn sm", () => {
      header.textContent = `Workout complete! ${completed()} of ${total} sets done.`;
      stack.replaceChildren(back);
      notify("Workout complete.");
    }));
    controls.append(status, actions);
    stack.append(controls);
    stack.addEventListener("change", update);
    update();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const user = window.MuscleHubAuth.getCurrentUser();
    if (!user) return;
    const key = "muscleHub.workoutPlans." + user.email;
    try {
      if (document.body.dataset.page === "plans") {
        const oldGoalLink = /^#(?:goals|goal-form|goal-templates|goal-tpl-[1-4])$/.test(location.hash);
        if (oldGoalLink) location.replace("goals.html" + location.hash);
        else initPlans(key);
      }
      else initSession(key, location.pathname.split("/").pop());
    } catch (error) {
      console.error(error);
      notify("Saved workout plans could not be loaded.", "error");
    }
  });
})();
