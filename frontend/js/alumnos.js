/* ============================================================
   AndyAzhTEC Classroom — alumnos.js
   Lectura de alumnos desde ExamPro
   ============================================================ */

"use strict";

const ClassroomStudents = {
  apiBase:
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.protocol === "file:"
      ? "http://127.0.0.1:8000"
      : "https://exampro-backend-1n6d.onrender.com",

  limit: 24,
  offset: 0,
  total: 0,
  loading: false,
  currentSearch: "",

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
      const response = await fetch(this.buildUrl(reset));
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.detail || data.message || "No se pudo leer la lista de alumnos.");
      }

      if (reset) {
        this.offset = 0;
        if (this.grid) this.grid.innerHTML = "";
      }

      this.total = data.total || 0;
      const items = Array.isArray(data.items) ? data.items : [];

      this.renderStudents(items);

      this.offset = (reset ? 0 : this.offset) + items.length;
      this.paintCounters();

      if (!items.length && reset) {
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

  renderStudents(items) {
    if (!this.grid) return;

    const fragment = document.createDocumentFragment();

    items.forEach((student) => {
      fragment.appendChild(this.createStudentCard(student));
    });

    this.grid.appendChild(fragment);
  },

  createStudentCard(student) {
    const card = document.createElement("article");
    card.className = "student-card";

    const name = student.full_name || student.nombre || student.twitch || "Alumno sin nombre";
    const twitch = student.twitch ? `@${student.twitch.replace(/^@/, "")}` : "Sin Twitch";
    const email = student.email || "Sin email";
    const dni = student.dni || "Sin DNI";

    const exams = student.stats?.examenes_total ?? 0;
    const mails = student.stats?.emails_total ?? 0;
    const pdfs = student.stats?.pdfs_total ?? 0;

    card.innerHTML = `
      <div class="student-card-top">
        <div class="student-avatar">
          <i class="fa-solid fa-user-graduate"></i>
        </div>

        <div>
          <h3>${this.escapeHtml(name)}</h3>
          <p>${this.escapeHtml(twitch)}</p>
        </div>
      </div>

      <div class="student-card-data">
        <span>
          <i class="fa-solid fa-id-card"></i>
          DNI ${this.escapeHtml(dni)}
        </span>

        <span>
          <i class="fa-solid fa-envelope"></i>
          ${this.escapeHtml(email)}
        </span>
      </div>

      <div class="student-card-badges">
        <span class="student-badge success">
          <i class="fa-solid fa-circle-check"></i>
          ${this.escapeHtml(student.apt_examen || "apto")}
        </span>

        <span class="student-badge">
          <i class="fa-solid fa-layer-group"></i>
          ${this.escapeHtml(student.cursada || "Sin cursada")}
        </span>
      </div>

      <div class="student-card-stats">
        <span><strong>${exams}</strong> exámenes</span>
        <span><strong>${mails}</strong> mails</span>
        <span><strong>${pdfs}</strong> PDFs</span>
      </div>

      <div class="student-card-actions">
        <a class="btn btn-outline" href="alumno.html?id=${encodeURIComponent(student.id)}">
          <i class="fa-solid fa-address-card"></i>
          Ver ficha
        </a>

        <a class="btn btn-primary" href="exampro.html">
          <i class="fa-solid fa-file-circle-check"></i>
          ExamPro
        </a>
      </div>
    `;

    return card;
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
