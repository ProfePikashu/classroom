/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — roles.js
   Backend-authoritative roles & permissions
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

const ClassroomRoles = {
  storageKey: "andyazh-classroom-session",

  normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  },

  normalizeDni(value) {
    return String(value || "")
      .replace(/\D/g, "")
      .trim();
  },

  normalizeName(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  },

  getRawSession() {
    try {
      const raw = localStorage.getItem(this.storageKey);

      return raw
        ? JSON.parse(raw)
        : null;
    } catch {
      return null;
    }
  },

  save(session) {
    if (!session) return;

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(session)
    );
  },

  getSessionIdentity(session) {
    const alumno = session?.alumno || {};

    return {
      twitch: this.normalize(
        session?.twitch ||
        alumno[
          "Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)"
        ] ||
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

  isTeacherSession(session) {
    if (!session) return false;

    const role = String(
      session.role || ""
    ).trim().toLowerCase();

    const backendRole = String(
      session.backendRole ||
      session.exampro?.role ||
      ""
    ).trim().toLowerCase();

    if (
      role === "teacher" ||
      role === "docente" ||
      backendRole === "docente"
    ) {
      return true;
    }

    /*
      Fallback de compatibilidad para la cuenta docente histórica.
      Los moderadores NO se resuelven aquí.
    */
    const identity =
      this.getSessionIdentity(session);

    const teacherTwitches =
      CLASSROOM_TEACHER_TWITCH_USERS.map(
        (item) => this.normalize(item)
      );

    const teacherNames =
      CLASSROOM_TEACHER_NAMES.map(
        (item) => this.normalizeName(item)
      );

    return (
      teacherTwitches.includes(identity.twitch) ||
      teacherNames.includes(identity.name)
    );
  },

  isModeratorSession(session) {
    if (!session) return false;

    const role = String(
      session.role || ""
    ).trim().toLowerCase();

    const backendRole = String(
      session.backendRole ||
      session.exampro?.role ||
      ""
    ).trim().toLowerCase();

    const provider = String(
      session.provider || ""
    ).trim().toLowerCase();

    return (
      role === "moderator" ||
      role === "classroom_moderator" ||
      backendRole === "classroom_moderator" ||
      provider === "exampro-moderator-login"
    );
  },

  getPermissions(session = null) {
    const target =
      session ||
      this.getRawSession();

    if (!target) return {};

    if (this.isTeacherSession(target)) {
      return {
        "students.view": true,
        "students.edit": true,
        "students.withdraw": true,

        "attendance.view": true,
        "attendance.token.create": true,
        "attendance.validate": true,
        "attendance.edit": true,

        "withdrawals.view": true,
        "notifications.manage": true,
        "community.moderate": true,
        "roles.manage": true,
      };
    }

    const permissions =
      target.permissions;

    if (
      !permissions ||
      typeof permissions !== "object" ||
      Array.isArray(permissions)
    ) {
      return {};
    }

    return {
      ...permissions,
    };
  },

  hasPermission(permission, session = null) {
    const target =
      session ||
      this.getRawSession();

    if (!target) return false;

    if (this.isTeacherSession(target)) {
      return true;
    }

    return Boolean(
      this.getPermissions(target)?.[permission]
    );
  },

  currentHasPermission(permission) {
    return this.hasPermission(
      permission,
      this.getRawSession()
    );
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
      session.roleLabel =
        session.roleLabel ||
        "Moderador";

      return session;
    }

    session.role = "student";
    session.roleLabel = "Alumno";

    return session;
  },

  refreshCurrentSession() {
    const session =
      this.apply(
        this.getRawSession()
      );

    if (!session) return null;

    this.save(session);

    return session;
  },

  async refreshPermissionsFromBackend() {
    const session = this.getRawSession();
    if (!session) return null;

    const token =
      session.classroomReadToken ||
      session.exampro?.accessToken ||
      session.access_token ||
      session.accessToken ||
      session.token ||
      "";

    if (!token) return session;

    const apiBase =
      session.exampro?.apiBase ||
      (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.protocol === "file:"
          ? "http://127.0.0.1:8000"
          : "https://api.andyazhtec.com"
      );

    try {
      const response = await fetch(
        `${apiBase}/api/classroom/me/permissions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          session.permissions = {};
          this.save(session);
          this.paintRole();
        }

        return session;
      }

      const data = await response.json();

      session.permissions =
        data?.permissions &&
        typeof data.permissions === "object"
          ? data.permissions
          : {};

      if (data?.roleLabel) {
        session.roleLabel = data.roleLabel;
      }

      if (data?.displayName) {
        session.displayName = data.displayName;
      }

      this.save(session);
      this.paintRole();

      return session;
    } catch (error) {
      console.warn(
        "No se pudieron refrescar los permisos Classroom:",
        error
      );

      return session;
    }
  },
  isCurrentTeacher() {
    return this.isTeacherSession(
      this.getRawSession()
    );
  },

  isCurrentModerator() {
    return this.isModeratorSession(
      this.getRawSession()
    );
  },

  isCurrentStaff() {
    return (
      this.isCurrentTeacher() ||
      this.isCurrentModerator()
    );
  },

  /*
    Compatibilidad temporal.

    Ya NO existe una lista local de asignaciones.
    El backend es la única fuente de verdad.
  */
  getAssignments() {
    return [];
  },

  saveAssignments() {
    console.warn(
      "[Classroom] saveAssignments está obsoleto. Los roles se administran desde el backend."
    );

    return false;
  },

  getAssignedRole() {
    return null;
  },

  paintRole() {
    const session =
      this.refreshCurrentSession();

    if (!session) return;

    document.body.classList.toggle(
      "role-teacher",
      session.role === "teacher"
    );

    document.body.classList.toggle(
      "role-moderator",
      session.role === "moderator"
    );

    document.body.classList.toggle(
      "role-student",
      session.role === "student"
    );

    document
      .querySelectorAll("[data-auth-role]")
      .forEach((item) => {
        item.textContent =
          session.roleLabel ||
          "Alumno";
      });
  },

  init() {
    this.paintRole();
    void this.refreshPermissionsFromBackend();
  },
};

document.addEventListener(
  "DOMContentLoaded",
  () => ClassroomRoles.init()
);