/* ============================================================
   AndyAzhTEC Classroom — alumnos.js
   Listado tabular de alumnos desde ExamPro
   ============================================================ */

"use strict";

const ClassroomStudents = {
  apiBase:
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.protocol === "file:"
      ? "http://127.0.0.1:8000"
      : "https://exampro-backend-1n6d.onrender.com",

  limit: 40,
  offset: 0,
  total: 0,
  loading: false,
  currentSearch: "",
  students: [],

  init() {
    this.cacheDom();
    this.bindEvents();
    this.loadStudents(true);
  },

  cacheDom() {
    this.grid = document.getElementById("studentsGrid");
    this.status = document.getElementById("studentsStatus");
    this.totalTarget = document.getElementById("studentsTotal");
    this.shownTarget = document.getElementById("studentsShown");
    this.searchInput = document.getElementById("studentsSearchInput");
    this.refreshBtn = document.getElementById("studentsRefreshBtn");
    this.loadMoreBtn = document.getElementById("studentsLoadMoreBtn");
  },

  bindEvents() {
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener("click", () => {
        this.loadStudents(true);
      });
    }

    if (this.loadMoreBtn) {
      this.loadMoreBtn.addEventListener("click", () => {
        this.loadStudents(false);
      });
    }

    if (this.searchInput) {
      let timer = null;

      this.searchInput.addEventListener("input", () => {
        clearTimeout(timer);

        timer = setTimeout(() => {
          this.currentSearch = this.searchInput.value.trim();
          this.loadStudents(true);
        }, 350);
      });
    }
  },

  buildUrl(reset) {
    const offset = reset ? 0 : this.offset;

    const params = new URLSearchParams({
      only_aptos: "true",
      valid_only: "true",
      exclude_auto: "true",
      limit: String(this.limit),
      offset: String(offset),
    });

    if (this.currentSearch) {
      params.set("search", this.currentSearch);
    }

    return `${this.apiBase}/api/classroom/students?${params.toString()}`;
  },

  async loadStudents(reset = false) {
    if (this.loading) return;

    this.loading = true;
    this.setStatus("Cargando alumnos desde ExamPro...");

    if (this.loadMoreBtn) {
      this.loadMoreBtn.disabled = true;
    }

    try {
      const session =
        typeof ClassroomAuth !== "undefined"
          ? ClassroomAuth.getSession()
          : null;

      const headers = {};

      if (session?.classroomReadToken) {
        headers.Authorization = `Bearer ${session.classroomReadToken}`;
      }

      const response = await fetch(this.buildUrl(reset), { headers });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.detail || data.message || "No se pudo leer la lista de alumnos.");
      }

      if (reset) {
        this.offset = 0;
        this.students = [];
      }

      this.total = data.total || 0;

      const items = Array.isArray(data.items) ? data.items : [];

      this.students = reset ? items : this.students.concat(items);
      this.offset = this.students.length;

      this.renderTable();
      this.paintCounters();

      if (!this.students.length) {
        this.setStatus("No se encontraron alumnos con esos filtros.");
      } else {
        this.setStatus(`Mostrando ${this.offset} de ${this.total} alumnos.`);
      }

      if (this.loadMoreBtn) {
        this.loadMoreBtn.style.display = this.offset < this.total ? "inline-flex" : "none";
      }
    } catch (error) {
      console.error(error);
      this.setStatus("No se pudo conectar con ExamPro. Verificá que el backend esté levantado.");
    } finally {
      this.loading = false;

      if (this.loadMoreBtn) {
        this.loadMoreBtn.disabled = false;
      }
    }
  },

  paintCounters() {
    if (this.totalTarget) this.totalTarget.textContent = String(this.total);
    if (this.shownTarget) this.shownTarget.textContent = String(this.offset);
  },

  setStatus(message) {
    if (!this.status) return;
    this.status.textContent = message;
  },

  renderTable() {
    if (!this.grid) return;

    if (!this.students.length) {
      this.grid.innerHTML = "";
      return;
    }

    const rows = this.students
      .map((student, index) => this.createStudentRow(student, index))
      .join("");

    this.grid.innerHTML = `
      <div class="students-table-wrap">
        <table class="students-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Alumno</th>
              <th>DNI</th>
              <th>Twitch</th>
              <th>Teléfono</th>
              <th>Correo</th>
              <th>Cursada</th>
              <th>Estado</th>
              <th>Examen</th>
              <th>Recup.</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  },

  createStudentRow(student, index) {
    const name = student.full_name || student.nombre || student.twitch || "Alumno sin nombre";
    const twitch = student.twitch ? `@${String(student.twitch).replace(/^@/, "")}` : "—";
    const email = student.email || "";
    const phone = student.telefono || "";
    const dni = student.dni || "—";
    const cursada = student.cursada || "AyRPC 2025";
    const estado = this.formatStatus(student.apt_examen || student.estado || "apto");
    const examStatus = this.getExamStatus(student);
    const recoveryStatus = this.getRecoveryStatus(student);
    const mailHref = email ? `mailto:${encodeURIComponent(email)}` : "";
    const whatsappHref = this.getWhatsappHref(phone);

    return `
      <tr>
        <td class="students-table-index">${index + 1}</td>

        <td class="students-table-name-cell">
          <div class="students-table-student">
            <div class="student-table-avatar">
              <i class="fa-solid fa-user-graduate"></i>
            </div>

            <div>
              <strong>${this.escapeHtml(name)}</strong>
              <small>ExamPro ID: ${this.escapeHtml(student.id)}</small>
            </div>
          </div>
        </td>

        <td class="students-table-dni">${this.escapeHtml(dni)}</td>
        <td class="students-table-twitch">${this.escapeHtml(twitch)}</td>
        <td class="students-table-phone">${this.escapeHtml(phone || "—")}</td>
        <td class="students-table-email">${this.escapeHtml(email || "—")}</td>

        <td>
          <span class="student-badge course">
            ${this.escapeHtml(cursada)}
          </span>
        </td>

        <td>
          <span class="student-badge ${estado.className}">
            <i class="fa-solid ${estado.icon}"></i>
            ${this.escapeHtml(estado.label)}
          </span>
        </td>

        <td>
          <span class="student-badge ${examStatus.className}">
            <i class="fa-solid ${examStatus.icon}"></i>
            ${this.escapeHtml(examStatus.label)}
          </span>
        </td>

        <td>
          <span class="student-badge ${recoveryStatus.className}">
            <i class="fa-solid ${recoveryStatus.icon}"></i>
            ${this.escapeHtml(recoveryStatus.label)}
          </span>
        </td>

        <td>
          <div class="students-table-actions">
            <a class="btn btn-outline btn-table" href="alumno.html?id=${encodeURIComponent(student.id)}" title="Ver ficha">
              <i class="fa-solid fa-address-card"></i>
              <span>Ficha</span>
            </a>

            ${email ? `
              <a class="btn btn-outline btn-table btn-table-contact" href="${mailHref}" title="Enviar correo">
                <i class="fa-solid fa-envelope"></i>
                <span>Mail</span>
              </a>
            ` : `
              <span class="btn btn-outline btn-table btn-table-disabled" title="Sin correo">
                <i class="fa-solid fa-envelope"></i>
                <span>Mail</span>
              </span>
            `}

            ${whatsappHref ? `
              <a class="btn btn-outline btn-table btn-table-contact" href="${whatsappHref}" target="_blank" rel="noopener" title="Contactar por WhatsApp">
                <i class="fa-brands fa-whatsapp"></i>
                <span>WhatsApp</span>
              </a>
            ` : `
              <span class="btn btn-outline btn-table btn-table-disabled" title="Sin teléfono válido">
                <i class="fa-brands fa-whatsapp"></i>
                <span>WhatsApp</span>
              </span>
            `}
          </div>
        </td>
      </tr>
    `;
  },

  formatStatus(value) {
    const clean = String(value || "").trim().toLowerCase();

    if (clean.includes("no") || clean.includes("desap")) {
      return {
        label: "NO APTO",
        className: "danger",
        icon: "fa-circle-xmark",
      };
    }

    return {
      label: "APTO",
      className: "success",
      icon: "fa-circle-check",
    };
  },

  getExamStatus(student) {
    const exams = Number(student.stats?.examenes_total || 0);
    const apto = String(student.apt_examen || "").toLowerCase() === "apto";

    if (exams > 0) {
      return {
        label: "CON ENTREGA",
        className: "info",
        icon: "fa-file-circle-check",
      };
    }

    if (apto) {
      return {
        label: "SIN ENTREGA",
        className: "warning",
        icon: "fa-triangle-exclamation",
      };
    }

    return {
      label: "NO APTO",
      className: "danger",
      icon: "fa-circle-xmark",
    };
  },

  getRecoveryStatus(student) {
    const value =
      student.recuperatorio ||
      student.recovery_status ||
      student.stats?.recuperatorio ||
      "";

    if (!value) {
      return {
        label: "—",
        className: "muted",
        icon: "fa-minus",
      };
    }

    return {
      label: String(value).toUpperCase(),
      className: "info",
      icon: "fa-rotate-right",
    };
  },

  getWhatsappHref(value) {
    const raw = String(value || "").trim();

    if (!raw) return "";

    let digits = raw.replace(/\D/g, "");

    if (!digits) return "";

    if (digits.startsWith("549")) {
      return `https://wa.me/${digits}`;
    }

    if (digits.startsWith("54")) {
      return `https://wa.me/549${digits.slice(2)}`;
    }

    if (digits.startsWith("9") && digits.length >= 10) {
      return `https://wa.me/54${digits}`;
    }

    if (digits.length >= 10) {
      return `https://wa.me/549${digits}`;
    }

    return "";
  },

  escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomStudents.init();
});
