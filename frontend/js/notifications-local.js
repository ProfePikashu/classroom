
(() => {
  "use strict";

  window.ClassroomUseLocalNotifications = true;

  const NOTIFICATIONS_KEY = "andyazh-classroom-notifications-v2";
  const PREFS_KEY = "andyazh-classroom-notification-prefs-mock";
  const MAX_ITEMS = 80;

  const DEFAULT_PREFS = {
    bell: true,
    community: true,
    communityNewPosts: true,
    communityReplies: true,
    communityStatus: true,
    courseNews: true,
    announcements: true,
    emailCommunity: false,
    emailAnnouncements: false,
    newsletter: false,
    attendance: true,
  };

  const TYPE_ICONS = {
    community_new_post: "fa-comments",
    community_reply: "fa-reply",
    community_status: "fa-circle-check",
    course_news: "fa-bullhorn",
    announcement: "fa-satellite-dish",
    system: "fa-bell",
    demo: "fa-wand-magic-sparkles",
  };

  function currentFile() {
    return window.location.pathname.split("/").pop() || "index.html";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix = "notif") {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(iso) {
    try {
      return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch (error) {
      return "";
    }
  }

  function readSession() {
    try {
      if (typeof ClassroomAuth !== "undefined" && ClassroomAuth.getSession) {
        return ClassroomAuth.getSession();
      }

      return JSON.parse(localStorage.getItem("andyazh-classroom-session") || "null");
    } catch (error) {
      return null;
    }
  }

  function currentUserName() {
    const session = readSession();

    if (!session) return "Usuario Classroom";

    return session.displayName || session.twitch || session.email || "Usuario Classroom";
  }

  function loadPrefs() {
    try {
      const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      return { ...DEFAULT_PREFS, ...raw };
    } catch (error) {
      return { ...DEFAULT_PREFS };
    }
  }

  function savePrefs(prefs) {
    const next = { ...DEFAULT_PREFS, ...(prefs || {}) };
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    return next;
  }

  function loadItems() {
    try {
      const raw = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (error) {
      return [];
    }
  }

  function saveItems(items) {
    const clean = Array.isArray(items) ? items.slice(0, MAX_ITEMS) : [];
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(clean));
    return clean;
  }

  function shouldCreate(type) {
    const prefs = loadPrefs();

    if (!prefs.bell) return false;

    if (type === "community_new_post") return Boolean(prefs.community && prefs.communityNewPosts);
    if (type === "community_reply") return Boolean(prefs.community && prefs.communityReplies);
    if (type === "community_status") return Boolean(prefs.community && prefs.communityStatus);
    if (type === "course_news") return Boolean(prefs.courseNews);
    if (type === "announcement") return Boolean(prefs.announcements);

    return true;
  }

  function createNotification(payload = {}) {
    const type = payload.type || "system";

    if (payload.respectPrefs !== false && !shouldCreate(type)) {
      return null;
    }

    const item = {
      id: payload.id || uid("notif"),
      type,
      title: payload.title || "Nueva notificación",
      body: payload.body || "",
      link: payload.link || "",
      source: payload.source || "classroom",
      actor: payload.actor || currentUserName(),
      createdAt: payload.createdAt || nowIso(),
      read: Boolean(payload.read),
      meta: payload.meta || {},
    };

    const items = loadItems();

    saveItems([item, ...items]);
    render();

    window.dispatchEvent(new CustomEvent("classroom:notifications-updated", {
      detail: { item, items: loadItems() },
    }));

    return item;
  }

  function deleteNotification(id) {
    if (!id) return;

    const ok = window.confirm("¿Eliminar esta notificación?");
    if (!ok) return;

    const before = loadItems();
    const items = before.filter((item) => String(item.id) !== String(id));

    saveItems(items);
    render();

    window.dispatchEvent(new CustomEvent("classroom:notifications-updated", {
      detail: { deletedId: id, items },
    }));
  }

  function toggleRead(id) {
    if (!id) return;

    const items = loadItems().map((item) => {
      if (item.id !== id) return item;
      return { ...item, read: !item.read };
    });

    saveItems(items);
    render();
  }

  function markRead(id) {
    const items = loadItems().map((item) => {
      if (item.id !== id) return item;
      return { ...item, read: true };
    });

    saveItems(items);
    render();
  }

  function markAllRead() {
    const items = loadItems().map((item) => ({ ...item, read: true }));
    saveItems(items);
    render();
  }


  function clearLegacyNotificationStores() {
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);

      if (!key) continue;
      if (!key.startsWith("andyazh-classroom-")) continue;

      const normalized = key.toLowerCase();
      const looksLikeNotifications = normalized.includes("notification") || normalized.includes("notificacion") || normalized.includes("news");
      const isPrefs = normalized.includes("pref");

      if (looksLikeNotifications && !isPrefs) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });
  }


  function clearAll() {
    const ok = window.confirm("¿Eliminar todas las notificaciones? Esta acción no se puede deshacer.");
    if (!ok) return;

    clearLegacyNotificationStores();
    saveItems([]);
    render();

    setTimeout(render, 120);
  }

  function seedDemo() {
    createNotification({
      type: "demo",
      title: "Notificación demo",
      body: "La campanita está funcionando. Después esto puede venir desde Comunidad, Avisos o el backend.",
      link: "comunidad.html",
      source: "demo",
      respectPrefs: false,
    });
  }

  function ensureWidget() {
    const themeToggle = document.getElementById("themeToggle");
    if (!themeToggle) return null;

    let widget = document.getElementById("notificationsWidget");

    if (!widget) {
      widget = document.createElement("div");
      widget.id = "notificationsWidget";
      widget.className = "notifications-widget";
      themeToggle.insertAdjacentElement("afterend", widget);
    }

    widget.innerHTML = `
      <button class="notifications-toggle" id="notificationsToggle" type="button" aria-label="Notificaciones">
        <i class="fa-solid fa-bell"></i>
        <span class="notifications-dot is-hidden" id="notificationsDot">0</span>
      </button>

      <div class="notifications-panel" id="notificationsPanel" aria-hidden="true">
        <div class="notifications-panel-header">
          <div>
            <p class="eyebrow">Classroom</p>
            <h3>Notificaciones</h3>
          </div>
          <span class="notifications-chip">Local v2</span>
        </div>

        <div class="notifications-list" id="notificationsList"></div>

        <div class="notifications-panel-footer notifications-panel-footer-v2">
          <button class="notifications-read-all" id="notificationsReadAll" type="button">
            <i class="fa-solid fa-check-double"></i>
            Marcar leídas
          </button>

          <button class="notifications-read-all" id="notificationsSeedDemo" type="button">
            <i class="fa-solid fa-flask"></i>
            Demo
          </button>

          <a class="notifications-read-all notifications-settings-link" id="notificationsSettingsLink" href="perfil.html#notificationPrefsCard">
            <i class="fa-solid fa-gear"></i>
            Configurar
          </a>

          <button class="notifications-clear-all-icon" id="notificationsClearAll" type="button" title="Limpiar todas las notificaciones" aria-label="Limpiar todas las notificaciones">
            <i class="fa-solid fa-broom"></i>
          </button>
        </div>
      </div>
    `;

    bindWidget(widget);
    return widget;
  }

  function bindWidget(widget) {
    const toggle = widget.querySelector("#notificationsToggle");
    const panel = widget.querySelector("#notificationsPanel");
    const readAll = widget.querySelector("#notificationsReadAll");
    const seed = widget.querySelector("#notificationsSeedDemo");
    const clear = widget.querySelector("#notificationsClearAll");
    const settings = widget.querySelector("#notificationsSettingsLink");

    toggle?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const open = !widget.classList.contains("open");
      widget.classList.toggle("open", open);
      panel?.setAttribute("aria-hidden", open ? "false" : "true");
      render();
    });

    panel?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    readAll?.addEventListener("click", markAllRead);
    seed?.addEventListener("click", seedDemo);
    clear?.addEventListener("click", clearAll);

    settings?.addEventListener("click", () => {
      widget.classList.remove("open");
      panel?.setAttribute("aria-hidden", "true");
    });

    document.addEventListener("click", (event) => {
      if (!widget.classList.contains("open")) return;
      if (event.target.closest("#notificationsWidget")) return;

      widget.classList.remove("open");
      panel?.setAttribute("aria-hidden", "true");
    });
  }

  function render() {
    const widget = document.getElementById("notificationsWidget") || ensureWidget();
    if (!widget) return;

    const list = widget.querySelector("#notificationsList");
    const dot = widget.querySelector("#notificationsDot");

    if (!list || !dot) return;

    const items = loadItems().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const unread = items.filter((item) => !item.read).length;

    dot.textContent = String(unread);
    dot.classList.toggle("is-hidden", unread === 0);

    if (items.length === 0) {
      list.innerHTML = `
        <article class="notification-empty">
          <i class="fa-regular fa-bell"></i>
          <strong>Sin notificaciones</strong>
          <p>Cuando haya respuestas, hilos o avisos, van a aparecer acá.</p>
        </article>
      `;
      return;
    }

    list.innerHTML = items.map((item) => {
      const icon = TYPE_ICONS[item.type] || TYPE_ICONS.system;
      const unreadClass = item.read ? "" : "unread";

      const readLabel = item.read ? "Marcar no leída" : "Marcar leída";
      const readIcon = item.read ? "fa-envelope" : "fa-envelope-open";

      return `
        <article class="notification-item ${unreadClass} ${severityClass}" data-notification-id="${escapeHtml(item.id)}" data-notification-link="${escapeHtml(item.link || "")}">
          <button class="notification-delete-btn" type="button" data-notification-delete="${escapeHtml(item.id)}" aria-label="Eliminar notificación" title="Eliminar notificación">
            <i class="fa-solid fa-xmark"></i>
          </button>

          <div class="notification-icon">
            <i class="fa-solid ${icon}"></i>
          </div>

          <div class="notification-content">
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.body)}</p>
            <small>
              ${escapeHtml(item.actor || "Classroom")} · ${escapeHtml(formatDate(item.createdAt))}
            </small>

            <div class="notification-actions">
              <button class="notification-action-btn" type="button" data-notification-toggle-read="${escapeHtml(item.id)}">
                <i class="fa-solid ${readIcon}"></i>
                ${readLabel}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-notification-id]").forEach((itemEl) => {
      itemEl.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        const id = itemEl.dataset.notificationId;
        const link = itemEl.dataset.notificationLink;

        if (id) markRead(id);

        if (link) {
          window.location.href = link;
        }
      });
    });
  }

  function renderPrefsCard() {
    if (currentFile() !== "perfil.html") return;

    const main = document.querySelector(".main-content");
    if (!main) return;

    const oldCard = document.getElementById("notificationPrefsCard");
    if (oldCard) oldCard.remove();

    const prefs = loadPrefs();
    const card = document.createElement("section");

    card.id = "notificationPrefsCard";
    card.className = "notification-prefs-card panel notification-prefs-card-v2";

    card.innerHTML = `
      <div class="notification-prefs-header">
        <div>
          <p class="eyebrow">Preferencias</p>
          <h2>Notificaciones</h2>
          <p>Configurá qué querés recibir dentro del Classroom y qué quedará preparado para correo cuando conectemos el backend.</p>
        </div>
      </div>

      <div class="notification-prefs-sections">
        <section class="notification-pref-section">
          <div class="notification-pref-section-head">
            <i class="fa-solid fa-comments"></i>
            <div>
              <h3>Comunidad</h3>
              <p>Actividad interna de hilos, respuestas y estados.</p>
            </div>
          </div>

          <div class="notification-prefs-list">
            ${prefRow("bell", "Campanita interna", "Activa o desactiva las notificaciones dentro del Classroom.", prefs.bell)}
            ${prefRow("community", "Comunidad", "Recibir actividad general de la sección Comunidad.", prefs.community)}
            ${prefRow("communityNewPosts", "Nuevos hilos", "Avisar cuando se crea una consulta, aporte o recomendación.", prefs.communityNewPosts)}
            ${prefRow("communityReplies", "Respuestas en hilos", "Avisar cuando alguien responde un hilo.", prefs.communityReplies)}
            ${prefRow("communityStatus", "Hilos resueltos/reabiertos", "Avisar cuando un hilo cambia de estado.", prefs.communityStatus)}
          </div>
        </section>

        <section class="notification-pref-section">
          <div class="notification-pref-section-head">
            <i class="fa-solid fa-envelope"></i>
            <div>
              <h3>Correo</h3>
              <p>Preferencias preparadas para cuando conectemos envío real por backend.</p>
            </div>
          </div>

          <div class="notification-prefs-list">
            ${prefRow("emailCommunity", "Resumen o actividad de Comunidad", "Recibir por correo respuestas, menciones o actividad importante de Comunidad.", prefs.emailCommunity, "pendiente")}
            ${prefRow("emailAnnouncements", "Avisos oficiales", "Recibir por correo comunicados importantes del curso.", prefs.emailAnnouncements, "pendiente")}
            ${prefRow("newsletter", "Newsletter del curso", "Recibir resúmenes generales, novedades y recordatorios.", prefs.newsletter, "pendiente")}
          </div>
        </section>

        <section class="notification-pref-section">
          <div class="notification-pref-section-head">
            <i class="fa-solid fa-bullhorn"></i>
            <div>
              <h3>Novedades</h3>
              <p>Información general que puede aparecer como aviso o novedad dentro del Classroom.</p>
            </div>
          </div>

          <div class="notification-prefs-list">
            ${prefRow("announcements", "Avisos oficiales", "Fechas, habilitaciones, cambios importantes o comunicados del curso.", prefs.announcements)}
            ${prefRow("courseNews", "Siguientes cursos", "Novedades sobre nuevas cursadas, próximas aperturas o contenidos futuros.", prefs.courseNews)}
            ${prefRow("attendance", "Correcciones y estado académico", "Actualizaciones de asistencia, revisiones, recuperatorios o correcciones.", prefs.attendance)}
          </div>
        </section>
      </div>
    `;

    const profileGrid = document.querySelector(".profile-grid");
    if (profileGrid) {
      profileGrid.insertAdjacentElement("afterend", card);
    } else {
      main.appendChild(card);
    }

    card.querySelectorAll("[data-notification-pref]").forEach((input) => {
      input.addEventListener("change", () => {
        const current = loadPrefs();
        current[input.dataset.notificationPref] = input.checked;
        savePrefs(current);

        render();

        if (input.dataset.notificationPref !== "bell") {
          createNotification({
            type: "system",
            title: "Preferencias actualizadas",
            body: "Se guardó tu configuración de notificaciones en este navegador.",
            source: "preferences",
            respectPrefs: false,
          });
        }
      });
    });
  }

  function prefRow(key, title, description, checked, tag = "") {
    const tagHtml = tag ? `<span class="notification-pref-tag">${escapeHtml(tag)}</span>` : "";

    return `
      <label class="notification-pref-row">
        <span>
          <strong>${escapeHtml(title)} ${tagHtml}</strong>
          <p>${escapeHtml(description)}</p>
        </span>

        <input type="checkbox" data-notification-pref="${escapeHtml(key)}" ${checked ? "checked" : ""} />
      </label>
    `;
  }

  function scrollToPrefsFromHash() {
    if (window.location.hash !== "#notificationPrefsCard") return;

    setTimeout(() => {
      const card = document.getElementById("notificationPrefsCard");

      if (!card) return;

      card.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      card.classList.add("notification-prefs-highlight");

      setTimeout(() => {
        card.classList.remove("notification-prefs-highlight");
      }, 1600);
    }, 220);
  }


  /* === Delegated notification actions 20260621 === */
  function initDelegatedNotificationActions() {
    if (window.__classroomNotificationDelegatedActionsReady) return;
    window.__classroomNotificationDelegatedActionsReady = true;

    document.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-notification-delete]");
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();

        deleteNotification(deleteButton.dataset.notificationDelete);
        return;
      }

      const toggleButton = event.target.closest("[data-notification-toggle-read]");
      if (toggleButton) {
        event.preventDefault();
        event.stopPropagation();

        toggleRead(toggleButton.dataset.notificationToggleRead);
      }
    }, true);
  }


  function init() {
    initDelegatedNotificationActions();
    savePrefs(loadPrefs());
    ensureWidget();
    render();
    renderPrefsCard();
    scrollToPrefsFromHash();

    window.addEventListener("classroom:community-notification", (event) => {
      createNotification(event.detail || {});
    });

    window.addEventListener("storage", (event) => {
      if ([NOTIFICATIONS_KEY, PREFS_KEY].includes(event.key)) {
        render();
        renderPrefsCard();
      }
    });
  }

  window.ClassroomNotifications = {
    create: createNotification,
    render,
    markAllRead,
    toggleRead,
    deleteNotification,
    clearAll,
    seedDemo,
    loadItems,
    saveItems,
    loadPrefs,
    savePrefs,
  };

  document.addEventListener("DOMContentLoaded", init);
})();

/* === Notification Center Bell Render Bridge 20260621 === */
(function notificationCenterBellRenderBridge() {
  "use strict";

  const STORAGE_KEY = "andyazh-classroom-notifications-v2";

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

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "";

    try {
      return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function severityOf(item) {
    if (item.severity) return item.severity;

    if (item.type === "community") return "info";
    if (item.type === "announcement") return "warning";
    if (item.type === "academic") return "danger";

    return "neutral";
  }

  function iconOf(item) {
    const severity = severityOf(item);

    if (severity === "danger") return "fa-triangle-exclamation";
    if (severity === "warning") return "fa-bullhorn";
    if (severity === "info") return "fa-comments";

    return "fa-bell";
  }

  function visibleItems() {
    return loadItems()
      .filter((item) => !item.dismissedAt && !item.dismissed_at)
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
  }

  function findList() {
    return document.getElementById("notificationsList")
      || document.querySelector(".notifications-list")
      || document.querySelector("[data-notifications-list]");
  }

  function panelLooksEmpty(list) {
    const text = (list?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();

    return !list || text.includes("sin notificaciones") || text.length < 20;
  }

  function renderBridgeIfNeeded() {
    const list = findList();
    const items = visibleItems();

    if (!list || !items.length) return;
    if (!panelLooksEmpty(list)) return;

    list.innerHTML = items.map((item) => {
      const id = item.id;
      const link = item.link || item.link_url || "";
      const severity = severityOf(item);
      const unreadClass = item.read ? "" : "is-unread";
      const severityClass = `is-${severity}`;
      const readLabel = item.read ? "Marcar no leída" : "Marcar leída";
      const readIcon = item.read ? "fa-envelope" : "fa-envelope-open";

      return `
        <article class="notification-item ${unreadClass} ${severityClass}" data-notification-id="${escapeHtml(id)}" data-notification-link="${escapeHtml(link)}">
          <button class="notification-delete-btn" type="button" data-notification-delete="${escapeHtml(id)}" aria-label="Eliminar notificación" title="Eliminar notificación">
            <i class="fa-solid fa-xmark"></i>
          </button>

          <div class="notification-icon">
            <i class="fa-solid ${iconOf(item)}"></i>
          </div>

          <div class="notification-content">
            <strong>${escapeHtml(item.title || "Notificación")}</strong>
            <p>${escapeHtml(item.body || item.message || "")}</p>
            <small>
              ${escapeHtml(item.actor || "Classroom")} · ${escapeHtml(formatDate(item.createdAt || item.created_at))}
            </small>

            <div class="notification-actions">
              <button class="notification-action-btn" type="button" data-notification-toggle-read="${escapeHtml(id)}">
                <i class="fa-solid ${readIcon}"></i>
                ${readLabel}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function scheduleBridgeRender() {
    setTimeout(renderBridgeIfNeeded, 30);
    setTimeout(renderBridgeIfNeeded, 120);
    setTimeout(renderBridgeIfNeeded, 300);
  }

  document.addEventListener("click", (event) => {
    if (
      event.target.closest("#notificationsToggle")
      || event.target.closest(".notifications-toggle")
      || event.target.closest(".notifications-widget")
      || event.target.closest(".theme-toggle")
    ) {
      scheduleBridgeRender();
    }
  }, true);

  window.addEventListener("classroom:notifications-updated", scheduleBridgeRender);

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) scheduleBridgeRender();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleBridgeRender);
  } else {
    scheduleBridgeRender();
  }
})();

