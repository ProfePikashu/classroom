/* ============================================================
   AndyAzhTEC Classroom — alumnos.js
   Listado tabular de alumnos desde ExamPro / Planilla 2025 / Todos
   ============================================================ */

"use strict";

const CLASSROOM_STUDENTS_SHEET_2025_API = "https://script.google.com/macros/s/AKfycbxajMTyRA6SBGeMYDikKlN2nrmONnlPYG88iDNVsYt-fE-ooH6XYW3wT6N5EV3FVxxU/exec";

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
  currentSource: "exampro",
  students: [],

  sourceLabels: {
    exampro: "ExamPro",
    sheet2025: "Planilla 2025",
    all: "Todos",
  },

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
    this.sourceTarget = document.getElementById("studentsSourceLabel");
    this.searchInput = document.getElementById("studentsSearchInput");
    this.sourceSelect = document.getElementById("studentsSourceSelect");
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

    if (this.sourceSelect) {
      this.sourceSelect.addEventListener("change", () => {
        this.currentSource = this.sourceSelect.value || "exampro";
        this.offset = 0;
        this.students = [];
        this.loadStudents(true);
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

  getSelectedSource() {
    return this.sourceSelect?.value || this.currentSource || "exampro";
  },

  getSourceLabel(source = this.getSelectedSource()) {
    return this.sourceLabels[source] || "ExamPro";
  },

  setLoadingState(isLoading) {
    this.loading = isLoading;

    if (this.loadMoreBtn) {
      this.loadMoreBtn.disabled = isLoading;
    }

    if (this.refreshBtn) {
      this.refreshBtn.disabled = isLoading;
    }

    if (this.sourceSelect) {
      this.sourceSelect.disabled = isLoading;
    }
  },

  async loadStudents(reset = false) {
    if (this.loading) return;

    const source = this.getSelectedSource();
    this.currentSource = source;

    this.setLoadingState(true);
    this.setStatus(`Cargando alumnos desde ${this.getSourceLabel(source)}...`);

    try {
      if (source === "sheet2025") {
        await this.loadSheetStudents();
      } else if (source === "all") {
        await this.loadAllStudents();
      } else {
        await this.loadExamProStudents(reset);
      }

      this.renderTable();
      this.paintCounters();
      this.paintSource();

      if (!this.students.length) {
        this.setStatus("No se encontraron alumnos con esos filtros.");
      } else {
        this.setStatus(`Mostrando ${this.students.length} de ${this.total} alumnos.`);
      }

      this.paintLoadMore();
    } catch (error) {
      console.error(error);
      this.setStatus(`No se pudo cargar la fuente ${this.getSourceLabel(source)}.`);
    } finally {
      this.setLoadingState(false);
    }
  },

  buildExamProUrl(offset, limit, search = this.currentSearch) {
    const params = new URLSearchParams({
      only_aptos: "true",
      valid_only: "true",
      exclude_auto: "true",
      limit: String(limit),
      offset: String(offset),
    });

    if (search) {
      params.set("search", search);
    }

    return `${this.apiBase}/api/classroom/students?${params.toString()}`;
  },

  getAuthHeaders() {
    const session =
      typeof ClassroomAuth !== "undefined"
        ? ClassroomAuth.getSession()
        : null;

    const headers = {};

    if (session?.classroomReadToken) {
      headers.Authorization = `Bearer ${session.classroomReadToken}`;
    }

    return headers;
  },

  async fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json();

    const parsed = typeof data === "string" ? JSON.parse(data) : data;

    if (!response.ok) {
      throw new Error(parsed?.detail || parsed?.message || parsed?.error || "Error leyendo datos.");
    }

    return parsed;
  },

  async fetchExamProPage(offset, limit, search = this.currentSearch) {
    const data = await this.fetchJson(this.buildExamProUrl(offset, limit, search), {
      headers: this.getAuthHeaders(),
    });

    if (!data.ok) {
      throw new Error(data.detail || data.message || "No se pudo leer la lista de alumnos.");
    }

    return {
      total: Number(data.total || 0),
      items: Array.isArray(data.items) ? data.items.map(item => this.normalizeExamProStudent(item)) : [],
    };
  },

  async loadExamProStudents(reset = false) {
    const offset = reset ? 0 : this.offset;

    if (reset) {
      this.offset = 0;
      this.students = [];
    }

    const data = await this.fetchExamProPage(offset, this.limit, this.currentSearch);

    this.total = data.total;
    this.students = reset ? data.items : this.students.concat(data.items);
    this.offset = this.students.length;
  },

  async fetchAllExamProStudents() {
    const pageSize = 200;
    let offset = 0;
    let total = 0;
    let items = [];

    do {
      const page = await this.fetchExamProPage(offset, pageSize, "");
      total = page.total;
      items = items.concat(page.items);
      offset = items.length;
    } while (offset < total && pageSize > 0);

    return items;
  },

  async fetchSheetStudents() {
    const data = await this.fetchJson(`${CLASSROOM_STUDENTS_SHEET_2025_API}?list=1`, {
      cache: "no-store",
    });

    if (!data.ok) {
      throw new Error(data.error || "No se pudo leer Planilla 2025.");
    }

    return Array.isArray(data.items)
      ? data.items.map(item => this.normalizeSheetStudent(item))
      : [];
  },

  async loadSheetStudents() {
    const allItems = await this.fetchSheetStudents();
    const items = this.filterLocalStudents(allItems);

    this.students = items;
    this.total = items.length;
    this.offset = items.length;
  },

  async loadAllStudents() {
    const [examproItems, sheetItems] = await Promise.all([
      this.fetchAllExamProStudents(),
      this.fetchSheetStudents(),
    ]);

    const merged = this.mergeStudents(examproItems, sheetItems);
    const filtered = this.filterLocalStudents(merged);

    this.students = filtered;
    this.total = filtered.length;
    this.offset = filtered.length;
  },

  mergeStudents(examproItems, sheetItems) {
    const map = new Map();

    sheetItems.forEach((student) => {
      const key = this.getStudentKey(student);
      if (!key) return;
      map.set(key, student);
    });

    examproItems.forEach((student) => {
      const key = this.getStudentKey(student);

      if (!key) {
        map.set(`exampro-${student.id || student.twitch || Math.random()}`, student);
        return;
      }

      const existing = map.get(key);

      if (!existing) {
        map.set(key, student);
        return;
      }

      map.set(key, {
        ...existing,
        ...student,
        id: student.id || existing.id,
        source: "ExamPro + Planilla 2025",
        source_priority: "all",
        full_name: student.full_name || existing.full_name,
        nombre: student.nombre || existing.nombre,
        email: student.email || existing.email,
        telefono: student.telefono || existing.telefono,
        twitch: student.twitch || existing.twitch,
        cursada: student.cursada || existing.cursada || "AyRPC 2025",
        apt_examen: student.apt_examen || existing.apt_examen,
        resultado: student.resultado || existing.resultado,
        exam_status: student.exam_status || existing.exam_status,
        recuperatorio: student.recuperatorio || existing.recuperatorio,
        observaciones: existing.observaciones || student.observaciones,
        mail_enviado: existing.mail_enviado || student.mail_enviado,
        stats: {
          ...(existing.stats || {}),
          ...(student.stats || {}),
        },
        sheet: existing,
        exampro: student,
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      const nameA = String(a.full_name || a.nombre || a.twitch || "").toLowerCase();
      const nameB = String(b.full_name || b.nombre || b.twitch || "").toLowerCase();
      return nameA.localeCompare(nameB, "es");
    });
  },

  getStudentKey(student) {
    const dni = String(student.dni || student.DNI || "").replace(/\D+/g, "");
    if (dni) return `dni-${dni}`;

    const twitch = String(student.twitch || "").trim().toLowerCase().replace(/^@/, "");
    if (twitch) return `twitch-${twitch}`;

    return "";
  },

  filterLocalStudents(items) {
    const query = String(this.currentSearch || "").trim().toLowerCase();

    if (!query) return items;

    return items.filter((student) => {
      const haystack = [
        student.full_name,
        student.nombre,
        student.display_name,
        student.dni,
        student.twitch,
        student.email,
        student.telefono,
        student.resultado,
        student.exam_status,
        student.recuperatorio,
        student.source,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  },

  normalizeExamProStudent(student) {
    return {
      ...student,
      source: student.source || "ExamPro",
      cursada: student.cursada || "AyRPC 2025",
    };
  },

  normalizeSheetStudent(student) {
    return {
      ...student,
      id: student.id || (student.dni ? `sheet-2025-${student.dni}` : ""),
      source: "Planilla 2025",
      cursada: student.cursada || "AyRPC 2025",
      full_name: student.full_name || student.nombre || student["Nombre Completo"] || "",
      nombre: student.nombre || student.full_name || student["Nombre Completo"] || "",
      email: student.email || student.Correo || "",
      telefono: student.telefono || student["Teléfono (con Código de Área)"] || "",
      twitch: String(student.twitch || student["Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)"] || "")
        .trim()
        .toLowerCase()
        .replace(/^@/, ""),
      dni: String(student.dni || student.DNI || "").replace(/\D+/g, ""),
      apt_examen: student.apt_examen || student.APTO || "",
      resultado: student.resultado || student.Resultado || "",
      exam_status: student.exam_status || "",
      recuperatorio: student.recuperatorio || student.Recuperatorio || "",
      observaciones: student.observaciones || student.Observaciones || "",
      mail_enviado: student.mail_enviado || student["Mail enviado"] || "",
      stats: student.stats || {
        examenes_total: 0,
        emails_total: student.email || student.Correo ? 1 : 0,
        pdfs_total: 0,
      },
    };
  },

  paintCounters() {
    if (this.totalTarget) this.totalTarget.textContent = String(this.total);
    if (this.shownTarget) this.shownTarget.textContent = String(this.students.length);
  },

  paintSource() {
    if (this.sourceTarget) this.sourceTarget.textContent = this.getSourceLabel();
  },

  paintLoadMore() {
    if (!this.loadMoreBtn) return;

    const source = this.getSelectedSource();

    if (source !== "exampro") {
      this.loadMoreBtn.style.display = "none";
      return;
    }

    this.loadMoreBtn.style.display = this.offset < this.total ? "inline-flex" : "none";
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
    const name = student.full_name || student.nombre || student.display_name || student.twitch || "Alumno sin nombre";
    const twitch = student.twitch ? `@${String(student.twitch).replace(/^@/, "")}` : "—";
    const email = student.email || "";
    const phone = student.telefono || "";
    const dni = student.dni || "—";
    const cursada = student.cursada || "AyRPC 2025";
    const source = student.source || this.getSourceLabel();
    const estado = this.formatStatus(student.apt_examen || student.estado || "");
    const examStatus = this.getExamStatus(student);
    const recoveryStatus = this.getRecoveryStatus(student);
    const mailHref = email ? `mailto:${encodeURIComponent(email)}` : "";
    const whatsappHref = this.getWhatsappHref(phone);
    const fichaId = student.exampro?.id || student.id || dni || "";

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
              <small>${this.escapeHtml(source)} · ID: ${this.escapeHtml(fichaId || "—")}</small>
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
            <a class="btn btn-outline btn-table" href="alumno.html?id=${encodeURIComponent(fichaId)}" title="Ver ficha">
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

    if (!clean || clean === "planilla") {
      return {
        label: "SIN ESTADO",
        className: "muted",
        icon: "fa-minus",
      };
    }

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
    const explicit = String(student.exam_status || student.resultado || "").trim().toUpperCase();

    if (explicit.includes("APROBADO")) {
      return {
        label: "APROBADO",
        className: "success",
        icon: "fa-circle-check",
      };
    }

    if (explicit.includes("DESAPROBADO")) {
      return {
        label: "DESAPROBADO",
        className: "danger",
        icon: "fa-circle-xmark",
      };
    }

    if (explicit.includes("SIN_ENTREGA") || explicit.includes("SIN ENTREGA")) {
      return {
        label: "SIN ENTREGA",
        className: "warning",
        icon: "fa-triangle-exclamation",
      };
    }

    if (explicit.includes("EN_REVISION") || explicit.includes("REVIS")) {
      return {
        label: "EN REVISIÓN",
        className: "info",
        icon: "fa-clock",
      };
    }

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
      student.recovery_status ||
      student.stats?.recuperatorio ||
      student.recuperatorio ||
      "";

    const clean = String(value || "").trim();

    if (!clean || clean.toLowerCase().includes("listo para cargar notas")) {
      return {
        label: "—",
        className: "muted",
        icon: "fa-minus",
      };
    }

    return {
      label: clean.toUpperCase(),
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
