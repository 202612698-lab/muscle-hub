(() => {
  "use strict";

  const demoEmail = "admin@gmail.com";
  const demoAccount = {
    email: demoEmail,
    name: "Alex",
    demo: true,
    createdAt: "2026-06-01T12:00:00Z",
    preferences: {
      goal: "Build Muscle",
      level: "Beginner",
      location: "At Home",
      schedule: "5 Days per Week",
    },
  };
  const accountKey = (email) => `muscleHub.account.${email}`;
  const sessionKey = "muscleHub.session";
  const protectedPages = new Set([
    "setup.html",
    "dashboard.html",
    "profile.html",
    "progress.html",
    "exercise-library.html",
    "workout-plans.html",
    "goals.html",
    "session.html",
    "session-active-start.html",
    "session-ppl.html",
    "session-upper-lower.html",
  ]);
  const filename = location.pathname.split("/").pop();
  const requiresLogin = protectedPages.has(filename);

  function findAccount(email) {
    if (email === demoEmail) {
      const saved = JSON.parse(localStorage.getItem(accountKey(email)));
      return {
        ...demoAccount,
        name: saved?.name || demoAccount.name,
        preferences: { ...demoAccount.preferences, ...saved?.preferences },
        profile: saved?.profile,
      };
    }
    return email ? JSON.parse(localStorage.getItem(accountKey(email))) : null;
  }

  function currentAccount() {
    try {
      return findAccount(sessionStorage.getItem(sessionKey));
    } catch {
      return null;
    }
  }

  function getCurrentUser() {
    const account = currentAccount();
    if (!account) return null;
    const { email, name, demo, createdAt, preferences, profile } = account;
    return {
      email,
      name,
      demo: Boolean(demo),
      createdAt,
      preferences: { ...preferences },
      profile: { ...profile },
    };
  }

  window.MuscleHubAuth = Object.freeze({ getCurrentUser });

  function requireSession() {
    if (!requiresLogin || currentAccount()) return true;
    const next = encodeURIComponent(filename + location.hash);
    location.replace(`login.html?next=${next}`);
    return false;
  }

  if (!requireSession()) return;
  window.addEventListener("pageshow", requireSession);

  const snackbarKey = "muscleHub.snackbar";
  let snackbar;
  let snackbarTimer;
  let announcements;
  let returnFocus;

  const snackbarStylesheet = document.createElement("link");
  snackbarStylesheet.rel = "stylesheet";
  snackbarStylesheet.href = new URL(
    "../css/snackbar.css",
    document.currentScript.src,
  ).href;
  document.head.append(snackbarStylesheet);

  function dismissSnackbar() {
    clearTimeout(snackbarTimer);
    if (!snackbar) return;
    if (snackbar.contains(document.activeElement)) returnFocus?.focus();
    snackbar.hidden = true;
  }

  function startSnackbarTimer() {
    clearTimeout(snackbarTimer);
    if (!snackbar.matches(":hover, :focus-within")) {
      snackbarTimer = setTimeout(dismissSnackbar, 5500);
    }
  }

  function initSnackbar() {
    snackbar = document.createElement("div");
    snackbar.className = "mh-snackbar";
    snackbar.hidden = true;
    snackbar.innerHTML =
      '<div class="mh-snackbar-message"><strong class="mh-snackbar-label"></strong><div></div></div><button type="button" aria-label="Dismiss notification">×</button>';
    snackbar.querySelector("button").addEventListener("click", dismissSnackbar);
    snackbar.addEventListener("pointerenter", () =>
      clearTimeout(snackbarTimer),
    );
    snackbar.addEventListener("pointerleave", startSnackbarTimer);
    snackbar.addEventListener("focusin", () => clearTimeout(snackbarTimer));
    snackbar.addEventListener("focusout", () =>
      queueMicrotask(startSnackbarTimer),
    );
    document.body.append(snackbar);

    announcements = {};
    for (const role of ["alert", "status"]) {
      const region = document.createElement("div");
      region.className = "mh-snackbar-announcement";
      region.setAttribute("role", role);
      document.body.append(region);
      announcements[role] = region;
    }
  }

  function showSnackbar(message, kind = "success") {
    const labels = { success: "Success", warning: "Warning", error: "Error" };
    if (!Object.hasOwn(labels, kind)) kind = "error";
    if (!snackbar) initSnackbar();
    if (!snackbar.contains(document.activeElement))
      returnFocus = document.activeElement;
    snackbar.dataset.kind = kind;
    snackbar.querySelector("strong").textContent = labels[kind];
    snackbar.querySelector(".mh-snackbar-message > div").textContent = message;
    snackbar.hidden = false;
    const region = announcements[kind === "success" ? "status" : "alert"];
    region.textContent = "";
    requestAnimationFrame(() => {
      region.textContent = labels[kind] + ". " + message;
    });
    startSnackbarTimer();
  }

  function notifyAfterNavigation(message, kind = "success") {
    try {
      sessionStorage.setItem(snackbarKey, JSON.stringify({ message, kind }));
    } catch {
      // Notifications should not prevent navigation when storage is unavailable.
    }
  }

  function consumeSnackbar() {
    try {
      const raw = sessionStorage.getItem(snackbarKey);
      if (!raw) return;
      sessionStorage.removeItem(snackbarKey);
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function bindValidationNotifications() {
    let firstInvalidField;
    document.addEventListener(
      "invalid",
      (event) => {
        const field = event.target;
        if (!field.form) return;
        event.preventDefault();
        if (firstInvalidField) return;
        firstInvalidField = field;
        setTimeout(() => {
          firstInvalidField = null;
          field.focus();
          const feedback = field.closest(".field")?.querySelector(".err");
          const label = field.labels?.[0]?.textContent
            .trim()
            .replace(/\s*\*$/, "");
          const message =
            feedback?.textContent ||
            (label ? label + ". " : "") + field.validationMessage;
          showSnackbar(message, "warning");
        }, 0);
      },
      true,
    );
  }

  window.MuscleHubSnackbar = Object.freeze({ show: showSnackbar });

  async function passwordHash(password, salt) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: new Uint8Array(salt),
        iterations: 600000,
      },
      key,
      256,
    );
    return Array.from(new Uint8Array(bits), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  function destination(account) {
    if (!account.preferences) return "setup.html";
    const next = new URLSearchParams(location.search).get("next") || "";
    return protectedPages.has(next.split("#")[0]) ? next : "dashboard.html";
  }

  function bindAuthForm() {
    const form = document.querySelector(".auth-card");
    const passwordInput = form.querySelector("#auth-password");
    const toggle = form.querySelector(".password-toggle");
    toggle.hidden = false;
    toggle.addEventListener("click", () => {
      const visible = passwordInput.type === "password";
      passwordInput.type = visible ? "text" : "password";
      toggle.textContent = visible ? "Hide" : "Show";
      toggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    });
    const button = form.querySelector("button[type=submit]");
    const signup = filename === "signup.html";
    button.disabled = false;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (button.disabled) return;
      const fields = new FormData(form);
      const email = fields.get("email").trim().toLowerCase();
      const password = fields.get("password");
      dismissSnackbar();
      button.disabled = true;

      try {
        let account = findAccount(email);
        if (signup) {
          const name = fields.get("name").trim();
          if (name.length < 2)
            throw new Error("Enter a name with at least 2 characters.");
          if (account)
            throw new Error("An account already exists for this email.");
          const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
          const hash = await passwordHash(password, salt);
          if (findAccount(email))
            throw new Error("An account already exists for this email.");
          account = {
            email,
            name,
            salt,
            hash,
            createdAt: new Date().toISOString(),
          };
          localStorage.setItem(accountKey(email), JSON.stringify(account));
        } else {
          const valid =
            account &&
            (account.demo
              ? password === "admin123"
              : (await passwordHash(password, account.salt)) === account.hash);
          if (!valid) throw new Error("Email or password is incorrect.");
        }

        sessionStorage.setItem(sessionKey, email);
        notifyAfterNavigation(
          signup ? "Account created." : "Logged in successfully.",
        );
        location.replace(destination(account));
      } catch (issue) {
        const message =
          issue.constructor === Error
            ? issue.message
            : "Account access is unavailable. Open Muscle Hub on localhost or HTTPS with browser storage enabled.";
        showSnackbar(message, "error");
        button.disabled = false;
      }
    });
  }

  const setupFields = {
    goal: "goal",
    level: "level",
    loc: "location",
    sched: "schedule",
  };

  function bindSetup() {
    document
      .querySelector('#s6 a[href="dashboard.html"]')
      .addEventListener("click", (event) => {
        event.preventDefault();
        const preferences = {};
        for (const [name, key] of Object.entries(setupFields)) {
          const selected = document.querySelector(
            `input[name="${name}"]:checked`,
          );
          if (!selected) {
            location.hash =
              "#" +
              document.querySelector(`input[name="${name}"]`).closest(".wstep")
                .id;
            showSnackbar("Choose an option to continue.", "warning");
            return;
          }
          preferences[key] = selected
            .closest("label")
            .querySelector("b").textContent;
        }
        const account = currentAccount();
        if (!account) return requireSession();
        try {
          if (!account.demo) {
            localStorage.setItem(
              accountKey(account.email),
              JSON.stringify({ ...account, preferences }),
            );
          }
        } catch {
          showSnackbar(
            "Your preferences could not be saved. Try again with browser storage enabled.",
            "error",
          );
          return;
        }
        notifyAfterNavigation("Workout preferences saved.");
        location.replace("dashboard.html");
      });
  }

  function renderAccount(user) {
    const initial = Array.from(user.name)[0].toUpperCase();
    for (const node of document.querySelectorAll(".me .av, #ov-avatar")) {
      node.textContent = initial;
      const avatar = user.profile.avatar;
      if (avatar) {
        const image = document.createElement("img");
        image.src = avatar;
        image.alt = "";
        node.replaceChildren(image);
      }
      node.classList.toggle("has-img", Boolean(avatar));
    }
    for (const node of document.querySelectorAll(
      ".me .me-name, .welcome h1 span, #ov-name",
    )) {
      node.textContent = user.name;
    }
    const level = user.preferences.level;
    for (const link of document.querySelectorAll(".me")) {
      const subtext = link.querySelector(".me-level");
      subtext.textContent = level || "";
      subtext.hidden = !level;
      link.setAttribute("aria-label", level ? user.name + ", " + level : user.name);
    }
    if (filename !== "profile.html") return;
    document.querySelector("#ep-name").defaultValue = user.name;
    document.querySelector("#pf-email").defaultValue = user.email;
    document.querySelector("#member-since").textContent =
      "Member since " +
      new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
        new Date(user.createdAt),
      );
    const fields = {
      goal: "ep-goal",
      level: "ep-level",
      location: "ep-loc",
      schedule: "ep-sched",
    };
    for (const [key, id] of Object.entries(fields)) {
      const value = user.preferences[key];
      if (!value) continue;
      const select = document.getElementById(id);
      for (const option of select.options)
        option.defaultSelected = option.value === value;
      select.value = value;
      const summary = document.querySelector(`[data-preference="${key}"]`);
      summary.textContent = value;
      if (key === "level")
        summary.className = `tag level lvl-${value.toLowerCase()}`;
    }
  }

  const profileTextFields = ["bio", "age", "height_cm", "height_in", "weight_kg", "weight_lb"];
  const profileListFields = ["days", "equipment"];
  const profileSwitches = ["n_reminders", "n_summary", "n_milestones"];
  const profilePreferences = ["goal", "level", "location", "schedule", "duration"];

  function loadProfileFields(form, profile, preferences) {
    for (const name of profileTextFields) {
      const field = form.elements.namedItem(name);
      if (Object.hasOwn(profile, name)) field.value = field.defaultValue = profile[name];
    }
    for (const input of form.querySelectorAll('input[type="radio"], input[type="checkbox"]')) {
      if (!Object.hasOwn(profile, input.name)) continue;
      const value = profile[input.name];
      const checked = Array.isArray(value) ? value.includes(input.value) :
        input.type === "radio" ? value === input.value : Boolean(value);
      input.checked = input.defaultChecked = checked;
    }
    const duration = form.elements.namedItem("duration");
    if (preferences.duration) {
      for (const option of duration.options) option.defaultSelected = option.value === preferences.duration;
      duration.value = preferences.duration;
    }
    if (profile.bio) document.querySelector(".ov-bio").textContent = profile.bio;
  }

  async function encodeProfilePhoto(file) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      throw new Error("Choose a JPG, PNG, or WebP photo.");
    }
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      const side = Math.min(bitmap.width, bitmap.height);
      canvas.width = canvas.height = 256;
      canvas.getContext("2d").drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
      return canvas.toDataURL("image/webp", 0.86);
    } finally {
      bitmap.close();
    }
  }

  function bindProfile(user) {
    const form = document.querySelector("#profile-form");
    const saveBar = form.querySelector(".save-bar");
    const save = form.querySelector('button[type="submit"]');
    const photo = document.querySelector("#ov-file");
    const remove = document.querySelector(".ov-remove");
    const days = form.querySelector(".days-field");
    const dayWarning = days.querySelector(".err").textContent;
    const hasPhoto = Boolean(user.profile.avatar);
    let removePhoto = false;
    let saving = false;

    loadProfileFields(form, user.profile, user.preferences);
    function updateUnits() {
      const metric = form.elements.namedItem("units").value === "kg";
      for (const input of form.querySelectorAll(".u-metric input")) input.disabled = !metric;
      for (const input of form.querySelectorAll(".u-imperial input")) input.disabled = metric;
    }
    function readFields() {
      const fields = new FormData(form);
      for (const name of profileTextFields) {
        fields.set(name, form.elements.namedItem(name).value);
      }
      return fields;
    }
    updateUnits();
    const savedFields = JSON.stringify([...readFields()]);
    function updateSaveBar() {
      updateUnits();
      const hasSelection = Boolean(photo.files.length);
      photo.classList.toggle("has-selection", hasSelection);
      remove.hidden = !hasSelection && (!hasPhoto || removePhoto);
      const dirty = hasSelection || removePhoto || JSON.stringify([...readFields()]) !== savedFields;
      saveBar.hidden = !dirty;
      saveBar.classList.toggle("is-dirty", dirty);
    }
    form.addEventListener("input", updateSaveBar);
    form.addEventListener("change", updateSaveBar);
    remove.addEventListener("click", () => {
      photo.value = "";
      removePhoto = hasPhoto;
      updateSaveBar();
    });
    form.addEventListener("reset", (event) => {
      if (saving) {
        event.preventDefault();
        return;
      }
      photo.value = "";
      removePhoto = false;
      setTimeout(updateSaveBar, 0);
    });
    days.addEventListener("change", () => {
      if (!days.querySelector("input:checked")) showSnackbar(dayWarning, "warning");
    });
    window.addEventListener("pageshow", updateSaveBar);
    updateSaveBar();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (saving || saveBar.hidden) return;
      const fields = readFields();
      const name = fields.get("name").trim();
      if (name.length < 2) {
        form.elements.namedItem("name").focus();
        showSnackbar("Enter a display name of 2–40 characters.", "warning");
        return;
      }
      if (!fields.getAll("days").length) {
        days.querySelector("input").focus();
        showSnackbar(dayWarning, "warning");
        return;
      }
      const pendingPhoto = photo.files[0];
      const snapshot = JSON.stringify([...fields]);
      saving = save.disabled = true;
      try {
        let avatar = removePhoto ? "" : user.profile.avatar || "";
        if (pendingPhoto) avatar = await encodeProfilePhoto(pendingPhoto);
        if (snapshot !== JSON.stringify([...readFields()]) || pendingPhoto !== photo.files[0]) {
          showSnackbar("Your edits changed while saving. Review them and try again.", "warning");
          return;
        }
        const account = currentAccount();
        if (!account || account.email !== user.email) {
          showSnackbar("Sign in again to save your changes.", "error");
          return;
        }
        const preferences = { ...account.preferences };
        for (const key of profilePreferences) preferences[key] = fields.get(key);
        const profile = { ...account.profile, units: fields.get("units"), avatar };
        for (const key of profileTextFields) {
          const field = form.elements.namedItem(key);
          if (field.validity.valid) profile[key] = fields.get(key).trim();
        }
        for (const key of profileListFields) profile[key] = fields.getAll(key);
        for (const key of profileSwitches) profile[key] = fields.has(key);
        localStorage.setItem(accountKey(account.email), JSON.stringify({ ...account, name, preferences, profile }));
        notifyAfterNavigation("Profile changes saved.");
        location.reload();
      } catch (error) {
        showSnackbar(error.message === "Choose a JPG, PNG, or WebP photo."
          ? error.message : "Profile changes could not be saved. Check your photo and browser storage.", "error");
      } finally {
        saving = save.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindValidationNotifications();
    const notification = consumeSnackbar();
    if (notification) showSnackbar(notification.message, notification.kind);
    if (filename === "login.html" || filename === "signup.html") bindAuthForm();
    if (!requiresLogin || !requireSession()) return;
    const user = getCurrentUser();
    if (
      filename !== "setup.html" &&
      !user.demo &&
      !currentAccount().preferences
    ) {
      location.replace("setup.html");
      return;
    }
    if (filename === "setup.html") bindSetup();
    renderAccount(user);
    if (filename === "profile.html") bindProfile(user);

    for (const link of document.querySelectorAll(".out, [data-logout]")) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        sessionStorage.removeItem(sessionKey);
        notifyAfterNavigation("Logged out.");
        location.replace("login.html");
      });
    }
  });
})();
