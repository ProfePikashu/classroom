/* ============================================================
   AndyAzhTEC Classroom — auth.js
   Login por DNI + Twitch contra Classroom
   ============================================================ */

"use strict";

/*
  Local:
    http://127.0.0.1:8000

  Producción:
    https://api.andyazhtec.com
*/
const EXAMPRO_API_BASE = (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.protocol === "file:"
)
  ? "http://127.0.0.1:8000"
  : "https://api.andyazhtec.com";


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

    if (!session?.dni || !session?.twitch) {
      return false;
    }

    const token =
      session.classroomReadToken ||
      session.exampro?.accessToken ||
      session.access_token ||
      session.accessToken ||
      session.token ||
      "";

    if (!token) {
      return false;
    }

    try {
      const parts = token.split(".");

      if (parts.length !== 3) {
        return false;
      }

      const payloadPart = parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      const paddedPayload =
        payloadPart +
        "=".repeat((4 - (payloadPart.length % 4)) % 4);

      const payload = JSON.parse(atob(paddedPayload));

      if (!payload.exp) {
        return false;
      }

      const expiresAt = Number(payload.exp) * 1000;
      const safetyMargin = 30 * 1000;

      return Date.now() < (expiresAt - safetyMargin);
    } catch (_) {
      return false;
    }
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

  async tryModeratorLogin(cleanDni, cleanTwitch) {
    try {
      const response = await fetch(
        `${EXAMPRO_API_BASE}/api/classroom/moderator-login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dni: cleanDni,
            twitch: cleanTwitch,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (
        !response.ok ||
        !data?.ok ||
        !data?.access_token
      ) {
        return null;
      }

      const displayName =
        String(
          data.displayName ||
          data.display_name ||
          cleanTwitch
        ).trim();

      const permissions =
        data.permissions &&
        typeof data.permissions === "object" &&
        !Array.isArray(data.permissions)
          ? data.permissions
          : {};

      const session = {
        dni:
          data.dni ||
          cleanDni,

        twitch:
          data.twitch ||
          cleanTwitch,

        email: "",

        displayName:
          displayName ||
          cleanTwitch,

        role: "moderator",

        roleLabel:
          data.roleLabel ||
          data.role_label ||
          "Moderador",

        backendRole:
          data.role ||
          "classroom_moderator",

        permissions,

        course: "Classroom",

        alumno: {
          DNI:
            data.dni ||
            cleanDni,

          Correo: "",

          "Nombre Completo":
            displayName ||
            cleanTwitch,

          "Usuario de Twitch":
            data.twitch ||
            cleanTwitch,

          "Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)":
            data.twitch ||
            cleanTwitch,
        },

        exampro: {
          apiBase: EXAMPRO_API_BASE,
          portalUrl:
            data.portal_url ||
            "/portal",
          studentId: null,
          accessToken:
            data.access_token,
        },

        classroomReadToken:
          data.access_token,

        createdAt:
          new Date().toISOString(),

        provider:
          "exampro-moderator-login",
      };

      this.setSession(session);

      return {
        ok: true,
        session,
      };

    } catch {
      return null;
    }
  },

  async loginWithSheetFallback(cleanDni, cleanTwitch, originalMessage = "") {
    return {
      ok: false,
      message: originalMessage || "No se pudo validar el acceso con Classroom.",
    };
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
    const moderatorLogin = await this.tryModeratorLogin(
      cleanDni,
      cleanTwitch
    );

    if (moderatorLogin) {
      return moderatorLogin;
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
        return await this.loginWithSheetFallback(
          cleanDni,
          cleanTwitch,
          data?.detail || data?.message || "No se pudo validar el acceso con ExamPro."
        );
      }

      const student = data.student || {};
      const fullName = String(student.full_name || "").trim();

      const courses = Array.isArray(student.cursos)
        ? [...new Set(
            student.cursos
              .map(course => String(course || "").trim())
              .filter(Boolean)
          )]
        : [];

      const currentCourse =
        String(student.cursada || "").trim() ||
        (courses.length ? courses[courses.length - 1] : "Classroom");

      const alumno = {
        DNI: student.dni || cleanDni,
        Correo: student.email || "",
        Telefono: student.telefono || "",
        "Teléfono (con Código de Área)": student.telefono || "",
        "Nombre Completo": fullName || cleanTwitch,
        "Usuario de Twitch": student.twitch || cleanTwitch,
        "Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)": student.twitch || cleanTwitch,
      };

      const session = {
        dni: student.dni || cleanDni,
        twitch: student.twitch || cleanTwitch,
        email: student.email || "",
        telefono: student.telefono || "",
        displayName: fullName || cleanTwitch,
        role:
          data.role === "alumno"
            ? "student"
            : data.role === "classroom_moderator"
              ? "moderator"
              : data.role === "docente"
                ? "teacher"
                : data.role || "student",
        roleLabel:
          data.roleLabel ||
          data.role_label ||
          (data.role === "classroom_moderator"
            ? "Moderador"
            : data.role === "docente"
              ? "Docente"
              : "Alumno"),
        backendRole: data.role || "alumno",
        course: currentCourse,
        courses,
        alumno,
        exampro: {
          apiBase: EXAMPRO_API_BASE,
          portalUrl: data.portal_url || "/portal",
          studentId: student.id || null,
          accessToken:
            data.access_token ||
            data.token ||
            data.jwt ||
            data.session_token ||
            "",
        },
        classroomReadToken:
          data.access_token ||
          data.token ||
          data.jwt ||
          data.session_token ||
          "",
        createdAt: new Date().toISOString(),
        provider: "exampro-api",
      };

      this.setSession(session);

      return {
        ok: true,
        session,
      };
    } catch (error) {
      return await this.loginWithSheetFallback(
        cleanDni,
        cleanTwitch,
        "No se pudo conectar con Classroom. Verifica la conexion e intentalo nuevamente."
      );
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
