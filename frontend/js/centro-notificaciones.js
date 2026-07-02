/* === CENTRO IGNORE BELL ME REFRESH 20260623 === */
(function centroIgnoreBellMeRefresh() {
  "use strict";

  /*
    Problema:
    - La campanita consulta /notifications/me cada X segundos.
    - Eso dispara eventos globales de notificaciones.
    - En el Centro, esos eventos hacen que el listado admin se re-renderice
      momentáneamente en formato base/viejo y luego el V3 lo vuelve a pintar.
    - Resultado: salto/parpadeo cada pocos segundos.

    Solución:
    - En esta página, filtramos los eventos globales que no sean del Centro admin.
    - El Centro mantiene su render estable.
  */

  const isCentroPage = /centro-notificaciones\.html/i.test(location.pathname);

  if (!isCentroPage) return;

  const ORIGINAL_DISPATCH = EventTarget.prototype.dispatchEvent;

  EventTarget.prototype.dispatchEvent = function patchedCentroDispatchEvent(event) {
    try {
      const eventName = String(event?.type || "");

      if (
        this === window &&
        eventName === "classroom:notifications-updated" &&
        !window.__CENTRO_ADMIN_RENDERING__
      ) {
        /*
          Bloqueamos solo el evento global de refresh de campanita.
          No bloqueamos clicks, submit, carga admin ni eventos normales.
        */
        return true;
      }
    } catch (_) {
      // Si algo raro pasa, dejamos pasar el evento.
    }

    return ORIGINAL_DISPATCH.call(this, event);
  };

  window.ClassroomCentroIgnoreBellMeRefresh = {
    enabled: true
  };
})();

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
      const itemType = String(item?.type || "announcement").toLowerCase();
      const audienceType = String(
        item?.audience_type ||
        item?.audience ||
        item?.target ||
        ""
      ).toLowerCase();

      const isSpecificUser = audienceType === "specific_user";
      const isAllTypes = !type || type === "all" || type === "todos";

      const matchesType =
        type === "specific_user"
          ? isSpecificUser
          : isAllTypes
            ? !isSpecificUser
            : itemType === type;

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

    if (/centro-notificaciones\.html(?:$|\?|\#)/.test(window.location.pathname || "")) {
      return;
    }

    if (
      window.ClassroomNotificationCenterBackend ||
      window.ClassroomNotificationAdminItems
    ) {
      return;
    }

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

    return "https://api.andyazhtec.com";
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
      send_email: form.querySelector('input[name="notificationSendEmail"]:checked')?.value === "true",
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

  function adminSeverityClass(item) {
    const raw = String(item?.severity || "").trim().toLowerCase();

    if (raw === "danger" || raw === "red" || raw === "rojo") return "danger";
    if (raw === "warning" || raw === "yellow" || raw === "amarillo") return "warning";
    if (raw === "info" || raw === "blue" || raw === "azul") return "info";

    return "neutral";
  }

  function adminSeverityColorClass(severity) {
    if (severity === "danger") return "red";
    if (severity === "warning") return "yellow";
    if (severity === "info") return "blue";
    return "violet";
  }

  function adminSeverityLabel(severity) {
    if (severity === "danger") return "Rojo";
    if (severity === "warning") return "Amarillo";
    if (severity === "info") return "Azul";
    return "Violeta";
  }

  function adminIconClass(severity) {
    if (severity === "danger") return "fa-triangle-exclamation";
    if (severity === "warning") return "fa-bullhorn";
    if (severity === "info") return "fa-comments";
    return "fa-bell";
  }

  function adminTypeLabel(type) {
    const raw = String(type || "").trim().toLowerCase();

    if (raw === "academic") return "Académica";
    if (raw === "community") return "Comunidad";
    if (raw === "system") return "Sistema";
    if (raw === "announcement") return "Aviso";

    return typeLabel ? typeLabel(type || "announcement") : (type || "Aviso");
  }

  function adminAudienceLabel(value) {
    const raw = String(value || "all").trim().toLowerCase();

    if (raw === "all") return "Todos";
    if (raw === "students") return "Alumnos";
    if (raw === "staff") return "Docentes y moderadores";
    if (raw === "course-ayrpc-2025") return "AyRPC 2025";
    if (raw === "course-ayrpc-2026") return "AyRPC 2026";

    return value || "Todos";
  }

  function adminRoleLabel(value) {
    const raw = String(value || "").trim().toLowerCase();

    if (raw === "docente" || raw === "teacher") return "Docente";
    if (raw === "classroom_moderator" || raw === "moderator") return "Moderador";
    if (raw === "alumno" || raw === "student") return "Alumno";

    return value || "";
  }

  function adminFormatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderBackendAdminList(items) {
    const list =
      document.querySelector("#notificationAdminList") ||
      document.querySelector("#notificationsAdminList") ||
      document.querySelector("[data-notification-admin-list]") ||
      document.querySelector(".notification-admin-list");

    if (!list) return;

    
    const currentTypeBeforePaint = String(
      document.querySelector("#notificationFilterType")?.value ||
      document.querySelector("#notificationAdminTypeFilter")?.value ||
      "all"
    ).trim().toLowerCase();

    const currentSearchBeforePaint = String(
      document.querySelector("#notificationSearch")?.value ||
      document.querySelector("#notificationAdminSearch")?.value ||
      ""
    ).trim().toLowerCase();

    items = Array.isArray(items) ? items.filter((item) => {
      const itemType = String(item?.type || "announcement").trim().toLowerCase();

      const audienceType = String(
        item?.audience_type ||
        item?.audience ||
        item?.target ||
        ""
      ).trim().toLowerCase();

      const isSpecificUser = audienceType === "specific_user";
      const isAllTypes =
        !currentTypeBeforePaint ||
        currentTypeBeforePaint === "all" ||
        currentTypeBeforePaint === "todos";

      const matchesType =
        currentTypeBeforePaint === "specific_user"
          ? isSpecificUser
          : isAllTypes
            ? !isSpecificUser
            : itemType === currentTypeBeforePaint;

      if (!matchesType) return false;

      if (!currentSearchBeforePaint) return true;

      const haystack = [
        item?.title,
        item?.body,
        item?.description,
        item?.type,
        item?.severity,
        item?.audience,
        item?.audience_type,
        item?.target,
        item?.course,
        item?.link,
        item?.link_url
      ].join(" ").toLowerCase();

      return haystack.includes(currentSearchBeforePaint);
    }) : [];
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
      const severity = adminSeverityClass(item);
      const colorClass = adminSeverityColorClass(severity);
      const icon = adminIconClass(severity);
      const type = item.type || "announcement";
      const body = item.body || item.description || "";
      const link = item.link_url || item.link || "";
      const audience = item.audience_type || item.audience || "all";
      const recipients = item.recipients_count ?? item.recipientsCreated ?? item.recipients_created ?? 0;
      const unread = item.unread_count ?? item.unread ?? 0;
      const createdAt = item.created_at || item.createdAt || "";
      const updatedAt = item.updated_at || item.updatedAt || "";
      const createdByName = item.created_by_name || item.actor || "Staff";
      const createdByRole = adminRoleLabel(item.created_by_role || item.role || "");
      const createdByTwitch = item.created_by_twitch ? `@${item.created_by_twitch}` : "";
      const creatorParts = [
        createdByName,
        createdByRole,
        createdByTwitch,
      ]
        .filter(Boolean)
        .filter((part, index, array) => {
          const normalized = String(part || "").trim().toLowerCase();

          if (!normalized) return false;

          return array.findIndex((current) =>
            String(current || "").trim().toLowerCase() === normalized
          ) === index;
        });

      const metaParts = [
        `Destinatarios: ${recipients}`,
        `No leídas: ${unread}`,
        creatorParts.length ? `Creada por: ${creatorParts.join(" · ")}` : "",
        createdAt ? `Creada: ${adminFormatDate(createdAt)}` : "",
        updatedAt && updatedAt !== createdAt ? `Actualizada: ${adminFormatDate(updatedAt)}` : "",
      ].filter(Boolean);

      const unreadBadge = unread > 0 ? "No leída" : "Leída";

      return `
        <article class="notification-admin-item is-${escapeHtml(severity)} cn-existing-notification-card cn-full-notification-card cn-severity-${escapeHtml(colorClass)}" data-admin-notification-id="${escapeHtml(item.id)}">
          <div class="notification-admin-item-icon">
            <i class="fa-solid ${escapeHtml(icon)}"></i>
          </div>

          <div class="notification-admin-item-body">
            <div class="notification-admin-item-top">
              <div>
                <h4>${escapeHtml(item.title || "Notificación")}</h4>

                <div class="notification-admin-tags">
                  <span>${escapeHtml(adminTypeLabel(type))}</span>
                  <span>${escapeHtml(adminSeverityLabel(severity))}</span>
                  <span>${escapeHtml(adminAudienceLabel(audience))}</span>
                  <span>${escapeHtml(unreadBadge)}</span>
                </div>
              </div>

              <small>${escapeHtml(adminFormatDate(createdAt))}</small>
            </div>

            <p>${escapeHtml(body)}</p>

            ${link ? `<a class="notification-admin-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a>` : ""}

            <div class="notification-admin-item-actions">
              <button type="button" data-backend-notification-edit="${escapeHtml(item.id)}">
                <i class="fa-solid fa-pen"></i>
                Editar
              </button>

              <button type="button" data-backend-notification-resend="${escapeHtml(item.id)}">
                <i class="fa-solid fa-paper-plane"></i>
                Reenviar
              </button>

              <button type="button" class="danger" data-backend-notification-delete="${escapeHtml(item.id)}">
                <i class="fa-solid fa-trash"></i>
                Borrar
              </button>
            </div>

            <small class="notification-admin-meta">
              ${escapeHtml(metaParts.join(" · "))}
            </small>
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

  function escapeCssValue(value) {
    const raw = String(value || "");

    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(raw);
    }

    return raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function removeNotificationFromBellStorage(id) {
    if (!id) return;

    const current = safeJson(localStorage.getItem(STORAGE_KEY), []);

    if (!Array.isArray(current)) return;

    const next = current.filter((item) => String(item?.id) !== String(id));

    if (next.length === current.length) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    window.dispatchEvent(new CustomEvent("classroom:notifications-updated", {
      detail: {
        deletedId: id,
        items: next,
        source: "centro-admin-delete",
      },
    }));
  }

  function removeNotificationFromAdminMemory(id) {
    if (!id) return;

    const current = Array.isArray(window.ClassroomNotificationAdminItems)
      ? window.ClassroomNotificationAdminItems
      : [];

    const next = current.filter((item) => String(item?.id) !== String(id));

    window.ClassroomNotificationAdminItems = next;

    renderBackendAdminList(next);
  }

  function setAdminDeleteBusy(id, busy) {
    const selector = `[data-admin-notification-id="${escapeCssValue(id)}"]`;
    const card = document.querySelector(selector);

    if (!card) return;

    card.classList.toggle("is-deleting", Boolean(busy));

    card.querySelectorAll("button").forEach((button) => {
      button.disabled = Boolean(busy);
    });
  }

  async function deleteNotificationFromBackend(id) {
    if (!id) return;

    const ok = confirm("¿Borrar esta notificación para todos? Esto también la borra del backend/Supabase.");

    if (!ok) return;

    const previousItems = Array.isArray(window.ClassroomNotificationAdminItems)
      ? [...window.ClassroomNotificationAdminItems]
      : [];

    setAdminDeleteBusy(id, true);

    try {
      await apiFetch(`/api/classroom/notifications/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      removeNotificationFromAdminMemory(id);
      removeNotificationFromBellStorage(id);

      await loadAdminNotifications();

      if (getBackendApi()?.sync) {
        await getBackendApi().sync().catch(() => {});
      }
    } catch (error) {
      window.ClassroomNotificationAdminItems = previousItems;
      renderBackendAdminList(previousItems);

      console.error("[Centro Notificaciones] Error borrando desde backend:", error);
      alert(error.message || "No se pudo borrar la notificación desde Supabase.");

      throw error;
    } finally {
      setAdminDeleteBusy(id, false);
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
        event.stopImmediatePropagation();

        const id = deleteButton.getAttribute("data-backend-notification-delete");

        deleteNotificationFromBackend(id)
          .catch((error) => {
            console.error("[Centro Notificaciones] Error borrando:", error);
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
      Centro conectado a Supabase. Notificaciones internas activas.
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

/* === HIDE CENTER EMAIL CARD 20260622 === */
(function hideCenterEmailCard() {
  "use strict";

  function norm(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isTargetText(text) {
    return (
      text.includes("email desactivado por defecto") &&
      text.includes("campanita")
    );
  }

  function looksLikeOnlyEmailCard(el) {
    const text = norm(el.textContent);
    if (!isTargetText(text)) return false;

    // Seguridad: no agarrar el formulario entero.
    if (text.includes("nueva notificación")) return false;
    if (text.includes("guardar notificación")) return false;
    if (text.includes("vista demo")) return false;
    if (text.includes("notificaciones existentes")) return false;

    const rect = el.getBoundingClientRect();

    // La card es chica/mediana, no media página.
    if (rect.height < 30 || rect.height > 180) return false;
    if (rect.width < 180 || rect.width > 900) return false;

    return true;
  }

  function findEmailCard() {
    const nodes = Array.from(document.querySelectorAll("div, section, article, aside"));

    const candidates = nodes
      .filter(looksLikeOnlyEmailCard)
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return (ar.width * ar.height) - (br.width * br.height);
      });

    return candidates[0] || null;
  }

  function run() {
    const card = findEmailCard();

    if (card) {
      card.classList.add("center-email-card-hidden");
      card.setAttribute("aria-hidden", "true");
    }
  }

  let scheduled = false;

  function schedule() {
    if (scheduled) return;

    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  }

  function init() {
    run();

    const observer = new MutationObserver(schedule);

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(run, 300);
    setTimeout(run, 900);
    setTimeout(run, 1800);
  }

  window.ClassroomHideCenterEmailCard = {
    run
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* === CENTRO BACKEND DOMINANCE 20260624 === */
(function centroBackendDominance20260624() {
  "use strict";

  const isCentroPage = /centro-notificaciones\.html$/i.test(window.location.pathname || "");

  if (!isCentroPage) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function listEl() {
    return (
      document.querySelector("#notificationAdminList") ||
      document.querySelector("#notificationsAdminList") ||
      document.querySelector("[data-notification-admin-list]") ||
      document.querySelector(".notification-admin-list")
    );
  }

  function counterEl() {
    return (
      document.querySelector("#notificationAdminCounter") ||
      document.querySelector("[data-notification-admin-counter]") ||
      document.querySelector(".notification-admin-counter")
    );
  }

  function searchEl() {
    return (
      document.querySelector("#notificationSearch") ||
      document.querySelector("#notificationAdminSearch") ||
      document.querySelector("[data-notification-admin-search]") ||
      document.querySelector(".notification-admin-search")
    );
  }

  function typeFilterEl() {
    return (
      document.querySelector("#notificationFilterType") ||
      document.querySelector("#notificationAdminTypeFilter") ||
      document.querySelector("[data-notification-admin-type-filter]") ||
      document.querySelector(".notification-admin-type-filter")
    );
  }

  function ensureCommunityFilterOption() {
    const select = typeFilterEl();

    if (!select || select.querySelector('option[value="community"]')) return;

    const option = document.createElement("option");
    option.value = "community";
    option.textContent = "Comunidad";
    select.appendChild(option);
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function severityClass(item) {
    const severity = String(item?.severity || "").toLowerCase();

    if (["danger", "error", "rojo", "red"].includes(severity)) return "danger";
    if (["warning", "warn", "amarillo", "yellow"].includes(severity)) return "warning";
    if (["success", "ok", "verde", "green"].includes(severity)) return "success";
    if (String(item?.type || "").toLowerCase() === "community") return "info";

    return "info";
  }

  function severityLabel(value) {
    const severity = String(value || "info").toLowerCase();

    if (severity === "danger") return "Rojo";
    if (severity === "warning") return "Amarillo";
    if (severity === "success") return "Verde";

    return "Azul";
  }

  function typeLabel(value) {
    const type = String(value || "announcement").toLowerCase();

    if (type === "community") return "Comunidad";
    if (type === "academic") return "Académica";
    if (type === "system") return "Sistema";

    return "Aviso";
  }

  function audienceLabel(value, item) {
    const audience = String(value || "all").toLowerCase();

    if (audience === "course") return item?.course || "Curso";
    if (audience === "students") return "Alumnos";
    if (audience === "staff") return "Staff";
    if (audience === "specific_user") {
      const rawTwitch = String(
        item?.recipient_twitch ||
        item?.target_twitch ||
        item?.student_twitch ||
        item?.twitch ||
        item?.username ||
        item?.recipient_username ||
        item?.target_username ||
        item?.meta?.twitch ||
        item?.metadata?.twitch ||
        item?.data?.twitch ||
        ""
      ).trim();

      const twitch = rawTwitch.replace(/^@+/, "");

      if (twitch && twitch !== "specific_user") {
        return `@${twitch}`;
      }

      return "Usuario específico";
    }

    return "Todos";
  }

  function iconClass(item) {
    const type = String(item?.type || "").toLowerCase();
    const severity = severityClass(item);

    if (type === "community") return "fa-comments";
    if (severity === "danger") return "fa-triangle-exclamation";
    if (severity === "warning") return "fa-circle-exclamation";
    if (severity === "success") return "fa-circle-check";

    return "fa-bell";
  }

  function getBackendItems() {
    const items = Array.isArray(window.ClassroomNotificationAdminItems)
      ? window.ClassroomNotificationAdminItems
      : [];

    return items.filter(Boolean);
  }

  function getFilteredBackendItems() {
    const items = getBackendItems();
    const search = String(searchEl()?.value || "").trim().toLowerCase();
    const type = String(typeFilterEl()?.value || "all").trim().toLowerCase();

    return items.filter((item) => {
      const itemType = String(item?.type || "announcement").toLowerCase();

      const audienceType = String(
        item?.audience_type ||
        item?.audience ||
        item?.target ||
        ""
      ).toLowerCase();

      const isSpecificUser = audienceType === "specific_user";
      const isAllTypes = !type || type === "all" || type === "todos";

      const matchesType =
        type === "specific_user"
          ? isSpecificUser
          : isAllTypes
            ? !isSpecificUser
            : itemType === type;

      const haystack = [
        item?.title,
        item?.body,
        item?.description,
        item?.type,
        item?.severity,
        item?.course,
        item?.actor,
        item?.created_by_name,
        item?.created_by_twitch,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || haystack.includes(search);

      return matchesType && matchesSearch;
    });
  }

  function renderBackendDominantList() {
    const list = listEl();

    if (!list) return false;

    ensureCommunityFilterOption();

    const allItems = getBackendItems();

    if (!allItems.length) return false;

    const items = getFilteredBackendItems();

    const counter = counterEl();

    if (counter) {
      counter.textContent = String(items.length);
    }

    if (!items.length) {
      list.innerHTML = `
        <div class="notification-admin-empty">
          <i class="fa-regular fa-bell"></i>
          <strong>No hay notificaciones con ese filtro</strong>
          <p>Probá cambiar la búsqueda o el tipo seleccionado.</p>
        </div>
      `;
      return true;
    }

    list.innerHTML = items.map((item) => {
      const severity = severityClass(item);
      const type = item.type || "announcement";
      const body = item.body || item.description || "";
      const link = item.link_url || item.link || "";
      const audience = item.audience_type || item.audience || "all";
      const recipients = item.recipients_count ?? item.recipientsCreated ?? item.recipients_created ?? 0;
      const unread = item.unread_count ?? item.unread ?? 0;
      const createdAt = item.created_at || item.createdAt || "";
      const updatedAt = item.updated_at || item.updatedAt || "";
      const createdByName = item.created_by_name || item.actor || "Staff";
      const createdByRole = item.created_by_role || item.role || "";
      const createdByTwitch = item.created_by_twitch ? `@${item.created_by_twitch}` : "";

      const creatorParts = [createdByName, createdByRole, createdByTwitch]
        .filter(Boolean)
        .filter((part, index, array) => {
          const normalized = String(part || "").trim().toLowerCase();

          if (!normalized) return false;

          return array.findIndex((current) =>
            String(current || "").trim().toLowerCase() === normalized
          ) === index;
        });

      const metaParts = [
        `Destinatarios: ${recipients}`,
        `No leídas: ${unread}`,
        creatorParts.length ? `Creada por: ${creatorParts.join(" · ")}` : "",
        createdAt ? `Creada: ${formatDate(createdAt)}` : "",
        updatedAt && updatedAt !== createdAt ? `Actualizada: ${formatDate(updatedAt)}` : "",
      ].filter(Boolean);

      const unreadBadge = Number(unread || 0) > 0 ? "No leída" : "Leída";

      return `
        <article class="notification-admin-item is-${escapeHtml(severity)} cn-existing-notification-card cn-full-notification-card cn-severity-${escapeHtml(severity)}" data-admin-notification-id="${escapeHtml(item.id)}">
          <div class="notification-admin-item-icon">
            <i class="fa-solid ${escapeHtml(iconClass(item))}"></i>
          </div>

          <div class="notification-admin-item-body">
            <div class="notification-admin-item-top">
              <div>
                <h4>${escapeHtml(item.title || "Notificación")}</h4>

                <div class="notification-admin-tags">
                  <span>${escapeHtml(typeLabel(type))}</span>
                  <span>${escapeHtml(severityLabel(severity))}</span>
                  <span>${escapeHtml(audienceLabel(audience, item))}</span>
                  <span>${escapeHtml(unreadBadge)}</span>
                </div>
              </div>

              <small>${escapeHtml(formatDate(createdAt))}</small>
            </div>

            <p>${escapeHtml(body)}</p>

            ${link ? `<a class="notification-admin-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a>` : ""}

            <div class="notification-admin-item-actions">
              <button type="button" data-backend-notification-edit="${escapeHtml(item.id)}">
                <i class="fa-solid fa-pen"></i>
                Editar
              </button>

              <button type="button" data-backend-notification-resend="${escapeHtml(item.id)}">
                <i class="fa-solid fa-paper-plane"></i>
                Reenviar
              </button>

              <button type="button" class="danger" data-backend-notification-delete="${escapeHtml(item.id)}">
                <i class="fa-solid fa-trash"></i>
                Borrar
              </button>
            </div>

            <small class="notification-admin-meta">
              ${escapeHtml(metaParts.join(" · "))}
            </small>
          </div>
        </article>
      `;
    }).join("");

    return true;
  }

  function scheduleDominantRender() {
    setTimeout(renderBackendDominantList, 40);
    setTimeout(renderBackendDominantList, 160);
    setTimeout(renderBackendDominantList, 420);
    setTimeout(renderBackendDominantList, 900);
  }

  async function forceBackendLoadThenRender() {
    try {
      if (window.ClassroomNotificationCenterBackend?.load) {
        await window.ClassroomNotificationCenterBackend.load();
      }
    } catch (error) {
      console.warn("[Centro Backend Dominance] No pude recargar backend:", error);
    }

    scheduleDominantRender();
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureCommunityFilterOption();

    searchEl()?.addEventListener("input", scheduleDominantRender);
    searchEl()?.addEventListener("change", scheduleDominantRender);
    typeFilterEl()?.addEventListener("input", scheduleDominantRender);
    typeFilterEl()?.addEventListener("change", scheduleDominantRender);

    forceBackendLoadThenRender();
  });

  window.addEventListener("classroom:notifications-updated", scheduleDominantRender);
  window.addEventListener("focus", scheduleDominantRender);

  window.ClassroomCentroBackendDominance = {
    render: renderBackendDominantList,
    schedule: scheduleDominantRender,
    reload: forceBackendLoadThenRender,
  };

  scheduleDominantRender();
})();


/* ============================================================
   CENTRO_DELETE_BACKEND_DOMINANTE_20260625
   Fuerza el borrado real por backend para botones de Centro.
   Evita que la lógica legacy/localStorage deje la notificación viva.
============================================================ */
(function patchCentroDeleteBackendDominante() {
  function getSessionToken() {
    try {
      const raw = localStorage.getItem("andyazh-classroom-session");
      if (!raw) return "";
      const session = JSON.parse(raw);
      return session?.token || session?.access_token || session?.jwt || "";
    } catch (_) {
      return "";
    }
  }

  function getApiBase() {
    const base =
      window.ClassroomBackend?.baseUrl ||
      window.ClassroomBackend?.apiBase ||
      window.CLASSROOM_API_BASE ||
      window.EXAMPRO_API_BASE ||
      "http://127.0.0.1:8000";

    return String(base).replace(/\/+$/, "");
  }

  function getNotificationIdFromButton(btn) {
    if (!btn) return "";

    return (
      btn.dataset.adminNotificationDelete ||
      btn.dataset.notificationDelete ||
      btn.dataset.deleteNotification ||
      btn.dataset.deleteId ||
      btn.dataset.id ||
      btn.getAttribute("data-admin-notification-delete") ||
      btn.getAttribute("data-notification-delete") ||
      btn.getAttribute("data-delete-notification") ||
      btn.getAttribute("data-delete-id") ||
      ""
    ).trim();
  }

  function looksLikeDeleteButton(target) {
    const btn = target?.closest?.("button, a");
    if (!btn) return null;

    const text = (btn.textContent || "").trim().toLowerCase();

    const hasDeleteDataset =
      btn.hasAttribute("data-admin-notification-delete") ||
      btn.hasAttribute("data-notification-delete") ||
      btn.hasAttribute("data-delete-notification") ||
      btn.hasAttribute("data-delete-id");

    const isInsideNotificationCenter =
      Boolean(
        btn.closest("#notificationAdminList") ||
        btn.closest("#notificationsAdminList") ||
        btn.closest("#notificationList") ||
        btn.closest(".notification-center") ||
        btn.closest(".notifications-admin") ||
        btn.closest(".notification-card")
      );

    if ((hasDeleteDataset || text === "borrar" || text.includes("borrar")) && isInsideNotificationCenter) {
      return btn;
    }

    return null;
  }

  async function deleteNotificationBackendDominante(id, btn) {
    if (!id) {
      console.warn("[Centro] No encontré ID de notificación para borrar.");
      return;
    }

    const ok = window.confirm("¿Borrar esta notificación para todos?");
    if (!ok) return;

    const oldText = btn?.textContent;

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Borrando...";
      }

      const token = getSessionToken();
      const headers = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${getApiBase()}/api/classroom/notifications/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers,
      });

      let data = null;
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(data?.detail || data?.message || `HTTP ${response.status}`);
      }

      document
        .querySelectorAll(`[data-admin-notification-delete="${CSS.escape(id)}"], [data-notification-delete="${CSS.escape(id)}"], [data-delete-notification="${CSS.escape(id)}"], [data-delete-id="${CSS.escape(id)}"]`)
        .forEach((el) => {
          const card = el.closest("article, .notification-card, .notification-item, li, tr");
          if (card) card.remove();
        });

      if (Array.isArray(window.ClassroomNotificationsAdminItems)) {
        window.ClassroomNotificationsAdminItems = window.ClassroomNotificationsAdminItems.filter((item) => String(item.id) !== String(id));
      }

      if (Array.isArray(window.ClassroomNotificationsItems)) {
        window.ClassroomNotificationsItems = window.ClassroomNotificationsItems.filter((item) => String(item.id) !== String(id));
      }

      window.dispatchEvent(new CustomEvent("classroom-notification-deleted", {
        detail: {
          deletedId: id,
          id,
          source: "centro-delete-backend-dominante",
          backend: data || null,
        },
      }));

      window.dispatchEvent(new CustomEvent("classroom-notifications-changed", {
        detail: {
          action: "delete",
          deletedId: id,
          id,
          source: "centro-delete-backend-dominante",
        },
      }));

      if (window.ClassroomNotificationsAdmin?.load) {
        await window.ClassroomNotificationsAdmin.load();
      } else if (window.ClassroomNotificationCenter?.load) {
        await window.ClassroomNotificationCenter.load();
      }

      console.log("[Centro] Notificación borrada desde backend:", id, data);
    } catch (error) {
      console.error("[Centro] No pude borrar notificación desde backend:", error);
      alert(error.message || "No pude borrar la notificación.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText || "Borrar";
      }
    }
  }

  document.addEventListener(
    "click",
    function onCentroDeleteClick(event) {
      const btn = looksLikeDeleteButton(event.target);
      if (!btn) return;

      const id = getNotificationIdFromButton(btn);
      if (!id) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      deleteNotificationBackendDominante(id, btn);
    },
    true
  );

  console.log("[Centro] Patch delete backend dominante activo.");
})();

/* === Centro notificaciones: mostrar audiencia academica solo si correo = SI 20260628 === */
(function initAcademicMailPreviewToggle() {
  "use strict";

  const preview = document.getElementById("notificationAcademicMailPreview");
  const form = document.getElementById("notificationAdminForm");

  if (!preview) return;

  const controls = [
    document.getElementById("notificationAcademicMailSource"),
    document.getElementById("notificationAcademicMailSegment"),
    document.getElementById("notificationAcademicMailPreviewBtn"),
  ].filter(Boolean);

  function isSendEmailEnabled() {
    return document.querySelector('input[name="notificationSendEmail"]:checked')?.value === "true";
  }

  function syncAcademicMailPreviewVisibility() {
    const enabled = isSendEmailEnabled();

    preview.hidden = !enabled;
    preview.classList.toggle("is-disabled", !enabled);

    controls.forEach((control) => {
      control.disabled = !enabled;
    });
  }

  document
    .querySelectorAll('input[name="notificationSendEmail"]')
    .forEach((radio) => {
      radio.addEventListener("change", syncAcademicMailPreviewVisibility);
    });

  if (form) {
    form.addEventListener("reset", () => {
      window.setTimeout(syncAcademicMailPreviewVisibility, 0);
    });
  }

  syncAcademicMailPreviewVisibility();

  window.ClassroomAcademicMailPreviewSync = syncAcademicMailPreviewVisibility;
})();

/* === Centro notificaciones: dry-run audiencia academica Planilla 2025 20260628 === */
(function initAcademicMailAudienceDryRun() {
  "use strict";

  const SHEET_2025_API = "https://script.google.com/macros/s/AKfycbxpazFcJG0A6ki-rgbaLY8LBKCAAYuZZsfSrLP4zsu97JbtSK9XbBTkVHHMYuUtsp50/exec";

  const button = document.getElementById("notificationAcademicMailPreviewBtn");
  const resultBox = document.getElementById("notificationAcademicMailPreviewResult");
  const sourceSelect = document.getElementById("notificationAcademicMailSource");
  const segmentSelect = document.getElementById("notificationAcademicMailSegment");

  if (!button || !resultBox) return;

  function clean(value) {
    return String(value ?? "").trim();
  }

  function normalize(value) {
    return clean(value)
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  function isValidEmail(item) {
    const email = clean(item.Correo || item.email);
    return /\S+@\S+\.\S+/.test(email);
  }

  function isValidDni(item) {
    const dni = clean(item.DNI || item.dni).replace(/\D+/g, "");
    return dni.length >= 7;
  }

  function getRawApto(item) {
    return normalize(item.APTO || item.apt_examen || item.estado);
  }

  function getRawResultado(item) {
    return normalize(item.Resultado || item.exam_status || "");
  }

  function getRawRecuperatorio(item) {
    return normalize(item.Recuperatorio || item.recovery_status || "");
  }

  function isApto(item) {
    const apto = getRawApto(item);
    return apto === "SI" || apto === "APTO";
  }

  function isPendingRecovery2025(item) {
    const resultado = getRawResultado(item);
    const recuperatorio = getRawRecuperatorio(item);

    return (
      isValidDni(item) &&
      isValidEmail(item) &&
      isApto(item) &&
      resultado !== "APROBADO" &&
      recuperatorio !== "APROBADO" &&
      recuperatorio !== "DESAPROBADO"
    );
  }

  function countItems(items, predicate) {
    return items.filter(predicate).length;
  }

  function renderLoading() {
    resultBox.classList.remove("is-ready", "is-error");
    resultBox.classList.add("is-loading");
    resultBox.innerHTML = `
      <strong>Calculando audiencia...</strong>
      <span>Consultando Planilla AyRPC 2025 en modo dry-run. No se envía ningún correo.</span>
    `;
  }

  function renderError(error) {
    resultBox.classList.remove("is-ready", "is-loading");
    resultBox.classList.add("is-error");
    resultBox.innerHTML = `
      <strong>No se pudo calcular la audiencia.</strong>
      <span>${String(error?.message || error || "Error desconocido")}</span>
    `;
  }

  function renderResult(summary) {
    resultBox.classList.remove("is-loading", "is-error");
    resultBox.classList.add("is-ready");

    resultBox.innerHTML = `
      <div class="academic-mail-summary-head">
        <strong>${summary.pendingRecovery} destinatarios potenciales</strong>
        <span>Dry-run: no se envió ningún correo.</span>
      </div>

      <div class="academic-mail-summary-grid">
        <span>Total planilla <strong>${summary.total}</strong></span>
        <span>Base válida <strong>${summary.validBase}</strong></span>
        <span>APTO = SI <strong>${summary.aptos}</strong></span>
        <span>Excluidos por examen aprobado <strong>${summary.approvedExam}</strong></span>
        <span>Excluidos por recuperatorio cerrado <strong>${summary.closedRecovery}</strong></span>
        <span>Sin DNI/email válido <strong>${summary.invalidContact}</strong></span>
      </div>

      <p class="academic-mail-summary-rule">
        Regla usada: APTO = SI, Resultado distinto de APROBADO, Recuperatorio distinto de APROBADO/DESAPROBADO, con DNI y correo válidos.
      </p>
    `;
  }

  async function fetchSheet2025Items(source) {
    const sheetParam = source === "personal-tests" ? "&sheet=pruebasPersonales" : "";

    const response = await fetch(`${SHEET_2025_API}?list=1${sheetParam}`, {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data?.error || data?.message || "La planilla no respondió correctamente.");
    }

    return Array.isArray(data.items) ? data.items : [];
  }

  function buildPendingRecoverySummary(items) {
    const validBaseItems = items.filter((item) => isValidDni(item) && isValidEmail(item));
    const aptoItems = validBaseItems.filter(isApto);

    return {
      total: items.length,
      validBase: validBaseItems.length,
      invalidContact: items.length - validBaseItems.length,
      aptos: aptoItems.length,
      approvedExam: countItems(aptoItems, (item) => getRawResultado(item) === "APROBADO"),
      closedRecovery: countItems(aptoItems, (item) => {
        const rec = getRawRecuperatorio(item);
        return rec === "APROBADO" || rec === "DESAPROBADO";
      }),
      pendingRecovery: countItems(items, isPendingRecovery2025),
    };
  }

  function buildPersonalTestsSummary(items) {
    const validEmailItems = items.filter(isValidEmail);

    return {
      total: items.length,
      validBase: validEmailItems.length,
      invalidContact: items.length - validEmailItems.length,
      aptos: validEmailItems.length,
      approvedExam: 0,
      closedRecovery: 0,
      pendingRecovery: validEmailItems.length,
    };
  }

  async function calculateAcademicMailAudience() {
    const source = sourceSelect?.value || "sheet-ayrpc-2025";
    const segment = segmentSelect?.value || "pending-recovery-2025";

    const allowedSources = ["sheet-ayrpc-2025", "personal-tests"];

    if (!allowedSources.includes(source) || segment !== "pending-recovery-2025") {
      renderError("Esta combinación de fuente/segmento todavía no está implementada.");
      return;
    }

    renderLoading();

    try {
      const items = await fetchSheet2025Items(source);
      const summary = source === "personal-tests"
        ? buildPersonalTestsSummary(items)
        : buildPendingRecoverySummary(items);

      renderResult(summary);

      window.ClassroomAcademicMailAudienceLastPreview = {
        source,
        segment,
        summary,
        calculatedAt: new Date().toISOString(),
        dryRun: true,
        sendsMail: false,
      };
    } catch (error) {
      console.error("[Centro] Error calculando audiencia academica", error);
      renderError(error);
    }
  }

  button.addEventListener("click", calculateAcademicMailAudience);
})();

/* === Centro notificaciones: enviar prueba mail personal-tests 20260628 === */
(function initAcademicMailSendTestButton() {
  "use strict";

  const sendButton = document.getElementById("notificationAcademicMailSendTestBtn");
  const previewButton = document.getElementById("notificationAcademicMailPreviewBtn");
  const resultBox = document.getElementById("notificationAcademicMailPreviewResult");
  const sourceSelect = document.getElementById("notificationAcademicMailSource");
  const segmentSelect = document.getElementById("notificationAcademicMailSegment");

  if (!sendButton || !resultBox || !sourceSelect) return;

  function getApiBase() {
    const configured =
      window.CLASSROOM_API_BASE ||
      window.EXAMPRO_API_BASE ||
      localStorage.getItem("andyazh-api-base") ||
      "";

    if (configured) {
      return String(configured).replace(/\/+$/, "");
    }

    const host = window.location.hostname;

    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:8000";
    }

    return "https://api.andyazhtec.com";
  }

  function getSessionToken() {
    try {
      const raw = localStorage.getItem("andyazh-classroom-session");
      if (!raw) return "";
      const session = JSON.parse(raw);
      return session?.token || session?.access_token || session?.jwt || session?.auth_token || "";
    } catch (_) {
      return "";
    }
  }

  function isEmailSendEnabled() {
    return document.querySelector('input[name="notificationSendEmail"]:checked')?.value === "true";
  }

  function getLastPreview() {
    return window.ClassroomAcademicMailAudienceLastPreview || null;
  }

  function isPersonalTestsPreviewReady() {
    const last = getLastPreview();
    const summary = last?.summary || {};

    return Boolean(
      isEmailSendEnabled() &&
      sourceSelect.value === "personal-tests" &&
      (segmentSelect?.value || "pending-recovery-2025") === "pending-recovery-2025" &&
      last?.source === "personal-tests" &&
      last?.segment === "pending-recovery-2025" &&
      Number(summary.pendingRecovery || summary.validBase || summary.eligible || summary.total || 0) > 0
    );
  }

  function syncSendButtonState() {
    sendButton.disabled = !isPersonalTestsPreviewReady();
    sendButton.title = sendButton.disabled
      ? "Disponible solo despues de calcular Pruebas personales."
      : "Enviar correo de prueba a pruebasPersonales.";
  }

  function appendStatus(message, kind = "info") {
    const previous = resultBox.querySelector(".academic-mail-send-test-status");
    if (previous) previous.remove();

    const box = document.createElement("div");
    box.className = `academic-mail-send-test-status ${kind === "error" ? "is-error" : kind === "success" ? "is-success" : ""}`;
    box.innerHTML = message;
    resultBox.appendChild(box);
  }

  async function sendPersonalTestsMail() {
    if (!isPersonalTestsPreviewReady()) {
      appendStatus(
        "<strong>No se envio.</strong><br>Primero calcula destinatarios con la fuente <strong>Pruebas personales</strong>.",
        "error"
      );
      syncSendButtonState();
      return;
    }

    const token = getSessionToken();

    if (!token) {
      appendStatus("<strong>No se envio.</strong><br>No encontre token de sesion del Classroom.", "error");
      return;
    }

    const confirmation = window.confirm(
      "Esto enviara un correo real SOLO a la hoja pruebasPersonales. Continuar?"
    );

    if (!confirmation) {
      return;
    }

    sendButton.disabled = true;
    const originalText = sendButton.innerHTML;
    sendButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    appendStatus("<strong>Enviando prueba...</strong><br>Se esta enviando solo a pruebasPersonales.", "info");

    try {
      const response = await fetch(`${getApiBase()}/api/classroom/notifications/email-test-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source: "personal-tests",
          subject: "[PRUEBA] AyRPC - Recuperatorio disponible en Classroom",
          title: "Recuperatorio aun disponible",
          badge_text: "Ingresa al recuperatorio antes de que cierre",
          cta_label: "Ingresar al recuperatorio",
          cta_url: "https://classroom.andyazhtec.com/curso-ayrpc-2025.html",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data?.detail || data?.error || `HTTP ${response.status}`);
      }

      appendStatus(
        `<strong>Prueba enviada.</strong><br>` +
        `Intentados: <strong>${data.attempted ?? "-"}</strong> - ` +
        `Enviados: <strong>${data.sent ?? "-"}</strong> - ` +
        `Omitidos: <strong>${data.skipped ?? "-"}</strong> - ` +
        `Fallidos: <strong>${data.failed ?? "-"}</strong>`,
        "success"
      );

      window.ClassroomAcademicMailLastSendTest = {
        ok: true,
        sentAt: new Date().toISOString(),
        data,
      };
    } catch (error) {
      console.error("[Centro] Error enviando prueba de correo", error);

      appendStatus(
        `<strong>No se pudo enviar la prueba.</strong><br>${String(error?.message || error)}`,
        "error"
      );

      window.ClassroomAcademicMailLastSendTest = {
        ok: false,
        sentAt: new Date().toISOString(),
        error: String(error?.message || error),
      };
    } finally {
      sendButton.innerHTML = originalText;
      syncSendButtonState();
    }
  }

  sendButton.addEventListener("click", sendPersonalTestsMail);

  sourceSelect.addEventListener("change", () => {
    window.ClassroomAcademicMailAudienceLastPreview = null;
    syncSendButtonState();
  });

  segmentSelect?.addEventListener("change", () => {
    window.ClassroomAcademicMailAudienceLastPreview = null;
    syncSendButtonState();
  });

  document
    .querySelectorAll('input[name="notificationSendEmail"]')
    .forEach((radio) => {
      radio.addEventListener("change", syncSendButtonState);
    });

  previewButton?.addEventListener("click", () => {
    window.setTimeout(syncSendButtonState, 600);
    window.setTimeout(syncSendButtonState, 1800);
    window.setTimeout(syncSendButtonState, 3200);
  });

  syncSendButtonState();

  window.ClassroomAcademicMailSendTestSync = syncSendButtonState;
})();













