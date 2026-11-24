(() => {
  "use strict";

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, className, click) {
    const node = element("button", className, text);
    node.type = "button";
    node.addEventListener("click", click);
    return node;
  }

  function goalItem(goal) {
    const item = element("li");
    const top = element("div", "g-top");
    const percent = Math.min(100, Math.floor((goal.current / goal.amount) * 100));
    top.append(
      element("strong", "", goal.title),
      element("span", "tag soft", percent === 100 ? "Reached" : "Active"),
    );
    const due = goal.date
      ? " · Due " + new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(goal.date + "T12:00:00"))
      : "";
    const bar = element("div", "pbar");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", goal.title);
    bar.setAttribute("aria-valuenow", percent);
    const fill = element("i");
    fill.style.width = percent + "%";
    bar.append(fill);
    const progress = element("p", "g-val");
    progress.append(
      element("span", "", goal.current + " of " + goal.target),
      element("span", "", percent + "%"),
    );
    item.append(top, element("p", "muted", goal.type + due), bar, progress);
    return item;
  }

  function showProgress(goals) {
    if (!goals.length) return;
    const section = document.querySelector("#prog-goals");
    section.querySelector(".card-h p").textContent = "Progress you’ve recorded on your personal goals.";
    section.querySelector(".goals").replaceChildren(...goals.map(goalItem));
  }

  function manageGoals(read, write) {
    const list = document.querySelector("#user-goals");
    const modal = document.querySelector("#goal-form");
    const editForm = modal.querySelector("form");
    const editorTitle = modal.querySelector("h2");
    const titleField = editForm.querySelector("#g-title");
    let editingId;
    let deletingId;

    const confirm = element("dialog", "workout-delete-dialog card");
    const confirmTitle = element("h2", "", "Delete fitness goal?");
    confirmTitle.id = "delete-goal-title";
    confirm.setAttribute("aria-labelledby", confirmTitle.id);
    const confirmText = element("p", "muted");
    const confirmActions = element("div", "actions");
    confirmActions.append(
      button("Cancel", "btn sec", () => confirm.close()),
      button("Delete", "btn danger", () => {
        try {
          const remaining = read().filter(({ id }) => id !== deletingId);
          write(remaining);
          confirm.close();
          render(remaining);
          document.querySelector(".page-head a").focus();
          MuscleHubSnackbar.show("Fitness goal deleted.");
        } catch {
          confirm.close();
          MuscleHubSnackbar.show("The fitness goal could not be deleted.", "error");
        }
      }),
    );
    confirm.append(confirmTitle, confirmText, confirmActions);
    document.querySelector("main").append(confirm);

    function render(goals) {
      list.replaceChildren(...goals.map((goal) => {
        const item = goalItem(goal);
        item.className = "card gcard";
        const actions = element("div", "actions");
        const edit = element("a", "btn sec sm", "Edit Goal");
        edit.href = "#goal-form";
        edit.addEventListener("click", () => {
          editingId = goal.id;
          editorTitle.textContent = "Edit Goal";
          for (const field of editForm.elements) {
            if (Object.hasOwn(goal, field.name)) field.value = goal[field.name];
          }
        });
        actions.append(edit, button("Delete", "btn ghost danger sm", () => {
          deletingId = goal.id;
          confirmText.textContent = `Delete “${goal.title}”?`;
          confirm.showModal();
        }));
        item.append(actions);
        return item;
      }));
    }

    for (const link of document.querySelectorAll('a[href="#goal-form"]')) {
      link.addEventListener("click", () => {
        editingId = undefined;
        editForm.reset();
        editorTitle.textContent = "Add Goal";
      });
    }
    function focusEditor() {
      if (location.hash === "#goal-form") titleField.focus({ preventScroll: true });
    }
    window.addEventListener("hashchange", focusEditor);

    for (const form of document.querySelectorAll(".modal form")) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const title = data.get("title").trim();
        const target = data.get("target").trim();
        const amount = Number(target.match(/^\d+(?:\.\d+)?(?=\s|$)/)?.[0]);
        if (!title || !Number.isFinite(amount) || amount <= 0) {
          const field = form.elements.namedItem(title ? "target" : "title");
          field.focus();
          MuscleHubSnackbar.show(title ? "Start the target with a positive number, such as 10 reps." : "Enter a goal name.", "warning");
          return;
        }
        const id = form === editForm ? editingId : undefined;
        try {
          const goals = read();
          const goal = {
            id: id || crypto.randomUUID(),
            title,
            target,
            amount,
            type: data.get("type"),
            date: data.get("date"),
            current: Number(data.get("current") || 0),
          };
          const next = id ? goals.map((entry) => entry.id === id ? goal : entry) : [...goals, goal];
          write(next);
          render(next);
          editingId = undefined;
          editForm.reset();
          editorTitle.textContent = "Add Goal";
          location.hash = "goals";
          MuscleHubSnackbar.show(id ? "Fitness goal updated." : "Fitness goal added.");
        } catch {
          MuscleHubSnackbar.show("The fitness goal could not be saved.", "error");
        }
      });
    }
    render(read());
    focusEditor();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const user = MuscleHubAuth.getCurrentUser();
    if (!user) return;
    const key = "muscleHub.goals." + user.email;
    const read = () => JSON.parse(localStorage.getItem(key) || "[]");
    const write = (goals) => localStorage.setItem(key, JSON.stringify(goals));
    try {
      if (document.body.dataset.page === "goals") manageGoals(read, write);
      else showProgress(read());
    } catch {
      MuscleHubSnackbar.show("Saved fitness goals could not be loaded.", "error");
    }
  });
})();
