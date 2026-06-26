(() => {
  "use strict";

  const SESSION_KEY = "andyazh-classroom-session";
  const LEGACY_STORAGE_KEY = "andyazh-classroom-community-posts";
  const LOCAL_API_BASE = "http://127.0.0.1:8000/api/classroom";
  const PROD_API_BASE = "https://exampro-backend-1n6d.onrender.com/api/classroom";

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
  const threadRepliesCache = new Map();

  let postsState = [];
  let pendingAttachments = [];
  let isRendering = false;

  const $ = (selector, root = document) => root.querySelector(selector);

  function isLocalFrontend() {
    return ["localhost", "127.0.0.1"].includes(window.location.hostname);
  }

  function apiBase() {
    return isLocalFrontend() ? LOCAL_API_BASE : PROD_API_BASE;
  }

  function readSession() {
    try {
      if (typeof ClassroomAuth !== "undefined" && ClassroomAuth?.getSession) {
        const session = ClassroomAuth.getSession();

        if (session) return session;
      }
    } catch (error) {
      console.warn("Comunidad: no pude leer sesión desde ClassroomAuth.", error);
    }

    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeSession(session) {
    if (!session) return;

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.warn("Comunidad: no pude guardar sesión actualizada.", error);
    }
  }

  function getTokenFromSession(session) {
    return (
      session?.access_token ||
      session?.accessToken ||
      session?.token ||
      session?.classroomToken ||
      ""
    );
  }

  function getSessionDni(session) {
    return String(session?.dni || session?.student?.dni || "").trim();
  }

  function getSessionTwitch(session) {
    return String(
      session?.twitch ||
      session?.student?.twitch ||
      session?.twitch_username ||
      ""
    ).trim();
  }

  function currentUserName() {
    const session = readSession();

    if (!session) return "Usuario Classroom";

    const fullName = [
      session.nombre || session.firstName || session.student?.nombre,
      session.apellido || session.lastName || session.student?.apellido,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return (
      session.displayName ||
      session.display_name ||
      session.name ||
      session.student?.display_name ||
      session.student?.full_name ||
      fullName ||
      session.email ||
      session.twitch ||
      "Usuario Classroom"
    );
  }

  async function refreshLocalToken(session) {
    if (!isLocalFrontend()) return null;

    const twitch = getSessionTwitch(session);
    const dni = getSessionDni(session);

    if (!twitch || !dni) return null;

    const response = await fetch(`${LOCAL_API_BASE}/student-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ twitch, dni }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const token = data?.access_token || data?.token || data?.accessToken || "";

    if (!token) return null;

    const updatedSession = {
      ...session,
      ...data.student,
      role: data.role || session.role,
      access_token: token,
      token,
    };

    writeSession(updatedSession);

    return token;
  }

  async function communityApi(path, options = {}, retry = true) {
    const session = readSession();

    let token = getTokenFromSession(session);

    if (!token && isLocalFrontend()) {
      token = await refreshLocalToken(session);
    }

    const headers = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let body = options.body;

    if (body && typeof body !== "string" && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json; charset=utf-8";
      body = JSON.stringify(body);
    } else if (body && typeof body === "string") {
      headers["Content-Type"] = headers["Content-Type"] || "application/json; charset=utf-8";
    }

    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers,
      body,
    });

    if ((response.status === 401 || response.status === 403) && retry && isLocalFrontend()) {
      const freshToken = await refreshLocalToken(session);

      if (freshToken) {
        return communityApi(path, options, false);
      }
    }

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.detail?.message ||
        data?.detail ||
        data?.message ||
        `Error HTTP ${response.status}`;

      throw new Error(typeof message === "string" ? message : JSON.stringify(message));
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

  function formatDate(iso) {
    if (!iso) return "Sin fecha";

    try {
      return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function normalizeThread(item = {}) {
    return {
      id: item.id,
      title: item.title || "Sin título",
      content: item.body || item.content || "",
      body: item.body || item.content || "",
      type: item.type || "consulta",
      course: item.course || "general",
      status: item.status || "abierto",
      author: item.author_name || item.author || item.author_twitch || "Usuario Classroom",
      authorDni: item.author_dni || "",
      authorTwitch: item.author_twitch || "",
      authorRole: item.author_role || "",
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      updatedAt: item.updated_at || item.updatedAt || item.created_at || new Date().toISOString(),
      repliesCount: Number(item.replies_count || 0),
      isDeleted: Boolean(item.is_deleted),
      isHidden: Boolean(item.is_hidden),
      raw: item,
    };
  }

  function normalizeReply(item = {}) {
    return {
      id: item.id,
      threadId: item.thread_id,
      author: item.author_name || item.author || item.author_twitch || "Usuario Classroom",
      authorDni: item.author_dni || "",
      authorTwitch: item.author_twitch || "",
      content: item.body || item.content || "",
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      updatedAt: item.updated_at || item.updatedAt || item.created_at || new Date().toISOString(),
      isDeleted: Boolean(item.is_deleted),
      isHidden: Boolean(item.is_hidden),
      raw: item,
    };
  }

  function legacyLoadPosts() {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function legacySavePosts(posts) {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(posts));
    } catch (error) {
      console.warn("Comunidad: no pude guardar fallback local.", error);
    }
  }

  async function loadPostsFromApi() {
    const params = new URLSearchParams();

    const search = els.search?.value?.trim();
    const type = els.typeFilter?.value;
    const status = els.statusFilter?.value;
    const course = els.courseFilter?.value;

    if (search) params.set("search", search);
    if (type && type !== "todos") params.set("type", type);
    if (status && status !== "todos") params.set("status", status);
    if (course && course !== "todos") params.set("course", course);

    const activeQuick = document.querySelector("[data-community-quick].active")?.dataset?.communityQuick;

    if (activeQuick && activeQuick !== "todos") {
      if (["consulta", "aporte", "recomendacion"].includes(activeQuick)) {
        params.set("type", activeQuick);
      }

      if (["abierto", "resuelto", "cerrado", "oculto"].includes(activeQuick)) {
        params.set("status", activeQuick);
      }
    }

    params.set("limit", "80");

    const query = params.toString();
    const data = await communityApi(`/community/threads${query ? `?${query}` : ""}`);

    return (data.items || []).map(normalizeThread);
  }

  async function loadThreadDetail(threadId) {
    const data = await communityApi(`/community/threads/${encodeURIComponent(threadId)}`);
    const replies = (data.replies || []).map(normalizeReply);

    threadRepliesCache.set(threadId, replies);

    return {
      thread: normalizeThread(data.item),
      replies,
    };
  }

  function renderStats(posts) {
    if (!els.stats) return;

    const total = posts.length;
    const abiertos = posts.filter((post) => post.status === "abierto").length;
    const resueltos = posts.filter((post) => post.status === "resuelto").length;
    const respuestas = posts.reduce((acc, post) => acc + Number(post.repliesCount || 0), 0);

    els.stats.innerHTML = `
      <span><strong>${total}</strong> hilos</span>
      <span><strong>${abiertos}</strong> abiertos</span>
      <span><strong>${resueltos}</strong> resueltos</span>
      <span><strong>${respuestas}</strong> respuestas</span>
    `;
  }

  function showEmpty(show, message = "No hay hilos para mostrar.") {
    if (!els.empty) return;

    els.empty.hidden = !show;

    const text = els.empty.querySelector("p") || els.empty;
    if (text) text.textContent = message;
  }

  function showListMessage(message, icon = "fa-spinner fa-spin") {
    if (!els.list) return;

    els.list.innerHTML = `
      <article class="community-post-card">
        <div class="community-post-meta">
          <span><i class="fa-solid ${icon}"></i> ${escapeHtml(message)}</span>
        </div>
      </article>
    `;
  }

  function isImageAttachment(attachment) {
    return String(attachment?.mime_type || attachment?.type || "").toLowerCase().startsWith("image/");
  }

  function isVideoAttachment(attachment) {
    return String(attachment?.mime_type || attachment?.type || "").toLowerCase().startsWith("video/");
  }

  function isAudioAttachment(attachment) {
    return String(attachment?.mime_type || attachment?.type || "").toLowerCase().startsWith("audio/");
  }

  function formatBytes(bytes) {
    const size = Number(bytes || 0);
    if (!Number.isFinite(size) || size <= 0) return "";

    const units = ["B", "KB", "MB", "GB"];
    let value = size;
    let index = 0;

    while (value >= 1024 && index < units.length - 1) {
      value = value / 1024;
      index += 1;
    }

    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function attachmentIcon(attachment) {
    const mime = String(attachment?.mime_type || attachment?.type || "").toLowerCase();
    const name = String(attachment?.filename || attachment?.name || "").toLowerCase();

    if (mime.startsWith("image/")) return "fa-regular fa-image";
    if (mime.startsWith("video/")) return "fa-regular fa-file-video";
    if (mime.startsWith("audio/")) return "fa-regular fa-file-audio";
    if (mime.includes("pdf") || name.endsWith(".pdf")) return "fa-regular fa-file-pdf";
    if (name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".7z")) return "fa-regular fa-file-zipper";
    if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".log")) return "fa-regular fa-file-lines";

    return "fa-regular fa-file";
  }

  function attachmentUrl(attachment) {
    return attachment?.preview_url || attachment?.view_url || attachment?.download_url || attachment?.url || "";
  }

  function attachmentImageThumbnailUrl(attachment) {
    const fileId = attachment?.provider_file_id || attachment?.file_id || attachment?.drive_file_id || "";

    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000`;
    }

    return attachment?.thumbnail_url || attachment?.download_url || attachment?.view_url || attachmentUrl(attachment);
  }


  async function loadPostAttachments(post) {
    if (!post?.id) return [];

    try {
      const data = await communityApi(`/community/threads/${encodeURIComponent(post.id)}/attachments`);
      post.attachments = Array.isArray(data.items) ? data.items : [];
      return post.attachments;
    } catch (error) {
      console.warn("Comunidad: no pude cargar adjuntos del hilo.", post.id, error);
      post.attachments = [];
      return [];
    }
  }

  async function hydratePostAttachments(posts) {
    const list = Array.isArray(posts) ? posts : [];
    await Promise.all(list.map(loadPostAttachments));
    return list;
  }

  async function uploadPendingAttachments(threadId) {
    if (!threadId || !pendingAttachments.length) return [];

    const formData = new FormData();

    pendingAttachments.forEach((attachment) => {
      if (attachment?.file) {
        formData.append("files", attachment.file, attachment.file.name || attachment.name || "archivo");
      }
    });

    const data = await communityApi(`/community/threads/${encodeURIComponent(threadId)}/attachments`, {
      method: "POST",
      body: formData,
    });

    return Array.isArray(data.items) ? data.items : [];
  }


  async function renderPosts() {
    if (!els.list) return;
    if (isRendering) return;

    isRendering = true;

    try {
      showEmpty(false);
      showListMessage("Cargando Comunidad desde backend...", "fa-spinner fa-spin");

      const posts = await loadPostsFromApi();
      await hydratePostAttachments(posts);

      postsState = posts;
      renderStats(posts);

      if (!posts.length) {
        els.list.innerHTML = "";
        showEmpty(true, "Todavía no hay hilos en Comunidad.");
        return;
      }

      showEmpty(false);
      els.list.innerHTML = posts.map(renderPostCard).join("");
      bindPostCardEvents();
    } catch (error) {
      console.warn("Comunidad API: uso fallback local.", error);

      const fallback = legacyLoadPosts().map((post) => ({
        ...post,
        repliesCount: Array.isArray(post.comments) ? post.comments.length : 0,
      }));

      postsState = fallback;
      renderStats(fallback);

      if (!fallback.length) {
        els.list.innerHTML = "";
        showEmpty(true, `No pude cargar Comunidad desde API: ${error.message}`);
        return;
      }

      els.list.innerHTML = fallback.map(renderPostCard).join("");
      bindPostCardEvents();
    } finally {
      isRendering = false;
    }
  }

  function renderAttachmentPreview() {
    if (!els.attachmentPreview) return;

    if (!pendingAttachments.length) {
      els.attachmentPreview.innerHTML = "";
      els.attachmentPreview.hidden = true;
      return;
    }

    els.attachmentPreview.hidden = false;
    els.attachmentPreview.innerHTML = pendingAttachments
      .map((attachment, index) => `
        <article class="community-attachment-preview">
          <span>
            <i class="${attachmentIcon(attachment)}"></i>
            ${escapeHtml(attachment.name)}
            ${attachment.size ? `<small>${escapeHtml(formatBytes(attachment.size))}</small>` : ""}
          </span>
          <button type="button" class="community-icon-btn" data-remove-attachment="${index}" aria-label="Quitar adjunto">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </article>
      `)
      .join("");

    els.attachmentPreview.querySelectorAll("[data-remove-attachment]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.removeAttachment);
        pendingAttachments.splice(index, 1);
        renderAttachmentPreview();

        if (els.images && !pendingAttachments.length) {
          els.images.value = "";
        }
      });
    });
  }

  function handleImageSelection(event) {
    const files = Array.from(event.target.files || []);

    if (files.length > 20) {
      window.alert("Por ahora podés adjuntar hasta 20 archivos por hilo.");
    }

    pendingAttachments = files.slice(0, 20).map((file) => ({
      file,
      name: file.name,
      filename: file.name,
      size: file.size,
      size_bytes: file.size,
      type: file.type || "application/octet-stream",
      mime_type: file.type || "application/octet-stream",
    }));

    renderAttachmentPreview();
  }

  function renderPostAttachments(post) {
    const attachments = Array.isArray(post?.attachments) ? post.attachments : [];

    if (!attachments.length) return "";

    return `
      <div class="community-post-attachments">
        ${attachments.map((attachment) => {
          const url = attachmentUrl(attachment);
          const filename = attachment.filename || attachment.name || "archivo";
          const size = formatBytes(attachment.size_bytes || attachment.size);
          const mime = attachment.mime_type || attachment.type || "archivo";
          const icon = attachmentIcon(attachment);
          const escapedUrl = escapeHtml(url);
          const escapedName = escapeHtml(filename);

          if (isImageAttachment(attachment) && url) {
            const thumbnailUrl = attachmentImageThumbnailUrl(attachment);

            return `
              <button class="community-post-attachment is-previewable" type="button" data-community-attachment-kind="image" data-community-attachment-src="${escapedUrl}" data-community-attachment-name="${escapedName}">
                <img src="${escapeHtml(thumbnailUrl)}" alt="${escapedName}" loading="lazy">
                <span><i class="${icon}"></i> ${escapedName}</span>
                <small>${escapeHtml(size || mime)}</small>
              </button>
            `;
          }

          if ((isVideoAttachment(attachment) || isAudioAttachment(attachment)) && url) {
            return `
              <button class="community-post-attachment is-previewable" type="button" data-community-attachment-kind="iframe" data-community-attachment-src="${escapedUrl}" data-community-attachment-name="${escapedName}">
                <span class="community-file-tile"><i class="${icon}"></i></span>
                <span>${escapedName}</span>
                <small>${escapeHtml(size || mime)}</small>
              </button>
            `;
          }

          return `
            <a class="community-post-attachment" href="${escapeHtml(attachment.download_url || attachment.view_url || url)}" target="_blank" rel="noopener">
              <span class="community-file-tile"><i class="${icon}"></i></span>
              <span>${escapedName}</span>
              <small>${escapeHtml(size || mime)}</small>
            </a>
          `;
        }).join("")}
      </div>
    `;
  }

  function injectCommunityApiV2Styles() {
    if (document.getElementById("communityApiV2UxStyles")) return;

    const style = document.createElement("style");
    style.id = "communityApiV2UxStyles";
    style.textContent = `
      .community-post-content.is-collapsed {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .community-text-toggle {
        margin-top: .35rem;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--primary, #00e5ff);
        font-weight: 800;
        cursor: pointer;
      }

      .community-reply-locked {
        margin-top: .85rem;
        padding: .85rem 1rem;
        border: 1px solid rgba(255, 193, 7, .35);
        border-radius: 14px;
        color: #ffd66b;
        background: rgba(255, 193, 7, .08);
        font-size: .9rem;
      }

      .community-post-actions button[disabled] {
        opacity: .5;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  function isThreadReplyLocked(post) {
    return String(post?.status || "abierto").toLowerCase() !== "abierto";
  }

  function renderExpandableContent(content, postId) {
    const raw = String(content || "");
    const clean = escapeHtml(raw);
    const shouldCollapse = raw.length > 260 || raw.split(/\s+/).length > 38;

    if (!shouldCollapse) {
      return `<p class="community-post-content">${clean}</p>`;
    }

    return `
      <p class="community-post-content is-collapsed" data-community-content-body="${escapeHtml(postId)}">${clean}</p>
      <button class="community-text-toggle" type="button" data-community-toggle-content>
        [Ver más]
      </button>
    `;
  }

  // COMMUNITY_API_V2_UX_20260624

  function renderPostCard(post) {
    const comments = threadRepliesCache.get(post.id) || post.comments || [];
    const commentsCount = Number(post.repliesCount ?? comments.length ?? 0);

    const typeLabel = TYPE_LABELS[post.type] || post.type;
    const courseLabel = COURSE_LABELS[post.course] || post.course;
    const statusLabel = post.status === "resuelto" ? "Resuelto" : post.status === "cerrado" ? "Cerrado" : post.status === "oculto" ? "Oculto" : "Abierto";
    const statusIcon = post.status === "resuelto" ? "fa-circle-check" : post.status === "cerrado" ? "fa-lock" : post.status === "oculto" ? "fa-eye-slash" : "fa-circle-question";
    const replyLocked = isThreadReplyLocked(post);
    const replyLockedLabel = post.status === "resuelto"
      ? "Este hilo está resuelto. Reabrilo para permitir nuevas respuestas."
      : "Este hilo está cerrado y no acepta nuevas respuestas.";

    const commentsHtml = comments.length
      ? comments.map((comment) => `
          <div class="community-comment" data-reply-id="${escapeHtml(comment.id)}">
            <div class="community-comment-meta">
              <strong>${escapeHtml(comment.author)}</strong>
              <span>${formatDate(comment.createdAt)}</span>
            </div>
            <p>${escapeHtml(comment.content)}</p>
          </div>
        `).join("")
      : commentsCount
        ? `<p class="community-no-comments">Abrí el hilo para cargar las respuestas.</p>`
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

        ${renderExpandableContent(post.content, post.id)}

        ${renderPostAttachments(post)}

        <div class="community-post-meta">
          <span><i class="fa-solid fa-user-astronaut"></i> ${escapeHtml(post.author)}</span>
          <span><i class="fa-regular fa-clock"></i> ${formatDate(post.createdAt)}</span>
          <span><i class="fa-regular fa-comment"></i> ${commentsCount} respuestas</span>
        </div>

        <div class="community-post-actions">
          <button class="btn btn-outline btn-sm" type="button" data-community-reply ${replyLocked ? "disabled aria-disabled=\"true\"" : ""}>
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

          ${replyLocked ? `
            <div class="community-reply-locked">
              <i class="fa-solid fa-lock"></i>
              ${escapeHtml(replyLockedLabel)}
            </div>
          ` : `
            <form class="community-reply-form" data-community-reply-form>
              <label>Responder hilo</label>
              <textarea rows="3" placeholder="Escribí una respuesta útil, consejo o posible solución..." required></textarea>
              <div class="community-form-actions">
                <span class="community-form-hint">Se guarda en la plataforma para todos los alumnos.</span>
                <button class="btn btn-primary btn-sm" type="submit">
                  <i class="fa-solid fa-paper-plane"></i>
                  Responder
                </button>
              </div>
            </form>
          `}
        </div>
      </article>
    `;
  }

  function getPostFromState(postId) {
    return postsState.find((post) => String(post.id) === String(postId));
  }

  async function openComments(postId, card) {
    const comments = card?.querySelector(".community-comments");
    const icon = card?.querySelector("[data-community-toggle-comments] i");

    if (!comments) return;

    if (comments.hidden && !threadRepliesCache.has(postId)) {
      try {
        await loadThreadDetail(postId);

        const currentScroll = window.scrollY;
        await renderPosts();

        window.scrollTo({ top: currentScroll });

        const newCard = document.querySelector(`[data-post-id="${CSS.escape(postId)}"]`);
        const newComments = newCard?.querySelector(".community-comments");
        const newIcon = newCard?.querySelector("[data-community-toggle-comments] i");

        if (newComments) newComments.hidden = false;
        if (newIcon) newIcon.className = "fa-solid fa-chevron-up";

        return;
      } catch (error) {
        console.warn("Comunidad: no pude cargar respuestas.", error);
        window.alert(`No pude cargar las respuestas: ${error.message}`);
      }
    }

    comments.hidden = !comments.hidden;

    if (icon) {
      icon.className = comments.hidden ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-up";
    }
  }

  function bindPostCardEvents() {
    document.querySelectorAll(".community-post-card[data-post-id]").forEach((card) => {
      const postId = card.dataset.postId;

      card.querySelector("[data-community-toggle-content]")?.addEventListener("click", (event) => {
        const button = event.currentTarget;
        const content = card.querySelector("[data-community-content-body]");

        if (!content) return;

        const collapsed = content.classList.toggle("is-collapsed");
        button.textContent = collapsed ? "[Ver más]" : "[Ver menos]";
      });

      card.querySelector("[data-community-toggle-comments]")?.addEventListener("click", () => {
        openComments(postId, card);
      });

      card.querySelector("[data-community-reply]")?.addEventListener("click", (event) => {
        if (event.currentTarget.disabled) return;

        const comments = card.querySelector(".community-comments");
        const textarea = card.querySelector("[data-community-reply-form] textarea");
        const icon = card.querySelector("[data-community-toggle-comments] i");

        if (comments) comments.hidden = false;
        if (icon) icon.className = "fa-solid fa-chevron-up";

        textarea?.focus();
      });

      card.querySelector("[data-community-resolve]")?.addEventListener("click", () => {
        toggleResolved(postId);
      });

      card.querySelector("[data-community-delete]")?.addEventListener("click", () => {
        deletePost(postId);
      });

      card.querySelectorAll("[data-community-attachment-src]").forEach((button) => {
        button.addEventListener("click", () => {
          const src = button.dataset.communityAttachmentSrc || "";
          const name = button.dataset.communityAttachmentName || "archivo";
          const kind = button.dataset.communityAttachmentKind || "file";

          if (!src) return;

          const modal = document.createElement("div");
          modal.className = "community-attachment-modal";

          const mediaHtml = kind === "image"
            ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(name)}">`
            : `<iframe src="${escapeHtml(src)}" title="${escapeHtml(name)}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;

          modal.innerHTML = `
            <div class="community-attachment-modal-backdrop" data-close-attachment-modal></div>
            <figure>
              <button type="button" class="community-icon-btn" data-close-attachment-modal aria-label="Cerrar adjunto">
                <i class="fa-solid fa-xmark"></i>
              </button>
              ${mediaHtml}
              <figcaption>${escapeHtml(name)}</figcaption>
            </figure>
          `;

          modal.querySelectorAll("[data-close-attachment-modal]").forEach((close) => {
            close.addEventListener("click", () => modal.remove());
          });

          document.body.appendChild(modal);
        });
      });

      card.querySelector("[data-community-reply-form]")?.addEventListener("submit", (event) => {
        event.preventDefault();

        const textarea = event.currentTarget.querySelector("textarea");
        const content = textarea?.value.trim();

        if (!content) return;

        addComment(postId, content, textarea);
      });
    });
  }

  function notifyCommunity(payload) {
    const eventPayload = {
      source: "community",
      createdAt: new Date().toISOString(),
      respectPrefs: false,
      ...payload,
    };

    try {
      window.dispatchEvent(new CustomEvent("andyazh:community-event", { detail: eventPayload }));
    } catch (error) {
      console.warn("Comunidad: no pude emitir evento andyazh:community-event.", error);
    }

    try {
      window.dispatchEvent(new CustomEvent("classroom:local-notification", { detail: eventPayload }));
    } catch (error) {
      console.warn("Comunidad: no pude emitir evento classroom:local-notification.", error);
    }

    try {
      if (window.ClassroomLocalNotifications?.create) {
        window.ClassroomLocalNotifications.create(eventPayload);
        return;
      }

      if (window.ClassroomNotificationsLocal?.create) {
        window.ClassroomNotificationsLocal.create(eventPayload);
        return;
      }

      if (window.ClassroomNotifications?.create) {
        window.ClassroomNotifications.create(eventPayload);
        return;
      }
    } catch (error) {
      console.warn("Comunidad: no pude crear notificación directa.", error);
    }
  }

  async function createPost(event) {
    event.preventDefault();

    const title = els.title?.value.trim();
    const content = els.content?.value.trim();
    const type = els.type?.value || "consulta";
    const course = els.course?.value || "ayrpc-2025";

    if (!title || !content) return;

    try {
      const data = await communityApi("/community/threads", {
        method: "POST",
        body: {
          title,
          body: content,
          type,
          course,
        },
      });

      const createdThreadId = data?.item?.id || data?.id;

      if (createdThreadId && pendingAttachments.length) {
        try {
          const uploadedAttachments = await uploadPendingAttachments(createdThreadId);

          if (data?.item) {
            data.item.attachments = uploadedAttachments;
          }
        } catch (error) {
          console.error("Comunidad: hilo creado, pero falló la subida de adjuntos.", error);
          window.alert(`El hilo se creó, pero no pude subir los adjuntos: ${error.message}`);
        }
      }

      const created = normalizeThread(data.item);
      threadRepliesCache.set(created.id, []);

      notifyCommunity({
        type: "community_new_post",
        title: "Nuevo hilo en Comunidad",
        body: `${TYPE_LABELS[type] || "Publicación"}: ${title}`,
        actor: currentUserName(),
        meta: { postId: created.id, postTitle: title, postType: type, course },
      });

      els.form.reset();
      pendingAttachments = [];
      renderAttachmentPreview();
      closeComposer();

      await renderPosts();
    } catch (error) {
      console.error("Comunidad: no pude crear hilo.", error);
      window.alert(`No pude crear el hilo: ${error.message}`);
    }
  }

  async function addComment(postId, content, textarea) {
    const post = getPostFromState(postId);

    try {
      await communityApi(`/community/threads/${encodeURIComponent(postId)}/replies`, {
        method: "POST",
        body: { body: content },
      });

      await loadThreadDetail(postId);

      notifyCommunity({
        type: "community_reply",
        title: "Nueva respuesta en Comunidad",
        body: `Respondieron en: ${post?.title || "un hilo"}`,
        actor: currentUserName(),
        meta: { postId, postTitle: post?.title },
      });

      if (textarea) textarea.value = "";

      const currentScroll = window.scrollY;
      await renderPosts();
      window.scrollTo({ top: currentScroll });

      const card = document.querySelector(`[data-post-id="${CSS.escape(postId)}"]`);
      const comments = card?.querySelector(".community-comments");
      const icon = card?.querySelector("[data-community-toggle-comments] i");

      if (comments) comments.hidden = false;
      if (icon) icon.className = "fa-solid fa-chevron-up";
    } catch (error) {
      console.error("Comunidad: no pude responder.", error);
      window.alert(`No pude responder el hilo: ${error.message}`);
    }
  }

  async function toggleResolved(postId) {
    const post = getPostFromState(postId);

    if (!post) return;

    const nextStatus = post.status === "resuelto" ? "abierto" : "resuelto";

    try {
      await communityApi(`/community/threads/${encodeURIComponent(postId)}/status`, {
        method: "PATCH",
        body: {
          status: nextStatus,
          reason: nextStatus === "resuelto" ? "Marcado como resuelto desde Comunidad." : "Reabierto desde Comunidad.",
        },
      });

      notifyCommunity({
        type: "community_status",
        title: nextStatus === "resuelto" ? "Hilo marcado como resuelto" : "Hilo reabierto",
        body: post.title,
        actor: currentUserName(),
        meta: { postId, postTitle: post.title, status: nextStatus },
      });

      await renderPosts();
    } catch (error) {
      console.error("Comunidad: no pude cambiar estado.", error);
      window.alert(`No pude cambiar el estado: ${error.message}`);
    }
  }

  async function deletePost(postId) {
    const post = getPostFromState(postId);
    const ok = window.confirm("¿Borrar este hilo de la Comunidad? Se ocultará para todos, pero queda auditado.");
    if (!ok) return;

    try {
      await communityApi(`/community/threads/${encodeURIComponent(postId)}`, {
        method: "DELETE",
      });

      notifyCommunity({
        type: "community_status",
        title: "Hilo eliminado",
        body: `Se ha eliminado el hilo: ${post?.title || postId}`,
        actor: currentUserName(),
        meta: {
          postId,
          postTitle: post?.title,
          status: "eliminado",
          action: "delete_thread",
        },
      });

      threadRepliesCache.delete(postId);
      await renderPosts();
    } catch (error) {
      console.error("Comunidad: no pude borrar hilo.", error);
      window.alert(`No pude borrar el hilo: ${error.message}`);
    }
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
    window.alert("Los ejemplos locales quedan desactivados ahora que Comunidad usa backend real.");
  }

  function getFilterToggle() {
    return document.getElementById("communityFilterToggle");
  }

  function setFiltersOpen(open) {
    const panel = els.filtersPanel || document.getElementById("communityFiltersPanel");
    const toggle = getFilterToggle();

    if (!panel) return;

    panel.classList.toggle("is-collapsed", !open);
    panel.hidden = false;

    toggle?.setAttribute("aria-expanded", String(open));
  }

  function toggleFiltersPanel() {
    const panel = els.filtersPanel || document.getElementById("communityFiltersPanel");

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
      input?.addEventListener("input", () => renderPosts());
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

  function injectCommunityAttachmentStyles() {
    if (document.getElementById("communityAttachmentStyles")) return;

    const style = document.createElement("style");
    style.id = "communityAttachmentStyles";
    style.textContent = `
      .community-post-attachments {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
        gap: 0.75rem;
        margin: 1rem 0;
      }

      .community-post-attachment {
        border: 1px solid rgba(125, 249, 255, 0.28);
        border-radius: 16px;
        background: rgba(8, 12, 28, 0.52);
        color: inherit;
        padding: 0.55rem;
        cursor: pointer;
        text-align: left;
        overflow: hidden;
        text-decoration: none;
        min-height: 126px;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        justify-content: center;
      }

      .community-post-attachment:hover {
        transform: translateY(-1px);
        border-color: rgba(125, 249, 255, 0.55);
      }

      .community-post-attachment img {
        width: 100%;
        height: 112px;
        object-fit: contain;
        border-radius: 12px;
        display: block;
        background: rgba(0, 0, 0, 0.18);
      }

      .community-post-attachment span {
        display: block;
        font-size: 0.8rem;
        opacity: 0.9;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .community-post-attachment small,
      .community-attachment-preview small {
        opacity: 0.68;
        font-size: 0.72rem;
        margin-left: 0.35rem;
      }

      .community-file-tile {
        width: 100%;
        min-height: 74px;
        border-radius: 12px;
        display: grid !important;
        place-items: center;
        background: rgba(125, 249, 255, 0.08);
        font-size: 2rem !important;
      }

      .community-attachment-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        padding: 1rem;
      }

      .community-attachment-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.78);
        backdrop-filter: blur(6px);
      }

      .community-attachment-modal figure {
        position: relative;
        z-index: 1;
        width: min(980px, 96vw);
        max-height: 92vh;
        margin: 0;
        border: 1px solid rgba(125, 249, 255, 0.35);
        border-radius: 22px;
        background: rgba(8, 12, 28, 0.96);
        padding: 1rem;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
      }

      .community-attachment-modal figure button {
        position: absolute;
        top: 0.65rem;
        right: 0.65rem;
        z-index: 2;
      }

      .community-attachment-modal img,
      .community-attachment-modal iframe {
        width: 100%;
        max-height: 78vh;
        min-height: 360px;
        border: 0;
        border-radius: 16px;
        display: block;
        object-fit: contain;
        background: rgba(0, 0, 0, 0.25);
      }

      .community-attachment-modal figcaption {
        margin-top: 0.7rem;
        font-size: 0.85rem;
        opacity: 0.85;
      }
    `;

    document.head.appendChild(style);
  }


  function init() {
    injectCommunityApiV2Styles();
    injectCommunityAttachmentStyles();
    cacheElements();
    bindEvents();
    renderPosts();
  }

  document.addEventListener("DOMContentLoaded", init);
  // COMMUNITY_DRIVE_THUMBNAILS_FIX_20260625
  // COMMUNITY_ATTACHMENTS_FRONT_APPS_SCRIPT_V1_20260625
})();


/* ============================================================
   COMMUNITY_PUBLISH_OVERLAY_JS_20260625
   Overlay de publicación + anti doble click + progreso visual.
   No reemplaza la lógica existente: la envuelve desde afuera.
============================================================ */
(function communityPublishOverlayPatch() {
  const PATCH_ID = "COMMUNITY_PUBLISH_OVERLAY_JS_20260625";

  if (window.__communityPublishOverlayPatchApplied) {
    return;
  }

  window.__communityPublishOverlayPatchApplied = true;

  let isPublishing = false;
  let relevantRequests = 0;
  let hideTimer = null;
  let softProgressTimer = null;
  let lastKnownPercent = 0;
  let currentSubmitButton = null;
  let originalButtonHtml = "";
  let originalBodyOverflow = "";

  function clampPercent(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  function ui() {
    return {
      overlay: document.getElementById("communityPublishOverlay"),
      title: document.getElementById("communityPublishTitle"),
      message: document.getElementById("communityPublishMessage"),
      bar: document.getElementById("communityPublishProgressBar"),
      percent: document.getElementById("communityPublishPercent"),
      detail: document.getElementById("communityPublishDetail"),
    };
  }

  function setProgress(percent, message, detail, title) {
    const els = ui();
    const value = clampPercent(percent);
    lastKnownPercent = Math.max(lastKnownPercent, value);

    if (els.title && title) els.title.textContent = title;
    if (els.message && message) els.message.textContent = message;
    if (els.detail && detail) els.detail.textContent = detail;
    if (els.percent) els.percent.textContent = `${Math.round(lastKnownPercent)}%`;
    if (els.bar) els.bar.style.width = `${lastKnownPercent}%`;
  }

  function findPublishButtonFromTarget(target) {
    const direct = target?.closest?.("button, input[type='submit']");

    function isRealPublishButton(el) {
      if (!el) return false;

      const text = `${el.textContent || ""} ${el.value || ""}`.trim().toLowerCase();
      const id = String(el.id || "").toLowerCase();
      const cls = String(el.className || "").toLowerCase();
      const datasetKeys = Object.keys(el.dataset || {}).join(" ").toLowerCase();

      const insideCommunity =
        el.closest?.(".page-community") ||
        document.body?.classList?.contains("page-community");

      if (!insideCommunity) return false;

      // IMPORTANTE:
      // No agarrar "Abrir hilo", "Responder", "Borrar", "Marcar resuelto", etc.
      if (
        text.includes("abrir hilo") ||
        text.includes("responder") ||
        text.includes("borrar") ||
        text.includes("marcar resuelto") ||
        text.includes("ver hilo")
      ) {
        return false;
      }

      // Solo el botón real de creación/publicación.
      return (
        text.includes("publicar hilo") ||
        id.includes("communitysubmit") ||
        id.includes("community-submit") ||
        cls.includes("community-submit") ||
        datasetKeys.includes("communitysubmit") ||
        datasetKeys.includes("communitySubmit") ||
        el.getAttribute("type") === "submit"
      );
    }

    if (isRealPublishButton(direct)) {
      return direct;
    }

    const form =
      target?.closest?.("form") ||
      document.querySelector("#communityForm") ||
      document.querySelector("[data-community-form]");

    const scopedButton =
      form?.querySelector?.("button[type='submit'], input[type='submit']") ||
      null;

    if (isRealPublishButton(scopedButton)) {
      return scopedButton;
    }

    const allButtons = Array.from(document.querySelectorAll("button, input[type='submit']"));
    return allButtons.find(isRealPublishButton) || null;
  }

  // COMMUNITY_PUBLISH_OVERLAY_BUTTON_SCOPE_FIX_20260625

  function setButtonBusy(btn) {
    if (!btn) return;

    currentSubmitButton = btn;

    if (!originalButtonHtml) {
      originalButtonHtml = btn.innerHTML || btn.textContent || "Publicar hilo";
    }

    btn.disabled = true;
    btn.setAttribute("aria-disabled", "true");
    btn.classList.add("community-publish-busy");
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Publicando...`;
  }

  function clearButtonBusy() {
    const btn = currentSubmitButton;

    if (!btn) return;

    btn.disabled = false;
    btn.removeAttribute("aria-disabled");
    btn.classList.remove("community-publish-busy");

    if (originalButtonHtml) {
      btn.innerHTML = originalButtonHtml;
    }

    currentSubmitButton = null;
    originalButtonHtml = "";
  }

  function showOverlay(btn) {
    const els = ui();

    if (!els.overlay) {
      return;
    }

    clearTimeout(hideTimer);
    clearInterval(softProgressTimer);

    isPublishing = true;
    lastKnownPercent = 0;

    originalBodyOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";

    els.overlay.classList.remove("community-publish-hidden");
    els.overlay.setAttribute("aria-hidden", "false");

    setButtonBusy(btn);

    setProgress(
      3,
      "Preparando publicación...",
      "Por favor esperá. No vuelvas a tocar el botón.",
      "Creando hilo con adjuntos"
    );

    softProgressTimer = setInterval(() => {
      if (!isPublishing) return;

      let next = lastKnownPercent;

      if (next < 12) next += 1.5;
      else if (next < 35) next += 0.8;
      else if (next < 72) next += 0.45;
      else if (next < 88) next += 0.18;

      if (next !== lastKnownPercent) {
        setProgress(next);
      }
    }, 380);
  }

  function hideOverlaySoon() {
    clearTimeout(hideTimer);

    hideTimer = setTimeout(() => {
      if (relevantRequests > 0) return;

      setProgress(
        100,
        "Hilo publicado correctamente.",
        "Actualizando la comunidad...",
        "Listo"
      );

      setTimeout(() => {
        const els = ui();

        clearInterval(softProgressTimer);
        softProgressTimer = null;

        if (els.overlay) {
          els.overlay.classList.add("community-publish-hidden");
          els.overlay.setAttribute("aria-hidden", "true");
        }

        clearButtonBusy();

        document.body.style.overflow = originalBodyOverflow;
        originalBodyOverflow = "";

        isPublishing = false;
        lastKnownPercent = 0;
      }, 520);
    }, 950);
  }

  function failOverlay(message) {
    clearTimeout(hideTimer);
    clearInterval(softProgressTimer);
    softProgressTimer = null;

    setProgress(
      100,
      message || "No pude completar la publicación.",
      "Revisá el mensaje de error o probá nuevamente.",
      "Algo salió mal"
    );

    setTimeout(() => {
      const els = ui();

      if (els.overlay) {
        els.overlay.classList.add("community-publish-hidden");
        els.overlay.setAttribute("aria-hidden", "true");
      }

      clearButtonBusy();

      document.body.style.overflow = originalBodyOverflow;
      originalBodyOverflow = "";

      isPublishing = false;
      lastKnownPercent = 0;
      relevantRequests = 0;
    }, 900);
  }

  function isCommunityThreadPost(url, options) {
    const text = String(url || "");
    const method = String(options?.method || "GET").toUpperCase();

    return (
      method === "POST" &&
      text.includes("/api/classroom/community/threads") &&
      !text.includes("/attachments") &&
      !text.includes("/replies")
    );
  }

  function isCommunityAttachmentPost(url, options) {
    const text = String(url || "");
    const method = String(options?.method || "GET").toUpperCase();

    return (
      method === "POST" &&
      text.includes("/api/classroom/community/threads/") &&
      text.includes("/attachments")
    );
  }

  function describeFilesFromBody(body) {
    try {
      if (!(body instanceof FormData)) {
        return { count: 0, totalBytes: 0, names: [] };
      }

      const files = [];

      body.forEach((value) => {
        if (value instanceof File) {
          files.push(value);
        }
      });

      return {
        count: files.length,
        totalBytes: files.reduce((sum, file) => sum + (file.size || 0), 0),
        names: files.map((file) => file.name).filter(Boolean),
      };
    } catch (_) {
      return { count: 0, totalBytes: 0, names: [] };
    }
  }

  function startFromUserAction(event) {
    const btn = findPublishButtonFromTarget(event.target);

    if (!btn) return;

    if (isPublishing) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    showOverlay(btn);
  }

  // COMMUNITY_PUBLISH_OVERLAY_SAFE_SCOPE_20260625: no activar overlay por clicks globales.
  // document.addEventListener("click", startFromUserAction, true);
  // COMMUNITY_PUBLISH_OVERLAY_SAFE_SCOPE_20260625: no activar overlay por submit global.
const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedCommunityPublishFetch(input, options = {}) {
    const url = typeof input === "string" ? input : input?.url || "";
    const isThread = isCommunityThreadPost(url, options);
    const isAttachment = isCommunityAttachmentPost(url, options);

    if (!isThread && !isAttachment) {
      return originalFetch(input, options);
    }

    relevantRequests += 1;
    clearTimeout(hideTimer);

    if (isThread) {
      if (!isPublishing) {
        const realPublishButton =
          Array.from(document.querySelectorAll("button, input[type='submit']")).find((el) => {
            const text = `${el.textContent || ""} ${el.value || ""}`.trim().toLowerCase();
            return text.includes("publicar hilo");
          }) || null;

        showOverlay(realPublishButton);
      }

      setProgress(
        Math.max(lastKnownPercent, 12),
        "Creando hilo base...",
        "Estamos guardando el título y el contenido.",
        "Creando hilo"
      );
    }

    if (isAttachment) {
      const info = describeFilesFromBody(options?.body);
      const detail =
        info.count > 1
          ? `${info.count} archivos en cola`
          : info.names[0] || "Subiendo archivo";

      setProgress(
        Math.max(lastKnownPercent, 34),
        "Subiendo adjuntos...",
        detail,
        "Creando hilo con adjuntos"
      );
    }

    try {
      const response = await originalFetch(input, options);

      if (isThread) {
        setProgress(
          Math.max(lastKnownPercent, 28),
          "Hilo creado. Preparando adjuntos...",
          "Ya tenemos el hilo, falta procesar archivos.",
          "Hilo creado"
        );
      }

      if (isAttachment) {
        setProgress(
          Math.max(lastKnownPercent, 92),
          "Adjuntos subidos.",
          "Procesando vista previa y actualizando la lista.",
          "Finalizando"
        );
      }

      if (!response.ok) {
        failOverlay(`La publicación respondió con error HTTP ${response.status}.`);
      }

      return response;
    } catch (error) {
      failOverlay(error?.message || "Falló la publicación.");
      throw error;
    } finally {
      relevantRequests = Math.max(0, relevantRequests - 1);
      hideOverlaySoon();
    }
  };
console.log(`[Comunidad] ${PATCH_ID} activo.`);
})();

// COMMUNITY_PUBLISH_OVERLAY_SAFE_SCOPE_20260625
