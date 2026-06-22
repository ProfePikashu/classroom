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
