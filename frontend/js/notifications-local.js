
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
    boletín: false,
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
      
      var severityClass = "is-" + String((item && item.severity) || (typeof severityOf === "function" ? severityOf(item) : "") || (typeof normalizeSeverity === "function" ? normalizeSeverity(item) : "") || "neutral").replace(/^is-/, "");
if (item.id !== id) return item;
      return { ...item, read: !item.read };
    });

    saveItems(items);
    render();
  }

  function markRead(id) {
    const items = loadItems().map((item) => {
      
      var severityClass = "is-" + String((item && item.severity) || (typeof severityOf === "function" ? severityOf(item) : "") || (typeof normalizeSeverity === "function" ? normalizeSeverity(item) : "") || "neutral").replace(/^is-/, "");
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
      
      var severityClass = "is-" + String((item && item.severity) || (typeof severityOf === "function" ? severityOf(item) : "") || (typeof normalizeSeverity === "function" ? normalizeSeverity(item) : "") || "neutral").replace(/^is-/, "");
const icon = TYPE_ICONS[item.type] || TYPE_ICONS.system;
      const unreadClass = item.read ? "" : "unread";

      const readLabel = item.read ? "Marcar no leída" : "Marcar leída";
      const readIcon = item.read ? "fa-envelope" : "fa-envelope-open";

      return `
        <article class="notification-item ${unreadClass} ${(() => { const __severity = (item && item.severity) || (typeof severityOf === "function" ? severityOf(item) : "") || (typeof normalizeSeverity === "function" ? normalizeSeverity(item) : "") || "neutral"; const __clean = String(__severity || "neutral").replace(/^is-/, ""); return "is-" + __clean; })()}" data-notification-id="${escapeHtml(item.id)}" data-notification-link="${escapeHtml(item.link || "")}">
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
            ${prefRow("boletín", "Boletín del curso", "Recibir resúmenes generales, novedades y recordatorios.", prefs.boletín, "pendiente")}
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
      
      var severityClass = "is-" + String((item && item.severity) || (typeof severityOf === "function" ? severityOf(item) : "") || (typeof normalizeSeverity === "function" ? normalizeSeverity(item) : "") || "neutral").replace(/^is-/, "");
const id = item.id;
      const link = item.link || item.link_url || "";
      const severity = severityOf(item);
      const unreadClass = item.read ? "" : "is-unread";
      var severityClass = `is-${severity}`;
      const readLabel = item.read ? "Marcar no leída" : "Marcar leída";
      const readIcon = item.read ? "fa-envelope" : "fa-envelope-open";

      return `
        <article class="notification-item ${unreadClass} ${(() => { const __severity = (item && item.severity) || (typeof severityOf === "function" ? severityOf(item) : "") || (typeof normalizeSeverity === "function" ? normalizeSeverity(item) : "") || "neutral"; const __clean = String(__severity || "neutral").replace(/^is-/, ""); return "is-" + __clean; })()}" data-notification-id="${escapeHtml(id)}" data-notification-link="${escapeHtml(link)}">
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
      
      var severityClass = "is-" + String((item && item.severity) || (typeof severityOf === "function" ? severityOf(item) : "") || (typeof normalizeSeverity === "function" ? normalizeSeverity(item) : "") || "neutral").replace(/^is-/, "");
const unreadClass = item.read ? "" : "is-unread";
      var severityClass = `is-${item.severity}`;
      const readLabel = item.read ? "Marcar no leída" : "Marcar leída";
      const readIcon = item.read ? "fa-envelope" : "fa-envelope-open";

      return `
        <article class="notification-item ${unreadClass} ${(() => { const __severity = (item && item.severity) || (typeof severityOf === "function" ? severityOf(item) : "") || (typeof normalizeSeverity === "function" ? normalizeSeverity(item) : "") || "neutral"; const __clean = String(__severity || "neutral").replace(/^is-/, ""); return "is-" + __clean; })()}" data-notification-id="${escapeHtml(item.id)}" data-notification-link="${escapeHtml(item.link)}">
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

/* === Supabase Backend Notifications Bridge 20260621 === */
(function supabaseBackendNotificationsBridge() {
  "use strict";

  const SESSION_KEY = "andyazh-classroom-session";
  const STORAGE_KEY = "andyazh-classroom-notifications-v2";

  function getApiBase() {
    const host = window.location.hostname;

    if (host === "localhost" || host === "127.0.0.1" || host === "") {
      return "http://127.0.0.1:8000";
    }

    return "https://api.andyazhtec.com";
  }

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  }

  function loadSession() {
    return safeJson(localStorage.getItem(SESSION_KEY), {});
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function loadLocalItems() {
    const items = safeJson(localStorage.getItem(STORAGE_KEY), []);
    return Array.isArray(items) ? items : [];
  }

  function saveLocalItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("classroom:notifications-updated", {
      detail: { items, source: "backend-sync" },
    }));
  }

  function getSessionToken(session) {
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

  function normalizeRoleForFrontend(role) {
    const raw = String(role || "").trim().toLowerCase();

    if (raw === "docente") return "teacher";
    if (raw === "classroom_moderator") return "moderator";
    if (raw === "alumno") return "student";

    return role || "";
  }

  function normalizeRoleForBackend(role) {
    const raw = String(role || "").trim().toLowerCase();

    if (raw === "teacher") return "docente";
    if (raw === "moderator") return "classroom_moderator";
    if (raw === "student") return "alumno";

    return role || "";
  }

  async function ensureBackendToken() {
    const session = loadSession();
    const existingToken = getSessionToken(session);

    if (existingToken) return existingToken;

    const dni = String(session.dni || session?.alumno?.dni || "").trim();
    const twitch = String(session.twitch || session?.alumno?.twitch || session?.alumno?.twitch_username || "").trim();

    if (!dni || !twitch) {
      throw new Error("La sesión no tiene DNI/Twitch para pedir token.");
    }

    const response = await fetch(`${getApiBase()}/api/classroom/student-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dni, twitch }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.access_token) {
      throw new Error(data.detail || "No se pudo obtener token de Classroom.");
    }

    const updatedSession = {
      ...session,
      access_token: data.access_token,
      token_type: data.token_type || "bearer",
      backendRole: data.role || session.backendRole || normalizeRoleForBackend(session.role),
      role: session.role || normalizeRoleForFrontend(data.role),
      roleLabel: session.roleLabel || data.roleLabel || data.role_label || "",
      exampro: {
        ...(session.exampro && typeof session.exampro === "object" ? session.exampro : {}),
        access_token: data.access_token,
        token_type: data.token_type || "bearer",
        role: data.role,
      },
    };

    saveSession(updatedSession);

    return data.access_token;
  }

  function getNotificationBody(item) {
    return item.body || item.description || item.message || item.content || item.text || "";
  }

  function getNotificationLink(item) {
    return item.link || item.link_url || item.url || "";
  }

  function normalizeBackendNotification(item) {
    const createdAt = item.createdAt || item.created_at || item.created_at_iso || item.updatedAt || item.updated_at || new Date().toISOString();

    return {
      id: String(item.id),
      title: item.title || "Notificación",
      body: getNotificationBody(item),
      description: getNotificationBody(item),

      type: item.type || "system",
      severity: item.severity || "neutral",

      link: getNotificationLink(item),
      link_url: getNotificationLink(item),

      audience: item.audience || item.audience_type || "all",
      audience_type: item.audience_type || item.audience || "all",
      course: item.course || "",

      actor: item.actor || item.created_by_name || "Classroom",

      read: Boolean(item.read || item.read_at || item.readAt),
      read_at: item.read_at || item.readAt || null,
      dismissed_at: item.dismissed_at || item.dismissedAt || null,

      createdAt,
      created_at: createdAt,
      updatedAt: item.updatedAt || item.updated_at || createdAt,
      updated_at: item.updated_at || item.updatedAt || createdAt,

      source: "supabase",
      backendSyncedAt: new Date().toISOString(),
    };
  }

  function mergeBackendItems(backendItems) {
    const normalizedBackend = backendItems.map(normalizeBackendNotification);
    const backendIds = new Set(normalizedBackend.map((item) => String(item.id)));

    const localOnly = loadLocalItems().filter((item) => {
      if (!item || !item.id) return false;

      const isBackend = item.source === "supabase" || backendIds.has(String(item.id));
      const isDismissed = item.dismissedAt || item.dismissed_at || item.dismissed_at;

      return !isBackend && !isDismissed;
    });

    const merged = [...normalizedBackend, ...localOnly]
      .filter((item) => !item.dismissed_at && !item.dismissedAt)
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

    saveLocalItems(merged);

    return merged;
  }

  async function apiFetch(path, options = {}) {
    const token = await ensureBackendToken();

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

  async function syncNotificationsFromBackend() {
    const data = await apiFetch("/api/classroom/notifications/me");

    const items = Array.isArray(data.items) ? data.items : [];
    const merged = mergeBackendItems(items);

    if (window.ClassroomUnifiedBellRenderer?.schedule) {
      window.ClassroomUnifiedBellRenderer.schedule();
    }

    return {
      ok: true,
      items: merged,
      unread: data.unread ?? merged.filter((item) => !item.read).length,
    };
  }

  async function markBackendNotificationRead(id) {
    await apiFetch(`/api/classroom/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    });

    await syncNotificationsFromBackend();
  }

  async function markBackendNotificationUnread(id) {
    await apiFetch(`/api/classroom/notifications/${encodeURIComponent(id)}/unread`, {
      method: "POST",
    });

    await syncNotificationsFromBackend();
  }

  async function dismissBackendNotification(id) {
    await apiFetch(`/api/classroom/notifications/${encodeURIComponent(id)}/dismiss`, {
      method: "POST",
    });

    await syncNotificationsFromBackend();
  }

  function isSupabaseNotification(id) {
    const item = loadLocalItems().find((entry) => String(entry.id) === String(id));
    return item?.source === "supabase";
  }

  document.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-notification-delete]");
    const readButton = event.target.closest("[data-notification-toggle-read]");

    if (deleteButton) {
      const id = deleteButton.getAttribute("data-notification-delete");

      if (id && isSupabaseNotification(id)) {
        event.preventDefault();
        event.stopPropagation();

        dismissBackendNotification(id).catch((error) => {
          console.warn("[Classroom] No se pudo eliminar notificación backend:", error);
        });
      }

      return;
    }

    if (readButton) {
      const id = readButton.getAttribute("data-notification-toggle-read");

      if (id && isSupabaseNotification(id)) {
        event.preventDefault();
        event.stopPropagation();

        const item = loadLocalItems().find((entry) => String(entry.id) === String(id));

        if (item?.read) {
          markBackendNotificationUnread(id).catch((error) => {
            console.warn("[Classroom] No se pudo marcar no leída en backend:", error);
          });
        } else {
          markBackendNotificationRead(id).catch((error) => {
            console.warn("[Classroom] No se pudo marcar leída en backend:", error);
          });
        }
      }
    }
  }, true);

  function scheduleInitialSync() {
    setTimeout(() => {
      syncNotificationsFromBackend().catch((error) => {
        console.warn("[Classroom] Notificaciones backend no disponibles, usando fallback localStorage:", error);
      });
    }, 500);
  }

  window.ClassroomBackendNotifications = {
    getApiBase,
    ensureBackendToken,
    sync: syncNotificationsFromBackend,
    markRead: markBackendNotificationRead,
    markUnread: markBackendNotificationUnread,
    dismiss: dismissBackendNotification,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleInitialSync);
  } else {
    scheduleInitialSync();
  }
})();

/* === Bell Badge Auto Refresh 20260621 === */
(function bellBadgeAutoRefresh() {
  "use strict";

  const STORAGE_KEY = "andyazh-classroom-notifications-v2";
  const POLL_MS = 20000;

  let pollTimer = null;
  let syncInProgress = false;

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  }

  function loadItems() {
    const items = safeJson(localStorage.getItem(STORAGE_KEY), []);
    return Array.isArray(items) ? items : [];
  }

  function isDismissed(item) {
    return Boolean(
      item?.dismissedAt ||
      item?.dismissed_at ||
      item?.deletedAt ||
      item?.deleted_at ||
      item?.hidden
    );
  }

  function isUnread(item) {
    return !Boolean(item?.read || item?.read_at || item?.readAt);
  }

  function unreadCount() {
    return loadItems().filter((item) => item && !isDismissed(item) && isUnread(item)).length;
  }

  function findBadgeTargets() {
    return [
      document.getElementById("notificationsDot"),
      document.getElementById("notificationDot"),
      document.getElementById("notificationsBadge"),
      document.querySelector(".notifications-dot"),
      document.querySelector(".notification-dot"),
      document.querySelector(".notifications-badge"),
      document.querySelector("[data-notifications-dot]"),
      document.querySelector("[data-notifications-badge]"),
    ].filter(Boolean);
  }

  function updateBellBadge() {
    const count = unreadCount();
    const targets = findBadgeTargets();

    targets.forEach((dot) => {
      dot.textContent = count > 0 ? String(count) : "";
      dot.hidden = count <= 0;
      dot.classList.toggle("is-visible", count > 0);
      dot.classList.toggle("has-unread", count > 0);
      dot.setAttribute("aria-label", count > 0 ? `${count} notificaciones sin leer` : "Sin notificaciones nuevas");
    });

    const bellButtons = [
      document.getElementById("notificationsToggle"),
      document.querySelector(".notifications-toggle"),
      document.querySelector("[data-notifications-toggle]"),
    ].filter(Boolean);

    bellButtons.forEach((button) => {
      button.classList.toggle("has-unread", count > 0);
      button.setAttribute("data-unread-count", String(count));
    });

    return count;
  }

  async function syncBackendQuietly() {
    if (syncInProgress) return;

    const api = window.ClassroomBackendNotifications;

    if (!api || typeof api.sync !== "function") {
      updateBellBadge();
      return;
    }

    syncInProgress = true;

    try {
      await api.sync();
      updateBellBadge();

      if (window.ClassroomUnifiedBellRenderer?.schedule) {
        window.ClassroomUnifiedBellRenderer.schedule();
      }
    } catch (error) {
      console.warn("[Classroom] No se pudo refrescar badge desde backend:", error);
      updateBellBadge();
    } finally {
      syncInProgress = false;
    }
  }

  function startPolling() {
    if (pollTimer) return;

    pollTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        syncBackendQuietly();
      }
    }, POLL_MS);
  }

  function wireEvents() {
    window.addEventListener("classroom:notifications-updated", () => {
      setTimeout(updateBellBadge, 10);
      setTimeout(updateBellBadge, 120);
    });

    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY) {
        updateBellBadge();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        syncBackendQuietly();
      }
    });

    window.addEventListener("focus", () => {
      syncBackendQuietly();
    });

    document.addEventListener("click", (event) => {
      if (
        event.target.closest("#notificationsToggle") ||
        event.target.closest(".notifications-toggle") ||
        event.target.closest("[data-notifications-toggle]") ||
        event.target.closest("[data-notification-delete]") ||
        event.target.closest("[data-notification-toggle-read]")
      ) {
        setTimeout(updateBellBadge, 80);
        setTimeout(updateBellBadge, 300);
      }
    }, true);
  }

  function init() {
    wireEvents();
    updateBellBadge();

    setTimeout(syncBackendQuietly, 800);
    setTimeout(updateBellBadge, 1400);

    startPolling();
  }

  window.ClassroomBellBadgeAutoRefresh = {
    update: updateBellBadge,
    sync: syncBackendQuietly,
    unreadCount,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* === Notifications Realtime WebSocket Bridge 20260621 === */
(function notificationsRealtimeWebSocketBridge() {
  "use strict";

  let socket = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let reconnectDelay = 1500;
  let manuallyClosed = false;

  function getBackendApi() {
    return window.ClassroomBackendNotifications || null;
  }

  function apiBaseToWsUrl(apiBase) {
    return String(apiBase || "")
      .replace(/^https:/i, "wss:")
      .replace(/^http:/i, "ws:");
  }

  async function getToken() {
    const api = getBackendApi();

    if (!api || typeof api.ensureBackendToken !== "function") {
      throw new Error("ClassroomBackendNotifications no está disponible todavía.");
    }

    return api.ensureBackendToken();
  }

  function getWsUrl(token) {
    const api = getBackendApi();
    const apiBase = api?.getApiBase ? api.getApiBase() : "http://127.0.0.1:8000";

    return `${apiBaseToWsUrl(apiBase)}/api/classroom/notifications/ws?token=${encodeURIComponent(token)}`;
  }

  function clearTimers() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function scheduleReconnect() {
    if (manuallyClosed) return;
    if (reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);

    reconnectDelay = Math.min(reconnectDelay * 1.6, 15000);
  }

  async function syncNow(reason) {
    const api = getBackendApi();

    if (api?.sync) {
      await api.sync().catch((error) => {
        console.warn("[Classroom WS] No se pudo sincronizar tras evento realtime:", reason, error);
      });
    }

    if (window.ClassroomBellBadgeAutoRefresh?.update) {
      window.ClassroomBellBadgeAutoRefresh.update();
    }

    if (window.ClassroomUnifiedBellRenderer?.schedule) {
      window.ClassroomUnifiedBellRenderer.schedule();
    }

    if (window.ClassroomNotificationCenterBackend?.load) {
      const isCenterPage = /centro-notificaciones\.html/i.test(window.location.pathname);
      if (isCenterPage) {
        window.ClassroomNotificationCenterBackend.load().catch(() => {});
      }
    }
  }

  async function connect() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const token = await getToken();
      const wsUrl = getWsUrl(token);

      manuallyClosed = false;
      socket = new WebSocket(wsUrl);

      socket.addEventListener("open", () => {
        reconnectDelay = 1500;
        clearTimers();

        heartbeatTimer = setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send("ping");
          }
        }, 25000);

        document.documentElement.classList.add("notifications-ws-ready");
        syncNow("ws-open");
      });

      socket.addEventListener("message", (event) => {
        let data = {};

        try {
          data = JSON.parse(event.data);
        } catch {
          data = { type: String(event.data || "") };
        }

        if (data.type === "notifications_ws_ready" || data.type === "pong") {
          return;
        }

        if (data.type === "notifications_changed") {
          syncNow(data.action || "notifications_changed");
        }
      });

      socket.addEventListener("close", () => {
        clearTimers();
        document.documentElement.classList.remove("notifications-ws-ready");
        scheduleReconnect();
      });

      socket.addEventListener("error", () => {
        clearTimers();
        document.documentElement.classList.remove("notifications-ws-ready");

        try {
          socket.close();
        } catch {}
      });
    } catch (error) {
      console.warn("[Classroom WS] No se pudo conectar realtime:", error);
      scheduleReconnect();
    }
  }

  function disconnect() {
    manuallyClosed = true;
    clearTimers();

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (socket) {
      try {
        socket.close();
      } catch {}
    }

    socket = null;
  }

  function status() {
    return {
      readyState: socket ? socket.readyState : null,
      connected: Boolean(socket && socket.readyState === WebSocket.OPEN),
      reconnectDelay,
    };
  }

  function init() {
    setTimeout(connect, 1200);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        connect();
      }
    });

    window.addEventListener("focus", () => {
      connect();
    });
  }

  window.ClassroomNotificationsRealtime = {
    connect,
    disconnect,
    status,
    syncNow,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* === Supabase Notification Dismiss Tombstone Fix 20260622 === */
(function supabaseNotificationDismissTombstoneFix() {
  "use strict";

  const STORAGE_KEY = "andyazh-classroom-notifications-v2";
  const TOMBSTONE_KEY = "andyazh-classroom-notification-dismissed-supabase-v1";

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  }

  function loadItems() {
    const items = safeJson(localStorage.getItem(STORAGE_KEY), []);
    return Array.isArray(items) ? items : [];
  }

  function saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("classroom:notifications-updated", {
      detail: { items, source: "dismiss-tombstone-fix" },
    }));
  }

  function loadTombstones() {
    const data = safeJson(localStorage.getItem(TOMBSTONE_KEY), {});
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  }

  function saveTombstones(data) {
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(data || {}));
  }

  function addTombstone(id) {
    if (!id) return;

    const data = loadTombstones();
    data[String(id)] = new Date().toISOString();
    saveTombstones(data);
  }

  function isTombstoned(id) {
    if (!id) return false;
    return Boolean(loadTombstones()[String(id)]);
  }

  function isSupabaseItem(id) {
    const item = loadItems().find((entry) => String(entry.id) === String(id));

    return Boolean(
      item &&
      (
        item.source === "supabase" ||
        item.backendSyncedAt ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(item.id))
      )
    );
  }

  function hideLocally(id) {
    const now = new Date().toISOString();

    const items = loadItems().map((item) => {
      
      var severityClass = "is-" + String((item && item.severity) || (typeof severityOf === "function" ? severityOf(item) : "") || (typeof normalizeSeverity === "function" ? normalizeSeverity(item) : "") || "neutral").replace(/^is-/, "");
if (String(item.id) !== String(id)) return item;

      return {
        ...item,
        dismissed_at: item.dismissed_at || now,
        dismissedAt: item.dismissedAt || now,
        hidden: true,
      };
    }).filter((item) => String(item.id) !== String(id));

    saveItems(items);

    if (window.ClassroomBellBadgeAutoRefresh?.update) {
      window.ClassroomBellBadgeAutoRefresh.update();
    }

    if (window.ClassroomUnifiedBellRenderer?.schedule) {
      window.ClassroomUnifiedBellRenderer.schedule();
    }
  }

  async function dismissBackend(id) {
    if (window.ClassroomBackendNotifications?.dismiss) {
      await window.ClassroomBackendNotifications.dismiss(id);
      return;
    }

    throw new Error("ClassroomBackendNotifications.dismiss no está disponible.");
  }

  function patchMergeFilter() {
    const originalSync = window.ClassroomBackendNotifications?.sync;

    if (!originalSync || originalSync.__dismissTombstonePatched) return;

    const patchedSync = async function patchedDismissTombstoneSync(...args) {
      const result = await originalSync.apply(this, args);

      const tombstones = loadTombstones();
      const items = loadItems().filter((item) => !tombstones[String(item.id)]);

      saveItems(items);

      if (window.ClassroomBellBadgeAutoRefresh?.update) {
        window.ClassroomBellBadgeAutoRefresh.update();
      }

      if (window.ClassroomUnifiedBellRenderer?.schedule) {
        window.ClassroomUnifiedBellRenderer.schedule();
      }

      return {
        ...(result || {}),
        items,
        unread: items.filter((item) => !(item.read || item.read_at || item.readAt)).length,
      };
    };

    patchedSync.__dismissTombstonePatched = true;
    window.ClassroomBackendNotifications.sync = patchedSync;
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-notification-delete]");
    if (!button) return;

    const id = button.getAttribute("data-notification-delete");
    if (!id || !isSupabaseItem(id)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    addTombstone(id);
    hideLocally(id);

    dismissBackend(id)
      .then(() => {
        setTimeout(() => {
          if (window.ClassroomBackendNotifications?.sync) {
            window.ClassroomBackendNotifications.sync().catch(() => {});
          }
        }, 250);
      })
      .catch((error) => {
        console.warn("[Classroom] No se pudo confirmar dismiss backend, queda oculto localmente:", error);
      });
  }, true);

  window.ClassroomNotificationDismissTombstones = {
    add: addTombstone,
    has: isTombstoned,
    all: loadTombstones,
    clear() {
      localStorage.removeItem(TOMBSTONE_KEY);
      if (window.ClassroomBackendNotifications?.sync) {
        window.ClassroomBackendNotifications.sync().catch(() => {});
      }
    },
  };

  function init() {
    patchMergeFilter();

    setTimeout(patchMergeFilter, 500);
    setTimeout(patchMergeFilter, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* === Notification Link Stable Button And Online Badge Fix 20260622 === */
(function notificationLinkStableButtonAndOnlineBadgeFix() {
  "use strict";

  const STORAGE_KEY = "andyazh-classroom-notifications-v2";

  let enhanceScheduled = false;

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  }

  function loadItems() {
    const items = safeJson(localStorage.getItem(STORAGE_KEY), []);
    return Array.isArray(items) ? items : [];
  }

  function getLink(item) {
    return item?.link || item?.link_url || item?.url || "";
  }

  function setOnlineBadge() {
    const candidates = Array.from(document.querySelectorAll(
      ".notifications-panel span, .notifications-panel .badge, .notifications-panel [class*='badge'], .notifications-panel [class*='pill'], .notifications-panel [class*='tag']"
    ));

    candidates.forEach((el) => {
      const text = (el.textContent || "").trim().toLowerCase();

      if (
        text === "local v2" ||
        text === "local" ||
        text.includes("local v2")
      ) {
        el.textContent = "ONLINE";
        el.title = "Notificaciones sincronizadas con Supabase";
        el.classList.add("notification-online-badge");
      }
    });
  }

  function removeDuplicateLinkButtons(article) {
    const buttons = Array.from(article.querySelectorAll("[data-notification-open-link]"));

    if (buttons.length <= 1) return;

    buttons.slice(1).forEach((btn) => btn.remove());
  }

  function enhanceOneArticle(article) {
    if (!article) return;

    const id = article.getAttribute("data-notification-id");
    if (!id) return;

    const item = loadItems().find((entry) => String(entry.id) === String(id));
    const link = getLink(item) || article.getAttribute("data-notification-link") || "";

    removeDuplicateLinkButtons(article);

    if (!link) return;

    article.setAttribute("data-notification-link", link);

    const existing = article.querySelector("[data-notification-open-link]");
    if (existing) {
      existing.setAttribute("data-notification-open-link", id);
      existing.classList.add("notification-link-btn");
      existing.hidden = false;
      return;
    }

    const actions =
      article.querySelector(".notification-actions") ||
      article.querySelector(".notification-content") ||
      article;

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "notification-action-btn notification-link-btn";
    openButton.setAttribute("data-notification-open-link", id);
    openButton.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir link';

    actions.appendChild(openButton);
  }

  function enhanceStableLinks() {
    document
      .querySelectorAll(".notification-item[data-notification-id], [data-notification-id].notification-item")
      .forEach(enhanceOneArticle);

    setOnlineBadge();
  }

  function scheduleEnhance() {
    if (enhanceScheduled) return;

    enhanceScheduled = true;

    requestAnimationFrame(() => {
      enhanceScheduled = false;
      enhanceStableLinks();
    });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-notification-open-link]");

    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const article = button.closest("[data-notification-id]");
    const id = button.getAttribute("data-notification-open-link") || article?.getAttribute("data-notification-id") || "";
    const item = loadItems().find((entry) => String(entry.id) === String(id));
    const link = getLink(item) || article?.getAttribute("data-notification-link") || "";

    if (!link) {
      alert("Esta notificación no tiene link cargado.");
      return;
    }

    window.open(link, "_blank", "noopener,noreferrer");
  }, true);

  window.addEventListener("classroom:notifications-updated", () => {
    setTimeout(scheduleEnhance, 80);
  });

  document.addEventListener("click", (event) => {
    if (
      event.target.closest("#notificationsToggle") ||
      event.target.closest(".notifications-toggle") ||
      event.target.closest("[data-notifications-toggle]") ||
      event.target.closest(".notifications-panel")
    ) {
      setTimeout(scheduleEnhance, 80);
    }
  }, true);

  const observer = new MutationObserver(() => {
    scheduleEnhance();
  });

  function initObserver() {
    const panel =
      document.querySelector(".notifications-panel") ||
      document.querySelector("#notificationsPanel") ||
      document.body;

    observer.observe(panel, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function killOldIntervalJitter() {
    // Neutraliza el efecto visual de reinyecciones anteriores:
    // si hay varios botones, queda uno solo y estable.
    setTimeout(scheduleEnhance, 200);
    setTimeout(scheduleEnhance, 700);
    setTimeout(scheduleEnhance, 1500);
  }

  function init() {
    initObserver();
    scheduleEnhance();
    killOldIntervalJitter();
  }

  window.ClassroomNotificationStableLinks = {
    enhance: enhanceStableLinks,
    badge: setOnlineBadge,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* === Moderator Staff Token Refresh Fix 20260622 === */
(function moderatorStaffTokenRefreshFix() {
  "use strict";

  const SESSION_KEY = "andyazh-classroom-session";

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  }

  function loadSession() {
    return safeJson(localStorage.getItem(SESSION_KEY), {});
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session || {}));
  }

  function getApiBase() {
    if (window.ClassroomBackendNotifications?.getApiBase) {
      return window.ClassroomBackendNotifications.getApiBase();
    }

    const host = window.location.hostname;

    if (host === "localhost" || host === "127.0.0.1" || host === "") {
      return "http://127.0.0.1:8000";
    }

    return "https://api.andyazhtec.com";
  }

  function isModeratorSession(session) {
    const role = String(session?.role || "").toLowerCase();
    const backendRole = String(session?.backendRole || session?.exampro?.role || "").toLowerCase();
    const provider = String(session?.provider || "").toLowerCase();

    return (
      role === "moderator" ||
      role === "classroom_moderator" ||
      backendRole === "classroom_moderator" ||
      provider.includes("moderator")
    );
  }

  function isTeacherSession(session) {
    const role = String(session?.role || "").toLowerCase();
    const backendRole = String(session?.backendRole || session?.exampro?.role || "").toLowerCase();

    return role === "teacher" || role === "docente" || backendRole === "docente";
  }

  async function requestModeratorToken(session) {
    const dni = String(session?.dni || session?.alumno?.dni || "").trim();
    const twitch = String(session?.twitch || session?.alumno?.twitch || session?.alumno?.twitch_username || "").trim();

    if (!dni || !twitch) {
      throw new Error("La sesión de moderador no tiene DNI/Twitch.");
    }

    const response = await fetch(`${getApiBase()}/api/classroom/moderator-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dni, twitch }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.access_token) {
      throw new Error(data.detail || "No se pudo obtener token staff de moderador.");
    }

    const updated = {
      ...session,
      role: "moderator",
      roleLabel: "Moderador",
      backendRole: "classroom_moderator",
      access_token: data.access_token,
      token_type: data.token_type || "bearer",
      provider: "exampro-moderator-login",
      exampro: {
        ...(session.exampro && typeof session.exampro === "object" ? session.exampro : {}),
        access_token: data.access_token,
        token_type: data.token_type || "bearer",
        role: "classroom_moderator",
      },
    };

    saveSession(updated);

    return data.access_token;
  }

  function patchBackendEnsureToken() {
    const api = window.ClassroomBackendNotifications;

    if (!api || typeof api.ensureBackendToken !== "function" || api.ensureBackendToken.__moderatorStaffPatched) {
      return false;
    }

    const originalEnsureBackendToken = api.ensureBackendToken.bind(api);

    const patched = async function patchedModeratorAwareEnsureBackendToken(...args) {
      const session = loadSession();

      // Docente usa el flujo normal.
      if (isTeacherSession(session)) {
        return originalEnsureBackendToken(...args);
      }

      // Moderador: no confiamos en un token viejo de alumno.
      // Pedimos siempre token staff a /moderator-login.
      if (isModeratorSession(session)) {
        return requestModeratorToken(session);
      }

      return originalEnsureBackendToken(...args);
    };

    patched.__moderatorStaffPatched = true;
    api.ensureBackendToken = patched;

    return true;
  }

  function init() {
    patchBackendEnsureToken();

    setTimeout(patchBackendEnsureToken, 300);
    setTimeout(patchBackendEnsureToken, 1000);
    setTimeout(patchBackendEnsureToken, 2500);
  }

  window.ClassroomModeratorStaffTokenFix = {
    patch: patchBackendEnsureToken,
    refresh: () => requestModeratorToken(loadSession()),
    session: loadSession,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* === Home Avisos Stable Final Renderer 20260622 === */
(function homeAvisosStableFinalRenderer() {
  "use strict";

  const STORAGE_KEY = "andyazh-classroom-notifications-v2";
  const SHELL_ID = "homeAvisosStableShell";
  let lastStableAvisosHtml = "";

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value) || fallback;
    } catch {
      return fallback;
    }
  }

  function loadItems() {
    const items = safeJson(localStorage.getItem(STORAGE_KEY), []);
    return Array.isArray(items) ? items : [];
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

  function isHomePage() {
    const path = window.location.pathname;

    return (
      /index\.html$/i.test(path) ||
      path.endsWith("/frontend/") ||
      path.endsWith("/frontend") ||
      path.endsWith("/")
    );
  }

  function normalizeType(item) {
    const raw = String(item?.type || item?.category || item?.audience || "system").toLowerCase();

    if (raw.includes("community") || raw.includes("comunidad") || raw.includes("reply") || raw.includes("thread")) return "community";
    if (raw.includes("academic") || raw.includes("exam") || raw.includes("nota") || raw.includes("recuperatorio")) return "academic";
    if (raw.includes("announcement") || raw.includes("aviso") || raw.includes("warning") || raw.includes("news")) return "announcement";

    return "system";
  }

  function normalizeSeverity(item) {
    const explicit = String(item?.severity || "").toLowerCase();

    if (["info", "warning", "danger", "neutral"].includes(explicit)) return explicit;

    const type = normalizeType(item);

    if (type === "academic") return "danger";
    if (type === "announcement") return "warning";

    return "neutral";
  }

  function getBody(item) {
    return item?.body || item?.description || item?.message || item?.content || item?.text || "";
  }

  function getLink(item) {
    return item?.link || item?.link_url || item?.url || "";
  }

  function isDismissed(item) {
    return Boolean(
      item?.dismissedAt ||
      item?.dismissed_at ||
      item?.deletedAt ||
      item?.deleted_at ||
      item?.hidden
    );
  }

  function shouldShowInHome(item) {
    if (!item || isDismissed(item)) return false;
    if (normalizeType(item) === "community") return false;

    return Boolean(item.title || getBody(item));
  }

  function getNotices() {
    return loadItems()
      .filter(shouldShowInHome)
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0))
      .slice(0, 10);
  }

  function labelFor(type, severity) {
    if (type === "academic" || severity === "danger") return "IMPORTANTE";
    if (type === "announcement" || severity === "warning") return "AVISO";

    return "SISTEMA";
  }

  function buildNoticeCard(item) {
    const type = normalizeType(item);
    const severity = normalizeSeverity(item);
    const body = getBody(item);
    const link = getLink(item);
    const createdAt = item.createdAt || item.created_at || item.updatedAt || item.updated_at || "";
    const actor = item.actor || item.created_by_name || "Classroom";

    const linkHtml = link
      ? `
        <a class="home-notice-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
          Abrir link
        </a>
      `
      : "";

    return `
      <article class="home-cmd-card home-notice-card is-${escapeHtml(severity)}" data-home-notification-id="${escapeHtml(item.id || "")}">
        <div class="home-cmd-prompt">C:\\classroom&gt;</div>

        <div class="home-cmd-content">
          <div class="home-cmd-tags">
            <span>${escapeHtml(labelFor(type, severity))}</span>
            <span>${escapeHtml(({ academic: "ACADÉMICA", announcement: "AVISO", system: "SISTEMA", community: "COMUNIDAD" }[type] || type).toUpperCase())}</span>
          </div>

          <h3>${escapeHtml(item.title || "Notificación")}</h3>
          <p>${escapeHtml(body)}</p>

          <div class="home-notice-meta">
            <strong>Publicado por ${escapeHtml(actor)}</strong>
            ${createdAt ? `<span>${escapeHtml(formatDate(createdAt))}</span>` : ""}
          </div>

          ${linkHtml}
        </div>
      </article>
    `;
  }

  function buildDefaultCards() {
    return `
      <article class="home-cmd-card home-notice-card is-info" data-home-default-card="1">
        <div class="home-cmd-prompt">C:\\classroom&gt;</div>
        <div class="home-cmd-content">
          <div class="home-cmd-tags">
            <span>AVISO</span>
            <span>SISTEMA</span>
          </div>
          <h3>Recuperaciones y asistencias</h3>
          <p>Próximamente se van a registrar avisos cuando un alumno recupere una clase o quede un cambio pendiente de revisar.</p>
          <div class="home-notice-meta">
            <strong>Publicado por Sistema</strong>
          </div>
        </div>
      </article>

      <article class="home-cmd-card home-notice-card is-info" data-home-default-card="1">
        <div class="home-cmd-prompt">C:\\classroom&gt;</div>
        <div class="home-cmd-content">
          <div class="home-cmd-tags">
            <span>NOVEDAD</span>
            <span>CURSO</span>
          </div>
          <h3>Novedades del curso</h3>
          <p>Acá van a aparecer anuncios, accesos importantes, cambios de cursada y comunicaciones internas del Classroom.</p>
          <div class="home-notice-meta">
            <strong>Canal interno AndyAzhTEC</strong>
          </div>
        </div>
      </article>

      <article class="home-cmd-card home-notice-card is-neutral" data-home-default-card="1">
        <div class="home-cmd-prompt">C:\\classroom&gt;</div>
        <div class="home-cmd-content">
          <div class="home-cmd-tags">
            <span>LOG</span>
            <span>ACTIVIDAD</span>
          </div>
          <h3>Actividad reciente</h3>
          <p>Este espacio centraliza avisos, novedades y actividad reciente del Classroom.</p>
          <div class="home-notice-meta">
            <strong>Pelusita online · avisos activos</strong>
          </div>
        </div>
      </article>
    `;
  }

  function removeOldAvisosBlocks() {
    const selectors = [
      "#homeAvisosShell",
      "#homeAvisosDynamicFeed",
      ".home-avisos-shell",
      ".home-cmd-window",
      ".home-terminal-window",
      ".home-boletín-terminal",
      ".home-terminal-feed",
      ".home-terminal-feed-head",
      ".home-notifications-feed",
      "[data-home-avisos-panel]",
      "[data-home-avisos-final]",
      "[data-home-notification-id]",
    ];

    document.querySelectorAll(selectors.join(",")).forEach((node) => {
      if (!node.closest(`#${SHELL_ID}`)) {
        node.remove();
      }
    });
  }

  function findMount() {
    const main = document.querySelector("main");
    if (main) return main;

    return document.querySelector(".page-content") || document.querySelector(".dashboard-content") || document.body;
  }

  function buildShellHtml() {
    return `
      <section id="${SHELL_ID}" class="home-avisos-stable-shell">
        <div class="home-avisos-stable-topbar">
          <div class="home-avisos-stable-dots" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>

          <strong>AndyAzhTEC Classroom</strong>

          <div class="home-avisos-stable-path">
            Canal de novedades
            <span>ONLINE</span>
          </div>
        </div>

        <header class="home-avisos-stable-header">
          <p>BOLETÍN</p>
          <h2>Avisos y novedades</h2>
          <small>Centro unificado para anuncios del curso, accesos importantes y actividad reciente.</small>
        </header>

        <div id="homeAvisosStableFeed" class="home-avisos-stable-feed"></div>

        <footer class="home-avisos-stable-footer">
          <div class="home-avisos-stable-dots" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>

          <strong>AndyAzhTEC Classroom</strong>
        </footer>
      </section>
    `;
  }

  function ensureShell() {
    let shell = document.getElementById(SHELL_ID);

    if (shell) return shell;

    const mount = findMount();
    mount.insertAdjacentHTML("beforeend", buildShellHtml());

    return document.getElementById(SHELL_ID);
  }

  function render() {
    if (!isHomePage()) return;

    removeOldAvisosBlocks();

    const shell = ensureShell();
    const feed = shell.querySelector("#homeAvisosStableFeed");
    const notices = getNotices();

    const nextHtml = notices.length
      ? notices.map(buildNoticeCard).join("")
      : buildDefaultCards();

    if (nextHtml !== lastStableAvisosHtml) {
      feed.innerHTML = nextHtml;
      lastStableAvisosHtml = nextHtml;
    }
  }

  function schedule() {
    setTimeout(render, 80);
    setTimeout(render, 600);
  }

  function init() {
    schedule();

    window.addEventListener("classroom:notifications-updated", schedule);

    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY) schedule();
    });
  }

  window.ClassroomHomeAvisosStableFinal = {
    render,
    notices: getNotices,
    storage: loadItems,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* === NOTIFICATION LABELS SPANISH RUNTIME 20260622 === */
(function notificationLabelsSpanishRuntime() {
  "use strict";

  const MAP = new Map([
    ["academic", "Académica"],
    ["academica", "Académica"],
    ["announcement", "Aviso"],
    ["notice", "Aviso"],
    ["alert", "Aviso"],
    ["system", "Sistema"],
    ["community", "Comunidad"],
    ["course", "Curso"],
    ["activity", "Actividad"],
    ["log", "Registro"],
    ["news", "Novedad"],
    ["newsletter", "Boletín"],
    ["danger", "Rojo"],
    ["red", "Rojo"],
    ["warning", "Amarillo"],
    ["yellow", "Amarillo"],
    ["info", "Azul"],
    ["blue", "Azul"],
    ["neutral", "Neutro"],
    ["purple", "Violeta"],
    ["violet", "Violeta"],
    ["success", "Verde"],
    ["green", "Verde"],
    ["all", "Todos"],
    ["unread", "No leída"],
    ["read", "Leída"]
  ]);

  function normalizeToken(token) {
    return String(token || "")
      .trim()
      .toLowerCase()
      .replace(/[()[\]{}:;,.]/g, "");
  }

  function translateText(text) {
    let output = String(text || "");

    // Frases combinadas comunes.
    output = output.replace(/\bIMPORTANTE\s+ACADEMIC\b/gi, "IMPORTANTE ACADÉMICA");
    output = output.replace(/\bIMPORTANTE\s+ANNOUNCEMENT\b/gi, "IMPORTANTE AVISO");
    output = output.replace(/\bSISTEMA\s+SYSTEM\b/gi, "SISTEMA");
    output = output.replace(/\bCOMMUNITY\b/gi, "Comunidad");
    output = output.replace(/\bACADEMIC\b/gi, "Académica");
    output = output.replace(/\bANNOUNCEMENT\b/gi, "Aviso");
    output = output.replace(/\bSYSTEM\b/gi, "Sistema");
    output = output.replace(/\bDANGER\b/gi, "Rojo");
    output = output.replace(/\bWARNING\b/gi, "Amarillo");
    output = output.replace(/\bINFO\b/gi, "Azul");
    output = output.replace(/\bNEUTRAL\b/gi, "Neutro");
    output = output.replace(/\ball\b/g, "Todos");

    const trimmed = output.trim();
    const mapped = MAP.get(normalizeToken(trimmed));

    return mapped || output;
  }

  function patchTextNode(node) {
    const fixed = translateText(node.nodeValue);

    if (fixed !== node.nodeValue) {
      node.nodeValue = fixed;
    }
  }

  function patchElement(el) {
    if (!el) return;

    // Solo texto directo para no romper nodos con iconos.
    if (!el.children.length && el.textContent) {
      const fixed = translateText(el.textContent);

      if (fixed !== el.textContent) {
        el.textContent = fixed;
      }
    }

    ["title", "aria-label", "data-type", "data-severity"].forEach((attr) => {
      if (!el.hasAttribute || !el.hasAttribute(attr)) return;

      const value = el.getAttribute(attr);
      const fixed = translateText(value);

      if (fixed !== value) {
        el.setAttribute(attr, fixed);
      }
    });
  }

  function patch(root = document.body) {
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    let node;
    while ((node = walker.nextNode())) {
      patchTextNode(node);
    }

    root.querySelectorAll?.(
      ".home-cmd-tags span, .notification-chip, .notification-pill, .notification-badge, .badge, .chip, .pill, small, span, strong"
    ).forEach(patchElement);
  }

  let scheduled = false;

  function schedulePatch() {
    if (scheduled) return;

    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patch();
    });
  }

  const observer = new MutationObserver(schedulePatch);

  function init() {
    patch();

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    window.addEventListener("classroom:notifications-updated", schedulePatch);
    setTimeout(patch, 300);
    setTimeout(patch, 1200);
  }

  window.ClassroomNotificationSpanishLabels = {
    patch,
    translateText
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* === Notification Preferences Modal Override 20260628 === */
(function notificationPrefsModalOverride() {
  "use strict";

  const PREFS_KEY = "andyazh-classroom-notification-prefs-mock";

  const DEFAULT_MATRIX_PREFS = {
    homeNews: true,
    homeCommunity: true,
    homeEvaluations: true,
    homeClasses: true,
    homeAlerts: true,

    bellNews: true,
    bellCommunity: true,
    bellEvaluations: true,
    bellClasses: true,
    bellAlerts: true,

    emailNews: false,
    emailCommunity: false,
    emailEvaluations: true,
    emailClasses: false,
    emailAlerts: true
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      return { ...DEFAULT_MATRIX_PREFS, ...saved };
    } catch {
      return { ...DEFAULT_MATRIX_PREFS };
    }
  }

  function savePrefs(prefs) {
    const current = loadPrefs();
    const next = { ...current, ...(prefs || {}) };
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    return next;
  }

  function prefSwitch(key, checked, label) {
    return `
      <label class="notification-pref-toggle" title="${escapeHtml(label)}">
        <span class="notification-pref-toggle-label">${escapeHtml(label)}</span>
        <input type="checkbox" data-notification-modal-pref="${escapeHtml(key)}" ${checked ? "checked" : ""}>
        <span class="notification-pref-toggle-ui"></span>
      </label>
    `;
  }

  function row(id, icon, title, description, prefs) {
    const map = {
      news: ["homeNews", "bellNews", "emailNews"],
      community: ["homeCommunity", "bellCommunity", "emailCommunity"],
      evaluations: ["homeEvaluations", "bellEvaluations", "emailEvaluations"],
      classes: ["homeClasses", "bellClasses", "emailClasses"],
      alerts: ["homeAlerts", "bellAlerts", "emailAlerts"]
    };

    const keys = map[id];

    return `
      <div class="notification-pref-matrix-row">
        <div class="notification-pref-topic">
          <i class="fa-solid ${escapeHtml(icon)}"></i>
          <span>
            <strong>${escapeHtml(title)}</strong>
            <small>${escapeHtml(description)}</small>
          </span>
        </div>

        ${prefSwitch(keys[0], prefs[keys[0]], "Inicio")}
        ${prefSwitch(keys[1], prefs[keys[1]], "Campanita")}
        ${prefSwitch(keys[2], prefs[keys[2]], "Correo")}
      </div>
    `;
  }

  function closeModal() {
    const modal = document.getElementById("notificationPrefsModal");
    if (!modal) return;

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("notification-prefs-modal-open");
  }

  function buildModal() {
    const previous = document.getElementById("notificationPrefsModal");
    if (previous) previous.remove();

    const prefs = loadPrefs();
    const modal = document.createElement("div");

    modal.id = "notificationPrefsModal";
    modal.className = "notification-prefs-modal-backdrop";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <section class="notification-prefs-modal" role="dialog" aria-modal="true" aria-labelledby="notificationPrefsModalTitle">
        <div class="notification-prefs-modal-head">
          <div>
            <p class="eyebrow">Classroom</p>
            <h2 id="notificationPrefsModalTitle">Preferencias de notificación</h2>
            <p>Elegí qué querés recibir y por dónde. Por ahora se guarda localmente; después lo conectamos al backend y al correo del dominio.</p>
          </div>

          <button class="notification-prefs-modal-close" type="button" data-notification-prefs-close aria-label="Cerrar preferencias">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="notification-pref-matrix">
          <div class="notification-pref-matrix-head">
            <span>Tipo de aviso</span>
            <span>Inicio</span>
            <span>Campanita</span>
            <span>Correo</span>
          </div>

          ${row("news", "fa-bullhorn", "Novedades y avisos", "Comunicados generales del curso o plataforma.", prefs)}
          ${row("community", "fa-comments", "Comunidad", "Hilos, respuestas y actividad técnica.", prefs)}
          ${row("evaluations", "fa-file-circle-check", "Evaluaciones", "Notas, devoluciones, recuperatorios y correcciones.", prefs)}
          ${row("classes", "fa-person-chalkboard", "Clases", "Materiales, clases disponibles y seguimiento académico.", prefs)}
          ${row("alerts", "fa-triangle-exclamation", "Alertas", "Fechas límite, cambios urgentes o avisos críticos.", prefs)}
        </div>

        <div class="notification-prefs-modal-foot">
          <small id="notificationPrefsModalStatus">Guardado local en este navegador.</small>

          <button class="btn btn-primary" type="button" data-notification-prefs-close>
            <i class="fa-solid fa-check"></i>
            Listo
          </button>
        </div>
      </section>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-notification-prefs-close]")) {
        event.preventDefault();
        closeModal();
      }
    });

    modal.querySelectorAll("[data-notification-modal-pref]").forEach((input) => {
      input.addEventListener("change", () => {
        savePrefs({ [input.dataset.notificationModalPref]: input.checked });

        const status = modal.querySelector("#notificationPrefsModalStatus");
        if (status) {
          status.textContent = `Guardado local: ${new Date().toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit"
          })}`;
        }
      });
    });

    return modal;
  }

  function openModal() {
    const modal = buildModal();

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("notification-prefs-modal-open");
  }

  document.addEventListener("click", (event) => {
    const settings = event.target.closest("#notificationsSettingsLink");

    if (!settings) return;

    event.preventDefault();
    event.stopPropagation();

    const widget = document.getElementById("notificationsWidget");
    const panel = document.getElementById("notificationsPanel");

    widget?.classList.remove("open");
    panel?.setAttribute("aria-hidden", "true");

    openModal();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  window.ClassroomNotificationPrefsModal = {
    open: openModal,
    close: closeModal,
    loadPrefs,
    savePrefs
  };
})();
