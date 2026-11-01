(() => {
  "use strict";

  const API_BASE =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.protocol === "file:"
      ? "http://127.0.0.1:8000"
      : "https://api.andyazhtec.com";

  function session() {
    return typeof ClassroomAuth !== "undefined" && ClassroomAuth.getSession
      ? ClassroomAuth.getSession()
      : null;
  }

  function authHeaders() {
    const current = session();
    const token =
      current?.classroomReadToken ||
      current?.exampro?.accessToken ||
      current?.exampro?.token ||
      current?.access_token ||
      current?.token ||
      current?.accessToken ||
      "";

    return token
      ? { Authorization: `Bearer ${token}` }
      : {};
  }

  function ensureStyles() {
    if (document.getElementById("profileDataChangeApiStyles")) return;

    const style = document.createElement("style");
    style.id = "profileDataChangeApiStyles";
    style.textContent = `
      #profileChangeRequestPanel .profile-change-api-status {
        margin-top: 12px;
        padding: 10px 12px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 10px;
        display: none;
      }
      #profileChangeRequestPanel .profile-change-api-status.is-visible { display: block; }
      #profileChangeRequestPanel .profile-change-api-status.is-success {
        border-color: rgba(74, 222, 128, .45);
        background: rgba(74, 222, 128, .08);
      }
      #profileChangeRequestPanel .profile-change-api-status.is-error {
        border-color: rgba(248, 113, 113, .45);
        background: rgba(248, 113, 113, .08);
      }
      #profileChangeRequestPanel button[disabled] { opacity: .65; cursor: wait; }
    `;
    document.head.appendChild(style);
  }

  function findInsertTarget() {
    const infoTitle = Array.from(document.querySelectorAll(".panel h3"))
      .find((node) => /informaci[oó]n registrada/i.test(node.textContent || ""));

    return infoTitle?.closest(".panel") || document.querySelector(".profile-grid") || document.querySelector("main");
  }

  function ensurePanel() {
    let panel = document.getElementById("profileChangeRequestPanel");

    if (!panel) {
      panel = document.createElement("section");
      panel.id = "profileChangeRequestPanel";
      panel.className = "profile-change-request-panel panel";
      const target = findInsertTarget();

      if (target?.classList?.contains("panel")) {
        target.insertAdjacentElement("afterend", panel);
      } else {
        target?.appendChild(panel);
      }
    }

    panel.dataset.backend = "1";
    panel.innerHTML = `
      <div class="profile-change-request-head">
        <div>
          <p class="eyebrow">Corrección de datos</p>
          <h3>¿Hay un dato mal cargado?</h3>
          <p>Mandanos la corrección y queda registrada para que el equipo docente la revise.</p>
        </div>

        <button class="btn btn-outline profile-change-request-toggle" id="profileChangeRequestToggle" type="button">
          <i class="fa-solid fa-pen-to-square"></i>
          Solicitar cambios
        </button>
      </div>

      <form class="profile-change-request-form" id="profileChangeRequestForm" hidden>
        <label for="profileChangeRequestText">
          Detallá el dato actual y cómo debería quedar:
        </label>

        <textarea
          id="profileChangeRequestText"
          rows="5"
          maxlength="900"
          placeholder="Ejemplo: TWITCH, figura profe_pikashu2 y debería ser profe_pikashu."
          required
        ></textarea>

        <p class="profile-change-request-help">
          La solicitud queda guardada y visible para el equipo docente hasta que la resolvamos.
        </p>

        <div class="profile-change-request-actions">
          <button class="btn btn-primary" id="profileChangeRequestSubmit" type="submit">
            <i class="fa-solid fa-paper-plane"></i>
            Enviar solicitud
          </button>

          <button class="btn btn-ghost" id="profileChangeRequestCancel" type="button">
            Cancelar
          </button>
        </div>

        <div class="profile-change-api-status" id="profileChangeRequestStatus" role="status"></div>
      </form>
    `;

    return panel;
  }

  function setStatus(panel, message, kind) {
    const target = panel.querySelector("#profileChangeRequestStatus");
    if (!target) return;

    target.textContent = message || "";
    target.className = "profile-change-api-status";

    if (message) {
      target.classList.add("is-visible", kind === "success" ? "is-success" : "is-error");
    }
  }

  async function submitRequest(detail) {
    const response = await fetch(`${API_BASE}/api/classroom/me/data-change-requests`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ detail }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.detail || data?.error || "No se pudo enviar la solicitud.");
    }

    return data;
  }

  function init() {
    const current = session();
    const role = String(current?.role || current?.rol || "").toLowerCase();

    if (role && !["alumno", "student"].includes(role)) {
      document.getElementById("profileChangeRequestPanel")?.remove();
      return;
    }

    ensureStyles();
    const panel = ensurePanel();
    const toggle = panel.querySelector("#profileChangeRequestToggle");
    const form = panel.querySelector("#profileChangeRequestForm");
    const cancel = panel.querySelector("#profileChangeRequestCancel");
    const textarea = panel.querySelector("#profileChangeRequestText");
    const submit = panel.querySelector("#profileChangeRequestSubmit");

    toggle?.addEventListener("click", () => {
      form.hidden = !form.hidden;
      setStatus(panel, "", "");
      if (!form.hidden) textarea?.focus();
    });

    cancel?.addEventListener("click", () => {
      form.hidden = true;
      form.reset();
      setStatus(panel, "", "");
    });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const detail = String(textarea?.value || "").trim();

      if (detail.length < 10) {
        setStatus(panel, "Detallá un poco más qué dato necesitás cambiar.", "error");
        textarea?.focus();
        return;
      }

      submit.disabled = true;
      setStatus(panel, "Enviando solicitud...", "success");

      try {
        await submitRequest(detail);
        form.reset();
        setStatus(
          panel,
          "Solicitud enviada. Ya quedó registrada para el equipo docente.",
          "success"
        );
      } catch (error) {
        setStatus(panel, error?.message || "No se pudo enviar la solicitud.", "error");
      } finally {
        submit.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
