(() => {
  "use strict";

  const COURSE_SLUG = "ayrpc-2026";
  const ENABLED_CLASS_NUMBER = 1;
  const CLASS1_REQUIRED_WATCH_SECONDS = 6960;
  const VIDEO_COMPLETION_RATIO = 1;
  const HEARTBEAT_SECONDS = 30;
  const RECOVERY_EDGE_BASE = "https://recovery.andyazhtec.com";
  const EDGE_FALLBACK_MS = 60000;
  const PLAYER_ATTACH_RETRY_MS = 250;
  const PLAYER_ATTACH_TIMEOUT_MS = 15000;
  const RECOVERY_START_MESSAGE =
    "Para recuperar esta clase tenÃ©s que ver el video completo desde esta vista y a velocidad 1x. Si abandonÃ¡s la vista de la clase, cambiÃ¡s de pestaÃ±a, minimizÃ¡s, cerrÃ¡s el navegador o intentÃ¡s acelerar la reproducciÃ³n, ese tiempo no cuenta como tiempo visto vÃ¡lido. Â¿QuerÃ©s iniciar la recuperaciÃ³n?";

  const state = {
    key: "",
    classNumber: null,
    status: "PENDIENTE",
    config: null,
    configLoading: false,
    player: null,
    playerVideoId: "",
    attachRetryTimer: null,
    attachStartedAt: 0,
    trackingTimer: null,
    lastTickAt: 0,
    lastVideoTime: 0,
    serverWatchedSeconds: 0,
    pendingSeconds: 0,
    edgePendingSeconds: 0,
    edgeSessionToken: "",
    edgeSessionUnavailable: false,
    edgeSessionLoading: false,
    edgeConfirmedComplete: false,
    edgeFallbackUntil: 0,
    heartbeatSending: false,
    quizUnlocked: false,
    submitting: false,
  };

  let youtubeReadyHookInstalled = false;

  const $ = id => document.getElementById(id);

  function classroomFullscreenSupported() {
    const target = $("videoPlayerBox");
    return Boolean(
      target &&
      (
        typeof target.requestFullscreen === "function" ||
        typeof target.webkitRequestFullscreen === "function"
      )
    );
  }

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

  function recoveryEdgeBase() {
    const configured = window.CLASSROOM_RECOVERY_EDGE_BASE || RECOVERY_EDGE_BASE;
    return String(configured).replace(/\/+$/, "");
  }

  function edgeSessionEndpoint(classNumber) {
    return `${recoveryEndpoint(classNumber)}/edge-session`;
  }

  function edgeHeartbeatEndpoint() {
    return `${recoveryEdgeBase()}/v1/recovery/heartbeat`;
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

  function safePlaybackRate() {
    try {
      return Number(state.player?.getPlaybackRate?.() || 1);
    } catch {
      return 1;
    }
  }

  function suppressCaptions() {
    if (!state.player) return;

    try {
      if (typeof state.player.unloadModule === "function") {
        state.player.unloadModule("captions");
        state.player.unloadModule("cc");
      }
    } catch (error) {
      console.debug("YouTube no permitiÃ³ descargar captions:", error);
    }
  }

  function showPlaybackRateWarning() {
    const note = $("recoveryNote");
    if (!note || !state.config?.eligible) return;

    note.className = "recovery-note warn";
    note.textContent =
      "Para validar la recuperaciÃ³n, el video se reproduce a velocidad 1x. Si cambiÃ¡s la velocidad, volverÃ¡ automÃ¡ticamente a 1x y ese instante no contarÃ¡.";
  }

  function enforceNormalPlaybackRate({ warn = false } = {}) {
    if (!state.player) return true;

    const rate = safePlaybackRate();
    if (Math.abs(rate - 1) < 0.01) return true;

    try {
      state.player.setPlaybackRate(1);
    } catch (error) {
      console.warn("No se pudo restaurar la velocidad 1x:", error);
    }

    state.lastTickAt = Date.now();
    state.lastVideoTime = safePlayerTime();

    if (warn) showPlaybackRateWarning();
    return false;
  }

  function knownDuration() {
    const configuredRequired = Number(
      state.config?.required_watch_seconds || 0
    );

    if (configuredRequired > 0) return configuredRequired;
    if (state.classNumber === ENABLED_CLASS_NUMBER) {
      return CLASS1_REQUIRED_WATCH_SECONDS;
    }

    return Math.max(
      safePlayerDuration(),
      Number(state.config?.video_duration_seconds || 0)
    );
  }

  function watchedTotal() {
    return Math.max(
      0,
      state.serverWatchedSeconds + state.edgePendingSeconds + state.pendingSeconds
    );
  }

  function updateProgress(percent) {
    const rawPercent = Math.max(0, Number(percent) || 0);
    const safePercent = Math.min(100, Math.floor(rawPercent));
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

    const provisionalPercent = (watchedTotal() / duration) * 100;
    if (state.edgeSessionToken && !state.edgeConfirmedComplete) {
      updateProgress(Math.min(99, provisionalPercent));
      return;
    }

    updateProgress(provisionalPercent);
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
      : "CompletÃ¡ el tiempo visto vÃ¡lido para habilitarlo";
  }

  function clearAttachRetry() {
    if (state.attachRetryTimer) {
      window.clearInterval(state.attachRetryTimer);
      state.attachRetryTimer = null;
    }
    state.attachStartedAt = 0;
  }

  function stopTracking() {
    if (state.trackingTimer) {
      window.clearInterval(state.trackingTimer);
      state.trackingTimer = null;
    }
    state.lastTickAt = 0;
    state.lastVideoTime = 0;
  }

  function destroyRecoveryPlayer() {
    clearAttachRetry();
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
    state.edgePendingSeconds = 0;
    state.edgeSessionToken = "";
    state.edgeSessionUnavailable = false;
    state.edgeSessionLoading = false;
    state.edgeConfirmedComplete = false;
    state.edgeFallbackUntil = 0;
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
      state.edgePendingSeconds = 0;
      state.edgeConfirmedComplete = Boolean(
        Number(data.required_watch_seconds || 0) > 0 &&
        state.serverWatchedSeconds >= Number(data.required_watch_seconds || 0)
      );

      if (data.eligible === true && data.preview_mode !== true) {
        await ensureEdgeSession(classNumber);
      }

      return data;
    } catch (error) {
      console.warn("No se pudo cargar la recuperaciÃ³n de la clase:", error);
      return null;
    } finally {
      state.configLoading = false;
    }
  }

  function extractVideoId() {
    if (state.playerVideoId) return state.playerVideoId;

    const host = $("youtubePlayer");
    const explicit = String(host?.dataset?.videoId || "").trim();
    if (explicit) return explicit;

    const iframe = host?.querySelector("iframe");
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
    return (
      state.edgeConfirmedComplete ||
      state.serverWatchedSeconds >= duration * VIDEO_COMPLETION_RATIO
    );
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
      state.edgePendingSeconds = 0;
      updateProgress(100);
      setQuizEnabled(true);
    }
  }

  async function ensureEdgeSession(classNumber) {
    if (isPreviewMode() || !state.config?.eligible) return false;
    if (state.edgeSessionToken) return true;
    if (state.edgeSessionUnavailable || state.edgeSessionLoading) return false;

    const token = classroomToken();
    if (!token) {
      state.edgeSessionUnavailable = true;
      return false;
    }

    state.edgeSessionLoading = true;
    try {
      const response = await fetch(edgeSessionEndpoint(classNumber), {
        method: "POST",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !data?.session_token) {
        throw new Error(data?.detail || "No se pudo crear la sesiÃ³n edge.");
      }

      state.edgeSessionToken = String(data.session_token);
      state.edgeSessionUnavailable = false;
      state.edgePendingSeconds = 0;
      state.serverWatchedSeconds = Math.max(
        state.serverWatchedSeconds,
        Number(data.persisted_watched_seconds || data.video_watch_seconds || 0)
      );
      state.edgeConfirmedComplete = Boolean(data.complete);
      if (state.config && Number(data.required_watch_seconds || 0) > 0) {
        state.config.required_watch_seconds = Number(data.required_watch_seconds);
      }
      return true;
    } catch (error) {
      state.edgeSessionUnavailable = true;
      console.warn("No se pudo iniciar el tracker edge; usamos fallback directo:", error);
      return false;
    } finally {
      state.edgeSessionLoading = false;
    }
  }

  function applyDirectHeartbeatResult(data) {
    state.serverWatchedSeconds = Math.max(
      state.serverWatchedSeconds,
      Number(data?.watched_seconds || data?.video_watch_seconds || 0)
    );
    state.edgePendingSeconds = 0;
    if (state.config && Number(data?.required_watch_seconds || 0) > 0) {
      state.config.required_watch_seconds = Number(data.required_watch_seconds);
    }
    const duration = knownDuration();
    if (duration > 0 && state.serverWatchedSeconds >= duration) {
      state.edgeConfirmedComplete = true;
    }
  }

  async function flushDirectWatchHeartbeat(delta, force = false) {
    const token = classroomToken();
    if (!token) throw new Error("Tu sesiÃ³n venciÃ³.");

    const response = await fetch(recoveryWatchEndpoint(state.classNumber), {
      method: "POST",
      keepalive: force,
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
      throw new Error(data?.detail || "No se pudo guardar el tiempo visto vÃ¡lido.");
    }
    applyDirectHeartbeatResult(data);
    return data;
  }

  async function flushEdgeHeartbeat(delta, force = false) {
    const response = await fetch(edgeHeartbeatEndpoint(), {
      method: "POST",
      keepalive: force,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_token: state.edgeSessionToken,
        course_slug: COURSE_SLUG,
        class_number: state.classNumber,
        delta_seconds: Number(delta.toFixed(3)),
        video_position_seconds: Number(safePlayerTime().toFixed(3)),
        video_duration_seconds: Number(safePlayerDuration().toFixed(3)),
        visible: true,
        playing: true,
        force: Boolean(force),
        persisted_watched_seconds: state.serverWatchedSeconds,
        required_watch_seconds: knownDuration(),
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || data?.accepted !== true) {
      throw new Error(data?.detail || "Cloudflare no pudo aceptar el heartbeat.");
    }

    state.serverWatchedSeconds = Math.max(
      state.serverWatchedSeconds,
      Number(data.persisted_watched_seconds || 0)
    );
    state.edgePendingSeconds = Math.max(0, Number(data.pending_seconds || 0));
    state.edgeConfirmedComplete = state.edgeConfirmedComplete || Boolean(data.complete);
    state.edgeFallbackUntil = 0;
    if (state.config && Number(data.required_watch_seconds || 0) > 0) {
      state.config.required_watch_seconds = Number(data.required_watch_seconds);
    }
    return data;
  }

  async function flushWatchHeartbeat(force = false) {
    if (isPreviewMode()) return;
    if (!state.config?.eligible || !state.classNumber) return;
    if (state.heartbeatSending) return;

    const delta = Math.min(state.pendingSeconds, HEARTBEAT_SECONDS);
    if (delta <= 0) return;
    if (!force && state.pendingSeconds < HEARTBEAT_SECONDS) return;

    state.pendingSeconds = Math.max(0, state.pendingSeconds - delta);
    state.heartbeatSending = true;

    try {
      if (!state.edgeSessionToken && !state.edgeSessionUnavailable) {
        await ensureEdgeSession(state.classNumber);
      }

      const useDirect =
        state.edgeSessionUnavailable ||
        !state.edgeSessionToken ||
        Date.now() < state.edgeFallbackUntil;

      if (useDirect) {
        await flushDirectWatchHeartbeat(delta, force);
      } else {
        try {
          await flushEdgeHeartbeat(delta, force);
        } catch (edgeError) {
          state.edgeFallbackUntil = Date.now() + EDGE_FALLBACK_MS;
          console.warn("Tracker edge temporalmente no disponible; fallback directo:", edgeError);
          await flushDirectWatchHeartbeat(delta, force);
        }
      }

      refreshUnlockState();
    } catch (error) {
      state.pendingSeconds += delta;
      console.warn("No se pudo sincronizar el tiempo visto vÃ¡lido:", error);
    } finally {
      state.heartbeatSending = false;
    }
  }

  function startTracking() {
    if (state.trackingTimer) return;

    state.lastTickAt = Date.now();
    state.lastVideoTime = safePlayerTime();

    state.trackingTimer = window.setInterval(() => {
      if (!state.player || !canTrackPlayback()) return;

      const now = Date.now();
      const currentVideoTime = safePlayerTime();
      const hidden = document.hidden || document.visibilityState !== "visible";

      let playing = false;
      try {
        playing =
          state.player.getPlayerState() === window.YT.PlayerState.PLAYING;
      } catch {
        playing = false;
      }

      const normalPlaybackRate = enforceNormalPlaybackRate({ warn: false });

      if (!hidden && playing && normalPlaybackRate) {
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

    try {
      state.player?.pauseVideo?.();
    } catch {}

    state.lastTickAt = Date.now();
    state.lastVideoTime = safePlayerTime();

    const note = $("recoveryNote");
    if (note && state.config?.eligible) {
      note.className = "recovery-note warn";
      note.textContent =
        "La reproducciÃ³n se pausÃ³ porque saliste de la vista de la clase. El tiempo fuera de esta pestaÃ±a no cuenta como tiempo visto vÃ¡lido.";
    }
  }

  function attachRecoveryPlayer() {
    if (!canTrackPlayback()) return false;
    if (state.player) return true;
    if (!window.YT?.Player) return false;

    const host = $("youtubePlayer");
    if (!host) return false;

    const videoId = extractVideoId();
    if (!videoId) return false;

    state.playerVideoId = videoId;
    host.dataset.videoId = videoId;
    host.innerHTML = '<div id="ayrpc2026RecoveryPlayerMount"></div>';

    try {
      const playerVars = {
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        enablejsapi: 1,
        cc_load_policy: 0,
        fs: 0,
      };

      if (!classroomFullscreenSupported()) {
        playerVars.fs = 1;
      }

      state.player = new window.YT.Player("ayrpc2026RecoveryPlayerMount", {
        videoId,
        playerVars,
        events: {
          onReady: () => {
            clearAttachRetry();
            suppressCaptions();
            enforceNormalPlaybackRate({ warn: false });
            state.lastTickAt = Date.now();
            state.lastVideoTime = safePlayerTime();
            startTracking();
            refreshUnlockState();
          },
          onStateChange: event => {
            if (!canTrackPlayback()) return;

            if (event.data === window.YT.PlayerState.PLAYING) {
              suppressCaptions();
              enforceNormalPlaybackRate({ warn: false });
              state.lastTickAt = Date.now();
              state.lastVideoTime = safePlayerTime();
              return;
            }

            if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              void flushWatchHeartbeat(true);
            }
          },
          onPlaybackRateChange: event => {
            if (!canTrackPlayback()) return;
            if (Math.abs(Number(event.data || 1) - 1) < 0.01) return;
            enforceNormalPlaybackRate({ warn: true });
          },
          onApiChange: () => {
            suppressCaptions();
          },
        },
      });
      return true;
    } catch (error) {
      console.warn("No se pudo iniciar el seguimiento del video:", error);
      state.player = null;
      return false;
    }
  }

  function schedulePlayerAttach() {
    if (state.player) return;

    clearAttachRetry();
    state.attachStartedAt = Date.now();

    const tryAttach = () => {
      if (attachRecoveryPlayer()) {
        clearAttachRetry();
        return;
      }

      if (
        Date.now() - state.attachStartedAt >= PLAYER_ATTACH_TIMEOUT_MS
      ) {
        clearAttachRetry();
        console.warn("No se pudo montar el player controlado de recuperaciÃ³n.");
      }
    };

    const startRetryLoop = () => {
      tryAttach();
      if (state.player || state.attachRetryTimer) return;
      state.attachRetryTimer = window.setInterval(
        tryAttach,
        PLAYER_ATTACH_RETRY_MS
      );
    };

    if (window.YT?.Player) {
      startRetryLoop();
      return;
    }

    if (!youtubeReadyHookInstalled) {
      youtubeReadyHookInstalled = true;
      const previous = window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === "function") {
          try {
            previous();
          } catch (error) {
            console.warn("FallÃ³ un callback previo de YouTube:", error);
          }
        }
        startRetryLoop();
      };
    }

    startRetryLoop();
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
    return `<div class="ayrpc2026-recovery-feedback ${kind}">${escapeHtml(message)}</div>`;
  }

  function clearQuestionResult(textarea) {
    if (!textarea) return;
    const wrapper = textarea.closest(".ayrpc2026-recovery-question");
    if (!wrapper) return;

    wrapper.classList.remove("is-valid", "is-invalid");
    textarea.classList.remove("is-valid", "is-invalid");

    const status = wrapper.querySelector(".ayrpc2026-recovery-question-status");
    if (status) {
      status.textContent = "";
      status.classList.remove("is-valid", "is-invalid");
    }
  }

  function paintQuestionResults(results = {}) {
    const form = $("ayrpc2026RecoveryForm");
    if (!form) return;

    for (const question of state.config?.questions || []) {
      const textarea = form.elements.namedItem(question.id);
      if (!textarea || textarea.tagName !== "TEXTAREA") continue;

      clearQuestionResult(textarea);
      const wrapper = textarea.closest(".ayrpc2026-recovery-question");
      if (!wrapper) continue;

      let status = wrapper.querySelector(".ayrpc2026-recovery-question-status");
      if (!status) {
        status = document.createElement("small");
        status.className = "ayrpc2026-recovery-question-status";
        textarea.insertAdjacentElement("afterend", status);
      }

      const result = results?.[question.id];
      if (result === true) {
        wrapper.classList.add("is-valid");
        textarea.classList.add("is-valid");
        status.classList.add("is-valid");
        status.textContent = "Respuesta vÃ¡lida.";
      } else if (result === false) {
        wrapper.classList.add("is-invalid");
        textarea.classList.add("is-invalid");
        status.classList.add("is-invalid");
        status.textContent = "Respuesta invÃ¡lida o insuficiente. Revisala e intentÃ¡ nuevamente.";
      }
    }
  }

  function renderQuiz() {
    const box = $("quizBox");
    const config = state.config;
    const preview = isPreviewMode();
    const canRender = preview || (config?.eligible && state.quizUnlocked);

    if (!box || !canRender || !Array.isArray(config?.questions)) return;

    const required = Number(
      config.required_correct_answers || config.questions.length
    );

    box.style.display = "grid";
    box.innerHTML = `
      <div class="ayrpc2026-recovery-shell">
        <div class="ayrpc2026-recovery-head">
          <div>
            <p class="eyebrow">${preview ? "Vista previa docente" : "ValidaciÃ³n de la clase"}</p>
            <h3>Clase 1 Â· PresentaciÃ³n e introducciÃ³n</h3>
            <p>${preview
              ? "EstÃ¡s viendo el cuestionario tal como lo verÃ¡ un alumno que deba recuperar. Esta vista no registra intentos ni modifica asistencia."
              : "RespondÃ© con tus palabras. No buscamos una frase exacta, sino los conceptos trabajados en clase."}</p>
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
                  ? "Vista previa docente Â· no se registrarÃ¡n respuestas"
                  : "RespondÃ© con tus palabras..."}"
              ></textarea>
            </label>
          `).join("")}
          <div id="ayrpc2026RecoveryFeedback">
            ${preview
              ? feedbackMarkup(
                  "Vista previa docente: podÃ©s revisar las preguntas sin crear un intento ni alterar el estado de la clase.",
                  "ok"
                )
              : ""}
          </div>
          ${preview
            ? ""
            : `<button class="btn btn-primary" type="submit">
                 <i class="fa-solid fa-paper-plane"></i>
                 Enviar respuestas
               </button>`}
        </form>
      </div>
    `;

    if (!preview) {
      const form = $("ayrpc2026RecoveryForm");
      form?.addEventListener("submit", submitRecovery);
      form?.querySelectorAll("textarea").forEach(textarea => {
        textarea.addEventListener("input", () => clearQuestionResult(textarea));
      });
    }

    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function paintRecoveredState() {
    void flushWatchHeartbeat(true);

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
    ) return;

    const form = event.currentTarget;
    const feedback = $("ayrpc2026RecoveryFeedback");
    const submit = form.querySelector('button[type="submit"]');
    const token = classroomToken();

    if (!token) {
      if (feedback) {
        feedback.innerHTML = feedbackMarkup(
          "Tu sesiÃ³n venciÃ³. VolvÃ© a iniciar sesiÃ³n.",
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
      feedback.innerHTML = feedbackMarkup("Revisando tus respuestas...", "warn");
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
        throw new Error(data?.detail || "No se pudo registrar la recuperaciÃ³n.");
      }

      paintQuestionResults(data?.question_results || {});

      if (data?.passed && data?.status === "RECUPERADA") {
        if (feedback) {
          feedback.innerHTML = feedbackMarkup(
            data.message || "Â¡Clase validada! Completaste correctamente la validaciÃ³n de esta clase.",
            "ok"
          );
        }
        paintRecoveredState();
        return;
      }

      if (feedback) {
        feedback.innerHTML = feedbackMarkup(
          data?.message ||
            "TodavÃ­a te queda algo por revisar. Una o mÃ¡s respuestas no coinciden con los conceptos trabajados en clase. RevisÃ¡ tus respuestas e intentÃ¡ nuevamente.",
          "warn"
        );
      }
    } catch (error) {
      if (feedback) {
        feedback.innerHTML = feedbackMarkup(
          error?.message || "No se pudo registrar la recuperaciÃ³n.",
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
    [40, 150, 450, 900].forEach(delay => {
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
        return;
      }

      state.lastTickAt = Date.now();
      state.lastVideoTime = safePlayerTime();
    });

    window.addEventListener("pagehide", () => {
      void flushWatchHeartbeat(true);
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
      .ayrpc2026-recovery-question-status { min-height:1.2em; font-size:.84rem; font-weight:800; line-height:1.3; }
      .ayrpc2026-recovery-question.is-valid > span, .ayrpc2026-recovery-question-status.is-valid { color:rgb(50,220,140); }
      .ayrpc2026-recovery-question textarea.is-valid { border-color:rgba(50,220,140,.85); background:rgba(50,220,140,.08); box-shadow:0 0 0 3px rgba(50,220,140,.08); }
      .ayrpc2026-recovery-question.is-invalid > span, .ayrpc2026-recovery-question-status.is-invalid { color:rgb(255,80,110); }
      .ayrpc2026-recovery-question textarea.is-invalid { border-color:rgba(255,80,110,.9); background:rgba(255,80,110,.08); box-shadow:0 0 0 3px rgba(255,80,110,.08); }
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

