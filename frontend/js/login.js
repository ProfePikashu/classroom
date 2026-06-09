/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — login.js
   Login MVP por alumno
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
    const dni = document.getElementById("loginDni");
    const twitch = document.getElementById("loginTwitch");

    if (!form || !dni || !twitch) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submit = form.querySelector("button[type='submit']");
      const originalText = submit.innerHTML;

      submit.disabled = true;
      submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validando...';

      const result = await ClassroomAuth.loginWithStudent(dni.value, twitch.value);

      submit.disabled = false;
      submit.innerHTML = originalText;

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
