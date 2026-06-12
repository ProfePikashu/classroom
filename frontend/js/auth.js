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

const CLASSROOM_SHEET_2025_API = "https://script.google.com/macros/s/AKfycbxajMTyRA6SBGeMYDikKlN2nrmONnlPYG88iDNVsYt-fE-ooH6XYW3wT6N5EV3FVxxU/exec";

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

  findClassroomModerator(cleanDni, cleanTwitch) {
    if (typeof ClassroomRoles === "undefined") return null;

    const assignments = ClassroomRoles.getAssignments();

    return assignments.find((item) => {
      const itemTwitch = ClassroomRoles.normalize(item.twitch);
      const itemDni = ClassroomRoles.normalizeDni(item.dni);

      return item.role === "moderator" && itemTwitch === cleanTwitch && itemDni === cleanDni;
    }) || null;
  },

  async buildClassroomModeratorSession(cleanDni, cleanTwitch, assignment) {
    const displayName = assignment?.displayName || assignment?.name || cleanTwitch;

    let classroomReadToken = "";

    try {
      const response = await fetch(`${EXAMPRO_API_BASE}/api/classroom/moderator-login`, {
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

      if (response.ok && data?.ok && data?.access_token) {
        classroomReadToken = data.access_token;
      }
    } catch (error) {
      classroomReadToken = "";
    }

    const session = {
      dni: cleanDni,
      twitch: cleanTwitch,
      email: "",
      displayName,
      role: "moderator",
      roleLabel: assignment?.roleLabel || "Moderador",
      course: "Classroom",
      alumno: {
        DNI: cleanDni,
        Correo: "",
        "Nombre Completo": displayName,
        "Usuario de Twitch": cleanTwitch,
        "Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)": cleanTwitch,
      },
      exampro: null,
      classroomReadToken,
      createdAt: new Date().toISOString(),
      provider: "classroom-local-moderator",
    };

    this.setSession(session);

    return {
      ok: true,
      session,
    };
  },

  getSheetValue(data, keys, fallback = "") {
    for (const key of keys) {
      const value = data?.[key];

      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }

    return fallback;
  },

  getSheetTwitch(data) {
    return this.normalize(
      this.getSheetValue(data, [
        "Usuario de Twitch",
        "Usuario Twitch",
        "Twitch",
        "TWITCH",
        "Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)",
        "twitch",
        "twitch_username",
      ])
    );
  },

  async loginWithSheetFallback(cleanDni, cleanTwitch, originalMessage = "") {
    try {
      const response = await fetch(`${CLASSROOM_SHEET_2025_API}?dni=${encodeURIComponent(cleanDni)}`, {
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || data.error || data.estado === "BAJA") {
        return {
          ok: false,
          message: originalMessage || "No se pudo validar el acceso con ExamPro ni con Planilla 2025.",
        };
      }

      const sheetTwitch = this.getSheetTwitch(data);

      if (!sheetTwitch || sheetTwitch !== cleanTwitch) {
        return {
          ok: false,
          message: "El DNI figura en Planilla 2025, pero el usuario de Twitch no coincide.",
        };
      }

      const fullName = this.getSheetValue(data, [
        "Nombre Completo",
        "Nombre completo",
        "NOMBRE COMPLETO",
        "Alumno",
        "ALUMNO",
        "Nombre",
        "NOMBRE",
      ], cleanTwitch);

      const email = this.getSheetValue(data, [
        "Correo",
        "Correo electrónico",
        "Correo Electronico",
        "Email",
        "EMAIL",
        "Mail",
        "MAIL",
      ], "");

      const session = {
        dni: this.getSheetValue(data, ["DNI", "dni"], cleanDni),
        twitch: cleanTwitch,
        email,
        displayName: fullName,
        role: "student",
        roleLabel: "Alumno",
        course: "AyRPC 2025",
        alumno: {
          ...data,
          DNI: this.getSheetValue(data, ["DNI", "dni"], cleanDni),
          Correo: email,
          "Nombre Completo": fullName,
          "Usuario de Twitch": cleanTwitch,
          "Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)": cleanTwitch,
        },
        exampro: null,
        createdAt: new Date().toISOString(),
        provider: "planilla-ayrpc-2025",
      };

      this.setSession(session);

      return {
        ok: true,
        session,
      };
    } catch (error) {
      return {
        ok: false,
        message: originalMessage || "No se pudo conectar con ExamPro ni con Planilla 2025.",
      };
    }
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

    const classroomModerator = this.findClassroomModerator(cleanDni, cleanTwitch);

    if (classroomModerator) {
      return await this.buildClassroomModeratorSession(cleanDni, cleanTwitch, classroomModerator);
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
      return await this.loginWithSheetFallback(
        cleanDni,
        cleanTwitch,
        "No se pudo conectar con ExamPro. Se intentó validar contra Planilla 2025."
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
