/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — clases-ayrpc-2025.js
════════════════════════════════════════════════════════ */

"use strict";

const RECOVERY_SUBMIT_ENDPOINT = "{ASIGNAR_ENDPOINT_RECUPERACION}";

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
    await this.loadYaml();
    this.renderClasses();
    this.bindQuizButton();
  },

  async loadYaml() {
    const response = await fetch("data/recuperatorios/ayrpc-2025.yml");
    const text = await response.text();
    this.data = jsyaml.load(text);
  },

  getSessionAlumno() {
    if (typeof ClassroomAuth === "undefined") return {};
    const session = ClassroomAuth.getSession();
    return session?.alumno || {};
  },

  getAttendanceStatus(attendanceKey) {
    const alumno = this.getSessionAlumno();
    return String(alumno[attendanceKey] || "-").trim().toUpperCase();
  },

  canRecover(status) {
    return !["PRESENTE", "RECUPERADA"].includes(status);
  },

  renderClasses() {
    const container = document.getElementById("classesList");
    if (!container || !this.data?.classes) return;

    container.innerHTML = "";

    this.data.classes.forEach((item) => {
      const status = this.getAttendanceStatus(item.attendance_key);
      const recoverable = this.canRecover(status);

      const card = document.createElement("article");
      card.className = "class-row-card";
      card.innerHTML = `
        <div class="class-row-main">
          <span class="class-number">Clase ${item.number}</span>
          <strong>${item.title}</strong>
          <small>${item.status_label}</small>
        </div>

        <div class="class-row-status">
          <span class="class-status ${this.getStatusClass(status)}">${status}</span>

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

    document.getElementById("recoveryTitle").textContent = `Clase ${item.number}: ${item.title}`;
    document.getElementById("openYoutubeBtn").href = `https://www.youtube.com/watch?v=${item.video_id}`;

    this.setQuizEnabled(false);
    this.updateProgress(0);
    this.hideQuiz();

    if (this.playerReady && this.player) {
      this.player.loadVideoById(item.video_id);
      return;
    }

    this.createPlayer(item.video_id);
  },

  createPlayer(videoId) {
    const create = () => {
      this.player = new YT.Player("youtubePlayer", {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            this.playerReady = true;
            this.startTracking();
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING) {
              this.startTracking();
            }

            if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
              this.stopTracking();
              this.checkCompletion();
            }
          },
        },
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

      const now = Date.now();
      const currentVideoTime = this.safeCurrentTime();

      const realDelta = Math.max(0, (now - this.lastTickTime) / 1000);
      const videoDelta = Math.max(0, currentVideoTime - this.lastVideoTime);

      if (videoDelta <= 2.5 && realDelta <= 2.5) {
        this.watchedSeconds += Math.min(realDelta, videoDelta || realDelta);
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
    if (!duration) return;

    const percent = Math.min(100, Math.round((this.watchedSeconds / duration) * 100));
    this.updateProgress(percent);

    if (this.watchedSeconds >= duration * 0.98) {
      this.setQuizEnabled(true);
    }
  },

  updateProgress(percent) {
    document.getElementById("watchProgressText").textContent = `${percent}%`;
    document.getElementById("watchProgressBar").style.width = `${percent}%`;
  },

  setQuizEnabled(enabled) {
    const btn = document.getElementById("quizButton");
    btn.disabled = !enabled;
    btn.classList.toggle("is-enabled", enabled);
  },

  bindQuizButton() {
    const btn = document.getElementById("quizButton");
    if (!btn) return;

    btn.addEventListener("click", () => {
      this.renderQuiz();
    });
  },

  hideQuiz() {
    const box = document.getElementById("quizBox");
    box.style.display = "none";
    box.innerHTML = "";
  },

  renderQuiz() {
    if (!this.selectedClass?.quiz) return;

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

  async submitRecovery(score) {
    if (RECOVERY_SUBMIT_ENDPOINT.includes("{ASIGNAR")) {
      alert("Aprobado. Falta conectar el endpoint para registrar RECUPERADA en la base de datos.");
      return;
    }

    const session = ClassroomAuth.getSession();

    const payload = {
      course_id: this.data.course_id,
      class_id: this.selectedClass.id,
      attendance_key: this.selectedClass.attendance_key,
      dni: session?.dni,
      twitch: session?.twitch,
      score,
      new_status: "RECUPERADA",
    };

    const response = await fetch(RECOVERY_SUBMIT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      alert("No se pudo registrar la recuperación.");
      return;
    }

    alert("Clase recuperada correctamente.");
  },
};

document.addEventListener("DOMContentLoaded", () => {
  AyRPC2025Classes.init();
});
