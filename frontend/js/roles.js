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

  isTeacherSession(session) {
    if (!session) return false;

    const twitch = this.normalize(session.twitch || session.alumno?.["Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)"]);
    const name = this.normalizeName(session.displayName || session.alumno?.["Nombre Completo"]);

    const teacherTwitches = CLASSROOM_TEACHER_TWITCH_USERS.map((item) => this.normalize(item));
    const teacherNames = CLASSROOM_TEACHER_NAMES.map((item) => this.normalizeName(item));

    return teacherTwitches.includes(twitch) || teacherNames.includes(name);
  },

  apply(session) {
    if (!session) return session;

    if (this.isTeacherSession(session)) {
      session.role = "teacher";
      session.roleLabel = "Docente";
    }

    return session;
  },

  save(session) {
    localStorage.setItem(this.storageKey, JSON.stringify(session));
  },

  getSession() {
    if (typeof ClassroomAuth === "undefined") return null;

    const session = ClassroomAuth.getSession?.();

    if (!session) return null;

    const updated = this.apply(session);
    this.save(updated);

    return updated;
  },

  isCurrentTeacher() {
    return this.isTeacherSession(this.getSession());
  },

  paintRole() {
    const session = this.getSession();

    if (!session) return;

    document.body.classList.toggle("role-teacher", session.role === "teacher");
    document.body.classList.toggle("role-student", session.role !== "teacher");

    document.querySelectorAll("[data-auth-role]").forEach((item) => {
      item.textContent = session.roleLabel || "Alumno";
    });
  },

  patchAuth() {
    if (typeof ClassroomAuth === "undefined") return;

    if (ClassroomAuth.__rolesPatched) return;
    ClassroomAuth.__rolesPatched = true;

    const originalLogin = ClassroomAuth.loginWithStudent?.bind(ClassroomAuth);
    const originalGetSession = ClassroomAuth.getSession?.bind(ClassroomAuth);

    if (originalGetSession) {
      ClassroomAuth.getSession = () => {
        const session = originalGetSession();

        if (!session) return null;

        return this.apply(session);
      };
    }

    if (originalLogin) {
      ClassroomAuth.loginWithStudent = async (...args) => {
        const session = await originalLogin(...args);
        const updated = this.apply(session);

        this.save(updated);

        return updated;
      };
    }
  },

  init() {
    this.patchAuth();
    this.paintRole();
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomRoles.init();
});
