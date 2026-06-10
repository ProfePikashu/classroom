/* ============================================================
   AndyAzhTEC Classroom — auth.js
   Login por DNI + Twitch contra ExamPro
   ============================================================ */

"use strict";

/*
  Local:
    http://127.0.0.1:8000

  Producción:
    https://exampro-backend-1n6d.onrender.com
*/
const EXAMPRO_API_BASE = (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.protocol === "file:"
)
  ? "http://127.0.0.1:8000"
  : "https://exampro-backend-1n6d.onrender.com";

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

  normalizeDni(value) {
    return String(value || "")
      .trim()
      .replace(/\./g, "")
      .replace(/\s+/g, "");
  },

  async loginWithStudent(dni, twitch) {
    const cleanDni = this.normalizeDni(dni);
    const cleanTwitch = this.normalize(twitch);

    if (!cleanDni || !cleanTwitch) {
      return {
        ok: false,
        message: "Ingresá DNI y usuario de Twitch.",
      };
    }

    try {
      const response = await fetch(`${EXAMPRO_API_BASE}/api/classroom/student-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dni: cleanDni,
          twitch: cleanTwitch,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || !data.ok) {
        return {
          ok: false,
          message:
            data?.detail ||
            data?.message ||
            "No se pudo validar el acceso con ExamPro.",
        };
      }

      const student = data.student || {};
      const fullName = [student.nombre, student.apellido]
        .filter(Boolean)
        .join(" ")
        .trim();

      const alumno = {
        DNI: student.dni || cleanDni,
        Correo: student.email || "",
        "Nombre Completo": fullName || cleanTwitch,
        "Usuario de Twitch": student.twitch || cleanTwitch,
        "Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)": student.twitch || cleanTwitch,
      };

      const session = {
        dni: student.dni || cleanDni,
        twitch: student.twitch || cleanTwitch,
        email: student.email || "",
        displayName: fullName || cleanTwitch,
        role: data.role === "alumno" ? "student" : data.role || "student",
        roleLabel: data.role === "alumno" ? "Alumno" : "Alumno",
        course: "AyRPC 2025",
        alumno,
        exampro: {
          apiBase: EXAMPRO_API_BASE,
          portalUrl: data.portal_url || "/portal",
          studentId: student.id || null,
        },
        createdAt: new Date().toISOString(),
        provider: "exampro-api",
      };

      this.setSession(session);

      return {
        ok: true,
        session,
      };
    } catch (error) {
      return {
        ok: false,
        message: "No se pudo conectar con ExamPro. Verificá que el backend esté levantado.",
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