/* === Unified Bell Renderer 20260621 === */
(function unifiedBellRenderer() {
  "use strict";

  const STORAGE_KEY = "andyazh-classroom-notifications-v2";

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
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
    if (!value) return "";

    try {
      return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function normalizeType(item) {
    const raw = String(item.type || item.category || "system").toLowerCase();

    if (raw.includes("community") || raw.includes("comunidad")) return "community";
    if (raw.includes("reply") || raw.includes("post") || raw.includes("thread")) return "community";

    if (raw.includes("academic") || raw.includes("exam") || raw.includes("nota") || raw.includes("recuperatorio")) return "academic";
    if (raw.includes("announcement") || raw.includes("aviso") || raw.includes("news")) return "announcement";
    if (raw.includes("data_change") || raw.includes("admin_data_change")) return "academic";

    return raw || "system";
  }

  function severityOf(item) {
    const explicit = String(item.severity || "").toLowerCase();

    if (explicit === "danger" || explicit === "warning" || explicit === "info" || explicit === "neutral") {
      return explicit;
    }

    const type = normalizeType(item);

    if (type === "community") return "info";
    if (type === "announcement") return "warning";
    if (type === "academic") return "danger";

    return "neutral";
  }

  function iconOf(item) {
    const type = normalizeType(item);
    const severity = severityOf(item);

    if (type === "community") return "fa-comments";
    if (severity === "danger") return "fa-triangle-exclamation";
    if (severity === "warning") return "fa-bullhorn";
    if (severity === "info") return "fa-comments";

    return "fa-bell";
  }

  function getCreatedAt(item) {
    return item.createdAt || item.created_at || item.timestamp || item.date || item.updatedAt || item.updated_at || "";
  }

  function getLink(item) {
    return item.link || item.link_url || item.url || "";
  }

  function getBody(item) {
    return item.body || item.message || item.content || item.text || "";
  }

  function isDismissed(item) {
    return Boolean(
      item.dismissedAt ||
      item.dismissed_at ||
      item.deletedAt ||
      item.deleted_at ||
      item.hidden
    );
  }

  function normalizeItem(item, index) {
    const id = item.id || item.notification_id || `notification-${index}-${getCreatedAt(item) || Date.now()}`;

    return {
      ...item,
      id: String(id),
      type: normalizeType(item),
      severity: severityOf(item),
      title: item.title || item.subject || "Notificación",
      body: getBody(item),
      link: getLink(item),
      createdAt: getCreatedAt(item),
      actor: item.actor || item.created_by || item.author || "Classroom",
      read: Boolean(item.read || item.read_at || item.readAt),
    };
  }

  function loadItems() {
    const base = safeJson(localStorage.getItem(STORAGE_KEY), []);

    if (!Array.isArray(base)) return [];

    const seen = new Set();

    return base
      .map(normalizeItem)
      .filter((item) => {
        if (!item.id || isDismissed(item)) return false;
        if (seen.has(item.id)) return false;

        seen.add(item.id);
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  function saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("classroom:notifications-updated", {
      detail: { items },
    }));
  }

  function findList() {
    return document.getElementById("notificationsList")
      || document.querySelector(".notifications-list")
      || document.querySelector("[data-notifications-list]");
  }

  function findDot() {
    return document.getElementById("notificationsDot")
      || document.querySelector(".notifications-dot")
      || document.querySelector("[data-notifications-dot]");
  }

  function updateDot(items) {
    const dot = findDot();
    if (!dot) return;

    const unread = items.filter((item) => !item.read).length;

    dot.textContent = unread ? String(unread) : "";
    dot.hidden = unread <= 0;
    dot.classList.toggle("is-visible", unread > 0);
  }

  function renderUnifiedBell() {
    const list = findList();
    if (!list) return;

    const items = loadItems();

    updateDot(items);

    if (!items.length) {
      list.innerHTML = `
        <div class="notifications-empty">
          <i class="fa-regular fa-bell"></i>
          <strong>Sin notificaciones</strong>
          <p>Cuando haya respuestas, hilos o avisos, van a aparecer acá.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map((item) => {
      const unreadClass = item.read ? "" : "is-unread";
      const severityClass = `is-${item.severity}`;
      const readLabel = item.read ? "Marcar no leída" : "Marcar leída";
      const readIcon = item.read ? "fa-envelope" : "fa-envelope-open";

      return `
        <article class="notification-item ${unreadClass} ${severityClass}" data-notification-id="${escapeHtml(item.id)}" data-notification-link="${escapeHtml(item.link)}">
          <button class="notification-delete-btn" type="button" data-notification-delete="${escapeHtml(item.id)}" aria-label="Eliminar notificación" title="Eliminar notificación">
            <i class="fa-solid fa-xmark"></i>
          </button>

          <div class="notification-icon">
            <i class="fa-solid ${iconOf(item)}"></i>
          </div>

          <div class="notification-content">
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.body)}</p>
            <small>
              ${escapeHtml(item.actor || "Classroom")} · ${escapeHtml(formatDate(item.createdAt))}
            </small>

            <div class="notification-actions">
              <button class="notification-action-btn" type="button" data-notification-toggle-read="${escapeHtml(item.id)}">
                <i class="fa-solid ${readIcon}"></i>
                ${readLabel}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function scheduleRender() {
    setTimeout(renderUnifiedBell, 20);
    setTimeout(renderUnifiedBell, 120);
    setTimeout(renderUnifiedBell, 300);
  }

  document.addEventListener("click", (event) => {
    if (
      event.target.closest("#notificationsToggle") ||
      event.target.closest(".notifications-toggle") ||
      event.target.closest(".notifications-widget") ||
      event.target.closest(".notifications-panel")
    ) {
      scheduleRender();
    }
  }, true);

  window.addEventListener("classroom:notifications-updated", scheduleRender);

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) scheduleRender();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleRender);
  } else {
    scheduleRender();
  }

  window.ClassroomUnifiedBellRenderer = {
    render: renderUnifiedBell,
    schedule: scheduleRender,
  };
})();
