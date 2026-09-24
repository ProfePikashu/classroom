/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — perfil.js
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomProfile = {
  async init() {
    if (typeof ClassroomAuth === "undefined") return;

    const session = ClassroomAuth.getSession();
    if (!session) return;

    this.paintCoursesLoading();

    await this.loadLiveProfile(session);
  },

  get apiBase() {
    return typeof EXAMPRO_API_BASE !== "undefined"
      ? EXAMPRO_API_BASE
      : "https://api.andyazhtec.com";
  },

  getToken(session) {
    return (
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      session?.exampro?.token ||
      session?.access_token ||
      session?.token ||
      session?.accessToken ||
      ""
    );
  },

  async fetchProfile(token) {
    const response = await fetch(
      `${this.apiBase}/api/classroom/me/profile`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.detail ||
        "No se pudo cargar el perfil."
      );
    }

    return data;
  },

  async loadLiveProfile(session) {
    const token = this.getToken(session);

    if (!token) {
      this.paintCoursesError(
        "No hay una sesión válida para consultar el perfil."
      );
      return;
    }

    try {
      const data = await this.fetchProfile(token);

      const student = data?.student || {};
      const enrollments = Array.isArray(data?.enrollments)
        ? data.enrollments
        : [];

      this.paintStudent(student, session);

      const updatedSession = {
        ...session,
        displayName:
          student.full_name ||
          session.displayName ||
          "",
        dni:
          student.dni ||
          session.dni ||
          "",
        email:
          student.email ||
          session.email ||
          "",
        telefono:
          student.phone ||
          session.telefono ||
          "",
        twitch:
          student.twitch ||
          session.twitch ||
          ""
      };

      ClassroomAuth.setSession(updatedSession);

      if (!enrollments.length) {
        this.paintCoursesError(
          "No se encontraron cursadas asociadas a este usuario."
        );
        return;
      }

      this.renderCourses(
        enrollments,
        updatedSession
      );
    } catch (error) {
      console.warn(
        "No se pudo cargar el perfil dinámico:",
        error
      );

      this.paintCoursesError(
        "No se pudieron cargar las cursadas en este momento."
      );
    }
  },

  paintStudent(student, session) {
    this.setText(
      "profileHeroName",
      student.full_name ||
      session.displayName ||
      "{ASIGNAR DATO}"
    );

    this.setText(
      "profileName",
      student.full_name ||
      session.displayName ||
      "{ASIGNAR DATO}"
    );

    this.setText(
      "profileDni",
      student.dni ||
      session.dni ||
      "{ASIGNAR DATO}"
    );

    this.setText(
      "profileEmail",
      student.email ||
      session.email ||
      "{ASIGNAR DATO}"
    );

    this.setText(
      "profilePhone",
      student.phone ||
      session.telefono ||
      "{ASIGNAR DATO}"
    );

    this.setText(
      "profileTwitch",
      student.twitch ||
      session.twitch ||
      "{ASIGNAR DATO}"
    );

    this.setText(
      "profileObservations",
      student.observations ||
      "-"
    );
  },

  paintCoursesLoading() {
    const panel =
      document.getElementById("profileCourse")
        ?.closest("article.panel");

    if (!panel) return;

    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <p class="eyebrow">Cursadas</p>
          <h3>Cargando...</h3>
        </div>
      </div>
    `;
  },

  paintCoursesError(message) {
    const panel =
      document.querySelector(
        ".profile-grid article.panel:nth-child(2)"
      );

    if (!panel) return;

    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <p class="eyebrow">Cursadas</p>
          <h3>${this.escapeHtml(message)}</h3>
        </div>
      </div>
    `;
  },

  renderCourses(enrollments, session) {
    const panel =
      document.querySelector(
        ".profile-grid article.panel:nth-child(2)"
      );

    if (!panel) return;

    const role =
      session.roleLabel ||
      "Alumno";

    const coursesHtml = enrollments.map(
      enrollment => {
        const course =
          enrollment?.course || {};

        const academic =
          enrollment?.academic || {};

        const courseSlug =
          String(course.slug || "").trim();

        const courseTitle =
          /^ayrpc-\d{4}$/i.test(courseSlug) && course.year
            ? `AyRPC ${course.year}`
            : course.name ||
              courseSlug ||
              "Cursada";

        const validClasses =
          Number(
            academic.valid_classes ?? 0
          );

        const totalClasses =
          Number(
            academic.total_classes ?? 0
          );

        const finalStatus =
          String(
            academic.final_status || ""
          ).toLowerCase();

        let examStatus = "No apto";

        if (academic.exam_eligible === true) {
          examStatus = "Apto";
        } else if (
          String(course.status || "").toLowerCase() === "active" &&
          finalStatus === "pending" &&
          validClasses === 0
        ) {
          examStatus = "Pendiente";
        }

        const result =
          this.formatFinalStatus(
            finalStatus
          );

        const enrollmentStatus =
          this.formatEnrollmentStatus(
            enrollment.status
          );

        const href = courseSlug
          ? `curso-${courseSlug}.html`
          : "courses.html";

        return `
          <div class="profile-course-block">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Cursada</p>
                <h3>${this.escapeHtml(courseTitle)}</h3>
              </div>
            </div>

            <div class="profile-data-grid">
              <div>
                <span>Curso</span>
                <strong>${this.escapeHtml(courseTitle)}</strong>
              </div>

              <div>
                <span>Estado</span>
                <strong>${this.escapeHtml(enrollmentStatus)}</strong>
              </div>

              <div>
                <span>Clases válidas</span>
                <strong>${validClasses}/${totalClasses}</strong>
              </div>

              <div>
                <span>APTO examen</span>
                <strong>${this.escapeHtml(examStatus)}</strong>
              </div>

              <div>
                <span>Resultado</span>
                <strong>${this.escapeHtml(result)}</strong>
              </div>

              <div>
                <span>Rol en Classroom</span>
                <strong>${this.escapeHtml(role)}</strong>
              </div>
            </div>

            <div class="home-actions-row">
              <a href="${this.escapeHtml(href)}" class="btn btn-primary">
                <i class="fa-solid fa-magnifying-glass-chart"></i>
                Ver estado completo
              </a>
            </div>
          </div>
        `;
      }
    ).join("");

    panel.innerHTML = coursesHtml;
  },

  formatEnrollmentStatus(value) {
    const status =
      String(value || "").toLowerCase();

    const labels = {
      active: "Activa",
      completed: "Completada",
      finished: "Finalizada",
      inactive: "Inactiva",
      withdrawn: "Baja registrada"
    };

    return (
      labels[status] ||
      value ||
      "Sin estado"
    );
  },

  formatFinalStatus(value) {
    const labels = {
      pending: "Pendiente",
      eligible: "Habilitado",
      passed: "Aprobado",
      failed: "Desaprobado",
      withdrawn: "Baja registrada"
    };

    return labels[value] || "Pendiente";
  },

  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;

    el.textContent = value;
  }
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
      session.displayName ||
      session.display_name ||
      session.full_name ||
      session.fullName ||
      session.name ||
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
