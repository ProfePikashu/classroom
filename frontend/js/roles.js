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

const CLASSROOM_MODERATOR_TWITCH_USERS = [
  "moderador_1",
  "moderador_2",
];

const CLASSROOM_MODERATOR_NAMES = [
  "NOMBRE MODERADOR 1",
  "NOMBRE MODERADOR 2",
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

      name: this.normalizeName(
        session?.displayName ||
        alumno["Nombre Completo"] ||
        alumno["Nombre"]
      ),
    };
  },

  isTeacherSession(session) {
    if (!session) return false;

    const identity = this.getSessionIdentity(session);

    const teacherTwitches = CLASSROOM_TEACHER_TWITCH_USERS.map((item) => this.normalize(item));
    const teacherNames = CLASSROOM_TEACHER_NAMES.map((item) => this.normalizeName(item));

    return teacherTwitches.includes(identity.twitch) || teacherNames.includes(identity.name);
  },

  isModeratorSession(session) {
    if (!session) return false;

    const identity = this.getSessionIdentity(session);

    const moderatorTwitches = CLASSROOM_MODERATOR_TWITCH_USERS.map((item) => this.normalize(item));
    const moderatorNames = CLASSROOM_MODERATOR_NAMES.map((item) => this.normalizeName(item));

    return moderatorTwitches.includes(identity.twitch) || moderatorNames.includes(identity.name);
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

    session.role = session.role || "student";
    session.roleLabel = session.roleLabel || "Alumno";

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
