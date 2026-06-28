/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — roles.js
════════════════════════════════════════════════════════ */

"use strict";

const CLASSROOM_TEACHER_TWITCH_USERS = [
  "profe_pikashu",
  "profepikashu",
  "profepikashu_",
  "profe_pikachu",
];

const CLASSROOM_TEACHER_NAMES = [
  "ARTURO ANDRES CORIA",
  "ARTURO ANDRÉS CORIA",
];

const CLASSROOM_STATIC_ROLE_ASSIGNMENTS = [];

const ClassroomRoles = {
  storageKey: "andyazh-classroom-session",
  assignmentsKey: "andyazh-classroom-role-assignments",

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

  normalizeName(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  },

  getSessionIdentity(session) {
    const alumno = session?.alumno || {};

    return {
      twitch: this.normalize(
        session?.twitch ||
        alumno["Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)"] ||
        alumno["Usuario de Twitch"]
      ),

      dni: this.normalizeDni(
        session?.dni ||
        alumno["DNI"]
      ),

      name: this.normalizeName(
        session?.displayName ||
        alumno["Nombre Completo"] ||
        alumno["Nombre"]
      ),
    };
  },

  getAssignments() {
    let localAssignments = [];

    try {
      const raw = localStorage.getItem(this.assignmentsKey);
      const parsed = raw ? JSON.parse(raw) : [];
      localAssignments = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      localAssignments = [];
    }

    const staticAssignments =
      typeof CLASSROOM_STATIC_ROLE_ASSIGNMENTS !== "undefined"
        ? CLASSROOM_STATIC_ROLE_ASSIGNMENTS
        : [];

    return [...staticAssignments, ...localAssignments];
  },

  saveAssignments(assignments) {
    localStorage.setItem(this.assignmentsKey, JSON.stringify(assignments || []));
  },

  isTeacherSession(session) {
    if (!session) return false;

    const identity = this.getSessionIdentity(session);

    const teacherTwitches = CLASSROOM_TEACHER_TWITCH_USERS.map((item) => this.normalize(item));
    const teacherNames = CLASSROOM_TEACHER_NAMES.map((item) => this.normalizeName(item));

    return teacherTwitches.includes(identity.twitch) || teacherNames.includes(identity.name);
  },

  getAssignedRole(session) {
    if (!session) return null;

    const identity = this.getSessionIdentity(session);

    const match = this.getAssignments().find((item) => {
      const itemTwitch = this.normalize(item.twitch);
      const itemDni = this.normalizeDni(item.dni);

      return itemTwitch === identity.twitch && itemDni === identity.dni;
    });

    return match?.role || null;
  },

  isModeratorSession(session) {
    return this.getAssignedRole(session) === "moderator";
  },

  apply(session) {
    if (!session) return session;

    if (this.isTeacherSession(session)) {
      session.role = "teacher";
      session.roleLabel = "Docente";
      return session;
    }

    if (this.isModeratorSession(session)) {
      session.role = "moderator";
      session.roleLabel = "Moderador";
      return session;
    }

    session.role = "student";
    session.roleLabel = "Alumno";

    return session;
  },

  save(session) {
    if (!session) return;
    localStorage.setItem(this.storageKey, JSON.stringify(session));
  },

  getRawSession() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  },

  refreshCurrentSession() {
    const session = this.apply(this.getRawSession());

    if (!session) return null;

    this.save(session);
    return session;
  },

  isCurrentTeacher() {
    return this.isTeacherSession(this.getRawSession());
  },

  isCurrentModerator() {
    return this.isModeratorSession(this.getRawSession());
  },

  isCurrentStaff() {
    return this.isCurrentTeacher() || this.isCurrentModerator();
  },

  paintRole() {
    const session = this.refreshCurrentSession();

    if (!session) return;

    document.body.classList.toggle("role-teacher", session.role === "teacher");
    document.body.classList.toggle("role-moderator", session.role === "moderator");
    document.body.classList.toggle("role-student", session.role === "student");

    document.querySelectorAll("[data-auth-role]").forEach((item) => {
      item.textContent = session.roleLabel || "Alumno";
    });
  },

  init() {
    this.paintRole();
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomRoles.init();
});

/* === Moderator Dedupe Roles Fix 20260622 === */
(function moderatorDedupeRolesFix() {
  "use strict";

  function normTwitch(value) {
    return String(value || "").trim().toLowerCase().replace(/^@+/, "");
  }

  function normDni(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function dedupe(list) {
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
        const key = `${item.twitch}::${item.dni}`;

        if (!item.twitch || !item.dni || seen.has(key)) return false;

        seen.add(key);
        return true;
      });
  }

  function patchRoles() {
    const roles = window.ClassroomRoles;

    if (!roles || roles.__moderatorDedupePatched) return;

    roles.__moderatorDedupePatched = true;

    ["getAssignedRoles", "getModeratorAssignments", "getAssignedRoleEntries"].forEach((methodName) => {
      if (typeof roles[methodName] !== "function") return;

      const original = roles[methodName].bind(roles);

      roles[methodName] = function patchedRoleList(...args) {
        return dedupe(original(...args));
      };
    });

    if (typeof roles.getAssignedRoleForSession === "function") {
      const originalGetForSession = roles.getAssignedRoleForSession.bind(roles);

      roles.getAssignedRoleForSession = function patchedGetAssignedRoleForSession(session, ...args) {
        const result = originalGetForSession(session, ...args);

        if (result) {
          return {
            ...result,
            twitch: normTwitch(result.twitch),
            dni: normDni(result.dni),
            role: result.role || "moderator",
            roleLabel: result.roleLabel || "Moderador",
          };
        }

        return result;
      };
    }
  }

  function normalizeCurrentSession() {
    try {
      const key = "andyazh-classroom-session";
      const session = JSON.parse(localStorage.getItem(key) || "null");

      if (!session) return;

      const role = String(session.role || "").toLowerCase();

      if (role === "classroom_moderator") {
        session.role = "moderator";
        session.roleLabel = session.roleLabel || "Moderador";
        localStorage.setItem(key, JSON.stringify(session));
      }
    } catch {}
  }

  function init() {
    normalizeCurrentSession();

    setTimeout(patchRoles, 50);
    setTimeout(patchRoles, 300);
    setTimeout(patchRoles, 1000);
  }

  window.ClassroomModeratorRolesDedupeFix = {
    patch: patchRoles,
    dedupe,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
