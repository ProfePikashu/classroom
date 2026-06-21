/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — perfil.js
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomProfile = {
  init() {
    if (typeof ClassroomAuth === "undefined") return;

    const session = ClassroomAuth.getSession();

    if (!session) return;

    this.paint(session);
  },

  paint(session) {
    const alumno = session.alumno || {};

    this.setText("profileHeroName", alumno["Nombre Completo"] || session.displayName || "{ASIGNAR DATO}");
    this.setText("profileName", alumno["Nombre Completo"] || session.displayName || "{ASIGNAR DATO}");
    this.setText("profileDni", session.dni || alumno["DNI"] || "{ASIGNAR DATO}");
    this.setText("profileEmail", alumno["Correo"] || session.email || "{ASIGNAR DATO}");
    this.setText("profilePhone", alumno["Teléfono (con Código de Área)"] || "{ASIGNAR DATO}");
    this.setText("profileTwitch", session.twitch || alumno["Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)"] || "{ASIGNAR DATO}");
    this.setText("profileObservations", alumno["Observaciones"] || "{ASIGNAR DATO}");
    this.setText("profileApto", alumno["APTO"] || "{ASIGNAR DATO}");
    this.setText("profileResult", alumno["Resultado"] || "Pendiente / Sin cargar");
    this.setText("profileRole", session.roleLabel || "Alumno");
  },

  setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomProfile.init();
});

