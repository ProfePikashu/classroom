/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — login.js
   Login temporal MVP
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomLogin = {
  init() {
    ClassroomAuth.redirectIfAuthenticated();
    this.initTheme();
    this.bindThemeToggle();
    this.bindLoginForm();
  },

  initTheme() {
    const savedTheme = localStorage.getItem("andyazh-classroom-theme");
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const theme = savedTheme || (prefersLight ? "light" : "dark");

    this.setTheme(theme);
  },

  setTheme(theme) {
    const normalizedTheme = theme === "light" ? "light" : "dark";
    const root = document.documentElement;
    const toggle = document.getElementById("themeToggle");

    root.setAttribute("data-theme", normalizedTheme);
    localStorage.setItem("andyazh-classroom-theme", normalizedTheme);

    if (!toggle) return;

    const icon = toggle.querySelector("i");
    const label = toggle.querySelector("span");

    if (normalizedTheme === "light") {
      if (icon) icon.className = "fa-solid fa-sun";
      if (label) label.textContent = "Modo claro";
      return;
    }

    if (icon) icon.className = "fa-solid fa-moon";
    if (label) label.textContent = "Modo oscuro";
  },

  bindThemeToggle() {
    const toggle = document.getElementById("themeToggle");

    if (!toggle) return;

    toggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const nextTheme = currentTheme === "dark" ? "light" : "dark";

      this.setTheme(nextTheme);
    });
  },

  bindLoginForm() {
    const form = document.getElementById("loginForm");
    const email = document.getElementById("loginEmail");
    const role = document.getElementById("loginRole");

    if (!form || !email || !role) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const result = ClassroomAuth.login(email.value, role.value);

      if (!result.ok) {
        alert(result.message);
        return;
      }

      window.location.replace("index.html");
    });
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomLogin.init();
});
