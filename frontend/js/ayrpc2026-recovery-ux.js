(() => {
  "use strict";

  const COURSE_SLUG = "ayrpc-2026";
  const CLASS_NUMBER = 1;
  const WATCHDOG_TIMEOUT_MS = 60000;
  const PLAYER_ATTACH_TIMEOUT_MS = 15000;
  const WATCHDOG_INTERVAL_MS = 1000;
  const RESUME_REWIND_SECONDS = 5;
  const MIN_RESUME_POSITION_SECONDS = 10;
  const YOUTUBE_PLAYING = 1;
  const YOUTUBE_PAUSED = 2;
  const YOUTUBE_ENDED = 0;

  const state = {
    eligible: false,
    preview: false,
    classNumber: null,
    serverResumePosition: 0,
    lastServerWatchedSeconds: 0,
    lastServerProgressAt: 0,
    playbackStartedAt: 0,
    playerObservedAt: 0,
    attachDeadlineAt: 0,
    watchdogTimer: null,
    resumeDismissed: false,
    validationProblem: false,
  };

  const $ = id => document.getElementById(id);

  function requestUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    return String(input?.url || "");
  }

  function requestMethod(input, init) {
    return String(
      init?.method || input?.method || "GET"
    ).toUpperCase();
  }

  function recoveryPath(kind) {
    const suffix = kind === "watch" ? "/recovery/watch" : "/recovery";
    return `/api/classroom/courses/${COURSE_SLUG}/classes/${CLASS_NUMBER}${suffix}`;
  }

  function matchesRecoveryRequest(url, kind) {
    try {
      const parsed = new URL(url, window.location.href);
      return parsed.pathname.endsWith(recoveryPath(kind));
    } catch {
      return String(url || "").includes(recoveryPath(kind));
    }
  }

  function ensureValidationStatus() {
    let box = $("watchValidationStatus");
    if (box) return box;

    const progress = $("watchProgressWrap");
    if (!progress) return null;

    box = document.createElement("div");
    box.id = "watchValidationStatus";
    box.className = "watch-validation-status waiting";
    box.hidden = true;
    box.innerHTML = `
      <div class="watch-validation-copy">
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
        <span id="watchValidationMessage"></span>
      </div>
      <button id="retryWatchValidation" class="btn btn-outline" type="button" hidden>
        <i class="fa-solid fa-rotate-right"></i>
        Reintentar validación
      </button>
    `;

    progress.insertAdjacentElement("afterend", box);

    $("retryWatchValidation")?.addEventListener("click", () => {
      window.location.reload();
    });

    return box;
  }

  function paintValidation(kind, message, showRetry = false) {
    const box = ensureValidationStatus();
    if (!box) return;

    box.hidden = false;
    box.className = `watch-validation-status ${kind}`;

    const text = $("watchValidationMessage");
    if (text) text.textContent = message;

    const retry = $("retryWatchValidation");
    if (retry) retry.hidden = !showRetry;
  }

  function markValidationWaiting(message = "Validación lista. Poné play y esperá unos segundos para confirmar que el tiempo se está guardando.") {
    if (!state.eligible || state.preview) return;
    state.validationProblem = false;
    paintValidation("waiting", message, false);
  }

  function markValidationActive() {
    if (!state.eligible || state.preview) return;
    state.validationProblem = false;
    paintValidation(
      "ok",
      "Validación activa · tu progreso se está guardando.",
      false
    );
  }

  function markValidationProblem(
    message = "No estamos pudiendo validar tu tiempo de reproducción. Pausá la clase y reintentá antes de continuar. El tiempo que no podamos confirmar no contará para habilitar el cuestionario."
  ) {
    if (!state.eligible || state.preview) return;
    state.validationProblem = true;
    paintValidation("warn", message, true);
  }

  function hideValidationStatus() {
    const box = $("watchValidationStatus");
    if (box) box.hidden = true;
    const resume = $("resumeRecoveryButton");
    if (resume) resume.hidden = true;
  }

  function controlledPlayerIframe() {
    const frames = Array.from(
      document.querySelectorAll("#youtubePlayer iframe")
    );

    return frames.find(frame => {
      const src = String(frame.getAttribute("src") || "");
      return (
        frame.id === "ayrpc2026RecoveryPlayerMount" ||
        src.includes("enablejsapi=1")
      );
    }) || null;
  }

  function formatResumeTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function computeResumePosition() {
    const serverResumePosition = Math.max(
      0,
      Number(state.serverResumePosition || 0)
    );
    return Math.max(0, serverResumePosition - RESUME_REWIND_SECONDS);
  }

  function ensureResumeButton() {
    const actions = document.querySelector(".recovery-actions");
    if (!actions) return null;

    let button = $("resumeRecoveryButton");
    if (button) return button;

    button = document.createElement("button");
    button.id = "resumeRecoveryButton";
    button.type = "button";
    button.className = "btn btn-outline";
    button.hidden = true;
    button.addEventListener("click", continueRecoveryPlayback);
    actions.insertBefore(button, $("quizButton") || null);
    return button;
  }

  function refreshResumeAction() {
    const button = ensureResumeButton();
    if (!button) return;

    const resumePosition = computeResumePosition();
    const show =
      state.eligible &&
      !state.preview &&
      !state.resumeDismissed &&
      resumePosition >= MIN_RESUME_POSITION_SECONDS &&
      Boolean(controlledPlayerIframe());

    button.hidden = !show;
    if (!show) return;

    button.innerHTML =
      `<i class="fa-solid fa-rotate-right"></i> Continuar desde ${formatResumeTime(resumePosition)}`;
  }

  function sendYouTubeCommand(iframe, func, args = []) {
    if (!iframe?.contentWindow) return false;

    let origin = "*";
    try {
      origin = new URL(iframe.src).origin;
    } catch {}

    iframe.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: String(func), args }),
      origin
    );
    return true;
  }

  function continueRecoveryPlayback() {
    const iframe = controlledPlayerIframe();
    const resumePosition = computeResumePosition();

    if (!iframe || resumePosition < MIN_RESUME_POSITION_SECONDS) return;

    sendYouTubeCommand(iframe, "seekTo", [resumePosition, true]);
    sendYouTubeCommand(iframe, "playVideo", []);
    state.resumeDismissed = true;
    state.playbackStartedAt = Date.now();
    markValidationWaiting("Reanudando clase · esperando confirmación del servidor...");
    refreshResumeAction();
  }

  function handleRecoveryConfig(data) {
    if (!data?.ok || Number(data.class_number || CLASS_NUMBER) !== CLASS_NUMBER) {
      return;
    }

    state.classNumber = CLASS_NUMBER;
    state.preview = data.preview_mode === true;
    state.eligible = data.eligible === true;
    state.serverResumePosition = Math.max(
      0,
      Number(data.resume_position_seconds || 0)
    );
    state.lastServerWatchedSeconds = Math.max(
      0,
      Number(data.video_watch_seconds || data.watched_seconds || 0)
    );
    state.lastServerProgressAt = 0;
    state.playbackStartedAt = 0;
    state.playerObservedAt = 0;
    state.attachDeadlineAt = Date.now() + PLAYER_ATTACH_TIMEOUT_MS;
    state.resumeDismissed = false;
    state.validationProblem = false;

    if (!state.eligible || state.preview) {
      hideValidationStatus();
      return;
    }

    markValidationWaiting();
    startWatchdog();
    refreshPlayerObservation();
  }

  function handleHeartbeatResponse(data, responseOk) {
    if (!state.eligible || state.preview) return;

    if (!responseOk || !data?.ok) {
      markValidationProblem();
      return;
    }

    const now = Date.now();
    const previous = state.lastServerWatchedSeconds;
    const watched = Math.max(
      previous,
      Number(data.watched_seconds || data.video_watch_seconds || 0)
    );
    const credited = Math.max(0, Number(data.credited_seconds || 0));

    state.serverResumePosition = Math.max(
      state.serverResumePosition,
      Number(data.resume_position_seconds || 0)
    );
    state.lastServerWatchedSeconds = watched;

    if (credited > 0 || watched > previous) {
      state.lastServerProgressAt = now;
      state.resumeDismissed = true;
      markValidationActive();
      refreshResumeAction();
    }
  }

  async function inspectRecoveryResponse(response, kind) {
    const data = await response.json().catch(() => null);

    if (kind === "status") {
      if (response.ok) handleRecoveryConfig(data);
      return;
    }

    handleHeartbeatResponse(data, response.ok);
  }

  function installFetchObserver() {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async function ayrpc2026ObservedFetch(input, init) {
      const url = requestUrl(input);
      const method = requestMethod(input, init);
      const isStatus =
        method === "GET" && matchesRecoveryRequest(url, "status");
      const isWatch =
        method === "POST" && matchesRecoveryRequest(url, "watch");

      try {
        const response = await nativeFetch(input, init);

        if (isStatus || isWatch) {
          void inspectRecoveryResponse(
            response.clone(),
            isWatch ? "watch" : "status"
          );
        }

        return response;
      } catch (error) {
        if (isWatch) markValidationProblem();
        throw error;
      }
    };
  }

  function parseYoutubeStateMessage(event) {
    let host = "";
    try {
      host = new URL(event.origin).hostname;
    } catch {
      return null;
    }

    if (!/(^|\.)youtube(?:-nocookie)?\.com$/i.test(host)) return null;

    let payload = event.data;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        return null;
      }
    }

    if (!payload || typeof payload !== "object") return null;

    if (payload.event === "onStateChange") {
      return Number(payload.info);
    }

    if (
      payload.event === "infoDelivery" &&
      payload.info &&
      payload.info.playerState !== undefined
    ) {
      return Number(payload.info.playerState);
    }

    return null;
  }

  function handleYoutubeMessage(event) {
    const playerState = parseYoutubeStateMessage(event);
    if (!Number.isFinite(playerState) || !state.eligible || state.preview) {
      return;
    }

    if (playerState === YOUTUBE_PLAYING) {
      state.playbackStartedAt = Date.now();
      markValidationWaiting("Reproduciendo · esperando confirmación del servidor...");
      return;
    }

    if (playerState === YOUTUBE_PAUSED || playerState === YOUTUBE_ENDED) {
      state.playbackStartedAt = 0;
      if (!state.validationProblem) {
        markValidationWaiting(
          state.lastServerProgressAt
            ? "Validación en pausa. Al reanudar, confirmaremos nuevamente el tiempo."
            : "Validación lista. Poné play para empezar a registrar tiempo válido."
        );
      }
    }
  }

  function refreshPlayerObservation() {
    const iframe = controlledPlayerIframe();

    if (iframe && !state.playerObservedAt) {
      state.playerObservedAt = Date.now();
    }

    refreshResumeAction();
  }

  function watchdogTick() {
    if (!state.eligible || state.preview) return;

    const now = Date.now();
    const iframe = controlledPlayerIframe();

    if (!iframe) {
      if (
        state.attachDeadlineAt &&
        now >= state.attachDeadlineAt
      ) {
        markValidationProblem(
          "No pudimos iniciar el seguimiento del reproductor. No continúes con la clase todavía: tocá Reintentar validación para recargar y volver a comprobarlo."
        );
      }
      return;
    }

    if (!state.playerObservedAt) state.playerObservedAt = now;

    if (
      state.playbackStartedAt &&
      Date.now() - state.playbackStartedAt >= WATCHDOG_TIMEOUT_MS
    ) {
      const confirmedSincePlay =
        state.lastServerProgressAt >= state.playbackStartedAt;
      const confirmationFresh =
        state.lastServerProgressAt > 0 &&
        now - state.lastServerProgressAt < WATCHDOG_TIMEOUT_MS;

      if (!confirmedSincePlay || !confirmationFresh) {
        markValidationProblem();
      }
    }
  }

  function startWatchdog() {
    if (state.watchdogTimer) return;

    state.watchdogTimer = window.setInterval(
      watchdogTick,
      WATCHDOG_INTERVAL_MS
    );
  }

  function syncDomState() {
    const title = $("recoveryTitle")?.textContent || "";
    const selected = title.match(/Clase\s+(\d+)/i);
    const selectedNumber = selected ? Number(selected[1]) : null;
    const attendanceStatus = String(
      $("liveAttendanceStatus")?.textContent || ""
    ).trim().toUpperCase();

    if (
      selectedNumber !== CLASS_NUMBER ||
      ["RECUPERADA", "PRESENTE", "PENDIENTE"].includes(attendanceStatus)
    ) {
      if (selectedNumber !== CLASS_NUMBER || attendanceStatus !== "REVISAR" && attendanceStatus !== "AUSENTE") {
        state.eligible = false;
        state.playbackStartedAt = 0;
        hideValidationStatus();
      }
    }

    refreshPlayerObservation();
  }

  function injectStyles() {
    if ($("ayrpc2026RecoveryUxStyles")) return;

    const style = document.createElement("style");
    style.id = "ayrpc2026RecoveryUxStyles";
    style.textContent = `
      .watch-validation-status { margin:12px 0 4px; padding:12px 14px; border-radius:12px; display:flex; align-items:center; justify-content:space-between; gap:12px; line-height:1.4; }
      .watch-validation-copy { display:flex; align-items:flex-start; gap:9px; }
      .watch-validation-status.waiting { border:1px solid rgba(120,150,190,.35); background:rgba(120,150,190,.08); }
      .watch-validation-status.ok { border:1px solid rgba(50,220,140,.4); background:rgba(50,220,140,.08); }
      .watch-validation-status.warn { border:1px solid rgba(255,174,66,.5); background:rgba(255,174,66,.10); }
      .watch-validation-status.warn .watch-validation-copy > i { color:#ffae42; }
      .watch-validation-status.ok .watch-validation-copy > i { color:#32dc8c; }
      @media (max-width:700px) { .watch-validation-status { align-items:stretch; flex-direction:column; } .watch-validation-status .btn { width:100%; } }
    `;

    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    ensureValidationStatus();
    startWatchdog();

    window.addEventListener("message", handleYoutubeMessage);

    const observer = new MutationObserver(syncDomState);
    [$("youtubePlayer"), $("recoveryTitle"), $("liveAttendanceStatus")]
      .filter(Boolean)
      .forEach(element => {
        observer.observe(element, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      });

    syncDomState();
  }

  installFetchObserver();
  document.addEventListener("DOMContentLoaded", init);
})();
