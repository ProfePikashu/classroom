
// COMMUNITY_ADMIN_PANEL_V1_20260626
(() => {
  const SESSION_KEY = "andyazh-classroom-session";
  const LOCAL_API_BASE = "http://127.0.0.1:8000/api/classroom";
  const PROD_API_BASE = "https://exampro-backend-1n6d.onrender.com/api/classroom";

  const els = {};

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function isLocalFrontend() {
    return ["127.0.0.1", "localhost"].includes(window.location.hostname);
  }

  function apiBase() {
    return isLocalFrontend() ? LOCAL_API_BASE : PROD_API_BASE;
  }

  function readSession() {
    try {
      if (window.ClassroomAuth?.getSession) {
        return window.ClassroomAuth.getSession() || {};
      }

      return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function getToken() {
    const session = readSession();

    return (
      session.access_token ||
      session.accessToken ||
      session.token ||
      session.jwt ||
      ""
    );
  }

  function isStaffSession() {
    const session = readSession();
    const role = String(session.role || "").toLowerCase();

    return Boolean(session.is_staff) || ["teacher", "docente", "moderador", "moderator", "admin"].includes(role);
  }

  async function communityAdminApi(path, options = {}) {
    const token = getToken();

    const headers = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    let body = options.body;

    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }

    const res = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });

    let data = null;

    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (!res.ok) {
      const detail = data?.detail || data?.message || `Error HTTP ${res.status}`;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }

    return data || {};
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

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function addDaysIso(days) {
    const amount = Number(days || 0);

    if (!amount) return null;

    const date = new Date();
    date.setDate(date.getDate() + amount);

    return date.toISOString();
  }

  function setMessage(message, isError = false) {
    if (!els.message) return;

    els.message.textContent = message || "";
    els.message.style.color = isError ? "#ff8a8a" : "";
  }

  function renderSummary(item = {}) {
    if (els.threads) els.threads.textContent = item.threads_count ?? 0;
    if (els.replies) els.replies.textContent = item.replies_count ?? 0;
    if (els.sanctions) els.sanctions.textContent = item.active_sanctions_count ?? 0;
    if (els.hiddenThreads) els.hiddenThreads.textContent = item.hidden_threads_count ?? 0;
    if (els.hiddenReplies) els.hiddenReplies.textContent = item.hidden_replies_count ?? 0;
  }

  function renderSanctions(items = []) {
    if (!els.sanctionsBody) return;

    if (!items.length) {
      els.sanctionsBody.innerHTML = `
        <tr>
          <td colspan="6">No hay sanciones activas.</td>
        </tr>
      `;
      return;
    }

    els.sanctionsBody.innerHTML = items.map((item) => {
      const user = item.target_name || item.target_twitch || item.target_dni || "Usuario";
      const twitch = item.target_twitch ? `@${item.target_twitch}` : "";
      const dni = item.target_dni ? `DNI ${item.target_dni}` : "";
      const type = item.sanction_type === "ban" ? "Ban" : "Silencio";
      const typeClass = item.sanction_type === "ban" ? "danger" : "";

      return `
        <tr data-sanction-id="${escapeHtml(item.id)}">
          <td>
            <strong>${escapeHtml(user)}</strong><br>
            <span class="community-admin-muted">${escapeHtml([twitch, dni].filter(Boolean).join(" · "))}</span>
          </td>
          <td>
            <span class="community-admin-pill ${typeClass}">
              <i class="fa-solid ${item.sanction_type === "ban" ? "fa-ban" : "fa-volume-xmark"}"></i>
              ${escapeHtml(type)}
            </span>
          </td>
          <td>${escapeHtml(item.reason || "—")}</td>
          <td>${formatDate(item.created_at)}</td>
          <td>${formatDate(item.expires_at)}</td>
          <td>
            <button class="btn btn-outline btn-sm" type="button" data-revoke-sanction="${escapeHtml(item.id)}">
              Quitar
            </button>
          </td>
        </tr>
      `;
    }).join("");

    els.sanctionsBody.querySelectorAll("[data-revoke-sanction]").forEach((button) => {
      button.addEventListener("click", () => revokeSanction(button.dataset.revokeSanction));
    });
  }

  function renderStats(items = []) {
    if (!els.statsBody) return;

    if (!items.length) {
      els.statsBody.innerHTML = `
        <tr>
          <td colspan="6">Todavía no hay actividad registrada.</td>
        </tr>
      `;
      return;
    }

    els.statsBody.innerHTML = items.map((item, index) => {
      const user = item.display_name || item.twitch || item.dni || "Usuario";
      const sub = [item.twitch ? `@${item.twitch}` : "", item.dni ? `DNI ${item.dni}` : ""].filter(Boolean).join(" · ");

      return `
        <tr>
          <td>
            <strong>#${index + 1} ${escapeHtml(user)}</strong><br>
            <span class="community-admin-muted">${escapeHtml(sub || item.role || "alumno")}</span>
          </td>
          <td>${Number(item.threads_count || 0)}</td>
          <td>${Number(item.replies_count || 0)}</td>
          <td>${Number(item.attachments_count || 0)}</td>
          <td><strong>${Number(item.total_activity_count || 0)}</strong></td>
          <td>${formatDate(item.last_activity_at)}</td>
        </tr>
      `;
    }).join("");
  }

  async function loadSummary() {
    const data = await communityAdminApi("/community/admin/summary");
    renderSummary(data.item || {});
  }

  async function loadSanctions() {
    const data = await communityAdminApi("/community/admin/sanctions?status=active&limit=100");
    renderSanctions(data.items || []);
  }

  async function loadStats() {
    const data = await communityAdminApi("/community/admin/user-stats?limit=100");
    renderStats(data.items || []);
  }

  async function loadAll() {
    try {
      setMessage("Cargando administración de comunidad...");
      await Promise.all([loadSummary(), loadSanctions(), loadStats()]);
      setMessage("Datos actualizados.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "No se pudo cargar administración de comunidad.", true);
    }
  }

  async function createSanction(event) {
    event.preventDefault();

    // COMMUNITY_ADMIN_RESET_FIX_20260626
    // Guardamos el form antes de cualquier await.
    // En algunos navegadores event.currentTarget puede quedar null después.
    const form = event.currentTarget;

    const targetDni = els.targetDni?.value.trim() || "";
    const targetTwitch = els.targetTwitch?.value.trim() || "";

    if (!targetDni && !targetTwitch) {
      window.alert("Necesito DNI o Twitch para sancionar.");
      return;
    }

    const reason = els.reason?.value.trim() || "";

    if (reason.length < 3) {
      window.alert("Poné un motivo un poquito más claro.");
      return;
    }

    const duration = els.duration?.value || "";

    const payload = {
      target_dni: targetDni || null,
      target_twitch: targetTwitch || null,
      target_name: els.targetName?.value.trim() || null,
      target_role: "alumno",
      sanction_type: els.type?.value || "mute",
      reason,
      expires_at: addDaysIso(duration),
    };

    try {
      const submit = form?.querySelector("button[type='submit']");
      if (submit) {
        submit.disabled = true;
        submit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Aplicando...`;
      }

      await communityAdminApi("/community/admin/sanctions", {
        method: "POST",
        body: payload,
      });

      form?.reset();
      setMessage("Sanción aplicada correctamente.");
      await loadAll();
    } catch (error) {
      console.error(error);
      window.alert(error.message || "No se pudo aplicar la sanción.");
    } finally {
      const submit = form?.querySelector("button[type='submit']");
      if (submit) {
        submit.disabled = false;
        submit.innerHTML = `<i class="fa-solid fa-gavel"></i> Aplicar sanción`;
      }
    }
  }

  async function revokeSanction(id) {
    if (!id) return;

    const reason = window.prompt("Motivo para quitar la sanción:", "Sanción revocada por moderación.");

    if (reason === null) return;

    try {
      await communityAdminApi(`/community/admin/sanctions/${encodeURIComponent(id)}/revoke`, {
        method: "PATCH",
        body: {
          reason,
        },
      });

      setMessage("Sanción revocada.");
      await loadAll();
    } catch (error) {
      console.error(error);
      window.alert(error.message || "No se pudo quitar la sanción.");
    }
  }

  function switchTab(name) {
    document.querySelectorAll("[data-community-admin-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.communityAdminTab === name);
    });

    if (els.sanctionsPanel) {
      els.sanctionsPanel.classList.toggle("community-admin-hidden", name !== "sanctions");
    }

    if (els.statsPanel) {
      els.statsPanel.classList.toggle("community-admin-hidden", name !== "stats");
    }
  }

  function cacheElements() {
    els.threads = $("#communityAdminThreads");
    els.replies = $("#communityAdminReplies");
    els.sanctions = $("#communityAdminSanctions");
    els.hiddenThreads = $("#communityAdminHiddenThreads");
    els.hiddenReplies = $("#communityAdminHiddenReplies");

    els.message = $("#communityAdminMessage");

    els.form = $("#communitySanctionForm");
    els.type = $("#communitySanctionType");
    els.targetDni = $("#communityTargetDni");
    els.targetTwitch = $("#communityTargetTwitch");
    els.targetName = $("#communityTargetName");
    els.reason = $("#communitySanctionReason");
    els.duration = $("#communitySanctionDuration");

    els.sanctionsPanel = $("#communitySanctionsPanel");
    els.statsPanel = $("#communityStatsPanel");
    els.sanctionsBody = $("#communitySanctionsBody");
    els.statsBody = $("#communityStatsBody");
    els.refresh = $("#communityAdminRefresh");
  }

  function bindEvents() {
    els.form?.addEventListener("submit", createSanction);
    els.refresh?.addEventListener("click", loadAll);

    document.querySelectorAll("[data-community-admin-tab]").forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.communityAdminTab));
    });
  }

  function init() {
    cacheElements();

    if (!isStaffSession()) {
      setMessage("Esta sección es solo para docentes y moderadores.", true);
      return;
    }

    bindEvents();
    loadAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
