const AYRPC2025_VERIFIER_API_CURSOS = "https://script.google.com/macros/s/AKfycbxdB1fbiT1S04N5LaiOqHCojJcO12YCOPg7ln21bFrMrEot5GSdyWzy6j6CyEAsuDen/exec";

const CursosClassroom = {
  attendanceKeys: [
    "1erClase – Presente",
    "2daClase – Presente",
    "3erClase – Presente",
    "4taClase – Presente",
    "5taClase – Presente",
    "6taClase – Presente",
    "UltimaClase – Presente",
  ],

  async init() {
    await this.refreshOfficialAttendance();
    this.renderAyRPC2025Status();
    this.patchPelusitaForCourses();
  },

  getSession() {
    if (typeof ClassroomAuth === "undefined") return null;
    return ClassroomAuth.getSession();
  },

  saveSession(session) {
    localStorage.setItem("andyazh-classroom-session", JSON.stringify(session));
  },

  getAlumno() {
    return this.getSession()?.alumno || {};
  },

  normalizeStatus(value) {
    return String(value || "").trim().toUpperCase();
  },

  async refreshOfficialAttendance() {
    const session = this.getSession();
    if (!session) return;

    const dni = String(
      session.dni ||
      session.student?.dni ||
      session.alumno?.dni ||
      ""
    ).replace(/\D+/g, "");

    if (!dni) return;

    try {
      const response = await fetch(AYRPC2025_VERIFIER_API_CURSOS + "?dni=" + encodeURIComponent(dni));
      const data = await response.json();

      if (!data || data.error || data.estado === "BAJA") return;

      session.alumno = {
        ...(session.alumno || {}),
        ...data,
        dni: session.alumno?.dni || data.dni || dni,
      };

      session.dni = session.dni || data.dni || dni;
      this.saveSession(session);
    } catch (error) {
      console.warn("No se pudo refrescar asistencia oficial desde cursos:", error);
    }
  },

  getStatusByKey(alumno, key) {
    const variants = [
      key,
      String(key || "").replace("–", "-"),
      String(key || "").replace("-", "–"),
    ];

    for (const variant of variants) {
      const value = alumno[variant];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return this.normalizeStatus(value);
      }
    }

    return "-";
  },

  isCovered(status) {
    return status === "PRESENTE" || status === "RECUPERADA";
  },

  renderAyRPC2025Status() {
    const alumno = this.getAlumno();

    const statuses = this.attendanceKeys.map(key => this.getStatusByKey(alumno, key));
    const covered = statuses.filter(status => this.isCovered(status)).length;
    const total = this.attendanceKeys.length;
    const percent = Math.round((covered / total) * 100);
    const eligible = covered === total;

    const count = document.getElementById("ayrpc2025AttendanceCount");
    const bar = document.getElementById("ayrpc2025AttendanceBar");
    const text = document.getElementById("ayrpc2025AttendanceText");
    const recoveryBox = document.getElementById("ayrpc2025RecoveryBox");
    const recoveryStatus = document.getElementById("ayrpc2025RecoveryStatus");
    const recoveryBtn = document.getElementById("ayrpc2025RecoveryBtn");

    if (count) count.textContent = `${covered}/${total}`;
    if (bar) bar.style.width = `${percent}%`;

    if (text) {
      text.textContent = eligible
        ? "Tenés todas las clases presentes o recuperadas. El recuperatorio queda disponible desde ExamPro."
        : `Tenés ${covered} de ${total} clases cubiertas. Revisá Clases para ver qué falta recuperar.`;
    }

    if (recoveryBox) {
      recoveryBox.classList.toggle("is-active", eligible);
      recoveryBox.classList.toggle("is-locked", !eligible);
    }

    if (recoveryStatus) {
      recoveryStatus.textContent = eligible ? "Activo" : "Bloqueado";
    }

    if (recoveryBtn) {
      recoveryBtn.classList.toggle("disabled", !eligible);
      recoveryBtn.setAttribute("aria-disabled", eligible ? "false" : "true");

      if (eligible) {
        recoveryBtn.href = "exampro.html";
        recoveryBtn.title = "Abrir acceso a ExamPro";
      } else {
        recoveryBtn.href = "clases-ayrpc-2025.html";
        recoveryBtn.title = "Primero revisá tus clases pendientes";
      }
    }
  },

  patchPelusitaForCourses() {
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

En Cursos podés elegir la edición de AyRPC, revisar tu estado académico y entrar a las clases. Si tenés las 7 clases como PRESENTE o RECUPERADA, se habilita el acceso al recuperatorio desde ExamPro.`;

        opts.innerHTML = `
          <button class="pelusita-opt pelusita-opt-primary" data-cursos-pelusita="clases">
            📚 Ver clases AyRPC 2025
          </button>
          <button class="pelusita-opt" data-cursos-pelusita="recuperatorio">
            📝 ¿Cuándo se activa recuperatorio?
          </button>
          <button class="pelusita-opt" data-cursos-pelusita="cerrar">
            Cerrar
          </button>
        `;

        opts.querySelector('[data-cursos-pelusita="clases"]')?.addEventListener("click", () => {
          window.location.href = "clases-ayrpc-2025.html";
        });

        opts.querySelector('[data-cursos-pelusita="recuperatorio"]')?.addEventListener("click", () => {
          msg.textContent =
`El recuperatorio se habilita cuando las 7 clases figuran como PRESENTE o RECUPERADA.

Si te falta alguna, entrá a Clases y revisá qué instancia tenés pendiente.`;
          if (window.PelusitaClassroom.state) window.PelusitaClassroom.state("pelusita-state3");
        });

        opts.querySelector('[data-cursos-pelusita="cerrar"]')?.addEventListener("click", () => {
          window.PelusitaClassroom.close();
        });

        dlg.classList.add("show");
        if (window.PelusitaClassroom.state) window.PelusitaClassroom.state("pelusita-state2");
      };
    });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  CursosClassroom.init();
});
