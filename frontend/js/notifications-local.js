
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

          <button class="notifications-read-all danger" id="notificationsClearAll" type="button">
            <i class="fa-solid fa-trash"></i>
            Limpiar
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

      return `
        <article class="notification-item ${unreadClass}" data-notification-id="${escapeHtml(item.id)}" data-notification-link="${escapeHtml(item.link)}">
          <div class="notification-icon">
            <i class="fa-solid ${icon}"></i>
          </div>

          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.body)}</p>
            <small>
              ${escapeHtml(item.actor || "Classroom")} · ${escapeHtml(formatDate(item.createdAt))}
            </small>
          </div>
        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-notification-id]").forEach((itemEl) => {
      itemEl.addEventListener("click", () => {
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

  function init() {
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
    clearAll,
    seedDemo,
    loadItems,
    saveItems,
    loadPrefs,
    savePrefs,
  };

  document.addEventListener("DOMContentLoaded", init);
})();
