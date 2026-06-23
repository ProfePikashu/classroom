/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — main.js
   Tema claro/oscuro + navegación + submenu cursos + sonidos UI
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomApp = {
  init() {
    if (typeof ClassroomAuth !== "undefined") {
      ClassroomAuth.initProtectedPage();
    }
    this.initTheme();
    this.initUiSounds();
    this.initSoundToggle();
    this.bindThemeToggle();
    this.bindUserMenu();
    this.bindMobileSidebar();
    this.bindSidebarSubmenus();
    this.bindCurrentHashCourse();
    this.bindModuleButtons();
  },

  soundStorageKey: "andyazh-classroom-sounds-muted",

  areSoundsMuted() {
    return localStorage.getItem(this.soundStorageKey) === "true";
  },

  setSoundsMuted(muted) {
    localStorage.setItem(this.soundStorageKey, muted ? "true" : "false");
    this.updateSoundToggle();

    if (!muted) {
      this.playSound("click", { force: true });
    }
  },

  toggleSoundsMuted() {
    this.setSoundsMuted(!this.areSoundsMuted());
  },

  initSoundToggle() {
    const themeToggle = document.getElementById("themeToggle");

    if (!themeToggle || document.getElementById("soundToggle")) return;

    const button = document.createElement("button");
    button.className = "sound-toggle sound-toggle-icon";
    button.id = "soundToggle";
    button.type = "button";
    button.setAttribute("aria-label", "Activar o desactivar sonidos del Classroom");

    themeToggle.insertAdjacentElement("afterend", button);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleSoundsMuted();
    });

    this.updateSoundToggle();
  },

  updateSoundToggle() {
    const button = document.getElementById("soundToggle");
    if (!button) return;

    const muted = this.areSoundsMuted();

    button.classList.toggle("is-muted", muted);
    button.setAttribute("aria-pressed", muted ? "true" : "false");
    button.title = muted ? "Sonidos desactivados" : "Sonidos activados";
    button.innerHTML = muted
      ? '<i class="fa-solid fa-volume-xmark"></i>'
      : '<i class="fa-solid fa-volume-high"></i>';
  },

  initUiSounds() {
    this.sounds = {
      click: new Audio("media/sounds/click.mp3"),
      open: new Audio("media/sounds/click.mp3"),
      close: new Audio("media/sounds/close.mp3"),
      errorFast: new Audio("media/sounds/error-fast.mp3"),
      errorSimple: new Audio("media/sounds/error-simple.mp3"),
      logout: new Audio("media/sounds/log-out.mp3"),
    };

    Object.values(this.sounds).forEach((sound) => {
      sound.volume = 0.16;
      sound.preload = "auto";
    });

    document.addEventListener("click", (event) => {
      const clickable = event.target.closest(
        ".nav-item, .submenu-item, .btn, .module-item, .theme-toggle"
      );

      if (!clickable) return;

      if (clickable.matches("[data-submenu-toggle]")) {
        const submenuId = clickable.dataset.submenuToggle;
        const submenu = document.getElementById(submenuId);
        const isOpen = submenu && submenu.classList.contains("open");

        this.playSound(isOpen ? "close" : "open");
        return;
      }

      this.playSound("click");
    });
  },

  playSound(soundName, options = {}) {
    if (!options.force && this.areSoundsMuted()) return;
    if (!this.sounds || !this.sounds[soundName]) return;

    const sound = this.sounds[soundName];

    try {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    } catch (error) {
      // No rompemos la UI si el navegador bloquea audio o falta el archivo.
    }
  },

  initTheme() {
    const savedTheme = localStorage.getItem("andyazh-classroom-theme");
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const theme = savedTheme || (prefersLight ? "light" : "dark");

    this.setTheme(theme);
  },

  setTheme(theme) {
    const normalizedTheme = theme === "light" ? "light" : "dark";
    const root = document.documentElement;
    const toggle = document.getElementById("themeToggle");

    root.setAttribute("data-theme", normalizedTheme);
    localStorage.setItem("andyazh-classroom-theme", normalizedTheme);

    if (!toggle) return;

    const icon = toggle.querySelector("i");
    if (normalizedTheme === "light") {
      if (icon) icon.className = "fa-solid fa-sun";
      return;
    }

    if (icon) icon.className = "fa-solid fa-moon";
    },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    this.setTheme(nextTheme);
  },

  playDuckSound() {
    if (this.areSoundsMuted()) return;

    const duckSound = new Audio("media/sounds/duck.mp3");
    const fallbackSound = new Audio("media/sounds/click.mp3");

    duckSound.volume = 0.22;
    fallbackSound.volume = 0.16;

    duckSound.play().catch(() => {
      fallbackSound.play().catch(() => {});
    });
  },

  bindMobileSidebar() {
    const toggle = document.getElementById("mobileMenuToggle");
    const overlay = document.getElementById("mobileSidebarOverlay");

    if (!toggle || !overlay) return;

    const openMenu = () => {
      document.body.classList.add("mobile-sidebar-open");
      toggle.classList.add("is-open");
      overlay.classList.add("is-open");
      toggle.setAttribute("aria-label", "Cerrar menú");
      this.playDuckSound();
    };

    const closeMenu = () => {
      document.body.classList.remove("mobile-sidebar-open");
      toggle.classList.remove("is-open");
      overlay.classList.remove("is-open");
      toggle.setAttribute("aria-label", "Abrir menú");
      this.playDuckSound();
    };

    const toggleMenu = () => {
      if (document.body.classList.contains("mobile-sidebar-open")) {
        closeMenu();
        return;
      }

      openMenu();
    };

    toggle.addEventListener("click", toggleMenu);
    overlay.addEventListener("click", closeMenu);

    document.querySelectorAll(".sidebar a").forEach((link) => {
      link.addEventListener("click", () => {
        const isMobile = window.matchMedia("(max-width: 980px)").matches;
        const isSubmenuToggle = link.matches("[data-submenu-toggle]");

        if (!isMobile || isSubmenuToggle) return;

        closeMenu();
      });
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  },

  bindUserMenu() {
    const menu = document.getElementById("userMenu");
    const toggle = document.getElementById("userMenuToggle");
    const dropdown = document.getElementById("userDropdown");

    if (!menu || !toggle || !dropdown) return;

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.classList.toggle("open");
      this.playSound("click");
    });

    document.addEventListener("click", (event) => {
      if (menu.contains(event.target)) return;
      menu.classList.remove("open");
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") menu.classList.remove("open");
    });
  },

  bindThemeToggle() {
    const toggle = document.getElementById("themeToggle");

    if (!toggle) return;

    toggle.addEventListener("click", () => {
      this.toggleTheme();
    });
  },

  bindSidebarSubmenus() {
    const toggles = document.querySelectorAll("[data-submenu-toggle]");

    toggles.forEach((toggle) => {
      toggle.addEventListener("click", (event) => {
        const href = toggle.getAttribute("href");

        if (href && href !== "#") {
          return;
        }

        event.preventDefault();

        const submenuId = toggle.dataset.submenuToggle;
        const submenu = document.getElementById(submenuId);

        if (!submenu) return;

        toggle.classList.toggle("submenu-open");
        submenu.classList.toggle("open");
      });
    });

    const submenuItems = document.querySelectorAll(".submenu-item");

    submenuItems.forEach((item) => {
      item.addEventListener("click", () => {
        submenuItems.forEach((link) => link.classList.remove("active"));
        item.classList.add("active");
      });
    });
  },

  bindCurrentHashCourse() {
    const hash = window.location.hash.replace("#", "");

    if (!hash) return;

    const item = document.querySelector('[data-course-id="' + hash + '"]');

    if (!item) return;

    document.querySelectorAll(".submenu-item").forEach((link) => {
      link.classList.remove("active");
    });

    item.classList.add("active");
  },

  bindModuleButtons() {
    const moduleButtons = document.querySelectorAll(".module-item");

    moduleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const moduleName = button.innerText.trim();
        console.log("Módulo seleccionado:", moduleName);
      });
    });
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomApp.init();
});

