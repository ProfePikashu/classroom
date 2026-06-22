"use strict";

const ClassroomAdmin = {
  init() {
    if (!this.checkAccess()) return;

    this.bindForm();
    this.renderModerators();
  },

  checkAccess() {
    const isTeacher = typeof ClassroomRoles !== "undefined" && ClassroomRoles.isCurrentTeacher();

    const denied = document.getElementById("adminDenied");
    const app = document.getElementById("adminApp");

    if (denied) denied.style.display = isTeacher ? "none" : "block";
    if (app) app.style.display = isTeacher ? "grid" : "none";

    return isTeacher;
  },

  bindForm() {
    const form = document.getElementById("moderatorForm");

    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const twitch = document.getElementById("moderatorTwitch").value;
      const dni = document.getElementById("moderatorDni").value;

      this.addModerator(twitch, dni);

      form.reset();
    });
  },

  normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  },

  normalizeDni(value) {
    return String(value || "").replace(/\D/g, "").trim();
  },

  getAssignments() {
    if (typeof ClassroomRoles === "undefined") return [];

    return ClassroomRoles.getAssignments();
  },

  saveAssignments(assignments) {
    if (typeof ClassroomRoles === "undefined") return;

    ClassroomRoles.saveAssignments(assignments);
    ClassroomRoles.paintRole();
  },

  addModerator(twitch, dni) {
    const normalizedTwitch = this.normalize(twitch);
    const normalizedDni = this.normalizeDni(dni);

    if (!normalizedTwitch || !normalizedDni) {
      alert("Completá usuario de Twitch y DNI.");
      return;
    }

    const assignments = this.getAssignments();

    const exists = assignments.some((item) => {
      return this.normalize(item.twitch) === normalizedTwitch && this.normalizeDni(item.dni) === normalizedDni;
    });

    if (exists) {
      alert("Ese usuario ya tiene rol asignado.");
      return;
    }

    assignments.push({
      twitch: normalizedTwitch,
      dni: normalizedDni,
      role: "moderator",
      roleLabel: "Moderador",
      createdAt: new Date().toISOString(),
    });

    this.saveAssignments(assignments);
    this.renderModerators();
  },

  removeModerator(index) {
    const assignments = this.getAssignments();

    assignments.splice(index, 1);

    this.saveAssignments(assignments);
    this.renderModerators();
  },

  renderModerators() {
    const container = document.getElementById("moderatorsList");

    if (!container) return;

    const assignments = this.getAssignments().filter((item) => item.role === "moderator");

    if (!assignments.length) {
      container.innerHTML = `
        <div class="empty-admin-state">
          No hay moderadores asignados.
        </div>
      `;
      return;
    }

    container.innerHTML = assignments.map((item, index) => `
      <article class="moderator-card">
        <div>
          <strong>@${item.twitch}</strong>
          <span>DNI ${item.dni}</span>
          <small>${item.roleLabel || "Moderador"}</small>
        </div>

        <button class="btn btn-outline danger-btn" type="button" data-remove-moderator="${index}">
          <i class="fa-solid fa-user-minus"></i>
          Quitar
        </button>
      </article>
    `).join("");

    container.querySelectorAll("[data-remove-moderator]").forEach((button) => {
      button.addEventListener("click", () => {
        const ok = confirm("¿Quitar rol de moderador?");
        if (!ok) return;

        this.removeModerator(Number(button.dataset.removeModerator));
      });
    });
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomAdmin.init();
});

