const AYRPC2025_RECUPERATORIO_URL = "https://profepikashu.github.io/exampro/recuperatorio/";

const CursoAyRPC2025Panel = {
  classes: [
    { n: 1, title: "Armado y Componentes", statusKey: "1erClase – Presente", timeKey: "1erClase – Tiempo" },
    { n: 2, title: "Instalación de SO", statusKey: "2daClase – Presente", timeKey: "2daClase – Tiempo" },
    { n: 3, title: "Programación de BIOS", statusKey: "3erClase – Presente", timeKey: "3erClase – Tiempo" },
    { n: 4, title: "Drivers y Software", statusKey: "4taClase – Presente", timeKey: "4taClase – Tiempo" },
    { n: 5, title: "Microsoldadura", statusKey: "5taClase – Presente", timeKey: "5taClase – Tiempo" },
    { n: 6, title: "Solución de problemas", statusKey: "6taClase – Presente", timeKey: "6taClase – Tiempo" },
    { n: 7, title: "Virus y Malware", statusKey: "UltimaClase – Presente", timeKey: "UltimaClase – Tiempo" },
  ],

  async init() {
    const session = this.getSession();

    if (!session) return;

    this.paintBaseSession(session);

    const supabaseData = await this.refreshFromSupabase(session);
    const courseStatusData = await this.refreshFromCourseStatus(session);

    const merged = this.mergeStudentData(session, supabaseData, courseStatusData);

    this.saveMergedSession(session, merged);
    this.paintStudent(merged, supabaseData, courseStatusData);
    this.paintAttendance(merged);
    this.paintRecovery(merged, supabaseData, courseStatusData);
    this.patchPelusita();
  },

  getSession() {
    if (typeof ClassroomAuth === "undefined") return null;
    return ClassroomAuth.getSession();
  },

  normalizeDni(value) {
    return String(value || "").replace(/\D+/g, "");
  },

  normalizeText(value) {
    return String(value || "").trim();
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

  paintBaseSession(session) {
    document.getElementById("ayrpcStudentName").textContent = session.displayName || session.twitch || "Alumno";
    document.getElementById("ayrpcStudentDni").textContent = session.dni || session.alumno?.DNI || "—";
    document.getElementById("ayrpcStudentTwitch").textContent = session.twitch ? `@${String(session.twitch).replace(/^@/, "")}` : "—";
    document.getElementById("ayrpcStudentEmail").textContent = session.email || session.alumno?.Correo || "—";
  },

  async refreshFromSupabase(session) {
    const dni = this.normalizeDni(session.dni || session.alumno?.DNI);
    const twitch = String(session.twitch || session.alumno?.["Usuario de Twitch"] || "").replace(/^@/, "");

    if (!dni || !twitch || typeof EXAMPRO_API_BASE === "undefined") return null;

    try {
      const response = await fetch(`${EXAMPRO_API_BASE}/api/classroom/student-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni, twitch }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data?.student || null;
    } catch (error) {
      console.warn("No se pudo refrescar Supabase/ExamPro:", error);
      return null;
    }
  },

  async refreshFromCourseStatus(session) {
    const token = this.getClassroomToken(session);

    if (!token) return null;

    try {
      const response = await fetch(`${this.getApiBase()}/api/classroom/me/course-status?course=ayrpc-2025`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) return null;

      const student = data.student || {};
      const academic = data.academic || {};
      const raw = data.raw || {};
      const attendance = Array.isArray(data.attendance) ? data.attendance : [];

      const legacy = {
        ...raw,
        DNI: student.dni || raw.dni,
        Correo: student.email || raw.email,
        email: student.email || raw.email,
        "Nombre Completo": student.full_name || raw.full_name_normalized || raw.full_name_raw,
        full_name: student.full_name || raw.full_name_normalized || raw.full_name_raw,
        "Usuario de Twitch": student.twitch || raw.twitch_normalized,
        twitch: student.twitch || raw.twitch_normalized,
        APTO: academic.apt_calculated || raw.apt_calculated,
        "Apto": academic.apt_calculated || raw.apt_calculated,
        apt_examen: academic.apt_calculated || raw.apt_calculated,
        Resultado: academic.result || raw.result,
        resultado: academic.result || raw.result,
        Recuperatorio: academic.recovery || raw.recovery,
        recuperatorio: academic.recovery || raw.recovery,
      };

      this.classes.forEach((item) => {
        const row = attendance.find((entry) => Number(entry.class_number) === Number(item.n)) || {};
        legacy[item.statusKey] = row.status || raw[`class_${item.n}_status`] || "";
        legacy[item.timeKey] = row.time || raw[`class_${item.n}_time`] || "";
      });

      legacy.__courseStatus = data;

      return legacy;
    } catch (error) {
      console.warn("No se pudo refrescar estado de cursada desde Classroom:", error);
      return null;
    }
  },

  mergeStudentData(session, supabaseData, sheetData) {
    const alumno = {
      ...(session.alumno || {}),
      ...(sheetData || {}),
    };

    if (supabaseData) {
      alumno.__supabase = supabaseData;
      alumno.apt_examen = supabaseData.apt_examen || alumno.apt_examen;
      alumno.estado = supabaseData.estado || alumno.estado;
      alumno.email = supabaseData.email || alumno.email;
      alumno.student_id = supabaseData.id || alumno.student_id;
    }

    return alumno;
  },

  saveMergedSession(session, alumno) {
    session.alumno = alumno;
    session.dni = session.dni || alumno.DNI || alumno.dni;
    session.email = session.email || alumno.Correo || alumno.email || "";

    if (typeof ClassroomAuth !== "undefined") {
      ClassroomAuth.setSession(session);
    }
  },

  paintStudent(alumno, supabaseData, sheetData) {
    const fullName = this.getValue(alumno, ["Nombre Completo", "full_name", "nombre"], "Alumno");
    const dni = this.getValue(alumno, ["DNI", "dni"], "—");
    const twitch = this.getValue(alumno, [
      "Usuario de Twitch",
      "Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)",
      "twitch",
      "twitch_username"
    ], "—");
    const email = this.getValue(alumno, ["Correo", "email"], "—");

    document.getElementById("ayrpcStudentName").textContent = fullName;
    document.getElementById("ayrpcStudentDni").textContent = dni;
    document.getElementById("ayrpcStudentTwitch").textContent = String(twitch).startsWith("@") ? twitch : `@${twitch}`;
    document.getElementById("ayrpcStudentEmail").textContent = email;

    const source = supabaseData || sheetData ? "Datos sincronizados" : "Sesión local";
    document.getElementById("ayrpcDataSource").textContent = source;
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

  isAptoExam(alumno, supabaseData, sheetData) {
    const values = [
      supabaseData?.apt_examen,
      alumno?.apt_examen,
      sheetData?.["Apto Examen"],
      sheetData?.["APTO EXAMEN"],
      sheetData?.["Apto"],
      sheetData?.["APTO"],
      sheetData?.["Estado Examen"],
      sheetData?.["ESTADO EXAMEN"],
    ].map(v => this.normalizeStatus(v));

    return values.some(v =>
      ["APTO", "APTO_EXAMEN", "SI", "SÍ", "TRUE", "1", "HABILITADO"].includes(v)
    );
  },

  hasApprovedExam(alumno, supabaseData, sheetData) {
    const values = [
      // Examen regular - columna Y: Resultado
      alumno?.Resultado,
      alumno?.RESULTADO,
      alumno?.resultado,
      sheetData?.Resultado,
      sheetData?.RESULTADO,
      sheetData?.resultado,
      supabaseData?.Resultado,
      supabaseData?.RESULTADO,
      supabaseData?.resultado,

      // Recuperatorio - columna AA: Recuperatorio
      alumno?.Recuperatorio,
      alumno?.RECUPERATORIO,
      alumno?.recuperatorio,
      sheetData?.Recuperatorio,
      sheetData?.RECUPERATORIO,
      sheetData?.recuperatorio,
      supabaseData?.Recuperatorio,
      supabaseData?.RECUPERATORIO,
      supabaseData?.recuperatorio,
    ];

    return values.some(value => {
      const v = this.normalizeStatus(value);
      return ["APROBADO", "APROBADA", "APROBO", "APROBÓ", "SI", "SÍ", "TRUE", "1", "OK"].includes(v);
    });
  },

  paintRecovery(alumno, supabaseData, sheetData) {
    const apto = this.isAptoExam(alumno, supabaseData, sheetData);
    const aprobado = this.hasApprovedExam(alumno, supabaseData, sheetData);

    const card = document.getElementById("ayrpcRecoveryCard");
    const badge = document.getElementById("ayrpcRecoveryBadge");
    const text = document.getElementById("ayrpcRecoveryText");
    const btn = document.getElementById("ayrpcRecoveryBtn");
    const examStatus = document.getElementById("ayrpcStudentExamStatus");

    card.classList.remove("is-active", "is-locked", "is-approved");

    if (aprobado) {
      card.classList.add("is-approved");
      badge.textContent = "Aprobado";
      badge.className = "status-badge active";
      examStatus.textContent = "Aprobado";
      text.textContent = "Ya figura una evaluación aprobada. No hace falta acceder al recuperatorio.";
      btn.classList.add("disabled");
      btn.setAttribute("aria-disabled", "true");
      btn.href = "exampro.html";
      return;
    }

    if (apto) {
      card.classList.add("is-active");
      badge.textContent = "Disponible";
      badge.className = "status-badge active";
      examStatus.textContent = "Apto";
      text.textContent = "Figurás como apto para examen y no se detectó una evaluación aprobada. Podés acceder al recuperatorio.";
      btn.classList.remove("disabled");
      btn.setAttribute("aria-disabled", "false");
      btn.href = AYRPC2025_RECUPERATORIO_URL;
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
      return;
    }

    card.classList.add("is-locked");
    badge.textContent = "No habilitado";
    badge.className = "status-badge";
    examStatus.textContent = "No apto / revisar";
    text.textContent = "Por ahora no figurás como apto para examen. Revisá tu asistencia o consultá con el profe.";
    btn.classList.add("disabled");
    btn.setAttribute("aria-disabled", "true");
    btn.href = "clases-ayrpc-2025.html";
  },

  patchPelusita() {
    window.addEventListener("load", () => {
      if (!window.PelusitaClassroom) return;

      const originalOpen = window.PelusitaClassroom.open;

      window.PelusitaClassroom.open = function() {
        const dlg = document.getElementById("pelusitaDialog");
        const msg = document.getElementById("pelusitaDialogMsg");
        const opts = document.getElementById("pelusitaDialogOpts");

        if (!dlg || !msg || !opts) {
          originalOpen();
          return;
        }

        msg.textContent =
`Soy Pelusita.

En esta pantalla ves tu situación personal de AyRPC 2025: asistencia, tiempos registrados, estado de examen y acceso al recuperatorio si corresponde.`;

        opts.innerHTML = `
          <button class="pelusita-opt pelusita-opt-primary" data-ayrpc2025-help="clases">📚 Ver clases</button>
          <button class="pelusita-opt" data-ayrpc2025-help="recu">📝 ¿Cuándo aparece el recuperatorio?</button>
          <button class="pelusita-opt" data-ayrpc2025-help="cerrar">Cerrar</button>
        `;

        opts.querySelector('[data-ayrpc2025-help="clases"]')?.addEventListener("click", () => {
          window.location.href = "clases-ayrpc-2025.html";
        });

        opts.querySelector('[data-ayrpc2025-help="recu"]')?.addEventListener("click", () => {
          msg.textContent =
`El acceso al recuperatorio aparece si figurás como apto para examen y todavía no consta una evaluación aprobada.

Primero se revisan datos de Classroom/Supabase.`;
          window.PelusitaClassroom.state?.("pelusita-state3");
        });

        opts.querySelector('[data-ayrpc2025-help="cerrar"]')?.addEventListener("click", () => {
          window.PelusitaClassroom.close();
        });

        dlg.classList.add("show");
        window.PelusitaClassroom.state?.("pelusita-state2");
      };
    });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  CursoAyRPC2025Panel.init();
});
