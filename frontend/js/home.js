/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — home.js
   Datos del alumno en Inicio
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomHome = {
  async init() {
    if (typeof ClassroomAuth === "undefined") return;

    const session = ClassroomAuth.getSession();
    if (!session) return;

    await this.refreshProfile(session);
  },

  get apiBase() {
    return typeof EXAMPRO_API_BASE !== "undefined"
      ? EXAMPRO_API_BASE
      : "https://api.andyazhtec.com";
  },

  getToken(session) {
    return (
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      session?.exampro?.token ||
      session?.access_token ||
      session?.token ||
      session?.accessToken ||
      ""
    );
  },

  async fetchProfile(token) {
    const response = await fetch(
      `${this.apiBase}/api/classroom/me/profile`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.detail ||
        "No se pudo actualizar el perfil del Classroom."
      );
    }

    return data;
  },

  async refreshProfile(session) {
    const token = this.getToken(session);

    if (!token) return;

    try {
      const data = await this.fetchProfile(token);

      const student = data?.student || {};

      const updatedSession = {
        ...session,
        displayName:
          student.full_name ||
          session.displayName ||
          "",
        dni:
          student.dni ||
          session.dni ||
          "",
        email:
          student.email ||
          session.email ||
          "",
        telefono:
          student.phone ||
          session.telefono ||
          "",
        twitch:
          student.twitch ||
          session.twitch ||
          ""
      };

      ClassroomAuth.setSession(updatedSession);
    } catch (error) {
      console.warn(
        "Home: no se pudo refrescar el perfil dinámico.",
        error
      );
    }
  }
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
