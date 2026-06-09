/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — auth.js
   Autenticación temporal local para MVP estático en GitHub Pages
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomAuth = {
  storageKey: "andyazh-classroom-session",

  getSession() {
    try {
      const rawSession = localStorage.getItem(this.storageKey);
      return rawSession ? JSON.parse(rawSession) : null;
    } catch (error) {
      return null;
    }
  },

  setSession(session) {
    localStorage.setItem(this.storageKey, JSON.stringify(session));
  },

  clearSession() {
    localStorage.removeItem(this.storageKey);
  },

  isAuthenticated() {
    const session = this.getSession();
    return Boolean(session && session.email && session.role);
  },

  requireAuth() {
    if (this.isAuthenticated()) return;

    const currentPath = window.location.pathname.split("/").pop() || "index.html";

    if (currentPath === "login.html") return;

    window.location.replace("login.html");
  },

  redirectIfAuthenticated() {
    if (!this.isAuthenticated()) return;

    window.location.replace("index.html");
  },

  login(email, role) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanRole = String(role || "student").trim();

    if (!cleanEmail) {
      return {
        ok: false,
        message: "Ingresá un correo válido.",
      };
    }

    const roleLabels = {
      student: "Alumno",
      teacher: "Docente",
      admin: "Administrador",
    };

    const session = {
      email: cleanEmail,
      role: cleanRole,
      roleLabel: roleLabels[cleanRole] || "Alumno",
      displayName: cleanEmail.split("@")[0],
      createdAt: new Date().toISOString(),
      provider: "local-mvp",
    };

    this.setSession(session);

    return {
      ok: true,
      session,
    };
  },

  logout() {
    this.clearSession();
    window.location.replace("login.html");
  },

  paintUser() {
    const session = this.getSession();

    if (!session) return;

    const nameTargets = document.querySelectorAll("[data-auth-name]");
    const roleTargets = document.querySelectorAll("[data-auth-role]");

    nameTargets.forEach((target) => {
      target.textContent = session.displayName || session.email;
    });

    roleTargets.forEach((target) => {
      target.textContent = session.roleLabel || session.role;
    });
  },

  bindLogout() {
    const logoutButtons = document.querySelectorAll("[data-auth-logout]");

    logoutButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.logout();
      });
    });
  },

  initProtectedPage() {
    this.requireAuth();
    this.paintUser();
    this.bindLogout();
  },
};
