(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    tooltip.hidden = true;
    tooltip.setAttribute("aria-hidden", "true");
    document.body.append(tooltip);

    let current;
    const points = new WeakMap();

    function register(point, label, value, anchor = point, role = "img") {
      if (points.has(point)) return;
      points.set(point, { label, value, anchor });
      point.setAttribute("data-chart-point", "");
      point.setAttribute("tabindex", "0");
      point.setAttribute("role", role);
      point.setAttribute("aria-label", role === "progressbar" ? label : label + ": " + value);
    }

    for (const chart of document.querySelectorAll(".bars")) {
      chart.setAttribute("role", "group");
      for (const point of chart.querySelectorAll(".b")) {
        const label = point.querySelector(":scope > span:last-child").textContent.trim();
        const count = point.querySelector("strong").textContent.trim();
        register(point, label, count + (count === "1" ? " workout" : " workouts"), point.querySelector(".track i"));
      }
    }

    for (const chart of document.querySelectorAll(".line-chart")) {
      chart.setAttribute("role", "group");
      for (const point of chart.querySelectorAll("circle")) {
        const title = point.querySelector("title");
        if (!title) continue;
        const [label, value] = title.textContent.split(":").map((part) => part.trim());
        register(point, label, value);
        title.remove();
      }
    }

    function registerGoals(list) {
      for (const point of list.querySelectorAll(".pbar")) {
        if (points.has(point)) continue;
        const row = point.closest("li");
        const label = row.querySelector(".g-top strong").textContent.trim();
        const [progress, percent] = Array.from(row.querySelectorAll(".g-val span"), (item) => item.textContent.trim());
        const value = `${progress} (${percent})`;
        register(point, label, value, point, "progressbar");
        point.setAttribute("aria-valuenow", Number.parseInt(percent, 10));
        point.setAttribute("aria-valuetext", value);
      }
    }

    for (const list of document.querySelectorAll("#prog-goals .goals, #user-goals")) {
      registerGoals(list);
      new MutationObserver(() => {
        if (current && !current.isConnected) hide();
        registerGoals(list);
      }).observe(list, { childList: true });
    }

    function place(anchor) {
      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const left = Math.max(margin, Math.min(
        rect.left + (rect.width - tooltip.offsetWidth) / 2,
        document.documentElement.clientWidth - tooltip.offsetWidth - margin,
      ));
      const above = rect.top - tooltip.offsetHeight - margin;
      tooltip.style.left = left + "px";
      tooltip.style.top = (above >= margin ? above : rect.bottom + margin) + "px";
    }

    function show(point) {
      const data = points.get(point);
      if (!data || current === point) return;
      hide();
      current = point;
      current.classList.add("chart-point-active");
      tooltip.textContent = data.label + " · " + data.value;
      tooltip.hidden = false;
      place(data.anchor);
    }

    function hide() {
      current?.classList.remove("chart-point-active");
      current = undefined;
      tooltip.hidden = true;
    }

    function pointAt(event) {
      const direct = event.target.closest("[data-chart-point]");
      if (direct) return direct;
      const chart = event.target.closest(".line-chart");
      if (!chart) return null;
      let nearest;
      let distance = Infinity;
      for (const point of chart.querySelectorAll("[data-chart-point]")) {
        const rect = point.getBoundingClientRect();
        const gap = Math.abs(event.clientX - (rect.left + rect.width / 2));
        if (gap < distance) {
          nearest = point;
          distance = gap;
        }
      }
      return nearest;
    }

    document.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const point = pointAt(event);
      if (point) show(point);
      else if (current && document.activeElement !== current) hide();
    });
    document.addEventListener("pointerout", (event) => {
      if (event.relatedTarget === null && current && document.activeElement !== current) hide();
    });
    document.addEventListener("click", (event) => {
      const point = pointAt(event);
      if (point) show(point);
      else hide();
    });
    document.addEventListener("focusin", (event) => {
      if (points.has(event.target)) show(event.target);
      else hide();
    });
    document.addEventListener("focusout", (event) => {
      if (event.target === current && !event.relatedTarget) hide();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hide();
    });
    window.addEventListener("resize", () => {
      if (current) place(points.get(current).anchor);
    });
    window.addEventListener("scroll", () => {
      if (current) place(points.get(current).anchor);
    }, { capture: true, passive: true });
  });
})();
