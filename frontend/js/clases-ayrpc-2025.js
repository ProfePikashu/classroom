"use strict";

const RECOVERY_SUBMIT_ENDPOINT = "{ASIGNAR_ENDPOINT_RECUPERACION}";

const FALLBACK_RECOVERY_DATA = {
  course_id: "ayrpc-2025",
  course_title: "AyRPC 2025",
  settings: {
    min_score_percent: 70,
    require_full_video_time: true,
    submit_endpoint: RECOVERY_SUBMIT_ENDPOINT
  },
  classes: [
    {
      id: "clase-1",
      number: 1,
      title: "Armado y Componentes",
      description: "Reconocimiento de componentes, compatibilidades, ensamble base y buenas prácticas de armado.",
      video_id: "jjiJ2t8AESU",
      attendance_key: "1erClase – Presente",
      status_label: "Primera Clase",
      quiz: {
        title: "Recuperatorio Clase 1",
        questions: [
          {
            id: "c1q1",
            type: "single",
            prompt: "{ASIGNAR PREGUNTA}",
            options: ["{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}"],
            answer: 0
          }
        ]
      }
    },
    {
      id: "clase-2",
      number: 2,
      title: "Instalación de SO",
      description: "Instalación de sistemas operativos, booteo, preparación de USB, GPT/MBR y primeros pasos.",
      video_id: "I5nRZ-3-TQY",
      attendance_key: "2daClase – Presente",
      status_label: "Segunda Clase",
      quiz: {
        title: "Recuperatorio Clase 2",
        questions: [
          {
            id: "c2q1",
            type: "single",
            prompt: "{ASIGNAR PREGUNTA}",
            options: ["{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}"],
            answer: 0
          }
        ]
      }
    },
    {
      id: "clase-3",
      number: 3,
      title: "Programación de BIOS",
      description: "UEFI, Legacy, chips BIOS, CH341A, lectura, backup, borrado y grabación.",
      video_id: "kBQ8UhP4rcA",
      attendance_key: "3erClase – Presente",
      status_label: "Tercera Clase",
      quiz: {
        title: "Recuperatorio Clase 3",
        questions: [
          {
            id: "c3q1",
            type: "single",
            prompt: "{ASIGNAR PREGUNTA}",
            options: ["{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}"],
            answer: 0
          }
        ]
      }
    },
    {
      id: "clase-4",
      number: 4,
      title: "Drivers y Software de mantenimiento",
      description: "Instalación de drivers, utilidades de mantenimiento y herramientas de soporte técnico.",
      video_id: "RB3iFXq34R4",
      attendance_key: "4taClase – Presente",
      status_label: "Cuarta Clase",
      quiz: {
        title: "Recuperatorio Clase 4",
        questions: [
          {
            id: "c4q1",
            type: "single",
            prompt: "{ASIGNAR PREGUNTA}",
            options: ["{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}"],
            answer: 0
          }
        ]
      }
    },
    {
      id: "clase-5",
      number: 5,
      title: "Introducción a la microsoldadura",
      description: "Conceptos introductorios de microsoldadura, herramientas y criterios básicos de intervención.",
      video_id: "F5IVK5Td8cA",
      attendance_key: "5taClase – Presente",
      status_label: "Quinta Clase",
      quiz: {
        title: "Recuperatorio Clase 5",
        questions: [
          {
            id: "c5q1",
            type: "single",
            prompt: "{ASIGNAR PREGUNTA}",
            options: ["{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}"],
            answer: 0
          }
        ]
      }
    },
    {
      id: "clase-6",
      number: 6,
      title: "Solución de problemas",
      description: "Diagnóstico, criterios de descarte y resolución de fallas frecuentes en equipos de PC.",
      video_id: "zNMyJLk2YSY",
      attendance_key: "6taClase – Presente",
      status_label: "Sexta Clase",
      quiz: {
        title: "Recuperatorio Clase 6",
        questions: [
          {
            id: "c6q1",
            type: "single",
            prompt: "{ASIGNAR PREGUNTA}",
            options: ["{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}"],
            answer: 0
          }
        ]
      }
    },
    {
      id: "clase-7",
      number: 7,
      title: "Virus y Malware + Sorteo",
      description: "Amenazas comunes, criterios de limpieza, prevención y cierre del curso.",
      video_id: "T7liswcttXU",
      attendance_key: "UltimaClase – Presente",
      status_label: "Última Clase",
      quiz: {
        title: "Recuperatorio Última Clase",
        questions: [
          {
            id: "c7q1",
            type: "single",
            prompt: "{ASIGNAR PREGUNTA}",
            options: ["{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}", "{ASIGNAR OPCION}"],
            answer: 0
          }
        ]
      }
    }
  ]
};

