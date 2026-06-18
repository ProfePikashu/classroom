(() => {
  "use strict";

  function currentFile() {
    const file = window.location.pathname.split("/").pop();
    return file || "index.html";
  }

  function setActiveRoute() {
    const current = currentFile();
    const links = document.querySelectorAll("[data-sidebar-route]");

    links.forEach((link) => {
      const route = link.getAttribute("data-sidebar-route");
      const active = route === current;

      link.classList.toggle("active", active);

      if (active) {
        const panel = link.closest("[data-sidebar-panel]");
        if (panel) {
          openPanel(panel.getAttribute("data-sidebar-panel"));
        }
      }
    });

    const coursePages = [
      "cursos.html",
      "curso-ayrpc-2025.html",
      "clases-ayrpc-2025.html",
      "rubricas-ayrpc-2025.html",
      "curso-ayrpc-2026.html"
    ];

    if (coursePages.includes(current)) {
      const coursesToggle = document.querySelector('[data-sidebar-toggle="courses"]');
      coursesToggle?.classList.add("active");
      openPanel("courses");
    }
  }

  function openPanel(name) {
    const toggle = document.querySelector(`[data-sidebar-toggle="${name}"]`);
    const panel = document.querySelector(`[data-sidebar-panel="${name}"]`);

    if (!toggle || !panel) return;

    toggle.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    panel.classList.add("open");
  }

  function togglePanel(name) {
    const toggle = document.querySelector(`[data-sidebar-toggle="${name}"]`);
    const panel = document.querySelector(`[data-sidebar-panel="${name}"]`);

    if (!toggle || !panel) return;

    const open = !panel.classList.contains("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    panel.classList.toggle("open", open);
  }

  function bindCourseToggle() {
    document.querySelector('[data-sidebar-toggle="courses"]')?.addEventListener("click", (event) => {
      event.preventDefault();
      togglePanel("courses");
    });
  }

  function bindAdminPopover() {
    const btn = document.getElementById("sidebarAdminToggle");
    const popover = document.getElementById("sidebarAdminPopover");

    if (!btn || !popover) return;

    btn.addEventListener("click", (event) => {
      event.stopPropagation();

      const open = !popover.classList.contains("open");
      popover.classList.toggle("open", open);
      btn.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", (event) => {
      if (!popover.classList.contains("open")) return;
      if (event.target.closest(".sidebar-v2-staff")) return;

      popover.classList.remove("open");
      btn.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function bindPelusitaFooter() {
    document.getElementById("sidebarPelusitaBtn")?.addEventListener("click", () => {
      if (window.PelusitaClassroom?.open) {
        window.PelusitaClassroom.open();
        return;
      }

      const pelusita = document.querySelector(".pelusita-wrapper");
      if (pelusita) pelusita.classList.toggle("show");
    });
  }

  function init() {
    bindCourseToggle();
    bindAdminPopover();
    bindPelusitaFooter();
    setActiveRoute();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
