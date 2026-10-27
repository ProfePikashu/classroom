/* AndyAzhTEC Classroom — Admin Asistencias */

"use strict";

const AdminAsistencias = {
  cursos: {
    "ayrpc-2025": "AyRPC 2025",
    "ayrpc-2026": "AyRPC 2026"
  },

  clases: [],
  rows: [],
  loading: false,
  lastError: "",
  canEdit: false,

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

  hasPermission(permission) {
    return (
      typeof ClassroomRoles !== "undefined" &&
      typeof ClassroomRoles.currentHasPermission === "function" &&
      ClassroomRoles.currentHasPermission(permission)
    );
  },

  canViewAttendance() {
    return this.hasPermission("attendance.view");
  },

  canEditAttendance() {
    return (
      typeof ClassroomRoles !== "undefined" &&
      typeof ClassroomRoles.currentHasPermission === "function" &&
      ClassroomRoles.currentHasPermission("attendance.edit")
    );
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
    this.canEdit = this.canEditAttendance();

    if (!this.canViewAttendance()) {
      if (this.status) {
        this.status.textContent = "No tenés permiso para ver asistencias.";
      }

      if (this.kpis) this.kpis.innerHTML = "";
      if (this.tableWrap) this.tableWrap.innerHTML = "";
      if (this.courseSelect) this.courseSelect.disabled = true;
      if (this.searchInput) this.searchInput.disabled = true;
      if (this.statusFilter) this.statusFilter.disabled = true;
      if (this.refreshBtn) this.refreshBtn.disabled = true;
      return;
    }

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

    this.tableWrap?.addEventListener("change", (event) => {
      const editor = event.target.closest("[data-attendance-status-edit]");
      if (editor) this.updateAttendanceStatus(editor);
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

  async requestJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...this.getAuthHeaders(),
        ...(options.headers || {})
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
    const course = this.courseSelect?.value || "ayrpc-2026";
    const search = String(this.searchInput?.value || "").trim();
    const statusFilter = this.statusFilter?.value || "all";

    const params = new URLSearchParams();
    params.set("course", course);
    params.set("limit", "1000");
    params.set("offset", "0");

    if (search) params.set("search", search);
    if (statusFilter && statusFilter !== "all") {
      params.set("status_filter", statusFilter);
    }

    return `${this.apiBase}/api/classroom/admin/attendance/students?${params.toString()}`;
  },

  normalizeApiRow(row, course = "ayrpc-2026") {
    const progressByClass = new Map(
      (Array.isArray(row.classes) ? row.classes : []).map(item => [
        Number(item.class_number),
        item
      ])
    );

    const clases = this.clases.map(({ n }) => {
      const progress = progressByClass.get(Number(n)) || {};

      return [
        row[`class_${n}_status`] || progress.status || "SIN DATOS",
        row[`class_${n}_time`] || progress.time || "-",
        progress.live_presence_seconds ?? null,
        progress.live_presence_percent ?? null
      ];
    });

    const enrollmentStatus = String(row.enrollment_status || "active").toLowerCase();
    const isWithdrawn = enrollmentStatus === "withdrawn";

    return {
      enrollmentId: row.enrollment_id || "",
      studentId: row.student_id ?? null,
      enrollmentStatus,
      isWithdrawn,
      legacyRow: row.legacy_row,
      inscripcion: row.inscription_at || row.enrolled_at || "—",
      full_name: row.full_name_normalized || row.full_name_raw || row.full_name || "Sin nombre",
      dni: row.dni || "-",
      email: row.email || "",
      telefono: row.telefono || row.phone_display || "",
      whatsapp: row.whatsapp_number || row.telefono || "",
      twitch: row.twitch_normalized || "",
      curso: course || row.course_slug || "ayrpc-2026",
      clases,
      validas: Number(row.valid_classes || 0),
      apto: !isWithdrawn && String(row.apt_calculated || "").toUpperCase() === "SI",
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
      apto: !alumno.isWithdrawn && Boolean(alumno.apto)
    };
  },

  formatAttendanceDuration(seconds) {
    if (seconds === null || seconds === undefined || seconds === "") return "";

    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return "";

    const totalSeconds = Math.floor(value);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secondsPart = totalSeconds % 60;
    const minuteText = hours > 0
      ? String(minutes).padStart(2, "0")
      : String(minutes);
    const secondText = String(secondsPart).padStart(2, "0");

    return hours > 0
      ? `${hours}h ${minuteText}m ${secondText}s`
      : `${minuteText}m ${secondText}s`;
  },

  attendanceTimeTone(percent) {
    if (percent === null || percent === undefined || percent === "") return "";

    const value = Number(percent);
    if (!Number.isFinite(value)) return "";
    if (value >= 75) return "success";
    if (value >= 70) return "warning";
    return "danger";
  },

  renderAttendanceTime(course, legacyTime, seconds, percent) {
    if (course !== "ayrpc-2026") {
      return this.escapeHtml(legacyTime || "-");
    }

    const exactTime = this.formatAttendanceDuration(seconds);
    const displayTime = exactTime || String(legacyTime || "-");
    const tone = exactTime ? this.attendanceTimeTone(percent) : "";
    const color = {
      success: "var(--green)",
      warning: "var(--yellow)",
      danger: "var(--red)"
    }[tone] || "";

    if (!color) return this.escapeHtml(displayTime);

    return `<strong style="color:${color};font-weight:700;">${this.escapeHtml(displayTime)}</strong>`;
  },

  async render() {
    const curso = this.courseSelect?.value || "ayrpc-2026";
    const cursoLabel = this.cursos[curso] || "Cursada";
    const statusFilter = this.statusFilter?.value || "all";

    this.loading = true;
    this.lastError = "";

    if (this.status) {
      this.status.textContent = `Cargando asistencias de ${cursoLabel} desde Supabase...`;
    }

    if (this.tableWrap) {
      this.tableWrap.innerHTML = `<div class="attendance-empty">Cargando datos...</div>`;
    }

    try {
      const studentsData = await this.requestJson(this.buildStudentsUrl());
      const rawRows = studentsData?.items || [];
      const apiClasses = rawRows[0]?.classes;

      if (Array.isArray(apiClasses) && apiClasses.length) {
        this.clases = apiClasses.map(clase => ({
          n: Number(clase.class_number),
          label: `Clase ${clase.class_number}`
        }));
      } else {
        const totalClases = curso === "ayrpc-2026" ? 12 : 7;
        this.clases = Array.from(
          { length: totalClases },
          (_, index) => ({
            n: index + 1,
            label: `Clase ${index + 1}`
          })
        );
      }

      let normalized = rawRows.map(row => this.normalizeApiRow(row, curso));

      // Una baja se conserva en la vista general y en búsquedas, pero no tiene
      // sentido mezclarla con filtros académicos como "debe" o "ausente".
      if (statusFilter !== "all") {
        normalized = normalized.filter(row => !row.isWithdrawn);
      }

      normalized.sort((a, b) => {
        const withdrawalOrder = Number(a.isWithdrawn) - Number(b.isWithdrawn);
        if (withdrawalOrder !== 0) return withdrawalOrder;
        return a.full_name.localeCompare(b.full_name, "es", { sensitivity: "base" });
      });

      this.rows = normalized;
      this.renderKpis(this.rows);
      this.renderTable(this.rows);
      this.enableTableDragScroll();

      if (this.status) {
        const active = this.rows.filter(row => !row.isWithdrawn).length;
        const withdrawn = this.rows.filter(row => row.isWithdrawn).length;
        const suffix = withdrawn
          ? ` + ${withdrawn} baja${withdrawn === 1 ? "" : "s"} visible${withdrawn === 1 ? "" : "s"}`
          : "";
        this.status.textContent = `${cursoLabel}: ${active} alumnos activos${suffix}. Fuente: Supabase vía API Classroom.`;
      }
    } catch (error) {
      this.lastError = error?.message || "No se pudieron cargar las asistencias.";
      this.rows = [];
      this.renderKpis([]);
      this.renderTable([]);

      if (this.status) {
        this.status.textContent = `Error cargando ${cursoLabel}: ${this.lastError}`;
      }
    } finally {
      this.loading = false;
    }
  },

  renderKpis(rows) {
    if (!this.kpis) return;

    const activeRows = rows.filter(row => !row.isWithdrawn);
    const total = activeRows.length;
    const aptos = activeRows.filter(a => this.getResumenAlumno(a).apto).length;
    const deben = Math.max(total - aptos, 0);
    const revisar = activeRows.filter(a => this.getResumenAlumno(a).revisar).length;
    const ausentes = activeRows.filter(a => this.getResumenAlumno(a).ausente).length;
    const recuperadas = activeRows.filter(a => this.getResumenAlumno(a).recuperadas > 0).length;

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

  renderStatusCell(alumno, rowIndex, classIndex, estado) {
    const classNumber = this.clases[classIndex]?.n;
    const badge = this.badge(estado);

    if (!this.canEdit || alumno.isWithdrawn || !alumno.enrollmentId || !classNumber) {
      return badge;
    }

    const raw = String(estado || "PENDIENTE").toUpperCase();
    const allowed = ["PENDIENTE", "PRESENTE", "AUSENTE", "REVISAR", "RECUPERADA"];
    const selectedValue = allowed.includes(raw) ? raw : "PENDIENTE";
    const options = allowed.map(value => `
      <option value="${value}"${value === selectedValue ? " selected" : ""}>${value}</option>
    `).join("");

    return `
      ${badge}
      <select
        class="attendance-status-editor"
        data-attendance-status-edit
        data-row-index="${rowIndex}"
        data-class-number="${classNumber}"
        data-previous-status="${this.escapeHtml(selectedValue)}"
        aria-label="Cambiar estado de ${this.escapeHtml(alumno.full_name)}, clase ${classNumber}"
        title="Cambio manual de asistencia"
      >${options}</select>
    `;
  },

  renderTable(rows) {
    if (!this.tableWrap) return;

    const classHeaders = this.clases.map(c => `
      <th>${this.escapeHtml(c.label)}<br>Estado</th>
      <th>${this.escapeHtml(c.label)}<br>Tiempo</th>
    `).join("");

    const body = rows.map((alumno, index) => {
      const resumen = this.getResumenAlumno(alumno);
      const classCells = alumno.clases.map(([estado, tiempo, segundos, porcentaje], classIndex) => `
        <td class="attendance-status-cell">${this.renderStatusCell(alumno, index, classIndex, estado)}</td>
        <td class="attendance-time">${this.renderAttendanceTime(
          alumno.curso,
          tiempo,
          segundos,
          porcentaje
        )}</td>
      `).join("");

      const bajaBadge = alumno.isWithdrawn
        ? `<span class="attendance-baja-badge">BAJA</span>`
        : "";
      const rowClass = alumno.isWithdrawn ? "attendance-withdrawn-row" : "";

      return `
        <tr class="${rowClass}">
          <td class="sticky-col">
            <div class="attendance-student-main">
              <div class="attendance-avatar"><i class="fa-solid fa-user-graduate"></i></div>
              <div class="attendance-student-copy">
                <div class="attendance-student-name-line">
                  <strong>${this.escapeHtml(alumno.full_name)}</strong>
                  ${bajaBadge}
                </div>
                <small>@${this.escapeHtml(alumno.twitch || "sin-twitch")} · DNI ${this.escapeHtml(alumno.dni)}</small>
              </div>
            </div>
          </td>
          <td>${this.escapeHtml(alumno.inscripcion)}</td>
          <td>${this.escapeHtml(alumno.email || "—")}</td>
          <td>${this.escapeHtml(alumno.telefono || "—")}</td>
          ${classCells}
          <td><strong>${resumen.validas}/${this.clases.length}</strong></td>
          <td>${alumno.isWithdrawn ? bajaBadge : this.badge(resumen.apto ? "APTO" : "NO APTO")}</td>
          <td><button class="btn btn-outline btn-table" type="button" data-attendance-profile="${index}">Ficha</button></td>
        </tr>
      `;
    }).join("");

    const colspan = 7 + (this.clases.length * 2);

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
                <th>Inscripción</th>
                <th>Correo</th>
                <th>Teléfono</th>
                ${classHeaders}
                <th>Válidas</th>
                <th>Examen</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${body || `<tr><td colspan="${colspan}">No hay alumnos para mostrar.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async updateAttendanceStatus(editor) {
    if (!this.canEditAttendance()) return;

    const rowIndex = Number(editor.dataset.rowIndex);
    const classNumber = Number(editor.dataset.classNumber);
    const alumno = this.rows[rowIndex];
    const classIndex = this.clases.findIndex(item => Number(item.n) === classNumber);

    if (!alumno || classIndex < 0 || alumno.isWithdrawn || !alumno.enrollmentId) {
      return;
    }

    const previousStatus = String(
      editor.dataset.previousStatus || alumno.clases[classIndex]?.[0] || "PENDIENTE"
    ).toUpperCase();
    const newStatus = String(editor.value || "").toUpperCase();

    if (!newStatus || newStatus === previousStatus) return;

    editor.disabled = true;
    if (this.status) {
      this.status.textContent = `Guardando Clase ${classNumber} de ${alumno.full_name}: ${previousStatus} → ${newStatus}...`;
    }

    try {
      const data = await this.requestJson(
        `${this.apiBase}/api/classroom/admin/attendance/progress`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course: alumno.curso,
            enrollment_id: alumno.enrollmentId,
            class_number: classNumber,
            status: newStatus
          })
        }
      );

      alumno.clases[classIndex][0] = newStatus;
      if (data?.academic) {
        alumno.validas = Number(data.academic.valid_classes ?? alumno.validas);
        alumno.apto = Boolean(data.academic.exam_eligible);
      }

      const scroller = this.tableWrap?.querySelector(".attendance-table-scroll");
      const scrollLeft = scroller?.scrollLeft || 0;
      this.renderKpis(this.rows);
      this.renderTable(this.rows);
      this.enableTableDragScroll();
      const nextScroller = this.tableWrap?.querySelector(".attendance-table-scroll");
      if (nextScroller) nextScroller.scrollLeft = scrollLeft;
      this.updateScrollButtons();

      if (this.status) {
        this.status.textContent = `${alumno.full_name} · Clase ${classNumber}: estado actualizado manualmente a ${newStatus}.`;
      }
    } catch (error) {
      editor.value = previousStatus;
      editor.disabled = false;
      if (this.status) {
        this.status.textContent = `No se pudo actualizar la asistencia: ${error?.message || "error desconocido"}`;
      }
    }
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

    if (!this._resizeBound) {
      window.addEventListener("resize", () => this.updateScrollButtons());
      this._resizeBound = true;
    }

    if (scroller.dataset.dragReady === "1") return;
    scroller.dataset.dragReady = "1";

    let isDown = false;
    let startX = 0;
    let startLeft = 0;

    scroller.addEventListener("scroll", () => this.updateScrollButtons(), { passive: true });

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
      "PENDIENTE": "none",
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
    const bajaBadge = alumno.isWithdrawn
      ? `<span class="attendance-baja-badge">BAJA</span>`
      : "";

    this.modalBody.innerHTML = `
      <div class="attendance-profile-head">
        <div class="attendance-profile-avatar"><i class="fa-solid fa-user-graduate"></i></div>
        <div>
          <p class="eyebrow">Ficha de asistencia ${bajaBadge}</p>
          <h3 id="attendanceStudentModalTitle">${this.escapeHtml(alumno.full_name)}</h3>
          <p>@${this.escapeHtml(alumno.twitch || "sin-twitch")} · DNI ${this.escapeHtml(alumno.dni)}</p>
        </div>
      </div>

      <div class="attendance-profile-grid">
        ${this.profileField("Estado matrícula", alumno.isWithdrawn ? "BAJA" : "ACTIVA")}
        ${this.profileField("Inscripción", alumno.inscripcion)}
        ${this.profileField("Correo", alumno.email)}
        ${this.profileField("Teléfono", alumno.telefono)}
        ${this.profileField("Twitch login", alumno.twitch ? "@" + alumno.twitch : "-")}
        ${this.profileField("Clases válidas", resumen.validas + "/" + this.clases.length)}
        ${this.profileField("Apto examen", alumno.isWithdrawn ? "No aplica" : (resumen.apto ? "Sí" : "No"))}
        ${this.profileField("Participación examen", alumno.participado || "-")}
        ${this.profileField("Resultado", alumno.resultado || "-")}
        ${this.profileField("Recuperatorio", alumno.recuperatorio || "-")}
      </div>

      <div class="attendance-profile-actions">
        <a class="btn btn-outline" href="mailto:${this.escapeHtml(alumno.email || "")}">
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
        <strong>${this.escapeHtml(value || "-")}</strong>
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
