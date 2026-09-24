const CursoAyRPC2026Panel = {
  courseSlug: "ayrpc-2026",
  classes: [
    { n: 1, title: "Presentación e introducción", statusKey: "class_1_status", timeKey: "class_1_time" },
    { n: 2, title: "Componentes de una PC", statusKey: "class_2_status", timeKey: "class_2_time" },
    { n: 3, title: "Compatibilidad y armado", statusKey: "class_3_status", timeKey: "class_3_time" },
    { n: 4, title: "Sistemas operativos", statusKey: "class_4_status", timeKey: "class_4_time" },
    { n: 5, title: "BIOS / UEFI", statusKey: "class_5_status", timeKey: "class_5_time" },
    { n: 6, title: "Drivers y herramientas", statusKey: "class_6_status", timeKey: "class_6_time" },
    { n: 7, title: "Microsoldadura · Parte 1", statusKey: "class_7_status", timeKey: "class_7_time" },
    { n: 8, title: "Microsoldadura · Parte 2", statusKey: "class_8_status", timeKey: "class_8_time" },
    { n: 9, title: "Diagnóstico y solución de problemas", statusKey: "class_9_status", timeKey: "class_9_time" },
    { n: 10, title: "Redes", statusKey: "class_10_status", timeKey: "class_10_time" },
    { n: 11, title: "Introducción a la ciberseguridad", statusKey: "class_11_status", timeKey: "class_11_time" },
    { n: 12, title: "Malware y protección", statusKey: "class_12_status", timeKey: "class_12_time" },
  ],

  async init() {
    const session = this.getSession();

    if (!session) return;

    const courseStatusData = await this.refreshFromCourseStatus(session);

    if (!courseStatusData) {
      this.paintUnavailable();
      this.paintAttendance(Object.fromEntries(this.classes.map(item => [item.statusKey, "PENDIENTE"])));
      return;
    }

    this.paintCourseState(courseStatusData);
    this.paintAttendance(courseStatusData);
  },

  getSession() {
    if (typeof ClassroomAuth === "undefined") return null;
    return ClassroomAuth.getSession();
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

  getClassroomToken(session) {
    return (
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      session?.exampro?.access_token ||
      session?.accessToken ||
      session?.access_token ||
      session?.token ||
      ""
    );
  },

  normalizeStatus(value) {
    return String(value || "").trim().toUpperCase();
  },

  isCovered(status) {
    return ["PRESENTE", "RECUPERADA"].includes(this.normalizeStatus(status));
  },

  getValue(obj, keys, fallback = "—") {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return fallback;
  },

  getStatusByKey(alumno, key) {
    const variants = [
      key,
      key.replace("–", "-"),
      key.replace("-", "–"),
    ];

    return this.getValue(alumno, variants, "-");
  },

  getTimeByKey(alumno, key) {
    const variants = [
      key,
      key.replace("–", "-"),
      key.replace("-", "–"),
    ];

    return this.getValue(alumno, variants, "");
  },

  parseTimeToSeconds(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw || raw === "-" || raw === "proximamente") return 0;

    const h = Number((raw.match(/(\d+)\s*h/) || [0, 0])[1]);
    const m = Number((raw.match(/(\d+)\s*m/) || [0, 0])[1]);
    const s = Number((raw.match(/(\d+)\s*s/) || [0, 0])[1]);

    if (h || m || s) return (h * 3600) + (m * 60) + s;

    const numeric = Number(raw.replace(",", "."));
    return Number.isFinite(numeric) ? numeric : 0;
  },

  formatSeconds(seconds) {
    const total = Math.max(0, Number(seconds || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);

    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    if (s) return `${s}s`;
    return "—";
  },

  async refreshFromCourseStatus(session) {
    const token = this.getClassroomToken(session);

    if (!token) return null;

    try {
      const response = await fetch(
        `${this.getApiBase()}/api/classroom/me/course-status?course=${this.courseSlug}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) return null;

      const raw = data.raw || {};
      const attendance = Array.isArray(data.attendance)
        ? data.attendance
        : [];

      const courseState = {
        __courseStatus: data,
      };

      this.classes.forEach((item) => {
        const row =
          attendance.find(
            (entry) => Number(entry.class_number) === Number(item.n)
          ) || {};

        courseState[item.statusKey] =
          row.status ||
          raw[`class_${item.n}_status`] ||
          "";

        courseState[item.timeKey] =
          row.time ||
          raw[`class_${item.n}_time`] ||
          "";
      });

      return courseState;
    } catch (error) {
      console.warn("No se pudo cargar el estado de cursada:", error);
      return null;
    }
  },
  paintUnavailable() {
    const state = document.getElementById("ayrpcCourseState");
    const detail = document.getElementById("ayrpcCourseStateDetail");
    const source = document.getElementById("ayrpcDataSource");

    // 24/10/2026 00:00 en Argentina (UTC-3).
    const courseStart = Date.parse("2026-10-24T03:00:00Z");
    const isUpcoming = Date.now() < courseStart;

    if (isUpcoming) {
      if (state) state.textContent = "Inicia el 24 de octubre";
      if (detail) {
        detail.textContent =
          "La cursada todavía no comenzó. Por ahora vas a ver tu asistencia y tiempos como pendientes.";
      }
      if (source) {
        source.textContent = "Próximamente";
        source.className = "status-badge";
      }
      return;
    }

    if (state) state.textContent = "No se pudo cargar la cursada";
    if (detail) {
      detail.textContent = "Recargá la página o intentá nuevamente más tarde.";
    }
    if (source) {
      source.textContent = "Sin conexión";
      source.className = "status-badge";
    }
  },
  paintCourseState(alumno) {
    const data = alumno?.__courseStatus || {};
    const academic = data.academic || {};
    const course = data.course || {};
    const raw = data.raw || {};

    const state = document.getElementById("ayrpcCourseState");
    const detail = document.getElementById("ayrpcCourseStateDetail");
    const source = document.getElementById("ayrpcDataSource");

    const courseStatus = this.normalizeStatus(
      course.status ||
      raw.course_status ||
      ""
    );

    const finalStatus = this.normalizeStatus(
      academic.final_status ||
      academic.result ||
      raw.final_status ||
      ""
    );

    let label = "Estado sincronizado";

    if (
      courseStatus === "UPCOMING" ||
      courseStatus === "PENDING" ||
      courseStatus === "NOT_STARTED"
    ) {
      label = "Inicia el 24 de octubre";
    } else if (
      courseStatus === "FINISHED" ||
      courseStatus === "CLOSED" ||
      finalStatus === "PASSED"
    ) {
      label = "Finalizado";
    } else if (courseStatus === "ACTIVE") {
      label = "Cursada activa";
    } else if (finalStatus) {
      label = finalStatus.replaceAll("_", " ");
    }

    const validClasses =
      academic.valid_classes ??
      data.valid_classes ??
      raw.valid_classes;

    const attendancePercent =
      academic.attendance_percent ??
      data.attendance_percent ??
      raw.attendance_percent;

    const parts = [];

    if (validClasses !== undefined && validClasses !== null) {
      parts.push(`${validClasses} clases válidas`);
    }

    if (
      attendancePercent !== undefined &&
      attendancePercent !== null &&
      attendancePercent !== ""
    ) {
      parts.push(`${attendancePercent}% de asistencia`);
    }

    if (state) state.textContent = label;

    if (detail) {
      detail.textContent = parts.length
        ? parts.join(" · ")
        : "Tu estado y asistencias se muestran directamente desde Classroom.";
    }

    if (source) {
      source.textContent = "Datos sincronizados";
      source.className = "status-badge active";
    }
  },
  paintAttendance(alumno) {
    const list = document.getElementById("ayrpcClassList");
    const chart = document.getElementById("ayrpcTimeChart");
    const totalBox = document.getElementById("ayrpcAttendanceTotal");
    const progress = document.getElementById("ayrpcAttendanceProgress");
    const totalTimeBox = document.getElementById("ayrpcTotalTime");
    const bestClassBox = document.getElementById("ayrpcBestClass");

    const rows = this.classes.map(item => {
      const status = this.normalizeStatus(this.getStatusByKey(alumno, item.statusKey));
      const timeRaw = this.getTimeByKey(alumno, item.timeKey);
      const seconds = this.parseTimeToSeconds(timeRaw);

      return { ...item, status, timeRaw, seconds };
    });

    const covered = rows.filter(row => this.isCovered(row.status)).length;
    const total = rows.length;
    const percent = Math.round((covered / total) * 100);
    const maxSeconds = Math.max(...rows.map(row => row.seconds), 1);
    const totalSeconds = rows.reduce((acc, row) => acc + row.seconds, 0);
    const best = [...rows].sort((a, b) => b.seconds - a.seconds)[0];

    totalBox.textContent = `${covered}/${total}`;
    progress.style.width = `${percent}%`;
    totalTimeBox.textContent = this.formatSeconds(totalSeconds);
    bestClassBox.textContent = best?.seconds ? `Clase ${best.n}` : "—";

    list.innerHTML = rows.map(row => {
      const cls = this.statusClass(row.status);

      return `
        <article class="ayrpc-class-row ${cls}">
          <div>
            <span>Clase ${row.n}</span>
            <strong>${row.title}</strong>
          </div>

          <div class="ayrpc-class-status">
            <b>${row.status || "-"}</b>
            <small>${row.timeRaw || "Sin tiempo registrado"}</small>
          </div>
        </article>
      `;
    }).join("");

    chart.innerHTML = rows.map(row => {
      const width = Math.max(4, Math.round((row.seconds / maxSeconds) * 100));
      return `
        <div class="ayrpc-chart-row">
          <span>C${row.n}</span>
          <div><b style="width:${width}%"></b></div>
          <small>${row.timeRaw || "—"}</small>
        </div>
      `;
    }).join("");
  },

  statusClass(status) {
    if (["PRESENTE", "RECUPERADA"].includes(status)) return "ok";
    if (status === "REVISAR") return "warn";
    if (status === "AUSENTE") return "bad";
    return "neutral";
  },

};

document.addEventListener("DOMContentLoaded", () => {
  CursoAyRPC2026Panel.init();
});
