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
    try {
      const raw = localStorage.getItem(this.assignmentsKey);
      const parsed = raw ? JSON.parse(raw) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
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
