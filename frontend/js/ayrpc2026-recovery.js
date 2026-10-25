(() => {
  "use strict";

  const COURSE_SLUG = "ayrpc-2026";
  const ENABLED_CLASS_NUMBER = 1;
  const VIDEO_COMPLETION_RATIO = 0.98;
  const HEARTBEAT_SECONDS = 5;
  const RECOVERY_START_MESSAGE =
    "Para recuperar esta clase tenés que ver el video completo desde esta vista. Si abandonás la vista de la clase, cambiás de pestaña, minimizás o cerrás el navegador, ese tiempo no cuenta como tiempo visto válido. ¿Querés iniciar la recuperación?";

  const state = {
    key: "",
    classNumber: null,
    status: "PENDIENTE",
    config: null,
    configLoading: false,
    player: null,
    playerVideoId: "",
    trackingTimer: null,
    lastTickAt: 0,
    lastVideoTime: 0,
    serverWatchedSeconds: 0,
    pendingSeconds: 0,
    heartbeatSending: false,
    quizUnlocked: false,
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

  function canTrackPlayback() {
    return state.config?.eligible === true || isPreviewMode();
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

  function recoveryWatchEndpoint(classNumber) {
    return `${recoveryEndpoint(classNumber)}/watch`;
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

  function knownDuration() {
    return Math.max(
      safePlayerDuration(),
      Number(state.config?.video_duration_seconds || 0)
    );
  }

  function watchedTotal() {
    return Math.max(0, state.serverWatchedSeconds + state.pendingSeconds);
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

  function updateProgressFromSeconds() {
    const duration = knownDuration();

    if (!duration) {
      updateProgress(Number(state.config?.video_watch_percent || 0));
      return;
    }

    updateProgress((watchedTotal() / duration) * 100);
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
      return;
    }

    button.innerHTML = '<i class="fa-solid fa-clipboard-question"></i> Responder cuestionario';
    button.title = enabled
      ? "Cuestionario habilitado"
      : "Completá el tiempo visto válido para habilitarlo";
  }

  function stopTracking() {
    if (state.trackingTimer) {
      window.clearInterval(state.trackingTimer);
      state.trackingTimer = null;
    }

    state.lastTickAt = 0;
    state.lastVideoTime = safePlayerTime();
  }

  function destroyRecoveryPlayer() {
    stopTracking();

    if (state.player) {
      try {
        state.player.destroy();
      } catch {}
    }

    state.player = null;
    state.playerVideoId = "";
  }

  function resetSelection(nextKey, classNumber, status) {
    destroyRecoveryPlayer();

    state.key = nextKey;
    state.classNumber = classNumber;
    state.status = status;
    state.config = null;
    state.configLoading = false;
    state.serverWatchedSeconds = 0;
    state.pendingSeconds = 0;
    state.heartbeatSending = false;
    state.quizUnlocked = false;
    state.submitting = false;

    updateProgress(0);
    setQuizEnabled(false);

    const box = $("quizBox");
    if (box) {
      box.style.display = "none";
      box.innerHTML = "";
    }
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
      state.serverWatchedSeconds = Math.max(
        0,
        Number(data.video_watch_seconds || data.watched_seconds || 0)
      );
      state.pendingSeconds = 0;

      return data;
    } catch (error) {
      console.warn("No se pudo cargar la recuperación de la clase:", error);
      return null;
    } finally {
      state.configLoading = false;
    }
  }

  function extractVideoId() {
    if (state.playerVideoId) return state.playerVideoId;

    const iframe = $("youtubePlayer")?.querySelector("iframe");
    const src = iframe?.src || "";

    try {
      const parsed = new URL(src);
      const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/i);
      if (embedMatch?.[1]) return embedMatch[1];
      return parsed.searchParams.get("v") || "";
    } catch {
      return "";
    }
  }

  function completionReached() {
    if (isPreviewMode()) return true;

    const duration = knownDuration();
    if (!duration) return false;

    return state.serverWatchedSeconds >= duration * VIDEO_COMPLETION_RATIO;
  }

  function refreshUnlockState() {
    updateProgressFromSeconds();

    if (isPreviewMode()) {
      state.quizUnlocked = true;
      setQuizEnabled(true);
      return;
    }

    if (!state.quizUnlocked && completionReached()) {
      state.quizUnlocked = true;
      state.pendingSeconds = 0;
      updateProgress(100);
      setQuizEnabled(true);
    }
  }

  async function flushWatchHeartbeat(force = false) {
    if (isPreviewMode()) return;
    if (!state.config?.eligible || !state.classNumber) return;
    if (state.heartbeatSending) return;

    const delta = state.pendingSeconds;
    if (delta <= 0) return;
    if (!force && delta < HEARTBEAT_SECONDS) return;

    const token = classroomToken();
    if (!token) return;

    state.pendingSeconds = Math.max(0, state.pendingSeconds - delta);
    state.heartbeatSending = true;

    try {
      const response = await fetch(recoveryWatchEndpoint(state.classNumber), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          delta_seconds: Number(delta.toFixed(3)),
          video_position_seconds: Number(safePlayerTime().toFixed(3)),
          video_duration_seconds: Number(safePlayerDuration().toFixed(3)),
          visible: true,
          playing: true,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.detail || "No se pudo guardar el tiempo visto válido.");
      }

      state.serverWatchedSeconds = Math.max(
        state.serverWatchedSeconds,
        Number(data.watched_seconds || data.video_watch_seconds || 0)
      );

      if (state.config && Number(data.video_duration_seconds || 0) > 0) {
        state.config.video_duration_seconds = Math.max(
          Number(state.config.video_duration_seconds || 0),
          Number(data.video_duration_seconds)
        );
      }

      refreshUnlockState();
    } catch (error) {
      state.pendingSeconds += delta;
      console.warn("No se pudo sincronizar el tiempo visto válido:", error);
    } finally {
      state.heartbeatSending = false;
    }
  }

  function startTracking() {
    stopTracking();

    state.lastTickAt = Date.now();
    state.lastVideoTime = safePlayerTime();

    state.trackingTimer = window.setInterval(() => {
      if (!state.player || !canTrackPlayback()) return;
      if (document.hidden || document.visibilityState !== "visible") return;

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
        const validDelta = Math.min(realDelta, videoDelta);

        if (isPreviewMode()) {
          state.serverWatchedSeconds += validDelta;
        } else {
          state.pendingSeconds += validDelta;
        }
      }

      state.lastTickAt = now;
      state.lastVideoTime = currentVideoTime;
      refreshUnlockState();

      if (!isPreviewMode()) {
        void flushWatchHeartbeat(false);
      }
    }, 1000);
  }

  function pauseForInactiveView() {
    if (!canTrackPlayback()) return;

    void flushWatchHeartbeat(true);
    stopTracking();

    try {
      if (state.player?.pauseVideo) state.player.pauseVideo();
    } catch {}

    const note = $("recoveryNote");
    if (note && state.config?.eligible) {
      note.className = "recovery-note warn";
      note.textContent =
        "La reproducción se pausó porque saliste de la vista de la clase. El tiempo fuera de esta pestaña no cuenta como tiempo visto válido.";
    }
  }

  function attachRecoveryPlayer() {
    if (!canTrackPlayback() || state.player) return;
    if (!window.YT?.Player) return;

    const host = $("youtubePlayer");
    if (!host) return;

    const videoId = extractVideoId();
    if (!videoId) return;

    state.playerVideoId = videoId;
    host.innerHTML = '<div id="ayrpc2026RecoveryPlayerMount"></div>';

    try {
      state.player = new window.YT.Player("ayrpc2026RecoveryPlayerMount", {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: () => {
            if (state.config) {
              state.config.video_duration_seconds = Math.max(
                Number(state.config.video_duration_seconds || 0),
                safePlayerDuration()
              );
            }
            refreshUnlockState();
          },
          onStateChange: event => {
            if (!canTrackPlayback()) {
              stopTracking();
              return;
            }

            if (event.data === window.YT.PlayerState.PLAYING) {
              if (document.hidden || document.visibilityState !== "visible") {
                pauseForInactiveView();
                return;
              }

              startTracking();
              return;
            }

            if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              void flushWatchHeartbeat(true);
              stopTracking();
              refreshUnlockState();
            }
          },
        },
      });
    } catch (error) {
      console.warn("No se pudo iniciar el seguimiento del video:", error);
      state.player = null;
    }
  }

  function schedulePlayerAttach() {
    [80, 250, 600, 1200].forEach(delay => {
      window.setTimeout(attachRecoveryPlayer, delay);
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
    const preview = isPreviewMode();
    const canRender = preview || (config?.eligible && state.quizUnlocked);

    if (
      !box ||
      !canRender ||
      !Array.isArray(config?.questions)
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
    void flushWatchHeartbeat(true);
    stopTracking();

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
        action.dataset.pelusitaAction = "view-class";
        action.innerHTML = '<i class="fa-solid fa-play"></i> Ver clase';
      }
    });

    state.status = "RECUPERADA";
    state.quizUnlocked = false;
    if (state.config) state.config.eligible = false;
    setQuizEnabled(false);
  }

  async function submitRecovery(event) {
    event.preventDefault();

    if (
      state.submitting ||
      !state.config?.eligible ||
      isPreviewMode() ||
      !state.quizUnlocked
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
    const preview = config?.preview_mode === true;
    const recoverable = isRecoverableStatus(status);

    if (preview) {
      showRecoveryProgress(true);
      state.quizUnlocked = true;
      setQuizEnabled(true);
      updateProgressFromSeconds();
      schedulePlayerAttach();
      return;
    }

    showRecoveryProgress(recoverable);

    if (!recoverable || !config?.eligible) {
      setQuizEnabled(false);
      return;
    }

    if (config.requires_full_video === false) {
      state.quizUnlocked = true;
      updateProgress(100);
      setQuizEnabled(true);
      return;
    }

    refreshUnlockState();
    schedulePlayerAttach();
  }

  function scheduleSync() {
    [40, 150, 450].forEach(delay => {
      window.setTimeout(() => void syncSelection(), delay);
    });
  }

  function isClassOneRecoveryButton(button) {
    if (!button || button.dataset.pelusitaAction !== "recover-class") {
      return false;
    }

    const card = button.closest(".class-row-card");
    const badge = card?.querySelector(".class-thumb-badge")?.textContent || "";
    return /Clase\s+1\b/i.test(badge);
  }

  function bindRecoveryStartWarning() {
    document.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!isClassOneRecoveryButton(button)) return;

      const ok = window.confirm(RECOVERY_START_MESSAGE);
      if (ok) return;

      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function bindViewProtection() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || document.visibilityState !== "visible") {
        pauseForInactiveView();
      }
    });

    window.addEventListener("blur", () => {
      pauseForInactiveView();
    });

    window.addEventListener("beforeunload", event => {
      if (!state.config?.eligible || watchedTotal() <= 0 || state.quizUnlocked) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
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
    bindRecoveryStartWarning();
    bindViewProtection();

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
