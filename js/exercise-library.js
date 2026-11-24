(() => {
  "use strict";

  const equipmentTypes = {
    Bodyweight: "bodyweight",
    Dumbbells: "dumbbells",
    Barbell: "barbell",
    Bench: "bench",
    "Cable machine": "cable",
    Kettlebell: "kettlebell",
    "Resistance bands": "bands",
    "Pull-up bar": "pullup",
  };

  document.addEventListener("DOMContentLoaded", () => {
    const user = MuscleHubAuth.getCurrentUser();
    if (!user) return;
    const form = document.querySelector("#lib-form");
    const rows = Array.from(form.querySelectorAll("tbody tr"));
    const pager = form.querySelector(".pager");
    const range = form.querySelector(".range");
    const empty = form.querySelector("#lib-empty");
    const menus = Array.from(form.querySelectorAll("details.dd"));
    const savedEquipment = user.profile?.equipment;
    const equipment = new Set((Array.isArray(savedEquipment) ? savedEquipment : ["Bodyweight", "Dumbbells"])
      .map((name) => equipmentTypes[name]));
    const entries = rows.map((row) => {
      const setups = row.dataset.equipment.split(",").map((setup) => setup.split("+"));
      const favorite = row.querySelector(".fav-cb");
      const modal = document.getElementById(row.querySelector(".xlink").hash.slice(1));
      function updateFavorite() {
        modal.classList.toggle("exercise-favorited", favorite.checked);
      }
      updateFavorite();
      favorite.addEventListener("change", () => {
        updateFavorite();
        if (form.querySelector("#fav-only").checked) render();
      });
      return { row, setups, favorite };
    });
    let currentPage = 1;

    function render() {
      for (const menu of menus) {
        const choice = menu.querySelector("input:checked");
        menu.querySelector(".dd-v").textContent = choice.value === "all" ? "All" : choice.labels[0].textContent;
      }
      const fields = new FormData(form);
      const muscle = fields.get("m");
      const level = fields.get("lv");
      const gear = fields.get("eq");
      const mine = fields.has("mine");
      const favorites = fields.has("fav");
      const matches = entries.filter(({ row, setups, favorite }) =>
        (muscle === "all" || row.classList.contains("m-" + muscle)) &&
        (level === "all" || row.classList.contains("lv-" + level)) &&
        (!favorites || favorite.checked) &&
        setups.some((setup) => (gear === "all" || setup.includes(gear)) &&
          (!mine || setup.every((item) => equipment.has(item)))),
      );
      const size = Number(fields.get("pp")) || matches.length || 1;
      const pages = Math.max(1, Math.ceil(matches.length / size));
      currentPage = Math.min(currentPage, pages);
      const first = (currentPage - 1) * size;
      const visible = new Set(matches.slice(first, first + size));
      for (const entry of entries) entry.row.hidden = !visible.has(entry);
      range.textContent = matches.length
        ? `${first + 1}–${Math.min(first + size, matches.length)} of ${matches.length}`
        : "0 exercises";
      empty.hidden = matches.length > 0;
      pager.hidden = pages <= 1;
      pager.replaceChildren();
      for (let page = 1; page <= pages; page++) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = page === currentPage ? "pg on" : "pg";
        button.textContent = page;
        button.setAttribute("aria-label", "Page " + page);
        if (page === currentPage) button.setAttribute("aria-current", "page");
        button.addEventListener("click", () => {
          currentPage = page;
          render();
          pager.querySelector('[aria-current="page"]').focus({ preventScroll: true });
        });
        pager.append(button);
      }
    }

    form.addEventListener("change", (event) => {
      if (event.target.matches(".fav-cb")) return;
      currentPage = 1;
      render();
    });
    form.addEventListener("reset", () => setTimeout(() => {
      currentPage = 1;
      render();
    }, 0));
    form.addEventListener("click", (event) => {
      const label = event.target.closest(".dd-panel label");
      if (!label) return;
      const menu = label.closest("details");
      setTimeout(() => {
        menu.open = false;
        menu.querySelector("summary").focus();
      }, 0);
    });
    document.addEventListener("click", (event) => {
      for (const menu of menus) {
        if (!menu.contains(event.target)) menu.open = false;
      }
    });
    render();
  });
})();