const CLASSROOM_API_BASE_URL = "https://exampro-backend-1n6d.onrender.com";

function getClassroomAuthToken() {
  const session = getClassroomSessionSafe();

  return (
    session?.classroomReadToken ||
    session?.exampro?.accessToken ||
    session?.exampro?.token ||
    session?.accessToken ||
    ""
  );
}

function getClassroomAuthHeaders() {
  const token = getClassroomAuthToken();

  return token
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    : {
        "Content-Type": "application/json",
      };
}

async function classroomApiFetch(path, options = {}) {
  const response = await fetch(`${CLASSROOM_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getClassroomAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.detail || data?.message || `Error HTTP ${response.status}`);
  }

  return data;
}

function normalizeApiNotification(item) {
  return {
    id: String(item.id),
    title: item.title || "Sin título",
    description: item.description || "",
    type: item.type || "info",
    course: item.course || "Todos",
    audience: item.audience || "all",
    createdAt: item.published_at || item.created_at || new Date().toISOString(),
    createdBy: item.created_by_name || item.created_by_twitch || "Docente",
    read: Boolean(item.read),
    source: "api",
  };
}

const CLASSROOM_NEWS_STORAGE_KEY = "andyazh-classroom-news-mock";
const CLASSROOM_NEWS_READ_KEY = "andyazh-classroom-news-read-mock";
const CLASSROOM_NOTIFICATION_PREFS_KEY = "andyazh-classroom-notification-prefs-mock";

function getClassroomSessionSafe() {
  try {
    return JSON.parse(localStorage.getItem("andyazh-classroom-session") || "null");
  } catch {
    return null;
  }
}

function isClassroomStaff() {
  const session = getClassroomSessionSafe();
  const role = String(session?.role || "").toLowerCase();

  return ["teacher", "docente", "moderator", "classroom_moderator", "admin"].includes(role);
}

function getClassroomNews() {
  const fallback = [
    {
      id: "mock-welcome",
      title: "Bienvenido al Classroom",
      description: "Las novedades importantes del curso van a aparecer acá y también en la campanita.",
      type: "info",
      course: "Todos",
      audience: "all",
      createdAt: new Date().toISOString(),
      createdBy: "Sistema",
    },
    {
      id: "mock-recovery",
      title: "Recuperaciones y asistencias",
      description: "Próximamente se van a registrar avisos cuando un alumno recupere una clase o quede un cambio pendiente de revisar.",
      type: "admin",
      course: "AyRPC 2025",
      audience: "staff",
      createdAt: new Date().toISOString(),
      createdBy: "Sistema",
    },
  ];

  try {
    const stored = JSON.parse(localStorage.getItem(CLASSROOM_NEWS_STORAGE_KEY) || "[]");
    return Array.isArray(stored) && stored.length ? stored : fallback;
  } catch {
    return fallback;
  }
}

function saveClassroomNews(items) {
  localStorage.setItem(CLASSROOM_NEWS_STORAGE_KEY, JSON.stringify(items));
}

function getReadNewsIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(CLASSROOM_NEWS_READ_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveReadNewsIds(ids) {
  localStorage.setItem(CLASSROOM_NEWS_READ_KEY, JSON.stringify([...new Set(ids)]));
}

function getVisibleClassroomNews() {
  const staff = isClassroomStaff();

  const apiCache = window.__classroomNewsApiCache;

  if (Array.isArray(apiCache)) {
    return apiCache;
  }

  return getClassroomNews()
    .filter((item) => item.audience !== "staff" || staff)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function getNotificationPrefs() {
  try {
    const stored = JSON.parse(localStorage.getItem(CLASSROOM_NOTIFICATION_PREFS_KEY) || "{}");

    return {
      bell: stored.bell ?? true,
      newsletter: stored.newsletter ?? false,
      recovery: stored.recovery ?? true,
    };
  } catch {
    return {
      bell: true,
      newsletter: false,
      recovery: true,
    };
  }
}

function saveNotificationPrefs(prefs) {
  localStorage.setItem(CLASSROOM_NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}

function getNewsTypeIcon(type) {
  const clean = String(type || "").toLowerCase();

  if (clean === "urgent") return "fa-triangle-exclamation";
  if (clean === "warning") return "fa-circle-exclamation";
  if (clean === "admin") return "fa-clipboard-check";
  if (clean === "reminder") return "fa-clock";
  return "fa-bullhorn";
}

function getNewsTypeLabel(type) {
  const clean = String(type || "").toLowerCase();

  if (clean === "urgent") return "Urgente";
  if (clean === "warning") return "Importante";
  if (clean === "admin") return "Administración";
  if (clean === "reminder") return "Recordatorio";
  return "Aviso";
}

function escapeClassroomHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initNotificationsBell() {
  const themeToggle = document.getElementById("themeToggle");
  if (!themeToggle || document.getElementById("notificationsWidget")) return;

  const widget = document.createElement("div");
  widget.className = "notifications-widget";
  widget.id = "notificationsWidget";

  widget.innerHTML = `
    <button class="notifications-toggle" id="notificationsToggle" type="button" aria-label="Notificaciones">
      <i class="fa-solid fa-bell"></i>
      <span class="notifications-dot" id="notificationsDot">0</span>
    </button>

    <div class="notifications-panel" id="notificationsPanel" aria-hidden="true">
      <div class="notifications-panel-header">
        <div>
          <p class="eyebrow">Centro de avisos</p>
          <h3>Notificaciones</h3>
        </div>
        <span class="notifications-chip">Beta</span>
      </div>

      <div class="notifications-list" id="notificationsList"></div>

      <div class="notifications-panel-footer">
        <button class="notifications-read-all" id="notificationsReadAll" type="button">
          <i class="fa-solid fa-check-double"></i>
          Marcar todo como leído
        </button>
      </div>
    </div>
  `;

  themeToggle.insertAdjacentElement("afterend", widget);

  const toggle = widget.querySelector("#notificationsToggle");
  const panel = widget.querySelector("#notificationsPanel");
  const readAll = widget.querySelector("#notificationsReadAll");

  const closePanel = () => {
    widget.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  };

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    renderNotificationsBell();
    const open = widget.classList.toggle("open");
    panel.setAttribute("aria-hidden", open ? "false" : "true");
  });

  panel.addEventListener("click", (event) => event.stopPropagation());

  readAll?.addEventListener("click", async () => {
    const ids = getVisibleClassroomNews().map((item) => item.id);
    saveReadNewsIds(ids);

    try {
      await markAllClassroomNewsReadApi();
      await refreshClassroomNewsFromApi();
    } catch {
      renderNotificationsBell();
      renderClassroomNewsPanel();
    }
  });

  document.addEventListener("click", closePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePanel();
  });

  renderNotificationsBell();
}

async function refreshClassroomNewsFromApi() {
  const token = getClassroomAuthToken();

  if (!token) {
    window.__classroomNewsApiCache = null;
    renderNotificationsBell();
    renderClassroomNewsPanel();
    return false;
  }

  try {
    const data = await classroomApiFetch("/api/classroom/notifications");
    const items = Array.isArray(data.items) ? data.items.map(normalizeApiNotification) : [];

    window.__classroomNewsApiCache = items;

    const readIds = items.filter((item) => item.read).map((item) => item.id);
    saveReadNewsIds(readIds);

    renderNotificationsBell();
    renderClassroomNewsPanel();

    return true;
  } catch (error) {
    console.warn("No se pudieron cargar novedades desde API. Uso fallback local.", error);
    window.__classroomNewsApiCache = null;
    renderNotificationsBell();
    renderClassroomNewsPanel();
    return false;
  }
}

async function createClassroomNewsApi(payload) {
  return classroomApiFetch("/api/classroom/notifications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function markAllClassroomNewsReadApi() {
  return classroomApiFetch("/api/classroom/notifications/read-all", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

async function loadNotificationPrefsFromApi() {
  const token = getClassroomAuthToken();
  if (!token) return null;

  try {
    const data = await classroomApiFetch("/api/classroom/notification-preferences");
    const prefs = data.preferences || null;

    if (prefs) {
      const normalized = {
        bell: prefs.bell_enabled ?? true,
        newsletter: prefs.newsletter_email_enabled ?? false,
        recovery: prefs.recovery_alerts_enabled ?? true,
        email: prefs.email || "",
      };

      saveNotificationPrefs(normalized);
      return normalized;
    }
  } catch (error) {
    console.warn("No se pudieron cargar preferencias desde API. Uso fallback local.", error);
  }

  return null;
}

async function saveNotificationPrefsToApi(prefs) {
  const token = getClassroomAuthToken();
  if (!token) return false;

  try {
    await classroomApiFetch("/api/classroom/notification-preferences", {
      method: "POST",
      body: JSON.stringify({
        email: prefs.email || null,
        bell_enabled: true,
        newsletter_email_enabled: Boolean(prefs.newsletter),
        recovery_alerts_enabled: Boolean(prefs.recovery),
      }),
    });

    return true;
  } catch (error) {
    console.warn("No se pudieron guardar preferencias en API. Quedan locales.", error);
    return false;
  }
}

function renderNotificationsBell() {
  const list = document.getElementById("notificationsList");
  const dot = document.getElementById("notificationsDot");
  if (!list || !dot) return;

  const readIds = getReadNewsIds();
  const news = getVisibleClassroomNews();
  const unreadCount = news.filter((item) => !readIds.includes(item.id)).length;

  dot.textContent = String(unreadCount);
  dot.classList.toggle("is-hidden", unreadCount <= 0);

  if (!news.length) {
    list.innerHTML = `
      <article class="notification-empty">
        <i class="fa-regular fa-bell"></i>
        <strong>Sin notificaciones</strong>
        <p>Cuando haya novedades del curso van a aparecer acá.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = news
    .slice(0, 6)
    .map((item) => {
      const unread = !readIds.includes(item.id);
      const icon = getNewsTypeIcon(item.type);

      return `
        <article class="notification-item ${unread ? "unread" : ""}">
          <div class="notification-icon">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div>
            <strong>${escapeClassroomHtml(item.title)}</strong>
            <p>${escapeClassroomHtml(item.description)}</p>
            <small>${escapeClassroomHtml(item.course || "Todos")} · ${escapeClassroomHtml(getNewsTypeLabel(item.type))}</small>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderClassroomNewsPanel() {
  const panel = document.getElementById("classroomNewsPanel");
  if (!panel) return;

  const readIds = getReadNewsIds();
  const news = getVisibleClassroomNews();

  if (!news.length) {
    panel.innerHTML = `
      <div class="classroom-news-empty">
        <i class="fa-regular fa-newspaper"></i>
        <strong>No hay novedades cargadas</strong>
        <p>Cuando se publique un aviso, se va a ver en este panel.</p>
      </div>
    `;
    return;
  }

  panel.innerHTML = news
    .slice(0, 5)
    .map((item) => {
      const unread = !readIds.includes(item.id);
      const icon = getNewsTypeIcon(item.type);

      return `
        <article class="classroom-news-item ${unread ? "unread" : ""}">
          <div class="classroom-news-icon">
            <i class="fa-solid ${icon}"></i>
          </div>

          <div>
            <div class="classroom-news-meta">
              <span>${escapeClassroomHtml(item.course || "Todos")}</span>
              <span>${escapeClassroomHtml(getNewsTypeLabel(item.type))}</span>
            </div>

            <h3>${escapeClassroomHtml(item.title)}</h3>
            <p>${escapeClassroomHtml(item.description)}</p>
            <small>Publicado por ${escapeClassroomHtml(item.createdBy || "Docente")}</small>
          </div>
        </article>
      `;
    })
    .join("");
}

function initClassroomNewsHome() {
  const main = document.querySelector(".main-content");
  if (!main || document.getElementById("classroomNewsSection")) return;

  const path = window.location.pathname.split("/").pop() || "index.html";
  if (path !== "index.html" && path !== "") return;

  const staff = isClassroomStaff();

  const section = document.createElement("section");
  section.className = "classroom-news-section panel";
  section.id = "classroomNewsSection";

  section.innerHTML = `
    <div class="classroom-news-header">
      <div>
        <p class="eyebrow">Newsletter interno</p>
        <h2>Novedades del Classroom</h2>
        <p>Acá aparecen los avisos importantes del curso. También se muestran en la campanita.</p>
      </div>

      ${staff ? `
        <button class="btn btn-primary" id="openNewsComposer" type="button">
          <i class="fa-solid fa-paper-plane"></i>
          <span>Enviar novedad</span>
        </button>
      ` : ""}
    </div>

    <div class="classroom-news-list" id="classroomNewsPanel"></div>
  `;

  const topbar = main.querySelector(".topbar");
  if (topbar) {
    topbar.insertAdjacentElement("afterend", section);
  } else {
    main.prepend(section);
  }

  if (staff) {
    document.getElementById("openNewsComposer")?.addEventListener("click", openNewsComposer);
  }

  renderClassroomNewsPanel();
}

function ensureNewsComposerModal() {
  if (document.getElementById("newsComposerModal")) return;

  const modal = document.createElement("div");
  modal.className = "news-composer-modal";
  modal.id = "newsComposerModal";

  modal.innerHTML = `
    <div class="news-composer-backdrop" data-news-close></div>

    <section class="news-composer-dialog" role="dialog" aria-modal="true" aria-label="Enviar novedad">
      <button class="news-composer-close" type="button" data-news-close aria-label="Cerrar">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <div class="news-composer-header">
        <p class="eyebrow">Docente / Staff</p>
        <h2>Enviar novedad</h2>
        <p>Esto todavía es una maqueta local. Después lo conectamos al backend para que llegue a todos.</p>
      </div>

      <form class="news-composer-form" id="newsComposerForm">
        <label>
          <span>Título</span>
          <input id="newsTitle" type="text" placeholder="Cierre recuperatorio" required>
        </label>

        <label>
          <span>Descripción</span>
          <textarea id="newsDescription" rows="5" placeholder="Se reitera que el día 30 de junio..." required></textarea>
        </label>

        <div class="news-composer-grid">
          <label>
            <span>Curso destino</span>
            <select id="newsCourse">
              <option value="Todos">Todos</option>
              <option value="AyRPC 2025">AyRPC 2025</option>
              <option value="AyRPC 2026">AyRPC 2026</option>
            </select>
          </label>

          <label>
            <span>Tipo</span>
            <select id="newsType">
              <option value="info">Aviso</option>
              <option value="warning">Importante</option>
              <option value="urgent">Urgente</option>
              <option value="reminder">Recordatorio</option>
            </select>
          </label>
        </div>

        <label class="news-mail-option disabled">
          <input type="checkbox" disabled>
          <span>Enviar también por mail cuando conectemos newsletter</span>
        </label>

        <div class="news-composer-actions">
          <button class="btn btn-outline" type="button" data-news-close>Cancelar</button>
          <button class="btn btn-primary" type="submit">
            <i class="fa-solid fa-paper-plane"></i>
            Enviar novedad
          </button>
        </div>
      </form>
    </section>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-news-close]")) closeNewsComposer();
  });

  modal.querySelector("#newsComposerForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const session = getClassroomSessionSafe();
    const title = modal.querySelector("#newsTitle")?.value.trim();
    const description = modal.querySelector("#newsDescription")?.value.trim();
    const course = modal.querySelector("#newsCourse")?.value || "Todos";
    const type = modal.querySelector("#newsType")?.value || "info";

    if (!title || !description) return;

    const payload = {
      title,
      description,
      course,
      type,
      audience: "all",
      send_email: false,
    };

    try {
      await createClassroomNewsApi(payload);
      closeNewsComposer();
      await refreshClassroomNewsFromApi();
      return;
    } catch (error) {
      console.warn("No se pudo publicar en API. Guardo novedad local.", error);
    }

    const news = getClassroomNews();

    news.unshift({
      id: `local-${Date.now()}`,
      title,
      description,
      course,
      type,
      audience: "all",
      createdAt: new Date().toISOString(),
      createdBy: session?.student?.full_name || session?.alumno?.["Nombre Completo"] || "Docente",
    });

    saveClassroomNews(news);
    closeNewsComposer();
    renderClassroomNewsPanel();
    renderNotificationsBell();
  });
}

