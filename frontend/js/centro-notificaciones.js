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

  function notificationActorKey() {
    try {
      const session = JSON.parse(
        localStorage.getItem("andyazh-classroom-session") || "{}"
      );

      const dni = String(
        session.dni ||
        session?.alumno?.dni ||
        session?.student?.dni ||
        ""
      ).replace(/\D/g, "");

      if (dni) return `dni-${dni}`;

      const twitch = String(
        session.twitch ||
        session?.alumno?.twitch ||
        session?.alumno?.twitch_username ||
        session?.student?.twitch ||
        ""
      )
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9@._-]+/g, "_")
        .slice(0, 120);

      if (twitch) return `twitch-${twitch}`;

      const email = String(
        session.email ||
        session?.alumno?.email ||
        session?.student?.email ||
        ""
      )
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9@._-]+/g, "_")
        .slice(0, 120);

      if (email) return `email-${email}`;
    } catch {}

    return "guest";
  }

  const STORAGE_KEY =
    `andyazh-classroom-notifications-v3:${notificationActorKey()}`;


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
      session.displayName ||
      session.display_name ||
      session.full_name ||
      session.name ||
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

  function notificationActorKey() {
    try {
      const session = JSON.parse(
        localStorage.getItem("andyazh-classroom-session") || "{}"
      );

      const dni = String(
        session.dni ||
        session?.alumno?.dni ||
        session?.student?.dni ||
        ""
      ).replace(/\D/g, "");

      if (dni) return `dni-${dni}`;

      const twitch = String(
        session.twitch ||
        session?.alumno?.twitch ||
        session?.alumno?.twitch_username ||
        session?.student?.twitch ||
        ""
      )
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9@._-]+/g, "_")
        .slice(0, 120);

      if (twitch) return `twitch-${twitch}`;

      const email = String(
        session.email ||
        session?.alumno?.email ||
        session?.student?.email ||
        ""
      )
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9@._-]+/g, "_")
        .slice(0, 120);

      if (email) return `email-${email}`;
    } catch {}

    return "guest";
  }

  const STORAGE_KEY =
    `andyazh-classroom-notifications-v3:${notificationActorKey()}`;


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

