(() => {
  "use strict";

  if (!HTMLElement.prototype.showPopover) return;

  document.addEventListener("DOMContentLoaded", () => {
    const widgets = new WeakMap();
    let active;
    let sequence = 0;

    function sync(widget) {
      const { select, trigger, options } = widget;
      trigger.textContent = select.selectedOptions[0]?.textContent.trim() || "Select an option";
      trigger.disabled = select.disabled;
      options.forEach((option, index) => {
        option.setAttribute("aria-selected", String(index === select.selectedIndex));
      });
    }

    function place() {
      if (!active) return;
      const { trigger, panel } = active;
      const rect = trigger.getBoundingClientRect();
      const viewport = document.documentElement;
      const gap = 6;
      const below = viewport.clientHeight - rect.bottom - gap;
      const above = rect.top - gap;
      const openUp = below < Math.min(panel.scrollHeight, 220) && above > below;
      panel.style.left = rect.left + "px";
      panel.style.width = rect.width + "px";
      panel.style.maxHeight = Math.max(0, Math.min(openUp ? above : below, 320) - gap) + "px";
      panel.style.top = (openUp ? rect.top - gap - panel.offsetHeight : rect.bottom + gap) + "px";
    }

    function close(restoreFocus = false) {
      if (!active) return;
      const { panel, trigger } = active;
      active = undefined;
      if (panel.isConnected && panel.matches(":popover-open")) panel.hidePopover();
      trigger.setAttribute("aria-expanded", "false");
      if (restoreFocus) trigger.focus({ preventScroll: true });
    }

    function open(widget, fromEnd = false) {
      close();
      active = widget;
      sync(widget);
      widget.panel.showPopover();
      widget.trigger.setAttribute("aria-expanded", "true");
      place();
      const available = widget.options.filter((option) => !option.disabled);
      const selected = widget.options[widget.select.selectedIndex];
      const target = selected && !selected.disabled ? selected : fromEnd ? available.at(-1) : available[0];
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest" });
    }

    function enhance(select) {
      if (widgets.has(select) || select.multiple || select.size > 1) return;
      const id = "select-picker-" + ++sequence;
      const labels = Array.from(select.labels);
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "select-picker-trigger";
      trigger.id = id;
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-controls", id + "-options");
      const labelIds = labels.map((label, index) => {
        label.id ||= id + "-label-" + index;
        label.addEventListener("click", (event) => {
          event.preventDefault();
          trigger.focus();
        });
        return label.id;
      });
      trigger.setAttribute("aria-labelledby", [...labelIds, id].join(" "));
      const panel = document.createElement("div");
      panel.id = id + "-options";
      panel.className = "select-picker-options";
      panel.setAttribute("popover", "manual");
      panel.setAttribute("role", "listbox");
      panel.setAttribute("aria-labelledby", labelIds.join(" ") || id);
      panel.style.margin = "0";
      const options = Array.from(select.options, (choice, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.setAttribute("role", "option");
        option.tabIndex = -1;
        option.disabled = choice.disabled || Boolean(choice.closest("optgroup")?.disabled);
        option.textContent = choice.textContent.trim();
        option.addEventListener("click", () => {
          if (select.selectedIndex !== index) {
            select.selectedIndex = index;
            select.dispatchEvent(new Event("input", { bubbles: true }));
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }
          close(true);
        });
        panel.append(option);
        return option;
      });
      const widget = { select, trigger, panel, options };
      const hadFocus = document.activeElement === select;
      widgets.set(select, widget);
      select.classList.add("select-picker-native");
      select.after(trigger, panel);
      sync(widget);
      if (hadFocus) trigger.focus({ preventScroll: true });
      select.addEventListener("change", () => sync(widget));
      trigger.addEventListener("click", () => {
        if (active === widget) close(true);
        else open(widget);
      });
      trigger.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        open(widget, event.key === "ArrowUp");
      });
      panel.addEventListener("keydown", (event) => {
        if (event.key === "Escape" || event.key === "Tab") {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
          }
          close(true);
          return;
        }
        const available = options.filter((option) => !option.disabled);
        const index = available.indexOf(document.activeElement);
        const target = {
          ArrowDown: Math.min(index + 1, available.length - 1),
          ArrowUp: Math.max(index - 1, 0),
          Home: 0,
          End: available.length - 1,
        }[event.key];
        if (target === undefined) return;
        event.preventDefault();
        available[target]?.focus();
      });
      panel.addEventListener("focusout", (event) => {
        if (active === widget && !panel.contains(event.relatedTarget) && event.relatedTarget !== trigger) close();
      });
    }

    function syncAll() {
      for (const select of document.querySelectorAll("select")) {
        enhance(select);
        const widget = widgets.get(select);
        if (widget) sync(widget);
      }
    }

    syncAll();
    new MutationObserver((records) => {
      if (active && !active.select.isConnected) close();
      for (const { addedNodes } of records) {
        for (const node of addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches("select")) enhance(node);
          for (const select of node.querySelectorAll("select")) enhance(select);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("reset", () => setTimeout(syncAll, 0), true);
    document.addEventListener("pointerdown", (event) => {
      if (active && !active.panel.contains(event.target) && !active.trigger.contains(event.target)) close();
    });
    window.addEventListener("hashchange", () => { close(); syncAll(); });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", (event) => {
      if (event.target !== active?.panel) place();
    }, { capture: true, passive: true });
  });
})();
