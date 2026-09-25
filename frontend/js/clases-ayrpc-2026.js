(() => {
  "use strict";

  const IS_PREVIEW =
    (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) &&
    new URLSearchParams(window.location.search)
      .get("attendance-preview") === "1";

  let CLASSES = [];
  const state = {
    selected: null,

    statuses: Object.fromEntries(
      CLASSES.map(item => [item.id, "PENDIENTE"])
    ),

    attendanceByClass: Object.fromEntries(
      CLASSES.map(item => [
        item.id,
        {
          classId: item.id,
          windowId: "",
          open: false,
          code: "",
          expiresAt: 0,
          visible: false,
          count: 0
        }
      ])
    ),

    role: "alumno",
    permissions: {},
    timer: null,
    attendancePollTimer: null
  };

  /*
   * Compatibilidad interna:
   * state.attendance siempre devuelve la asistencia
   * correspondiente a la clase actualmente seleccionada.
   */
  Object.defineProperty(state, "attendance", {
    get() {
      if (!state.selected) return null;

      return state.attendanceByClass[state.selected.id] || null;
    }
  });

  const $ = id => document.getElementById(id);


  function getClassroomToken() {
    const session =
      typeof ClassroomAuth !== "undefined"
        ? ClassroomAuth.getSession()
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

  function hasPermission(permission) {
    return (
      state.role === "docente" ||
      Boolean(state.permissions?.[permission])
    );
  }

  async function loadStaffAccess() {
    state.role = "alumno";
    state.permissions = {};

    const token = getClassroomToken();

    if (!token) return;

    const apiBase =
      typeof EXAMPRO_API_BASE !== "undefined"
        ? EXAMPRO_API_BASE
        : "https://api.andyazhtec.com";

    try {
      const response = await fetch(
        `${apiBase}/api/classroom/me/permissions`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) return;

      const data = await response.json();

      state.role =
        data?.role || "alumno";

      state.permissions =
        data?.permissions || {};
    }
    catch (error) {
      console.warn(
        "No se pudieron cargar permisos de Classroom:",
        error
      );
    }
  }

  function getYouTubeVideoId(url) {
    if (!url) return "";

    try {
      const parsed = new URL(url);

      if (parsed.hostname.includes("youtu.be")) {
        return parsed.pathname.replace(/^\/+/, "");
      }

      return parsed.searchParams.get("v") || "";
    } catch {
      return "";
    }
  }

  function resetClassState() {
    state.statuses = Object.fromEntries(
      CLASSES.map(item => [item.id, "PENDIENTE"])
    );

    state.attendanceByClass = Object.fromEntries(
      CLASSES.map(item => [
        item.id,
        {
          classId: item.id,
          windowId: "",
          open: false,
          code: "",
          expiresAt: 0,
          visible: false,
          count: 0
        }
      ])
    );
  }

  async function loadCanonicalClasses() {
    const token = getClassroomToken();

    if (!token) {
      throw new Error("No hay token de Classroom.");
    }

    const apiBase =
      typeof EXAMPRO_API_BASE !== "undefined"
        ? EXAMPRO_API_BASE
        : "https://api.andyazhtec.com";

    const response = await fetch(
      `${apiBase}/api/classroom/courses/ayrpc-2026/classes`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok || !Array.isArray(data.classes)) {
      throw new Error("No se pudieron cargar las clases.");
    }

    CLASSES = data.classes.map(item => ({
      id: String(item.id),
      number: Number(item.class_number),
      title: item.title || `Clase ${item.class_number}`,
      description: item.description || "",
      statusLabel: `CLASE ${item.class_number}`,
      videoId: getYouTubeVideoId(item.video_url),
      scheduledAt: item.scheduled_at || null,
      durationSeconds: item.duration_seconds ?? null,
      sourceStatus: item.status || "pending"
    }));

    resetClassState();
  }

  function statusClass(status) {
    if (status === "PRESENTE" || status === "RECUPERADA") {
      return "ok";
    }

    if (status === "AUSENTE") {
      return "bad";
    }

    if (status === "REVISAR") {
      return "warn";
    }

    return "neutral";
  }

  function canRecover(status) {
    return status === "AUSENTE" || status === "REVISAR";
  }

  function renderClasses() {
    const container = $("classesList");

    if (!container) return;

    container.innerHTML = "";

    CLASSES.forEach(item => {
      const status = state.statuses[item.id] || "PENDIENTE";
      const recoverable = canRecover(status);

      const card = document.createElement("article");
      card.className = "class-row-card";

      card.innerHTML = `
        <div class="class-thumb-wrap">

          ${
            item.videoId
              ? `<img
                   class="class-thumb"
                   src="https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg"
                   alt="${item.title}"
                   loading="lazy"
                 />`
              : `<div class="class-thumb ayrpc2026-thumb-placeholder">
                   <i class="fa-solid fa-computer"></i>
                 </div>`
          }

          <span class="class-thumb-badge">
            Clase ${item.number}
          </span>
        </div>

        <div class="class-row-main">
          <strong>${item.title}</strong>

          <small>
            ${item.description}
          </small>

          <div class="class-meta-line">
            <span class="class-status ${statusClass(status)}">
              ${status}
            </span>

            <span class="class-meta-label">
              ${item.statusLabel}
            </span>
          </div>
        </div>

        <div class="class-row-status">
          <button
            class="btn ${recoverable ? "btn-primary" : "btn-outline"}"
            type="button"
          >
            <i class="fa-solid ${recoverable ? "fa-rotate-right" : "fa-play"}"></i>

            ${recoverable ? "Recuperar clase" : "Ver clase"}
          </button>
        </div>
      `;

      card
        .querySelector("button")
        .addEventListener("click", () => {
          selectClass(item);

          window.requestAnimationFrame(() => {
            const target =
              document.getElementById("liveAttendancePanel") ||
              document.getElementById("videoPlayerBox");

            if (!target) return;

            target.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          });
        });

      container.appendChild(card);
    });
  }

  async function refreshAttendanceWindowState(item) {
    if (
      !item ||
      !hasPermission("attendance.view")
    ) {
      return;
    }

    const token = getClassroomToken();

    if (!token) return;

    const apiBase =
      typeof EXAMPRO_API_BASE !== "undefined"
        ? EXAMPRO_API_BASE
        : "https://api.andyazhtec.com";

    try {
      const response = await fetch(
        `${apiBase}/api/classroom/admin/attendance/window-state?course=ayrpc-2026&class_number=${encodeURIComponent(item.number)}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) return;

      const data = await response.json();

      if (
        !state.selected ||
        state.selected.id !== item.id
      ) {
        return;
      }

      const attendance =
        state.attendanceByClass[item.id];

      if (!attendance) return;

      if (!data.window) {
        attendance.windowId = "";
        attendance.open = false;
        attendance.code = "";
        attendance.expiresAt = 0;
        attendance.visible = false;
        attendance.count = 0;

        paintAttendance();
        return;
      }

      const backendWindowId =
        data.window.id || "";

      const backendExpiresAt =
        data.active_token_expires_at
          ? Date.parse(data.active_token_expires_at)
          : 0;

      const sameWindow =
        attendance.windowId === backendWindowId;

      const keepLocalCode =
        sameWindow &&
        Boolean(attendance.code) &&
        Number.isFinite(backendExpiresAt) &&
        Math.abs(
          attendance.expiresAt - backendExpiresAt
        ) < 1000 &&
        Date.now() < attendance.expiresAt;

      attendance.windowId =
        backendWindowId;

      attendance.open = true;

      attendance.count =
        Number(data.registered_count || 0);

      if (!keepLocalCode) {
        attendance.code = "";
        attendance.visible = false;

        attendance.expiresAt =
          Number.isFinite(backendExpiresAt)
            ? backendExpiresAt
            : 0;
      }

      paintAttendance();
    }
    catch (error) {
      console.warn(
        "No se pudo recuperar el estado de asistencia:",
        error
      );
    }
  }

  function startAttendancePolling() {
    if (state.attendancePollTimer) {
      window.clearInterval(
        state.attendancePollTimer
      );
    }

    state.attendancePollTimer = null;

    if (!hasPermission("attendance.view")) {
      return;
    }

    state.attendancePollTimer =
      window.setInterval(() => {
        if (!state.selected) return;

        void refreshAttendanceWindowState(
          state.selected
        );
      }, 15000);
  }

  function selectClass(item) {
    state.selected = item;

    const staffPanel =
      document.querySelector(".ayrpc2026-staff-attendance");

    if (staffPanel) {
      staffPanel.open = false;
    }

    const attendanceInput =
      $("liveAttendanceCode");

    if (attendanceInput) {
      attendanceInput.value = "";
    }

    const status =
      state.statuses[item.id] ||
      "PENDIENTE";

    const title = $("recoveryTitle");

    if (title) {
      title.textContent =
        `Clase ${item.number}: ${item.title}`;
    }

    paintClassState(status);
    paintAttendance();

    void refreshAttendanceWindowState(item);

    paintVideo(item);
    resetRecoveryUI();
  }

  function paintClassState(status) {
    const note = $("recoveryNote");

    if (!note) return;

    note.className =
      `recovery-note ${statusClass(status)}`;

    if (status === "PRESENTE") {
      note.textContent =
        "Tu asistencia ya figura como PRESENTE. No necesitás recuperar esta clase.";

      return;
    }

    if (status === "RECUPERADA") {
      note.textContent =
        "Esta clase ya figura como RECUPERADA.";

      return;
    }

    if (status === "AUSENTE" || status === "REVISAR") {
      note.textContent =
        "Esta clase requiere recuperación. Cuando la grabación esté disponible deberás verla completa desde este reproductor. Al finalizar se habilitará el cuestionario correspondiente.";

      return;
    }

    note.textContent =
      "Tu asistencia todavía está PENDIENTE. La prioridad es registrarla durante la transmisión en vivo.";
  }

  function paintVideo(item) {
    const player = $("youtubePlayer");

    if (!player) return;

    if (!item.videoId) {
      player.innerHTML = `
        <div class="ayrpc2026-video-placeholder">
          <div>
            <i class="fa-solid fa-circle-play"></i>
            <strong>La clase todavía no está cargada</strong>
            <span>
              La grabación aparecerá acá cuando esté disponible.
            </span>
          </div>
        </div>
      `;

      return;
    }

    player.innerHTML = `
      <iframe
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/${item.videoId}"
        title="${item.title}"
        frameborder="0"
        allowfullscreen
      ></iframe>
    `;
  }

  function resetRecoveryUI() {
    const quizButton = $("quizButton");

    if (quizButton) {
      quizButton.disabled = true;
    }

    const quizBox = $("quizBox");

    if (quizBox) {
      quizBox.style.display = "none";
      quizBox.innerHTML = "";
    }

    const progressBar =
      $("watchProgressBar") ||
      document.querySelector(".watch-progress-fill");

    if (progressBar) {
      progressBar.style.width = "0%";
    }

    const progressText =
      $("watchProgressPercent") ||
      document.querySelector(".watch-progress-value");

    if (progressText) {
      progressText.textContent = "0%";
    }
  }

  function paintAttendance() {
    const selected = state.selected;

    if (!selected) return;

    const status =
      state.statuses[selected.id] ||
      "PENDIENTE";

    const badge = $("liveAttendanceStatus");
    const message = $("liveAttendanceMessage");
    const form = $("liveAttendanceForm");
    const feedback = $("liveAttendanceFeedback");

    if (badge) {
      badge.textContent = status;
      badge.className =
        `class-status ${statusClass(status)}`;
    }

    if (feedback) {
      feedback.hidden = true;
    }

    const isThisClassOpen =
      state.attendance.open &&
      state.attendance.classId === selected.id;

    const hasActiveCode =
      isThisClassOpen &&
      state.attendance.code &&
      Date.now() < state.attendance.expiresAt;

    if (status === "PRESENTE") {
      if (message) {
        message.textContent =
          "Tu presente ya fue registrado para esta clase.";
      }

      if (form) {
        form.hidden = true;
      }

      paintStaff();

      return;
    }

    if (!isThisClassOpen) {
      if (message) {
        message.textContent =
          "La asistencia se habilitará durante la transmisión en vivo.";
      }

      if (form) {
        form.hidden = true;
      }

      paintStaff();

      return;
    }

    if (!hasActiveCode) {
      if (message) {
        message.textContent =
          "La asistencia está habilitada. Seguí las indicaciones dadas durante la transmisión.";
      }

      if (form) {
        form.hidden = true;
      }

      paintStaff();

      return;
    }

    if (message) {
      message.textContent =
        "La asistencia está habilitada. Ingresá el código indicado durante la transmisión.";
    }

    if (form) {
      form.hidden = false;
    }

    paintStaff();
  }

  function randomCode() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    const values =
      new Uint32Array(6);

    crypto.getRandomValues(values);

    return Array
      .from(values)
      .map(value => chars[value % chars.length])
      .join("");
  }

  async function openAttendance() {
    if (!state.selected) return;

    if (IS_PREVIEW) {
      state.attendance.classId =
        state.selected.id;

      state.attendance.windowId =
        "preview";

      state.attendance.open = true;
      state.attendance.code = "";
      state.attendance.visible = false;
      state.attendance.expiresAt = 0;

      paintAttendance();
      return;
    }

    if (!hasPermission("attendance.edit")) {
      return;
    }

    const token = getClassroomToken();

    if (!token) return;

    try {
      const response = await fetch(
        `${EXAMPRO_API_BASE}/api/classroom/admin/attendance/windows/open`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            course_slug: "ayrpc-2026",
            class_number: state.selected.number,
            source: "classroom-web"
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
          "No se pudo habilitar la asistencia."
        );
      }

      state.attendance.classId =
        state.selected.id;

      state.attendance.windowId =
        data?.window?.id || "";

      state.attendance.open = true;
      state.attendance.code = "";
      state.attendance.visible = false;
      state.attendance.expiresAt = 0;
      state.attendance.count = 0;

      paintAttendance();
    }
    catch (error) {
      console.error(
        "Error habilitando asistencia:",
        error
      );

      window.alert(
        error?.message ||
        "No se pudo habilitar la asistencia."
      );
    }
  }


  async function generateCode() {
    if (
      !state.selected ||
      !state.attendance?.open
    ) {
      return;
    }

    if (IS_PREVIEW) {
      state.attendance.code =
        randomCode();

      state.attendance.expiresAt =
        Date.now() + 30 * 60 * 1000;

      state.attendance.visible = true;

      startTimer();
      paintAttendance();
      return;
    }

    if (
      !hasPermission("attendance.token.create") ||
      !state.attendance.windowId
    ) {
      return;
    }

    const token = getClassroomToken();

    if (!token) return;

    try {
      const response = await fetch(
        `${EXAMPRO_API_BASE}/api/classroom/admin/attendance/windows/${state.attendance.windowId}/token`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            expires_minutes: 30
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
          "No se pudo generar el código."
        );
      }

      state.attendance.code =
        data.code || "";

      state.attendance.expiresAt =
        Date.parse(data.expires_at);

      if (!Number.isFinite(state.attendance.expiresAt)) {
        state.attendance.expiresAt =
          Date.now() + 30 * 60 * 1000;
      }

      state.attendance.visible = true;

      startTimer();
      paintAttendance();
    }
    catch (error) {
      console.error(
        "Error generando código:",
        error
      );

      window.alert(
        error?.message ||
        "No se pudo generar el código."
      );
    }
  }


  async function closeAttendance() {
    if (!state.attendance?.open) {
      return;
    }

    if (IS_PREVIEW) {
      state.attendance.open = false;
      state.attendance.windowId = "";
      state.attendance.code = "";
      state.attendance.visible = false;
      state.attendance.expiresAt = 0;

      stopTimer();
      paintAttendance();
      return;
    }

    if (
      !hasPermission("attendance.edit") ||
      !state.attendance.windowId
    ) {
      return;
    }

    const token = getClassroomToken();

    if (!token) return;

    try {
      const response = await fetch(
        `${EXAMPRO_API_BASE}/api/classroom/admin/attendance/windows/${state.attendance.windowId}/close`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            source: "classroom-web"
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
          "No se pudo cerrar la asistencia."
        );
      }

      state.attendance.open = false;
      state.attendance.windowId = "";
      state.attendance.code = "";
      state.attendance.visible = false;
      state.attendance.expiresAt = 0;

      stopTimer();
      paintAttendance();
    }
    catch (error) {
      console.error(
        "Error cerrando asistencia:",
        error
      );

      window.alert(
        error?.message ||
        "No se pudo cerrar la asistencia."
      );
    }
  }

  function paintStaff() {
    const staffState =
      $("staffAttendanceState");

    if (!staffState) return;

    const panel =
      staffState.closest("details");

    const canEdit =
      IS_PREVIEW ||
      hasPermission("attendance.edit");

    const canGenerate =
      IS_PREVIEW ||
      hasPermission("attendance.token.create");

    const canManage =
      canEdit || canGenerate;

    if (panel) {
      panel.hidden = !canManage;
    }

    if (!canManage) return;

    const codeBox =
      $("staffAttendanceCodeBox");

    const code =
      $("staffAttendanceCode");

    const count =
      $("staffAttendanceCount");

    const openBtn =
      $("staffOpenAttendance");

    const generateBtn =
      $("staffGenerateAttendanceCode");

    const hideBtn =
      $("staffHideAttendanceCode");

    const closeBtn =
      $("staffCloseAttendance");

    const selected =
      state.selected;

    const attendance =
      selected
        ? state.attendance
        : null;

    const isThisClassOpen =
      Boolean(
        selected &&
        attendance?.open &&
        attendance.classId === selected.id
      );

    const codeActive =
      Boolean(
        isThisClassOpen &&
        attendance?.code &&
        Date.now() < attendance.expiresAt
      );

    staffState.textContent =
      codeActive
        ? "Código activo"
        : isThisClassOpen
          ? "Habilitada"
          : "Cerrada";

    if (count) {
      count.textContent =
        String(attendance?.count || 0);
    }

    if (openBtn) {
      openBtn.disabled =
        !canEdit ||
        !selected ||
        isThisClassOpen;
    }

    if (generateBtn) {
      generateBtn.disabled =
        !canGenerate ||
        !isThisClassOpen;
    }

    if (hideBtn) {
      hideBtn.disabled =
        !canGenerate ||
        !codeActive;
    }

    if (closeBtn) {
      closeBtn.disabled =
        !canEdit ||
        !isThisClassOpen;
    }

    if (
      codeBox &&
      code &&
      codeActive &&
      attendance.visible
    ) {
      codeBox.hidden = false;
      code.textContent =
        attendance.code;
    }
    else if (codeBox) {
      codeBox.hidden = true;
    }

    updateTimer();
  }

  function startTimer() {
    stopTimer();

    state.timer =
      window.setInterval(() => {

        if (
          state.attendance.code &&
          Date.now() >= state.attendance.expiresAt
        ) {
          state.attendance.code = "";
          state.attendance.visible = false;
          state.attendance.expiresAt = 0;

          stopTimer();
          paintAttendance();

          return;
        }

        updateTimer();

      }, 1000);
  }

  function stopTimer() {
    if (!state.timer) return;

    clearInterval(state.timer);
    state.timer = null;
  }

  function updateTimer() {
    const timer =
      $("staffAttendanceTimer");

    if (!timer) return;

    if (
      !state.attendance.code ||
      !state.attendance.expiresAt
    ) {
      timer.textContent = "";
      return;
    }

    const ms =
      Math.max(
        0,
        state.attendance.expiresAt - Date.now()
      );

    const seconds =
      Math.ceil(ms / 1000);

    const min =
      Math.floor(seconds / 60);

    const sec =
      seconds % 60;

    timer.textContent =
      `Expira en ${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function bindAttendanceForm() {
    const input =
      $("liveAttendanceCode");

    const form =
      $("liveAttendanceForm");

    const feedback =
      $("liveAttendanceFeedback");

    if (!input || !form) return;

    input.addEventListener(
      "paste",
      event => event.preventDefault()
    );

    input.addEventListener(
      "drop",
      event => event.preventDefault()
    );

    input.addEventListener(
      "contextmenu",
      event => event.preventDefault()
    );

    input.addEventListener(
      "keydown",
      event => {

        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "v"
        ) {
          event.preventDefault();
        }
      }
    );

    input.addEventListener(
      "input",
      () => {

        input.value =
          input.value
            .toUpperCase()
            .replace(/[^A-Z2-9]/g, "")
            .replace(/[IO01]/g, "")
            .slice(0, 6);
      }
    );

    form.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        if (!feedback || !state.selected) return;

        const code =
          input.value
            .toUpperCase()
            .replace(/[^A-Z2-9]/g, "")
            .replace(/[IO01]/g, "")
            .slice(0, 6);

        feedback.hidden = false;

        if (code.length !== 6) {
          feedback.className =
            "ayrpc2026-live-feedback bad";

          feedback.textContent =
            "Ingresá el código completo de 6 caracteres.";

          return;
        }

        const token = getClassroomToken();

        if (!token) {
          feedback.className =
            "ayrpc2026-live-feedback bad";

          feedback.textContent =
            "Tu sesión venció. Volvé a iniciar sesión.";

          return;
        }

        feedback.className =
          "ayrpc2026-live-feedback warn";

        feedback.textContent =
          "Validando asistencia...";

        try {
          const response = await fetch(
            `${EXAMPRO_API_BASE}/api/classroom/attendance/check-in`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                course_slug: "ayrpc-2026",
                class_number: state.selected.number,
                code
              })
            }
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data?.detail ||
              "No se pudo validar la asistencia."
            );
          }

          feedback.className =
            data.registered
              ? "ayrpc2026-live-feedback ok"
              : data.result === "LIVE_PRESENCE_NOT_VERIFIED"
                ? "ayrpc2026-live-feedback warn"
                : "ayrpc2026-live-feedback bad";

          feedback.textContent =
            data.message ||
            "No se pudo validar la asistencia.";

          if (data.registered) {
            input.value = "";
          }
        }
        catch (error) {
          console.error(
            "Error validando asistencia:",
            error
          );

          feedback.className =
            "ayrpc2026-live-feedback bad";

          feedback.textContent =
            error?.message ||
            "No se pudo validar la asistencia.";
        }
      }
    );
  }
  function bindStaff() {
    $("staffOpenAttendance")
      ?.addEventListener(
        "click",
        openAttendance
      );

    $("staffGenerateAttendanceCode")
      ?.addEventListener(
        "click",
        generateCode
      );

    $("staffHideAttendanceCode")
      ?.addEventListener(
        "click",
        () => {
          if (!IS_PREVIEW && !hasPermission("attendance.token.create")) return;

          state.attendance.visible = false;
          paintStaff();
        }
      );

    $("staffCloseAttendance")
      ?.addEventListener(
        "click",
        closeAttendance
      );
  }

  async function init() {
    bindAttendanceForm();
    bindStaff();

    try {
      await loadStaffAccess();
      await loadCanonicalClasses();
      renderClasses();

      if (CLASSES.length) {
        selectClass(CLASSES[0]);
      }

      startAttendancePolling();
    } catch (error) {
      console.error("No se pudieron cargar las clases AyRPC 2026:", error);

      const container = $("classesList");

      if (container) {
        container.innerHTML =
          '<p class="muted">No se pudieron cargar las clases.</p>';
      }
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );
})();