/* === Centro notificaciones: dry-run audiencia academica Supabase 2025 20260704 === */
(function initAcademicMailAudienceDryRun() {
  "use strict";

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
      <span>Consultando Supabase AyRPC 2025 en modo dry-run. No se envía ningún correo.</span>
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
        <span>Total Supabase <strong>${summary.total}</strong></span>
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

  function getClassroomToken() {
    const session =
      window.ClassroomAuth?.getSession?.() ||
      JSON.parse(localStorage.getItem("andyazh-classroom-session") || "null");

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

  async function fetchSupabase2025Items(source) {
    if (source === "personal-tests") {
      throw new Error("Pruebas personales esta deshabilitado hasta migrar esa fuente a Supabase.");
    }

    if (source !== "sheet-ayrpc-2025") {
      throw new Error("Fuente academica no implementada.");
    }

    const token = getClassroomToken();

    if (!token) {
      throw new Error("No hay sesion Classroom valida para calcular la audiencia.");
    }

    const url = `${getApiBase()}/api/classroom/admin/attendance/students?course=ayrpc-2025&limit=2000&offset=0`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(data?.detail || data?.error || data?.message || "Supabase no respondio correctamente.");
    }

    const rows = Array.isArray(data.items) ? data.items : [];

    return rows.map((row) => ({
      ...row,
      DNI: row.dni,
      Correo: row.email,
      APTO: row.apt_calculated,
      Resultado: row.result,
      Recuperatorio: row.recovery,
    }));
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

    const allowedSources = ["sheet-ayrpc-2025"];

    if (!allowedSources.includes(source) || segment !== "pending-recovery-2025") {
      renderError("Esta combinación de fuente/segmento todavía no está implementada.");
      return;
    }

    renderLoading();

    try {
      const items = await fetchSupabase2025Items(source);
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

/* === Centro notificaciones: envio E2E staff seleccionado 20260926 === */
(function initSelectedStaffMailTest() {
  "use strict";

  const sendButton =
    document.getElementById("notificationAcademicMailSendTestBtn");

  const resultBox =
    document.getElementById("notificationAcademicMailPreviewResult");

  if (!sendButton || !resultBox) return;

  sendButton.innerHTML =
    '<i class="fa-solid fa-paper-plane"></i> Enviar prueba staff';

  function apiBase() {
    const configured = String(
      window.CLASSROOM_API_BASE ||
      window.EXAMPRO_API_BASE ||
      ""
    ).replace(/\/+$/, "");

    if (
      configured &&
      !/localhost|127\.0\.0\.1/i.test(configured)
    ) {
      return configured;
    }

    return "https://api.andyazhtec.com";
  }

  function token() {
    try {
      const session = JSON.parse(
        localStorage.getItem(
          "andyazh-classroom-session"
        ) || "{}"
      );

      return (
        session.token ||
        session.access_token ||
        session.jwt ||
        session.auth_token ||
        session?.exampro?.access_token ||
        ""
      );
    } catch (_) {
      return "";
    }
  }

  function dni(value) {
    return String(value || "")
      .replace(/\D/g, "");
  }

  function currentSelection() {
    const api =
      window.ClassroomNotificationAudiences;

    const data =
      api?.getMail?.() || {};

    const selectedDnis = [
      ...new Set(
        (
          api?.getMailSelectedDnis?.() || []
        )
          .map(dni)
          .filter(Boolean)
      )
    ];

    const items =
      Array.isArray(data.items)
        ? data.items
        : [];

    const byDni = new Map(
      items.map(item => [
        dni(item.user_dni),
        item
      ])
    );

    const selected =
      selectedDnis
        .map(value => byDni.get(value))
        .filter(Boolean);

    return {
      selectedDnis,
      selected
    };
  }

  function appendStatus(message, kind = "info") {
    const previous =
      resultBox.querySelector(
        ".academic-mail-send-test-status"
      );

    if (previous) previous.remove();

    const box =
      document.createElement("div");

    box.className =
      "academic-mail-send-test-status " +
      (
        kind === "error"
          ? "is-error"
          : kind === "success"
            ? "is-success"
            : ""
      );

    box.innerHTML = message;
    resultBox.appendChild(box);
  }

  function ready() {
    const mailEnabled =
      document.querySelector(
        'input[name="notificationSendEmail"]:checked'
      )?.value === "true";

    const {
      selectedDnis,
      selected
    } = currentSelection();

    return Boolean(
      mailEnabled &&
      selectedDnis.length > 0 &&
      selectedDnis.length <= 10 &&
      selected.length === selectedDnis.length &&
      selected.every(item =>
        String(
          item.user_role || ""
        ).toLowerCase() ===
          "classroom_moderator" &&
        /\S+@\S+\.\S+/.test(
          String(item.user_email || "")
        )
      )
    );
  }

  function sync() {
    sendButton.disabled = !ready();

    sendButton.title =
      ready()
        ? "Enviar prueba real solamente a los moderadores seleccionados."
        : "Seleccion? moderadores con email v?lido y activ? Mail.";
  }

  async function request(path, options = {}) {
    const accessToken = token();

    if (!accessToken) {
      throw new Error(
        "No encontre una sesion Classroom valida."
      );
    }

    const response = await fetch(
      `${apiBase()}${path}`,
      {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    );

    const data =
      await response.json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.detail ||
        data.error ||
        `HTTP ${response.status}`
      );
    }

    return data;
  }

  async function sendSelectedStaffMail() {
    const {
      selectedDnis,
      selected
    } = currentSelection();

    if (!ready()) {
      appendStatus(
        "<strong>No se envio.</strong><br>" +
        "Seleccion? ?nicamente moderadores con email v?lido.",
        "error"
      );
      return;
    }

    const names =
      selected
        .map(item =>
          item.user_name ||
          item.user_twitch ||
          item.user_email
        )
        .join(", ");

    if (
      !window.confirm(
        `Se enviar? correo REAL a ${selectedDnis.length} moderador(es):\n\n${names}\n\n?Continuar?`
      )
    ) {
      return;
    }

    const title =
      document.getElementById(
        "notificationTitle"
      )?.value.trim() ||
      "[PRUEBA] AndyAzhTEC Classroom";

    const body =
      document.getElementById(
        "notificationBody"
      )?.value.trim() ||
      "Prueba interna del sistema de notificaciones de Classroom.";

    const type =
      document.getElementById(
        "notificationType"
      )?.value ||
      "announcement";

    const severity =
      document.getElementById(
        "notificationSeverity"
      )?.value ||
      null;

    const linkUrl =
      document.getElementById(
        "notificationLink"
      )?.value.trim() ||
      "https://classroom.andyazhtec.com/";

    sendButton.disabled = true;

    const original =
      sendButton.innerHTML;

    sendButton.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    try {
      const created = await request(
        "/api/classroom/notifications/admin/test-create",
        {
          method: "POST",
          body: JSON.stringify({
            group: "moderator-tests",
            selected_dnis: selectedDnis,
            title,
            body,
            type,
            severity,
            link_url: linkUrl,
          }),
        }
      );

      const notificationId =
        created?.notification?.id;

      if (!notificationId) {
        throw new Error(
          "El backend no devolvio notification_id."
        );
      }

      const preview = await request(
        `/api/classroom/notifications/${notificationId}/admin/email-test-preview`
      );

      const expected =
        selectedDnis.length;

      if (
        Number(
          preview?.summary?.email_destinations
        ) !== expected ||
        Number(
          preview?.summary?.valid
        ) !== expected
      ) {
        throw new Error(
          "El preview de correo no coincide con la seleccion."
        );
      }

      const sent = await request(
        `/api/classroom/notifications/${notificationId}/admin/email-test-send`,
        {
          method: "POST",
          body: JSON.stringify({
            confirmation:
              "SEND_E2E_TEST",
            expected_email_count:
              expected,
            allow_resend: false,
          }),
        }
      );

      appendStatus(
        `<strong>Prueba enviada.</strong><br>` +
        `Intentados: <strong>${sent.attempted ?? 0}</strong> ? ` +
        `Aceptados SMTP: <strong>${sent.accepted ?? 0}</strong> ? ` +
        `Diferidos: <strong>${sent.deferred ?? 0}</strong> ? ` +
        `Fallidos: <strong>${sent.failed ?? 0}</strong>`,
        "success"
      );

      window.ClassroomStaffMailLastTest = {
        notificationId,
        preview,
        sent,
      };

    } catch (error) {
      console.error(
        "[Centro] Staff mail E2E:",
        error
      );

      appendStatus(
        `<strong>No se pudo enviar.</strong><br>` +
        String(
          error?.message || error
        ),
        "error"
      );
    } finally {
      sendButton.innerHTML =
        original;

      sync();
    }
  }

  sendButton.addEventListener(
    "click",
    sendSelectedStaffMail
  );

  document.addEventListener(
    "change",
    () => setTimeout(sync, 50)
  );

  document.addEventListener(
    "click",
    () => setTimeout(sync, 100)
  );

  sync();
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
      buttonUrl: "https://profepikashu.github.io/classroom/",
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
      buttonUrl: "https://profepikashu.github.io/classroom/comunidad.html",
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
      buttonUrl: "https://profepikashu.github.io/classroom/",
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
      buttonUrl: "https://profepikashu.github.io/classroom/",
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
      buttonUrl: "https://profepikashu.github.io/classroom/curso-ayrpc-2025.html",
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
      buttonUrl: "https://profepikashu.github.io/classroom/",
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
    const buttonUrl = data.buttonUrl || "https://profepikashu.github.io/classroom/";
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
                      <img src="https://profepikashu.github.io/classroom/media/icons/classroomicoclaro.png" alt="Classroom" width="44" height="44" style="display:block;margin:10px auto;border:0;outline:none;text-decoration:none;">
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
  function bindStaticPreviewButton() {
    const button = qs("#notificationAcademicMailEmailPreviewBtn");
    if (!button || button.dataset.mailPreviewBound === "true") return;

    button.dataset.mailPreviewBound = "true";
    button.addEventListener("click", openModal);
  }

  document.addEventListener("DOMContentLoaded", () => {
    createModal();
    bindStaticPreviewButton();

    setTimeout(bindStaticPreviewButton, 300);
    setTimeout(bindStaticPreviewButton, 1000);
  });

  window.ClassroomMailPreviewModal = {
    open: openModal,
    close: closeModal,
    render: renderPreview,
    currentHtml: "",
    currentData: null
  };
})();


/* === Notification Center visual mail prototype 20260926 === */
(function () {
  "use strict";

  const form = document.getElementById("notificationAdminForm");
  const mailToggle = document.getElementById("notificationChannelMail");
  const mailPanel = document.getElementById("notificationMailComposer");
  const previewButton =
    document.getElementById("notificationAcademicMailEmailPreviewBtn");

  if (!form || !mailToggle || !mailPanel) return;

  /*
   * Seguridad del prototipo:
   * todavía no permitimos guardar ni enviar.
   */
  form.addEventListener(
    "submit",
    function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );

  function syncMailPanel() {
    mailPanel.hidden = !mailToggle.checked;
  }

  function syncRecipientCount() {
    const checks = [
      ...document.querySelectorAll(
        ".notification-mail-recipient-check"
      ),
    ];

    const selected =
      checks.filter((checkbox) => checkbox.checked).length;

    const counter =
      document.getElementById("notificationMailSelectedCount");

    if (counter) {
      counter.textContent = String(selected);
    }
  }

  mailToggle.addEventListener(
    "change",
    syncMailPanel
  );

  document
    .querySelectorAll(".notification-mail-recipient-check")
    .forEach((checkbox) => {
      checkbox.addEventListener(
        "change",
        syncRecipientCount
      );
    });

  document
    .getElementById("notificationMailSelectAll")
    ?.addEventListener("click", function () {
      document
        .querySelectorAll(".notification-mail-recipient-check")
        .forEach((checkbox) => {
          checkbox.checked = true;
        });

      syncRecipientCount();
    });

  document
    .getElementById("notificationMailSelectNone")
    ?.addEventListener("click", function () {
      document
        .querySelectorAll(".notification-mail-recipient-check")
        .forEach((checkbox) => {
          checkbox.checked = false;
        });

      syncRecipientCount();
    });

  if (previewButton) {
    previewButton.onclick = function (event) {
      event.preventDefault();

      if (
        window.ClassroomMailPreviewModal &&
        typeof window.ClassroomMailPreviewModal.open === "function"
      ) {
        window.ClassroomMailPreviewModal.open();
        return;
      }

      console.error(
        "[Centro] ClassroomMailPreviewModal no esta disponible."
      );
    };
  }

  syncMailPanel();
  syncRecipientCount();
})();


/* === Notification Audience REAL backend 20260926 === */
(function initNotificationAudienceBackendReal() {
  "use strict";

  function getApiBase() {
    const configured =
      window.CLASSROOM_API_BASE ||
      window.EXAMPRO_API_BASE ||
      localStorage.getItem("andyazh-api-base") ||
      "";

    if (configured) {
      return String(configured).replace(/\/+$/, "");
    }

    return "https://api.andyazhtec.com";
  }

  function getSession() {
    try {
      return (
        window.ClassroomAuth?.getSession?.() ||
        JSON.parse(
          localStorage.getItem("andyazh-classroom-session") ||
          "null"
        ) ||
        {}
      );
    } catch (_) {
      return {};
    }
  }

  function getToken() {
    const session = getSession();

    return (
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      session?.exampro?.access_token ||
      session?.exampro?.token ||
      session?.accessToken ||
      session?.access_token ||
      session?.token ||
      session?.student_token ||
      session?.exampro_token ||
      session?.jwt ||
      ""
    );
  }

  async function apiFetch(path, options = {}) {
    const token = getToken();

    if (!token) {
      throw new Error(
        "No hay una sesión Classroom válida."
      );
    }

    const response = await fetch(
      `${getApiBase()}${path}`,
      {
        cache: "no-store",
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.detail ||
        data?.message ||
        `Error backend ${response.status}`
      );
    }

    return data;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function roleLabel(value) {
    const role = String(value || "")
      .trim()
      .toLowerCase();

    if (
      role === "classroom_moderator" ||
      role === "moderator"
    ) {
      return "Moderador";
    }

    if (
      role === "docente" ||
      role === "teacher"
    ) {
      return "Docente";
    }

    return "Alumno";
  }

  const configs = [
    {
      key: "general",
      radioName: "notificationAudienceVisual",
      hiddenSelect: document.getElementById(
        "notificationAudience"
      ),
      panel: document.getElementById(
        "notificationSpecificAudience"
      ),
      search: document.getElementById(
        "notificationPersonSearch"
      ),
      results: document.getElementById(
        "notificationPersonSearchResults"
      ),
      selectedCount: document.getElementById(
        "notificationSelectedPeopleCount"
      ),
      selectedList: document.getElementById(
        "notificationSelectedPeopleList"
      ),
      audienceCount: document.getElementById(
        "notificationAudienceCount"
      ),
      mailMode: false,
    },

    {
      key: "mail",
      radioName: "notificationMailAudienceVisual",
      hiddenSelect: null,
      panel: document.getElementById(
        "notificationMailSpecificAudience"
      ),
      search: document.getElementById(
        "notificationMailPersonSearch"
      ),
      results: document.getElementById(
        "notificationMailPersonSearchResults"
      ),
      selectedCount: document.getElementById(
        "notificationMailSelectedPeopleCount"
      ),
      selectedList: document.getElementById(
        "notificationMailSelectedPeopleList"
      ),
      audienceCount: document.getElementById(
        "notificationMailAudienceCount"
      ),
      mailMode: true,
    },
  ];

  const states = new Map();

  function getRadios(config) {
    return [
      ...document.querySelectorAll(
        `input[name="${config.radioName}"]`
      )
    ];
  }

  function getActiveAudience(config) {
    return (
      getRadios(config).find(
        radio => radio.checked
      )?.value ||
      "all"
    );
  }

  function createState(config) {
    return {
      config,
      selected: new Map(),
      searchItems: new Map(),
      lastResolved: null,
      lastError: null,
      searchTimer: null,
      resolveSerial: 0,
      searchSerial: 0,
    };
  }

  function getSelectedDnis(state) {
    return [
      ...state.selected.keys()
    ];
  }

  function updateHiddenAudience(state) {
    const audience =
      getActiveAudience(state.config);

    if (state.config.hiddenSelect) {
      state.config.hiddenSelect.value = audience;

      state.config.hiddenSelect.dispatchEvent(
        new Event(
          "change",
          { bubbles: true }
        )
      );
    }
  }

  function renderSelected(state) {
    const {
      selectedList,
      selectedCount,
    } = state.config;

    const people = [
      ...state.selected.values()
    ];

    if (selectedCount) {
      selectedCount.textContent =
        String(people.length);
    }

    if (!selectedList) return;

    if (!people.length) {
      selectedList.innerHTML = `
        <span class="notification-selected-empty">
          Todavía no seleccionaste a nadie.
        </span>
      `;
      return;
    }

    selectedList.innerHTML = people
      .map(person => `
        <span class="notification-person-chip">
          <span>
            ${escapeHtml(person.full_name)}
          </span>

          <button
            type="button"
            data-remove-person="${escapeHtml(person.dni)}"
            aria-label="Quitar ${escapeHtml(person.full_name)}"
          >
            ×
          </button>
        </span>
      `)
      .join("");
  }

  function renderAudienceCount(
    state,
    summary = null,
    loading = false
  ) {
    const el = state.config.audienceCount;

    if (!el) return;

    if (loading) {
      el.textContent = "...";
      return;
    }

    if (!summary) {
      el.textContent = "0";
      return;
    }

    if (state.config.mailMode) {
      el.textContent =
        `${summary.with_email || 0} con mail`;
      return;
    }

    el.textContent =
      String(summary.total || 0);
  }

  async function resolveAudience(state) {
    const audience =
      getActiveAudience(state.config);

    const selectedDnis =
      audience === "specific_user"
        ? getSelectedDnis(state)
        : [];

    if (
      audience === "specific_user" &&
      !selectedDnis.length
    ) {
      state.lastResolved = {
        ok: true,
        audience,
        summary: {
          total: 0,
          with_email: 0,
          without_email: 0,
          with_twitch: 0,
          with_dni: 0,
        },
        items: [],
      };

      renderAudienceCount(
        state,
        state.lastResolved.summary
      );

      return state.lastResolved;
    }

    const serial =
      ++state.resolveSerial;

    renderAudienceCount(
      state,
      null,
      true
    );

    try {
      const data = await apiFetch(
        "/api/classroom/notifications/admin/audience-resolve",
        {
          method: "POST",
          body: JSON.stringify({
            audience,
            selected_dnis: selectedDnis,
          }),
        }
      );

      if (serial !== state.resolveSerial) {
        return null;
      }

      state.lastResolved = data;
      state.lastError = null;

      renderAudienceCount(
        state,
        data.summary || {}
      );

      return data;

    } catch (error) {
      if (serial !== state.resolveSerial) {
        return null;
      }

      state.lastResolved = null;
      state.lastError = error;

      if (state.config.audienceCount) {
        state.config.audienceCount.textContent =
          "Error";
      }

      console.error(
        `[Centro] Error resolviendo audiencia ${state.config.key}:`,
        error
      );

      return null;
    }
  }

  function renderSearchResults(
    state,
    items
  ) {
    const box = state.config.results;

    if (!box) return;

    if (!items.length) {
      box.innerHTML = `
        <div class="notification-selected-empty">
          No encontramos coincidencias.
        </div>
      `;

      box.hidden = false;
      return;
    }

    state.searchItems.clear();

    items.forEach(person => {
      if (person?.dni) {
        state.searchItems.set(
          String(person.dni),
          person
        );
      }
    });

    box.innerHTML = items
      .map(person => {
        const alreadySelected =
          state.selected.has(
            String(person.dni)
          );

        const details = [
          person.dni
            ? `DNI ${person.dni}`
            : "",
          person.twitch
            ? `@${person.twitch}`
            : "",
          person.email || "",
          roleLabel(person.role),
        ]
          .filter(Boolean)
          .join(" · ");

        return `
          <div class="notification-person-result">
            <span>
              <strong>
                ${escapeHtml(
                  person.full_name ||
                  person.twitch ||
                  "Usuario"
                )}
              </strong>

              <small>
                ${escapeHtml(details)}
              </small>
            </span>

            <button
              type="button"
              data-add-person="${escapeHtml(person.dni)}"
              ${alreadySelected ? "disabled" : ""}
            >
              <i class="fa-solid ${
                alreadySelected
                  ? "fa-check"
                  : "fa-plus"
              }"></i>

              ${
                alreadySelected
                  ? "Agregado"
                  : "Agregar"
              }
            </button>
          </div>
        `;
      })
      .join("");

    box.hidden = false;
  }

  async function searchPeople(state) {
    const search =
      state.config.search;

    const box =
      state.config.results;

    if (!search || !box) return;

    const query =
      String(search.value || "")
        .trim();

    if (query.length < 2) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }

    const serial =
      ++state.searchSerial;

    box.hidden = false;
    box.innerHTML = `
      <div class="notification-selected-empty">
        Buscando en la base...
      </div>
    `;

    try {
      const data = await apiFetch(
        `/api/classroom/notifications/admin/people-search?q=${encodeURIComponent(query)}&limit=20`
      );

      if (serial !== state.searchSerial) {
        return;
      }

      renderSearchResults(
        state,
        Array.isArray(data.items)
          ? data.items
          : []
      );

    } catch (error) {
      if (serial !== state.searchSerial) {
        return;
      }

      box.innerHTML = `
        <div class="notification-selected-empty">
          ${escapeHtml(
            error.message ||
            "No se pudo buscar."
          )}
        </div>
      `;

      box.hidden = false;

      console.error(
        "[Centro] Error buscando personas:",
        error
      );
    }
  }

  function syncAudienceUi(state) {
    const audience =
      getActiveAudience(state.config);

    updateHiddenAudience(state);

    if (state.config.panel) {
      state.config.panel.hidden =
        audience !== "specific_user";
    }

    resolveAudience(state);
  }

  function bindState(state) {
    const config =
      state.config;

    const radios =
      getRadios(config);

    if (!radios.length) return false;

    radios.forEach(radio => {
      radio.addEventListener(
        "change",
        () => syncAudienceUi(state)
      );
    });

    if (config.search) {
      config.search.addEventListener(
        "input",
        () => {
          clearTimeout(
            state.searchTimer
          );

          state.searchTimer =
            setTimeout(
              () => searchPeople(state),
              250
            );
        }
      );
    }

    if (config.results) {
      config.results.addEventListener(
        "click",
        event => {
          const button =
            event.target.closest(
              "[data-add-person]"
            );

          if (!button) return;

          const dni =
            String(
              button.dataset.addPerson ||
              ""
            );

          const person =
            state.searchItems.get(dni);

          if (!person) return;

          state.selected.set(
            dni,
            person
          );

          renderSelected(state);
          renderSearchResults(
            state,
            [...state.searchItems.values()]
          );

          resolveAudience(state);
        }
      );
    }

    if (config.selectedList) {
      config.selectedList.addEventListener(
        "click",
        event => {
          const button =
            event.target.closest(
              "[data-remove-person]"
            );

          if (!button) return;

          const dni =
            String(
              button.dataset.removePerson ||
              ""
            );

          state.selected.delete(dni);

          renderSelected(state);

          if (
            config.search &&
            config.search.value.trim().length >= 2
          ) {
            renderSearchResults(
              state,
              [...state.searchItems.values()]
            );
          }

          resolveAudience(state);
        }
      );
    }

    renderSelected(state);
    syncAudienceUi(state);

    return true;
  }

  function init() {
    configs.forEach(config => {
      const state =
        createState(config);

      states.set(
        config.key,
        state
      );

      bindState(state);
    });
  }

  window.ClassroomNotificationAudiences = {
    refresh: async function refresh() {
      const jobs = [
        ...states.values()
      ].map(resolveAudience);

      return Promise.all(jobs);
    },

    getGeneral: function getGeneral() {
      return states.get("general")
        ?.lastResolved || null;
    },

    getMail: function getMail() {
      return states.get("mail")
        ?.lastResolved || null;
    },

    getGeneralSelectedDnis:
      function getGeneralSelectedDnis() {
        const state =
          states.get("general");

        return state
          ? getSelectedDnis(state)
          : [];
      },

    getMailSelectedDnis:
      function getMailSelectedDnis() {
        const state =
          states.get("mail");

        return state
          ? getSelectedDnis(state)
          : [];
      },
  };

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();


/* === Notification Mail Exact Recipients 20260926 === */
(function initNotificationMailExactRecipients() {
  "use strict";

  const selectionCount =
    document.getElementById(
      "notificationMailRecipientSelectionCount"
    );

  const stats =
    document.getElementById(
      "notificationMailRecipientStats"
    );

  const list =
    document.getElementById(
      "notificationMailRecipientList"
    );

  const selectAllButton =
    document.getElementById(
      "notificationMailRecipientsAll"
    );

  const selectNoneButton =
    document.getElementById(
      "notificationMailRecipientsNone"
    );

  if (
    !selectionCount ||
    !stats ||
    !list
  ) {
    return;
  }

  const state = {
    signature: "",
    audience: "",
    items: [],
    selected: new Set(),
    lastData: null,
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeDni(value) {
    return String(value || "")
      .replace(/\D/g, "");
  }

  function hasValidEmail(item) {
    const email =
      String(
        item?.user_email ||
        ""
      ).trim();

    return /\S+@\S+\.\S+/.test(email);
  }

  function normalizeItems(data) {
    const seen = new Set();

    return (
      Array.isArray(data?.items)
        ? data.items
        : []
    )
      .map(item => ({
        ...item,
        user_dni: normalizeDni(
          item?.user_dni
        ),
        user_name:
          String(
            item?.user_name ||
            "Usuario"
          ).trim(),
        user_email:
          String(
            item?.user_email ||
            ""
          ).trim().toLowerCase(),
        user_twitch:
          String(
            item?.user_twitch ||
            ""
          ).trim(),
      }))
      .filter(item => {
        if (
          !item.user_dni ||
          seen.has(item.user_dni)
        ) {
          return false;
        }

        seen.add(item.user_dni);
        return true;
      });
  }

  function buildSignature(data, items) {
    return JSON.stringify([
      data?.audience || "",
      items.map(item => [
        item.user_dni,
        item.user_email,
      ]),
    ]);
  }

  function getSelectedItems() {
    return state.items.filter(
      item =>
        state.selected.has(
          item.user_dni
        ) &&
        hasValidEmail(item)
    );
  }

  function render() {
    const total =
      state.items.length;

    const withEmail =
      state.items.filter(
        hasValidEmail
      ).length;

    const withoutEmail =
      total - withEmail;

    const selected =
      getSelectedItems();

    selectionCount.textContent =
      `${selected.length} de ${withEmail} correos seleccionados`;

    stats.textContent =
      `${total} personas en la audiencia · ` +
      `${withEmail} con correo válido · ` +
      `${withoutEmail} sin correo`;

    if (!state.items.length) {
      list.innerHTML = `
        <div class="notification-mail-recipient-empty">
          No hay destinatarios para esta audiencia.
        </div>
      `;

      return;
    }

    list.innerHTML =
      state.items
        .map(item => {
          const valid =
            hasValidEmail(item);

          const checked =
            valid &&
            state.selected.has(
              item.user_dni
            );

          const details = [
            item.user_dni
              ? `DNI ${item.user_dni}`
              : "",
            item.user_twitch
              ? `@${item.user_twitch}`
              : "",
            valid
              ? item.user_email
              : "SIN CORREO VÁLIDO",
          ]
            .filter(Boolean)
            .join(" · ");

          return `
            <label
              class="notification-mail-recipient-row ${
                valid
                  ? ""
                  : "is-disabled"
              }"
            >
              <input
                type="checkbox"
                data-mail-recipient-dni="${escapeHtml(
                  item.user_dni
                )}"
                ${
                  checked
                    ? "checked"
                    : ""
                }
                ${
                  valid
                    ? ""
                    : "disabled"
                }
              />

              <span class="notification-mail-recipient-person">
                <strong>
                  ${escapeHtml(
                    item.user_name
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    details
                  )}
                </small>
              </span>
            </label>
          `;
        })
        .join("");
  }

  function resetSelectionForAudience(items) {
    state.selected.clear();

    items.forEach(item => {
      if (hasValidEmail(item)) {
        state.selected.add(
          item.user_dni
        );
      }
    });
  }

  function syncFromAudience() {
    const api =
      window.ClassroomNotificationAudiences;

    const data =
      api?.getMail?.();

    if (
      !data ||
      !Array.isArray(data.items)
    ) {
      return;
    }

    const items =
      normalizeItems(data);

    const signature =
      buildSignature(
        data,
        items
      );

    if (
      signature ===
      state.signature
    ) {
      return;
    }

    state.signature =
      signature;

    state.audience =
      String(
        data.audience ||
        ""
      );

    state.items =
      items;

    state.lastData =
      data;

    resetSelectionForAudience(
      items
    );

    render();
  }

  list.addEventListener(
    "change",
    event => {
      const checkbox =
        event.target.closest(
          "[data-mail-recipient-dni]"
        );

      if (!checkbox) {
        return;
      }

      const dni =
        normalizeDni(
          checkbox.dataset
            .mailRecipientDni
        );

      if (!dni) {
        return;
      }

      if (checkbox.checked) {
        state.selected.add(dni);
      } else {
        state.selected.delete(dni);
      }

      render();
    }
  );

  selectAllButton?.addEventListener(
    "click",
    () => {
      state.selected.clear();

      state.items.forEach(item => {
        if (hasValidEmail(item)) {
          state.selected.add(
            item.user_dni
          );
        }
      });

      render();
    }
  );

  selectNoneButton?.addEventListener(
    "click",
    () => {
      state.selected.clear();
      render();
    }
  );

  window.ClassroomNotificationMailRecipients = {
    refresh:
      syncFromAudience,

    getSelectedDnis:
      function getSelectedDnis() {
        return getSelectedItems()
          .map(
            item =>
              item.user_dni
          );
      },

    getSelectedItems:
      function getSelectedItemsPublic() {
        return [
          ...getSelectedItems()
        ];
      },

    getAudience:
      function getAudience() {
        return state.audience;
      },

    getExpectedAudienceCount:
      function getExpectedAudienceCount() {
        return Number(
          state.lastData
            ?.summary
            ?.total ||
          state.items.length ||
          0
        );
      },

    getExpectedRecipientCount:
      function getExpectedRecipientCount() {
        return getSelectedItems()
          .length;
      },

    getSummary:
      function getSummary() {
        return {
          total:
            state.items.length,

          with_email:
            state.items.filter(
              hasValidEmail
            ).length,

          without_email:
            state.items.filter(
              item =>
                !hasValidEmail(item)
            ).length,

          selected:
            getSelectedItems()
              .length,
        };
      },
  };

  const timer =
    window.setInterval(
      syncFromAudience,
      400
    );

  window.addEventListener(
    "beforeunload",
    () => {
      clearInterval(timer);
    },
    { once: true }
  );

  syncFromAudience();
})();

/* === Notification Segment Create Button 20260926 V2 === */
(function initNotificationSegmentCreateButtonV2() {
  "use strict";

  const button =
    document.getElementById("notificationPrototypeSave");

  if (!button) return;

  const status =
    button
      .closest(".notification-prototype-actions")
      ?.querySelector("span");

  let busy = false;
  let created = false;
  let lastResult = null;

  function value(id, fallback = "") {
    return String(
      document.getElementById(id)?.value ||
      fallback
    ).trim();
  }

  function checked(id) {
    return Boolean(
      document.getElementById(id)?.checked
    );
  }

  function isLocal() {
    const host =
      String(location.hostname || "")
        .trim()
        .toLowerCase();

    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === ""
    );
  }

  function normalizeDni(value) {
    return String(value || "")
      .replace(/\D/g, "");
  }

  function normalizeRole(value) {
    const role =
      String(value || "")
        .trim()
        .toLowerCase();

    if (role === "teacher") return "docente";
    if (role === "moderator") return "classroom_moderator";
    if (role === "student") return "alumno";

    return role;
  }

  function audienceApi() {
    return (
      window.ClassroomNotificationAudiences ||
      null
    );
  }

  function mailApi() {
    return (
      window.ClassroomNotificationMailRecipients ||
      null
    );
  }

  function getGeneralResolved() {
    const data =
      audienceApi()?.getGeneral?.();

    if (
      !data ||
      !Array.isArray(data.items)
    ) {
      throw new Error(
        "La audiencia general todavía no terminó de calcularse."
      );
    }

    return data;
  }

  function uniqueDnis(items) {
    const seen = new Set();
    const result = [];

    for (const item of items || []) {
      const dni = normalizeDni(
        item?.user_dni ??
        item?.dni ??
        item
      );

      if (!dni || seen.has(dni)) {
        continue;
      }

      seen.add(dni);
      result.push(dni);
    }

    return result;
  }

  function getGeneralSnapshot() {
    const data =
      getGeneralResolved();

    const items =
      [...data.items];

    const selectedDnis =
      uniqueDnis(items);

    return {
      data,
      items,

      sourceAudience:
        String(
          data.audience ||
          document.getElementById(
            "notificationAudience"
          )?.value ||
          ""
        ).trim(),

      selectedDnis,

      expectedAudienceCount:
        Number(
          data?.summary?.total ??
          items.length
        ),

      expectedRecipientCount:
        selectedDnis.length,
    };
  }

  function getMailDraft() {
    return {
      subject:
        value("notificationMailSubject"),

      badge:
        value("notificationMailBadge"),

      title:
        value("notificationMailTitle"),

      body:
        value("notificationMailBody"),

      secondary:
        value("notificationMailSecondary"),

      cta:
        value("notificationMailCta"),

      link:
        value("notificationMailLink"),
    };
  }

  function getMailSummary() {
    const api = mailApi();

    return {
      audience:
        String(
          api?.getAudience?.() || ""
        ).trim(),

      audience_count:
        Number(
          api?.getExpectedAudienceCount?.() ||
          0
        ),

      selected_count:
        Number(
          api?.getExpectedRecipientCount?.() ||
          0
        ),
    };
  }

  function buildPayload() {
    const snap =
      getGeneralSnapshot();

    const title =
      value("notificationTitle");

    const body =
      value("notificationBody");

    if (title.length < 3) {
      throw new Error(
        "El título debe tener al menos 3 caracteres."
      );
    }

    if (!body) {
      throw new Error(
        "El mensaje es obligatorio."
      );
    }

    if (!snap.sourceAudience) {
      throw new Error(
        "No pude determinar la audiencia."
      );
    }

    if (
      snap.expectedAudienceCount <= 0 ||
      snap.expectedRecipientCount <= 0
    ) {
      throw new Error(
        "La audiencia no tiene destinatarios."
      );
    }

    return {
      title,
      body,
      description: body,

      type:
        value(
          "notificationType",
          "announcement"
        ),

      severity:
        value("notificationSeverity") ||
        null,

      link_url:
        value("notificationLink") ||
        null,

      link:
        value("notificationLink") ||
        null,

      source_audience:
        snap.sourceAudience,

      selected_dnis:
        snap.selectedDnis,

      expected_audience_count:
        snap.expectedAudienceCount,

      expected_recipient_count:
        snap.expectedRecipientCount,

      send_email: false,
      email_required: false,

      context: {
        created_from:
          "notification-center",

        recipient_snapshot_source:
          "general-audience",

        channels: {
          notice:
            checked(
              "notificationChannelNotice"
            ),

          bell:
            checked(
              "notificationChannelBell"
            ),

          mail_requested:
            checked(
              "notificationChannelMail"
            ),

          mail_send_enabled:
            false,
        },

        mail_preview:
          getMailSummary(),

        mail_draft:
          getMailDraft(),
      },
    };
  }

  function isStaff(item) {
    const role =
      normalizeRole(
        item?.user_role ??
        item?.role
      );

    return (
      role === "docente" ||
      role === "classroom_moderator"
    );
  }

  function localSafetyError(
    payload,
    people
  ) {
    if (!isLocal()) {
      return "";
    }

    const audience =
      String(
        payload.source_audience || ""
      ).toLowerCase();

    if (
      ![
        "staff",
        "specific",
        "specific_user"
      ].includes(audience)
    ) {
      return (
        "PRUEBA BLOQUEADA: en localhost sólo se permite Staff o Solo a..."
      );
    }

    const invalid =
      people.filter(
        person => !isStaff(person)
      );

    if (invalid.length) {
      return (
        `PRUEBA BLOQUEADA: ${invalid.length} destinatario(s) no son staff.`
      );
    }

    if (
      payload.expected_recipient_count > 10
    ) {
      return (
        "PRUEBA BLOQUEADA: máximo 10 miembros de staff."
      );
    }

    return "";
  }

  function getSession() {
    try {
      return (
        window.ClassroomAuth
          ?.getSession?.() ||
        JSON.parse(
          localStorage.getItem(
            "andyazh-classroom-session"
          ) || "null"
        ) ||
        {}
      );
    } catch (_) {
      return {};
    }
  }

  function getToken() {
    const session =
      getSession();

    return (
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      session?.exampro?.access_token ||
      session?.exampro?.token ||
      session?.accessToken ||
      session?.access_token ||
      session?.token ||
      session?.student_token ||
      session?.exampro_token ||
      session?.jwt ||
      ""
    );
  }

  function apiBase() {
    if (isLocal()) {
      return "https://api.andyazhtec.com";
    }

    return String(
      window.CLASSROOM_API_BASE ||
      window.EXAMPRO_API_BASE ||
      "https://api.andyazhtec.com"
    ).replace(/\/+$/, "");
  }

  function backendError(
    data,
    statusCode
  ) {
    const detail =
      data?.detail;

    if (
      typeof detail === "string"
    ) {
      return detail;
    }

    if (
      detail &&
      typeof detail === "object"
    ) {
      return (
        detail.message ||
        detail.code ||
        JSON.stringify(detail)
      );
    }

    return (
      data?.message ||
      `Error backend ${statusCode}`
    );
  }

  function syncButton() {
    if (busy || created) {
      return;
    }

    let snap;

    try {
      snap =
        getGeneralSnapshot();
    } catch (_) {
      button.disabled = true;
      button.title =
        "Esperando audiencia exacta...";

      if (status) {
        status.textContent =
          "Esperando audiencia exacta.";
      }

      return;
    }

    const pseudoPayload = {
      source_audience:
        snap.sourceAudience,

      expected_recipient_count:
        snap.expectedRecipientCount,
    };

    const safety =
      localSafetyError(
        pseudoPayload,
        snap.items
      );

    if (safety) {
      button.disabled = true;
      button.title = safety;

      if (status) {
        status.textContent =
          safety;
      }

      return;
    }

    button.disabled =
      !snap.expectedRecipientCount;

    button.title =
      "Crear snapshot exacto. Mail real apagado.";

    if (status) {
      status.textContent =
        `${snap.expectedRecipientCount} destinatarios listos · ` +
        `audiencia ${snap.expectedAudienceCount} · ` +
        `mail real apagado.`;
    }
  }

  async function createSnapshot() {
    if (busy || created) {
      return;
    }

    let payload;
    let people;

    try {
      payload =
        buildPayload();

      people =
        getGeneralSnapshot().items;
    } catch (error) {
      alert(error.message);
      return;
    }

    if (
      !payload.context.channels.bell
    ) {
      alert(
        "Para esta prueba dejá activada la campanita."
      );
      return;
    }

    const safety =
      localSafetyError(
        payload,
        people
      );

    if (safety) {
      alert(safety);
      return;
    }

    const names =
      isLocal()
        ? people
            .slice(0, 10)
            .map(item => {
              const name =
                item?.user_name ||
                item?.full_name ||
                item?.user_twitch ||
                "Usuario";

              return (
                `${name} (` +
                `${normalizeRole(
                  item?.user_role ??
                  item?.role
                )})`
              );
            })
            .join("\n")
        : "";

    const ok =
      confirm(
        `${isLocal()
          ? "PRUEBA REAL EN PRODUCCIÓN"
          : "CREAR COMUNICACIÓN"}\n\n` +

        `Audiencia: ${payload.source_audience}\n` +
        `Destinatarios: ${payload.expected_recipient_count}\n` +
        `Correo: APAGADO\n` +
        `Campanita: SÍ\n\n` +

        (names
          ? `${names}\n\n`
          : "") +

        "¿Continuar?"
      );

    if (!ok) {
      return;
    }

    const token =
      getToken();

    if (!token) {
      alert(
        "No encontré una sesión Classroom autenticada."
      );
      return;
    }

    busy = true;
    button.disabled = true;

    try {
      const response =
        await fetch(
          `${apiBase()}/api/classroom/notifications/admin/segment-create`,
          {
            method: "POST",
            cache: "no-store",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify(payload),
          }
        );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          backendError(
            data,
            response.status
          )
        );
      }

      lastResult = {
        ok:
          Boolean(data?.ok),

        notification_id:
          data?.item?.id || null,

        source_audience:
          data?.snapshot?.source_audience ||
          payload.source_audience,

        audience_count:
          Number(
            data?.snapshot?.audience_count ??
            payload.expected_audience_count
          ),

        recipient_count:
          Number(
            data?.snapshot?.recipient_count ??
            payload.expected_recipient_count
          ),

        mail_sent:
          false,
      };

      created = true;

      button.innerHTML =
        '<i class="fa-solid fa-check"></i> Comunicación creada';

      if (status) {
        status.textContent =
          `Snapshot creado · ` +
          `${lastResult.recipient_count} destinatarios · ` +
          `mail NO enviado.`;
      }

      console.log(
        "[Centro] segment-create OK",
        lastResult
      );

      alert(
        "Comunicación creada correctamente.\n\n" +
        `Destinatarios: ${lastResult.recipient_count}\n` +
        "Correo enviado: NO"
      );

    } catch (error) {
      console.error(
        "[Centro] segment-create ERROR",
        error
      );

      alert(
        error?.message ||
        "No se pudo crear la comunicación."
      );

      button.disabled = false;

    } finally {
      busy = false;
    }
  }

  button.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();
      createSnapshot();
    }
  );

  window.ClassroomNotificationSegmentCreate = {
    buildPayload,

    inspect() {
      const payload =
        buildPayload();

      return {
        source_audience:
          payload.source_audience,

        audience_count:
          payload.expected_audience_count,

        recipient_count:
          payload.expected_recipient_count,

        bell:
          payload.context.channels.bell,

        notice:
          payload.context.channels.notice,

        mail_requested:
          payload.context.channels.mail_requested,

        send_email:
          payload.send_email,

        email_required:
          payload.email_required,

        local_safety_error:
          localSafetyError(
            payload,
            getGeneralSnapshot().items
          ) || null,
      };
    },

    getLastResult() {
      return lastResult
        ? { ...lastResult }
        : null;
    },
  };

  setInterval(
    syncButton,
    500
  );

  syncButton();
})();