/* === Perfil Data Change Request 20260621 === */
(function initPerfilDataChangeRequest() {
  "use strict";

  const STORAGE_KEY = "andyazh-classroom-data-change-requests-v1";
  const SESSION_KEY = "andyazh-classroom-session";

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  }

  function getSession() {
    return safeJson(localStorage.getItem(SESSION_KEY), {});
  }

  function getRequests() {
    return safeJson(localStorage.getItem(STORAGE_KEY), []);
  }

  function saveRequests(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("classroom:data-change-requests-updated", {
      detail: { items },
    }));
  }

  function getStudentName(session) {
    return (
      session.nombreCompleto ||
      session.nombre_completo ||
      session.name ||
      session.nombre ||
      session.fullName ||
      [session.nombre, session.apellido].filter(Boolean).join(" ") ||
      "Alumno"
    );
  }

  function getStudentDni(session) {
    return session.dni || session.documento || session.DNI || "";
  }

  function getStudentTwitch(session) {
    return session.twitch || session.usuario_twitch || session.username || "";
  }

  function getStudentEmail(session) {
    return session.email || session.correo || "";
  }

  function createStaffNotification(request) {
    if (!window.ClassroomNotifications?.create) return;

    window.ClassroomNotifications.create({
      type: "admin_data_change_request",
      severity: "danger",
      audience: "staff",
      title: "Solicitud de cambio de datos",
      body: `${request.studentName} pidió corregir información registrada.`,
      actor: request.studentName,
      link: "alumnos.html#solicitudes-cambios-datos",
      createdAt: request.createdAt,
      read: false,
    });
  }

  function findInsertTarget() {
    const panels = Array.from(document.querySelectorAll(".panel, section, article"));

    const infoPanel = panels.find((panel) => {
      const text = (panel.textContent || "").replace(/\s+/g, " ").toLowerCase();
      return text.includes("información del alumno")
        || text.includes("informacion del alumno")
        || text.includes("información registrada")
        || text.includes("informacion registrada")
        || text.includes("datos registrados");
    });

    if (infoPanel) return infoPanel;

    return document.querySelector("main .main-content")
      || document.querySelector("main")
      || document.body;
  }

  function buildCard() {
    const wrapper = document.createElement("section");
    wrapper.className = "profile-change-request-panel panel";
    wrapper.id = "profileChangeRequestPanel";

    wrapper.innerHTML = `
      <div class="profile-change-request-head">
        <div>
          <p class="eyebrow">Corrección de datos</p>
          <h3>¿Hay un dato mal cargado?</h3>
          <p>
            Si ves un error en tu información registrada, podés solicitar una corrección para que el equipo docente la revise.
          </p>
        </div>

        <button class="btn btn-outline profile-change-request-toggle" id="profileChangeRequestToggle" type="button">
          <i class="fa-solid fa-pen-to-square"></i>
          Solicitar cambios
        </button>
      </div>

      <form class="profile-change-request-form" id="profileChangeRequestForm" hidden>
        <label for="profileChangeRequestText">
          Detallá de forma clara y concisa el dato que necesitás cambiar:
        </label>

        <textarea
          id="profileChangeRequestText"
          rows="5"
          maxlength="900"
          placeholder="Ejemplo: NOMBRE, cambiar a: Arturo Andres Coria.&#10;Ejemplo: CORREO, cambiar a: alumno@email.com."
          required
        ></textarea>

        <p class="profile-change-request-help">
          Incluí el dato actual, el dato correcto y cualquier aclaración útil para validarlo.
        </p>

        <div class="profile-change-request-actions">
          <button class="btn btn-primary" type="submit">
            <i class="fa-solid fa-paper-plane"></i>
            Enviar solicitud
          </button>

          <button class="btn btn-ghost" id="profileChangeRequestCancel" type="button">
            Cancelar
          </button>
        </div>
      </form>
    `;

    return wrapper;
  }

  function init() {
    if (document.getElementById("profileChangeRequestPanel")) return;

    const target = findInsertTarget();
    const card = buildCard();

    target.insertAdjacentElement("afterend", card);

    const toggle = card.querySelector("#profileChangeRequestToggle");
    const form = card.querySelector("#profileChangeRequestForm");
    const cancel = card.querySelector("#profileChangeRequestCancel");
    const textarea = card.querySelector("#profileChangeRequestText");

    toggle?.addEventListener("click", () => {
      form.hidden = !form.hidden;

      if (!form.hidden) {
        textarea?.focus();
      }
    });

    cancel?.addEventListener("click", () => {
      form.hidden = true;
      form.reset();
    });

    form?.addEventListener("submit", (event) => {
      event.preventDefault();

      const detail = textarea.value.trim();

      if (detail.length < 10) {
        alert("Detallá un poco más qué dato necesitás cambiar.");
        textarea.focus();
        return;
      }

      const session = getSession();
      const now = new Date().toISOString();

      const request = {
        id: `data-change-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "data_change_request",
        status: "pendiente",
        severity: "danger",
        detail,
        createdAt: now,
        updatedAt: now,
        studentName: getStudentName(session),
        dni: getStudentDni(session),
        twitch: getStudentTwitch(session),
        email: getStudentEmail(session),
        role: session.role || session.rol || "student",
      };

      const requests = getRequests();
      requests.unshift(request);
      saveRequests(requests);
      createStaffNotification(request);

      form.hidden = true;
      form.reset();

      alert("Solicitud enviada. El equipo docente va a revisar el cambio solicitado.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* === Perfil Data Change Request Placement V2 20260621 === */
(function refinePerfilDataChangeRequestPlacement() {
  "use strict";

  function getText(node) {
    return (node?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function findInfoPanel() {
    const panels = Array.from(document.querySelectorAll(".panel, section, article"));

    return panels.find((panel) => {
      const text = getText(panel);

      return text.includes("información del alumno")
        || text.includes("informacion del alumno")
        || text.includes("información registrada")
        || text.includes("informacion registrada")
        || text.includes("datos registrados");
    });
  }

  function findHeader(panel) {
    return panel?.querySelector(".panel-header")
      || panel?.querySelector(".profile-card-header")
      || panel?.querySelector("header")
      || panel?.firstElementChild;
  }

  function getRequestPanel() {
    return document.getElementById("profileChangeRequestPanel");
  }

  function getRequestForm() {
    return document.getElementById("profileChangeRequestForm");
  }

  function getRequestTextarea() {
    return document.getElementById("profileChangeRequestText");
  }

  function syncPanelState() {
    const panel = getRequestPanel();
    const form = getRequestForm();

    if (!panel || !form) return;

    panel.classList.toggle("is-open", !form.hidden);
  }

  function openRequestCard() {
    const panel = getRequestPanel();
    const form = getRequestForm();
    const textarea = getRequestTextarea();

    if (!panel || !form) return;

    form.hidden = false;
    panel.classList.add("is-open");

    panel.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });

    setTimeout(() => textarea?.focus(), 180);
  }

  function closeRequestCard() {
    const panel = getRequestPanel();
    const form = getRequestForm();

    if (!panel || !form) return;

    form.hidden = true;
    form.reset();
    panel.classList.remove("is-open");
  }

  function neutralizeRealNamePlaceholders() {
    const textarea = getRequestTextarea();
    if (!textarea) return;

    textarea.placeholder = [
      "Ejemplo: NOMBRE, cambiar a: [nuevo nombre correcto].",
      "Ejemplo: CORREO, cambiar a: [correo correcto].",
      "Ejemplo: TELÉFONO, cambiar a: [nuevo teléfono correcto]."
    ].join("\n");
  }

  function hideOldInlineButton() {
    const oldButton = document.querySelector("#profileChangeRequestToggle");
    if (!oldButton) return;

    oldButton.classList.add("profile-change-request-old-toggle-hidden");
    oldButton.setAttribute("tabindex", "-1");
    oldButton.setAttribute("aria-hidden", "true");
  }

  function injectTopButton() {
    const infoPanel = findInfoPanel();
    const requestPanel = getRequestPanel();

    if (!infoPanel || !requestPanel) return false;

    infoPanel.classList.add("profile-info-panel-with-change-action");

    const header = findHeader(infoPanel) || infoPanel;
    header.classList.add("profile-info-change-action-host");

    let button = document.getElementById("profileChangeRequestTopButton");

    if (!button) {
      button = document.createElement("button");
      button.id = "profileChangeRequestTopButton";
      button.className = "btn btn-outline profile-change-request-top-button";
      button.type = "button";
      button.innerHTML = `
        <i class="fa-solid fa-pen-to-square"></i>
        Solicitar cambios
      `;

      header.appendChild(button);
    }

    button.addEventListener("click", () => {
      const form = getRequestForm();

      if (!form) return;

      if (form.hidden) {
        openRequestCard();
      } else {
        closeRequestCard();
      }
    });

    // La card completa queda pegada debajo de Información registrada
    if (requestPanel.previousElementSibling !== infoPanel) {
      infoPanel.insertAdjacentElement("afterend", requestPanel);
    }

    syncPanelState();
    return true;
  }

  function bindCancelButton() {
    const cancel = document.getElementById("profileChangeRequestCancel");
    if (!cancel || cancel.dataset.placementV2Bound === "true") return;

    cancel.dataset.placementV2Bound = "true";
    cancel.addEventListener("click", () => {
      closeRequestCard();
    });
  }

  function bindSubmitSync() {
    const form = getRequestForm();
    if (!form || form.dataset.placementV2Bound === "true") return;

    form.dataset.placementV2Bound = "true";
    form.addEventListener("submit", () => {
      setTimeout(syncPanelState, 80);
    });
  }

  function refine() {
    neutralizeRealNamePlaceholders();
    hideOldInlineButton();

    const ok = injectTopButton();

    bindCancelButton();
    bindSubmitSync();
    syncPanelState();

    return ok;
  }

  function init() {
    refine();

    // El script original puede construir la card después; lo esperamos un toque.
    setTimeout(refine, 120);
    setTimeout(refine, 350);
    setTimeout(refine, 800);

    const observer = new MutationObserver(() => {
      refine();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
