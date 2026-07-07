/* ============================================================
   AndyAzhTEC Classroom \u2014 alumnos.js
   Listado tabular de alumnos desde Supabase 2025
   ============================================================ */

"use strict";

const ClassroomStudents = {
  apiBase:
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.protocol === "file:"
      ? "http://127.0.0.1:8000"
      : "https://api.andyazhtec.com",

  limit: 40,
  offset: 0,
  total: 0,
  loading: false,
  currentSearch: "",
  currentSource: "sheet2025",
  sortKey: "name",
  sortDirection: "asc",
  students: [],
  renderedStudents: [],

  sourceLabels: {
    sheet2025: "Supabase 2025",
  },

  init() {
    this.cacheDom();
    this.bindEvents();
    this.initWithdrawalRequestsPanel();
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
    if (this.grid && !this.grid.dataset.studentsEventsBound) {
      this.grid.dataset.studentsEventsBound = "1";

      this.grid.addEventListener("click", (event) => {
        const sortButton = event.target.closest("[data-students-sort]");
        if (sortButton) {
          this.toggleSort(sortButton.dataset.studentsSort);
          return;
        }

        const profileButton = event.target.closest("[data-student-profile]");
        if (profileButton) {
          this.openProfileByIndex(Number(profileButton.dataset.studentProfile));
          return;
        }

        const withdrawButton = event.target.closest("[data-student-withdraw]");
        if (withdrawButton) {
          this.withdrawStudentByIndex(Number(withdrawButton.dataset.studentWithdraw));
          return;
        }
      });
    }

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
        this.currentSource = this.sourceSelect.value || "sheet2025";
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
    return this.sourceSelect?.value || this.currentSource || "sheet2025";
  },

  getSourceLabel(source = this.getSelectedSource()) {
    return this.sourceLabels[source] || "Supabase 2025";
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

    const token =
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      session?.exampro?.token ||
      session?.access_token || session?.token || session?.accessToken ||
      "";

    if (token) {
      headers.Authorization = `Bearer ${token}`;
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

  buildSupabase2025Url(search = "") {
    const params = new URLSearchParams({
      course: "ayrpc-2025",
      limit: "2000",
      offset: "0",
    });

    if (search) {
      params.set("search", search);
    }

    return `${this.apiBase}/api/classroom/admin/attendance/students?${params.toString()}`;
  },

  async fetchSupabase2025Students() {
    const data = await this.fetchJson(this.buildSupabase2025Url(""), {
      cache: "no-store",
      headers: this.getAuthHeaders(),
    });

    if (!data.ok) {
      throw new Error(data.error || data.detail || "No se pudo leer Supabase AyRPC 2025.");
    }

    return Array.isArray(data.items)
      ? data.items.map(item => this.normalizeSheetStudent(item))
      : [];
  },
  async loadSheetStudents() {
    const allItems = await this.fetchSupabase2025Students();
    const items = this.filterLocalStudents(allItems);

    this.students = items;
    this.total = items.length;
    this.offset = items.length;
  },

  async loadAllStudents() {
    const [examproItems, sheetItems] = await Promise.all([
      this.fetchAllExamProStudents(),
      this.fetchSupabase2025Students(),
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
        source: "ExamPro + Supabase 2025",
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
    const dni = String(student.dni || student.DNI || "").replace(/\D+/g, "");
    const twitch = String(
      student.twitch_normalized ||
      student.twitch ||
      student["Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)"] ||
      student["Usuario de Twitch (en caso de no tener, debera crear uno y usarlo en la cursada)"] ||
      ""
    )
      .trim()
      .toLowerCase()
      .replace(/^@/, "");

    const fullName =
      student.full_name_normalized ||
      student.full_name_raw ||
      student.full_name ||
      student.nombre ||
      student["Nombre Completo"] ||
      "";

    const email = student.email || student.Correo || "";
    const telefono = student.phone_display || student.telefono || student["Teléfono (con Código de Área)"] || student["Telefono (con Codigo de Area)"] || "";

    return {
      ...student,
      id: student.id || student.legacy_row || (dni ? `sheet-2025-${dni}` : ""),
      source: "Supabase AyRPC 2025",
      cursada: student.cursada || "AyRPC 2025",
      full_name: fullName,
      nombre: fullName,
      email,
      telefono,
      whatsapp_number: student.whatsapp_number || "",
      twitch,
      dni,
      apt_examen: student.apt_examen || student.apt_calculated || student.apt_sheet || student.APTO || "",
      resultado: student.resultado || student.result || student.Resultado || "",
      exam_status: student.exam_status || student.participated || "",
      recuperatorio: student.recuperatorio || student.recovery || student.Recuperatorio || "",
      observaciones: student.observaciones || student.observations || student.Observaciones || "",
      mail_enviado: student.mail_enviado || student["Mail enviado"] || "",
      valid_classes: student.valid_classes || 0,
      stats: student.stats || {
        examenes_total: student.result || student.resultado ? 1 : 0,
        emails_total: email ? 1 : 0,
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
      this.renderedStudents = [];
      this.grid.innerHTML = "";
      return;
    }

    this.renderedStudents = this.getSortedStudents(this.students);

    const rows = this.renderedStudents
      .map((student, index) => this.createStudentRow(student, index))
      .join("");

    this.grid.innerHTML = `
      <div class="students-table-wrap compact">
        <table class="students-table students-table-compact">
          <thead>
            <tr>
              <th>${this.getSortButton("name", "Alumno")}</th>
              <th>${this.getSortButton("dni", "DNI")}</th>
              <th>${this.getSortButton("twitch", "Twitch")}</th>
              <th>${this.getSortButton("cursada", "Cursada")}</th>
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
    const twitch = student.twitch ? `@${String(student.twitch).replace(/^@/, "")}` : "\u2014";
    const dni = student.dni || "\u2014";
    const cursada = student.cursada || "AyRPC 2025";
    const source = student.source || this.getSourceLabel();
    const fichaId = student.exampro?.id || student.id || dni || "";
    const sourceDetail = this.getStudentSourceDetail(student, source, dni, fichaId);
    const enrollmentStatus = String(student.enrollment_status || student.estado || "").trim().toUpperCase();
    const isWithdrawn = enrollmentStatus === "BAJA";

    return `
      <tr>
        <td class="students-table-name-cell">
          <div class="students-table-student">
            <div class="student-table-avatar">
              <i class="fa-solid fa-user-graduate"></i>
            </div>

            <div>
              <strong>${this.escapeHtml(name)}</strong>
              <small>${this.escapeHtml(sourceDetail)}</small>
            </div>
          </div>
        </td>

        <td class="students-table-dni">${this.escapeHtml(dni)}</td>
        <td class="students-table-twitch">${this.escapeHtml(twitch)}</td>

        <td>
          <span class="student-badge course">
            ${this.escapeHtml(cursada)}
          </span>
        </td>

        <td>
          <div class="students-table-actions">
            <button class="btn btn-outline btn-table" type="button" data-student-profile="${index}" title="Ver ficha">
              <i class="fa-solid fa-address-card"></i>
              <span>Ficha</span>
            </button>

            <button class="btn btn-outline btn-table danger-btn" type="button" data-student-withdraw="${index}" title="${isWithdrawn ? "Alumno dado de baja" : "Dar de baja"}" ${isWithdrawn ? "disabled" : ""}>
              <i class="fa-solid fa-user-slash"></i>
              <span>${isWithdrawn ? "Baja" : "Dar baja"}</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  },

  initWithdrawalRequestsPanel() {
    this.ensureWithdrawalRequestsPanel();
    this.bindWithdrawalRequestsPanel();
    this.renderWithdrawalRequestsPanel();
  },

  ensureWithdrawalRequestsPanel() {
    let panel = document.getElementById("solicitudes-baja-curso");

    if (panel) return panel;

    const host =
      document.querySelector(".students-list-panel") ||
      document.querySelector(".students-page-panel") ||
      document.querySelector("main") ||
      document.body;

    panel = document.createElement("section");
    panel.id = "solicitudes-baja-curso";
    panel.className = "admin-data-change-panel panel admin-withdrawal-panel";
    panel.innerHTML = `
      <div class="admin-data-change-head">
        <div>
          <p class="eyebrow danger">Bajas de cursada</p>
          <h2>Solicitudes de baja</h2>
          <p>Pedidos enviados por alumnos desde Gestion. Al aprobar una baja, el alumno deja de poder acceder al Classroom.</p>
        </div>

        <div class="admin-data-change-actions">
          <button type="button" id="adminWithdrawalRefresh">
            <i class="fa-solid fa-rotate"></i>
            Actualizar
          </button>
          <span class="admin-data-change-counter" id="adminWithdrawalCounter">0 pendientes</span>
        </div>
      </div>

      <div class="admin-data-change-list" id="adminWithdrawalList">
        <div class="admin-data-change-empty">
          <i class="fa-solid fa-spinner fa-spin"></i>
          <span>Cargando solicitudes de baja...</span>
        </div>
      </div>
    `;

    if (host.classList?.contains("students-list-panel")) {
      host.insertAdjacentElement("beforebegin", panel);
    } else if (host.classList?.contains("students-page-panel")) {
      host.appendChild(panel);
    } else {
      host.prepend(panel);
    }

    return panel;
  },

  bindWithdrawalRequestsPanel() {
    if (this.withdrawalRequestsPanelBound) return;

    this.withdrawalRequestsPanelBound = true;

    document.addEventListener("click", async (event) => {
      const refreshButton = event.target.closest("#adminWithdrawalRefresh");
      if (refreshButton) {
        this.renderWithdrawalRequestsPanel();
        return;
      }

      const approveButton = event.target.closest("[data-withdrawal-approve]");
      if (!approveButton) return;

      const requestId = approveButton.dataset.withdrawalApprove;
      const ok = window.confirm("Confirmas aprobar la baja? El alumno dejara de poder acceder al Classroom.");

      if (!ok) return;

      const notes = window.prompt("Opcional: nota interna de resolucion.", "") || "";

      approveButton.disabled = true;
      approveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aplicando...';

      try {
        await this.approveWithdrawalRequest(requestId, notes.trim());
        alert("Baja aplicada correctamente.");
        this.renderWithdrawalRequestsPanel();
        this.loadStudents(true);
      } catch (error) {
        alert("Error: " + (error?.message || "No se pudo aprobar la baja."));
        this.renderWithdrawalRequestsPanel();
      }
    });
  },

  async fetchWithdrawalRequests(status = "all") {
    const url = `${this.getApiBase()}/api/classroom/admin/withdrawal-requests?course=ayrpc-2025&status=${encodeURIComponent(status)}&limit=100`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: this.getAuthHeaders(),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.detail || data?.error || "No se pudieron cargar las solicitudes de baja.");
    }

    return Array.isArray(data?.items) ? data.items : [];
  },

  async approveWithdrawalRequest(requestId, notes = "") {
    const response = await fetch(`${this.getApiBase()}/api/classroom/admin/withdrawal-requests/${encodeURIComponent(requestId)}/approve`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({
        notes,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(data?.detail || data?.error || "No se pudo aprobar la baja.");
    }

    return data;
  },

  async renderWithdrawalRequestsPanel() {
    const panel = this.ensureWithdrawalRequestsPanel();
    const list = panel.querySelector("#adminWithdrawalList");
    const counter = panel.querySelector("#adminWithdrawalCounter");

    if (!list || !counter) return;

    try {
      const items = await this.fetchWithdrawalRequests("all");
      const pending = items.filter((item) => item.status === "pending");

      counter.textContent = `${pending.length} pendiente${pending.length === 1 ? "" : "s"}`;

      if (!items.length) {
        list.innerHTML = `
          <div class="admin-data-change-empty">
            <i class="fa-solid fa-circle-check"></i>
            <span>No hay solicitudes de baja por ahora.</span>
          </div>
        `;
        return;
      }

      list.innerHTML = items.map((item) => {
        const isApproved = item.status === "approved";
        const statusLabel = isApproved ? "Aprobada" : item.status === "rejected" ? "Rechazada" : "Pendiente";

        return `
          <article class="admin-data-change-item ${isApproved ? "is-resolved" : "is-pending"}" data-withdrawal-id="${this.escapeHtml(item.id)}">
            <div class="admin-data-change-alert">
              <i class="fa-solid ${isApproved ? "fa-user-slash" : "fa-triangle-exclamation"}"></i>
            </div>

            <div class="admin-data-change-body">
              <div class="admin-data-change-titleline">
                <strong>${this.escapeHtml(item.student_name || "Alumno")}</strong>
                <span>${this.escapeHtml(statusLabel)}</span>
              </div>

              <p>${this.escapeHtml(item.reason || "Sin motivo detallado.")}</p>

              <div class="admin-data-change-meta">
                ${item.dni ? `<span>DNI: ${this.escapeHtml(item.dni)}</span>` : ""}
                ${item.twitch ? `<span>Twitch: ${this.escapeHtml(item.twitch)}</span>` : ""}
                ${item.email ? `<span>Email: ${this.escapeHtml(item.email)}</span>` : ""}
                ${item.created_at ? `<span>${this.escapeHtml(new Date(item.created_at).toLocaleString("es-AR"))}</span>` : ""}
              </div>

              <div class="admin-data-change-actions">
                ${item.status === "pending" ? `
                  <button type="button" class="danger" data-withdrawal-approve="${this.escapeHtml(item.id)}">
                    <i class="fa-solid fa-user-slash"></i>
                    Aprobar baja
                  </button>
                ` : `
                  <button type="button" disabled>
                    <i class="fa-solid fa-check"></i>
                    Baja aplicada
                  </button>
                `}
              </div>
            </div>
          </article>
        `;
      }).join("");
    } catch (error) {
      counter.textContent = "Error";
      list.innerHTML = `
        <div class="admin-data-change-empty">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>${this.escapeHtml(error?.message || "No se pudieron cargar las solicitudes de baja.")}</span>
        </div>
      `;
    }
  },

  getApiBase() {
    const configured =
      window.CLASSROOM_API_BASE ||
      window.EXAMPRO_API_BASE ||
      localStorage.getItem("andyazh-api-base") ||
      "";

    if (configured) {
      return String(configured).replace(/\/+$/, "");
    }

    const host = window.location.hostname;

    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:8000";
    }

    return "https://api.andyazhtec.com";
  },

  getClassroomToken() {
    const keys = [
      "andyazh-classroom-session",
      "andyazhClassroomSession",
      "classroomSession",
      "exampro_student_session",
      "examproSession",
    ];

    for (const key of keys) {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);

      if (!raw) continue;

      try {
        const session = JSON.parse(raw);

        const token =
          session?.classroomReadToken ||
          session?.exampro?.accessToken ||
          session?.exampro?.access_token ||
          session?.accessToken ||
          session?.access_token ||
          session?.token ||
          "";

        if (token) return token;
      } catch {
        // Ignorar sesiones invalidas.
      }
    }

    return "";
  },

  getAuthHeaders() {
    const token = this.getClassroomToken();

    if (!token) {
      throw new Error("No se encontro token Classroom.");
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  },

  async withdrawStudentByIndex(index) {
    const student = this.renderedStudents?.[index];

    if (!student) {
      alert("No se pudo identificar al alumno.");
      return;
    }

    const dni = String(student.dni || student.DNI || "").replace(/\D+/g, "");
    const name = student.full_name || student.nombre || student.display_name || student.twitch || "Alumno";

    if (!dni) {
      alert("Este alumno no tiene DNI valido para aplicar baja.");
      return;
    }

    const alreadyWithdrawn = String(student.enrollment_status || student.estado || "").trim().toUpperCase() === "BAJA";

    if (alreadyWithdrawn) {
      alert("Este alumno ya figura dado de baja.");
      return;
    }

    const confirmed = window.confirm(`Confirmas dar de baja a ${name}? El alumno dejara de poder acceder al Classroom.`);

    if (!confirmed) return;

    const notes = window.prompt("Opcional: nota interna de baja.", "Baja directa desde panel de alumnos.") || "";

    try {
      const response = await fetch(`${this.getApiBase()}/api/classroom/admin/students/${encodeURIComponent(dni)}/withdraw`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          reason: notes.trim() || "Baja directa desde panel de alumnos.",
          notes: notes.trim() || "Baja directa confirmada.",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        const message = data?.detail || data?.error || "No se pudo aplicar la baja.";
        alert("Error: " + message);
        return;
      }

      student.enrollment_status = "BAJA";
      student.estado = "baja";

      const key = this.getStudentKey(student);
      if (key) {
        this.students = this.students.map((item) => {
          if (this.getStudentKey(item) !== key) return item;

          return {
            ...item,
            enrollment_status: "BAJA",
            estado: "baja",
          };
        });
      }

      this.renderTable();
      alert("Baja aplicada correctamente. El alumno ya no podra acceder al Classroom.");
    } catch (error) {
      alert("No se pudo aplicar la baja.");
    }
  },

  getSortButton(key, label) {
    const active = this.sortKey === key;
    const icon = active
      ? this.sortDirection === "asc"
        ? "fa-arrow-up-a-z"
        : "fa-arrow-down-z-a"
      : "fa-sort";

    return `
      <button class="students-sort-btn ${active ? "active" : ""}" type="button" data-students-sort="${key}" title="Ordenar ${this.escapeHtml(label)}">
        <span>${this.escapeHtml(label)}</span>
        <i class="fa-solid ${icon}"></i>
      </button>
    `;
  },

  toggleSort(key) {
    if (!key) return;

    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortKey = key;
      this.sortDirection = "asc";
    }

    this.renderTable();
  },

  getSortedStudents(items) {
    const direction = this.sortDirection === "desc" ? -1 : 1;
    const key = this.sortKey || "name";

    return [...items].sort((a, b) => {
      const valueA = this.getSortValue(a, key);
      const valueB = this.getSortValue(b, key);

      if (key === "dni") {
        const numA = Number(String(valueA).replace(/\D+/g, "")) || 0;
        const numB = Number(String(valueB).replace(/\D+/g, "")) || 0;
        return (numA - numB) * direction;
      }

      return String(valueA).localeCompare(String(valueB), "es", {
        sensitivity: "base",
        numeric: true,
      }) * direction;
    });
  },

  getSortValue(student, key) {
    if (key === "dni") return student.dni || student.DNI || "";
    if (key === "twitch") return student.twitch || "";
    if (key === "cursada") return student.cursada || "";
    return student.full_name || student.nombre || student.display_name || student.twitch || "";
  },

  getStudentSourceDetail(student, source, dni, fichaId) {
    if (source === "Supabase 2025") {
      return dni && dni !== "\u2014" ? `Supabase 2025 \u00B7 DNI ${dni}` : "Supabase 2025";
    }

    if (source === "ExamPro + Supabase 2025") {
      return dni && dni !== "\u2014" ? `ExamPro + Planilla \u00B7 DNI ${dni}` : "ExamPro + Planilla";
    }

    return fichaId ? `ExamPro \u00B7 ID ${fichaId}` : "ExamPro";
  },

  openProfileByIndex(index) {
    const student = this.renderedStudents[index] || this.students[index];

    if (!student) return;

    this.ensureProfileModal();

    const name = student.full_name || student.nombre || student.display_name || student.twitch || "Alumno sin nombre";
    const twitch = student.twitch ? `@${String(student.twitch).replace(/^@/, "")}` : "\u2014";
    const dni = student.dni || "\u2014";
    const email = student.email || "";
    const phone = student.telefono || "";
    const cursada = student.cursada || "AyRPC 2025";
    const source = student.source || this.getSourceLabel();
    const fichaId = student.exampro?.id || student.id || dni || "";
    const estado = this.formatStatus(student.apt_examen || student.estado || "");
    const examStatus = this.getExamStatus(student);
    const recoveryStatus = this.getRecoveryStatus(student);
    const mailHref = email ? `mailto:${encodeURIComponent(email)}` : "";
    const whatsappHref = this.getWhatsappHref(phone);

    this.profileModalBody.innerHTML = `
      <div class="student-profile-card-floating">
        <div class="student-profile-top">
          <div class="student-profile-avatar">
            <i class="fa-solid fa-user-graduate"></i>
          </div>

          <div>
            <p class="eyebrow">${this.escapeHtml(source)}</p>
            <h3>${this.escapeHtml(name)}</h3>
            <p>${this.escapeHtml(twitch)} \u00B7 DNI ${this.escapeHtml(dni)}</p>
          </div>
        </div>

        <div class="student-profile-grid">
          ${this.profileField("Telefono", phone || "\u2014", "fa-phone")}
          ${this.profileField("Correo", email || "\u2014", "fa-envelope")}
          ${this.profileField("Cursada", cursada, "fa-book-open-reader")}
          ${this.profileField("Estado", estado.label, estado.icon)}
          ${this.profileField("Examen", examStatus.label, examStatus.icon)}
          ${this.profileField("Recup.", recoveryStatus.label, recoveryStatus.icon)}
        </div>

        <div class="student-profile-actions">
          ${email ? `
            <a class="btn btn-outline btn-table-contact" href="${mailHref}">
              <i class="fa-solid fa-envelope"></i>
              <span>Enviar mail</span>
            </a>
          ` : `
            <span class="btn btn-outline btn-table-disabled">
              <i class="fa-solid fa-envelope"></i>
              <span>Sin mail</span>
            </span>
          `}

          ${whatsappHref ? `
            <a class="btn btn-outline btn-table-contact" href="${whatsappHref}" target="_blank" rel="noopener">
              <i class="fa-brands fa-whatsapp"></i>
              <span>WhatsApp</span>
            </a>
          ` : `
            <span class="btn btn-outline btn-table-disabled">
              <i class="fa-brands fa-whatsapp"></i>
              <span>Sin WhatsApp</span>
            </span>
          `}
        </div>

        <small class="student-profile-source">${this.escapeHtml(this.getStudentSourceDetail(student, source, dni, fichaId))}</small>
      </div>
    `;

    this.profileModal.classList.add("show");
    document.body.classList.add("student-profile-open");
  },

  profileField(label, value, icon) {
    return `
      <div class="student-profile-field">
        <span>
          <i class="fa-solid ${this.escapeHtml(icon)}"></i>
          ${this.escapeHtml(label)}
        </span>
        <strong>${this.escapeHtml(value || "\u2014")}</strong>
      </div>
    `;
  },

  ensureProfileModal() {
    if (this.profileModal) return;

    const modal = document.createElement("div");
    modal.className = "student-profile-modal";
    modal.innerHTML = `
      <div class="student-profile-backdrop" data-student-profile-close></div>

      <section class="student-profile-dialog" role="dialog" aria-modal="true" aria-label="Ficha de alumno">
        <button class="student-profile-close" type="button" data-student-profile-close aria-label="Cerrar ficha">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="student-profile-body"></div>
      </section>
    `;

    document.body.appendChild(modal);

    this.profileModal = modal;
    this.profileModalBody = modal.querySelector(".student-profile-body");

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-student-profile-close]")) {
        this.closeProfile();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.profileModal?.classList.contains("show")) {
        this.closeProfile();
      }
    });
  },

  closeProfile() {
    if (!this.profileModal) return;

    this.profileModal.classList.remove("show");
    document.body.classList.remove("student-profile-open");
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
        label: "EN REVISION",
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

    const normalized = clean
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    if (
      !clean ||
      normalized.includes("listo para cargar notas") ||
      normalized.includes("hoja recuperatorios")
    ) {
      return {
        label: "\u2014",
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

/* === Alumnos Data Change Requests Admin 20260621 === */
(function initAlumnosDataChangeRequestsAdmin() {
  "use strict";

  const STORAGE_KEY = "andyazh-classroom-data-change-requests-v1";

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  }

  function getRequests() {
    return safeJson(localStorage.getItem(STORAGE_KEY), []);
  }

  function saveRequests(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("classroom:data-change-requests-updated", {
      detail: { items },
    }));
  }

  function formatDate(value) {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensurePanel() {
    let panel = document.getElementById("solicitudes-cambios-datos");

    if (panel) return panel;

    const main = document.querySelector("main .main-content")
      || document.querySelector("main")
      || document.body;

    panel = document.createElement("section");
    panel.id = "solicitudes-cambios-datos";
    panel.className = "admin-data-change-panel panel";
    panel.innerHTML = `
      <div class="admin-data-change-head">
        <div>
          <p class="eyebrow danger">Revision requerida</p>
          <h2>Solicitudes de cambio de datos</h2>
          <p>Pedidos enviados por alumnos cuando detectan un dato incorrecto en su perfil.</p>
        </div>

        <span class="admin-data-change-counter" id="adminDataChangeCounter">0 pendientes</span>
      </div>

      <div class="admin-data-change-list" id="adminDataChangeList"></div>
    `;

    const firstPanel = main.querySelector(".panel, section, article");
    if (firstPanel) {
      firstPanel.insertAdjacentElement("beforebegin", panel);
    } else {
      main.prepend(panel);
    }

    return panel;
  }

  function render() {
    const panel = ensurePanel();
    const list = panel.querySelector("#adminDataChangeList");
    const counter = panel.querySelector("#adminDataChangeCounter");

    const requests = getRequests();
    const pending = requests.filter((item) => item.status !== "resuelta");

    counter.textContent = `${pending.length} pendiente${pending.length === 1 ? "" : "s"}`;

    if (!requests.length) {
      panel.classList.add("is-empty");
      list.innerHTML = `
        <div class="admin-data-change-empty">
          <i class="fa-solid fa-circle-check"></i>
          <span>No hay solicitudes de cambio de datos por ahora.</span>
        </div>
      `;
      return;
    }

    panel.classList.remove("is-empty");

    list.innerHTML = requests.map((item) => {
      const isResolved = item.status === "resuelta";

      return `
        <article class="admin-data-change-item ${isResolved ? "is-resolved" : "is-pending"}" data-request-id="${escapeHtml(item.id)}">
          <div class="admin-data-change-alert">
            <i class="fa-solid ${isResolved ? "fa-circle-check" : "fa-triangle-exclamation"}"></i>
          </div>

          <div class="admin-data-change-body">
            <div class="admin-data-change-titleline">
              <strong>${escapeHtml(item.studentName || "Alumno")}</strong>
              <span>${isResolved ? "Resuelta" : "Pendiente"}</span>
            </div>

            <p>${escapeHtml(item.detail || "")}</p>

            <div class="admin-data-change-meta">
              ${item.dni ? `<span>DNI: ${escapeHtml(item.dni)}</span>` : ""}
              ${item.twitch ? `<span>Twitch: ${escapeHtml(item.twitch)}</span>` : ""}
              ${item.email ? `<span>Email: ${escapeHtml(item.email)}</span>` : ""}
              <span>${escapeHtml(formatDate(item.createdAt))}</span>
            </div>

            <div class="admin-data-change-actions">
              <button type="button" data-request-resolve="${escapeHtml(item.id)}">
                <i class="fa-solid fa-check"></i>
                ${isResolved ? "Marcar pendiente" : "Marcar revisada"}
              </button>

              <button type="button" class="danger" data-request-delete="${escapeHtml(item.id)}">
                <i class="fa-solid fa-trash"></i>
                Eliminar
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function bindDelegatedActions() {
    if (window.__classroomDataChangeAdminBound) return;
    window.__classroomDataChangeAdminBound = true;

    document.addEventListener("click", (event) => {
      const resolveButton = event.target.closest("[data-request-resolve]");
      if (resolveButton) {
        const id = resolveButton.dataset.requestResolve;
        const requests = getRequests().map((item) => {
          if (item.id !== id) return item;

          return {
            ...item,
            status: item.status === "resuelta" ? "pendiente" : "resuelta",
            updatedAt: new Date().toISOString(),
          };
        });

        saveRequests(requests);
        render();
        return;
      }

      const deleteButton = event.target.closest("[data-request-delete]");
      if (deleteButton) {
        const ok = window.confirm("Eliminar esta solicitud de cambio de datos?");
        if (!ok) return;

        const id = deleteButton.dataset.requestDelete;
        const requests = getRequests().filter((item) => item.id !== id);

        saveRequests(requests);
        render();
      }
    });
  }

  function init() {
    render();
    bindDelegatedActions();

    if (window.location.hash === "#solicitudes-cambios-datos") {
      setTimeout(() => {
        document.getElementById("solicitudes-cambios-datos")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 150);
    }
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) render();
  });

  window.addEventListener("classroom:data-change-requests-updated", render);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
