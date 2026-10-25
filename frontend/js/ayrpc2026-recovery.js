(() => {
  "use strict";

  const COURSE_SLUG = "ayrpc-2026";
  const ENABLED_CLASS_NUMBER = 1;
  const VIDEO_COMPLETION_RATIO = 0.98;

  const state = {
    key: "",
    classNumber: null,
    status: "PENDIENTE",
    config: null,
    configLoading: false,
    player: null,
    playerFrame: null,
    watchedSeconds: 0,
    lastTickAt: 0,
    lastVideoTime: 0,
    trackingTimer: null,
    videoComplete: false,
    submitting: false,
  };

  const $ = id => document.getElementById(id);

  function apiBase() {
    const configured =
      window.EXAMPRO_API_BASE ||
      window.CLASSROOM_API_BASE ||
      localStorage.getItem("andyazh-api-base") ||
      "";

    if (configured) return String(configured).replace(/\/+$/, "");

    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return "http://127.0.0.1:8000";
    }

    return "https://api.andyazhtec.com";
  }

  function classroomToken() {
    const session =
      typeof window.ClassroomAuth !== "undefined"
        ? window.ClassroomAuth.getSession()
        : null;

    return (
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      session?.exampro?.access_token ||
      session?.accessToken ||
      session?.access_token ||
      session?.token ||
      ""
    );
  }

  function normalizeStatus(value) {
    return String(value || "PENDIENTE").trim().toUpperCase();
  }

  function isRecoverableStatus(status) {
    return ["AUSENTE", "REVISAR"].includes(normalizeStatus(status));
  }

  function isPreviewMode() {
    return state.config?.preview_mode === true;
  }

  function selectedClassNumber() {
    const title = $("recoveryTitle")?.textContent || "";
    const match = title.match(/Clase\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function selectedStatus() {
    return normalizeStatus($("liveAttendanceStatus")?.textContent);
  }

  function recoveryEndpoint(classNumber) {
    return `${apiBase()}/api/classroom/courses/${COURSE_SLUG}/classes/${classNumber}/recovery`;
  }

  function stopTracking() {
    if (state.trackingTimer) {
      window.clearInterval(state.trackingTimer);
      state.trackingTimer = null;
    }

    state.lastTickAt = 0;
    state.lastVideoTime = 0;
  }

  function updateProgress(percent) {
    const safePercent = Math.max(
      0,
      Math.min(100, Math.round(Number(percent) || 0))
    );

    const text = $("watchProgressText") || $("watchProgressPercent");
    const bar = $("watchProgressBar");

    if (text) text.textContent = `${safePercent}%`;
    if (bar) bar.style.width = `${safePercent}%`;
  }

  function showRecoveryProgress(show) {
    const wrap = $("watchProgressWrap");
    if (wrap) wrap.style.display = show ? "block" : "none";
  }

  function setQuizEnabled(enabled) {
    const button = $("quizButton");
    if (!button) return;

    button.disabled = !enabled;
    button.classList.toggle("is-enabled", enabled);

    if (enabled && isPreviewMode()) {
      button.innerHTML = '<i class="fa-solid fa-eye"></i> Ver cuestionario';
      button.title = "Vista previa docente";
    }
  }

  function resetSelection(nextKey, classNumber, status) {
    stopTracking();

    state.key = nextKey;
    state.classNumber = classNumber;
    state.status = status;
    state.config = null;
    state.configLoading = false;
    state.player = null;
    state.playerFrame = null;
    state.watchedSeconds = 0;
    state.videoComplete = false;
    state.submitting = false;

    updateProgress(0);
    setQuizEnabled(false);
  }

  async function loadRecoveryConfig(classNumber) {
    if (
      state.config ||
      state.configLoading ||
      classNumber !== ENABLED_CLASS_NUMBER
    ) {
      return state.config;
    }

    const token = classroomToken();
    if (!token) return null;

    state.configLoading = true;

    try {
      const response = await fetch(recoveryEndpoint(classNumber), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) return null;

      state.config = data;
      return data;
    } catch (error) {
      console.warn("No se pudo cargar la recuperación de la clase:", error);
      return null;
    } finally {
      state.configLoading = false;
    }
  }

  function safePlayerTime() {
    try {
      return Number(state.player?.getCurrentTime?.() || 0);
    } catch {
      return 0;
    }
  }

  function safePlayerDuration() {
    try {
      return Number(state.player?.getDuration?.() || 0);
    } catch {
      return 0;
    }
  }

  function checkVideoCompletion() {
    const duration = safePlayerDuration();
    if (!duration || !state.config?.eligible) return;

    const percent = Math.min(100, (state.watchedSeconds / duration) * 100);
    updateProgress(percent);

    if (
      !state.videoComplete &&
      state.watchedSeconds >= duration * VIDEO_COMPLETION_RATIO
    ) {
      state.videoComplete = true;
      updateProgress(100);
      setQuizEnabled(true);
    }
  }

  function startTracking() {
    stopTracking();

    state.lastTickAt = Date.now();
    state.lastVideoTime = safePlayerTime();

    state.trackingTimer = window.setInterval(() => {
      if (!state.player || !state.config?.eligible) return;

      try {
        if (
          window.YT?.PlayerState &&
          state.player.getPlayerState() !== window.YT.PlayerState.PLAYING
        ) {
          return;
        }
      } catch {
        return;
      }

      const now = Date.now();
      const currentVideoTime = safePlayerTime();
      const realDelta = Math.max(0, (now - state.lastTickAt) / 1000);
      const videoDelta = Math.max(0, currentVideoTime - state.lastVideoTime);

      if (videoDelta > 0 && videoDelta <= 2.5 && realDelta <= 2.5) {
        state.watchedSeconds += Math.min(realDelta, videoDelta);
      }

      state.lastTickAt = now;
      state.lastVideoTime = currentVideoTime;
      checkVideoCompletion();
    }, 1000);
  }

  function attachYouTubePlayer() {
    if (!state.config?.eligible || state.videoComplete) return;

    const iframe = $("youtubePlayer")?.querySelector("iframe");
    if (!iframe || !window.YT?.Player) return;

    if (state.player && state.playerFrame === iframe) return;

    try {
      const src = new URL(iframe.src);
      src.searchParams.set("enablejsapi", "1");
      if (window.location.origin !== "null") {
        src.searchParams.set("origin", window.location.origin);
      }
      if (iframe.src !== src.toString()) iframe.src = src.toString();
    } catch {}

    state.playerFrame = iframe;

    try {
      state.player = new window.YT.Player(iframe, {
        events: {
          onReady: checkVideoCompletion,
          onStateChange: event => {
            if (!state.config?.eligible) {
              stopTracking();
              return;
            }

            if (event.data === window.YT.PlayerState.PLAYING) {
              startTracking();
              return;
            }

            if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              stopTracking();
              checkVideoCompletion();
            }
          },
        },
      });
    } catch (error) {
      console.warn("No se pudo conectar el seguimiento del video:", error);
      state.player = null;
    }
  }

  function schedulePlayerAttach() {
    [80, 300, 800, 1600].forEach(delay => {
      window.setTimeout(attachYouTubePlayer, delay);
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function feedbackMarkup(message, kind) {
    return `
      <div class="ayrpc2026-recovery-feedback ${kind}">
        ${escapeHtml(message)}
      </div>
    `;
  }

  function renderQuiz() {
    const box = $("quizBox");
    const config = state.config;
    const preview = config?.preview_mode === true;
    const canRender = config?.eligible || preview;

    if (
      !box ||
      !canRender ||
      !Array.isArray(config.questions) ||
      !state.videoComplete
    ) {
      return;
    }

    box.style.display = "grid";

    const required = Number(
      config.required_correct_answers || config.questions.length
    );

    box.innerHTML = `
      <div class="ayrpc2026-recovery-shell">
        <div class="ayrpc2026-recovery-head">
          <div>
            <p class="eyebrow">${preview ? "Vista previa docente" : "Validación de la clase"}</p>
            <h3>Clase 1 · Presentación e introducción</h3>
            <p>${preview
              ? "Estás viendo el cuestionario tal como lo verá un alumno que deba recuperar. Esta vista no registra intentos ni modifica asistencia."
              : "Respondé con tus palabras. No buscamos una frase exacta, sino los conceptos trabajados en clase."}</p>
          </div>

          <span class="ayrpc2026-recovery-pill">
            ${preview
              ? "Vista previa docente"
              : `${required}/${config.total_questions || config.questions.length} para recuperar`}
          </span>
        </div>

        <form id="ayrpc2026RecoveryForm" class="ayrpc2026-recovery-form">
          ${config.questions.map((question, index) => `
            <label class="ayrpc2026-recovery-question">
              <span>${index + 1}. ${escapeHtml(question.prompt)}</span>
              <textarea
                name="${escapeHtml(question.id)}"
                rows="4"
                maxlength="2000"
                ${preview ? "disabled" : "required"}
                autocomplete="off"
                placeholder="${preview
                  ? "Vista previa docente · no se registrarán respuestas"
                  : "Respondé con tus palabras..."}"
              ></textarea>
            </label>
          `).join("")}

          <div id="ayrpc2026RecoveryFeedback">
            ${preview
              ? feedbackMarkup(
                  "Vista previa docente: podés revisar las preguntas sin crear un intento ni alterar el estado de la clase.",
                  "ok"
                )
              : ""}
          </div>

          ${preview
            ? ""
            : `
              <button class="btn btn-primary" type="submit">
                <i class="fa-solid fa-paper-plane"></i>
                Enviar respuestas
              </button>
            `}
        </form>
      </div>
    `;

    if (!preview) {
      $("ayrpc2026RecoveryForm")?.addEventListener("submit", submitRecovery);
    }

    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function paintRecoveredState() {
    const liveBadge = $("liveAttendanceStatus");
    if (liveBadge) {
      liveBadge.textContent = "RECUPERADA";
      liveBadge.className = "class-status ok";
    }

    const note = $("recoveryNote");
    if (note) {
      note.className = "recovery-note ok";
      note.textContent = "Esta clase ya figura como RECUPERADA.";
    }

    document.querySelectorAll(".class-row-card").forEach(card => {
      const badge = card.querySelector(".class-thumb-badge");
      if (!badge || !badge.textContent?.match(/Clase\s+1\b/i)) return;

      const statusBadge = card.querySelector(".class-status");
      if (statusBadge) {
        statusBadge.textContent = "RECUPERADA";
        statusBadge.className = "class-status ok";
      }

      const action = card.querySelector(".class-row-status .btn");
      if (action) {
        action.classList.remove("btn-primary");
        action.classList.add("btn-outline");
        action.innerHTML = '<i class="fa-solid fa-play"></i> Ver clase';
      }
    });

    setQuizEnabled(false);
    state.status = "RECUPERADA";
    state.config.eligible = false;
  }

  async function submitRecovery(event) {
    event.preventDefault();

    if (
      state.submitting ||
      !state.config?.eligible ||
      state.config?.preview_mode === true
    ) {
      return;
    }

    const form = event.currentTarget;
    const feedback = $("ayrpc2026RecoveryFeedback");
    const submit = form.querySelector('button[type="submit"]');
    const token = classroomToken();

    if (!token) {
      if (feedback) {
        feedback.innerHTML = feedbackMarkup(
          "Tu sesión venció. Volvé a iniciar sesión.",
          "bad"
        );
      }
      return;
    }

    const formData = new FormData(form);
    const answers = {};

    for (const question of state.config.questions || []) {
      answers[question.id] = String(formData.get(question.id) || "").trim();
    }

    state.submitting = true;
    if (submit) submit.disabled = true;

    if (feedback) {
      feedback.innerHTML = feedbackMarkup(
        "Revisando tus respuestas...",
        "warn"
      );
    }

    try {
      const response = await fetch(recoveryEndpoint(state.classNumber), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answers }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail || "No se pudo registrar la recuperación."
        );
      }

      if (data?.passed && data?.status === "RECUPERADA") {
        if (feedback) {
          feedback.innerHTML = feedbackMarkup(
            data.message ||
              "¡Clase validada! Completaste correctamente la validación de esta clase.",
            "ok"
          );
        }

        paintRecoveredState();
        return;
      }

      if (feedback) {
        feedback.innerHTML = feedbackMarkup(
          data?.message ||
            "Todavía te queda algo por revisar. Una o más respuestas no coinciden con los conceptos trabajados en clase. Revisá tus respuestas e intentá nuevamente.",
          "warn"
        );
      }
    } catch (error) {
      console.error("Error enviando recuperación:", error);

      if (feedback) {
        feedback.innerHTML = feedbackMarkup(
          error?.message || "No se pudo registrar la recuperación.",
          "bad"
        );
      }
    } finally {
      state.submitting = false;
      if (submit && state.status !== "RECUPERADA") submit.disabled = false;
    }
  }

  async function syncSelection() {
    const classNumber = selectedClassNumber();
    const status = selectedStatus();

    if (!classNumber) return;

    const nextKey = `${classNumber}:${status}`;
    if (nextKey !== state.key) {
      resetSelection(nextKey, classNumber, status);
    }

    if (classNumber !== ENABLED_CLASS_NUMBER) {
      showRecoveryProgress(false);
      setQuizEnabled(false);
      return;
    }

    const config = await loadRecoveryConfig(classNumber);

    if (config?.preview_mode === true) {
      showRecoveryProgress(false);
      state.videoComplete = true;
      updateProgress(100);
      setQuizEnabled(true);
      return;
    }

    const recoverable = isRecoverableStatus(status);
    showRecoveryProgress(recoverable);

    if (!recoverable || !config?.eligible) {
      setQuizEnabled(false);
      return;
    }

    if (config.requires_full_video === false) {
      state.videoComplete = true;
      updateProgress(100);
      setQuizEnabled(true);
      return;
    }

    schedulePlayerAttach();
  }

  function scheduleSync() {
    [40, 150, 500].forEach(delay => {
      window.setTimeout(() => void syncSelection(), delay);
    });
  }

  function injectStyles() {
    if ($("ayrpc2026RecoveryStyles")) return;

    const style = document.createElement("style");
    style.id = "ayrpc2026RecoveryStyles";
    style.textContent = `
      .ayrpc2026-recovery-shell { display:grid; gap:18px; padding:18px; border:1px solid rgba(122,64,180,.45); border-radius:14px; background:rgba(63,26,105,.08); }
      .ayrpc2026-recovery-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
      .ayrpc2026-recovery-head h3 { margin:2px 0 7px; }
      .ayrpc2026-recovery-head p:last-child { margin:0; opacity:.8; line-height:1.45; }
      .ayrpc2026-recovery-pill { flex:0 0 auto; padding:7px 10px; border:1px solid rgba(0,225,255,.35); border-radius:999px; font-weight:800; font-size:.86rem; }
      .ayrpc2026-recovery-form { display:grid; gap:16px; }
      .ayrpc2026-recovery-question { display:grid; gap:8px; }
      .ayrpc2026-recovery-question > span { font-weight:800; line-height:1.4; }
      .ayrpc2026-recovery-question textarea { width:100%; resize:vertical; min-height:96px; padding:12px 14px; border:1px solid rgba(122,64,180,.4); border-radius:10px; background:rgba(0,0,0,.16); color:inherit; font:inherit; line-height:1.45; }
      .ayrpc2026-recovery-question textarea:focus { outline:none; border-color:rgba(0,225,255,.65); box-shadow:0 0 0 3px rgba(0,225,255,.08); }
      .ayrpc2026-recovery-question textarea:disabled { opacity:.7; cursor:not-allowed; }
      .ayrpc2026-recovery-feedback { padding:11px 13px; border-radius:10px; line-height:1.45; }
      .ayrpc2026-recovery-feedback.ok { border:1px solid rgba(50,220,140,.38); background:rgba(50,220,140,.08); }
      .ayrpc2026-recovery-feedback.warn { border:1px solid rgba(255,190,70,.38); background:rgba(255,190,70,.08); }
      .ayrpc2026-recovery-feedback.bad { border:1px solid rgba(255,80,110,.38); background:rgba(255,80,110,.08); }
      #quizBox { scroll-margin-top:100px; }
      @media (max-width:700px) { .ayrpc2026-recovery-head { flex-direction:column; } .ayrpc2026-recovery-pill { align-self:flex-start; } }
    `;

    document.head.appendChild(style);
  }

  function init() {
    injectStyles();

    $("quizButton")?.addEventListener("click", renderQuiz);
    $("classesList")?.addEventListener("click", scheduleSync, true);

    const observer = new MutationObserver(scheduleSync);

    [$("recoveryTitle"), $("liveAttendanceStatus"), $("youtubePlayer")]
      .filter(Boolean)
      .forEach(element => {
        observer.observe(element, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      });

    [250, 800, 1600].forEach(delay => {
      window.setTimeout(scheduleSync, delay);
    });
  }

  window.AyRPC2026Recovery = {
    sync: syncSelection,
    isRecoverableStatus,
  };

  document.addEventListener("DOMContentLoaded", init);
})();
