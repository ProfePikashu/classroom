/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — main.js
   Tema claro/oscuro + navegación + submenu cursos + sonidos UI
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomApp = {
  init() {
    if (typeof ClassroomAuth !== "undefined") {
      ClassroomAuth.initProtectedPage();
    }
    this.initTheme();
    this.initUiSounds();
    this.bindThemeToggle();
    this.bindUserMenu();
    this.bindMobileSidebar();
    this.bindSidebarSubmenus();
    this.bindCurrentHashCourse();
    this.bindModuleButtons();
  },

  initUiSounds() {
    this.sounds = {
      click: new Audio("media/sounds/click.mp3"),
      open: new Audio("media/sounds/click.mp3"),
      close: new Audio("media/sounds/close.mp3"),
      errorFast: new Audio("media/sounds/error-fast.mp3"),
      errorSimple: new Audio("media/sounds/error-simple.mp3"),
      logout: new Audio("media/sounds/log-out.mp3"),
    };

    Object.values(this.sounds).forEach((sound) => {
      sound.volume = 0.16;
      sound.preload = "auto";
    });

    document.addEventListener("click", (event) => {
      const clickable = event.target.closest(
        ".nav-item, .submenu-item, .btn, .module-item, .theme-toggle"
      );

      if (!clickable) return;

      if (clickable.matches("[data-submenu-toggle]")) {
        const submenuId = clickable.dataset.submenuToggle;
        const submenu = document.getElementById(submenuId);
        const isOpen = submenu && submenu.classList.contains("open");

        this.playSound(isOpen ? "close" : "open");
        return;
      }

      this.playSound("click");
    });
  },

  playSound(soundName) {
    if (!this.sounds || !this.sounds[soundName]) return;

    const sound = this.sounds[soundName];

    try {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    } catch (error) {
      // No rompemos la UI si el navegador bloquea audio o falta el archivo.
    }
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
    if (normalizedTheme === "light") {
      if (icon) icon.className = "fa-solid fa-sun";
      return;
    }

    if (icon) icon.className = "fa-solid fa-moon";
    },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    this.setTheme(nextTheme);
  },

  playDuckSound() {
    const duckSound = new Audio("media/sounds/duck.mp3");
    const fallbackSound = new Audio("media/sounds/click.mp3");

    duckSound.volume = 0.22;
    fallbackSound.volume = 0.16;

    duckSound.play().catch(() => {
      fallbackSound.play().catch(() => {});
    });
  },

  bindMobileSidebar() {
    const toggle = document.getElementById("mobileMenuToggle");
    const overlay = document.getElementById("mobileSidebarOverlay");

    if (!toggle || !overlay) return;

    const openMenu = () => {
      document.body.classList.add("mobile-sidebar-open");
      toggle.classList.add("is-open");
      overlay.classList.add("is-open");
      toggle.setAttribute("aria-label", "Cerrar menú");
      this.playDuckSound();
    };

    const closeMenu = () => {
      document.body.classList.remove("mobile-sidebar-open");
      toggle.classList.remove("is-open");
      overlay.classList.remove("is-open");
      toggle.setAttribute("aria-label", "Abrir menú");
      this.playDuckSound();
    };

    const toggleMenu = () => {
      if (document.body.classList.contains("mobile-sidebar-open")) {
        closeMenu();
        return;
      }

      openMenu();
    };

    toggle.addEventListener("click", toggleMenu);
    overlay.addEventListener("click", closeMenu);

    document.querySelectorAll(".sidebar a").forEach((link) => {
      link.addEventListener("click", () => {
        const isMobile = window.matchMedia("(max-width: 980px)").matches;
        const isSubmenuToggle = link.matches("[data-submenu-toggle]");

        if (!isMobile || isSubmenuToggle) return;

        closeMenu();
      });
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  },

  bindUserMenu() {
    const menu = document.getElementById("userMenu");
    const toggle = document.getElementById("userMenuToggle");
    const dropdown = document.getElementById("userDropdown");

    if (!menu || !toggle || !dropdown) return;

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.classList.toggle("open");
      this.playSound("click");
    });

    document.addEventListener("click", (event) => {
      if (menu.contains(event.target)) return;
      menu.classList.remove("open");
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") menu.classList.remove("open");
    });
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
