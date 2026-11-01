(() => {
  "use strict";

  const ADMIN_STATE_PATH = "/api/classroom/admin/attendance/window-state";
  const ADMIN_TOKEN_MARKER = "/api/classroom/admin/attendance/windows/";
  const ADMIN_TOKEN_SUFFIX = "/token";
  const CHECKIN_PATH = "/api/classroom/attendance/check-in";
  const STORAGE_PREFIX = "ayrpc2026.attendance-code.";

  const originalFetch = window.fetch.bind(window);

  let tokenRequestInFlight = false;
  let checkinRequestInFlight = false;

  function requestUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    return String(input?.url || "");
  }

  function requestMethod(input, init) {
    return String(init?.method || input?.method || "GET").toUpperCase();
  }

  function parsedPath(url) {
    try {
      return new URL(url, window.location.href).pathname;
    } catch {
      return String(url || "");
    }
  }

  function isAdminStateRequest(input, init) {
    return (
      requestMethod(input, init) === "GET" &&
      parsedPath(requestUrl(input)).endsWith(ADMIN_STATE_PATH)
    );
  }

  function isAdminTokenRequest(input, init) {
    const path = parsedPath(requestUrl(input));
    return (
      requestMethod(input, init) === "POST" &&
      path.includes(ADMIN_TOKEN_MARKER) &&
      path.endsWith(ADMIN_TOKEN_SUFFIX)
    );
  }

  function isCheckinRequest(input, init) {
    return (
      requestMethod(input, init) === "POST" &&
      parsedPath(requestUrl(input)).endsWith(CHECKIN_PATH)
    );
  }

  function attendanceStorageKey(windowId) {
    return `${STORAGE_PREFIX}${windowId}`;
  }

  function persistServerCode(payload) {
    const code = String(payload?.active_token_code || payload?.code || "")
      .trim()
      .toUpperCase();

    const expiresRaw =
      payload?.active_token_expires_at || payload?.expires_at || null;

    const windowId = String(
      payload?.window?.id || payload?.window_id || ""
    ).trim();

    const expiresAt = Date.parse(expiresRaw || "");

    if (
      !windowId ||
      !code ||
      code.length !== 6 ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      return;
    }

    try {
      sessionStorage.setItem(
        attendanceStorageKey(windowId),
        JSON.stringify({ code, expiresAt })
      );
    } catch (error) {
      console.debug("No se pudo cachear el código activo de asistencia:", error);
    }
  }

  async function captureResponsePayload(response, handler) {
    if (!response?.ok) return;

    try {
      const payload = await response.clone().json();
      handler(payload);
    } catch (error) {
      console.debug("No se pudo leer la respuesta de estabilidad de asistencia:", error);
    }
  }

  function setButtonBusy(id, busy, busyLabel = "Procesando...") {
    const button = document.getElementById(id);
    if (!button) return;

    if (busy) {
      if (!button.dataset.attendanceStableLabel) {
        button.dataset.attendanceStableLabel = button.innerHTML;
      }
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = busyLabel;
      return;
    }

    button.removeAttribute("aria-busy");
    if (button.dataset.attendanceStableLabel) {
      button.innerHTML = button.dataset.attendanceStableLabel;
      delete button.dataset.attendanceStableLabel;
    }

    // El script principal vuelve a decidir el estado final del botón cuando
    // pinta la asistencia. Acá sólo liberamos el lock de request en curso.
    button.disabled = false;
  }

  window.fetch = async function attendanceStableFetch(input, init) {
    const adminState = isAdminStateRequest(input, init);
    const adminToken = isAdminTokenRequest(input, init);
    const checkin = isCheckinRequest(input, init);

    try {
      const response = await originalFetch(input, init);

      if (adminState || adminToken) {
        await captureResponsePayload(response, persistServerCode);
      }

      return response;
    } finally {
      if (adminToken) {
        tokenRequestInFlight = false;
        setButtonBusy("staffGenerateAttendanceCode", false);
      }

      if (checkin) {
        checkinRequestInFlight = false;
        setButtonBusy("liveAttendanceSubmit", false);
      }
    }
  };

  document.addEventListener(
    "click",
    event => {
      const button = event.target?.closest?.("#staffGenerateAttendanceCode");
      if (!button) return;

      if (tokenRequestInFlight) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      tokenRequestInFlight = true;
      setButtonBusy("staffGenerateAttendanceCode", true, "Cargando código...");
    },
    { capture: true }
  );

  document.addEventListener(
    "submit",
    event => {
      if (event.target?.id !== "liveAttendanceForm") return;

      if (checkinRequestInFlight) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      checkinRequestInFlight = true;
      setButtonBusy("liveAttendanceSubmit", true, "Validando...");
    },
    { capture: true }
  );
})();
