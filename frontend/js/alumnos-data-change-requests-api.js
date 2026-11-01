(() => {
  "use strict";

  const PANEL_ID = "solicitudes-cambios-datos";
  const STATUS_LABELS = {
    pending: "Pendiente",
    in_review: "En revisión",
    resolved: "Resuelta",
    rejected: "Rechazada",
  };

  let currentFilter = "open";
  let loading = false;

  function apiBase() {
    if (typeof ClassroomStudents !== "undefined") {
      if (typeof ClassroomStudents.getApiBase === "function") {
        return ClassroomStudents.getApiBase();
      }

      if (ClassroomStudents.apiBase) {
        return ClassroomStudents.apiBase;
      }
    }

    return (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "file:"
    )
      ? "http://127.0.0.1:8000"
      : "https://api.andyazhtec.com";
  }

  function authHeaders() {
    if (
      typeof ClassroomStudents !== "undefined" &&
      typeof ClassroomStudents.getAuthHeaders === "function"
    ) {
      return ClassroomStudents.getAuthHeaders();
    }

    return {};
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "—";

    try {
      return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function ensureStyles() {
    if (document.getElementById("dataChangeRequestsApiStyles")) return;

    const style = document.createElement("style");
    style.id = "dataChangeRequestsApiStyles";
    style.textContent = `
      #${PANEL_ID} .admin-data-change-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin: 14px 0;
      }
      #${PANEL_ID} .admin-data-change-filter.is-active {
        border-color: var(--accent, #8b5cf6);
        box-shadow: 0 0 0 1px var(--accent, #8b5cf6) inset;
      }
      #${PANEL_ID} .data-change-card {
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 14px;
        padding: 16px;
        margin-top: 12px;
        background: rgba(255,255,255,.025);
      }
      #${PANEL_ID} .data-change-card-head,
      #${PANEL_ID} .data-change-card-actions {
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
      }
      #${PANEL_ID} .data-change-meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 8px 14px;
        margin: 12px 0;
        font-size: .92rem;
      }
      #${PANEL_ID} .data-change-detail {
        white-space: pre-wrap;
        border-left: 3px solid rgba(139,92,246,.6);
        padding: 10px 12px;
        margin: 12px 0;
        background: rgba(139,92,246,.06);
        border-radius: 8px;
      }
      #${PANEL_ID} .data-change-notes {
        margin-top: 10px;
        opacity: .85;
        white-space: pre-wrap;
      }
      #${PANEL_ID} .data-change-status {
        display: inline-flex;
        align-items: center;
        padding: 5px 9px;
        border-radius: 999px;
        font-size: .78rem;
        border: 1px solid rgba(255,255,255,.16);
      }
      #${PANEL_ID} .admin-data-change-empty {
        padding: 18px 4px;
        opacity: .75;
      }
      #${PANEL_ID} button[disabled] { opacity: .6; cursor: wait; }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);

    if (panel?.dataset?.backend === "1") {
      return panel;
    }

    panel?.remove();

    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.dataset.backend = "1";
    panel.className = "admin-data-change-panel panel";
    panel.innerHTML = `
      <div class="admin-data-change-head">
        <div>
          <p class="eyebrow danger">Revisión requerida</p>
          <h3>Solicitudes de cambio de datos</h3>
          <p>Pedidos enviados desde <strong>Mis Datos</strong>. Quedan guardados hasta que el equipo los cierre.</p>
        </div>
        <span class="admin-data-change-counter" id="adminDataChangeCounter">0 abiertas</span>
      </div>

      <div class="admin-data-change-toolbar">
        <button class="btn btn-outline admin-data-change-filter is-active" type="button" data-filter="open">Abiertas</button>
        <button class="btn btn-outline admin-data-change-filter" type="button" data-filter="pending">Pendientes</button>
        <button class="btn btn-outline admin-data-change-filter" type="button" data-filter="in_review">En revisión</button>
        <button class="btn btn-outline admin-data-change-filter" type="button" data-filter="resolved">Resueltas</button>
        <button class="btn btn-outline admin-data-change-filter" type="button" data-filter="rejected">Rechazadas</button>
        <button class="btn btn-outline admin-data-change-filter" type="button" data-filter="all">Todas</button>
        <button class="btn btn-outline" id="adminDataChangeRefresh" type="button">
          <i class="fa-solid fa-rotate-right"></i>
          Actualizar
        </button>
      </div>

      <div class="admin-data-change-list" id="adminDataChangeList">
        <div class="admin-data-change-empty">
          <i class="fa-solid fa-spinner fa-spin"></i>
          <span>Cargando solicitudes...</span>
        </div>
      </div>
    `;

    const withdrawalPanel = document.getElementById("solicitudes-baja-curso");

    if (withdrawalPanel) {
      withdrawalPanel.insertAdjacentElement("afterend", panel);
      return panel;
    }

    const studentsList = document.querySelector(".students-list-panel");
    if (studentsList) {
      studentsList.insertAdjacentElement("beforebegin", panel);
      return panel;
    }

    const host = document.querySelector(".students-page-panel") || document.querySelector("main") || document.body;
    host.appendChild(panel);
    return panel;
  }

  async function requestJson(url, options = {}) {
    const requestOptions = {
      cache: "no-store",
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    };

    const response = await fetch(url, requestOptions);
    const data = await response.json().catch(() => null);

    if (!response.ok || data?.ok === false) {
      const error = new Error(data?.detail || data?.error || "No se pudo completar la operación.");
      error.status = response.status;
      throw error;
    }

    return data;
  }

  function renderItems(panel, items) {
    const list = panel.querySelector("#adminDataChangeList");
    const counter = panel.querySelector("#adminDataChangeCounter");
    if (!list || !counter) return;

    const openCount = items.filter((item) => ["pending", "in_review"].includes(item.status)).length;
    counter.textContent = currentFilter === "open"
      ? `${items.length} abiertas`
      : `${items.length} solicitudes`;

    if (!items.length) {
      list.innerHTML = `
        <div class="admin-data-change-empty">
          <i class="fa-regular fa-circle-check"></i>
          <span>No hay solicitudes para este filtro.</span>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map((item) => {
      const status = String(item.status || "pending");
      const name = item.current_name || item.student_name || "Alumno";
      const twitch = item.current_twitch || item.twitch || "—";
      const email = item.current_email || item.email || "—";
      const phone = item.current_phone || "—";
      const notes = item.resolution_notes
        ? `<div class="data-change-notes"><strong>Notas:</strong> ${escapeHtml(item.resolution_notes)}</div>`
        : "";

      const actions = [];

      if (status === "pending") {
        actions.push(`<button class="btn btn-outline" type="button" data-request-status="in_review" data-request-id="${escapeHtml(item.id)}">Tomar</button>`);
      }

      if (status !== "resolved") {
        actions.push(`<button class="btn btn-primary" type="button" data-request-status="resolved" data-request-id="${escapeHtml(item.id)}">Marcar resuelto</button>`);
      }

      if (status !== "rejected") {
        actions.push(`<button class="btn btn-ghost" type="button" data-request-status="rejected" data-request-id="${escapeHtml(item.id)}">Rechazar</button>`);
      }

      return `
        <article class="data-change-card">
          <div class="data-change-card-head">
            <div>
              <strong>${escapeHtml(name)}</strong>
              <span class="data-change-status">${escapeHtml(STATUS_LABELS[status] || status)}</span>
            </div>
            <small>${escapeHtml(formatDate(item.created_at))}</small>
          </div>

          <div class="data-change-meta">
            <span><strong>DNI:</strong> ${escapeHtml(item.dni || "—")}</span>
            <span><strong>Twitch actual:</strong> ${escapeHtml(twitch)}</span>
            <span><strong>Email actual:</strong> ${escapeHtml(email)}</span>
            <span><strong>Teléfono actual:</strong> ${escapeHtml(phone)}</span>
          </div>

          <div class="data-change-detail">${escapeHtml(item.detail || "")}</div>
          ${notes}

          <div class="data-change-card-actions">
            <small>${openCount ? "" : ""}</small>
            <div>${actions.join(" ")}</div>
          </div>
        </article>
      `;
    }).join("");
  }

  async function loadRequests() {
    if (loading) return;
    loading = true;

    const panel = ensurePanel();
    const list = panel.querySelector("#adminDataChangeList");
    const refresh = panel.querySelector("#adminDataChangeRefresh");

    if (refresh) refresh.disabled = true;
    if (list) {
      list.innerHTML = `
        <div class="admin-data-change-empty">
          <i class="fa-solid fa-spinner fa-spin"></i>
          <span>Cargando solicitudes...</span>
        </div>
      `;
    }

    try {
      const params = new URLSearchParams({ status: currentFilter, limit: "150" });
      const data = await requestJson(`${apiBase()}/api/classroom/admin/data-change-requests?${params.toString()}`);
      renderItems(panel, Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        panel.remove();
        return;
      }

      if (list) {
        list.innerHTML = `
          <div class="admin-data-change-empty">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>${escapeHtml(error?.message || "No se pudieron cargar las solicitudes.")}</span>
          </div>
        `;
      }
    } finally {
      loading = false;
      if (refresh?.isConnected) refresh.disabled = false;
    }
  }

  async function updateStatus(requestId, nextStatus, button) {
    let notes = null;

    if (["resolved", "rejected"].includes(nextStatus)) {
      const label = nextStatus === "resolved" ? "Resolución" : "Motivo del rechazo";
      const typed = window.prompt(`${label} (opcional):`, "");
      if (typed === null) return;
      notes = typed.trim() || null;
    }

    button.disabled = true;

    try {
      await requestJson(`${apiBase()}/api/classroom/admin/data-change-requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, notes }),
      });
      await loadRequests();
    } catch (error) {
      window.alert(error?.message || "No se pudo actualizar la solicitud.");
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  }

  function bind(panel) {
    if (panel.dataset.eventsBound === "1") return;
    panel.dataset.eventsBound = "1";

    panel.addEventListener("click", async (event) => {
      const filterButton = event.target.closest("[data-filter]");
      if (filterButton) {
        currentFilter = filterButton.dataset.filter || "open";
        panel.querySelectorAll("[data-filter]").forEach((button) => {
          button.classList.toggle("is-active", button === filterButton);
        });
        await loadRequests();
        return;
      }

      if (event.target.closest("#adminDataChangeRefresh")) {
        await loadRequests();
        return;
      }

      const action = event.target.closest("[data-request-status][data-request-id]");
      if (action) {
        await updateStatus(
          action.dataset.requestId,
          action.dataset.requestStatus,
          action
        );
      }
    });
  }

  function init() {
    ensureStyles();
    const panel = ensurePanel();
    bind(panel);
    loadRequests();

    if (window.location.hash === `#${PANEL_ID}`) {
      setTimeout(() => {
        document.getElementById(PANEL_ID)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 150);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("focus", () => {
    if (document.getElementById(PANEL_ID)) {
      loadRequests();
    }
  });
})();
