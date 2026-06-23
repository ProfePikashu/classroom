/*
  AndyAzhTEC Classroom — Centro de notificaciones
  MVP local. Luego se conecta a Supabase/backend.
*/

(function initNotificationCenterAdmin() {
  "use strict";

  const STORAGE_KEY = "andyazh-classroom-notifications-v2";

  const els = {
    form: document.getElementById("notificationAdminForm"),
    formTitle: document.getElementById("notificationFormTitle"),
    editId: document.getElementById("notificationEditId"),
    title: document.getElementById("notificationTitle"),
    body: document.getElementById("notificationBody"),
    type: document.getElementById("notificationType"),
    severity: document.getElementById("notificationSeverity"),
    audience: document.getElementById("notificationAudience"),
    link: document.getElementById("notificationLink"),
    reset: document.getElementById("notificationResetForm"),
    preview: document.getElementById("notificationPreviewDemo"),
    search: document.getElementById("notificationSearch"),
    filterType: document.getElementById("notificationFilterType"),
    list: document.getElementById("notificationAdminList"),
    counter: document.getElementById("notificationAdminCounter"),
    markAllRead: document.getElementById("notificationMarkAllRead"),
    clearAll: document.getElementById("notificationClearAllAdmin"),
  };

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  }

  function loadItems() {
    return safeJson(localStorage.getItem(STORAGE_KEY), []);
  }

  function saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("classroom:notifications-updated", {
      detail: { items },
    }));
  }

  function getSession() {
    return safeJson(localStorage.getItem("andyazh-classroom-session"), {});
  }

  function getActor() {
    const session = getSession();

    return (
      session.nombreCompleto ||
      session.nombre_completo ||
      session.name ||
      [session.nombre, session.apellido].filter(Boolean).join(" ") ||
      session.twitch ||
      "Staff"
    );
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
    if (!value) return "Sin fecha";

    try {
      return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function normalizeSeverity(type, severity) {
    if (severity) return severity;

    if (type === "community") return "info";
    if (type === "academic") return "danger";
    if (type === "announcement") return "warning";

    return "neutral";
  }

  function colorLabel(item) {
    const severity = normalizeSeverity(item.type, item.severity);

    if (severity === "danger") return "Rojo";
    if (severity === "warning") return "Amarillo";
    if (severity === "info") return "Azul";

    return "Violeta";
  }

  function typeLabel(type) {
    const labels = {
      community: "Comunidad",
      announcement: "Aviso",
      academic: "Académica",
      system: "Sistema",
      admin_data_change_request: "Datos",
    };

    return labels[type] || type || "Sistema";
  }

  function createItemFromForm() {
    const now = new Date().toISOString();
    const type = els.type.value;
    const severity = normalizeSeverity(type, els.severity.value);

    return {
      id: els.editId.value || `admin-notification-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: els.title.value.trim(),
      body: els.body.value.trim(),
      type,
      severity,
      audience: els.audience.value,
      link: els.link.value.trim(),
      actor: getActor(),
      createdAt: els.editId.value ? undefined : now,
      updatedAt: now,
      read: false,
      source: "notification-center",
      emailEnabled: false,
    };
  }

  function resetForm() {
    els.form.reset();
    els.editId.value = "";
    els.type.value = "announcement";
    els.severity.value = "warning";
    els.audience.value = "all";
    els.formTitle.textContent = "Nueva notificación";
  }

  function fillForm(item) {
    els.editId.value = item.id;
    els.title.value = item.title || "";
    els.body.value = item.body || "";
    els.type.value = item.type || "announcement";
    els.severity.value = normalizeSeverity(item.type, item.severity);
    els.audience.value = item.audience || item.audience_type || "all";
    els.link.value = item.link || item.link_url || "";

    els.formTitle.textContent = "Editar notificación";
    els.title.focus();

    document.querySelector(".notifications-center-composer")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function upsertNotification(event) {
    event.preventDefault();

    const item = createItemFromForm();

    if (!item.title || !item.body) {
      alert("Completá título y mensaje.");
      return;
    }

    const items = loadItems();
    const index = items.findIndex((current) => current.id === item.id);

    if (index >= 0) {
      const previous = items[index];

      items[index] = {
        ...previous,
        ...item,
        createdAt: previous.createdAt || new Date().toISOString(),
        read: previous.read ?? false,
      };
    } else {
      items.unshift(item);
    }

    saveItems(items);
    resetForm();
    render();
  }

  function deleteNotification(id) {
    const ok = window.confirm("¿Eliminar esta notificación del centro?");
    if (!ok) return;

    const items = loadItems().filter((item) => item.id !== id);

    saveItems(items);
    render();
  }

  function resendNotification(id) {
    const item = loadItems().find((current) => current.id === id);
    if (!item) return;

    const ok = window.confirm("¿Reenviar esta notificación? Se creará una copia nueva no leída.");
    if (!ok) return;

    const copy = {
      ...item,
      id: `resend-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: item.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      read: false,
      resentFrom: item.id,
      actor: getActor(),
    };

    const items = loadItems();
    items.unshift(copy);

    saveItems(items);
    render();
  }

  function toggleRead(id) {
    const items = loadItems().map((item) => {
      if (item.id !== id) return item;

      return {
        ...item,
        read: !item.read,
        updatedAt: new Date().toISOString(),
      };
    });

    saveItems(items);
    render();
  }

  function markAllRead() {
    const items = loadItems().map((item) => ({
      ...item,
      read: true,
      updatedAt: new Date().toISOString(),
    }));

    saveItems(items);
    render();
  }

  function clearAll() {
    const ok = window.confirm("¿Limpiar todas las notificaciones locales del centro?");
    if (!ok) return;

    saveItems([]);
    render();
  }

  function previewDemo() {
    els.title.value = "Aviso importante del curso";
    els.body.value = "Se publicó una nueva actualización en el Classroom. Revisá la sección correspondiente.";
    els.type.value = "announcement";
    els.severity.value = "warning";
    els.audience.value = "all";
    els.link.value = "index.html";
  }

  function getFilteredItems() {
    const query = (els.search.value || "").trim().toLowerCase();
    const type = els.filterType.value;

    return loadItems().filter((item) => {
      const matchesType = type === "all" || item.type === type;

      const haystack = [
        item.title,
        item.body,
        item.type,
        item.severity,
        item.actor,
        item.audience,
      ].join(" ").toLowerCase();

      const matchesQuery = !query || haystack.includes(query);

      return matchesType && matchesQuery;
    });
  }

  function renderEmpty() {
    els.list.innerHTML = `
      <div class="notification-admin-empty">
        <i class="fa-solid fa-bell-slash"></i>
        <strong>No hay notificaciones todavía.</strong>
        <p>Creá la primera desde el formulario de la izquierda.</p>
      </div>
    `;
  }

  function render() {
    if (!els.list) return;

    const items = getFilteredItems();

    els.counter.textContent = String(loadItems().length);

    if (!items.length) {
      renderEmpty();
      return;
    }

    els.list.innerHTML = items.map((item) => {
      const severity = normalizeSeverity(item.type, item.severity);
      const isRead = Boolean(item.read);

      return `
        <article class="notification-admin-item is-${escapeHtml(severity)} ${isRead ? "is-read" : "is-unread"}" data-notification-id="${escapeHtml(item.id)}">
          <div class="notification-admin-item-icon">
            <i class="fa-solid ${severity === "danger" ? "fa-triangle-exclamation" : severity === "warning" ? "fa-bullhorn" : severity === "info" ? "fa-comments" : "fa-bell"}"></i>
          </div>

          <div class="notification-admin-item-body">
            <div class="notification-admin-item-top">
              <div>
                <h4>${escapeHtml(item.title)}</h4>
                <div class="notification-admin-tags">
                  <span>${escapeHtml(typeLabel(item.type))}</span>
                  <span>${escapeHtml(colorLabel(item))}</span>
                  <span>${escapeHtml(item.audience || "all")}</span>
                  <span>${isRead ? "Leída" : "No leída"}</span>
                </div>
              </div>

              <small>${escapeHtml(formatDate(item.createdAt))}</small>
            </div>

            <p>${escapeHtml(item.body)}</p>

            ${item.link ? `<a class="notification-admin-link" href="${escapeHtml(item.link)}">${escapeHtml(item.link)}</a>` : ""}

            <div class="notification-admin-item-actions">
              <button type="button" data-admin-edit="${escapeHtml(item.id)}">
                <i class="fa-solid fa-pen"></i>
                Editar
              </button>

              <button type="button" data-admin-resend="${escapeHtml(item.id)}">
                <i class="fa-solid fa-paper-plane"></i>
                Reenviar
              </button>

              <button type="button" data-admin-read="${escapeHtml(item.id)}">
                <i class="fa-solid ${isRead ? "fa-envelope" : "fa-envelope-open"}"></i>
                ${isRead ? "Marcar no leída" : "Marcar leída"}
              </button>

              <button type="button" class="danger" data-admin-delete="${escapeHtml(item.id)}">
                <i class="fa-solid fa-trash"></i>
                Borrar
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function bindEvents() {
    els.form?.addEventListener("submit", upsertNotification);
    els.reset?.addEventListener("click", resetForm);
    els.preview?.addEventListener("click", previewDemo);
    els.search?.addEventListener("input", render);
    els.filterType?.addEventListener("change", render);
    els.markAllRead?.addEventListener("click", markAllRead);
    els.clearAll?.addEventListener("click", clearAll);

    document.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-admin-edit]");
      if (edit) {
        const item = loadItems().find((current) => current.id === edit.dataset.adminEdit);
        if (item) fillForm(item);
        return;
      }

      const resend = event.target.closest("[data-admin-resend]");
      if (resend) {
        resendNotification(resend.dataset.adminResend);
        return;
      }

      const read = event.target.closest("[data-admin-read]");
      if (read) {
        toggleRead(read.dataset.adminRead);
        return;
      }

      const del = event.target.closest("[data-admin-delete]");
      if (del) {
        deleteNotification(del.dataset.adminDelete);
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY) render();
    });

    window.addEventListener("classroom:notifications-updated", render);
  }

  function init() {
    resetForm();
    bindEvents();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* === Centro Notificaciones Backend Bridge 20260621 === */
(function centroNotificacionesBackendBridge() {
  "use strict";

  const STORAGE_KEY = "andyazh-classroom-notifications-v2";

  function getBackendApi() {
    return window.ClassroomBackendNotifications || null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  }

  function getApiBase() {
    if (getBackendApi()?.getApiBase) {
      return getBackendApi().getApiBase();
    }

    const host = window.location.hostname;

    if (host === "localhost" || host === "127.0.0.1" || host === "") {
      return "http://127.0.0.1:8000";
    }

    return "https://exampro-backend-1n6d.onrender.com";
  }

  function loadSession() {
    return safeJson(localStorage.getItem("andyazh-classroom-session"), {});
  }

  function getToken(session) {
    return (
      session.access_token ||
      session.accessToken ||
      session.token ||
      session.student_token ||
      session.exampro_token ||
      session.jwt ||
      session?.exampro?.access_token ||
      session?.exampro?.token ||
      ""
    );
  }

  async function ensureToken() {
    if (getBackendApi()?.ensureBackendToken) {
      return getBackendApi().ensureBackendToken();
    }

    const session = loadSession();
    const existing = getToken(session);

    if (existing) return existing;

    const dni = String(session.dni || session?.alumno?.dni || "").trim();
    const twitch = String(session.twitch || session?.alumno?.twitch || session?.alumno?.twitch_username || "").trim();

    if (!dni || !twitch) {
      throw new Error("No hay DNI/Twitch para autenticar contra Classroom.");
    }

    const response = await fetch(`${getApiBase()}/api/classroom/student-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni, twitch }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.access_token) {
      throw new Error(data.detail || "No se pudo iniciar sesión en backend.");
    }

    const updated = {
      ...session,
      access_token: data.access_token,
      token_type: data.token_type || "bearer",
      backendRole: data.role,
      exampro: {
        ...(session.exampro && typeof session.exampro === "object" ? session.exampro : {}),
        access_token: data.access_token,
        token_type: data.token_type || "bearer",
        role: data.role,
      },
    };

    localStorage.setItem("andyazh-classroom-session", JSON.stringify(updated));

    return data.access_token;
  }

  async function apiFetch(path, options = {}) {
    const token = await ensureToken();

    const response = await fetch(`${getApiBase()}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || `Error backend ${response.status}`);
    }

    return data;
  }

  function normalizeAudience(value) {
    const raw = String(value || "all").trim();

    if (raw === "course-ayrpc-2025") return { audience_type: "course", course: "AyRPC 2025" };
    if (raw === "course-ayrpc-2026") return { audience_type: "course", course: "AyRPC 2026" };

    return {
      audience_type: raw || "all",
      course: null,
    };
  }

  function normalizeItem(item) {
    const createdAt = item.createdAt || item.created_at || new Date().toISOString();

    return {
      ...item,
      id: String(item.id),
      title: item.title || "Notificación",
      body: item.body || item.description || "",
      description: item.body || item.description || "",
      link: item.link || item.link_url || "",
      link_url: item.link_url || item.link || "",
      audience: item.audience || item.audience_type || "all",
      audience_type: item.audience_type || item.audience || "all",
      createdAt,
      created_at: createdAt,
      source: "supabase",
    };
  }

  function getFormPayload() {
    const form = document.querySelector("#notificationAdminForm, [data-notification-admin-form]");
    if (!form) throw new Error("No encontré el formulario del Centro de notificaciones.");

    const formData = new FormData(form);

    const title =
      formData.get("title") ||
      form.querySelector('[name="title"], #notificationTitle')?.value ||
      "";

    const body =
      formData.get("body") ||
      formData.get("description") ||
      form.querySelector('[name="body"], [name="description"], #notificationBody')?.value ||
      "";

    const type =
      formData.get("type") ||
      form.querySelector('[name="type"], #notificationType')?.value ||
      "announcement";

    const severity =
      formData.get("severity") ||
      form.querySelector('[name="severity"], #notificationSeverity')?.value ||
      "";

    const audienceRaw =
      formData.get("audience") ||
      formData.get("audience_type") ||
      form.querySelector('[name="audience"], [name="audience_type"], #notificationAudience')?.value ||
      "all";

    const explicitCourse =
      formData.get("course") ||
      form.querySelector('[name="course"], #notificationCourse')?.value ||
      "";

    const link =
      formData.get("link") ||
      formData.get("link_url") ||
      form.querySelector('[name="link"], [name="link_url"], #notificationLink')?.value ||
      "";

    const audience = normalizeAudience(audienceRaw);

    return {
      title: String(title).trim(),
      body: String(body).trim(),
      type: String(type || "announcement").trim(),
      severity: String(severity || "").trim() || null,
      audience_type: audience.audience_type,
      audience: audience.audience_type,
      course: String(explicitCourse || audience.course || "").trim() || null,
      link_url: String(link || "").trim() || null,
      send_email: false,
      email_required: false,
    };
  }

  function getEditingId() {
    return (
      document.querySelector("#notificationEditId")?.value ||
      document.querySelector('[name="notificationEditId"]')?.value ||
      document.querySelector('[name="editId"]')?.value ||
      document.querySelector("[data-notification-edit-id]")?.value ||
      ""
    ).trim();
  }

  function clearEditingId() {
    const candidates = [
      document.querySelector("#notificationEditId"),
      document.querySelector('[name="notificationEditId"]'),
      document.querySelector('[name="editId"]'),
      document.querySelector("[data-notification-edit-id]"),
    ].filter(Boolean);

    candidates.forEach((el) => {
      el.value = "";
    });
  }

  function fillEditForm(item) {
    const form = document.querySelector("#notificationAdminForm, [data-notification-admin-form]");
    if (!form) return;

    const set = (selector, value) => {
      const el = form.querySelector(selector);
      if (el) {
        el.value = value ?? "";
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    const audienceValue =
      item.audience_type === "course" && String(item.course || "").includes("2026")
        ? "course-ayrpc-2026"
        : item.audience_type === "course"
          ? "course-ayrpc-2025"
          : item.audience_type || item.audience || "all";

    set('[name="title"], #notificationTitle', item.title || "");
    set('[name="body"], [name="description"], #notificationBody', item.body || item.description || "");
    set('[name="type"], #notificationType', item.type || "announcement");
    set('[name="severity"], #notificationSeverity', item.severity || "");
    set('[name="audience"], [name="audience_type"], #notificationAudience', audienceValue);
    set('[name="course"], #notificationCourse', item.course || "");
    set('[name="link"], [name="link_url"], #notificationLink', item.link_url || item.link || "");

    const idInput =
      form.querySelector("#notificationEditId") ||
      form.querySelector('[name="notificationEditId"]') ||
      form.querySelector('[name="editId"]') ||
      form.querySelector("[data-notification-edit-id]");

    if (idInput) idInput.value = item.id;

    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderBackendAdminList(items) {
    const list =
      document.querySelector("#notificationAdminList") ||
      document.querySelector("#notificationsAdminList") ||
      document.querySelector("[data-notification-admin-list]") ||
      document.querySelector(".notification-admin-list");

    if (!list) return;

    if (!items.length) {
      list.innerHTML = `
        <div class="notification-admin-empty">
          <i class="fa-regular fa-bell"></i>
          <strong>No hay notificaciones todavía</strong>
          <p>Cuando crees avisos desde este centro, van a aparecer acá.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map((item) => {
      const severity = item.severity || "neutral";
      const type = item.type || "system";
      const body = item.body || item.description || "";
      const recipients = item.recipients_count ?? item.recipientsCreated ?? item.recipients_created ?? 0;
      const unread = item.unread_count ?? item.unread ?? 0;

      return `
        <article class="notification-admin-item is-${escapeHtml(severity)}" data-admin-notification-id="${escapeHtml(item.id)}">
          <div class="notification-admin-item-main">
            <div class="notification-admin-item-head">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(type)} · ${escapeHtml(severity)}</span>
            </div>

            <p>${escapeHtml(body)}</p>

            <small>
              Audiencia: ${escapeHtml(item.audience_type || item.audience || "all")}
              ${item.course ? " · Curso: " + escapeHtml(item.course) : ""}
              · Destinatarios: ${escapeHtml(recipients)}
              · No leídas: ${escapeHtml(unread)}
            </small>
          </div>

          <div class="notification-admin-item-actions">
            <button type="button" data-backend-notification-edit="${escapeHtml(item.id)}">
              <i class="fa-solid fa-pen"></i>
              Editar
            </button>
            <button type="button" data-backend-notification-resend="${escapeHtml(item.id)}">
              <i class="fa-solid fa-paper-plane"></i>
              Reenviar
            </button>
            <button type="button" data-backend-notification-delete="${escapeHtml(item.id)}">
              <i class="fa-solid fa-trash"></i>
              Borrar
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  async function loadAdminNotifications() {
    const data = await apiFetch("/api/classroom/notifications/admin");
    const items = Array.isArray(data.items) ? data.items.map(normalizeItem) : [];

    window.ClassroomNotificationAdminItems = items;

    renderBackendAdminList(items);

    return items;
  }

  async function saveNotificationToBackend() {
    const payload = getFormPayload();

    if (!payload.title || !payload.body) {
      alert("Falta título o mensaje.");
      return;
    }

    const editingId = getEditingId();

    const data = editingId
      ? await apiFetch(`/api/classroom/notifications/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      : await apiFetch("/api/classroom/notifications", {
          method: "POST",
          body: JSON.stringify(payload),
        });

    clearEditingId();

    document.querySelector("#notificationAdminForm, [data-notification-admin-form]")?.reset();

    await loadAdminNotifications();

    if (getBackendApi()?.sync) {
      await getBackendApi().sync().catch(() => {});
    }

    alert(editingId ? "Notificación actualizada." : "Notificación creada en Supabase.");

    return data;
  }

  async function deleteNotificationFromBackend(id) {
    if (!confirm("¿Borrar esta notificación para todos?")) return;

    await apiFetch(`/api/classroom/notifications/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    await loadAdminNotifications();

    if (getBackendApi()?.sync) {
      await getBackendApi().sync().catch(() => {});
    }
  }

  async function resendNotificationFromBackend(id) {
    if (!confirm("¿Reenviar esta notificación como nueva?")) return;

    await apiFetch(`/api/classroom/notifications/${encodeURIComponent(id)}/resend`, {
      method: "POST",
    });

    await loadAdminNotifications();

    if (getBackendApi()?.sync) {
      await getBackendApi().sync().catch(() => {});
    }
  }

  function hijackForm() {
    const form = document.querySelector("#notificationAdminForm, [data-notification-admin-form]");
    if (!form || form.dataset.backendBridgeAttached === "1") return;

    form.dataset.backendBridgeAttached = "1";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      saveNotificationToBackend().catch((error) => {
        console.error("[Centro Notificaciones] Error guardando en backend:", error);
        alert(error.message || "No se pudo guardar la notificación.");
      });
    }, true);
  }

  function hijackButtons() {
    document.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-backend-notification-edit]");
      const deleteButton = event.target.closest("[data-backend-notification-delete]");
      const resendButton = event.target.closest("[data-backend-notification-resend]");

      if (editButton) {
        event.preventDefault();
        event.stopPropagation();

        const id = editButton.getAttribute("data-backend-notification-edit");
        const item = (window.ClassroomNotificationAdminItems || []).find((entry) => String(entry.id) === String(id));

        if (item) fillEditForm(item);
        return;
      }

      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();

        deleteNotificationFromBackend(deleteButton.getAttribute("data-backend-notification-delete"))
          .catch((error) => {
            console.error("[Centro Notificaciones] Error borrando:", error);
            alert(error.message || "No se pudo borrar.");
          });

        return;
      }

      if (resendButton) {
        event.preventDefault();
        event.stopPropagation();

        resendNotificationFromBackend(resendButton.getAttribute("data-backend-notification-resend"))
          .catch((error) => {
            console.error("[Centro Notificaciones] Error reenviando:", error);
            alert(error.message || "No se pudo reenviar.");
          });
      }
    }, true);
  }

  function addBackendBadge() {
    const hero =
      document.querySelector(".page-hero, .admin-hero, .content-hero") ||
      document.querySelector("main");

    if (!hero || document.querySelector("#notificationBackendBadge")) return;

    const badge = document.createElement("div");
    badge.id = "notificationBackendBadge";
    badge.className = "notification-admin-mail-note";
    badge.innerHTML = `
      <i class="fa-solid fa-database"></i>
      Centro conectado a Supabase. El email sigue desactivado por defecto.
    `;

    hero.appendChild(badge);
  }

  function init() {
    hijackForm();
    hijackButtons();
    addBackendBadge();

    loadAdminNotifications().catch((error) => {
      console.warn("[Centro Notificaciones] Backend no disponible, queda fallback local:", error);
    });
  }

  window.ClassroomNotificationCenterBackend = {
    load: loadAdminNotifications,
    save: saveNotificationToBackend,
    delete: deleteNotificationFromBackend,
    resend: resendNotificationFromBackend,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 250));
  } else {
    setTimeout(init, 250);
  }
})();


/* === CENTRO NOTIFICACIONES RUNTIME TEXT FIX 20260622 === */
(function(){
  const fixes = [
    ["Administración", "Administración"],
    ["administración", "administración"],
    ["Notificación", "Notificación"],
    ["notificación", "notificación"],
    ["académicas", "académicas"],
    ["Gestión", "Gestión"],
    ["Título", "Título"],
    ["título", "título"],
    ["Aviso común", "Aviso común"],
    ["Escribí", "Escribí"],
    ["podrá", "podrá"],
    ["cuáles", "cuáles"],
    ["categorías", "categorías"],
    ["todavía", "todavía"],
    ["Creá", "Creá"],
    ["Amarillo — aviso", "Amarillo — aviso"],
    ["Guardar notificación", "Guardar notificación"],
    ["Nueva notificación", "Nueva notificación"],
    ["No hay notificaciones todavía.", "No hay notificaciones todavía."],
    ["Creá la primera desde el formulario de la izquierda.", "Creá la primera desde el formulario de la izquierda."]
  ];

  function fixString(value){
    let out = value;
    for (const [bad, good] of fixes){
      out = out.split(bad).join(good);
    }
    return out;
  }

  function patchTexts(){
    const selectors = "h1,h2,h3,h4,p,span,small,strong,label,button,option";
    document.querySelectorAll(selectors).forEach((el) => {
      if (!el.children.length && el.textContent) {
        const fixed = fixString(el.textContent);
        if (fixed !== el.textContent) {
          el.textContent = fixed;
        }
      }
    });

    document.querySelectorAll("input,textarea").forEach((el) => {
      if (el.placeholder) {
        const fixed = fixString(el.placeholder);
        if (fixed !== el.placeholder) {
          el.placeholder = fixed;
        }
      }
    });

    document.querySelectorAll("option").forEach((el) => {
      if (el.textContent) {
        const fixed = fixString(el.textContent);
        if (fixed !== el.textContent) {
          el.textContent = fixed;
        }
      }
    });
  }

  function patchEmptyState(){
    const blocks = Array.from(document.querySelectorAll("div,section,article"));
    const empty = blocks.find(el => {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      return t.includes("No hay notificaciones todavía") || t.includes("Creá la primera desde el formulario de la izquierda");
    });

    if (empty) {
      empty.classList.add("cn-empty-readable");
    }
  }

  function runFix(){
    patchTexts();
    patchEmptyState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runFix);
  } else {
    runFix();
  }

  setTimeout(runFix, 300);
  setTimeout(runFix, 1000);
})();

/* === CENTRO NOTIFICACIONES MOJIBAKE FINAL RUNTIME 20260622 === */
(function centroNotificacionesMojibakeFinalRuntime() {
  "use strict";

  const fixes = [
    ["Ã¡", "á"], ["Ã©", "é"], ["Ã­", "í"], ["Ã³", "ó"], ["Ãº", "ú"],
    ["Ã±", "ñ"], ["Ã‘", "Ñ"], ["Ã¼", "ü"],
    ["â€“", "—"], ["â€”", "—"], ["â€˜", "‘"], ["â€™", "’"],
    ["â€œ", "“"], ["â€", "”"], ["â€¦", "…"],
    ["Â¿", "¿"], ["Â¡", "¡"], ["Â°", "°"], ["Â·", "·"], ["Â ", " "]
  ];

  function fixString(value) {
    let output = String(value || "");

    for (const [bad, good] of fixes) {
      output = output.split(bad).join(good);
    }

    return output;
  }

  function patchTextNode(node) {
    const fixed = fixString(node.nodeValue);

    if (fixed !== node.nodeValue) {
      node.nodeValue = fixed;
    }
  }

  function patchAttributes(el) {
    ["placeholder", "title", "aria-label", "value"].forEach((attr) => {
      if (!el.hasAttribute || !el.hasAttribute(attr)) return;

      const value = el.getAttribute(attr);
      const fixed = fixString(value);

      if (fixed !== value) {
        el.setAttribute(attr, fixed);
      }
    });
  }

  function patchAllText(root = document.body) {
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    let node;
    while ((node = walker.nextNode())) {
      patchTextNode(node);
    }

    root.querySelectorAll?.("input, textarea, select, option, button, [title], [aria-label]").forEach(patchAttributes);
  }

  function patchEmptyState() {
    const candidates = Array.from(document.querySelectorAll("div, section, article"));

    candidates.forEach((el) => {
      const text = fixString(el.textContent || "").replace(/\s+/g, " ").trim();

      if (
        text.includes("No hay notificaciones todavía") ||
        text.includes("Creá la primera") ||
        text.includes("No hay notificaciones todav")
      ) {
        el.classList.add("cn-empty-readable");
      }
    });
  }

  function run() {
    patchAllText();
    patchEmptyState();
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(run);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      run();
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  } else {
    run();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  setTimeout(run, 250);
  setTimeout(run, 900);

  window.ClassroomCentroMojibakeFix = { run, fixString };
})();
