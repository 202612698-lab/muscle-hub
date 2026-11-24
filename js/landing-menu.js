(() => {
  "use strict";

  const toggle = document.querySelector(".landing-menu-toggle");
  const menu = document.querySelector("#landing-menu");
  const mobile = window.matchMedia("(max-width: 820px)");
  if (typeof menu.showModal !== "function") return;

  toggle.hidden = false;
  toggle.addEventListener("click", () => {
    menu.showModal();
    toggle.setAttribute("aria-expanded", "true");
  });
  menu.querySelector(".landing-menu-close").addEventListener("click", () => menu.close());
  menu.querySelector("nav").addEventListener("click", (event) => {
    if (event.target.closest("a")) menu.close();
  });
  menu.addEventListener("close", () => {
    toggle.setAttribute("aria-expanded", "false");
    if (mobile.matches) toggle.focus({ preventScroll: true });
  });
  mobile.addEventListener("change", () => {
    if (!mobile.matches && menu.open) menu.close();
  });
})();
