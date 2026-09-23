(() => {
  "use strict";

  const ADMIN_PERMISSION_BY_ROUTE = Object.freeze({
    "asistencias.html": "attendance.view",
    "alumnos.html": "students.view",
    "centro-notificaciones.html": "notifications.manage",
    "administrar-comunidad.html": "community.moderate",
  });

  const TEACHER_ONLY_ADMIN_ROUTES = new Set([
    "admin.html",
    "rubricas-ayrpc-2025.html",
  ]);

  function hasPermission(permission) {
    if (!permission) return true;

    return (
      typeof ClassroomRoles !== "undefined" &&
      typeof ClassroomRoles.currentHasPermission === "function" &&
      ClassroomRoles.currentHasPermission(permission)
    );
  }

  function canAccessAdminRoute(route) {
    if (TEACHER_ONLY_ADMIN_ROUTES.has(route)) {
      return (
        typeof ClassroomRoles !== "undefined" &&
        typeof ClassroomRoles.isCurrentTeacher === "function" &&
        ClassroomRoles.isCurrentTeacher()
      );
    }

    const permission = ADMIN_PERMISSION_BY_ROUTE[route];
    if (!permission) return false;

    return hasPermission(permission);
  }

  function filterAdminLinks() {
    const staff = document.querySelector(".sidebar-v2-staff");
    const popover = document.getElementById("sidebarAdminPopover");

    if (!staff || !popover) return;

    const links = Array.from(popover.querySelectorAll("a[href]"));

    links.forEach((link) => {
      const href = String(link.getAttribute("href") || "");
      const route = href.split("#")[0].split("?")[0].split("/").pop();
      const allowed = canAccessAdminRoute(route);

      link.style.display = allowed ? "" : "none";
      link.setAttribute("aria-hidden", allowed ? "false" : "true");
    });

    const hasVisibleLinks = links.some((link) => link.style.display !== "none");

    staff.style.display = hasVisibleLinks ? "" : "none";
  }

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
        if (panel) openPanel(panel.getAttribute("data-sidebar-panel"));
      }
    });

    const coursePages = [
      "cursos.html",
      "curso-ayrpc-2025.html",
      "clases-ayrpc-2025.html",
      "rubricas-ayrpc-2025.html",
      "curso-ayrpc-2026.html",
      "clases-ayrpc-2026.html"
    ];

    if (coursePages.includes(current)) {
      document.querySelector('[data-sidebar-toggle="courses"]')?.classList.add("active");
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

  function dockPelusita(attempt = 0) {
    const dock = document.getElementById("sidebarPelusitaDock");
    const pelusita = document.querySelector(".pelusita-wrapper");

    if (!dock) return;

    if (!pelusita) {
      if (attempt < 30) {
        setTimeout(() => dockPelusita(attempt + 1), 120);
      }
      return;
    }

    if (pelusita.dataset.sidebarDocked === "true") return;

    pelusita.dataset.sidebarDocked = "true";
    pelusita.classList.add("pelusita-sidebar-docked");

    dock.innerHTML = "";
    dock.appendChild(pelusita);

    dock.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (window.PelusitaBot?.open) {
        window.PelusitaBot.open();
        return;
      }

      if (window.PelusitaClassroom?.open) {
        window.PelusitaClassroom.open();
      }
    });
  }

  function init() {
    filterAdminLinks();
    bindCourseToggle();
    bindAdminPopover();
    setActiveRoute();

    window.addEventListener("load", () => dockPelusita());
    setTimeout(() => dockPelusita(), 300);
    setTimeout(() => dockPelusita(), 900);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
