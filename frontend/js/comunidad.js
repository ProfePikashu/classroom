
(() => {
  "use strict";

  const STORAGE_KEY = "andyazh-classroom-community-posts-v1";
  const ATTACHMENT_MAX_FILES = 4;
  const ATTACHMENT_MAX_SIZE = 2 * 1024 * 1024;
  const ATTACHMENT_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

  let pendingAttachments = [];

  const TYPE_LABELS = {
    consulta: "Consulta",
    aporte: "Aporte",
    recomendacion: "Recomendación",
  };

  const COURSE_LABELS = {
    general: "General",
    "ayrpc-2025": "AyRPC 2025",
    "ayrpc-2026": "AyRPC 2026",
  };

  const els = {};

  function $(selector) {
    return document.querySelector(selector);
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

    const fullName = [session.nombre, session.apellido].filter(Boolean).join(" ").trim();

    return fullName || session.name || session.twitch || session.email || "Usuario Classroom";
  }

  function loadPosts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function savePosts(posts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  }

  function uid(prefix = "post") {
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
      return "Fecha no disponible";
    }
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function getFilters() {
    return {
      search: normalizeText(els.search?.value || ""),
      type: els.typeFilter?.value || "todos",
      status: els.statusFilter?.value || "todos",
      course: els.courseFilter?.value || "todos",
      quick: document.querySelector(".community-pill.active")?.dataset.communityQuick || "todos",
    };
  }

  function filteredPosts(posts) {
    const filters = getFilters();

    return posts.filter((post) => {
      const haystack = normalizeText(`${post.title} ${post.content} ${post.author}`);

      if (filters.search && !haystack.includes(filters.search)) return false;
      if (filters.type !== "todos" && post.type !== filters.type) return false;
      if (filters.status !== "todos" && post.status !== filters.status) return false;
      if (filters.course !== "todos" && post.course !== filters.course) return false;
      if (filters.quick === "abiertos" && post.status !== "abierto") return false;
      if (filters.quick === "sin-responder" && (post.comments || []).length > 0) return false;

      return true;
    });
  }

  function renderStats(posts) {
    if (!els.stats) return;

    const total = posts.length;
    const open = posts.filter((post) => post.status === "abierto").length;
    const solved = posts.filter((post) => post.status === "resuelto").length;

    els.stats.innerHTML = `
      <span><strong>${total}</strong> hilos</span>
      <span><strong>${open}</strong> abiertos</span>
      <span><strong>${solved}</strong> resueltos</span>
    `;
  }

  function renderPosts() {
    const posts = loadPosts().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const visiblePosts = filteredPosts(posts);

    renderStats(posts);
    updateSeedDemoButton();

    if (!els.list || !els.empty) return;

    els.empty.hidden = visiblePosts.length > 0;
    els.list.innerHTML = visiblePosts.map(renderPostCard).join("");

    bindPostActions();
  }


  function bytesToReadable(size) {
    const n = Number(size) || 0;

    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;

    return `${n} B`;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve({
          id: uid("attachment"),
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result,
        });
      };

      reader.onerror = () => reject(reader.error || new Error("No se pudo leer la imagen."));
      reader.readAsDataURL(file);
    });
  }

  function renderAttachmentPreview() {
    if (!els.attachmentPreview) return;

    if (!pendingAttachments.length) {
      els.attachmentPreview.hidden = true;
      els.attachmentPreview.innerHTML = "";
      return;
    }

    els.attachmentPreview.hidden = false;
    els.attachmentPreview.innerHTML = pendingAttachments.map((attachment) => `
      <article class="community-attachment-preview-item" data-attachment-id="${escapeHtml(attachment.id)}">
        <img src="${escapeHtml(attachment.dataUrl)}" alt="${escapeHtml(attachment.name)}" />
        <div>
          <strong>${escapeHtml(attachment.name)}</strong>
          <span>${escapeHtml(bytesToReadable(attachment.size))}</span>
        </div>
        <button type="button" class="community-attachment-remove" data-remove-attachment="${escapeHtml(attachment.id)}" aria-label="Quitar imagen">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </article>
    `).join("");

    els.attachmentPreview.querySelectorAll("[data-remove-attachment]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.removeAttachment;
        pendingAttachments = pendingAttachments.filter((attachment) => attachment.id !== id);

        if (els.images) els.images.value = "";

        renderAttachmentPreview();
      });
    });
  }

  async function handleImageSelection(event) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const slotsLeft = ATTACHMENT_MAX_FILES - pendingAttachments.length;

    if (slotsLeft <= 0) {
      window.alert(`Máximo ${ATTACHMENT_MAX_FILES} imágenes por hilo.`);
      event.target.value = "";
      return;
    }

    const selected = files.slice(0, slotsLeft);
    const rejected = [];

    const validFiles = selected.filter((file) => {
      if (!ATTACHMENT_ALLOWED_TYPES.includes(file.type)) {
        rejected.push(`${file.name}: formato no permitido`);
        return false;
      }

      if (file.size > ATTACHMENT_MAX_SIZE) {
        rejected.push(`${file.name}: supera 2 MB`);
        return false;
      }

      return true;
    });

    if (files.length > slotsLeft) {
      rejected.push(`Solo se agregaron ${slotsLeft} imagen/es porque el máximo es ${ATTACHMENT_MAX_FILES}.`);
    }

    if (rejected.length) {
      window.alert(`Algunas imágenes no se agregaron:\n\n${rejected.join("\n")}`);
    }

    try {
      const loaded = await Promise.all(validFiles.map(readFileAsDataUrl));
      pendingAttachments = [...pendingAttachments, ...loaded].slice(0, ATTACHMENT_MAX_FILES);
      renderAttachmentPreview();
    } catch (error) {
      window.alert("No se pudo cargar una de las imágenes.");
    } finally {
      event.target.value = "";
    }
  }

  function renderPostAttachments(post) {
    const attachments = Array.isArray(post.attachments) ? post.attachments : [];

    if (!attachments.length) return "";

    return `
      <div class="community-attachments-gallery">
        ${attachments.map((attachment) => `
          <button class="community-attachment-thumb" type="button" data-open-attachment="${escapeHtml(attachment.dataUrl)}" data-attachment-name="${escapeHtml(attachment.name)}">
            <img src="${escapeHtml(attachment.dataUrl)}" alt="${escapeHtml(attachment.name)}" loading="lazy" />
          </button>
        `).join("")}
      </div>
    `;
  }

  function openAttachmentModal(src, name) {
    if (!src) return;

    let modal = document.getElementById("communityAttachmentModal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "communityAttachmentModal";
      modal.className = "community-attachment-modal";
      modal.innerHTML = `
        <div class="community-attachment-modal-backdrop" data-close-attachment-modal></div>
        <div class="community-attachment-modal-dialog">
          <button class="community-icon-btn community-attachment-modal-close" type="button" data-close-attachment-modal aria-label="Cerrar imagen">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <img id="communityAttachmentModalImg" src="" alt="" />
          <strong id="communityAttachmentModalName"></strong>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelectorAll("[data-close-attachment-modal]").forEach((button) => {
        button.addEventListener("click", closeAttachmentModal);
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeAttachmentModal();
      });
    }

    const img = modal.querySelector("#communityAttachmentModalImg");
    const label = modal.querySelector("#communityAttachmentModalName");

    if (img) {
      img.src = src;
      img.alt = name || "Imagen adjunta";
    }

    if (label) {
      label.textContent = name || "Imagen adjunta";
    }

    modal.classList.add("open");
  }

  function closeAttachmentModal() {
    const modal = document.getElementById("communityAttachmentModal");
    if (!modal) return;

    modal.classList.remove("open");
  }


  function renderPostCard(post) {
    const comments = post.comments || [];
    const typeLabel = TYPE_LABELS[post.type] || post.type;
    const courseLabel = COURSE_LABELS[post.course] || post.course;
    const statusLabel = post.status === "resuelto" ? "Resuelto" : "Abierto";
    const statusIcon = post.status === "resuelto" ? "fa-circle-check" : "fa-circle-question";

    const commentsHtml = comments.length
      ? comments.map((comment) => `
          <div class="community-comment">
            <div class="community-comment-meta">
              <strong>${escapeHtml(comment.author)}</strong>
              <span>${formatDate(comment.createdAt)}</span>
            </div>
            <p>${escapeHtml(comment.content)}</p>
          </div>
        `).join("")
      : `<p class="community-no-comments">Sin respuestas todavía. Meté mano, cobarde técnico.</p>`;

    return `
      <article class="community-post-card" data-post-id="${escapeHtml(post.id)}">
        <div class="community-post-head">
          <div class="community-post-badges">
            <span class="community-badge type-${escapeHtml(post.type)}">${escapeHtml(typeLabel)}</span>
            <span class="community-badge status-${escapeHtml(post.status)}">
              <i class="fa-solid ${statusIcon}"></i>
              ${escapeHtml(statusLabel)}
            </span>
            <span class="community-badge course">
              <i class="fa-solid fa-graduation-cap"></i>
              ${escapeHtml(courseLabel)}
            </span>
          </div>

          <button class="community-icon-btn" type="button" data-community-toggle-comments aria-label="Mostrar respuestas">
            <i class="fa-solid fa-chevron-down"></i>
          </button>
        </div>

        <h3>${escapeHtml(post.title)}</h3>

        <p class="community-post-content">${escapeHtml(post.content)}</p>

        ${renderPostAttachments(post)}

        <div class="community-post-meta">
          <span><i class="fa-solid fa-user-astronaut"></i> ${escapeHtml(post.author)}</span>
          <span><i class="fa-regular fa-clock"></i> ${formatDate(post.createdAt)}</span>
          <span><i class="fa-regular fa-comment"></i> ${comments.length} respuestas</span>
        </div>

        <div class="community-post-actions">
          <button class="btn btn-outline btn-sm" type="button" data-community-reply>
            <i class="fa-solid fa-reply"></i>
            Responder
          </button>

          <button class="btn btn-outline btn-sm" type="button" data-community-resolve>
            <i class="fa-solid fa-check"></i>
            ${post.status === "resuelto" ? "Reabrir" : "Marcar resuelto"}
          </button>

          <button class="btn btn-outline btn-sm community-danger" type="button" data-community-delete>
            <i class="fa-solid fa-trash"></i>
            Borrar
          </button>
        </div>

        <div class="community-comments" hidden>
          <div class="community-comments-list">
            ${commentsHtml}
          </div>

          <form class="community-reply-form" data-community-reply-form>
            <label>Responder hilo</label>
            <textarea rows="3" maxlength="900" placeholder="Escribí una respuesta útil, consejo o posible solución..." required></textarea>
            <div class="community-form-actions">
              <span class="community-form-hint">Se guarda localmente en este navegador.</span>
              <button class="btn btn-primary btn-sm" type="submit">
                <i class="fa-solid fa-paper-plane"></i>
                Responder
              </button>
            </div>
          </form>
        </div>
      </article>
    `;
  }

  function bindPostActions() {
    document.querySelectorAll(".community-post-card").forEach((card) => {
      const postId = card.dataset.postId;

      card.querySelector("[data-community-toggle-comments]")?.addEventListener("click", () => {
        const comments = card.querySelector(".community-comments");
        const icon = card.querySelector("[data-community-toggle-comments] i");

        if (!comments) return;

        const nextHidden = !comments.hidden;
        comments.hidden = nextHidden;

        if (icon) {
          icon.className = nextHidden ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-up";
        }
      });

      card.querySelector("[data-community-reply]")?.addEventListener("click", () => {
        const comments = card.querySelector(".community-comments");
        const textarea = card.querySelector("[data-community-reply-form] textarea");
        const icon = card.querySelector("[data-community-toggle-comments] i");

        if (comments) comments.hidden = false;
        if (icon) icon.className = "fa-solid fa-chevron-up";
        if (textarea) textarea.focus();
      });

      card.querySelector("[data-community-resolve]")?.addEventListener("click", () => {
        toggleResolved(postId);
      });

      card.querySelector("[data-community-delete]")?.addEventListener("click", () => {
        deletePost(postId);
      });

      card.querySelector("[data-community-reply-form]")?.addEventListener("submit", (event) => {
        event.preventDefault();

        const textarea = event.currentTarget.querySelector("textarea");
        const content = textarea?.value.trim();

        if (!content) return;

        addComment(postId, content);
      });

      card.querySelectorAll("[data-open-attachment]").forEach((button) => {
        button.addEventListener("click", () => {
          openAttachmentModal(button.dataset.openAttachment, button.dataset.attachmentName);
        });
      });
    });
  }


  function notifyCommunity(payload) {
    const detail = {
      source: "community",
      link: "comunidad.html",
      ...payload,
    };

    if (window.ClassroomNotifications?.create) {
      window.ClassroomNotifications.create(detail);
      return;
    }

    window.dispatchEvent(new CustomEvent("classroom:community-notification", {
      detail,
    }));
  }

  function createPost(event) {
    event.preventDefault();

    const title = els.title?.value.trim();
    const content = els.content?.value.trim();
    const type = els.type?.value || "consulta";
    const course = els.course?.value || "general";

    if (!title || !content) return;

    const posts = loadPosts();

    posts.unshift({
      id: uid("post"),
      title,
      content,
      type,
      course,
      status: "abierto",
      author: currentUserName(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: pendingAttachments.map((attachment) => ({ ...attachment })),
      comments: [],
    });

    savePosts(posts);

    notifyCommunity({
      type: "community_new_post",
      title: "Nuevo hilo en Comunidad",
      body: `${TYPE_LABELS[type] || "Publicación"}: ${title}`,
      actor: currentUserName(),
      meta: { postTitle: title, postType: type, course },
    });

    els.form.reset();
    pendingAttachments = [];
    renderAttachmentPreview();
    closeComposer();
    renderPosts();
  }

  function addComment(postId, content) {
    const posts = loadPosts();
    const post = posts.find((item) => item.id === postId);

    if (!post) return;

    post.comments = post.comments || [];
    post.comments.push({
      id: uid("comment"),
      author: currentUserName(),
      content,
      createdAt: new Date().toISOString(),
    });

    post.updatedAt = new Date().toISOString();

    savePosts(posts);

    notifyCommunity({
      type: "community_reply",
      title: "Nueva respuesta en Comunidad",
      body: `Respondieron en: ${post.title}`,
      actor: currentUserName(),
      meta: { postId, postTitle: post.title },
    });

    renderPosts();

    const card = document.querySelector(`[data-post-id="${CSS.escape(postId)}"]`);
    const comments = card?.querySelector(".community-comments");
    const icon = card?.querySelector("[data-community-toggle-comments] i");

    if (comments) comments.hidden = false;
    if (icon) icon.className = "fa-solid fa-chevron-up";
  }

  function toggleResolved(postId) {
    const posts = loadPosts();
    const post = posts.find((item) => item.id === postId);

    if (!post) return;

    post.status = post.status === "resuelto" ? "abierto" : "resuelto";
    post.updatedAt = new Date().toISOString();

    savePosts(posts);

    notifyCommunity({
      type: "community_status",
      title: post.status === "resuelto" ? "Hilo marcado como resuelto" : "Hilo reabierto",
      body: post.title,
      actor: currentUserName(),
      meta: { postId, postTitle: post.title, status: post.status },
    });

    renderPosts();
  }

  function deletePost(postId) {
    const ok = window.confirm("¿Borrar este hilo de la comunidad local?");
    if (!ok) return;

    const posts = loadPosts().filter((post) => post.id !== postId);

    savePosts(posts);
    renderPosts();
  }

  function openComposer() {
    if (!els.composer) return;

    els.composer.hidden = false;
    els.title?.focus();
  }

  function closeComposer() {
    if (!els.composer) return;

    els.composer.hidden = true;
    pendingAttachments = [];
    renderAttachmentPreview();

    if (els.images) els.images.value = "";
  }

  function seedDemoPosts() {
    const existing = loadPosts();
    const hasDemoPosts = existing.some((post) => post.demoSeed === "community-mvp-v1");

    if (hasDemoPosts) {
      window.alert("Los ejemplos de Comunidad ya están cargados. No los dupliqué, animalito del localStorage.");
      return;
    }

    const now = new Date();

    const demo = [
      {
        id: uid("post"),
        title: "No me reconoce el SSD M.2 en BIOS",
        content: "Estoy armando una PC y la BIOS no muestra el M.2. Ya probé reiniciar y revisar que esté bien conectado. ¿Qué más debería mirar?",
        type: "consulta",
        course: "ayrpc-2026",
        status: "abierto",
        author: "Alumno Demo",
        demoSeed: "community-mvp-v1",
        createdAt: new Date(now.getTime() - 1000 * 60 * 35).toISOString(),
        updatedAt: new Date(now.getTime() - 1000 * 60 * 35).toISOString(),
        comments: [],
      },
      {
        id: uid("post"),
        title: "Aporte: checklist rápida antes de instalar Windows",
        content: "Dejo una mini checklist: revisar modo UEFI/Legacy, tabla GPT/MBR, Secure Boot, orden de booteo, estado del disco y backup previo.",
        type: "aporte",
        course: "general",
        status: "resuelto",
        author: "Profe Demo",
        demoSeed: "community-mvp-v1",
        createdAt: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
        updatedAt: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
        comments: [
          {
            id: uid("comment"),
            author: "Alumno Demo",
            content: "Messirve, esto lo voy a usar antes de formatear.",
            createdAt: new Date(now.getTime() - 1000 * 60 * 50).toISOString(),
          },
        ],
      },
      {
        id: uid("post"),
        title: "Recomendación: Ventoy para pendrives multi-ISO",
        content: "Para laboratorio o soporte técnico, Ventoy es comodísimo porque permite cargar varias ISO en un mismo pendrive.",
        type: "recomendacion",
        course: "ayrpc-2025",
        status: "abierto",
        author: "Técnico Demo",
        demoSeed: "community-mvp-v1",
        createdAt: new Date(now.getTime() - 1000 * 60 * 140).toISOString(),
        updatedAt: new Date(now.getTime() - 1000 * 60 * 140).toISOString(),
        comments: [],
      },
    ];

    savePosts([...demo, ...existing]);
    renderPosts();
  }

  function updateSeedDemoButton() {
    if (!els.seedDemo) return;

    const hasDemoPosts = loadPosts().some((post) => post.demoSeed === "community-mvp-v1");

    els.seedDemo.disabled = hasDemoPosts;
    els.seedDemo.classList.toggle("is-disabled", hasDemoPosts);

    if (hasDemoPosts) {
      els.seedDemo.innerHTML = '<i class="fa-solid fa-circle-check"></i> Ejemplos cargados';
    } else {
      els.seedDemo.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Cargar ejemplos';
    }
  }


  function getFiltersPanel() {
    return document.getElementById("communityFiltersPanel") || document.querySelector(".community-filters-panel");
  }

  function getFilterToggle() {
    return document.getElementById("communityFilterToggle") || document.querySelector(".community-filter-toggle");
  }

  function setFiltersOpen(open) {
    const panel = getFiltersPanel();
    const button = getFilterToggle();

    if (!panel || !button) {
      console.warn("Comunidad: no encontré panel o botón de filtros", { panel, button });
      return;
    }

    panel.classList.toggle("is-collapsed", !open);
    button.classList.toggle("active", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");

    const label = button.querySelector("span");
    const icon = button.querySelector("i");

    if (label) label.textContent = open ? "Ocultar filtros" : "Filtros";
    if (icon) icon.className = open ? "fa-solid fa-xmark" : "fa-solid fa-sliders";
  }

  function toggleFiltersPanel(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const panel = getFiltersPanel();

    if (!panel) {
      console.warn("Comunidad: no encontré #communityFiltersPanel");
      return;
    }

    const nextOpen = panel.classList.contains("is-collapsed");
    setFiltersOpen(nextOpen);
  }

  function closeFiltersOnMobileAfterChange() {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    setFiltersOpen(false);
  }


  function bindEvents() {
    els.openComposer?.addEventListener("click", openComposer);
    els.closeComposer?.addEventListener("click", closeComposer);
    els.form?.addEventListener("submit", createPost);
    els.seedDemo?.addEventListener("click", seedDemoPosts);

    getFilterToggle()?.addEventListener("click", toggleFiltersPanel);
    els.images?.addEventListener("change", handleImageSelection);

    document.querySelectorAll("[data-community-open]").forEach((button) => {
      button.addEventListener("click", openComposer);
    });

    [els.search, els.typeFilter, els.statusFilter, els.courseFilter].forEach((input) => {
      input?.addEventListener("input", renderPosts);
      input?.addEventListener("change", () => {
        renderPosts();

        if (input !== els.search) {
          closeFiltersOnMobileAfterChange();
        }
      });
    });

    document.querySelectorAll("[data-community-quick]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-community-quick]").forEach((item) => {
          item.classList.remove("active");
        });

        button.classList.add("active");
        renderPosts();
      });
    });
  }

  function cacheElements() {
    els.openComposer = $("#communityOpenComposer");
    els.closeComposer = $("#communityCloseComposer");
    els.composer = $("#communityComposerPanel");
    els.form = $("#communityForm");
    els.title = $("#communityTitle");
    els.content = $("#communityContent");
    els.images = $("#communityImages");
    els.attachmentPreview = $("#communityAttachmentPreview");
    els.type = $("#communityType");
    els.course = $("#communityCourse");
    els.search = $("#communitySearch");
    els.filterToggle = $("#communityFilterToggle");
    els.filtersPanel = $("#communityFiltersPanel");
    els.typeFilter = $("#communityTypeFilter");
    els.statusFilter = $("#communityStatusFilter");
    els.courseFilter = $("#communityCourseFilter");
    els.stats = $("#communityMiniStats");
    els.list = $("#communityList");
    els.empty = $("#communityEmpty");
    els.seedDemo = $("#communitySeedDemo");
  }

  function init() {
    cacheElements();
    bindEvents();
    renderPosts();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