const AyRPC2025Classes = {
  data: null,
  selectedClass: null,
  player: null,
  playerReady: false,
  watchedSeconds: 0,
  lastTickTime: null,
  lastVideoTime: 0,
  trackingTimer: null,

  async init() {
    await this.loadData();
    this.applyLocalRubrics();
    this.renderClasses();
    this.bindQuizButton();
  },

  async loadData() {
    try {
      if (window.location.protocol === "file:") {
        this.data = FALLBACK_RECOVERY_DATA;
        return;
      }

      const response = await fetch("data/recuperatorios/ayrpc-2025.yml", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo cargar YAML");
      const text = await response.text();
      const parsed = typeof jsyaml !== "undefined" ? jsyaml.load(text) : null;

      if (!parsed || !parsed.classes) {
        this.data = FALLBACK_RECOVERY_DATA;
        return;
      }

      this.data = this.mergeWithFallback(parsed);
    } catch (error) {
      this.data = FALLBACK_RECOVERY_DATA;
    }
  },

  mergeWithFallback(parsed) {
    const fallbackById = new Map(FALLBACK_RECOVERY_DATA.classes.map(item => [item.id, item]));

    return {
      ...FALLBACK_RECOVERY_DATA,
      ...parsed,
      settings: {
        ...FALLBACK_RECOVERY_DATA.settings,
        ...(parsed.settings || {})
      },
      classes: (parsed.classes || FALLBACK_RECOVERY_DATA.classes).map(item => {
        const fallback = fallbackById.get(item.id) || {};
        return {
          ...fallback,
          ...item,
          quiz: item.quiz || fallback.quiz
        };
      })
    };
  },

  applyLocalRubrics() {
    try {
      const raw = localStorage.getItem("ayrpc-2025-rubrics-v1");
      if (!raw) return;

      const rubricData = JSON.parse(raw);
      const quizzes = rubricData.quizzes || {};

      if (rubricData.min_score_percent) {
        this.data.settings.min_score_percent = Number(rubricData.min_score_percent);
      }

      this.data.classes = this.data.classes.map((item) => {
        const customQuiz = quizzes[item.id];

        if (!customQuiz) return item;

        return {
          ...item,
          quiz: {
            title: customQuiz.title || item.quiz?.title || "Recuperatorio",
            questions: customQuiz.questions || item.quiz?.questions || [],
          },
        };
      });
    } catch (error) {}
  },

  getSession() {
    if (typeof ClassroomAuth === "undefined") return null;
    return ClassroomAuth.getSession();
  },

  getSessionAlumno() {
    const session = this.getSession();
    return session?.alumno || {};
  },

  getAttendanceStatus(attendanceKey) {
    const alumno = this.getSessionAlumno();
    return String(alumno[attendanceKey] || "-").trim().toUpperCase();
  },

  canRecover(status) {
    return ["AUSENTE", "REVISAR"].includes(status);
  },

  isAlreadyCovered(status) {
    return ["PRESENTE", "RECUPERADA"].includes(status);
  },

  renderClasses() {
    const container = document.getElementById("classesList");
    if (!container || !this.data?.classes) return;

    container.innerHTML = "";

    this.data.classes.forEach((item) => {
      const status = this.getAttendanceStatus(item.attendance_key);
      const recoverable = this.canRecover(status);
      const thumb = `https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg`;

      const card = document.createElement("article");
      card.className = "class-row-card";
      card.innerHTML = `
        <div class="class-thumb-wrap">
          <img class="class-thumb" src="${thumb}" alt="${item.title}" loading="lazy" />
          <span class="class-thumb-badge">Clase ${item.number}</span>
        </div>

        <div class="class-row-main">
          <strong>${item.title}</strong>
          <small>${item.description || ""}</small>
          <div class="class-meta-line">
            <span class="class-status ${this.getStatusClass(status)}">${status || "-"}</span>
            <span class="class-meta-label">${item.status_label}</span>
          </div>
        </div>

        <div class="class-row-status">
          <button class="btn ${recoverable ? "btn-primary" : "btn-outline"}" type="button">
            <i class="fa-solid ${recoverable ? "fa-rotate-right" : "fa-play"}"></i>
            ${recoverable ? "Recuperar clase" : "Ver clase"}
          </button>
        </div>
      `;

      card.querySelector("button").addEventListener("click", () => {
        this.selectClass(item);
      });

      container.appendChild(card);
    });
  },

  getStatusClass(status) {
    if (status === "PRESENTE" || status === "RECUPERADA") return "ok";
    if (status === "AUSENTE") return "bad";
    if (status === "REVISAR") return "warn";
    return "neutral";
  },

  selectClass(item) {
    this.selectedClass = item;
    this.watchedSeconds = 0;
    this.lastTickTime = null;
    this.lastVideoTime = 0;

    const status = this.getAttendanceStatus(item.attendance_key);
    const recoverable = this.canRecover(status);

    document.getElementById("recoveryTitle").textContent = `Clase ${item.number}: ${item.title}`;
    this.hideQuiz();
    this.updateProgress(0);
    this.setQuizEnabled(false);

    this.paintRecoveryNote(status, recoverable);

    const progressWrap = document.getElementById("watchProgressWrap");
    if (progressWrap) {
      progressWrap.style.display = recoverable ? "block" : "none";
    }

    if (this.playerReady && this.player) {
      this.player.loadVideoById(item.video_id);
    } else {
      this.createPlayer(item.video_id);
    }
  },

  paintRecoveryNote(status, recoverable) {
    const note = document.getElementById("recoveryNote");
    if (!note) return;

    note.className = "recovery-note " + this.getStatusClass(status);

    if (recoverable) {
      note.textContent = `Tu estado actual es ${status}. Para recuperar esta clase tenés que verla completa en este reproductor. Recién al final se habilita el cuestionario.`;
      return;
    }

    if (this.isAlreadyCovered(status)) {
      note.textContent = `Tu asistencia ya figura como ${status}. Podés ver la clase, pero no necesitás recuperar ni responder cuestionario.`;
      return;
    }

    note.textContent = `Podés ver esta clase. Cuando tengamos el flujo final conectado, acá también se reflejarán más estados automáticamente.`;
  },

  createPlayer(videoId) {
    const create = () => {
      this.player = new YT.Player("youtubePlayer", {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1
        },
        events: {
          onReady: () => {
            this.playerReady = true;
          },
          onStateChange: (event) => {
            if (!this.selectedClass) return;

            const status = this.getAttendanceStatus(this.selectedClass.attendance_key);
            const recoverable = this.canRecover(status);

            if (!recoverable) {
              this.stopTracking();
              return;
            }

            if (event.data === YT.PlayerState.PLAYING) {
              this.startTracking();
            }

            if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
              this.stopTracking();
              this.checkCompletion();
            }
          }
        }
      });
    };

    if (window.YT && YT.Player) {
      create();
      return;
    }

    window.onYouTubeIframeAPIReady = create;
  },

  startTracking() {
    this.stopTracking();

    this.lastTickTime = Date.now();
    this.lastVideoTime = this.safeCurrentTime();

    this.trackingTimer = setInterval(() => {
      if (!this.player || this.player.getPlayerState() !== YT.PlayerState.PLAYING) return;
      if (!this.selectedClass) return;

      const status = this.getAttendanceStatus(this.selectedClass.attendance_key);
      if (!this.canRecover(status)) return;

      const now = Date.now();
      const currentVideoTime = this.safeCurrentTime();

      const realDelta = Math.max(0, (now - this.lastTickTime) / 1000);
      const videoDelta = Math.max(0, currentVideoTime - this.lastVideoTime);

      if (videoDelta > 0 && videoDelta <= 2.5 && realDelta <= 2.5) {
        this.watchedSeconds += Math.min(realDelta, videoDelta);
      }

      this.lastTickTime = now;
      this.lastVideoTime = currentVideoTime;

      this.checkCompletion();
    }, 1000);
  },

  stopTracking() {
    if (!this.trackingTimer) return;
    clearInterval(this.trackingTimer);
    this.trackingTimer = null;
  },

  safeCurrentTime() {
    try {
      return this.player?.getCurrentTime ? this.player.getCurrentTime() : 0;
    } catch (error) {
      return 0;
    }
  },

  safeDuration() {
    try {
      return this.player?.getDuration ? this.player.getDuration() : 0;
    } catch (error) {
      return 0;
    }
  },

  checkCompletion() {
    const duration = this.safeDuration();
    if (!duration || !this.selectedClass) return;

    const status = this.getAttendanceStatus(this.selectedClass.attendance_key);
    if (!this.canRecover(status)) return;

    const percent = Math.min(100, Math.round((this.watchedSeconds / duration) * 100));
    this.updateProgress(percent);

    if (this.watchedSeconds >= duration * 0.98) {
      this.setQuizEnabled(true);
    }
  },

  updateProgress(percent) {
    const text = document.getElementById("watchProgressText");
    const bar = document.getElementById("watchProgressBar");

    if (text) text.textContent = `${percent}%`;
    if (bar) bar.style.width = `${percent}%`;
  },

  setQuizEnabled(enabled) {
    const btn = document.getElementById("quizButton");
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle("is-enabled", enabled);
  },

  bindQuizButton() {
    const btn = document.getElementById("quizButton");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (!this.selectedClass) return;
      this.renderQuiz();
    });
  },

  hideQuiz() {
    const box = document.getElementById("quizBox");
    if (!box) return;
    box.style.display = "none";
    box.innerHTML = "";
  },

  renderQuiz() {
    if (!this.selectedClass?.quiz) return;

    const status = this.getAttendanceStatus(this.selectedClass.attendance_key);
    if (!this.canRecover(status)) return;

    const box = document.getElementById("quizBox");
    box.style.display = "grid";

    const questions = this.selectedClass.quiz.questions || [];

    box.innerHTML = `
      <div class="panel-header">
        <div>
          <p class="eyebrow">Cuestionario</p>
          <h3>${this.selectedClass.quiz.title}</h3>
        </div>
      </div>

      <form id="recoveryQuizForm" class="recovery-quiz-form">
        ${questions.map((question, index) => `
          <fieldset class="quiz-question">
            <legend>${index + 1}. ${question.prompt}</legend>

            ${(question.options || []).map((option, optIndex) => `
              <label>
                <input type="radio" name="${question.id}" value="${optIndex}" required />
                <span>${option}</span>
              </label>
            `).join("")}
          </fieldset>
        `).join("")}

        <button class="btn btn-primary" type="submit">
          <i class="fa-solid fa-paper-plane"></i>
          Enviar respuestas
        </button>
      </form>
    `;

    document.getElementById("recoveryQuizForm").addEventListener("submit", (event) => {
      event.preventDefault();
      this.evaluateQuiz(new FormData(event.target));
    });
  },

  async evaluateQuiz(formData) {
    const questions = this.selectedClass.quiz.questions || [];
    let correct = 0;

    questions.forEach((question) => {
      const value = Number(formData.get(question.id));
      if (value === Number(question.answer)) correct++;
    });

    const percent = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    const min = this.data.settings?.min_score_percent || 70;

    if (percent < min) {
      alert(`No alcanzaste el mínimo. Resultado: ${percent}%`);
      return;
    }

    await this.submitRecovery(percent);
  },

  updateLocalSessionAsRecovered() {
    const session = this.getSession();
    if (!session || !this.selectedClass) return;

    if (!session.alumno) session.alumno = {};
    session.alumno[this.selectedClass.attendance_key] = "RECUPERADA";

    localStorage.setItem("andyazh-classroom-session", JSON.stringify(session));
  },

  async submitRecovery(score) {
    if (RECOVERY_SUBMIT_ENDPOINT.includes("{ASIGNAR")) {
      this.updateLocalSessionAsRecovered();
      alert("Cuestionario aprobado. Quedó marcado localmente como RECUPERADA para prueba visual. Después conectamos el endpoint real.");
      this.renderClasses();
      this.selectClass(this.selectedClass);
      return;
    }

    const session = this.getSession();

    const payload = {
      course_id: this.data.course_id,
      class_id: this.selectedClass.id,
      attendance_key: this.selectedClass.attendance_key,
      dni: session?.dni,
      twitch: session?.twitch,
      score,
      new_status: "RECUPERADA"
    };

    const response = await fetch(RECOVERY_SUBMIT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      alert("No se pudo registrar la recuperación.");
      return;
    }

    this.updateLocalSessionAsRecovered();
    alert("Clase recuperada correctamente.");
    this.renderClasses();
    this.selectClass(this.selectedClass);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  AyRPC2025Classes.init();
});
