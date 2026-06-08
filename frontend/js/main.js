/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — main.js
   Tema claro/oscuro + navegación + submenu cursos
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomApp = {
  init() {
    this.initTheme();
    this.bindThemeToggle();
    this.bindSidebarSubmenus();
    this.bindCurrentHashCourse();
    this.bindModuleButtons();
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

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    this.setTheme(nextTheme);
  },

  bindThemeToggle() {
    const toggle = document.getElementById("themeToggle");

    if (!toggle) return;

    toggle.addEventListener("click", () => {
      this.toggleTheme();
    });
  },

  bindSidebarSubmenus() {
    const toggles = document.querySelectorAll("[data-submenu-toggle]");

    toggles.forEach((toggle) => {
      toggle.addEventListener("click", (event) => {
        const href = toggle.getAttribute("href");

        if (href && href !== "#") {
          return;
        }

        event.preventDefault();

        const submenuId = toggle.dataset.submenuToggle;
        const submenu = document.getElementById(submenuId);

        if (!submenu) return;

        toggle.classList.toggle("submenu-open");
        submenu.classList.toggle("open");
      });
    });

    const submenuItems = document.querySelectorAll(".submenu-item");

    submenuItems.forEach((item) => {
      item.addEventListener("click", () => {
        submenuItems.forEach((link) => link.classList.remove("active"));
        item.classList.add("active");
      });
    });
  },

  bindCurrentHashCourse() {
    const hash = window.location.hash.replace("#", "");

    if (!hash) return;

    const item = document.querySelector('[data-course-id="' + hash + '"]');

    if (!item) return;

    document.querySelectorAll(".submenu-item").forEach((link) => {
      link.classList.remove("active");
    });

    item.classList.add("active");
  },

  bindModuleButtons() {
    const moduleButtons = document.querySelectorAll(".module-item");

    moduleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const moduleName = button.innerText.trim();
        console.log("Módulo seleccionado:", moduleName);
      });
    });
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomApp.init();
});
