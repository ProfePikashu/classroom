/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — home.js
   Datos del alumno en Inicio
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomHome = {
  init() {
    if (typeof ClassroomAuth === "undefined") return;

    const session = ClassroomAuth.getSession();

    if (!session) return;

    this.paintStudent(session);
  },

  paintStudent(session) {
    const alumno = session.alumno || {};

    this.setText("homeStudentName", alumno["Nombre Completo"] || session.displayName || "{ASIGNAR DATO}");
    this.setText("homeStudentTwitch", session.twitch || "{ASIGNAR DATO}");
    this.setText("homeStudentApto", alumno["APTO"] || "{ASIGNAR DATO}");
    this.setText("homeStudentResult", alumno["Resultado"] || "Pendiente / Sin cargar");
  },

  setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomHome.init();
});

/* === Home Remove Legacy Newsletter 20260621 === */
(function removeLegacyNewsletterPanel() {
  "use strict";

  const LEGACY_TEXTS = [
    "Novedades del Classroom",
    "Newsletter interno"
  ];

  function textOf(node) {
    return (node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function findLegacyNode() {
    const candidates = Array.from(document.querySelectorAll("section, article, .panel, div"));

    return candidates.find((node) => {
      const text = textOf(node);
      if (!text) return false;

      const hasLegacyTitle = LEGACY_TEXTS.some((needle) => text.includes(needle));
      const isNewTerminal = node.classList?.contains("home-terminal-feed")
        || node.classList?.contains("home-terminal-feed-section")
        || text.includes("AVISOS - NOVEDADES");

      return hasLegacyTitle && !isNewTerminal;
    });
  }

  function removeLegacy() {
    const node = findLegacyNode();
    if (!node) return false;

    const removable = node.closest("section")
      || node.closest("article")
      || node;

    removable.remove();
    return true;
  }

  function runCleanup() {
    removeLegacy();

    // Por si main.js/newsletter lo inyecta un toque después
    setTimeout(removeLegacy, 80);
    setTimeout(removeLegacy, 250);
    setTimeout(removeLegacy, 700);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runCleanup);
  } else {
    runCleanup();
  }

  const observer = new MutationObserver(() => {
    removeLegacy();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