function openNewsComposer() {
  ensureNewsComposerModal();

  const modal = document.getElementById("newsComposerModal");
  modal.classList.add("show");
  document.body.classList.add("news-composer-open");

  setTimeout(() => document.getElementById("newsTitle")?.focus(), 50);
}

function closeNewsComposer() {
  const modal = document.getElementById("newsComposerModal");
  modal?.classList.remove("show");
  document.body.classList.remove("news-composer-open");

  const form = document.getElementById("newsComposerForm");
  form?.reset();
}

async function initNotificationPrefsCard() {
  const main = document.querySelector(".main-content");
  if (!main || document.getElementById("notificationPrefsCard")) return;

  const path = window.location.pathname.split("/").pop() || "";
  if (path !== "perfil.html") return;

  const prefs = (await loadNotificationPrefsFromApi()) || getNotificationPrefs();

  const card = document.createElement("section");
  card.className = "notification-prefs-card panel";
  card.id = "notificationPrefsCard";

  card.innerHTML = `
    <div class="notification-prefs-header">
      <div>
        <p class="eyebrow">Preferencias</p>
        <h2>Notificaciones</h2>
        <p>Configuración visual/local de avisos. Después lo conectamos al backend.</p>
      </div>
    </div>

    <div class="notification-prefs-list">
      <label class="notification-pref-row locked">
        <div>
          <strong>Campanita interna</strong>
          <p>Los avisos académicos aparecen dentro del Classroom.</p>
        </div>
        <input type="checkbox" checked disabled>
      </label>

      <label class="notification-pref-row">
        <div>
          <strong>Newsletter por mail</strong>
          <p>Recibir novedades importantes también por correo cuando esté conectado.</p>
        </div>
        <input type="checkbox" data-pref="newsletter" ${prefs.newsletter ? "checked" : ""}>
      </label>

      <label class="notification-pref-row">
        <div>
          <strong>Avisos de recuperatorios</strong>
          <p>Alertas relacionadas con entregas, recuperaciones y fechas límite.</p>
        </div>
        <input type="checkbox" data-pref="recovery" ${prefs.recovery ? "checked" : ""}>
      </label>
    </div>
  `;

  main.appendChild(card);

  card.querySelectorAll("[data-pref]").forEach((input) => {
    input.addEventListener("change", () => {
      const current = getNotificationPrefs();
      current[input.dataset.pref] = input.checked;
      saveNotificationPrefs(current);
      saveNotificationPrefsToApi(current);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!window.ClassroomUseLocalNotifications) initNotificationsBell();
  initClassroomNewsHome();
  if (!window.ClassroomUseLocalNotifications) initNotificationPrefsCard();
  refreshClassroomNewsFromApi();
});

/* === ANIMATED THEME SWITCH 20260622 === */
(function animatedThemeSwitch() {
  "use strict";

  function getTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  function enhanceToggle(button) {
    if (!button || button.dataset.themeSwitchReady === "1") return;

    button.dataset.themeSwitchReady = "1";
    button.classList.add("theme-switch");
    button.setAttribute("aria-label", "Cambiar entre modo claro y oscuro");
    button.setAttribute("title", "Cambiar tema");

    button.innerHTML = `
      <span class="theme-switch-track" aria-hidden="true"></span>

      <span class="theme-switch-stars" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </span>

      <span class="theme-switch-icon theme-switch-moon" aria-hidden="true">
        <i class="fa-solid fa-moon"></i>
      </span>

      <span class="theme-switch-icon theme-switch-sun" aria-hidden="true">
        <i class="fa-solid fa-sun"></i>
      </span>

      <span class="theme-switch-thumb" aria-hidden="true"></span>
    `;

    syncButton(button);
  }

  function syncButton(button) {
    if (!button) return;

    const theme = getTheme();

    button.dataset.theme = theme;
    button.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
  }

  function syncAll() {
    document.querySelectorAll("#themeToggle, .theme-toggle").forEach((button) => {
      enhanceToggle(button);
      syncButton(button);
    });
  }

  function init() {
    syncAll();

    const observer = new MutationObserver(() => {
      syncAll();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    window.addEventListener("storage", (event) => {
      if (String(event.key || "").toLowerCase().includes("theme")) {
        syncAll();
      }
    });

    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("#themeToggle, .theme-toggle");
      if (!button) return;

      // Dejamos que el handler original cambie el tema y sincronizamos después.
      setTimeout(syncAll, 40);
      setTimeout(syncAll, 260);
    });
  }

  window.ClassroomAnimatedThemeSwitch = {
    sync: syncAll,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
