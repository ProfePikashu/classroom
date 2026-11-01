(() => {
  "use strict";

  if (typeof AdminAsistencias === "undefined") return;

  const baseInit = AdminAsistencias.init;
  const baseNormalizeApiRow = AdminAsistencias.normalizeApiRow;
  const baseRenderKpis = AdminAsistencias.renderKpis;
  const baseEnableTableDragScroll = AdminAsistencias.enableTableDragScroll;
  const baseUpdateAttendanceStatus = AdminAsistencias.updateAttendanceStatus;

  AdminAsistencias.allClasses = [];
  AdminAsistencias.totalClassCount = 0;
  AdminAsistencias.selectedClassNumber = null;
  AdminAsistencias._attendanceLastCourse = "";

  AdminAsistencias.init = function () {
    this.classSelect = document.getElementById("attendanceClassSelect");

    baseInit.call(this);

    if (!this.canViewAttendance()) {
      if (this.classSelect) this.classSelect.disabled = true;
      return;
    }

    this.classSelect?.addEventListener("change", () => this.render());
  };

  AdminAsistencias.getSelectedClassNumber = function () {
    const raw = String(this.classSelect?.value || "all").trim().toLowerCase();
    if (!raw || raw === "all") return null;

    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  };

  AdminAsistencias.buildStudentsUrl = function () {
    const course = this.courseSelect?.value || "ayrpc-2026";
    const search = String(this.searchInput?.value || "").trim();
    const statusFilter = this.statusFilter?.value || "all";
    const selectedClassNumber = this.getSelectedClassNumber();

    const params = new URLSearchParams();
    params.set("course", course);
    params.set("limit", "1000");
    params.set("offset", "0");

    if (search) params.set("search", search);
    if (statusFilter && statusFilter !== "all") {
      params.set("status_filter", statusFilter);
    }
    if (selectedClassNumber !== null) {
      params.set("class_number", String(selectedClassNumber));
    }

    return `${this.apiBase}/api/classroom/admin/attendance/students?${params.toString()}`;
  };

  AdminAsistencias.syncClassSelect = function (catalog) {
    if (!this.classSelect) return;

    const desired = this.selectedClassNumber === null
      ? "all"
      : String(this.selectedClassNumber);

    const options = [
      '<option value="all">Todas las clases</option>',
      ...catalog.map(item => {
        const number = Number(item.n);
        const title = String(item.title || "").trim();
        const label = title
          ? `Clase ${number} · ${title}`
          : `Clase ${number}`;

        return `<option value="${number}">${this.escapeHtml(label)}</option>`;
      })
    ];

    this.classSelect.innerHTML = options.join("");

    const canKeepDesired = desired === "all" || catalog.some(
      item => String(item.n) === desired
    );

    this.classSelect.value = canKeepDesired ? desired : "all";
    this.selectedClassNumber = this.classSelect.value === "all"
      ? null
      : Number(this.classSelect.value);
  };

  AdminAsistencias.normalizeApiRow = function (row, course = "ayrpc-2026") {
    const normalized = baseNormalizeApiRow.call(this, row, course);
    const progressByClass = new Map(
      (Array.isArray(row.classes) ? row.classes : []).map(item => [
        Number(item.class_number),
        item
      ])
    );

    normalized.clases = this.clases.map(({ n }) => {
      const progress = progressByClass.get(Number(n)) || {};

      return [
        row[`class_${n}_status`] || progress.status || "PENDIENTE",
        row[`class_${n}_time`] || progress.time || "-",
        progress.live_presence_seconds ?? null,
        progress.live_presence_percent ?? null
      ];
    });

    const attendanceValid = Number(
      row.attendance_valid_classes ?? row.valid_classes ?? 0
    );

    normalized.validas = Number.isFinite(attendanceValid)
      ? attendanceValid
      : 0;

    return normalized;
  };

  AdminAsistencias.render = async function () {
    const curso = this.courseSelect?.value || "ayrpc-2026";
    const cursoLabel = this.cursos[curso] || "Cursada";
    const statusFilter = this.statusFilter?.value || "all";

    if (this._attendanceLastCourse !== curso) {
      this._attendanceLastCourse = curso;
      this.selectedClassNumber = null;
      if (this.classSelect) this.classSelect.value = "all";
    } else {
      this.selectedClassNumber = this.getSelectedClassNumber();
    }

    this.loading = true;
    this.lastError = "";

    if (this.status) {
      const scope = this.selectedClassNumber === null
        ? "todas las clases"
        : `Clase ${this.selectedClassNumber}`;
      this.status.textContent = `Cargando ${scope} de ${cursoLabel} desde Supabase...`;
    }

    if (this.tableWrap) {
      this.tableWrap.innerHTML = '<div class="attendance-empty">Cargando datos...</div>';
    }

    try {
      const studentsData = await this.requestJson(this.buildStudentsUrl());
      const rawRows = studentsData?.items || [];
      const apiCatalog = Array.isArray(studentsData?.classes)
        ? studentsData.classes
        : [];

      const fallbackTotal = curso === "ayrpc-2026" ? 12 : 7;
      this.allClasses = apiCatalog.length
        ? apiCatalog.map(item => ({
            n: Number(item.class_number),
            label: `Clase ${item.class_number}`,
            title: item.title || ""
          }))
        : Array.from({ length: fallbackTotal }, (_, index) => ({
            n: index + 1,
            label: `Clase ${index + 1}`,
            title: ""
          }));

      this.totalClassCount = this.allClasses.length || fallbackTotal;
      this.syncClassSelect(this.allClasses);

      this.clases = this.selectedClassNumber === null
        ? [...this.allClasses]
        : this.allClasses.filter(
            item => Number(item.n) === Number(this.selectedClassNumber)
          );

      let normalized = rawRows.map(row => this.normalizeApiRow(row, curso));

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
        const scope = this.selectedClassNumber === null
          ? "Todas las clases"
          : `Clase ${this.selectedClassNumber}`;

        this.status.innerHTML = `${this.escapeHtml(cursoLabel)}: ${active} alumnos activos${this.escapeHtml(suffix)}. <span class="attendance-class-context">${this.escapeHtml(scope)}</span> · Fuente: Supabase vía API Classroom.`;
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
  };

  AdminAsistencias.renderKpis = function (rows) {
    if (this.selectedClassNumber === null) {
      return baseRenderKpis.call(this, rows);
    }

    if (!this.kpis) return;

    const activeRows = rows.filter(row => !row.isWithdrawn);
    const statuses = activeRows.map(row => String(
      row.clases?.[0]?.[0] || "PENDIENTE"
    ).toUpperCase());

    const total = activeRows.length;
    const presentes = statuses.filter(value => value === "PRESENTE").length;
    const revisar = statuses.filter(value => value === "REVISAR").length;
    const ausentes = statuses.filter(value => value === "AUSENTE").length;
    const recuperadas = statuses.filter(value => value === "RECUPERADA").length;
    const pendientes = statuses.filter(
      value => !["PRESENTE", "REVISAR", "AUSENTE", "RECUPERADA"].includes(value)
    ).length;

    const items = [
      ["Total", total],
      ["Presentes", presentes],
      ["Revisar", revisar],
      ["Ausentes", ausentes],
      ["Recuperadas", recuperadas],
      ["Pendientes", pendientes]
    ];

    this.kpis.innerHTML = items.map(([label, value]) => `
      <div class="attendance-kpi">
        <span>${this.escapeHtml(label)}</span>
        <strong>${this.escapeHtml(value)}</strong>
      </div>
    `).join("");
  };

  AdminAsistencias.renderTable = function (rows) {
    if (!this.tableWrap) return;

    const totalClassCount = this.totalClassCount || this.clases.length || 1;
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
        ? '<span class="attendance-baja-badge">BAJA</span>'
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
          <td title="Clases con estado PRESENTE o RECUPERADA"><strong>${resumen.validas}/${totalClassCount}</strong></td>
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
                <th>Asistencias</th>
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
  };

  AdminAsistencias.openProfile = function (index) {
    const alumno = this.rows[index];
    if (!alumno || !this.modal || !this.modalBody) return;

    const resumen = this.getResumenAlumno(alumno);
    const totalClassCount = this.totalClassCount || this.clases.length || 1;
    const bajaBadge = alumno.isWithdrawn
      ? '<span class="attendance-baja-badge">BAJA</span>'
      : "";
    const classContext = this.selectedClassNumber === null
      ? "Todas las clases"
      : `Clase ${this.selectedClassNumber}`;

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
        ${this.profileField("Vista actual", classContext)}
        ${this.profileField("Inscripción", alumno.inscripcion)}
        ${this.profileField("Correo", alumno.email)}
        ${this.profileField("Teléfono", alumno.telefono)}
        ${this.profileField("Twitch login", alumno.twitch ? "@" + alumno.twitch : "-")}
        ${this.profileField("Asistencias", resumen.validas + "/" + totalClassCount)}
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
  };

  AdminAsistencias.updateAttendanceStatus = async function (editor) {
    const rowIndex = Number(editor?.dataset?.rowIndex);
    const classNumber = Number(editor?.dataset?.classNumber);
    const alumno = this.rows[rowIndex];
    const classIndex = this.clases.findIndex(
      item => Number(item.n) === classNumber
    );

    const previousStatus = String(
      editor?.dataset?.previousStatus || alumno?.clases?.[classIndex]?.[0] || "PENDIENTE"
    ).toUpperCase();
    const newStatus = String(editor?.value || "").toUpperCase();
    const attendanceBefore = Number(alumno?.validas || 0);
    const wasValid = this.estadoClaseValida(previousStatus);
    const willBeValid = this.estadoClaseValida(newStatus);

    await baseUpdateAttendanceStatus.call(this, editor);

    if (
      !alumno ||
      classIndex < 0 ||
      !newStatus ||
      newStatus === previousStatus ||
      !editor?.disabled
    ) {
      return;
    }

    const delta = Number(willBeValid) - Number(wasValid);
    alumno.validas = Math.max(
      0,
      Math.min(
        this.totalClassCount || 99,
        attendanceBefore + delta
      )
    );

    const scroller = this.tableWrap?.querySelector(".attendance-table-scroll");
    const scrollLeft = scroller?.scrollLeft || 0;
    this.renderKpis(this.rows);
    this.renderTable(this.rows);
    this.enableTableDragScroll();
    const nextScroller = this.tableWrap?.querySelector(".attendance-table-scroll");
    if (nextScroller) nextScroller.scrollLeft = scrollLeft;
    this.updateScrollButtons();
  };

  AdminAsistencias.enableTableDragScroll = function () {
    const coarsePointer = typeof window.matchMedia === "function"
      && window.matchMedia("(pointer: coarse)").matches;
    const compactViewport = window.innerWidth <= 900;

    if (!coarsePointer && !compactViewport) {
      this.updateScrollButtons();

      if (!this._resizeBound) {
        window.addEventListener("resize", () => this.updateScrollButtons());
        this._resizeBound = true;
      }

      return;
    }

    return baseEnableTableDragScroll.call(this);
  };
})();