/* === Moderator Dedupe Admin Fix 20260622 === */
(function moderatorDedupeAdminFix() {
  "use strict";

  function normTwitch(value) {
    return String(value || "").trim().toLowerCase().replace(/^@+/, "");
  }

  function normDni(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function keyOf(item) {
    return `${normTwitch(item?.twitch)}::${normDni(item?.dni)}`;
  }

  function dedupeModerators(list) {
    const seen = new Set();

    return (Array.isArray(list) ? list : [])
      .map((item) => ({
        ...item,
        twitch: normTwitch(item?.twitch),
        dni: normDni(item?.dni),
        role: item?.role || "moderator",
        roleLabel: item?.roleLabel || "Moderador",
      }))
      .filter((item) => {
        const key = keyOf(item);
        if (!item.twitch || !item.dni || seen.has(key)) return false;

        seen.add(key);
        return true;
      });
  }

  function findModeratorStorageKeys() {
    const keys = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);

      if (
        key &&
        /moderator|moderador|assigned.*role|classroom.*role|roles/i.test(key)
      ) {
        keys.push(key);
      }
    }

    return keys;
  }

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  }

  function cleanLocalStorageModeratorDuplicates() {
    findModeratorStorageKeys().forEach((key) => {
      const value = safeJson(localStorage.getItem(key), null);

      if (!Array.isArray(value)) return;

      const cleaned = dedupeModerators(value);

      if (cleaned.length !== value.length) {
        localStorage.setItem(key, JSON.stringify(cleaned));
        console.info("[Classroom] Moderadores deduplicados en", key, value.length, "→", cleaned.length);
      }
    });
  }

  function patchAdminApp() {
    const app = window.ClassroomAdmin || window.AdminPanel || window.ClassroomAdminPanel;

    if (!app || app.__moderatorDedupePatched) return;

    app.__moderatorDedupePatched = true;

    if (typeof app.getModeratorAssignments === "function") {
      const originalGet = app.getModeratorAssignments.bind(app);

      app.getModeratorAssignments = function patchedGetModeratorAssignments(...args) {
        return dedupeModerators(originalGet(...args));
      };
    }

    if (typeof app.getAssignments === "function") {
      const originalGetAssignments = app.getAssignments.bind(app);

      app.getAssignments = function patchedGetAssignments(...args) {
        return dedupeModerators(originalGetAssignments(...args));
      };
    }

    if (typeof app.addModerator === "function") {
      const originalAdd = app.addModerator.bind(app);

      app.addModerator = function patchedAddModerator(twitch, dni, ...rest) {
        cleanLocalStorageModeratorDuplicates();

        const cleanTwitch = normTwitch(twitch);
        const cleanDni = normDni(dni);

        const existing = typeof app.getModeratorAssignments === "function"
          ? dedupeModerators(app.getModeratorAssignments())
          : [];

        const exists = existing.some((item) => normTwitch(item.twitch) === cleanTwitch && normDni(item.dni) === cleanDni);

        if (exists) {
          alert("Ese moderador ya está asignado.");
          if (typeof app.renderModerators === "function") app.renderModerators();
          return;
        }

        const result = originalAdd(cleanTwitch, cleanDni, ...rest);

        cleanLocalStorageModeratorDuplicates();

        if (typeof app.renderModerators === "function") app.renderModerators();

        return result;
      };
    }

    if (typeof app.renderModerators === "function") {
      const originalRender = app.renderModerators.bind(app);

      app.renderModerators = function patchedRenderModerators(...args) {
        cleanLocalStorageModeratorDuplicates();
        return originalRender(...args);
      };
    }
  }

  function patchByDomAsFallback() {
    const container = document.getElementById("moderatorsList");
    if (!container) return;

    const cards = Array.from(container.children);
    const seen = new Set();

    cards.forEach((card) => {
      const text = card.textContent || "";
      const twitch = (text.match(/@?([a-z0-9_]+)/i) || [])[1] || "";
      const dni = (text.match(/DNI\s*([0-9]+)/i) || [])[1] || "";
      const key = `${normTwitch(twitch)}::${normDni(dni)}`;

      if (!dni || !twitch) return;

      if (seen.has(key)) {
        card.remove();
        return;
      }

      seen.add(key);
    });
  }

  function init() {
    cleanLocalStorageModeratorDuplicates();

    setTimeout(patchAdminApp, 100);
    setTimeout(patchAdminApp, 500);
    setTimeout(patchAdminApp, 1200);

    setTimeout(patchByDomAsFallback, 300);
    setTimeout(patchByDomAsFallback, 900);
    setTimeout(patchByDomAsFallback, 1500);
  }

  window.ClassroomModeratorDedupeFix = {
    clean: cleanLocalStorageModeratorDuplicates,
    dedupe: dedupeModerators,
    patch: patchAdminApp,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
