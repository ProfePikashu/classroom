/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — perfil-core.js
   Datos de perfil y cursadas. Las solicitudes de cambio
   viven en scripts separados para evitar handlers legacy.
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomProfile = {
  async init() {
    if (typeof ClassroomAuth === "undefined") return;

    const session = ClassroomAuth.getSession();
    if (!session) return;

    this.paintCoursesLoading();
    await this.loadLiveProfile(session);
  },

  get apiBase() {
    return typeof EXAMPRO_API_BASE !== "undefined"
      ? EXAMPRO_API_BASE
      : "https://api.andyazhtec.com";
  },

  getToken(session) {
    return (
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      session?.exampro?.token ||
      session?.access_token ||
      session?.token ||
      session?.accessToken ||
      ""
    );
  },

  async fetchProfile(token) {
    const response = await fetch(`${this.apiBase}/api/classroom/me/profile`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.detail || "No se pudo cargar el perfil.");
    }

    return data;
  },

  async loadLiveProfile(session) {
    const token = this.getToken(session);

    if (!token) {
      this.paintCoursesError("No hay una sesión válida para consultar el perfil.");
      return;
    }

    try {
      const data = await this.fetchProfile(token);
      const student = data?.student || {};
      const enrollments = Array.isArray(data?.enrollments) ? data.enrollments : [];

      this.paintStudent(student, session);

      const updatedSession = {
        ...session,
        displayName: student.full_name || session.displayName || "",
        dni: student.dni || session.dni || "",
        email: student.email || session.email || "",
        telefono: student.phone || session.telefono || "",
        twitch: student.twitch || session.twitch || "",
      };

      ClassroomAuth.setSession(updatedSession);

      if (!enrollments.length) {
        this.paintCoursesError("No se encontraron cursadas asociadas a este usuario.");
        return;
      }

      this.renderCourses(enrollments, updatedSession);
    } catch (error) {
      console.warn("No se pudo cargar el perfil dinámico:", error);
      this.paintCoursesError("No se pudieron cargar las cursadas en este momento.");
    }
  },

  paintStudent(student, session) {
    this.setText("profileHeroName", student.full_name || session.displayName || "{ASIGNAR DATO}");
    this.setText("profileName", student.full_name || session.displayName || "{ASIGNAR DATO}");
    this.setText("profileDni", student.dni || session.dni || "{ASIGNAR DATO}");
    this.setText("profileEmail", student.email || session.email || "{ASIGNAR DATO}");
    this.setText("profilePhone", student.phone || session.telefono || "{ASIGNAR DATO}");
    this.setText("profileTwitch", student.twitch || session.twitch || "{ASIGNAR DATO}");
    this.setText("profileObservations", student.observations || "-");
  },

  paintCoursesLoading() {
    const panel = document.getElementById("profileCourse")?.closest("article.panel");
    if (!panel) return;

    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <p class="eyebrow">Cursadas</p>
          <h3>Cargando...</h3>
        </div>
      </div>
    `;
  },

  paintCoursesError(message) {
    const panel = document.querySelector(".profile-grid article.panel:nth-child(2)");
    if (!panel) return;

    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <p class="eyebrow">Cursadas</p>
          <h3>${this.escapeHtml(message)}</h3>
        </div>
      </div>
    `;
  },

  renderCourses(enrollments, session) {
    const panel = document.querySelector(".profile-grid article.panel:nth-child(2)");
    if (!panel) return;

    const role = session.roleLabel || "Alumno";

    panel.innerHTML = enrollments.map((enrollment) => {
      const course = enrollment?.course || {};
      const academic = enrollment?.academic || {};
      const courseSlug = String(course.slug || "").trim();
      const courseTitle = /^ayrpc-\d{4}$/i.test(courseSlug) && course.year
        ? `AyRPC ${course.year}`
        : course.name || courseSlug || "Cursada";

      const validClasses = Number(academic.valid_classes ?? 0);
      const totalClasses = Number(academic.total_classes ?? 0);
      const finalStatus = String(academic.final_status || "").toLowerCase();

      let examStatus = "No apto";
      if (academic.exam_eligible === true) {
        examStatus = "Apto";
      } else if (
        String(course.status || "").toLowerCase() === "active" &&
        finalStatus === "pending" &&
        validClasses === 0
      ) {
        examStatus = "Pendiente";
      }

      const result = this.formatFinalStatus(finalStatus);
      const enrollmentStatus = this.formatEnrollmentStatus(enrollment.status);
      const href = courseSlug ? `curso-${courseSlug}.html` : "courses.html";

      return `
        <div class="profile-course-block">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Cursada</p>
              <h3>${this.escapeHtml(courseTitle)}</h3>
            </div>
          </div>

          <div class="profile-data-grid">
            <div><span>Curso</span><strong>${this.escapeHtml(courseTitle)}</strong></div>
            <div><span>Estado</span><strong>${this.escapeHtml(enrollmentStatus)}</strong></div>
            <div><span>Clases válidas</span><strong>${validClasses}/${totalClasses}</strong></div>
            <div><span>APTO examen</span><strong>${this.escapeHtml(examStatus)}</strong></div>
            <div><span>Resultado</span><strong>${this.escapeHtml(result)}</strong></div>
            <div><span>Rol en Classroom</span><strong>${this.escapeHtml(role)}</strong></div>
          </div>

          <div class="home-actions-row">
            <a href="${this.escapeHtml(href)}" class="btn btn-primary">
              <i class="fa-solid fa-magnifying-glass-chart"></i>
              Ver estado completo
            </a>
          </div>
        </div>
      `;
    }).join("");
  },

  formatEnrollmentStatus(value) {
    const status = String(value || "").toLowerCase();
    const labels = {
      active: "Activa",
      completed: "Completada",
      finished: "Finalizada",
      inactive: "Inactiva",
      withdrawn: "Baja registrada",
    };

    return labels[status] || value || "Sin estado";
  },

  formatFinalStatus(value) {
    const labels = {
      pending: "Pendiente",
      eligible: "Habilitado",
      passed: "Aprobado",
      failed: "Desaprobado",
      withdrawn: "Baja registrada",
    };

    return labels[value] || "Pendiente";
  },

  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomProfile.init();
});
