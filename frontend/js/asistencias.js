/* AndyAzhTEC Classroom â€” Admin Asistencias */

"use strict";

const AdminAsistencias = {
  cursos: {
    "ayrpc-2025": "AyRPC 2025",
    "ayrpc-2026": "AyRPC 2026"
  },

  clases: [
    { n: 1, label: "Clase 1" },
    { n: 2, label: "Clase 2" },
    { n: 3, label: "Clase 3" },
    { n: 4, label: "Clase 4" },
    { n: 5, label: "Clase 5" },
    { n: 6, label: "Clase 6" },
    { n: 7, label: "Clase 7" }
  ],

  rows: [],
  summary: null,
  loading: false,
  lastError: "",

  get apiBase() {
    if (typeof ClassroomAuth !== "undefined" && ClassroomAuth?.apiBase) {
      return ClassroomAuth.apiBase;
    }

    if (typeof EXAMPRO_API_BASE !== "undefined") {
      return EXAMPRO_API_BASE;
    }

    const isLocal =
      location.hostname === "127.0.0.1" ||
      location.hostname === "localhost";

    return isLocal
      ? "http://127.0.0.1:8000"
      : "https://api.andyazhtec.com";
  },

  getSession() {
    if (typeof ClassroomAuth !== "undefined" && ClassroomAuth?.getSession) {
      return ClassroomAuth.getSession();
    }

    try {
      return JSON.parse(localStorage.getItem("andyazh-classroom-session") || "null");
    } catch (_) {
      return null;
    }
  },

  getAuthHeaders() {
    const session = this.getSession();
    const token =
      session?.classroomReadToken ||
      session?.access_token ||
      session?.token ||
      "";

    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  init() {
    this.courseSelect = document.getElementById("attendanceCourseSelect");
    this.searchInput = document.getElementById("attendanceSearchInput");
    this.statusFilter = document.getElementById("attendanceStatusFilter");
    this.refreshBtn = document.getElementById("attendanceRefreshBtn");
    this.kpis = document.getElementById("attendanceKpis");
    this.status = document.getElementById("attendanceStatus");
    this.tableWrap = document.getElementById("attendanceTableWrap");
    this.modal = document.getElementById("attendanceStudentModal");
    this.modalBody = document.getElementById("attendanceStudentModalBody");

    if (this.modal && this.modal.parentElement !== document.body) {
      document.body.appendChild(this.modal);
    }

    this.bind();
    this.render();
  },

  bind() {
    this.courseSelect?.addEventListener("change", () => this.render());
    this.statusFilter?.addEventListener("change", () => this.render());
    this.refreshBtn?.addEventListener("click", () => this.render());

    this.tableWrap?.addEventListener("click", (event) => {
      const scrollBtn = event.target.closest("[data-attendance-scroll]");
      if (scrollBtn) {
        this.scrollTable(scrollBtn.dataset.attendanceScroll);
        return;
      }

      const btn = event.target.closest("[data-attendance-profile]");
      if (btn) this.openProfile(Number(btn.dataset.attendanceProfile));
    });

    this.modal?.addEventListener("click", (event) => {
      if (event.target.closest("[data-attendance-modal-close]")) this.closeProfile();
    });

    let timer = null;
    this.searchInput?.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.render(), 300);
    });
  },

  async fetchJson(url) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...this.getAuthHeaders()
      }
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.detail || data?.error || `Error HTTP ${response.status}`);
    }

    return data;
  },

  buildStudentsUrl() {
    const course = this.courseSelect?.value || "ayrpc-2025";
    const search = String(this.searchInput?.value || "").trim();
    const statusFilter = this.statusFilter?.value || "all";

    const params = new URLSearchParams();
    params.set("course", course);
    params.set("limit", "1000");
    params.set("offset", "0");

    if (search) params.set("search", search);
    if (statusFilter && statusFilter !== "all") params.set("status_filter", statusFilter);

    return `${this.apiBase}/api/classroom/admin/attendance/students?${params.toString()}`;
  },

  buildSummaryUrl() {
    const course = this.courseSelect?.value || "ayrpc-2025";
    const params = new URLSearchParams();
    params.set("course", course);
    return `${this.apiBase}/api/classroom/admin/attendance/summary?${params.toString()}`;
  },

  normalizeApiRow(row) {
    const clases = this.clases.map(({ n }) => [
      row[`class_${n}_status`] || "SIN DATOS",
      row[`class_${n}_time`] || "\\u2014"
    ]);

    return {
      legacyRow: row.legacy_row,
      inscripcion: row.inscription_at || "\u2014",
      nombre: row.full_name_normalized || row.full_name_raw || "Sin nombre",
      dni: row.dni || "\\u2014",
      email: row.email || "",
      telefono: row.phone_display || "",
      whatsapp: row.whatsapp_number || "",
      twitch: row.twitch_normalized || "",
      curso: row.course_slug || "ayrpc-2025",
      clases,
      validas: Number(row.valid_classes || 0),
      apto: String(row.apt_calculated || "").toUpperCase() === "SI",
      aptSheet: row.apt_sheet || "",
      participado: row.participated || "",
      resultado: row.result || "",
      recuperatorio: row.recovery || "",
      observaciones: row.observations || ""
    };
  },

  estadoClaseValida(estado) {
    return ["PRESENTE", "RECUPERADA"].includes(String(estado || "").toUpperCase());
  },

  getResumenAlumno(alumno) {
    const validas = Number.isFinite(alumno.validas)
      ? alumno.validas
      : alumno.clases.filter(([estado]) => this.estadoClaseValida(estado)).length;

    const revisar = alumno.clases.some(([estado]) => estado === "REVISAR");
    const ausente = alumno.clases.some(([estado]) => estado === "AUSENTE");
    const recuperadas = alumno.clases.filter(([estado]) => estado === "RECUPERADA").length;

    return {
      validas,
      revisar,
      ausente,
      recuperadas,
      apto: Boolean(alumno.apto)
    };
  },

  async render() {
    const curso = this.courseSelect?.value || "ayrpc-2025";
    const cursoLabel = this.cursos[curso] || "Cursada";

    this.loading = true;
    this.lastError = "";

    if (this.status) {
      this.status.textContent = `Cargando asistencias de ${cursoLabel} desde Supabase...`;
    }

    if (this.tableWrap) {
      this.tableWrap.innerHTML = `<div class="attendance-empty">Cargando datos...</div>`;
    }

    try {
      const [summaryData, studentsData] = await Promise.all([
        this.fetchJson(this.buildSummaryUrl()),
        this.fetchJson(this.buildStudentsUrl())
      ]);

      this.summary = summaryData?.summary || null;
      this.rows = (studentsData?.items || []).map(row => this.normalizeApiRow(row));

      this.renderKpis(this.summary, this.rows);
      this.renderTable(this.rows); this.enableTableDragScroll();

      if (this.status) {
        const total = Number(studentsData?.total || this.rows.length);
        this.status.textContent = `${cursoLabel}: ${this.rows.length} alumnos mostrados de ${total}. Fuente: Supabase via API Classroom.`;
      }
    } catch (error) {
      this.lastError = error?.message || "No se pudieron cargar las asistencias.";
      this.rows = [];
      this.summary = null;
      this.renderKpis(null, []);
      this.renderTable([]);

      if (this.status) {
        this.status.textContent = `Error cargando ${cursoLabel}: ${this.lastError}`;
      }
    } finally {
      this.loading = false;
    }
  },

  renderKpis(summary, rows) {
    if (!this.kpis) return;

    const total = Number(summary?.total_students ?? rows.length ?? 0);
    const aptos = Number(summary?.aptos_examen ?? rows.filter(a => this.getResumenAlumno(a).apto).length ?? 0);
    const deben = Number(summary?.deben_clases ?? Math.max(total - aptos, 0));
    const revisar = Number(summary?.con_revisar ?? rows.filter(a => this.getResumenAlumno(a).revisar).length ?? 0);
    const ausentes = Number(summary?.con_ausentes ?? rows.filter(a => this.getResumenAlumno(a).ausente).length ?? 0);
    const recuperadas = Number(summary?.con_recuperadas ?? rows.filter(a => this.getResumenAlumno(a).recuperadas > 0).length ?? 0);

    const items = [
      ["Total", total],
      ["Aptos", aptos],
      ["Deben", deben],
      ["Revisar", revisar],
      ["Ausentes", ausentes],
      ["Recuperadas", recuperadas]
    ];

    this.kpis.innerHTML = items.map(([label, value]) => `
      <div class="attendance-kpi">
        <span>${this.escapeHtml(label)}</span>
        <strong>${this.escapeHtml(value)}</strong>
      </div>
    `).join("");
  },

  renderTable(rows) {
    if (!this.tableWrap) return;

    const classHeaders = this.clases.map(c => `
      <th>${this.escapeHtml(c.label)}<br>Estado</th>
      <th>${this.escapeHtml(c.label)}<br>Tiempo</th>
    `).join("");

    const body = rows.map((alumno, index) => {
      const resumen = this.getResumenAlumno(alumno);
      const classCells = alumno.clases.map(([estado, tiempo]) => `
        <td>${this.badge(estado)}</td>
        <td class="attendance-time">${this.escapeHtml(tiempo)}</td>
      `).join("");

      return `
        <tr>
          <td class="sticky-col">
            <div class="attendance-student-main">
              <div class="attendance-avatar"><i class="fa-solid fa-user-graduate"></i></div>
              <div>
                <strong>${this.escapeHtml(alumno.nombre)}</strong>
                <small>@${this.escapeHtml(alumno.twitch || "sin-twitch")} - DNI ${this.escapeHtml(alumno.dni)}</small>
              </div>
            </div>
          </td>
          <td>${this.escapeHtml(alumno.inscripcion)}</td>
          <td>${this.escapeHtml(alumno.email || "\u2014")}</td>
          <td>${this.escapeHtml(alumno.telefono || "\u2014")}</td>
          ${classCells}
          <td><strong>${resumen.validas}/7</strong></td>
          <td>${this.badge(resumen.apto ? "APTO" : "NO APTO")}</td>
          <td><button class="btn btn-outline btn-table" type="button" data-attendance-profile="${index}">Ficha</button></td>
        </tr>
      `;
    }).join("");

    this.tableWrap.innerHTML = `
      <div class="attendance-table-shell">
        <button class="attendance-scroll-arrow attendance-scroll-arrow-left" type="button" data-attendance-scroll="left" aria-label="Mover columnas a la izquierda" disabled>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <button class="attendance-scroll-arrow attendance-scroll-arrow-right" type="button" data-attendance-scroll="right" aria-label="Mover columnas a la derecha">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        <div class="attendance-table-scroll">
          <table class="attendance-table">
        <thead>
          <tr>
            <th class="sticky-col">Alumno</th>
            <th>Inscripcion</th>
            <th>Correo</th>
            <th>Telefono</th>
            ${classHeaders}
            <th>Validas</th>
            <th>Examen</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${body || `<tr><td colspan="22">No hay alumnos para mostrar.</td></tr>`}
        </tbody>
          </table>
        </div>
      </div>
    `;
  },



  scrollTable(direction) {
    const scroller = this.tableWrap?.querySelector(".attendance-table-scroll");
    if (!scroller) return;

    const amount = Math.max(420, Math.round(scroller.clientWidth * 0.72));

    scroller.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth"
    });

    window.setTimeout(() => this.updateScrollButtons(), 280);
  },

  updateScrollButtons() {
    const scroller = this.tableWrap?.querySelector(".attendance-table-scroll");
    if (!scroller) return;

    const leftBtn = this.tableWrap?.querySelector('[data-attendance-scroll="left"]');
    const rightBtn = this.tableWrap?.querySelector('[data-attendance-scroll="right"]');
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);

    if (leftBtn) leftBtn.disabled = maxScroll <= 2 || scroller.scrollLeft <= 4;
    if (rightBtn) rightBtn.disabled = maxScroll <= 2 || scroller.scrollLeft >= maxScroll - 4;
  },

  enableTableDragScroll() {
    const scroller = this.tableWrap?.querySelector(".attendance-table-scroll");
    if (!scroller) return;

    this.updateScrollButtons();

    if (scroller.dataset.dragReady === "1") return;
    scroller.dataset.dragReady = "1";

    let isDown = false;
    let startX = 0;
    let startLeft = 0;

    scroller.addEventListener("scroll", () => this.updateScrollButtons(), { passive: true });
    window.addEventListener("resize", () => this.updateScrollButtons());

    scroller.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button, a, input, select, textarea")) return;

      isDown = true;
      startX = event.clientX;
      startLeft = scroller.scrollLeft;
      scroller.classList.add("is-dragging");
      scroller.setPointerCapture?.(event.pointerId);
    });

    scroller.addEventListener("pointermove", (event) => {
      if (!isDown) return;
      event.preventDefault();
      scroller.scrollLeft = startLeft - (event.clientX - startX);
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
      scroller.addEventListener(type, () => {
        isDown = false;
        scroller.classList.remove("is-dragging");
      });
    });
  },

  badge(value) {
    const raw = String(value || "SIN DATOS").toUpperCase();
    const cls = {
      "PRESENTE": "presente",
      "RECUPERADA": "recuperada",
      "REVISAR": "revisar",
      "AUSENTE": "ausente",
      "APTO": "apto",
      "NO APTO": "no-apto",
      "SIN DATOS": "none"
    }[raw] || "none";

    return `<span class="attendance-badge ${cls}">${this.escapeHtml(raw)}</span>`;
  },

  openProfile(index) {
    const alumno = this.rows[index];
    if (!alumno || !this.modal || !this.modalBody) return;

    const resumen = this.getResumenAlumno(alumno);

    this.modalBody.innerHTML = `
      <div class="attendance-profile-head">
        <div class="attendance-profile-avatar"><i class="fa-solid fa-user-graduate"></i></div>
        <div>
          <p class="eyebrow">Ficha de asistencia</p>
          <h3 id="attendanceStudentModalTitle">${this.escapeHtml(alumno.nombre)}</h3>
          <p>@${this.escapeHtml(alumno.twitch || "sin-twitch")} - DNI ${this.escapeHtml(alumno.dni)}</p>
        </div>
      </div>

      <div class="attendance-profile-grid">
        ${this.profileField("Inscripcion", alumno.inscripcion)}
        ${this.profileField("Correo", alumno.email)}
        ${this.profileField("Telefono", alumno.telefono)}
        ${this.profileField("Twitch login", alumno.twitch ? "@" + alumno.twitch : "\\u2014")}
        ${this.profileField("Clases vÃ¡lidas", resumen.validas + "/7")}
        ${this.profileField("Apto examen", resumen.apto ? "Si" : "No")}
        ${this.profileField("Participacion examen", alumno.participado || "\\u2014")}
        ${this.profileField("Resultado", alumno.resultado || "\\u2014")}
        ${this.profileField("Recuperatorio", alumno.recuperatorio || "\\u2014")}
      </div>

      <div class="attendance-profile-actions">
        <a class="btn btn-outline" href="mailto:${this.escapeHtml(alumno.email || "\u2014")}">
          <i class="fa-solid fa-envelope"></i>
          <span>Enviar mail</span>
        </a>
        <a class="btn btn-outline" href="${this.getWhatsappHref(alumno)}" target="_blank" rel="noopener">
          <i class="fa-brands fa-whatsapp"></i>
          <span>WhatsApp</span>
        </a>
      </div>
    `;

    this.modal.hidden = false;
  },

  closeProfile() {
    if (this.modal) this.modal.hidden = true;
  },

  getWhatsappHref(alumno) {
    const digits = String(alumno?.whatsapp || alumno?.telefono || "").replace(/\D+/g, "");
    if (!digits) return "#";
    return "https://wa.me/" + digits;
  },

  profileField(label, value) {
    return `
      <div class="attendance-profile-field">
        <span>${this.escapeHtml(label)}</span>
        <strong>${this.escapeHtml(value || "\\u2014")}</strong>
      </div>
    `;
  },

  escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }
};

document.addEventListener("DOMContentLoaded", () => AdminAsistencias.init());