/* ============================================================
   AndyAzhTEC Classroom - Modal de vista previa de correo
   Etapa 1: estructura editable + preview HTML, sin envío real.
   ============================================================ */
(function initClassroomMailPreviewModal() {
  const isNotificationCenter = /centro-notificaciones\.html(?:$|\?|\#)/.test(window.location.pathname || "");
  if (!isNotificationCenter) return;

  const PRESETS = {
    announcement: {
      label: "Aviso común",
      subject: "AndyAzhTEC Classroom - Nuevo aviso disponible",
      eyebrow: "AndyAzhTEC Classroom",
      title: "Nuevo aviso",
      course: "Classroom",
      tag: "Aviso general",
      accent: "warning",
      greeting: "Hola, {{nombre}}:",
      body: "Hay un nuevo aviso disponible en el Classroom. Ingresá para revisar la información completa.",
      highlight: "Este mensaje corresponde a una comunicación general del curso.",
      buttonText: "Ingresar a Classroom",
      buttonUrl: "https://classroom.andyazhtec.com/",
      footer: "Prof. Arturo Coria<br>AndyAzhTEC Classroom"
    },
    community: {
      label: "Comunidad",
      subject: "AndyAzhTEC Classroom - Nueva actividad en Comunidad",
      eyebrow: "AndyAzhTEC Classroom",
      title: "Actividad en Comunidad",
      course: "Classroom",
      tag: "Comunidad",
      accent: "info",
      greeting: "Hola, {{nombre}}:",
      body: "Hay nueva actividad en la Comunidad del Classroom. Podés ingresar para ver el hilo, responder o seguir la conversación.",
      highlight: "La comunidad centraliza consultas, aportes y recomendaciones del curso.",
      buttonText: "Ir a Comunidad",
      buttonUrl: "https://classroom.andyazhtec.com/comunidad.html",
      footer: "Prof. Arturo Coria<br>AndyAzhTEC Classroom"
    },
    academic: {
      label: "Académico / nota cargada",
      subject: "AyRPC - Hay una novedad académica disponible en Classroom",
      eyebrow: "AndyAzhTEC Classroom",
      title: "Novedad académica",
      course: "Curso AyRPC 2025",
      tag: "Información académica",
      accent: "orange",
      greeting: "Hola, {{nombre}}:",
      body: "Hay una novedad académica disponible en el Classroom. Ingresá para revisar la información completa y verificar el detalle correspondiente.",
      highlight: "Este aviso puede estar relacionado con notas, devoluciones, recuperatorios o cambios importantes del curso.",
      buttonText: "Ingresar a Classroom",
      buttonUrl: "https://classroom.andyazhtec.com/",
      footer: "Prof. Arturo Coria<br>Armado y Reparación de PC — AyRPC 2025<br>AndyAzhTEC Classroom"
    },
    recovery_corrected: {
      label: "Recuperatorio corregido",
      subject: "AyRPC - La corrección de tu RECUPERATORIO ya está disponible en Classroom",
      eyebrow: "AndyAzhTEC Classroom",
      title: "Devolución disponible",
      course: "Curso AyRPC 2025",
      tag: "Corrección de recuperatorio",
      accent: "orange",
      greeting: "Hola, {{nombre}}:",
      body: "La corrección de tu recuperatorio correspondiente al curso <strong>Armado y Reparación de PC - 2025</strong> ya se encuentra disponible. Para visualizarla, deberás ingresar primero a <strong>Classroom</strong> y, desde allí, acceder al apartado de <strong>ExamPro</strong> siguiendo las indicaciones de la plataforma.",
      highlight: "Desde <strong>ExamPro</strong> podrás ver punto a punto la devolución de tu evaluación.",
      buttonText: "Ingresar a Classroom",
      buttonUrl: "https://classroom.andyazhtec.com/",
      footer: "Prof. Arturo Coria<br>Armado y Reparación de PC — AyRPC 2025<br>AndyAzhTEC Classroom"
    },
    recovery_available: {
      label: "Recuperatorio disponible",
      subject: "¡¡RECORDATORIO!! Recuperatorio de AyRPC 2025 disponible",
      eyebrow: "AndyAzhTEC Classroom",
      title: "Recuperatorio AÚN disponible",
      course: "Curso AyRPC 2025",
      tag: "Ingresá al recuperatorio antes de que cierre",
      accent: "warning",
      greeting: "Hola, {{nombre}}:",
      body: "Aún figura en el sistema que te encontrás <strong>APTO/A</strong> para rendir el recuperatorio del examen de <strong>AyRPC 2025</strong>, pero todavía no aparece registrada la aprobación de esta última instancia.",
      highlight: "El recuperatorio estará disponible hasta la fecha indicada. Luego de esa fecha, ya no será posible rendirlo.",
      buttonText: "Ingresar al recuperatorio",
      buttonUrl: "https://classroom.andyazhtec.com/curso-ayrpc-2025.html",
      footer: "Prof. Arturo Coria<br>Armado y Reparación de PC — AyRPC 2025<br>AndyAzhTEC Classroom"
    },
    system: {
      label: "Sistema",
      subject: "AndyAzhTEC Classroom - Aviso del sistema",
      eyebrow: "AndyAzhTEC Classroom",
      title: "Aviso del sistema",
      course: "Classroom",
      tag: "Sistema",
      accent: "neutral",
      greeting: "Hola, {{nombre}}:",
      body: "Hay una actualización o aviso interno del sistema Classroom.",
      highlight: "Este mensaje corresponde a una comunicación técnica o administrativa del sistema.",
      buttonText: "Ingresar a Classroom",
      buttonUrl: "https://classroom.andyazhtec.com/",
      footer: "Prof. Arturo Coria<br>AndyAzhTEC Classroom"
    }
  };

  const ACCENTS = {
    info: {
      border: "#2563eb",
      soft: "rgba(37,99,235,.12)",
      softBorder: "rgba(96,165,250,.35)",
      text: "#bfdbfe",
      buttonA: "#2563eb",
      buttonB: "#7c3aed"
    },
    warning: {
      border: "#eab308",
      soft: "rgba(234,179,8,.12)",
      softBorder: "rgba(250,204,21,.35)",
      text: "#fde68a",
      buttonA: "#f59e0b",
      buttonB: "#7c3aed"
    },
    orange: {
      border: "#f97316",
      soft: "rgba(249,115,22,.14)",
      softBorder: "rgba(251,146,60,.42)",
      text: "#fed7aa",
      buttonA: "#f97316",
      buttonB: "#7c3aed"
    },
    danger: {
      border: "#ef4444",
      soft: "rgba(239,68,68,.13)",
      softBorder: "rgba(248,113,113,.42)",
      text: "#fecaca",
      buttonA: "#ef4444",
      buttonB: "#7c3aed"
    },
    neutral: {
      border: "#7c3aed",
      soft: "rgba(124,58,237,.13)",
      softBorder: "rgba(167,139,250,.38)",
      text: "#ddd6fe",
      buttonA: "#7c3aed",
      buttonB: "#2563eb"
    }
  };

  function qs(selector) {
    return document.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function nl2br(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function getCurrentNotificationType() {
    return String(qs("#notificationType")?.value || "announcement").trim();
  }

  function getCurrentSeverity() {
    return String(qs("#notificationSeverity")?.value || "").trim();
  }

  function inferPresetKey() {
    const type = getCurrentNotificationType();
    const title = String(qs("#notificationTitle")?.value || "").toLowerCase();
    const body = String(qs("#notificationBody")?.value || "").toLowerCase();

    if (title.includes("recuperatorio") && (title.includes("correg") || body.includes("correg"))) {
      return "recovery_corrected";
    }

    if (title.includes("recuperatorio") || body.includes("recuperatorio")) {
      return "recovery_available";
    }

    if (type === "community") return "community";
    if (type === "academic") return "academic";
    if (type === "system") return "system";

    return "announcement";
  }

  function severityToAccent() {
    const severity = getCurrentSeverity().toLowerCase();
    const type = getCurrentNotificationType();

    if (severity.includes("danger") || severity.includes("rojo")) return "danger";
    if (severity.includes("orange") || severity.includes("naranja")) return "orange";
    if (severity.includes("warning") || severity.includes("amarillo")) return "warning";
    if (severity.includes("neutral") || severity.includes("violeta")) return "neutral";
    if (type === "academic") return "orange";
    if (type === "community") return "info";
    if (type === "system") return "neutral";

    return "warning";
  }

  function createModal() {
    if (qs("#mailPreviewModal")) return;

    const style = document.createElement("style");
    style.textContent = `
      .mail-preview-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(2, 6, 23, .78);
        backdrop-filter: blur(10px);
      }

      .mail-preview-backdrop.is-open {
        display: flex;
      }

      .mail-preview-modal {
        width: min(1180px, 96vw);
        max-height: 92vh;
        overflow: hidden;
        border: 1px solid rgba(34, 211, 238, .35);
        border-radius: 22px;
        background: linear-gradient(135deg, rgba(8, 13, 32, .98), rgba(15, 23, 42, .98));
        box-shadow: 0 24px 90px rgba(0, 0, 0, .5), 0 0 45px rgba(124, 58, 237, .18);
        color: #e5e7eb;
      }

      .mail-preview-header,
      .mail-preview-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 18px 20px;
        border-bottom: 1px solid rgba(148, 163, 184, .16);
      }

      .mail-preview-footer {
        border-top: 1px solid rgba(148, 163, 184, .16);
        border-bottom: 0;
      }

      .mail-preview-title small {
        display: block;
        color: #22d3ee;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .16em;
        text-transform: uppercase;
      }

      .mail-preview-title strong {
        display: block;
        margin-top: 4px;
        color: #fff;
        font-size: 20px;
      }

      .mail-preview-close {
        border: 1px solid rgba(248, 113, 113, .45);
        border-radius: 14px;
        background: rgba(127, 29, 29, .18);
        color: #fecaca;
        padding: 10px 14px;
        font-weight: 900;
        cursor: pointer;
      }

      .mail-preview-body {
        display: grid;
        grid-template-columns: minmax(320px, 430px) 1fr;
        gap: 18px;
        padding: 18px 20px;
        overflow: auto;
        max-height: calc(92vh - 146px);
      }

      .mail-preview-form {
        display: grid;
        gap: 12px;
        align-content: start;
      }

      .mail-preview-form label {
        display: grid;
        gap: 6px;
        color: #cbd5e1;
        font-size: 12px;
        font-weight: 800;
      }

      .mail-preview-form input,
      .mail-preview-form select,
      .mail-preview-form textarea {
        width: 100%;
        border: 1px solid rgba(34, 211, 238, .25);
        border-radius: 13px;
        background: rgba(2, 6, 23, .72);
        color: #f8fafc;
        padding: 11px 12px;
        font: inherit;
        outline: none;
      }

      .mail-preview-form textarea {
        min-height: 76px;
        resize: vertical;
      }

      .mail-preview-frame-wrap {
        min-height: 520px;
        overflow: hidden;
        border: 1px solid rgba(124, 58, 237, .32);
        border-radius: 18px;
        background: #050816;
      }

      .mail-preview-frame {
        width: 100%;
        height: 620px;
        border: 0;
        background: #ffffff;
      }

      .mail-preview-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: flex-end;
      }

      .mail-preview-btn {
        border: 1px solid rgba(34, 211, 238, .35);
        border-radius: 14px;
        background: rgba(8, 47, 73, .38);
        color: #67e8f9;
        padding: 11px 15px;
        font-weight: 900;
        cursor: pointer;
      }

      .mail-preview-btn.primary {
        border-color: rgba(168, 85, 247, .6);
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        color: #fff;
      }

      @media (max-width: 900px) {
        .mail-preview-body {
          grid-template-columns: 1fr;
        }

        .mail-preview-frame {
          height: 560px;
        }
      }
    `;

    document.head.appendChild(style);

    const modal = document.createElement("div");
    modal.id = "mailPreviewModal";
    modal.className = "mail-preview-backdrop";
    modal.innerHTML = `
      <section class="mail-preview-modal" role="dialog" aria-modal="true" aria-labelledby="mailPreviewTitle">
        <header class="mail-preview-header">
          <div class="mail-preview-title">
            <small>Vista previa de correo</small>
            <strong id="mailPreviewTitle">Editar estructura del mail</strong>
          </div>
          <button type="button" class="mail-preview-close" data-mail-preview-close>✕ Cerrar</button>
        </header>

        <div class="mail-preview-body">
          <form class="mail-preview-form" id="mailPreviewForm">
            <label>
              Preset
              <select id="mailPreviewPreset">
                ${Object.entries(PRESETS).map(([key, preset]) => `<option value="${key}">${escapeHtml(preset.label)}</option>`).join("")}
              </select>
            </label>

            <label>
              Color visual
              <select id="mailPreviewAccent">
                <option value="info">Azul — comunidad/info</option>
                <option value="warning">Amarillo — aviso</option>
                <option value="orange">Naranja — académico/importante</option>
                <option value="danger">Rojo — crítico</option>
                <option value="neutral">Violeta — sistema</option>
              </select>
            </label>

            <label>
              Asunto
              <input id="mailPreviewSubject" type="text">
            </label>

            <label>
              Título superior
              <input id="mailPreviewMainTitle" type="text">
            </label>

            <label>
              Curso / subtítulo
              <input id="mailPreviewCourse" type="text">
            </label>

            <label>
              Etiqueta interna
              <input id="mailPreviewTag" type="text">
            </label>

            <label>
              Saludo
              <input id="mailPreviewGreeting" type="text">
            </label>

            <label>
              Mensaje principal
              <textarea id="mailPreviewBody"></textarea>
            </label>

            <label>
              Bloque destacado
              <textarea id="mailPreviewHighlight"></textarea>
            </label>

            <label>
              Texto del botón
              <input id="mailPreviewButtonText" type="text">
            </label>

            <label>
              Link del botón
              <input id="mailPreviewButtonUrl" type="url">
            </label>

            <label>
              Firma
              <textarea id="mailPreviewFooter"></textarea>
            </label>
          </form>

          <div class="mail-preview-frame-wrap">
            <iframe id="mailPreviewFrame" class="mail-preview-frame" title="Vista previa del correo"></iframe>
          </div>
        </div>

        <footer class="mail-preview-footer">
          <span id="mailPreviewHint">Esto todavía no envía mails: solo arma y previsualiza el formato.</span>
          <div class="mail-preview-actions">
            <button type="button" class="mail-preview-btn" id="mailPreviewReload">Actualizar vista previa</button>
            <button type="button" class="mail-preview-btn primary" id="mailPreviewUseCurrentMessage">Usar mensaje actual</button>
          </div>
        </footer>
      </section>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-mail-preview-close]")) {
        closeModal();
      }
    });

    qs("#mailPreviewPreset")?.addEventListener("change", () => {
      loadPreset(qs("#mailPreviewPreset")?.value || "announcement", true);
    });

    qs("#mailPreviewAccent")?.addEventListener("change", renderPreview);
    qs("#mailPreviewReload")?.addEventListener("click", renderPreview);
    qs("#mailPreviewUseCurrentMessage")?.addEventListener("click", () => {
      hydrateFromNotificationForm();
      renderPreview();
    });

    qs("#mailPreviewForm")?.addEventListener("input", renderPreview);
  }

  function setValue(id, value) {
    const el = qs(id);
    if (el) el.value = value ?? "";
  }

  function getValue(id) {
    return qs(id)?.value ?? "";
  }

  function loadPreset(key, forcePresetValues = false) {
    const preset = PRESETS[key] || PRESETS.announcement;

    setValue("#mailPreviewPreset", key);
    setValue("#mailPreviewAccent", preset.accent || severityToAccent());
    setValue("#mailPreviewSubject", preset.subject);
    setValue("#mailPreviewMainTitle", preset.title);
    setValue("#mailPreviewCourse", preset.course);
    setValue("#mailPreviewTag", preset.tag);
    setValue("#mailPreviewGreeting", preset.greeting);
    setValue("#mailPreviewBody", preset.body);
    setValue("#mailPreviewHighlight", preset.highlight);
    setValue("#mailPreviewButtonText", preset.buttonText);
    setValue("#mailPreviewButtonUrl", preset.buttonUrl);
    setValue("#mailPreviewFooter", preset.footer);

    if (!forcePresetValues) {
      hydrateFromNotificationForm();
    }

    renderPreview();
  }

  function hydrateFromNotificationForm() {
    const title = String(qs("#notificationTitle")?.value || "").trim();
    const body = String(qs("#notificationBody")?.value || "").trim();
    const link = String(qs("#notificationLink")?.value || "").trim();

    if (title) {
      setValue("#mailPreviewSubject", title);
    }

    if (body) {
      setValue("#mailPreviewBody", body);
    }

    if (link) {
      setValue("#mailPreviewButtonUrl", link);
    }

    const accent = severityToAccent();
    setValue("#mailPreviewAccent", accent);
  }

  function getPreviewData() {
    return {
      accent: getValue("#mailPreviewAccent") || "warning",
      subject: getValue("#mailPreviewSubject"),
      title: getValue("#mailPreviewMainTitle"),
      course: getValue("#mailPreviewCourse"),
      tag: getValue("#mailPreviewTag"),
      greeting: getValue("#mailPreviewGreeting"),
      body: getValue("#mailPreviewBody"),
      highlight: getValue("#mailPreviewHighlight"),
      buttonText: getValue("#mailPreviewButtonText"),
      buttonUrl: getValue("#mailPreviewButtonUrl"),
      footer: getValue("#mailPreviewFooter")
    };
  }

  function renderMailHtml(data) {
    const accent = ACCENTS[data.accent] || ACCENTS.warning;
    const buttonUrl = data.buttonUrl || "https://classroom.andyazhtec.com/";
    const safeUrl = escapeHtml(buttonUrl);

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(data.subject || "Vista previa")}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;padding:30px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:660px;background:#07111f;border-radius:22px;overflow:hidden;border:1px solid ${accent.border};box-shadow:0 0 34px rgba(37,99,235,.20),0 0 80px rgba(124,58,237,.14);">
          <tr>
            <td style="padding:30px 30px 24px;background:linear-gradient(135deg,#07111f 0%,#0f172a 46%,#1e1b4b 100%);border-bottom:1px solid rgba(96,165,250,.35);">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#93c5fd;font-weight:900;">
                      AndyAzhTEC Classroom
                    </div>
                    <div style="margin-top:10px;font-size:28px;line-height:1.15;color:#ffffff;font-weight:900;">
                      ${escapeHtml(data.title)}
                    </div>
                    <div style="margin-top:8px;font-size:14px;color:#c4b5fd;font-weight:700;">
                      ${escapeHtml(data.course)}
                    </div>
                  </td>
                  <td align="right" style="vertical-align:middle;width:76px;">
                    <div style="width:64px;height:64px;border-radius:18px;background:rgba(15,23,42,.78);border:1px solid rgba(147,197,253,.5);text-align:center;">
                      <img src="https://classroom.andyazhtec.com/media/icons/classroomicoclaro.png" alt="Classroom" width="44" height="44" style="display:block;margin:10px auto;border:0;outline:none;text-decoration:none;">
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:26px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(2,6,23,.98));border:1px solid rgba(51,65,85,.95);border-radius:18px;">
                <tr>
                  <td style="padding:26px;">
                    <div style="margin-bottom:18px;padding:10px 12px;border-radius:12px;background:${accent.soft};border:1px solid ${accent.softBorder};color:${accent.text};font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">
                      ${escapeHtml(data.tag)}
                    </div>

                    <p style="margin:0 0 18px;color:#f8fafc;font-size:17px;line-height:1.65;">
                      ${nl2br(data.greeting)}
                    </p>

                    <p style="margin:0 0 18px;color:#dbeafe;font-size:15px;line-height:1.75;">
                      ${String(data.body || "").replace(/\n/g, "<br>")}
                    </p>

                    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px auto 24px;">
                      <tr>
                        <td style="border-radius:14px;background:linear-gradient(135deg,${accent.buttonA},${accent.buttonB});box-shadow:0 0 22px rgba(37,99,235,.34);">
                          <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:15px 26px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:900;border-radius:14px;letter-spacing:.02em;">
                            ${escapeHtml(data.buttonText)}
                          </a>
                        </td>
                      </tr>
                    </table>

                    <div style="margin-top:22px;padding:16px;border-radius:14px;background:rgba(15,23,42,.9);border:1px solid rgba(124,58,237,.35);">
                      <p style="margin:0;color:#ddd6fe;font-size:14px;line-height:1.7;">
                        ${String(data.highlight || "").replace(/\n/g, "<br>")}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 4px 0;color:#475569;font-size:12px;line-height:1.6;text-align:center;">
                Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
                <a href="${safeUrl}" style="color:#2563eb;text-decoration:underline;">${safeUrl}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px;background:#020617;border-top:1px solid rgba(30,41,59,.95);">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.65;">
                ${data.footer || ""}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  function renderPreview() {
    const frame = qs("#mailPreviewFrame");
    if (!frame) return;

    const html = renderMailHtml(getPreviewData());
    frame.srcdoc = html;
    window.ClassroomMailPreviewModal.currentHtml = html;
    window.ClassroomMailPreviewModal.currentData = getPreviewData();
  }

  function openModal() {
    createModal();

    const presetKey = inferPresetKey();
    loadPreset(presetKey, false);

    qs("#mailPreviewModal")?.classList.add("is-open");
  }

  function closeModal() {
    qs("#mailPreviewModal")?.classList.remove("is-open");
  }

  function ensureTriggerButton() {
    const sendEmailBox =
      qs("#notificationSendEmail") ||
      document.querySelector('input[name="notificationSendEmail"]')?.closest("label, .notification-send-email, .mail-toggle, div") ||
      document.querySelector('input[name="notificationSendEmail"]')?.parentElement;

    const target =
      document.querySelector("#notificationAdminForm .notification-form-actions") ||
      document.querySelector("#notificationAdminForm") ||
      document.querySelector(".notifications-center-composer") ||
      sendEmailBox;

    if (!target || qs("#mailPreviewOpenBtn")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.id = "mailPreviewOpenBtn";
    button.className = "btn btn-outline";
    button.innerHTML = '<i class="fa-solid fa-envelope-open-text"></i> Vista previa del correo';
    button.addEventListener("click", openModal);

    const saveButton = qs("#notificationAdminForm button[type='submit']") || qs("#notificationSaveBtn");

    if (saveButton?.parentElement) {
      saveButton.parentElement.insertBefore(button, saveButton);
    } else {
      target.appendChild(button);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    createModal();
    ensureTriggerButton();

    setTimeout(ensureTriggerButton, 300);
    setTimeout(ensureTriggerButton, 1000);
  });

  window.ClassroomMailPreviewModal = {
    open: openModal,
    close: closeModal,
    render: renderPreview,
    currentHtml: "",
    currentData: null
  };
})();

/* ============================================================
   AndyAzhTEC Classroom - Destinatarios manuales para correo académico
   Etapa 1: UI + validación + cálculo, sin envío real todavía.
   ============================================================ */
(function initAcademicMailManualRecipients() {
  const isNotificationCenter = /centro-notificaciones\.html(?:$|\?|\#)/.test(window.location.pathname || "");
  if (!isNotificationCenter) return;

  const SOURCE_VALUE = "manual-list";

  function qs(selector) {
    return document.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getSourceSelect() {
    return qs("#notificationAcademicMailSource");
  }

  function getSegmentSelect() {
    return qs("#notificationAcademicMailSegment");
  }

  function getResultBox() {
    return qs("#notificationAcademicMailPreviewResult");
  }

  function getPreviewButton() {
    return qs("#notificationAcademicMailPreviewBtn");
  }

  function getSendTestButton() {
    return qs("#notificationAcademicMailSendTestBtn");
  }

  function isManualSource() {
    return getSourceSelect()?.value === SOURCE_VALUE;
  }

  function ensureManualOption() {
    const source = getSourceSelect();
    if (!source) return;

    if (![...source.options].some((option) => option.value === SOURCE_VALUE)) {
      const option = document.createElement("option");
      option.value = SOURCE_VALUE;
      option.textContent = "Lista manual";
      source.appendChild(option);
    }
  }

  function findAcademicMailCard() {
    const source = getSourceSelect();
    if (!source) return null;

    return (
      source.closest(".notification-academic-mail-preview") ||
      source.closest(".notification-academic-mail-preview-grid")?.parentElement ||
      source.closest("section, article, .card, .panel, .notification-admin-card, div")
    );
  }

  function ensureStyles() {
    if (qs("#academicMailManualRecipientsStyles")) return;

    const style = document.createElement("style");
    style.id = "academicMailManualRecipientsStyles";
    style.textContent = `
      .academic-mail-manual-box {
        margin-top: 14px;
        padding: 14px;
        border: 1px solid rgba(34, 211, 238, .25);
        border-radius: 16px;
        background: rgba(2, 6, 23, .45);
      }

      .academic-mail-manual-box[hidden] {
        display: none !important;
      }

      .academic-mail-manual-box label {
        display: grid;
        gap: 8px;
        color: #dbeafe;
        font-size: 12px;
        font-weight: 900;
      }

      .academic-mail-manual-box textarea {
        min-height: 116px;
        width: 100%;
        resize: vertical;
        border: 1px solid rgba(34, 211, 238, .25);
        border-radius: 14px;
        background: rgba(2, 6, 23, .78);
        color: #f8fafc;
        padding: 12px;
        font: inherit;
        outline: none;
      }

      .academic-mail-manual-help {
        margin-top: 8px;
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.5;
      }

      .academic-mail-manual-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
      }

      .academic-mail-manual-pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 10px;
        border-radius: 999px;
        background: rgba(34, 211, 238, .10);
        border: 1px solid rgba(34, 211, 238, .22);
        color: #67e8f9;
        font-size: 12px;
        font-weight: 900;
      }

      .academic-mail-preview-inline-btn {
        margin-left: 0;
      }

      .academic-mail-manual-result-list {
        margin: 10px 0 0;
        padding-left: 18px;
        color: #cbd5e1;
        font-size: 13px;
        line-height: 1.6;
      }

      .academic-mail-manual-error {
        color: #fecaca;
      }

      .academic-mail-manual-ok {
        color: #bbf7d0;
      }
    `;

    document.head.appendChild(style);
  }

  function ensureManualBox() {
    const card = findAcademicMailCard();
    const source = getSourceSelect();

    if (!card || !source || qs("#academicMailManualBox")) return;

    const box = document.createElement("div");
    box.id = "academicMailManualBox";
    box.className = "academic-mail-manual-box";
    box.hidden = true;
    box.innerHTML = `
      <label>
        Destinatarios manuales
        <textarea id="academicMailManualRecipients" placeholder="Pegá mails separados por salto de línea, coma o punto y coma.&#10;Ejemplo:&#10;aniii69@gmail.com&#10;moderador@correo.com"></textarea>
      </label>

      <div class="academic-mail-manual-help">
        Se eliminarán duplicados automáticamente. Si hay mails inválidos, no se calculará la lista.
      </div>

      <div class="academic-mail-manual-actions">
        <span class="academic-mail-manual-pill" id="academicMailManualCounter">
          0 destinatarios detectados
        </span>
      </div>
    `;

    const grid =
      source.closest(".notification-academic-mail-preview-grid") ||
      source.parentElement;

    if (grid?.parentElement) {
      grid.parentElement.insertBefore(box, grid.nextSibling);
    } else {
      card.appendChild(box);
    }

    qs("#academicMailManualRecipients")?.addEventListener("input", () => {
      updateManualCounter();
    });
  }

  function ensurePreviewButtonInsideAcademicCard() {
    const card = findAcademicMailCard();
    const calculateBtn = getPreviewButton();

    if (!card || !calculateBtn) return;

    let button = qs("#mailPreviewOpenBtn");

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.id = "mailPreviewOpenBtn";
      button.className = "btn btn-outline academic-mail-preview-inline-btn";
      button.innerHTML = '<i class="fa-solid fa-envelope-open-text"></i> Vista previa del correo';

      button.addEventListener("click", () => {
        if (window.ClassroomMailPreviewModal?.open) {
          window.ClassroomMailPreviewModal.open();
        } else {
          alert("El modal de vista previa todavía no está disponible. Recargá la página con Ctrl + F5.");
        }
      });
    }

    const sendTest = getSendTestButton();

    if (sendTest?.parentElement) {
      sendTest.parentElement.insertBefore(button, sendTest.nextSibling);
    } else if (calculateBtn.parentElement) {
      calculateBtn.parentElement.insertBefore(button, calculateBtn.nextSibling);
    }
  }

  function parseManualRecipients(raw) {
    const chunks = String(raw || "")
      .split(/[\n,;]+/g)
      .map((item) => item.trim())
      .filter(Boolean);

    const seen = new Set();
    const valid = [];
    const invalid = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    chunks.forEach((email) => {
      const normalized = email.toLowerCase();

      if (!emailRegex.test(normalized)) {
        invalid.push(email);
        return;
      }

      if (!seen.has(normalized)) {
        seen.add(normalized);
        valid.push(normalized);
      }
    });

    return {
      totalRaw: chunks.length,
      valid,
      invalid,
      duplicated: chunks.length - valid.length - invalid.length
    };
  }

  function getManualRecipientsRaw() {
    return qs("#academicMailManualRecipients")?.value || "";
  }

  function getManualRecipientsInfo() {
    return parseManualRecipients(getManualRecipientsRaw());
  }

  function updateManualCounter() {
    const counter = qs("#academicMailManualCounter");
    if (!counter) return;

    const info = getManualRecipientsInfo();

    if (info.invalid.length) {
      counter.textContent = `${info.valid.length} válidos · ${info.invalid.length} inválidos`;
      counter.classList.add("academic-mail-manual-error");
      counter.classList.remove("academic-mail-manual-ok");
    } else {
      counter.textContent = `${info.valid.length} destinatarios detectados`;
      counter.classList.add("academic-mail-manual-ok");
      counter.classList.remove("academic-mail-manual-error");
    }
  }

  function renderManualResult() {
    const resultBox = getResultBox();
    if (!resultBox) return;

    const info = getManualRecipientsInfo();

    if (!info.valid.length && !info.invalid.length) {
      resultBox.innerHTML = `
        <div class="academic-mail-manual-error">
          No pegaste ningún destinatario todavía.
        </div>
      `;
      window.ClassroomAcademicMailAudienceLastPreview = null;
      return;
    }

    if (info.invalid.length) {
      resultBox.innerHTML = `
        <div class="academic-mail-manual-error">
          <strong>No se puede calcular la lista porque hay mails inválidos:</strong>
          <ul class="academic-mail-manual-result-list">
            ${info.invalid.map((email) => `<li>${escapeHtml(email)}</li>`).join("")}
          </ul>
        </div>
      `;
      window.ClassroomAcademicMailAudienceLastPreview = null;
      return;
    }

    window.ClassroomAcademicMailAudienceLastPreview = {
      source: SOURCE_VALUE,
      segment: "manual",
      recipients: info.valid,
      summary: {
        total: info.valid.length,
        eligible: info.valid.length,
        validBase: info.valid.length,
        pendingRecovery: info.valid.length,
        invalid: 0
      }
    };

    resultBox.innerHTML = `
      <div class="academic-mail-manual-ok">
        <strong>Lista manual calculada correctamente.</strong><br>
        Destinatarios válidos: <strong>${info.valid.length}</strong>
        ${info.duplicated > 0 ? `<br>Duplicados omitidos: <strong>${info.duplicated}</strong>` : ""}
      </div>
      <ul class="academic-mail-manual-result-list">
        ${info.valid.slice(0, 12).map((email) => `<li>${escapeHtml(email)}</li>`).join("")}
        ${info.valid.length > 12 ? `<li>... y ${info.valid.length - 12} más</li>` : ""}
      </ul>
    `;

    syncSendButtonForManual();
  }

  function syncManualVisibility() {
    const box = qs("#academicMailManualBox");
    const segment = getSegmentSelect();

    if (box) {
      box.hidden = !isManualSource();
    }

    if (segment) {
      segment.disabled = isManualSource();
      segment.title = isManualSource()
        ? "La lista manual no usa segmento."
        : "";
    }

    if (isManualSource()) {
      updateManualCounter();

      const resultBox = getResultBox();
      if (resultBox && !getManualRecipientsRaw().trim()) {
        resultBox.innerHTML = "Pegá una lista de mails y tocá Calcular destinatarios.";
      }
    }

    syncSendButtonForManual();
  }

  function syncSendButtonForManual() {
    const sendButton = getSendTestButton();
    if (!sendButton) return;

    if (!isManualSource()) return;

    const info = getManualRecipientsInfo();
    const ok = info.valid.length > 0 && info.invalid.length === 0;

    sendButton.disabled = !ok;
    sendButton.title = ok
      ? "Listo para enviar prueba con lista manual cuando conectemos el endpoint."
      : "Pegá destinatarios manuales válidos y calculá la lista.";
  }

  function interceptManualCalculate() {
    const button = getPreviewButton();
    if (!button || button.dataset.manualRecipientsAttached === "1") return;

    button.dataset.manualRecipientsAttached = "1";

    button.addEventListener("click", (event) => {
      if (!isManualSource()) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      renderManualResult();
    }, true);
  }

  function init() {
    ensureStyles();
    ensureManualOption();
    ensureManualBox();
    ensurePreviewButtonInsideAcademicCard();
    interceptManualCalculate();
    syncManualVisibility();

    getSourceSelect()?.addEventListener("change", () => {
      syncManualVisibility();
    });

    getSegmentSelect()?.addEventListener("change", () => {
      syncManualVisibility();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    init();
    setTimeout(init, 250);
    setTimeout(init, 900);
  });

  window.ClassroomAcademicMailManualRecipients = {
    init,
    parse: parseManualRecipients,
    getInfo: getManualRecipientsInfo,
    render: renderManualResult
  };
})();


/* ============================================================
   Centro Notificaciones - anclar panel de correo académico
   Evita que el panel se vaya off-canvas en mobile/tablet.
   ============================================================ */
(function pinAcademicMailPanelMobile() {
  const isNotificationCenter = /centro-notificaciones\.html(?:$|\?|\#)/.test(window.location.pathname || "");
  if (!isNotificationCenter) return;

  function qs(selector) {
    return document.querySelector(selector);
  }

  function getPanel() {
    const source = qs("#notificationAcademicMailSource");
    if (!source) return null;

    return (
      source.closest(".notification-academic-mail-preview") ||
      source.closest("[data-notification-academic-mail-preview]") ||
      source.closest("section, article, .card, .panel")
    );
  }

  function getSendMailRow() {
    const checkedRadio = document.querySelector('input[name="notificationSendEmail"]:checked');
    const anyRadio = document.querySelector('input[name="notificationSendEmail"]');

    return (
      checkedRadio?.closest(".notification-send-email-row, .notification-mail-toggle, .mail-toggle, label, div") ||
      anyRadio?.closest(".notification-send-email-row, .notification-mail-toggle, .mail-toggle, label, div") ||
      anyRadio?.parentElement
    );
  }

  function isEmailEnabled() {
    return document.querySelector('input[name="notificationSendEmail"]:checked')?.value === "true";
  }

  function forcePanelLayout() {
    const panel = getPanel();
    const sendRow = getSendMailRow();

    if (!panel || !sendRow) return;

    // Lo movemos debajo del selector Enviar por correo para que no quede off-canvas.
    if (panel.previousElementSibling !== sendRow) {
      sendRow.insertAdjacentElement("afterend", panel);
    }

    const enabled = isEmailEnabled();

    panel.hidden = !enabled;
    panel.style.display = enabled ? "block" : "none";
    panel.style.position = "static";
    panel.style.inset = "auto";
    panel.style.left = "auto";
    panel.style.right = "auto";
    panel.style.top = "auto";
    panel.style.bottom = "auto";
    panel.style.transform = "none";
    panel.style.float = "none";
    panel.style.clear = "both";
    panel.style.width = "100%";
    panel.style.maxWidth = "100%";
    panel.style.minWidth = "0";
    panel.style.margin = enabled ? "14px 0 0" : "0";
    panel.style.boxSizing = "border-box";
    panel.style.overflow = "hidden";
    panel.style.gridColumn = "1 / -1";
    panel.style.zIndex = "1";

    const grid = panel.querySelector(".notification-academic-mail-preview-grid");
    if (grid) {
      grid.style.width = "100%";
      grid.style.maxWidth = "100%";
      grid.style.minWidth = "0";
      grid.style.boxSizing = "border-box";

      if (window.matchMedia("(max-width: 820px)").matches) {
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "1fr";
        grid.style.gap = "12px";
      }
    }

    panel.querySelectorAll("select, textarea, input, button").forEach((el) => {
      el.style.maxWidth = "100%";
      el.style.boxSizing = "border-box";
    });

    panel.querySelectorAll("button").forEach((button) => {
      if (window.matchMedia("(max-width: 820px)").matches) {
        button.style.width = "100%";
      }
    });
  }

  function scheduleForce() {
    forcePanelLayout();
    requestAnimationFrame(forcePanelLayout);
    setTimeout(forcePanelLayout, 80);
    setTimeout(forcePanelLayout, 250);
    setTimeout(forcePanelLayout, 700);
  }

  document.addEventListener("DOMContentLoaded", () => {
    scheduleForce();

    document
      .querySelectorAll('input[name="notificationSendEmail"]')
      .forEach((radio) => {
        radio.addEventListener("change", scheduleForce);
        radio.addEventListener("click", scheduleForce);
      });

    window.addEventListener("resize", scheduleForce);
    window.addEventListener("orientationchange", scheduleForce);

    const form = qs("#notificationAdminForm");
    if (form) {
      const observer = new MutationObserver(scheduleForce);
      observer.observe(form, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden", "style", "class"]
      });
    }
  });

  window.ClassroomPinAcademicMailPanelMobile = {
    fix: scheduleForce
  };
})();
