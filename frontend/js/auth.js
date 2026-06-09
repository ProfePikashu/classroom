/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — auth.js
   Login MVP por DNI + Twitch contra verificador AyRPC
════════════════════════════════════════════════════════ */

"use strict";

const CLASSROOM_VERIFY_API = "https://script.google.com/macros/s/AKfycbxdB1fbiT1S04N5LaiOqHCojJcO12YCOPg7ln21bFrMrEot5GSdyWzy6j6CyEAsuDen/exec";

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
    return Boolean(session && session.dni && session.twitch);
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

  normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
  },

  async loginWithStudent(dni, twitch) {
    const cleanDni = String(dni || "").trim();
    const cleanTwitch = this.normalize(twitch);

    if (!cleanDni || !cleanTwitch) {
      return {
        ok: false,
        message: "Ingresá DNI y usuario de Twitch.",
      };
    }

    try {
      const response = await fetch(CLASSROOM_VERIFY_API + "?dni=" + encodeURIComponent(cleanDni));
      const alumno = await response.json();

      if (!alumno || !alumno["Nombre Completo"]) {
        return {
          ok: false,
          message: "No se encontró un alumno con ese DNI.",
        };
      }

      if (alumno.estado === "BAJA") {
        return {
          ok: false,
          message: "El alumno figura dado de baja.",
        };
      }

      const twitchSheet = this.normalize(
        alumno["Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)"]
      );

      if (twitchSheet !== cleanTwitch) {
        return {
          ok: false,
          message: "El usuario de Twitch no coincide con el DNI ingresado.",
        };
      }

      const session = {
        dni: cleanDni,
        twitch: cleanTwitch,
        email: alumno["Correo"] || "",
        displayName: alumno["Nombre Completo"] || cleanTwitch,
        role: "student",
        roleLabel: "Alumno",
        course: "AyRPC 2025",
        alumno,
        createdAt: new Date().toISOString(),
        provider: "sheet-mvp",
      };

      this.setSession(session);

      return {
        ok: true,
        session,
      };
    } catch (error) {
      return {
        ok: false,
        message: "No se pudo validar el acceso. Intentá de nuevo.",
      };
    }
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
      target.textContent = session.displayName || session.twitch || "Usuario";
    });

    roleTargets.forEach((target) => {
      target.textContent = session.roleLabel || "Alumno";
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
