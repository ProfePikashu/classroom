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
              <th>Email</th>
              <th>Cursada</th>
              <th>Estado</th>
              <th>Exámenes</th>
              <th>PDFs</th>
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
    const email = student.email || "—";
    const dni = student.dni || "—";
    const cursada = student.cursada || "AyRPC 2025";
    const estado = student.apt_examen || "apto";
    const exams = student.stats?.examenes_total ?? 0;
    const pdfs = student.stats?.pdfs_total ?? 0;

    return `
      <tr>
        <td class="students-table-index">${index + 1}</td>

        <td>
          <div class="students-table-student">
            <div class="student-table-avatar">
              <i class="fa-solid fa-user-graduate"></i>
            </div>

            <div>
              <strong>${this.escapeHtml(name)}</strong>
              <small>ID ExamPro: ${this.escapeHtml(student.id)}</small>
            </div>
          </div>
        </td>

        <td>${this.escapeHtml(dni)}</td>
        <td>${this.escapeHtml(twitch)}</td>
        <td class="students-table-email">${this.escapeHtml(email)}</td>

        <td>
          <span class="student-badge course">
            ${this.escapeHtml(cursada)}
          </span>
        </td>

        <td>
          <span class="student-badge success">
            <i class="fa-solid fa-circle-check"></i>
            ${this.escapeHtml(estado)}
          </span>
        </td>

        <td class="students-table-number">${this.escapeHtml(exams)}</td>
        <td class="students-table-number">${this.escapeHtml(pdfs)}</td>

        <td>
          <a class="btn btn-outline btn-table" href="alumno.html?id=${encodeURIComponent(student.id)}">
            <i class="fa-solid fa-address-card"></i>
            Ficha
          </a>
        </td>
      </tr>
    `;
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
