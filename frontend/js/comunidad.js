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
      authorDni: item.author_dni || item.authorDni || "",
      authorTwitch: item.author_twitch || item.authorTwitch || "",
      authorName: item.author_name || item.authorName || "",
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


  // COMMUNITY_AUTHOR_TWITCH_DISPLAY_20260626
  function communityAuthorDisplay(entity, fallback = "Usuario") {
    const twitch = String(
      entity?.authorTwitch ||
      entity?.author_twitch ||
      entity?.twitch ||
      ""
    ).trim();

    if (twitch) {
      return twitch.startsWith("@") ? twitch : `@${twitch}`;
    }

    const name = String(
      entity?.authorName ||
      entity?.author_name ||
      entity?.name ||
      ""
    ).trim();

    if (name) {
      return name;
    }

    const dni = String(
      entity?.authorDni ||
      entity?.author_dni ||
      entity?.dni ||
      ""
    ).trim();

    if (dni) {
      return `DNI ${dni}`;
    }

    const role = String(
      entity?.authorRole ||
      entity?.author_role ||
      entity?.role ||
      ""
    ).trim().toLowerCase();

    if (role === "teacher" || role === "docente") return "Docente";
    if (role === "moderador" || role === "moderator") return "Moderador";

    return fallback;
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

        ${renderCommunityThreadModerationActions(post)}

        <div class="community-post-meta">
          <span><i class="fa-solid fa-user-astronaut"></i> ${escapeHtml(post.author)}</span>
          <span><i class="fa-regular fa-clock"></i> ${formatDate(post.createdAt)}</span>
          <span><i class="fa-regular fa-comment"></i> ${commentsCount} respuestas</span>
        </div>

        <div class="community-post-actions">
          <button class="btn btn-outline btn-sm" type="button" data-community-toggle-comments-bottom>
            <i class="fa-solid fa-comments"></i>
            <span data-community-replies-label>${commentsCount > 0 ? `Ver respuestas (${commentsCount})` : "Ver respuestas"}</span>
          </button>

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

        normalizeThreadActionButtonOrder(newCard);
        mountReplyModerationToolbars(newCard);
        mountCommunityAuthorDisplays(newCard, postId);

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


  // COMMUNITY_REPLY_MODERATION_DOM_MOUNT_20260626
  function normalizeThreadActionButtonOrder(card) {
    if (!card) return;

    const replyButton = card.querySelector("[data-community-reply]");
    const repliesButton = card.querySelector("[data-community-toggle-comments-bottom]");

    if (
      replyButton &&
      repliesButton &&
      replyButton.parentElement &&
      replyButton.parentElement === repliesButton.parentElement
    ) {
      replyButton.after(repliesButton);
    }
  }


  function bindReplyModerationGlobalClose() {
    if (window.__communityReplyModerationGlobalCloseBound) return;
    window.__communityReplyModerationGlobalCloseBound = true;

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-community-reply-moderation]")) {
        return;
      }

      document.querySelectorAll("[data-community-reply-mod-popover]").forEach((popover) => {
        popover.hidden = true;
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;

      document.querySelectorAll("[data-community-reply-mod-popover]").forEach((popover) => {
        popover.hidden = true;
      });
    });
  }


  function mountReplyModerationToolbars(card) {
    if (!card || !currentCommunityUserIsStaff()) {
      return;
    }

    card.querySelectorAll(".community-comment[data-reply-id]").forEach((comment) => {
      const replyId = comment.dataset.replyId;

      if (!replyId) return;

      if (!comment.querySelector("[data-community-reply-moderation]")) {
        const reply = findReplyInCache(replyId);

        if (!reply) return;

        comment.insertAdjacentHTML("beforeend", renderCommunityReplyModerationActions(reply));
      }

      if (comment.dataset.replyModerationBound === "1") {
        return;
      }

      comment.dataset.replyModerationBound = "1";

      comment.querySelector("[data-community-reply-mod-trigger]")?.addEventListener("click", (event) => {
        event.stopPropagation();

        const popover = comment.querySelector("[data-community-reply-mod-popover]");
        if (!popover) return;

        const willOpen = popover.hidden;

        document.querySelectorAll("[data-community-reply-mod-popover]").forEach((item) => {
          if (item !== popover) {
            item.hidden = true;
          }
        });

        popover.hidden = !willOpen;
      });

      comment.querySelector("[data-community-reply-hide]")?.addEventListener("click", () => {
        toggleReplyHidden(replyId, true);
      });

      comment.querySelector("[data-community-reply-unhide]")?.addEventListener("click", () => {
        toggleReplyHidden(replyId, false);
      });

      comment.querySelectorAll("[data-community-sanction-reply-author]").forEach((button) => {
        button.addEventListener("click", () => {
          sanctionReplyAuthor(replyId, button.dataset.communitySanctionReplyAuthor);
        });
      });
    });
  }



  // COMMUNITY_AUTHOR_ROLE_DOM_REPLACE_20260626
  function replaceRoleTextNodesWithAuthor(root, displayName) {
    if (!root || !displayName) return;

    const blockedSelectors = [
      "button",
      "input",
      "textarea",
      "select",
      "[data-community-reply-mod-popover]",
      "[data-community-reply-moderation]",
      "[data-community-thread-moderation]",
      ".community-mod-toolbar",
      ".community-reply-mod-menu"
    ].join(",");

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;

          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest(blockedSelectors)) return NodeFilter.FILTER_REJECT;

          const text = String(node.nodeValue || "").trim();

          if (["Docente", "Moderador", "Alumno", "Teacher", "Moderator"].includes(text)) {
            return NodeFilter.FILTER_ACCEPT;
          }

          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    nodes.forEach((node) => {
      node.nodeValue = node.nodeValue.replace(
        /(Docente|Moderador|Alumno|Teacher|Moderator)/g,
        displayName
      );
    });
  }

  function mountCommunityAuthorDisplays(card, postId) {
    if (!card) return;

    const post = getPostFromState(postId);

    if (post) {
      const postDisplay = communityAuthorDisplay(post, "Usuario");

      // Reemplaza el rol del encabezado/meta del hilo, pero no toca respuestas.
      Array.from(card.childNodes).forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(".community-comments")) {
          return;
        }

        replaceRoleTextNodesWithAuthor(node, postDisplay);
      });
    }

    card.querySelectorAll(".community-comment[data-reply-id]").forEach((comment) => {
      const replyId = comment.dataset.replyId;
      const reply = findReplyInCache(replyId);

      if (!reply) return;

      const replyDisplay = communityAuthorDisplay(reply, "Usuario");
      replaceRoleTextNodesWithAuthor(comment, replyDisplay);
    });
  }


  function bindPostCardEvents() {
    document.querySelectorAll(".community-post-card[data-post-id]").forEach((card) => {
      const postId = card.dataset.postId;

      normalizeThreadActionButtonOrder(card);
      mountReplyModerationToolbars(card);
      mountCommunityAuthorDisplays(card, postId);

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


      card.querySelector("[data-community-toggle-comments-bottom]")?.addEventListener("click", async () => {
        await openComments(postId, card);

        const currentCard = document.querySelector(`[data-post-id="${CSS.escape(postId)}"]`) || card;
        const comments = currentCard?.querySelector(".community-comments");
        const label = currentCard?.querySelector("[data-community-replies-label]");
        const icon = currentCard?.querySelector("[data-community-toggle-comments-bottom] i");

        if (label && comments) {
          label.textContent = comments.hidden ? `Ver respuestas` : `Ocultar respuestas`;
        }

        if (icon && comments) {
          icon.className = comments.hidden ? "fa-solid fa-comments" : "fa-solid fa-comments-slash";
        }
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

      card.querySelector("[data-community-thread-hide]")?.addEventListener("click", () => {
        toggleThreadHidden(postId, true);
      });

      card.querySelector("[data-community-thread-unhide]")?.addEventListener("click", () => {
        toggleThreadHidden(postId, false);
      });

      card.querySelectorAll("[data-community-sanction-author]").forEach((button) => {
        button.addEventListener("click", () => {
          sanctionThreadAuthor(postId, button.dataset.communitySanctionAuthor);
        });
      });

      card.querySelectorAll("[data-community-reply-hide]").forEach((button) => {
        button.addEventListener("click", () => {
          const replyId = button.closest("[data-reply-id]")?.dataset?.replyId;
          if (replyId) toggleReplyHidden(replyId, true);
        });
      });

      card.querySelectorAll("[data-community-reply-unhide]").forEach((button) => {
        button.addEventListener("click", () => {
          const replyId = button.closest("[data-reply-id]")?.dataset?.replyId;
          if (replyId) toggleReplyHidden(replyId, false);
        });
      });

      card.querySelectorAll("[data-community-sanction-reply-author]").forEach((button) => {
        button.addEventListener("click", () => {
          const replyId = button.closest("[data-reply-id]")?.dataset?.replyId;
          if (replyId) sanctionReplyAuthor(replyId, button.dataset.communitySanctionReplyAuthor);
        });
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


  // COMMUNITY_THREAD_MODERATION_UI_V1_20260626
  function currentCommunityUserIsStaff() {
    const session = readSession();
    const role = String(session?.role || "").toLowerCase();

    return Boolean(session?.is_staff) ||
      ["teacher", "docente", "moderador", "moderator", "admin"].includes(role);
  }

  function threadAuthorLabel(post) {
    return (
      post?.authorName ||
      post?.author_name ||
      post?.authorTwitch ||
      post?.author_twitch ||
      post?.authorDni ||
      post?.author_dni ||
      "este usuario"
    );
  }

  function renderCommunityThreadModerationActions(post) {
    if (!currentCommunityUserIsStaff()) {
      return "";
    }

    const isHidden = Boolean(post?.isHidden || post?.is_hidden);
    const author = escapeHtml(threadAuthorLabel(post));

    return `
      <div class="community-mod-toolbar community-mod-toolbar-thread" data-community-thread-moderation title="Moderación del hilo">
        <button
          class="community-mod-btn ${isHidden ? "restore" : "hide"}"
          type="button"
          data-community-thread-${isHidden ? "unhide" : "hide"}
          title="${isHidden ? "Restaurar hilo" : "Ocultar hilo"}"
          aria-label="${isHidden ? "Restaurar hilo" : "Ocultar hilo"}"
        >
          <i class="fa-solid ${isHidden ? "fa-eye" : "fa-eye-slash"}"></i>
        </button>

        <button
          class="community-mod-btn mute"
          type="button"
          data-community-sanction-author="mute"
          title="Silenciar autor: ${author}"
          aria-label="Silenciar autor"
        >
          <i class="fa-solid fa-volume-xmark"></i>
        </button>

        <button
          class="community-mod-btn ban"
          type="button"
          data-community-sanction-author="ban"
          title="Banear autor: ${author}"
          aria-label="Banear autor"
        >
          <i class="fa-solid fa-ban"></i>
        </button>
      </div>

      ${isHidden ? `
        <div class="community-mod-hidden-label">
          <i class="fa-solid fa-eye-slash"></i>
          Hilo oculto para alumnos
        </div>
      ` : ""}
    `;
  }


  function replyAuthorLabel(reply) {
    return (
      reply?.authorName ||
      reply?.author_name ||
      reply?.authorTwitch ||
      reply?.author_twitch ||
      reply?.authorDni ||
      reply?.author_dni ||
      "este usuario"
    );
  }

  function renderCommunityReplyModerationActions(reply) {
    if (!currentCommunityUserIsStaff()) {
      return "";
    }

    const isHidden = Boolean(reply?.isHidden || reply?.is_hidden);
    const author = escapeHtml(replyAuthorLabel(reply));

    return `
      <div class="community-reply-mod-menu" data-community-reply-moderation>
        <button
          class="community-reply-mod-trigger"
          type="button"
          data-community-reply-mod-trigger
          title="Opciones de moderación"
          aria-label="Opciones de moderación"
        >
          <i class="fa-solid fa-ellipsis"></i>
        </button>

        <div class="community-reply-mod-popover" data-community-reply-mod-popover hidden>
          <div class="community-reply-mod-popover-title">
            <i class="fa-solid fa-shield-halved"></i>
            Moderar respuesta
          </div>

          <button
            class="community-reply-mod-action ${isHidden ? "restore" : "hide"}"
            type="button"
            data-community-reply-${isHidden ? "unhide" : "hide"}
            title="${isHidden ? "Restaurar respuesta" : "Ocultar respuesta"}"
          >
            <i class="fa-solid ${isHidden ? "fa-eye" : "fa-eye-slash"}"></i>
            <span>${isHidden ? "Restaurar" : "Ocultar"}</span>
          </button>

          <button
            class="community-reply-mod-action mute"
            type="button"
            data-community-sanction-reply-author="mute"
            title="Silenciar autor: ${author}"
          >
            <i class="fa-solid fa-volume-xmark"></i>
            <span>Silenciar</span>
          </button>

          <button
            class="community-reply-mod-action ban"
            type="button"
            data-community-sanction-reply-author="ban"
            title="Banear autor: ${author}"
          >
            <i class="fa-solid fa-ban"></i>
            <span>Banear</span>
          </button>
        </div>
      </div>

      ${isHidden ? `
        <div class="community-mod-hidden-label reply">
          <i class="fa-solid fa-eye-slash"></i>
          Respuesta oculta para alumnos
        </div>
      ` : ""}
    `;
  }

  async function toggleReplyHidden(replyId, shouldHide) {
    const reply = findReplyInCache(replyId);

    if (!reply) {
      window.alert("No pude encontrar la respuesta en memoria.");
      return;
    }

    const actionLabel = shouldHide ? "ocultar" : "restaurar";
    const defaultReason = shouldHide
      ? "Respuesta ocultada por moderación."
      : "Respuesta restaurada por moderación.";

    const reason = window.prompt(`Motivo para ${actionLabel} esta respuesta:`, defaultReason);

    if (reason === null) return;

    try {
      await communityApi(`/community/replies/${encodeURIComponent(replyId)}/${shouldHide ? "hide" : "unhide"}`, {
        method: "PATCH",
        body: {
          reason: reason || defaultReason,
        },
      });

      await renderPosts();
    } catch (error) {
      console.error(error);
      window.alert(error.message || `No pude ${actionLabel} la respuesta.`);
    }
  }

  async function sanctionReplyAuthor(replyId, sanctionType) {
    const reply = findReplyInCache(replyId);

    if (!reply) {
      window.alert("No pude encontrar la respuesta en memoria.");
      return;
    }

    const cleanType = sanctionType === "ban" ? "ban" : "mute";
    const authorName = replyAuthorLabel(reply);
    const actionLabel = cleanType === "ban" ? "banear" : "silenciar";

    const ok = window.confirm(`¿Seguro que querés ${actionLabel} a ${authorName}?`);

    if (!ok) return;

    const defaultReason = cleanType === "ban"
      ? "Baneo aplicado desde una respuesta de Comunidad."
      : "Silencio aplicado desde una respuesta de Comunidad.";

    const reason = window.prompt(`Motivo para ${actionLabel} a ${authorName}:`, defaultReason);

    if (reason === null) return;

    const payload = {
      target_dni: reply.authorDni || reply.author_dni || null,
      target_twitch: reply.authorTwitch || reply.author_twitch || null,
      target_name: reply.authorName || reply.author_name || authorName || null,
      target_role: reply.authorRole || reply.author_role || "alumno",
      sanction_type: cleanType,
      reason: reason || defaultReason,
      expires_at: null,
    };

    if (!payload.target_dni && !payload.target_twitch) {
      window.alert("Esta respuesta no tiene DNI/Twitch del autor para aplicar sanción.");
      return;
    }

    try {
      await communityApi("/community/admin/sanctions", {
        method: "POST",
        body: payload,
      });

      window.alert(`${cleanType === "ban" ? "Baneo" : "Silencio"} aplicado correctamente.`);
    } catch (error) {
      console.error(error);
      window.alert(error.message || "No pude aplicar la sanción.");
    }
  }

  function findReplyInCache(replyId) {
    for (const replies of threadRepliesCache.values()) {
      const found = (replies || []).find((reply) => String(reply.id) === String(replyId));

      if (found) {
        return found;
      }
    }

    return null;
  }


  async function toggleThreadHidden(postId, shouldHide) {
    const post = getPostFromState(postId);

    if (!post) {
      window.alert("No pude encontrar el hilo en memoria.");
      return;
    }

    const actionLabel = shouldHide ? "ocultar" : "restaurar";
    const defaultReason = shouldHide
      ? "Hilo ocultado por moderación."
      : "Hilo restaurado por moderación.";

    const reason = window.prompt(`Motivo para ${actionLabel} este hilo:`, defaultReason);

    if (reason === null) return;

    try {
      await communityApi(`/community/threads/${encodeURIComponent(postId)}/${shouldHide ? "hide" : "unhide"}`, {
        method: "PATCH",
        body: {
          reason: reason || defaultReason,
        },
      });
      // Moderación interna: se audita en backend, no genera notificación global.

      await renderPosts();
    } catch (error) {
      console.error(error);
      window.alert(error.message || `No pude ${actionLabel} el hilo.`);
    }
  }

  async function sanctionThreadAuthor(postId, sanctionType) {
    const post = getPostFromState(postId);

    if (!post) {
      window.alert("No pude encontrar el hilo en memoria.");
      return;
    }

    const cleanType = sanctionType === "ban" ? "ban" : "mute";
    const authorName = threadAuthorLabel(post);
    const actionLabel = cleanType === "ban" ? "banear" : "silenciar";

    const ok = window.confirm(`¿Seguro que querés ${actionLabel} a ${authorName}?`);

    if (!ok) return;

    const defaultReason = cleanType === "ban"
      ? `Baneo aplicado desde el hilo: ${post.title || "sin título"}`
      : `Silencio aplicado desde el hilo: ${post.title || "sin título"}`;

    const reason = window.prompt(`Motivo para ${actionLabel} a ${authorName}:`, defaultReason);

    if (reason === null) return;

    const payload = {
      target_dni: post.authorDni || post.author_dni || null,
      target_twitch: post.authorTwitch || post.author_twitch || null,
      target_name: post.authorName || post.author_name || authorName || null,
      target_role: post.authorRole || post.author_role || "alumno",
      sanction_type: cleanType,
      reason: reason || defaultReason,
      expires_at: null,
    };

    if (!payload.target_dni && !payload.target_twitch) {
      window.alert("Este hilo no tiene DNI/Twitch del autor para aplicar sanción.");
      return;
    }

    try {
      await communityApi("/community/admin/sanctions", {
        method: "POST",
        body: payload,
      });
      // Sanción interna: se audita en backend, no genera notificación global.

      window.alert(`${cleanType === "ban" ? "Baneo" : "Silencio"} aplicado correctamente.`);
    } catch (error) {
      console.error(error);
      window.alert(error.message || "No pude aplicar la sanción.");
    }
  }

  function injectCommunityThreadModerationStyles() {
    if (document.getElementById("communityThreadModerationStyles")) return;

    const style = document.createElement("style");
    style.id = "communityThreadModerationStyles";
    style.textContent = `
      /* COMMUNITY_MODERATION_COMPACT_UI_V2_20260626 */
      .community-post-card,
      .community-comment {
        position: relative;
      }

      .community-mod-toolbar {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px;
        border-radius: 999px;
        border: 1px solid rgba(125, 231, 255, .24);
        background:
          color-mix(in srgb, var(--card-bg, #10172a) 78%, transparent);
        box-shadow:
          0 10px 28px rgba(0, 0, 0, .22),
          inset 0 0 0 1px rgba(255,255,255,.04);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      .community-mod-toolbar-thread {
        position: absolute;
        top: 14px;
        right: 16px;
        z-index: 3;
      }

      .community-comment {
        position: relative;
        padding-right: 72px;
        padding-bottom: 44px;
      }

      .community-mod-btn {
        width: 34px;
        height: 34px;
        display: inline-grid;
        place-items: center;
        border-radius: 999px;
        border: 1px solid transparent;
        cursor: pointer;
        transition:
          transform .16s ease,
          box-shadow .16s ease,
          border-color .16s ease,
          background .16s ease;
        color: var(--text-main, #eaf6ff);
        background: rgba(255,255,255,.06);
      }

      .community-mod-btn:hover {
        transform: translateY(-1px) scale(1.04);
      }

      .community-mod-btn.hide {
        color: #67e8ff;
        border-color: rgba(103,232,255,.34);
        background: rgba(103,232,255,.12);
        box-shadow: 0 0 18px rgba(103,232,255,.12);
      }

      .community-mod-btn.restore {
        color: #8dffb0;
        border-color: rgba(141,255,176,.34);
        background: rgba(141,255,176,.12);
        box-shadow: 0 0 18px rgba(141,255,176,.12);
      }

      .community-mod-btn.mute {
        color: #ffd36b;
        border-color: rgba(255,211,107,.36);
        background: rgba(255,211,107,.12);
        box-shadow: 0 0 18px rgba(255,211,107,.10);
      }

      .community-mod-btn.ban {
        color: #ff7b9b;
        border-color: rgba(255,123,155,.38);
        background: rgba(255,123,155,.12);
        box-shadow: 0 0 18px rgba(255,123,155,.10);
      }

      .community-mod-hidden-label {
        width: fit-content;
        margin-top: 10px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 10px;
        border-radius: 999px;
        font-size: .82rem;
        font-weight: 900;
        color: #ff9e9e;
        border: 1px solid rgba(255, 120, 120, .30);
        background: rgba(255, 90, 90, .10);
      }

      .community-mod-hidden-label.reply {
        margin-top: 8px;
      }

      body.light-mode .community-mod-toolbar,
      html.light-mode .community-mod-toolbar,
      [data-theme="light"] .community-mod-toolbar {
        background: rgba(255,255,255,.78);
        border-color: rgba(24, 120, 160, .24);
        box-shadow:
          0 10px 28px rgba(20, 30, 50, .13),
          inset 0 0 0 1px rgba(255,255,255,.55);
      }

      body.light-mode .community-mod-btn,
      html.light-mode .community-mod-btn,
      [data-theme="light"] .community-mod-btn {
        background: rgba(10, 30, 55, .04);
      }


      /* COMMUNITY_BOTTOM_REPLIES_BUTTON_STYLE_20260626 */
      [data-community-toggle-comments-bottom] {
        border-color: rgba(103, 235, 255, .34) !important;
        background: rgba(103, 235, 255, .08) !important;
      }

      [data-community-toggle-comments-bottom] i {
        color: #67ebff;
      }


      /* COMMUNITY_REPLY_MODERATION_DOTS_MENU_20260626 */
      .community-reply-mod-menu {
        position: absolute;
        right: 16px;
        bottom: 14px;
        z-index: 5;
      }

      .community-reply-mod-trigger {
        width: 38px;
        height: 30px;
        display: inline-grid;
        place-items: center;
        border-radius: 12px;
        border: 1px solid rgba(255, 123, 155, .42);
        color: #ff7b9b;
        background: rgba(255, 123, 155, .10);
        cursor: pointer;
        box-shadow: 0 0 18px rgba(255, 123, 155, .08);
        transition:
          transform .16s ease,
          box-shadow .16s ease,
          background .16s ease;
      }

      .community-reply-mod-trigger:hover {
        transform: translateY(-1px);
        background: rgba(255, 123, 155, .16);
        box-shadow: 0 0 22px rgba(255, 123, 155, .15);
      }

      .community-reply-mod-popover {
        position: absolute;
        right: 0;
        bottom: calc(100% + 8px);
        min-width: 190px;
        padding: 10px;
        border-radius: 16px;
        border: 1px solid rgba(125, 231, 255, .24);
        background:
          color-mix(in srgb, var(--card-bg, #10172a) 92%, #050814);
        box-shadow:
          0 18px 50px rgba(0,0,0,.34),
          inset 0 0 0 1px rgba(255,255,255,.04);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .community-reply-mod-popover[hidden] {
        display: none !important;
      }

      .community-reply-mod-popover-title {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 6px 9px;
        margin-bottom: 6px;
        color: var(--text-muted, #a9bdd8);
        font-size: .78rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .04em;
        border-bottom: 1px solid rgba(255,255,255,.08);
      }

      .community-reply-mod-action {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 9px 10px;
        border: 0;
        border-radius: 12px;
        color: var(--text-main, #eaf6ff);
        background: transparent;
        cursor: pointer;
        font-weight: 800;
        text-align: left;
        transition:
          background .16s ease,
          transform .16s ease;
      }

      .community-reply-mod-action:hover {
        transform: translateX(2px);
        background: rgba(255,255,255,.06);
      }

      .community-reply-mod-action.hide i {
        color: #67e8ff;
      }

      .community-reply-mod-action.restore i {
        color: #8dffb0;
      }

      .community-reply-mod-action.mute i {
        color: #ffd36b;
      }

      .community-reply-mod-action.ban i {
        color: #ff7b9b;
      }

      body.light-mode .community-reply-mod-popover,
      html.light-mode .community-reply-mod-popover,
      [data-theme="light"] .community-reply-mod-popover {
        background: rgba(255,255,255,.94);
        border-color: rgba(24, 120, 160, .22);
        box-shadow:
          0 18px 44px rgba(20,30,50,.16),
          inset 0 0 0 1px rgba(255,255,255,.65);
      }

      body.light-mode .community-reply-mod-action:hover,
      html.light-mode .community-reply-mod-action:hover,
      [data-theme="light"] .community-reply-mod-action:hover {
        background: rgba(20, 60, 90, .07);
      }

      @media (max-width: 640px) {
        .community-reply-mod-menu {
          right: 12px;
          bottom: 12px;
        }

        .community-reply-mod-popover {
          min-width: 176px;
        }
      }


      /* COMMUNITY_AUTHOR_TWITCH_DISPLAY_STYLE_20260626 */
      .community-comment strong,
      .community-post-meta strong,
      .community-author-name {
        letter-spacing: .01em;
      }

      @media (max-width: 720px) {
        .community-mod-toolbar-thread {
          position: static;
          margin: 12px 0 0;
          width: fit-content;
        }
      }
    `;

    document.head.appendChild(style);
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
    injectCommunityThreadModerationStyles();
    cacheElements();
    bindEvents();
    bindReplyModerationGlobalClose();
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

// COMMUNITY_MODERATION_COMPACT_UI_V2_20260626

// COMMUNITY_BOTTOM_REPLIES_BUTTON_FORCE_FIX_20260626

// COMMUNITY_REPLY_MODERATION_DOM_MOUNT_20260626

// COMMUNITY_REPLY_MODERATION_DOTS_MENU_20260626

// COMMUNITY_AUTHOR_TWITCH_DISPLAY_20260626

// COMMUNITY_AUTHOR_ROLE_DOM_REPLACE_20260626


/* ============================================================
   COMMUNITY_REPLY_ATTACHMENTS_INDEPENDENT_V2_20260626
   Adjuntos en respuestas sin depender del render interno.
============================================================ */
(() => {
  const PATCH_ID = "COMMUNITY_REPLY_ATTACHMENTS_INDEPENDENT_V2_20260626";

  if (window.__communityReplyAttachmentsIndependentV2) {
    return;
  }

  window.__communityReplyAttachmentsIndependentV2 = true;

  const pendingByPostId = new Map();
  const hydratedReplies = new Set();

  function getSession() {
    try {
      if (window.ClassroomAuth?.getSession) {
        return window.ClassroomAuth.getSession() || {};
      }

      return JSON.parse(localStorage.getItem("andyazh-classroom-session") || "{}");
    } catch (_) {
      return {};
    }
  }

  function getToken() {
    const session = getSession();

    return (
      session.access_token ||
      session.accessToken ||
      session.token ||
      session.jwt ||
      ""
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

  function formatBytes(bytes) {
    const value = Number(bytes || 0);

    if (!value) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const amount = value / Math.pow(1024, index);

    return `${amount.toFixed(amount >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function attachmentIconFromFile(file) {
    const mime = String(file?.type || file?.mime_type || "").toLowerCase();
    const name = String(file?.name || file?.filename || "").toLowerCase();

    if (mime.startsWith("image/")) return "fa-regular fa-image";
    if (mime.startsWith("video/")) return "fa-regular fa-file-video";
    if (mime.startsWith("audio/")) return "fa-regular fa-file-audio";
    if (mime.includes("pdf") || name.endsWith(".pdf")) return "fa-regular fa-file-pdf";
    if (name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".7z")) return "fa-regular fa-file-zipper";
    if (name.endsWith(".txt") || name.endsWith(".log") || name.endsWith(".md")) return "fa-regular fa-file-lines";

    return "fa-solid fa-paperclip";
  }

  function attachmentUrl(item) {
    return (
      item?.view_url ||
      item?.download_url ||
      item?.preview_url ||
      item?.url ||
      "#"
    );
  }

  function getPostIdFromCard(card) {
    return String(card?.dataset?.postId || card?.getAttribute("data-post-id") || "");
  }

  function getPending(postId) {
    const key = String(postId || "");

    if (!pendingByPostId.has(key)) {
      pendingByPostId.set(key, []);
    }

    return pendingByPostId.get(key);
  }

  function setPending(postId, files) {
    pendingByPostId.set(String(postId || ""), Array.isArray(files) ? files : []);
  }

  function clearPending(postId) {
    pendingByPostId.delete(String(postId || ""));
  }

  function findReplyTextarea(card) {
    if (!card) return null;

    return Array.from(card.querySelectorAll("textarea")).find((textarea) => {
      const placeholder = String(textarea.getAttribute("placeholder") || "").toLowerCase();
      const labelText = String(textarea.closest("section, div, form")?.textContent || "").toLowerCase();

      return (
        placeholder.includes("respuesta") ||
        placeholder.includes("solución") ||
        placeholder.includes("solucion") ||
        labelText.includes("responder hilo")
      );
    }) || null;
  }

  function renderPreview(card, postId) {
    const preview = card.querySelector("[data-reply-attachment-preview-v2]");
    const files = getPending(postId);

    if (!preview) return;

    if (!files.length) {
      preview.hidden = true;
      preview.innerHTML = "";
      return;
    }

    preview.hidden = false;
    preview.innerHTML = files.map((file, index) => `
      <div class="community-reply-attach-chip-v2">
        <i class="fa-solid ${escapeHtml(attachmentIconFromFile(file))}"></i>
        <span>${escapeHtml(file.name || "archivo")}</span>
        <small>${escapeHtml(formatBytes(file.size || 0))}</small>
        <button type="button" data-reply-attach-remove-v2="${index}" title="Quitar adjunto">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `).join("");

    preview.querySelectorAll("[data-reply-attach-remove-v2]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.replyAttachRemoveV2);
        const next = getPending(postId).filter((_, i) => i !== index);
        setPending(postId, next);
        renderPreview(card, postId);
      });
    });
  }

  function mountPickerOnCard(card) {
    if (!card || card.dataset.replyAttachmentPickerV2 === "1") return;

    const postId = getPostIdFromCard(card);
    const textarea = findReplyTextarea(card);

    if (!postId || !textarea) return;

    card.dataset.replyAttachmentPickerV2 = "1";

    const shell = document.createElement("div");
    shell.className = "community-reply-composer-shell-v2";

    textarea.parentNode.insertBefore(shell, textarea);
    shell.appendChild(textarea);

    const picker = document.createElement("div");
    picker.className = "community-reply-attachment-picker-v2";
    picker.innerHTML = `
      <input type="file" data-reply-attach-input-v2="image" accept="image/*" multiple hidden>
      <input type="file" data-reply-attach-input-v2="video" accept="video/*" multiple hidden>
      <input
        type="file"
        data-reply-attach-input-v2="file"
        accept="application/pdf,.pdf,.zip,.rar,.7z,.txt,.log,.csv,.json,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*,video/*,audio/*"
        multiple
        hidden
      >

      <button class="community-reply-attach-pick-v2 image" type="button" data-reply-attach-pick-v2="image" title="Adjuntar foto o imagen">
        <i class="fa-solid fa-image"></i>
        <span>Imagen</span>
      </button>

      <button class="community-reply-attach-pick-v2 video" type="button" data-reply-attach-pick-v2="video" title="Adjuntar video">
        <i class="fa-solid fa-video"></i>
        <span>Video</span>
      </button>

      <button class="community-reply-attach-pick-v2 file" type="button" data-reply-attach-pick-v2="file" title="Adjuntar archivo">
        <i class="fa-solid fa-paperclip"></i>
        <span>Archivo</span>
      </button>
    `;

    const preview = document.createElement("div");
    preview.className = "community-reply-attachment-preview-v2";
    preview.dataset.replyAttachmentPreviewV2 = "";
    preview.hidden = true;

    shell.appendChild(picker);
    shell.insertAdjacentElement("afterend", preview);

    picker.querySelectorAll("[data-reply-attach-pick-v2]").forEach((button) => {
      button.addEventListener("click", () => {
        const kind = button.dataset.replyAttachPickV2;
        picker.querySelector(`[data-reply-attach-input-v2="${CSS.escape(kind)}"]`)?.click();
      });
    });

    picker.querySelectorAll("[data-reply-attach-input-v2]").forEach((input) => {
      input.addEventListener("change", () => {
        const selected = Array.from(input.files || []);
        const current = getPending(postId);
        const merged = [...current, ...selected].slice(0, 20);

        setPending(postId, merged);
        renderPreview(card, postId);

        if (selected.length + current.length > 20) {
          window.alert("Solo se permiten hasta 20 adjuntos por respuesta.");
        }

        input.value = "";
      });
    });
  }

  function getBaseFromUrl(url) {
    const text = String(url || "");
    const marker = "/community/threads/";

    if (text.includes(marker)) {
      return text.slice(0, text.indexOf(marker));
    }

    const local = ["127.0.0.1", "localhost"].includes(window.location.hostname);

    return local
      ? "http://127.0.0.1:8000/api/classroom"
      : "https://exampro-backend-1n6d.onrender.com/api/classroom";
  }

  function extractPostIdFromReplyUrl(url) {
    const match = String(url || "").match(/\/community\/threads\/([^/]+)\/replies/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  async function uploadPendingForReply(baseUrl, postId, replyId) {
    const files = getPending(postId);

    if (!replyId || !files.length) {
      return [];
    }

    const token = getToken();
    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file, file.name || "archivo");
    });

    const res = await window.__communityReplyAttachmentsOriginalFetchV2(
      `${baseUrl}/community/replies/${encodeURIComponent(replyId)}/attachments`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.detail || data?.message || `Error subiendo adjuntos (${res.status})`);
    }

    clearPending(postId);

    return data.items || [];
  }

  async function fetchReplyAttachments(baseUrl, replyId) {
    if (!replyId || hydratedReplies.has(replyId)) return [];

    hydratedReplies.add(replyId);

    const token = getToken();

    const res = await window.__communityReplyAttachmentsOriginalFetchV2(
      `${baseUrl}/community/replies/${encodeURIComponent(replyId)}/attachments`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );

    if (!res.ok) return [];

    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.items) ? data.items : [];
  }

  function renderReplyAttachmentsDom(comment, items) {
    if (!comment || !items?.length) return;
    if (comment.querySelector("[data-reply-attachments-render-v2]")) return;

    const wrap = document.createElement("div");
    wrap.className = "community-reply-attachments-render-v2";
    wrap.dataset.replyAttachmentsRenderV2 = "1";

    wrap.innerHTML = items.map((item) => {
      const url = attachmentUrl(item);
      const filename = item.filename || item.name || "archivo";
      const size = formatBytes(item.size_bytes || item.size || 0);
      const icon = attachmentIconFromFile({
        type: item.mime_type,
        name: filename,
      });

      return `
        <a class="community-reply-attachment-card-v2" href="${escapeHtml(url)}" target="_blank" rel="noopener">
          <i class="fa-solid ${escapeHtml(icon)}"></i>
          <span>${escapeHtml(filename)}</span>
          <small>${escapeHtml(size)}</small>
        </a>
      `;
    }).join("");

    const modMenu = comment.querySelector("[data-community-reply-moderation]");
    if (modMenu) {
      comment.insertBefore(wrap, modMenu);
    } else {
      comment.appendChild(wrap);
    }
  }

  async function mountRenderedReplyAttachments() {
    const local = ["127.0.0.1", "localhost"].includes(window.location.hostname);
    const baseUrl = local
      ? "http://127.0.0.1:8000/api/classroom"
      : "https://exampro-backend-1n6d.onrender.com/api/classroom";

    const comments = Array.from(document.querySelectorAll(".community-comment[data-reply-id]"));

    for (const comment of comments) {
      const replyId = comment.dataset.replyId;

      if (!replyId || comment.dataset.replyAttachmentsFetchV2 === "1") continue;

      comment.dataset.replyAttachmentsFetchV2 = "1";

      try {
        const items = await fetchReplyAttachments(baseUrl, replyId);
        renderReplyAttachmentsDom(comment, items);
      } catch (error) {
        console.warn("[Comunidad] No pude renderizar adjuntos de respuesta", replyId, error);
      }
    }
  }

  function scanCommunityReplyAttachmentUi() {
    document.querySelectorAll("[data-post-id]").forEach((card) => {
      mountPickerOnCard(card);
    });

    mountRenderedReplyAttachments();
  }

  function injectStyles() {
    if (document.getElementById("communityReplyAttachmentsIndependentV2Styles")) return;

    const style = document.createElement("style");
    style.id = "communityReplyAttachmentsIndependentV2Styles";
    style.textContent = `
      .community-reply-composer-shell-v2 {
        position: relative;
        display: grid;
      }

      .community-reply-composer-shell-v2 textarea {
        padding-right: 132px !important;
        min-height: 112px;
      }

      .community-reply-attachment-picker-v2 {
        position: absolute;
        right: 12px;
        top: 12px;
        display: grid;
        gap: 7px;
        z-index: 4;
      }

      .community-reply-attach-pick-v2 {
        min-width: 104px;
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 14px;
        border: 1px solid rgba(103, 235, 255, .24);
        color: var(--text-main, #eaf6ff);
        background: rgba(103, 235, 255, .08);
        cursor: pointer;
        font-weight: 900;
        font-size: .82rem;
        box-shadow: 0 10px 24px rgba(0,0,0,.14);
        transition: transform .16s ease, box-shadow .16s ease, background .16s ease;
      }

      .community-reply-attach-pick-v2:hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 30px rgba(0,0,0,.18);
      }

      .community-reply-attach-pick-v2.image i {
        color: #67ebff;
      }

      .community-reply-attach-pick-v2.video i {
        color: #c89cff;
      }

      .community-reply-attach-pick-v2.file i {
        color: #ffd36b;
      }

      .community-reply-attachment-preview-v2,
      .community-reply-attachments-render-v2 {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .community-reply-attach-chip-v2,
      .community-reply-attachment-card-v2 {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        max-width: min(100%, 360px);
        padding: 8px 10px;
        border-radius: 14px;
        border: 1px solid rgba(103, 235, 255, .22);
        background: rgba(103, 235, 255, .08);
        color: var(--text-main, #eaf6ff);
        text-decoration: none;
      }

      .community-reply-attach-chip-v2 span,
      .community-reply-attachment-card-v2 span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .community-reply-attach-chip-v2 small,
      .community-reply-attachment-card-v2 small {
        opacity: .72;
        white-space: nowrap;
      }

      .community-reply-attach-chip-v2 button {
        display: inline-grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border: 0;
        border-radius: 999px;
        cursor: pointer;
        color: #ff8aa8;
        background: rgba(255, 123, 155, .12);
      }

      body.light-mode .community-reply-attach-pick-v2,
      html.light-mode .community-reply-attach-pick-v2,
      [data-theme="light"] .community-reply-attach-pick-v2,
      body.light-mode .community-reply-attach-chip-v2,
      html.light-mode .community-reply-attach-chip-v2,
      [data-theme="light"] .community-reply-attach-chip-v2,
      body.light-mode .community-reply-attachment-card-v2,
      html.light-mode .community-reply-attachment-card-v2,
      [data-theme="light"] .community-reply-attachment-card-v2 {
        background: rgba(255,255,255,.72);
        color: var(--text-main, #132033);
        box-shadow: 0 10px 24px rgba(20,30,50,.11);
      }

      @media (max-width: 720px) {
        .community-reply-composer-shell-v2 textarea {
          padding-right: 14px !important;
          padding-bottom: 150px !important;
        }

        .community-reply-attachment-picker-v2 {
          left: 12px;
          right: 12px;
          top: auto;
          bottom: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .community-reply-attach-pick-v2 {
          min-width: 0;
          justify-content: center;
        }

        .community-reply-attach-pick-v2 span {
          display: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  if (!window.__communityReplyAttachmentsOriginalFetchV2) {
    window.__communityReplyAttachmentsOriginalFetchV2 = window.fetch.bind(window);

    window.fetch = async function patchedReplyAttachmentsFetch(input, options = {}) {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = String(options?.method || "GET").toUpperCase();
      const isReplyCreate =
        method === "POST" &&
        String(url).includes("/community/threads/") &&
        String(url).includes("/replies");

      if (!isReplyCreate) {
        return window.__communityReplyAttachmentsOriginalFetchV2(input, options);
      }

      const postId = extractPostIdFromReplyUrl(url);
      const baseUrl = getBaseFromUrl(url);

      const response = await window.__communityReplyAttachmentsOriginalFetchV2(input, options);

      if (!response.ok) {
        return response;
      }

      try {
        const clone = response.clone();
        const data = await clone.json().catch(() => ({}));
        const replyId = data?.item?.id || data?.id;

        if (replyId) {
          await uploadPendingForReply(baseUrl, postId, replyId);
        }
      } catch (error) {
        console.error("[Comunidad] La respuesta se creó, pero falló la subida de adjuntos:", error);
        window.alert(`La respuesta se creó, pero falló la subida de adjuntos: ${error.message || error}`);
      }

      return response;
    };
  }

  function boot() {
    injectStyles();
    scanCommunityReplyAttachmentUi();

    const observer = new MutationObserver(() => {
      scanCommunityReplyAttachmentUi();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log(`[Comunidad] ${PATCH_ID} activo.`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


/* ============================================================
   COMMUNITY_REPLY_ATTACHMENTS_PRETTY_OVERRIDE_20260626
   Override visual fuerte para adjuntos en respuestas.
============================================================ */
(() => {
  const STYLE_ID = "communityReplyAttachmentsPrettyOverride20260626";

  function injectPrettyReplyAttachmentOverride() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .community-reply-composer-shell-v2 {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 62px !important;
        gap: 10px !important;
        align-items: stretch !important;
        position: relative !important;
      }

      .community-reply-composer-shell-v2 textarea {
        grid-column: 1 !important;
        padding-right: 14px !important;
        min-height: 112px !important;
      }

      .community-reply-attachment-picker-v2 {
        grid-column: 2 !important;
        position: static !important;
        inset: auto !important;
        min-width: 58px !important;
        width: 58px !important;
        height: 100% !important;
        display: grid !important;
        grid-template-rows: auto repeat(3, 42px) !important;
        align-content: start !important;
        justify-items: center !important;
        gap: 8px !important;
        padding: 10px 8px !important;
        border-radius: 18px !important;
        border: 1px solid rgba(103, 235, 255, .20) !important;
        background:
          linear-gradient(180deg, rgba(103, 235, 255, .075), rgba(179, 119, 255, .06)) !important;
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,.025),
          0 12px 28px rgba(0,0,0,.10) !important;
      }

      .community-reply-attachment-picker-v2::before {
        content: "ADJUNTAR" !important;
        display: block !important;
        margin-bottom: 2px !important;
        color: var(--text-muted, #9db4d6) !important;
        font-size: .58rem !important;
        font-weight: 950 !important;
        letter-spacing: .08em !important;
        writing-mode: vertical-rl !important;
        text-orientation: mixed !important;
        opacity: .78 !important;
      }

      .community-reply-attach-pick-v2 {
        width: 42px !important;
        min-width: 42px !important;
        max-width: 42px !important;
        height: 42px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 8px !important;
        overflow: hidden !important;
        padding: 0 12px !important;
        border-radius: 999px !important;
        cursor: pointer !important;
        font-weight: 900 !important;
        font-size: .82rem !important;
        transition:
          max-width .22s ease,
          width .22s ease,
          transform .16s ease,
          box-shadow .16s ease,
          background .16s ease !important;
      }

      .community-reply-attach-pick-v2 i {
        width: 18px !important;
        min-width: 18px !important;
        text-align: center !important;
        font-size: .95rem !important;
      }

      .community-reply-attach-pick-v2 span {
        display: inline-block !important;
        max-width: 0 !important;
        opacity: 0 !important;
        overflow: hidden !important;
        white-space: nowrap !important;
        transform: translateX(-4px) !important;
        transition:
          max-width .22s ease,
          opacity .18s ease,
          transform .18s ease !important;
      }

      .community-reply-attach-pick-v2:hover,
      .community-reply-attach-pick-v2:focus-visible,
      .community-reply-attachment-picker-v2:hover .community-reply-attach-pick-v2:hover {
        width: 116px !important;
        max-width: 116px !important;
        transform: translateX(-58px) translateY(-1px) !important;
        box-shadow: 0 14px 30px rgba(0,0,0,.18) !important;
      }

      .community-reply-attach-pick-v2:hover span,
      .community-reply-attach-pick-v2:focus-visible span {
        max-width: 74px !important;
        opacity: 1 !important;
        transform: translateX(0) !important;
      }

      .community-reply-attach-pick-v2.image i {
        color: #67ebff !important;
      }

      .community-reply-attach-pick-v2.video i {
        color: #c89cff !important;
      }

      .community-reply-attach-pick-v2.file i {
        color: #ffd36b !important;
      }

      @media (max-width: 720px) {
        .community-reply-composer-shell-v2 {
          grid-template-columns: 1fr !important;
        }

        .community-reply-attachment-picker-v2 {
          grid-column: 1 !important;
          width: 100% !important;
          min-width: 0 !important;
          height: auto !important;
          grid-template-columns: auto repeat(3, 42px) !important;
          grid-template-rows: none !important;
          justify-content: start !important;
          align-items: center !important;
        }

        .community-reply-attachment-picker-v2::before {
          writing-mode: initial !important;
          text-orientation: initial !important;
          margin: 0 4px 0 0 !important;
        }

        .community-reply-attach-pick-v2:hover,
        .community-reply-attach-pick-v2:focus-visible,
        .community-reply-attach-pick-v2:active {
          width: 108px !important;
          max-width: 108px !important;
          transform: translateY(-1px) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectPrettyReplyAttachmentOverride);
  } else {
    injectPrettyReplyAttachmentOverride();
  }
})();


// COMMUNITY_REPLY_ATTACHMENTS_PRETTY_OVERRIDE_20260626


/* ============================================================
   COMMUNITY_REPLY_ATTACHMENTS_FIXED_RAIL_20260626
   Rail fijo para adjuntos en respuestas, sin deformación.
============================================================ */
(() => {
  const STYLE_ID = "communityReplyAttachmentsFixedRail20260626";

  function injectReplyAttachmentFixedRail() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .community-reply-composer-shell-v2 {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 78px !important;
        gap: 10px !important;
        align-items: stretch !important;
      }

      .community-reply-composer-shell-v2 textarea {
        grid-column: 1 !important;
        min-height: 112px !important;
        padding-right: 14px !important;
      }

      .community-reply-attachment-picker-v2 {
        grid-column: 2 !important;
        position: relative !important;
        width: 78px !important;
        min-width: 78px !important;
        max-width: 78px !important;
        height: 100% !important;
        padding: 10px 8px !important;
        border-radius: 22px !important;
        border: 1px solid rgba(103, 235, 255, .18) !important;
        background: linear-gradient(180deg, rgba(103,235,255,.07), rgba(179,119,255,.05)) !important;
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,.02),
          0 10px 24px rgba(0,0,0,.12) !important;

        display: flex !important;
        flex-direction: column !important;
        align-items: flex-end !important;
        justify-content: center !important;
        gap: 10px !important;
        overflow: visible !important;
      }

      .community-reply-attachment-picker-v2::before {
        content: "ADJUNTAR" !important;
        position: absolute !important;
        top: 14px !important;
        right: 10px !important;
        color: var(--text-muted, #93a9c8) !important;
        font-size: .58rem !important;
        font-weight: 900 !important;
        letter-spacing: .08em !important;
        writing-mode: vertical-rl !important;
        text-orientation: mixed !important;
        opacity: .78 !important;
        pointer-events: none !important;
      }

      .community-reply-attach-pick-v2 {
        position: relative !important;
        width: 42px !important;
        min-width: 42px !important;
        max-width: 42px !important;
        height: 42px !important;
        border-radius: 999px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        overflow: visible !important;
        transition:
          transform .16s ease,
          box-shadow .16s ease,
          background .16s ease !important;
        z-index: 2 !important;
      }

      .community-reply-attach-pick-v2:hover,
      .community-reply-attach-pick-v2:focus-visible {
        transform: translateX(-2px) scale(1.04) !important;
        box-shadow: 0 10px 20px rgba(0,0,0,.18) !important;
      }

      .community-reply-attach-pick-v2 i {
        font-size: 1rem !important;
        line-height: 1 !important;
      }

      .community-reply-attach-pick-v2 span {
        position: absolute !important;
        right: calc(100% + 10px) !important;
        top: 50% !important;
        transform: translateY(-50%) translateX(8px) !important;
        opacity: 0 !important;
        pointer-events: none !important;
        white-space: nowrap !important;
        padding: 7px 12px !important;
        border-radius: 999px !important;
        font-size: .84rem !important;
        font-weight: 800 !important;
        color: #f4fbff !important;
        background: rgba(10, 22, 44, .96) !important;
        border: 1px solid rgba(103, 235, 255, .22) !important;
        box-shadow: 0 10px 26px rgba(0,0,0,.18) !important;
        transition:
          opacity .16s ease,
          transform .16s ease !important;
      }

      .community-reply-attach-pick-v2:hover span,
      .community-reply-attach-pick-v2:focus-visible span {
        opacity: 1 !important;
        transform: translateY(-50%) translateX(0) !important;
      }

      .community-reply-attach-pick-v2.image i {
        color: #67ebff !important;
      }

      .community-reply-attach-pick-v2.video i {
        color: #c89cff !important;
      }

      .community-reply-attach-pick-v2.file i {
        color: #ffd36b !important;
      }

      @media (max-width: 720px) {
        .community-reply-composer-shell-v2 {
          grid-template-columns: 1fr !important;
        }

        .community-reply-attachment-picker-v2 {
          grid-column: 1 !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          height: auto !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: flex-end !important;
          padding: 10px 12px !important;
          gap: 10px !important;
        }

        .community-reply-attachment-picker-v2::before {
          position: static !important;
          writing-mode: initial !important;
          text-orientation: initial !important;
          margin-right: auto !important;
        }

        .community-reply-attach-pick-v2 span {
          right: calc(100% + 8px) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectReplyAttachmentFixedRail);
  } else {
    injectReplyAttachmentFixedRail();
  }
})();


// COMMUNITY_REPLY_ATTACHMENTS_FIXED_RAIL_20260626


/* ============================================================
   COMMUNITY_REPLY_ATTACHMENTS_PILL_EXPAND_LEFT_20260626
   Rail fijo + botones que se expanden hacia la izquierda
   dentro del mismo pill.
============================================================ */
(() => {
  const STYLE_ID = "communityReplyAttachmentsPillExpandLeft20260626";
  const OLD_STYLE_IDS = [
    "communityReplyAttachmentsFixedRail20260626"
  ];

  function injectReplyAttachmentPillRail() {
    OLD_STYLE_IDS.forEach((id) => {
      const oldNode = document.getElementById(id);
      if (oldNode) oldNode.remove();
    });

    const prev = document.getElementById(STYLE_ID);
    if (prev) prev.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .community-reply-composer-shell-v2 {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 86px !important;
        gap: 10px !important;
        align-items: stretch !important;
      }

      .community-reply-composer-shell-v2 textarea {
        grid-column: 1 !important;
        min-height: 112px !important;
        padding-right: 14px !important;
      }

      .community-reply-attachment-picker-v2 {
        grid-column: 2 !important;
        position: relative !important;
        width: 86px !important;
        min-width: 86px !important;
        max-width: 86px !important;
        height: 100% !important;
        padding: 14px 10px !important;
        border-radius: 24px !important;
        border: 1px solid rgba(103, 235, 255, .18) !important;
        background: linear-gradient(180deg, rgba(103,235,255,.06), rgba(179,119,255,.05)) !important;
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,.02),
          0 10px 24px rgba(0,0,0,.12) !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-end !important;
        justify-content: center !important;
        gap: 10px !important;
        overflow: visible !important;
      }

      .community-reply-attachment-picker-v2::before {
        content: "ADJUNTAR" !important;
        position: absolute !important;
        top: 10px !important;
        right: 7px !important;
        color: var(--text-muted, #93a9c8) !important;
        font-size: .58rem !important;
        font-weight: 900 !important;
        letter-spacing: .08em !important;
        writing-mode: vertical-rl !important;
        text-orientation: mixed !important;
        opacity: .72 !important;
        pointer-events: none !important;
      }

      .community-reply-attach-pick-v2 {
        position: relative !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        align-self: flex-end !important;

        width: 44px !important;
        min-width: 44px !important;
        max-width: 44px !important;
        height: 44px !important;

        padding: 0 12px !important;
        border-radius: 999px !important;
        overflow: hidden !important;
        white-space: nowrap !important;

        transition:
          width .22s ease,
          max-width .22s ease,
          box-shadow .18s ease,
          background .18s ease,
          transform .18s ease !important;

        z-index: 2 !important;
      }

      .community-reply-attach-pick-v2:hover,
      .community-reply-attach-pick-v2:focus-visible {
        width: 128px !important;
        max-width: 128px !important;
        box-shadow: 0 10px 20px rgba(0,0,0,.18) !important;
        transform: translateX(0) !important;
      }

      .community-reply-attach-pick-v2 i {
        flex: 0 0 18px !important;
        width: 18px !important;
        text-align: center !important;
        font-size: 1rem !important;
        line-height: 1 !important;
      }

      .community-reply-attach-pick-v2 span {
        display: inline-block !important;
        margin-left: 0 !important;
        max-width: 0 !important;
        opacity: 0 !important;
        overflow: hidden !important;
        white-space: nowrap !important;
        font-size: .92rem !important;
        font-weight: 800 !important;
        color: #f4fbff !important;
        transition:
          max-width .18s ease,
          opacity .14s ease,
          margin-left .18s ease !important;
      }

      .community-reply-attach-pick-v2:hover span,
      .community-reply-attach-pick-v2:focus-visible span {
        margin-left: 10px !important;
        max-width: 72px !important;
        opacity: 1 !important;
      }

      .community-reply-attach-pick-v2.image i {
        color: #67ebff !important;
      }

      .community-reply-attach-pick-v2.video i {
        color: #c89cff !important;
      }

      .community-reply-attach-pick-v2.file i {
        color: #ffd36b !important;
      }

      @media (max-width: 720px) {
        .community-reply-composer-shell-v2 {
          grid-template-columns: 1fr !important;
        }

        .community-reply-attachment-picker-v2 {
          grid-column: 1 !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          height: auto !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: flex-end !important;
          padding: 10px 12px !important;
          gap: 10px !important;
        }

        .community-reply-attachment-picker-v2::before {
          position: static !important;
          writing-mode: initial !important;
          text-orientation: initial !important;
          margin-right: auto !important;
        }

        .community-reply-attach-pick-v2:hover,
        .community-reply-attach-pick-v2:focus-visible,
        .community-reply-attach-pick-v2:active {
          width: 120px !important;
          max-width: 120px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectReplyAttachmentPillRail);
  } else {
    injectReplyAttachmentPillRail();
  }
})();


// COMMUNITY_REPLY_ATTACHMENTS_PILL_EXPAND_LEFT_20260626


/* ============================================================
   COMMUNITY_REPLY_ATTACHMENTS_STABLE_RAIL_20260626
   Rail estable: hover expande dentro de la caja, sin convulsión.
============================================================ */
(() => {
  const STYLE_ID = "communityReplyAttachmentsStableRail20260626";
  const OLD_STYLE_IDS = [
    "communityReplyAttachmentsPrettyOverride20260626",
    "communityReplyAttachmentsFixedRail20260626",
    "communityReplyAttachmentsPillExpandLeft20260626"
  ];

  function injectStableRail() {
    OLD_STYLE_IDS.forEach((id) => {
      document.getElementById(id)?.remove();
    });

    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .community-reply-composer-shell-v2 {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 74px !important;
        gap: 10px !important;
        align-items: stretch !important;
        overflow: visible !important;
      }

      .community-reply-composer-shell-v2 textarea {
        grid-column: 1 !important;
        min-height: 112px !important;
        padding-right: 14px !important;
      }

      .community-reply-attachment-picker-v2 {
        grid-column: 2 !important;
        position: relative !important;

        width: 74px !important;
        min-width: 74px !important;
        max-width: 74px !important;
        height: 100% !important;

        padding: 10px 8px !important;
        padding-right: 10px !important;

        border-radius: 24px !important;
        border: 1px solid rgba(103, 235, 255, .18) !important;
        background:
          linear-gradient(180deg, rgba(103,235,255,.06), rgba(179,119,255,.05)) !important;
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,.025),
          0 10px 24px rgba(0,0,0,.12) !important;

        display: flex !important;
        flex-direction: column !important;
        align-items: flex-end !important;
        justify-content: center !important;
        gap: 10px !important;

        overflow: visible !important;
      }

      .community-reply-attachment-picker-v2::before {
        content: "ADJUNTAR" !important;
        position: absolute !important;
        top: 50% !important;
        right: -14px !important;
        transform: translateY(-50%) !important;

        color: var(--text-muted, #93a9c8) !important;
        font-size: .58rem !important;
        font-weight: 950 !important;
        letter-spacing: .08em !important;

        writing-mode: vertical-rl !important;
        text-orientation: mixed !important;

        opacity: .72 !important;
        pointer-events: none !important;
      }

      .community-reply-attach-pick-v2 {
        position: relative !important;

        width: 42px !important;
        min-width: 42px !important;
        max-width: 116px !important;
        height: 42px !important;

        display: inline-flex !important;
        align-items: center !important;
        justify-content: flex-start !important;

        align-self: flex-end !important;
        margin-right: 0 !important;

        padding: 0 12px !important;
        border-radius: 999px !important;

        overflow: hidden !important;
        white-space: nowrap !important;

        z-index: 2 !important;
        transform: none !important;

        transition:
          width .20s ease,
          box-shadow .16s ease,
          background .16s ease,
          border-color .16s ease !important;
      }

      .community-reply-attach-pick-v2:hover,
      .community-reply-attach-pick-v2:focus-visible {
        width: 116px !important;
        transform: none !important;
        box-shadow:
          0 0 0 1px rgba(255,255,255,.06),
          0 10px 22px rgba(0,0,0,.18) !important;
      }

      .community-reply-attach-pick-v2 i {
        flex: 0 0 18px !important;
        width: 18px !important;
        min-width: 18px !important;
        text-align: center !important;
        font-size: 1rem !important;
        line-height: 1 !important;
      }

      .community-reply-attach-pick-v2 span {
        display: inline-block !important;

        margin-left: 0 !important;
        max-width: 0 !important;
        opacity: 0 !important;

        overflow: hidden !important;
        white-space: nowrap !important;

        color: #f4fbff !important;
        font-size: .88rem !important;
        font-weight: 850 !important;

        transition:
          max-width .16s ease,
          opacity .14s ease,
          margin-left .16s ease !important;
      }

      .community-reply-attach-pick-v2:hover span,
      .community-reply-attach-pick-v2:focus-visible span {
        margin-left: 9px !important;
        max-width: 72px !important;
        opacity: 1 !important;
      }

      .community-reply-attach-pick-v2.image i {
        color: #67ebff !important;
      }

      .community-reply-attach-pick-v2.video i {
        color: #c89cff !important;
      }

      .community-reply-attach-pick-v2.file i {
        color: #ffd36b !important;
      }

      body.light-mode .community-reply-attachment-picker-v2,
      html.light-mode .community-reply-attachment-picker-v2,
      [data-theme="light"] .community-reply-attachment-picker-v2 {
        background:
          linear-gradient(180deg, rgba(255,255,255,.80), rgba(236,244,255,.68)) !important;
        border-color: rgba(24, 120, 160, .18) !important;
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,.55),
          0 10px 24px rgba(20,30,50,.08) !important;
      }

      body.light-mode .community-reply-attach-pick-v2,
      html.light-mode .community-reply-attach-pick-v2,
      [data-theme="light"] .community-reply-attach-pick-v2 {
        color: var(--text-main, #132033) !important;
        background: rgba(255,255,255,.78) !important;
      }

      body.light-mode .community-reply-attach-pick-v2 span,
      html.light-mode .community-reply-attach-pick-v2 span,
      [data-theme="light"] .community-reply-attach-pick-v2 span {
        color: var(--text-main, #132033) !important;
      }

      @media (max-width: 720px) {
        .community-reply-composer-shell-v2 {
          grid-template-columns: 1fr !important;
        }

        .community-reply-attachment-picker-v2 {
          grid-column: 1 !important;

          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          height: auto !important;

          flex-direction: row !important;
          align-items: center !important;
          justify-content: flex-start !important;

          padding: 10px 12px !important;
          gap: 10px !important;
        }

        .community-reply-attachment-picker-v2::before {
          position: static !important;
          transform: none !important;
          writing-mode: initial !important;
          text-orientation: initial !important;
          margin-right: auto !important;
        }

        .community-reply-attach-pick-v2 {
          margin-right: 0 !important;
          width: 42px !important;
          max-width: 112px !important;
        }

        .community-reply-attach-pick-v2:hover,
        .community-reply-attach-pick-v2:focus-visible,
        .community-reply-attach-pick-v2:active {
          width: 112px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectStableRail);
  } else {
    injectStableRail();
  }
})();


// COMMUNITY_REPLY_ATTACHMENTS_STABLE_RAIL_20260626


/* ============================================================
   COMMUNITY_REPLY_ATTACHMENTS_ALIGN_AND_WRAP_FIX_20260626
   Alineación del rail + corte de palabras largas.
============================================================ */
(() => {
  const STYLE_ID = "communityReplyAttachAlignAndWrapFix20260626";

  function injectAlignAndWrapFix() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* El rail queda más centrado y proporcionado respecto al textarea */
      .community-reply-composer-shell-v2 {
        align-items: center !important;
      }

      .community-reply-attachment-picker-v2 {
        height: auto !important;
        min-height: 156px !important;
        align-self: center !important;
        justify-content: center !important;
      }

      /* Evita que respuestas larguísimas sin espacios rompan la card */
      .community-comment,
      .community-comment p,
      .community-comment div,
      .community-comment span,
      .community-post-card,
      .community-post-card p,
      .community-post-card div {
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
      }

      /* Por si el contenido viene directo en una línea dentro de la respuesta */
      .community-comment {
        max-width: 100% !important;
        overflow: hidden !important;
      }

      /* El texto de respuesta puede crecer hacia abajo sin desbordar horizontalmente */
      .community-comment * {
        max-width: 100% !important;
      }

      /* Textarea: escribir cadenas largas también debería cortar visualmente */
      .community-reply-composer-shell-v2 textarea {
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
        white-space: pre-wrap !important;
      }

      @media (max-width: 720px) {
        .community-reply-attachment-picker-v2 {
          min-height: 0 !important;
          align-self: stretch !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectAlignAndWrapFix);
  } else {
    injectAlignAndWrapFix();
  }
})();


// COMMUNITY_REPLY_ATTACHMENTS_ALIGN_AND_WRAP_FIX_20260626


/* ============================================================
   COMMUNITY_REPLY_EXPAND_DELETE_V1_20260626
   Ver más en respuestas largas + botón borrar respuesta.
============================================================ */
(() => {
  const PATCH_ID = "COMMUNITY_REPLY_EXPAND_DELETE_V1_20260626";
  const STYLE_ID = "communityReplyExpandDeleteV120260626";

  if (window.__communityReplyExpandDeleteV1) {
    return;
  }

  window.__communityReplyExpandDeleteV1 = true;

  function getSession() {
    try {
      if (window.ClassroomAuth?.getSession) {
        return window.ClassroomAuth.getSession() || {};
      }

      return JSON.parse(localStorage.getItem("andyazh-classroom-session") || "{}");
    } catch (_) {
      return {};
    }
  }

  function getToken() {
    const session = getSession();

    return (
      session.access_token ||
      session.accessToken ||
      session.token ||
      session.jwt ||
      ""
    );
  }

  function isStaffSession() {
    const session = getSession();
    const role = String(session.role || "").toLowerCase();

    return Boolean(session.is_staff) ||
      ["teacher", "docente", "moderador", "moderator", "admin"].includes(role);
  }

  function apiBase() {
    const local = ["127.0.0.1", "localhost"].includes(window.location.hostname);

    return local
      ? "http://127.0.0.1:8000/api/classroom"
      : "https://exampro-backend-1n6d.onrender.com/api/classroom";
  }

  async function apiDeleteReply(replyId, reason) {
    const token = getToken();

    const res = await fetch(`${apiBase()}/community/replies/${encodeURIComponent(replyId)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        reason: reason || "Respuesta eliminada por moderación.",
      }),
    });

    let data = null;

    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (!res.ok) {
      const detail = data?.detail || data?.message || `Error HTTP ${res.status}`;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }

    return data || {};
  }

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .community-comment[data-reply-id] {
        position: relative !important;
      }

      .community-comment.community-reply-long:not(.community-reply-expanded) {
        max-height: 230px !important;
        overflow: hidden !important;
      }

      .community-comment.community-reply-long:not(.community-reply-expanded)::after {
        content: "" !important;
        position: absolute !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        height: 78px !important;
        pointer-events: none !important;
        border-radius: 0 0 16px 16px !important;
        background:
          linear-gradient(
            180deg,
            rgba(20, 26, 42, 0),
            rgba(20, 26, 42, .92) 72%
          ) !important;
        z-index: 3 !important;
      }

      .community-reply-expand-btn {
        position: absolute !important;
        left: 16px !important;
        bottom: 14px !important;
        z-index: 8 !important;

        display: inline-flex !important;
        align-items: center !important;
        gap: 7px !important;

        border-radius: 999px !important;
        border: 1px solid rgba(103, 235, 255, .30) !important;
        background: rgba(103, 235, 255, .10) !important;
        color: #67ebff !important;

        padding: 7px 11px !important;
        font-size: .82rem !important;
        font-weight: 900 !important;
        cursor: pointer !important;

        box-shadow: 0 10px 22px rgba(0,0,0,.16) !important;
        transition:
          transform .16s ease,
          background .16s ease,
          box-shadow .16s ease !important;
      }

      .community-reply-expand-btn:hover {
        transform: translateY(-1px) !important;
        background: rgba(103, 235, 255, .15) !important;
      }

      .community-reply-delete-btn {
        position: absolute !important;
        right: 16px !important;
        bottom: 62px !important;
        z-index: 7 !important;

        width: 38px !important;
        height: 38px !important;
        display: inline-grid !important;
        place-items: center !important;

        border-radius: 999px !important;
        border: 1px solid rgba(255, 123, 155, .42) !important;
        background: rgba(255, 123, 155, .10) !important;
        color: #ff7b9b !important;

        cursor: pointer !important;
        box-shadow: 0 10px 22px rgba(0,0,0,.15) !important;
        transition:
          transform .16s ease,
          background .16s ease,
          box-shadow .16s ease !important;
      }

      .community-reply-delete-btn:hover {
        transform: translateY(-1px) scale(1.04) !important;
        background: rgba(255, 123, 155, .16) !important;
      }

      body.light-mode .community-comment.community-reply-long:not(.community-reply-expanded)::after,
      html.light-mode .community-comment.community-reply-long:not(.community-reply-expanded)::after,
      [data-theme="light"] .community-comment.community-reply-long:not(.community-reply-expanded)::after {
        background:
          linear-gradient(
            180deg,
            rgba(245, 249, 255, 0),
            rgba(245, 249, 255, .94) 72%
          ) !important;
      }

      body.light-mode .community-reply-expand-btn,
      html.light-mode .community-reply-expand-btn,
      [data-theme="light"] .community-reply-expand-btn {
        background: rgba(24, 120, 160, .09) !important;
        color: #087a9a !important;
      }

      body.light-mode .community-reply-delete-btn,
      html.light-mode .community-reply-delete-btn,
      [data-theme="light"] .community-reply-delete-btn {
        background: rgba(255, 80, 120, .08) !important;
      }

      @media (max-width: 720px) {
        .community-reply-delete-btn {
          right: 12px !important;
          bottom: 58px !important;
        }

        .community-reply-expand-btn {
          left: 12px !important;
          bottom: 12px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function shouldClampReply(comment) {
    if (!comment) return false;

    const clone = comment.cloneNode(true);

    clone.querySelectorAll(
      "[data-community-reply-moderation], .community-reply-mod-menu, .community-reply-delete-btn, .community-reply-expand-btn"
    ).forEach((node) => node.remove());

    const text = String(clone.textContent || "").trim();

    return text.length > 420 || comment.scrollHeight > 260;
  }

  function ensureExpandButton(comment) {
    if (!comment || comment.querySelector(".community-reply-expand-btn")) return;

    if (!shouldClampReply(comment)) {
      comment.classList.remove("community-reply-long", "community-reply-expanded");
      return;
    }

    comment.classList.add("community-reply-long");

    const button = document.createElement("button");
    button.className = "community-reply-expand-btn";
    button.type = "button";
    button.innerHTML = `<i class="fa-solid fa-chevron-down"></i><span>Ver más</span>`;

    button.addEventListener("click", () => {
      const expanded = comment.classList.toggle("community-reply-expanded");
      const icon = button.querySelector("i");
      const label = button.querySelector("span");

      if (icon) {
        icon.className = expanded ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down";
      }

      if (label) {
        label.textContent = expanded ? "Ver menos" : "Ver más";
      }
    });

    comment.appendChild(button);
  }

  function ensureDeleteButton(comment) {
    if (!comment || !isStaffSession()) return;
    if (comment.querySelector(".community-reply-delete-btn")) return;

    const replyId = comment.dataset.replyId;

    if (!replyId) return;

    const button = document.createElement("button");
    button.className = "community-reply-delete-btn";
    button.type = "button";
    button.title = "Borrar respuesta";
    button.setAttribute("aria-label", "Borrar respuesta");
    button.innerHTML = `<i class="fa-solid fa-trash"></i>`;

    button.addEventListener("click", async () => {
      const ok = window.confirm("¿Seguro que querés borrar esta respuesta?");

      if (!ok) return;

      const reason = window.prompt(
        "Motivo para borrar la respuesta:",
        "Respuesta eliminada por moderación."
      );

      if (reason === null) return;

      try {
        button.disabled = true;
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;

        await apiDeleteReply(replyId, reason);

        comment.style.opacity = "0.45";
        comment.style.pointerEvents = "none";
        comment.style.filter = "grayscale(1)";
        comment.dataset.deleted = "1";

        setTimeout(() => {
          comment.remove();
        }, 250);
      } catch (error) {
        console.error(error);
        window.alert(error.message || "No pude borrar la respuesta.");
        button.disabled = false;
        button.innerHTML = `<i class="fa-solid fa-trash"></i>`;
      }
    });

    const modMenu = comment.querySelector("[data-community-reply-moderation]");

    if (modMenu) {
      comment.insertBefore(button, modMenu);
    } else {
      comment.appendChild(button);
    }
  }

  function mountReplyExpandAndDelete() {
    document.querySelectorAll(".community-comment[data-reply-id]").forEach((comment) => {
      if (comment.dataset.replyExpandDeleteMounted === "1") {
        return;
      }

      comment.dataset.replyExpandDeleteMounted = "1";

      ensureDeleteButton(comment);

      // Esperamos un frame para medir bien el alto final, incluyendo adjuntos.
      requestAnimationFrame(() => {
        ensureExpandButton(comment);
      });
    });
  }

  function boot() {
    injectStyles();
    mountReplyExpandAndDelete();

    const observer = new MutationObserver(() => {
      mountReplyExpandAndDelete();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log(`[Comunidad] ${PATCH_ID} activo.`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


// COMMUNITY_REPLY_EXPAND_DELETE_V1_20260626


/* ============================================================
   COMMUNITY_REPLY_ATTACHMENT_PREVIEW_AND_POPOVER_FIX_20260627
   Preview real de adjuntos en respuestas + popover sólido.
============================================================ */
(() => {
  const PATCH_ID = "COMMUNITY_REPLY_ATTACHMENT_PREVIEW_AND_POPOVER_FIX_20260627";
  const STYLE_ID = "communityReplyPreviewPopoverFix20260627";
  const fetchedReplies = new Set();

  if (window.__communityReplyPreviewPopoverFix20260627) {
    return;
  }

  window.__communityReplyPreviewPopoverFix20260627 = true;

  function getSession() {
    try {
      if (window.ClassroomAuth?.getSession) {
        return window.ClassroomAuth.getSession() || {};
      }

      return JSON.parse(localStorage.getItem("andyazh-classroom-session") || "{}");
    } catch (_) {
      return {};
    }
  }

  function getToken() {
    const session = getSession();

    return (
      session.access_token ||
      session.accessToken ||
      session.token ||
      session.jwt ||
      ""
    );
  }

  function apiBase() {
    const local = ["127.0.0.1", "localhost"].includes(window.location.hostname);

    return local
      ? "http://127.0.0.1:8000/api/classroom"
      : "https://exampro-backend-1n6d.onrender.com/api/classroom";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);

    if (!value) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const amount = value / Math.pow(1024, index);

    return `${amount.toFixed(amount >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function fileName(item) {
    return item?.filename || item?.name || "archivo";
  }

  function mimeType(item) {
    return String(item?.mime_type || item?.type || "").toLowerCase();
  }

  function fileUrl(item) {
    return item?.download_url || item?.preview_url || item?.view_url || item?.url || "#";
  }

  function viewUrl(item) {
    return item?.view_url || item?.preview_url || item?.download_url || item?.url || "#";
  }

  function isImage(item) {
    const mime = mimeType(item);
    const name = fileName(item).toLowerCase();

    return mime.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
  }

  function isVideo(item) {
    const mime = mimeType(item);
    const name = fileName(item).toLowerCase();

    return mime.startsWith("video/") ||
      /\.(mp4|webm|mov|mkv|avi)$/i.test(name);
  }

  function iconFor(item) {
    const mime = mimeType(item);
    const name = fileName(item).toLowerCase();

    if (isImage(item)) return "fa-regular fa-image";
    if (isVideo(item)) return "fa-regular fa-file-video";
    if (mime.startsWith("audio/")) return "fa-regular fa-file-audio";
    if (mime.includes("pdf") || name.endsWith(".pdf")) return "fa-regular fa-file-pdf";
    if (name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".7z")) return "fa-regular fa-file-zipper";
    if (name.endsWith(".txt") || name.endsWith(".log") || name.endsWith(".md")) return "fa-regular fa-file-lines";

    return "fa-solid fa-paperclip";
  }

  async function fetchReplyAttachments(replyId) {
    const token = getToken();

    const res = await fetch(`${apiBase()}/community/replies/${encodeURIComponent(replyId)}/attachments`, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) return [];

    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.items) ? data.items : [];
  }

  function renderAttachment(item) {
    const name = fileName(item);
    const size = formatBytes(item?.size_bytes || item?.size || 0);
    const open = viewUrl(item);
    const media = fileUrl(item);

    if (isImage(item)) {
      return `
        <a class="community-reply-media-card-v3 image" href="${escapeHtml(open)}" target="_blank" rel="noopener">
          <img src="${escapeHtml(media)}" alt="${escapeHtml(name)}" loading="lazy">
          <div class="community-reply-media-caption">
            <i class="fa-solid ${escapeHtml(iconFor(item))}"></i>
            <span>${escapeHtml(name)}</span>
            <small>${escapeHtml(size)}</small>
          </div>
        </a>
      `;
    }

    if (isVideo(item)) {
      return `
        <a class="community-reply-media-card-v3 video" href="${escapeHtml(open)}" target="_blank" rel="noopener">
          <div class="community-reply-video-preview-v3">
            <i class="fa-solid fa-circle-play"></i>
            <span>Ver video</span>
          </div>
          <div class="community-reply-media-caption">
            <i class="fa-solid ${escapeHtml(iconFor(item))}"></i>
            <span>${escapeHtml(name)}</span>
            <small>${escapeHtml(size)}</small>
          </div>
        </a>
      `;
    }

    return `
      <a class="community-reply-file-card-v3" href="${escapeHtml(open)}" target="_blank" rel="noopener">
        <i class="fa-solid ${escapeHtml(iconFor(item))}"></i>
        <span>${escapeHtml(name)}</span>
        <small>${escapeHtml(size)}</small>
      </a>
    `;
  }

  function renderAttachments(comment, items) {
    if (!comment || !items.length) return;

    comment.querySelectorAll(
      ".community-reply-attachments-render-v2, [data-reply-attachments-render-v2], [data-reply-attachments-render-v3]"
    ).forEach((node) => node.remove());

    const wrap = document.createElement("div");
    wrap.className = "community-reply-attachments-render-v3";
    wrap.dataset.replyAttachmentsRenderV3 = "1";
    wrap.innerHTML = items.map(renderAttachment).join("");

    const modMenu = comment.querySelector("[data-community-reply-moderation]");
    const deleteButton = comment.querySelector(".community-reply-delete-btn");

    if (deleteButton) {
      comment.insertBefore(wrap, deleteButton);
    } else if (modMenu) {
      comment.insertBefore(wrap, modMenu);
    } else {
      comment.appendChild(wrap);
    }
  }

  async function hydrateVisibleReplyAttachments() {
    const comments = Array.from(document.querySelectorAll(".community-comment[data-reply-id]"));

    for (const comment of comments) {
      const replyId = comment.dataset.replyId;

      if (!replyId || fetchedReplies.has(replyId)) continue;

      fetchedReplies.add(replyId);

      try {
        const items = await fetchReplyAttachments(replyId);
        renderAttachments(comment, items);
      } catch (error) {
        console.warn("[Comunidad] No pude hidratar preview de adjuntos", replyId, error);
      }
    }
  }

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .community-comment[data-reply-id] {
        overflow: visible !important;
      }

      .community-reply-attachments-render-v3 {
        margin-top: 14px !important;
        margin-right: 72px !important;
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 10px !important;
        max-width: calc(100% - 90px) !important;
      }

      .community-reply-media-card-v3,
      .community-reply-file-card-v3 {
        text-decoration: none !important;
        color: var(--text-main, #eaf6ff) !important;
      }

      .community-reply-media-card-v3 {
        width: min(280px, 100%) !important;
        border-radius: 16px !important;
        overflow: hidden !important;
        border: 1px solid rgba(103, 235, 255, .22) !important;
        background: rgba(10, 18, 32, .78) !important;
        box-shadow: 0 12px 28px rgba(0,0,0,.16) !important;
      }

      .community-reply-media-card-v3.image img {
        display: block !important;
        width: 100% !important;
        max-height: 220px !important;
        object-fit: cover !important;
        background: rgba(0,0,0,.16) !important;
      }

      .community-reply-video-preview-v3 {
        min-height: 150px !important;
        display: grid !important;
        place-items: center !important;
        gap: 8px !important;
        color: #c89cff !important;
        background:
          radial-gradient(circle at center, rgba(179,119,255,.18), rgba(10,18,32,.86)) !important;
        font-weight: 900 !important;
      }

      .community-reply-video-preview-v3 i {
        font-size: 2.2rem !important;
      }

      .community-reply-media-caption {
        display: grid !important;
        grid-template-columns: auto minmax(0, 1fr) auto !important;
        gap: 8px !important;
        align-items: center !important;
        padding: 9px 10px !important;
        font-size: .84rem !important;
      }

      .community-reply-media-caption span,
      .community-reply-file-card-v3 span {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      .community-reply-media-caption small,
      .community-reply-file-card-v3 small {
        opacity: .72 !important;
        white-space: nowrap !important;
      }

      .community-reply-file-card-v3 {
        max-width: min(100%, 360px) !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 9px 11px !important;
        border-radius: 14px !important;
        border: 1px solid rgba(103, 235, 255, .22) !important;
        background: rgba(103, 235, 255, .08) !important;
      }

      /* Popover moderación: sólido, arriba de todo, sin recorte */
      .community-reply-mod-menu {
        z-index: 80 !important;
      }

      .community-reply-mod-popover {
        z-index: 9999 !important;
        opacity: 1 !important;
        background: #10182a !important;
        border: 1px solid rgba(103, 235, 255, .36) !important;
        box-shadow:
          0 22px 70px rgba(0,0,0,.52),
          0 0 0 1px rgba(255,255,255,.06) inset !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      .community-reply-mod-popover[hidden] {
        display: none !important;
      }

      .community-reply-mod-popover::before {
        content: "" !important;
        position: absolute !important;
        inset: 0 !important;
        border-radius: inherit !important;
        background: linear-gradient(180deg, rgba(18,28,48,1), rgba(11,17,31,1)) !important;
        z-index: -1 !important;
      }

      .community-reply-mod-action {
        background: transparent !important;
      }

      .community-reply-mod-action:hover {
        background: rgba(103, 235, 255, .10) !important;
      }

      body.light-mode .community-reply-media-card-v3,
      html.light-mode .community-reply-media-card-v3,
      [data-theme="light"] .community-reply-media-card-v3,
      body.light-mode .community-reply-file-card-v3,
      html.light-mode .community-reply-file-card-v3,
      [data-theme="light"] .community-reply-file-card-v3 {
        background: rgba(255,255,255,.80) !important;
        color: var(--text-main, #132033) !important;
        border-color: rgba(24, 120, 160, .20) !important;
      }

      body.light-mode .community-reply-mod-popover,
      html.light-mode .community-reply-mod-popover,
      [data-theme="light"] .community-reply-mod-popover {
        background: #ffffff !important;
        color: #132033 !important;
        border-color: rgba(24, 120, 160, .26) !important;
      }

      body.light-mode .community-reply-mod-popover::before,
      html.light-mode .community-reply-mod-popover::before,
      [data-theme="light"] .community-reply-mod-popover::before {
        background: linear-gradient(180deg, #ffffff, #f4f8ff) !important;
      }

      @media (max-width: 720px) {
        .community-reply-attachments-render-v3 {
          margin-right: 0 !important;
          max-width: 100% !important;
        }

        .community-reply-media-card-v3 {
          width: 100% !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function boot() {
    injectStyles();
    hydrateVisibleReplyAttachments();

    const observer = new MutationObserver(() => {
      hydrateVisibleReplyAttachments();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log(`[Comunidad] ${PATCH_ID} activo.`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


// COMMUNITY_REPLY_ATTACHMENT_PREVIEW_AND_POPOVER_FIX_20260627


/* ============================================================
   COMMUNITY_EDIT_BUTTONS_AND_OWNER_PERMS_V1_20260627
   Lápiz editar para hilos/respuestas + permisos visuales.
============================================================ */
(() => {
  const PATCH_ID = "COMMUNITY_EDIT_BUTTONS_AND_OWNER_PERMS_V1_20260627";
  const STYLE_ID = "communityEditButtonsOwnerPermsV120260627";

  if (window.__communityEditButtonsOwnerPermsV1) {
    return;
  }

  window.__communityEditButtonsOwnerPermsV1 = true;

  function getSession() {
    try {
      if (window.ClassroomAuth?.getSession) {
        return window.ClassroomAuth.getSession() || {};
      }

      return JSON.parse(localStorage.getItem("andyazh-classroom-session") || "{}");
    } catch (_) {
      return {};
    }
  }

  function getToken() {
    const session = getSession();

    return (
      session.access_token ||
      session.accessToken ||
      session.token ||
      session.jwt ||
      ""
    );
  }

  function sessionTwitch() {
    const session = getSession();
    const raw = String(session.twitch || session.username || "").trim().toLowerCase();

    return raw.replace(/^@/, "");
  }

  function sessionDni() {
    const session = getSession();
    return String(session.dni || "").trim();
  }

  function isStaffSession() {
    const session = getSession();
    const role = String(session.role || "").toLowerCase();

    return Boolean(session.is_staff) ||
      ["teacher", "docente", "moderador", "moderator", "admin"].includes(role);
  }

  function apiBase() {
    const local = ["127.0.0.1", "localhost"].includes(window.location.hostname);

    return local
      ? "http://127.0.0.1:8000/api/classroom"
      : "https://exampro-backend-1n6d.onrender.com/api/classroom";
  }

  async function communityApi(path, options = {}) {
    const token = getToken();

    const headers = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    let body = options.body;

    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }

    const res = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });

    let data = null;

    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (!res.ok) {
      const detail = data?.detail || data?.message || `Error HTTP ${res.status}`;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }

    return data || {};
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function visibleAuthorMatchesSession(root) {
    const twitch = sessionTwitch();

    if (!root || !twitch) return false;

    const text = String(root.textContent || "").toLowerCase();

    return text.includes(`@${twitch}`);
  }

  function canEditOrDelete(root) {
    return isStaffSession() || visibleAuthorMatchesSession(root);
  }

  function extractReplyBody(comment) {
    const clone = comment.cloneNode(true);

    clone.querySelectorAll(`
      [data-community-reply-moderation],
      .community-reply-mod-menu,
      .community-reply-delete-btn,
      .community-reply-edit-btn,
      .community-reply-expand-btn,
      .community-reply-attachments-render-v2,
      .community-reply-attachments-render-v3,
      [data-reply-attachments-render-v2],
      [data-reply-attachments-render-v3]
    `).forEach((node) => node.remove());

    const lines = String(clone.textContent || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length && lines[0].startsWith("@")) {
      lines.shift();
    }

    // Sacamos fechas típicas si quedaron mezcladas.
    return lines
      .filter((line) => !/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line))
      .join("\n")
      .trim();
  }

  async function editReply(comment) {
    const replyId = comment?.dataset?.replyId;

    if (!replyId) return;

    const current = extractReplyBody(comment);

    const next = window.prompt("Editar respuesta:", current);

    if (next === null) return;

    const body = String(next || "").trim();

    if (!body) {
      window.alert("La respuesta no puede quedar vacía.");
      return;
    }

    try {
      await communityApi(`/community/replies/${encodeURIComponent(replyId)}`, {
        method: "PATCH",
        body: { body },
      });

      window.location.reload();
    } catch (error) {
      console.error(error);
      window.alert(error.message || "No pude editar la respuesta.");
    }
  }

  async function deleteReply(comment) {
    const replyId = comment?.dataset?.replyId;

    if (!replyId) return;

    const ok = window.confirm("¿Seguro que querés borrar esta respuesta?");

    if (!ok) return;

    try {
      await communityApi(`/community/replies/${encodeURIComponent(replyId)}`, {
        method: "DELETE",
      });

      comment.style.opacity = "0.45";
      comment.style.pointerEvents = "none";
      comment.style.filter = "grayscale(1)";

      setTimeout(() => comment.remove(), 250);
    } catch (error) {
      console.error(error);
      window.alert(error.message || "No pude borrar la respuesta.");
    }
  }

  async function editThread(card) {
    const threadId = card?.dataset?.postId || card?.getAttribute("data-post-id");

    if (!threadId) return;

    try {
      const detail = await communityApi(`/community/threads/${encodeURIComponent(threadId)}`);
      const item = detail.item || detail.thread || detail || {};

      const currentTitle = item.title || "";
      const currentBody = item.body || item.content || "";

      const title = window.prompt("Editar título del hilo:", currentTitle);

      if (title === null) return;

      const cleanTitle = String(title || "").trim();

      if (!cleanTitle) {
        window.alert("El título no puede quedar vacío.");
        return;
      }

      const body = window.prompt("Editar contenido del hilo:", currentBody);

      if (body === null) return;

      const cleanBody = String(body || "").trim();

      if (!cleanBody) {
        window.alert("El contenido no puede quedar vacío.");
        return;
      }

      await communityApi(`/community/threads/${encodeURIComponent(threadId)}`, {
        method: "PATCH",
        body: {
          title: cleanTitle,
          body: cleanBody,
        },
      });

      window.location.reload();
    } catch (error) {
      console.error(error);
      window.alert(error.message || "No pude editar el hilo.");
    }
  }

  function mountReplyActions() {
    document.querySelectorAll(".community-comment[data-reply-id]").forEach((comment) => {
      if (comment.dataset.editButtonsMounted === "1") return;
      comment.dataset.editButtonsMounted = "1";

      if (!canEditOrDelete(comment)) {
        return;
      }

      const edit = document.createElement("button");
      edit.className = "community-reply-edit-btn";
      edit.type = "button";
      edit.title = "Editar respuesta";
      edit.setAttribute("aria-label", "Editar respuesta");
      edit.innerHTML = `<i class="fa-solid fa-pen"></i>`;
      edit.addEventListener("click", () => editReply(comment));

      let del = comment.querySelector(".community-reply-delete-btn");

      if (!del) {
        del = document.createElement("button");
        del.className = "community-reply-delete-btn";
        del.type = "button";
        del.title = "Borrar respuesta";
        del.setAttribute("aria-label", "Borrar respuesta");
        del.innerHTML = `<i class="fa-solid fa-trash"></i>`;
        del.addEventListener("click", () => deleteReply(comment));
      }

      const modMenu = comment.querySelector("[data-community-reply-moderation]");

      if (modMenu) {
        comment.insertBefore(edit, modMenu);
        comment.insertBefore(del, modMenu);
      } else {
        comment.appendChild(edit);
        comment.appendChild(del);
      }
    });
  }

  function mountThreadActions() {
    document.querySelectorAll("[data-post-id]").forEach((card) => {
      if (card.dataset.threadEditButtonMounted === "1") return;
      card.dataset.threadEditButtonMounted = "1";

      if (!canEditOrDelete(card)) {
        return;
      }

      const actions =
        card.querySelector(".community-post-actions") ||
        card.querySelector("[data-community-post-actions]") ||
        Array.from(card.querySelectorAll("button"))
          .find((button) => /marcar resuelto/i.test(button.textContent || ""))
          ?.parentElement;

      if (!actions || actions.querySelector("[data-community-edit-thread]")) {
        return;
      }

      const resolvedButton = Array.from(actions.querySelectorAll("button"))
        .find((button) => /marcar resuelto/i.test(button.textContent || ""));

      const edit = document.createElement("button");
      edit.className = "btn btn-outline btn-sm community-thread-edit-btn";
      edit.type = "button";
      edit.dataset.communityEditThread = "1";
      edit.innerHTML = `<i class="fa-solid fa-pen"></i> Editar`;
      edit.addEventListener("click", () => editThread(card));

      if (resolvedButton) {
        actions.insertBefore(edit, resolvedButton);
      } else {
        actions.appendChild(edit);
      }
    });
  }

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .community-comment[data-reply-id],
      .community-post-card,
      .community-comments,
      [data-post-id] {
        overflow: visible !important;
      }

      .community-reply-edit-btn,
      .community-reply-delete-btn {
        position: absolute !important;
        right: 16px !important;
        z-index: 75 !important;

        width: 38px !important;
        height: 38px !important;
        display: inline-grid !important;
        place-items: center !important;

        border-radius: 999px !important;
        cursor: pointer !important;

        box-shadow: 0 10px 22px rgba(0,0,0,.15) !important;
        transition:
          transform .16s ease,
          background .16s ease,
          box-shadow .16s ease !important;
      }

      .community-reply-edit-btn {
        bottom: 106px !important;
        color: #67ebff !important;
        border: 1px solid rgba(103, 235, 255, .42) !important;
        background: rgba(103, 235, 255, .10) !important;
      }

      .community-reply-delete-btn {
        bottom: 62px !important;
        color: #ff7b9b !important;
        border: 1px solid rgba(255, 123, 155, .42) !important;
        background: rgba(255, 123, 155, .10) !important;
      }

      .community-reply-edit-btn:hover,
      .community-reply-delete-btn:hover {
        transform: translateY(-1px) scale(1.04) !important;
      }

      .community-reply-mod-menu {
        z-index: 80 !important;
      }

      .community-reply-mod-popover {
        z-index: 99999 !important;
        opacity: 1 !important;
        background: #10182a !important;
        border: 1px solid rgba(103, 235, 255, .38) !important;
        box-shadow:
          0 24px 72px rgba(0,0,0,.58),
          inset 0 0 0 1px rgba(255,255,255,.06) !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      .community-reply-mod-popover[hidden] {
        display: none !important;
      }

      .community-thread-edit-btn {
        border-color: rgba(103, 235, 255, .34) !important;
        background: rgba(103, 235, 255, .08) !important;
      }

      body.light-mode .community-reply-edit-btn,
      html.light-mode .community-reply-edit-btn,
      [data-theme="light"] .community-reply-edit-btn {
        color: #087a9a !important;
        background: rgba(24, 120, 160, .09) !important;
      }

      body.light-mode .community-reply-delete-btn,
      html.light-mode .community-reply-delete-btn,
      [data-theme="light"] .community-reply-delete-btn {
        background: rgba(255, 80, 120, .08) !important;
      }

      body.light-mode .community-reply-mod-popover,
      html.light-mode .community-reply-mod-popover,
      [data-theme="light"] .community-reply-mod-popover {
        background: #ffffff !important;
        color: #132033 !important;
        border-color: rgba(24, 120, 160, .26) !important;
      }

      @media (max-width: 720px) {
        .community-reply-edit-btn,
        .community-reply-delete-btn {
          right: 12px !important;
        }

        .community-reply-edit-btn {
          bottom: 100px !important;
        }

        .community-reply-delete-btn {
          bottom: 56px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function mountAll() {
    mountReplyActions();
    mountThreadActions();
  }

  function boot() {
    injectStyles();
    mountAll();

    const observer = new MutationObserver(() => {
      mountAll();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log(`[Comunidad] ${PATCH_ID} activo.`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


// COMMUNITY_EDIT_BUTTONS_AND_OWNER_PERMS_V1_20260627


/* ============================================================
   COMMUNITY_REPLY_POPOVER_AND_DRIVE_PREVIEW_FIX_20260627
   Popover alineado + previews de Drive por thumbnail.
============================================================ */
(() => {
  const STYLE_ID = "communityReplyPopoverDrivePreviewFix20260627";

  if (window.__communityReplyPopoverDrivePreviewFix20260627) {
    return;
  }

  window.__communityReplyPopoverDrivePreviewFix20260627 = true;

  function driveImageUrlFromAttachment(item) {
    const fileId =
      item?.provider_file_id ||
      item?.file_id ||
      item?.drive_file_id ||
      "";

    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w900`;
    }

    return item?.download_url || item?.preview_url || item?.view_url || item?.url || "";
  }

  function enhanceBrokenReplyPreviews() {
    document.querySelectorAll(".community-reply-media-card-v3.image").forEach((card) => {
      if (card.dataset.drivePreviewFixed === "1") return;
      card.dataset.drivePreviewFixed = "1";

      const img = card.querySelector("img");
      const caption = card.querySelector(".community-reply-media-caption span");
      const filename = caption?.textContent?.trim() || "imagen";

      if (!img) return;

      // Intentamos deducir el file_id desde el href o src si no lo teníamos directo.
      const href = card.getAttribute("href") || "";
      const src = img.getAttribute("src") || "";

      let fileId = "";

      const patterns = [
        /\/file\/d\/([^/]+)/,
        /[?&]id=([^&]+)/,
        /\/d\/([^/]+)/
      ];

      for (const value of [src, href]) {
        for (const pattern of patterns) {
          const match = String(value).match(pattern);
          if (match?.[1]) {
            fileId = decodeURIComponent(match[1]);
            break;
          }
        }

        if (fileId) break;
      }

      if (fileId) {
        img.src = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w900`;
      }

      img.alt = filename;

      img.addEventListener("error", () => {
        card.classList.add("image-preview-failed");
        img.remove();

        if (!card.querySelector(".community-reply-image-fallback-v3")) {
          const fallback = document.createElement("div");
          fallback.className = "community-reply-image-fallback-v3";
          fallback.innerHTML = `
            <i class="fa-regular fa-image"></i>
            <span>Vista previa no disponible</span>
          `;
          card.insertBefore(fallback, card.firstChild);
        }
      }, { once: true });
    });
  }

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* La respuesta y sus contenedores no recortan el menú */
      .community-comment[data-reply-id],
      .community-comments,
      [data-post-id],
      .community-post-card {
        overflow: visible !important;
      }

      /* Botonera derecha más ordenada */
      .community-reply-edit-btn {
        bottom: 112px !important;
      }

      .community-reply-delete-btn {
        bottom: 66px !important;
      }

      .community-reply-mod-menu {
        right: 16px !important;
        bottom: 18px !important;
        z-index: 500 !important;
        overflow: visible !important;
      }

      /*
        El menú ahora sale hacia la izquierda del botón,
        alineado al botón de tres puntos.
      */
      .community-reply-mod-popover {
        right: calc(100% + 12px) !important;
        bottom: 0 !important;
        top: auto !important;

        min-width: 205px !important;
        max-width: 240px !important;

        opacity: 1 !important;
        z-index: 999999 !important;

        background: #10182a !important;
        color: #eef7ff !important;
        border: 1px solid rgba(103, 235, 255, .38) !important;
        border-radius: 18px !important;

        box-shadow:
          0 24px 72px rgba(0,0,0,.58),
          inset 0 0 0 1px rgba(255,255,255,.06) !important;

        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;

        transform: translateX(6px) scale(.98) !important;
        transform-origin: right bottom !important;
        transition:
          transform .16s ease,
          opacity .16s ease !important;
      }

      .community-reply-mod-popover:not([hidden]) {
        transform: translateX(0) scale(1) !important;
      }

      .community-reply-mod-popover[hidden] {
        display: none !important;
      }

      .community-reply-mod-popover-title {
        color: #a9bdd8 !important;
      }

      .community-reply-mod-action {
        color: #eef7ff !important;
      }

      .community-reply-mod-action:hover {
        background: rgba(103, 235, 255, .10) !important;
      }

      /* Preview imagen/GIF */
      .community-reply-media-card-v3.image {
        width: min(320px, 100%) !important;
      }

      .community-reply-media-card-v3.image img {
        display: block !important;
        width: 100% !important;
        height: auto !important;
        min-height: 120px !important;
        max-height: 260px !important;
        object-fit: contain !important;
        background:
          radial-gradient(circle at center, rgba(103,235,255,.10), rgba(10,18,32,.88)) !important;
      }

      .community-reply-image-fallback-v3 {
        min-height: 132px !important;
        display: grid !important;
        place-items: center !important;
        gap: 8px !important;
        color: #67ebff !important;
        background:
          radial-gradient(circle at center, rgba(103,235,255,.12), rgba(10,18,32,.88)) !important;
        font-weight: 900 !important;
      }

      .community-reply-image-fallback-v3 i {
        font-size: 2rem !important;
      }

      body.light-mode .community-reply-mod-popover,
      html.light-mode .community-reply-mod-popover,
      [data-theme="light"] .community-reply-mod-popover {
        background: #ffffff !important;
        color: #132033 !important;
        border-color: rgba(24, 120, 160, .26) !important;
      }

      body.light-mode .community-reply-mod-action,
      html.light-mode .community-reply-mod-action,
      [data-theme="light"] .community-reply-mod-action {
        color: #132033 !important;
      }

      body.light-mode .community-reply-image-fallback-v3,
      html.light-mode .community-reply-image-fallback-v3,
      [data-theme="light"] .community-reply-image-fallback-v3 {
        background:
          radial-gradient(circle at center, rgba(24,120,160,.10), rgba(245,249,255,.95)) !important;
      }

      @media (max-width: 720px) {
        .community-reply-mod-popover {
          right: 0 !important;
          bottom: calc(100% + 10px) !important;
          transform-origin: right bottom !important;
        }

        .community-reply-media-card-v3.image {
          width: 100% !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function boot() {
    injectStyles();
    enhanceBrokenReplyPreviews();

    const observer = new MutationObserver(() => {
      enhanceBrokenReplyPreviews();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log("[Comunidad] COMMUNITY_REPLY_POPOVER_AND_DRIVE_PREVIEW_FIX_20260627 activo.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


// COMMUNITY_REPLY_POPOVER_AND_DRIVE_PREVIEW_FIX_20260627


/* ============================================================
   COMMUNITY_REPLY_ACTIONS_SHORT_CARD_LAYOUT_FIX_20260627
   Evita superposición de editar/borrar/moderar en respuestas cortas.
============================================================ */
(() => {
  const STYLE_ID = "communityReplyActionsShortCardLayoutFix20260627";

  function injectReplyActionsShortCardFix() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /*
        Reservamos una columna visual a la derecha para acciones:
        editar / borrar / tres puntitos.
        Así una respuesta de una línea no aplasta los botones.
      */
      .community-comment[data-reply-id] {
        position: relative !important;
        min-height: 132px !important;
        padding-right: 76px !important;
        overflow: visible !important;
      }

      .community-comment[data-reply-id] .community-reply-edit-btn,
      .community-comment[data-reply-id] .community-reply-delete-btn,
      .community-comment[data-reply-id] .community-reply-mod-menu {
        right: 18px !important;
      }

      .community-comment[data-reply-id] .community-reply-edit-btn {
        top: 18px !important;
        bottom: auto !important;
      }

      .community-comment[data-reply-id] .community-reply-delete-btn {
        top: 62px !important;
        bottom: auto !important;
      }

      .community-comment[data-reply-id] .community-reply-mod-menu {
        top: 106px !important;
        bottom: auto !important;
        position: absolute !important;
      }

      .community-comment[data-reply-id] .community-reply-mod-trigger {
        width: 38px !important;
        height: 38px !important;
      }

      /*
        Si la respuesta tiene adjuntos o texto largo, la botonera sigue arriba,
        no queda perdida abajo.
      */
      .community-comment[data-reply-id] .community-reply-mod-popover {
        right: calc(100% + 12px) !important;
        top: auto !important;
        bottom: 0 !important;
      }

      /*
        El contenido no debe meterse debajo de los botones.
      */
      .community-comment[data-reply-id] > *:not(.community-reply-edit-btn):not(.community-reply-delete-btn):not(.community-reply-mod-menu) {
        max-width: calc(100% - 8px) !important;
      }

      /*
        En respuestas con preview, dejamos aire para que no choque con el rail.
      */
      .community-reply-attachments-render-v3 {
        margin-right: 0 !important;
        max-width: calc(100% - 8px) !important;
      }

      /*
        Botones más consistentes, mismo tamaño y misma columna.
      */
      .community-reply-edit-btn,
      .community-reply-delete-btn {
        width: 38px !important;
        height: 38px !important;
        display: inline-grid !important;
        place-items: center !important;
      }

      /*
        Mobile: pasamos las acciones a una fila abajo, para no comer ancho.
      */
      @media (max-width: 720px) {
        .community-comment[data-reply-id] {
          min-height: 148px !important;
          padding-right: 14px !important;
          padding-bottom: 58px !important;
        }

        .community-comment[data-reply-id] .community-reply-edit-btn {
          top: auto !important;
          bottom: 12px !important;
          right: 108px !important;
        }

        .community-comment[data-reply-id] .community-reply-delete-btn {
          top: auto !important;
          bottom: 12px !important;
          right: 60px !important;
        }

        .community-comment[data-reply-id] .community-reply-mod-menu {
          top: auto !important;
          bottom: 12px !important;
          right: 12px !important;
        }

        .community-comment[data-reply-id] .community-reply-mod-popover {
          right: 0 !important;
          bottom: calc(100% + 10px) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectReplyActionsShortCardFix);
  } else {
    injectReplyActionsShortCardFix();
  }
})();


// COMMUNITY_REPLY_ACTIONS_SHORT_CARD_LAYOUT_FIX_20260627


/* ============================================================
   COMMUNITY_REPLY_ACTIONS_FINAL_ALIGNMENT_20260627
   Ajuste final: botones laterales centrados, sin pisarse.
============================================================ */
(() => {
  const STYLE_ID = "communityReplyActionsFinalAlignment20260627";

  function injectFinalAlignment() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .community-comment[data-reply-id] {
        min-height: 160px !important;
        padding-right: 88px !important;
        padding-top: 18px !important;
        padding-bottom: 18px !important;
        overflow: visible !important;
      }

      .community-comment[data-reply-id] .community-reply-edit-btn,
      .community-comment[data-reply-id] .community-reply-delete-btn {
        right: 20px !important;
        width: 38px !important;
        height: 38px !important;
        margin: 0 !important;
      }

      .community-comment[data-reply-id] .community-reply-edit-btn {
        top: 16px !important;
        bottom: auto !important;
      }

      .community-comment[data-reply-id] .community-reply-delete-btn {
        top: 61px !important;
        bottom: auto !important;
      }

      .community-comment[data-reply-id] .community-reply-mod-menu {
        position: absolute !important;
        right: 20px !important;
        top: 106px !important;
        bottom: auto !important;
        width: 38px !important;
        height: 38px !important;
        z-index: 90 !important;
      }

      .community-comment[data-reply-id] .community-reply-mod-trigger {
        width: 38px !important;
        height: 38px !important;
        margin: 0 !important;
      }

      .community-comment[data-reply-id] .community-reply-mod-popover {
        right: calc(100% + 12px) !important;
        bottom: 0 !important;
        top: auto !important;
        z-index: 999999 !important;
      }

      .community-comment[data-reply-id] .community-reply-attachments-render-v3 {
        margin-right: 0 !important;
        max-width: calc(100% - 8px) !important;
      }

      .community-comment[data-reply-id] .community-reply-media-card-v3 {
        max-width: min(320px, 100%) !important;
      }

      /*
        Si la respuesta es larga o tiene imagen, los botones quedan arriba,
        pero con aire suficiente y sin invadir la preview.
      */
      .community-comment[data-reply-id] > *:not(.community-reply-edit-btn):not(.community-reply-delete-btn):not(.community-reply-mod-menu) {
        max-width: 100% !important;
      }

      @media (max-width: 720px) {
        .community-comment[data-reply-id] {
          min-height: 152px !important;
          padding-right: 14px !important;
          padding-bottom: 64px !important;
        }

        .community-comment[data-reply-id] .community-reply-edit-btn {
          top: auto !important;
          bottom: 14px !important;
          right: 108px !important;
        }

        .community-comment[data-reply-id] .community-reply-delete-btn {
          top: auto !important;
          bottom: 14px !important;
          right: 60px !important;
        }

        .community-comment[data-reply-id] .community-reply-mod-menu {
          top: auto !important;
          bottom: 14px !important;
          right: 12px !important;
        }

        .community-comment[data-reply-id] .community-reply-mod-popover {
          right: 0 !important;
          bottom: calc(100% + 10px) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectFinalAlignment);
  } else {
    injectFinalAlignment();
  }
})();


// COMMUNITY_REPLY_ACTIONS_FINAL_ALIGNMENT_20260627


/* ============================================================
   COMMUNITY_INLINE_EDIT_UI_V1_20260627
   Edición inline en hilos y respuestas, sin prompt feo.
============================================================ */
(() => {
  const PATCH_ID = "COMMUNITY_INLINE_EDIT_UI_V1_20260627";
  const STYLE_ID = "communityInlineEditUiV120260627";

  if (window.__communityInlineEditUiV1) {
    return;
  }

  window.__communityInlineEditUiV1 = true;

  function getSession() {
    try {
      if (window.ClassroomAuth?.getSession) {
        return window.ClassroomAuth.getSession() || {};
      }

      return JSON.parse(localStorage.getItem("andyazh-classroom-session") || "{}");
    } catch (_) {
      return {};
    }
  }

  function getToken() {
    const session = getSession();

    return (
      session.access_token ||
      session.accessToken ||
      session.token ||
      session.jwt ||
      ""
    );
  }

  function apiBase() {
    const local = ["127.0.0.1", "localhost"].includes(window.location.hostname);

    return local
      ? "http://127.0.0.1:8000/api/classroom"
      : "https://exampro-backend-1n6d.onrender.com/api/classroom";
  }

  async function communityApi(path, options = {}) {
    const token = getToken();

    const headers = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    let body = options.body;

    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }

    const res = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });

    let data = null;

    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (!res.ok) {
      const detail = data?.detail || data?.message || `Error HTTP ${res.status}`;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }

    return data || {};
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function autoGrow(textarea) {
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 86)}px`;
  }

  function extractReplyBody(comment) {
    const clone = comment.cloneNode(true);

    clone.querySelectorAll(`
      [data-community-reply-moderation],
      .community-reply-mod-menu,
      .community-reply-delete-btn,
      .community-reply-edit-btn,
      .community-reply-expand-btn,
      .community-reply-inline-editor,
      .community-reply-attachments-render-v2,
      .community-reply-attachments-render-v3,
      [data-reply-attachments-render-v2],
      [data-reply-attachments-render-v3]
    `).forEach((node) => node.remove());

    const lines = String(clone.textContent || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length && lines[0].startsWith("@")) {
      lines.shift();
    }

    return lines
      .filter((line) => !/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line))
      .join("\n")
      .trim();
  }

  function findReplyTextAnchor(comment) {
    const candidates = Array.from(comment.childNodes)
      .filter((node) => node.nodeType === Node.ELEMENT_NODE)
      .filter((node) => {
        if (node.matches?.(`
          [data-community-reply-moderation],
          .community-reply-mod-menu,
          .community-reply-delete-btn,
          .community-reply-edit-btn,
          .community-reply-expand-btn,
          .community-reply-attachments-render-v2,
          .community-reply-attachments-render-v3,
          [data-reply-attachments-render-v2],
          [data-reply-attachments-render-v3]
        `)) {
          return false;
        }

        const text = String(node.textContent || "").trim();

        if (!text) return false;
        if (text.startsWith("@")) return false;
        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text)) return false;

        return true;
      });

    return candidates[candidates.length - 1] || null;
  }

  function setReplyDisplayText(comment, body) {
    const anchor = findReplyTextAnchor(comment);

    if (anchor) {
      anchor.textContent = body;
      return;
    }

    const div = document.createElement("div");
    div.className = "community-reply-body-inline";
    div.textContent = body;

    const modMenu = comment.querySelector("[data-community-reply-moderation]");
    const editBtn = comment.querySelector(".community-reply-edit-btn");

    if (editBtn) {
      comment.insertBefore(div, editBtn);
    } else if (modMenu) {
      comment.insertBefore(div, modMenu);
    } else {
      comment.appendChild(div);
    }
  }

  function startReplyInlineEdit(comment) {
    if (!comment || comment.dataset.inlineEditing === "1") return;

    const replyId = comment.dataset.replyId;

    if (!replyId) return;

    const current = extractReplyBody(comment);

    comment.dataset.inlineEditing = "1";
    comment.classList.add("community-inline-editing");

    const hiddenNodes = [];

    Array.from(comment.childNodes).forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      if (node.matches?.(`
        [data-community-reply-moderation],
        .community-reply-mod-menu,
        .community-reply-delete-btn,
        .community-reply-edit-btn,
        .community-reply-expand-btn,
        .community-reply-attachments-render-v2,
        .community-reply-attachments-render-v3,
        [data-reply-attachments-render-v2],
        [data-reply-attachments-render-v3]
      `)) {
        return;
      }

      const text = String(node.textContent || "").trim();

      if (!text) return;
      if (text.startsWith("@")) return;
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text)) return;

      node.hidden = true;
      hiddenNodes.push(node);
    });

    const editor = document.createElement("div");
    editor.className = "community-reply-inline-editor";
    editor.innerHTML = `
      <textarea class="community-inline-textarea" data-inline-reply-textarea>${escapeHtml(current)}</textarea>
      <div class="community-inline-edit-actions">
        <button class="btn btn-primary btn-sm" type="button" data-inline-save-reply>
          <i class="fa-solid fa-check"></i>
          Guardar
        </button>
        <button class="btn btn-outline btn-sm" type="button" data-inline-cancel-reply>
          <i class="fa-solid fa-xmark"></i>
          Cancelar
        </button>
      </div>
    `;

    const firstAction =
      comment.querySelector(".community-reply-edit-btn") ||
      comment.querySelector(".community-reply-delete-btn") ||
      comment.querySelector("[data-community-reply-moderation]");

    if (firstAction) {
      comment.insertBefore(editor, firstAction);
    } else {
      comment.appendChild(editor);
    }

    const textarea = editor.querySelector("[data-inline-reply-textarea]");
    const save = editor.querySelector("[data-inline-save-reply]");
    const cancel = editor.querySelector("[data-inline-cancel-reply]");

    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    autoGrow(textarea);

    textarea.addEventListener("input", () => autoGrow(textarea));

    function cleanup() {
      hiddenNodes.forEach((node) => {
        node.hidden = false;
      });

      editor.remove();
      comment.dataset.inlineEditing = "0";
      comment.classList.remove("community-inline-editing");
    }

    cancel.addEventListener("click", cleanup);

    save.addEventListener("click", async () => {
      const body = String(textarea.value || "").trim();

      if (!body) {
        window.alert("La respuesta no puede quedar vacía.");
        return;
      }

      try {
        save.disabled = true;
        cancel.disabled = true;
        save.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando`;

        const data = await communityApi(`/community/replies/${encodeURIComponent(replyId)}`, {
          method: "PATCH",
          body: { body },
        });

        setReplyDisplayText(comment, data?.item?.body || body);
        cleanup();
      } catch (error) {
        console.error(error);
        window.alert(error.message || "No pude editar la respuesta.");
        save.disabled = false;
        cancel.disabled = false;
        save.innerHTML = `<i class="fa-solid fa-check"></i> Guardar`;
      }
    });
  }

  function getThreadTitleNode(card) {
    return Array.from(card.querySelectorAll("h1,h2,h3,h4,.community-post-title,[data-community-thread-title]"))
      .find((node) => String(node.textContent || "").trim()) || null;
  }

  function getThreadBodyNode(card) {
    const titleNode = getThreadTitleNode(card);

    const candidates = Array.from(card.querySelectorAll("p,.community-post-body,[data-community-thread-body]"))
      .filter((node) => {
        const text = String(node.textContent || "").trim();

        if (!text) return false;
        if (titleNode && node === titleNode) return false;
        if (/respuesta/i.test(text) && text.length < 80) return false;

        return true;
      });

    return candidates[0] || null;
  }

  async function startThreadInlineEdit(card) {
    if (!card || card.dataset.inlineThreadEditing === "1") return;

    const threadId = card.dataset.postId || card.getAttribute("data-post-id");

    if (!threadId) return;

    let title = "";
    let body = "";

    const titleNode = getThreadTitleNode(card);
    const bodyNode = getThreadBodyNode(card);

    try {
      const detail = await communityApi(`/community/threads/${encodeURIComponent(threadId)}`);
      const item = detail.item || detail.thread || detail || {};
      title = item.title || titleNode?.textContent?.trim() || "";
      body = item.body || item.content || bodyNode?.textContent?.trim() || "";
    } catch (_) {
      title = titleNode?.textContent?.trim() || "";
      body = bodyNode?.textContent?.trim() || "";
    }

    card.dataset.inlineThreadEditing = "1";
    card.classList.add("community-inline-editing-thread");

    if (titleNode) titleNode.hidden = true;
    if (bodyNode) bodyNode.hidden = true;

    const editor = document.createElement("div");
    editor.className = "community-thread-inline-editor";
    editor.innerHTML = `
      <label class="community-inline-label">
        Título
        <input class="community-inline-input" type="text" data-inline-thread-title value="${escapeHtml(title)}">
      </label>

      <label class="community-inline-label">
        Contenido
        <textarea class="community-inline-textarea" data-inline-thread-body>${escapeHtml(body)}</textarea>
      </label>

      <div class="community-inline-edit-actions">
        <button class="btn btn-primary btn-sm" type="button" data-inline-save-thread>
          <i class="fa-solid fa-check"></i>
          Guardar
        </button>
        <button class="btn btn-outline btn-sm" type="button" data-inline-cancel-thread>
          <i class="fa-solid fa-xmark"></i>
          Cancelar
        </button>
      </div>
    `;

    const insertAfter = bodyNode || titleNode;

    if (insertAfter) {
      insertAfter.insertAdjacentElement("afterend", editor);
    } else {
      card.prepend(editor);
    }

    const titleInput = editor.querySelector("[data-inline-thread-title]");
    const bodyTextarea = editor.querySelector("[data-inline-thread-body]");
    const save = editor.querySelector("[data-inline-save-thread]");
    const cancel = editor.querySelector("[data-inline-cancel-thread]");

    titleInput.focus();
    titleInput.select();
    autoGrow(bodyTextarea);

    bodyTextarea.addEventListener("input", () => autoGrow(bodyTextarea));

    function cleanup() {
      if (titleNode) titleNode.hidden = false;
      if (bodyNode) bodyNode.hidden = false;

      editor.remove();
      card.dataset.inlineThreadEditing = "0";
      card.classList.remove("community-inline-editing-thread");
    }

    cancel.addEventListener("click", cleanup);

    save.addEventListener("click", async () => {
      const nextTitle = String(titleInput.value || "").trim();
      const nextBody = String(bodyTextarea.value || "").trim();

      if (!nextTitle) {
        window.alert("El título no puede quedar vacío.");
        return;
      }

      if (!nextBody) {
        window.alert("El contenido no puede quedar vacío.");
        return;
      }

      try {
        save.disabled = true;
        cancel.disabled = true;
        save.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando`;

        const data = await communityApi(`/community/threads/${encodeURIComponent(threadId)}`, {
          method: "PATCH",
          body: {
            title: nextTitle,
            body: nextBody,
          },
        });

        const item = data.item || {};

        if (titleNode) titleNode.textContent = item.title || nextTitle;
        if (bodyNode) bodyNode.textContent = item.body || nextBody;

        cleanup();
      } catch (error) {
        console.error(error);
        window.alert(error.message || "No pude editar el hilo.");
        save.disabled = false;
        cancel.disabled = false;
        save.innerHTML = `<i class="fa-solid fa-check"></i> Guardar`;
      }
    });
  }

  function mountInlineEditButtons() {
    document.querySelectorAll(".community-comment[data-reply-id]").forEach((comment) => {
      const edit = comment.querySelector(".community-reply-edit-btn");

      if (!edit || edit.dataset.inlineEditBound === "1") return;

      edit.dataset.inlineEditBound = "1";

      edit.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        startReplyInlineEdit(comment);
      }, true);
    });

    document.querySelectorAll("[data-post-id]").forEach((card) => {
      const edit = card.querySelector("[data-community-edit-thread], .community-thread-edit-btn");

      if (!edit || edit.dataset.inlineEditBound === "1") return;

      edit.dataset.inlineEditBound = "1";

      edit.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        startThreadInlineEdit(card);
      }, true);
    });
  }

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .community-reply-inline-editor,
      .community-thread-inline-editor {
        width: min(100%, calc(100% - 90px)) !important;
        display: grid !important;
        gap: 10px !important;
        margin-top: 10px !important;
        padding: 12px !important;
        border-radius: 16px !important;
        border: 1px solid rgba(103, 235, 255, .24) !important;
        background: rgba(103, 235, 255, .055) !important;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.025) !important;
      }

      .community-thread-inline-editor {
        margin: 12px 0 !important;
      }

      .community-inline-label {
        display: grid !important;
        gap: 6px !important;
        color: var(--text-muted, #9db4d6) !important;
        font-size: .82rem !important;
        font-weight: 900 !important;
        text-transform: uppercase !important;
        letter-spacing: .04em !important;
      }

      .community-inline-input,
      .community-inline-textarea {
        width: 100% !important;
        border-radius: 14px !important;
        border: 1px solid rgba(103, 235, 255, .25) !important;
        background: rgba(4, 8, 20, .68) !important;
        color: var(--text-main, #eaf6ff) !important;
        padding: 11px 12px !important;
        outline: none !important;
        font: inherit !important;
        text-transform: none !important;
        letter-spacing: normal !important;
      }

      .community-inline-textarea {
        min-height: 92px !important;
        resize: vertical !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
        white-space: pre-wrap !important;
      }

      .community-inline-input:focus,
      .community-inline-textarea:focus {
        border-color: rgba(103, 235, 255, .55) !important;
        box-shadow: 0 0 0 3px rgba(103, 235, 255, .10) !important;
      }

      .community-inline-edit-actions {
        display: flex !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
        justify-content: flex-end !important;
      }

      .community-inline-editing .community-reply-edit-btn,
      .community-inline-editing .community-reply-delete-btn,
      .community-inline-editing .community-reply-mod-menu {
        opacity: .35 !important;
        pointer-events: none !important;
      }

      body.light-mode .community-reply-inline-editor,
      html.light-mode .community-reply-inline-editor,
      [data-theme="light"] .community-reply-inline-editor,
      body.light-mode .community-thread-inline-editor,
      html.light-mode .community-thread-inline-editor,
      [data-theme="light"] .community-thread-inline-editor {
        background: rgba(255,255,255,.76) !important;
        border-color: rgba(24, 120, 160, .22) !important;
      }

      body.light-mode .community-inline-input,
      html.light-mode .community-inline-input,
      [data-theme="light"] .community-inline-input,
      body.light-mode .community-inline-textarea,
      html.light-mode .community-inline-textarea,
      [data-theme="light"] .community-inline-textarea {
        background: rgba(255,255,255,.88) !important;
        color: var(--text-main, #132033) !important;
      }

      @media (max-width: 720px) {
        .community-reply-inline-editor,
        .community-thread-inline-editor {
          width: 100% !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function boot() {
    injectStyles();
    mountInlineEditButtons();

    const observer = new MutationObserver(() => {
      mountInlineEditButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log(`[Comunidad] ${PATCH_ID} activo.`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


// COMMUNITY_INLINE_EDIT_UI_V1_20260627


/* ============================================================
   COMMUNITY_INLINE_EDIT_NO_RELOAD_AND_LINKIFY_20260627
   Guardado inline sin recargar + links automáticos.
============================================================ */
(() => {
  const PATCH_ID = "COMMUNITY_INLINE_EDIT_NO_RELOAD_AND_LINKIFY_20260627";
  const STYLE_ID = "communityInlineNoReloadLinkify20260627";

  if (window.__communityInlineNoReloadAndLinkify20260627) {
    return;
  }

  window.__communityInlineNoReloadAndLinkify20260627 = true;

  function getSession() {
    try {
      if (window.ClassroomAuth?.getSession) {
        return window.ClassroomAuth.getSession() || {};
      }

      return JSON.parse(localStorage.getItem("andyazh-classroom-session") || "{}");
    } catch (_) {
      return {};
    }
  }

  function getToken() {
    const session = getSession();

    return (
      session.access_token ||
      session.accessToken ||
      session.token ||
      session.jwt ||
      ""
    );
  }

  function apiBase() {
    const local = ["127.0.0.1", "localhost"].includes(window.location.hostname);

    return local
      ? "http://127.0.0.1:8000/api/classroom"
      : "https://exampro-backend-1n6d.onrender.com/api/classroom";
  }

  async function communityApi(path, options = {}) {
    const token = getToken();

    const headers = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    let body = options.body;

    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }

    const res = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });

    let data = null;

    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (!res.ok) {
      const detail = data?.detail || data?.message || `Error HTTP ${res.status}`;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }

    return data || {};
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeUrl(url) {
    const raw = String(url || "").trim();

    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^www\./i.test(raw)) return `https://${raw}`;

    return `https://${raw}`;
  }

  function linkifyHtml(text) {
    const escaped = escapeHtml(text);

    const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+|\b(?:bit\.ly|tinyurl\.com|forms\.gle|drive\.google\.com|docs\.google\.com|github\.com|youtu\.be)\/[^\s<]+)/gi;

    return escaped.replace(urlRegex, (match) => {
      const clean = match.replace(/[),.;!?]+$/g, "");
      const trailing = match.slice(clean.length);
      const href = normalizeUrl(clean);

      return `<a class="community-auto-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(clean)}</a>${escapeHtml(trailing)}`;
    }).replace(/\n/g, "<br>");
  }

  function setContentHtml(node, text) {
    if (!node) return;

    node.innerHTML = linkifyHtml(text);
  }

  function shouldSkipLinkifyElement(element) {
    if (!element) return true;

    return Boolean(element.closest(`
      a,
      button,
      input,
      textarea,
      select,
      option,
      script,
      style,
      .community-inline-input,
      .community-inline-textarea,
      .community-reply-inline-editor,
      .community-thread-inline-editor,
      .community-reply-mod-menu,
      .community-reply-attachments-render-v2,
      .community-reply-attachments-render-v3,
      [data-reply-attachments-render-v2],
      [data-reply-attachments-render-v3]
    `));
  }

  function linkifyExistingText(root = document) {
    const scope = root.querySelectorAll
      ? root
      : document;

    const walker = document.createTreeWalker(
      scope.body || scope,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;

          if (!parent || shouldSkipLinkifyElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          const text = String(node.nodeValue || "");

          if (!/((https?:\/\/|www\.)|(\b(bit\.ly|tinyurl\.com|forms\.gle|drive\.google\.com|docs\.google\.com|github\.com|youtu\.be)\/))/i.test(text)) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const nodes = [];

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    nodes.forEach((node) => {
      const span = document.createElement("span");
      span.innerHTML = linkifyHtml(node.nodeValue || "");
      node.parentNode.replaceChild(span, node);
    });
  }

  function replyTextNodes(comment) {
    return Array.from(comment.childNodes)
      .filter((node) => node.nodeType === Node.ELEMENT_NODE)
      .filter((node) => {
        if (node.matches?.(`
          [data-community-reply-moderation],
          .community-reply-mod-menu,
          .community-reply-delete-btn,
          .community-reply-edit-btn,
          .community-reply-expand-btn,
          .community-reply-inline-editor,
          .community-reply-attachments-render-v2,
          .community-reply-attachments-render-v3,
          [data-reply-attachments-render-v2],
          [data-reply-attachments-render-v3]
        `)) {
          return false;
        }

        const text = String(node.textContent || "").trim();

        if (!text) return false;
        if (text.startsWith("@")) return false;
        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text)) return false;

        return true;
      });
  }

  function getOrCreateReplyBodyNode(comment) {
    const nodes = replyTextNodes(comment);

    if (nodes.length) {
      return nodes[nodes.length - 1];
    }

    const div = document.createElement("div");
    div.className = "community-reply-body-inline";

    const firstAction =
      comment.querySelector(".community-reply-edit-btn") ||
      comment.querySelector(".community-reply-delete-btn") ||
      comment.querySelector("[data-community-reply-moderation]");

    if (firstAction) {
      comment.insertBefore(div, firstAction);
    } else {
      comment.appendChild(div);
    }

    return div;
  }

  function cleanupReplyEditor(comment) {
    comment.querySelectorAll(".community-reply-inline-editor").forEach((editor) => editor.remove());

    Array.from(comment.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        node.hidden = false;
      }
    });

    comment.dataset.inlineEditing = "0";
    comment.classList.remove("community-inline-editing");
  }

  function cleanupThreadEditor(card) {
    card.querySelectorAll(".community-thread-inline-editor").forEach((editor) => editor.remove());

    Array.from(card.querySelectorAll("[hidden]")).forEach((node) => {
      if (!node.closest(".community-reply-inline-editor,.community-thread-inline-editor")) {
        node.hidden = false;
      }
    });

    card.dataset.inlineThreadEditing = "0";
    card.classList.remove("community-inline-editing-thread");
  }

  function findThreadTitleNode(card) {
    return Array.from(card.querySelectorAll("h1,h2,h3,h4,.community-post-title,[data-community-thread-title]"))
      .find((node) => String(node.textContent || "").trim()) || null;
  }

  function findThreadBodyNode(card) {
    const title = findThreadTitleNode(card);

    return Array.from(card.querySelectorAll("p,.community-post-body,[data-community-thread-body]"))
      .find((node) => {
        const text = String(node.textContent || "").trim();

        if (!text) return false;
        if (title && node === title) return false;
        if (/respuesta/i.test(text) && text.length < 80) return false;

        return true;
      }) || null;
  }

  async function saveReplyInline(button) {
    const comment = button.closest(".community-comment[data-reply-id]");
    const editor = button.closest(".community-reply-inline-editor");
    const textarea = editor?.querySelector("[data-inline-reply-textarea]");

    if (!comment || !editor || !textarea) return false;

    const replyId = comment.dataset.replyId;
    const body = String(textarea.value || "").trim();

    if (!replyId) return false;

    if (!body) {
      window.alert("La respuesta no puede quedar vacía.");
      return true;
    }

    const cancel = editor.querySelector("[data-inline-cancel-reply]");

    try {
      button.disabled = true;
      if (cancel) cancel.disabled = true;
      button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando`;

      const data = await communityApi(`/community/replies/${encodeURIComponent(replyId)}`, {
        method: "PATCH",
        body: { body },
      });

      const savedBody = data?.item?.body || body;

      cleanupReplyEditor(comment);

      const bodyNode = getOrCreateReplyBodyNode(comment);
      setContentHtml(bodyNode, savedBody);

      linkifyExistingText(comment);
    } catch (error) {
      console.error(error);
      window.alert(error.message || "No pude editar la respuesta.");

      button.disabled = false;
      if (cancel) cancel.disabled = false;
      button.innerHTML = `<i class="fa-solid fa-check"></i> Guardar`;
    }

    return true;
  }

  async function saveThreadInline(button) {
    const card = button.closest("[data-post-id]");
    const editor = button.closest(".community-thread-inline-editor");
    const titleInput = editor?.querySelector("[data-inline-thread-title]");
    const bodyTextarea = editor?.querySelector("[data-inline-thread-body]");

    if (!card || !editor || !titleInput || !bodyTextarea) return false;

    const threadId = card.dataset.postId || card.getAttribute("data-post-id");
    const title = String(titleInput.value || "").trim();
    const body = String(bodyTextarea.value || "").trim();

    if (!threadId) return false;

    if (!title) {
      window.alert("El título no puede quedar vacío.");
      return true;
    }

    if (!body) {
      window.alert("El contenido no puede quedar vacío.");
      return true;
    }

    const cancel = editor.querySelector("[data-inline-cancel-thread]");

    try {
      button.disabled = true;
      if (cancel) cancel.disabled = true;
      button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando`;

      const data = await communityApi(`/community/threads/${encodeURIComponent(threadId)}`, {
        method: "PATCH",
        body: { title, body },
      });

      const item = data?.item || {};
      const savedTitle = item.title || title;
      const savedBody = item.body || body;

      cleanupThreadEditor(card);

      const titleNode = findThreadTitleNode(card);
      const bodyNode = findThreadBodyNode(card);

      if (titleNode) {
        titleNode.textContent = savedTitle;
      }

      if (bodyNode) {
        setContentHtml(bodyNode, savedBody);
      }

      linkifyExistingText(card);
    } catch (error) {
      console.error(error);
      window.alert(error.message || "No pude editar el hilo.");

      button.disabled = false;
      if (cancel) cancel.disabled = false;
      button.innerHTML = `<i class="fa-solid fa-check"></i> Guardar`;
    }

    return true;
  }

  function bindInlineSaveOverride() {
    document.addEventListener("click", async (event) => {
      const saveReply = event.target.closest("[data-inline-save-reply]");
      const saveThread = event.target.closest("[data-inline-save-thread]");

      if (!saveReply && !saveThread) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (saveReply) {
        await saveReplyInline(saveReply);
        return;
      }

      if (saveThread) {
        await saveThreadInline(saveThread);
      }
    }, true);
  }

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .community-auto-link {
        color: #67ebff !important;
        font-weight: 850 !important;
        text-decoration: none !important;
        border-bottom: 1px dashed rgba(103, 235, 255, .45) !important;
        overflow-wrap: anywhere !important;
      }

      .community-auto-link:hover {
        color: #b9f6ff !important;
        border-bottom-style: solid !important;
      }

      body.light-mode .community-auto-link,
      html.light-mode .community-auto-link,
      [data-theme="light"] .community-auto-link {
        color: #087a9a !important;
        border-bottom-color: rgba(8, 122, 154, .42) !important;
      }
    `;

    document.head.appendChild(style);
  }

  function boot() {
    injectStyles();
    bindInlineSaveOverride();
    linkifyExistingText(document);

    const observer = new MutationObserver(() => {
      linkifyExistingText(document);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log(`[Comunidad] ${PATCH_ID} activo.`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


// COMMUNITY_INLINE_EDIT_NO_RELOAD_AND_LINKIFY_20260627


/* ============================================================
   COMMUNITY_REPLY_INLINE_ATTACHMENT_EDIT_V1_20260627
   Editar adjuntos en respuestas: quitar existentes + agregar nuevos.
============================================================ */
(() => {
  const PATCH_ID = "COMMUNITY_REPLY_INLINE_ATTACHMENT_EDIT_V1_20260627";
  const STYLE_ID = "communityReplyInlineAttachmentEditV120260627";

  if (window.__communityReplyInlineAttachmentEditV1) {
    return;
  }

  window.__communityReplyInlineAttachmentEditV1 = true;

  const stateByReplyId = new Map();

  function getSession() {
    try {
      if (window.ClassroomAuth?.getSession) {
        return window.ClassroomAuth.getSession() || {};
      }

      return JSON.parse(localStorage.getItem("andyazh-classroom-session") || "{}");
    } catch (_) {
      return {};
    }
  }

  function getToken() {
    const session = getSession();

    return (
      session.access_token ||
      session.accessToken ||
      session.token ||
      session.jwt ||
      ""
    );
  }

  function apiBase() {
    const local = ["127.0.0.1", "localhost"].includes(window.location.hostname);

    return local
      ? "http://127.0.0.1:8000/api/classroom"
      : "https://exampro-backend-1n6d.onrender.com/api/classroom";
  }

  async function api(path, options = {}) {
    const token = getToken();

    const headers = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    let body = options.body;

    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }

    const res = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });

    let data = null;

    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (!res.ok) {
      const detail = data?.detail || data?.message || `Error HTTP ${res.status}`;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }

    return data || {};
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);

    if (!value) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const amount = value / Math.pow(1024, index);

    return `${amount.toFixed(amount >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function fileName(item) {
    return item?.filename || item?.name || "archivo";
  }

  function fileSize(item) {
    return item?.size_bytes || item?.size || 0;
  }

  function mimeType(item) {
    return String(item?.mime_type || item?.type || "").toLowerCase();
  }

  function isImage(item) {
    const mime = mimeType(item);
    const name = fileName(item).toLowerCase();

    return mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
  }

  function isVideo(item) {
    const mime = mimeType(item);
    const name = fileName(item).toLowerCase();

    return mime.startsWith("video/") || /\.(mp4|webm|mov|mkv|avi)$/i.test(name);
  }

  function iconFor(item) {
    const mime = mimeType(item);
    const name = fileName(item).toLowerCase();

    if (isImage(item)) return "fa-regular fa-image";
    if (isVideo(item)) return "fa-regular fa-file-video";
    if (mime.startsWith("audio/")) return "fa-regular fa-file-audio";
    if (mime.includes("pdf") || name.endsWith(".pdf")) return "fa-regular fa-file-pdf";
    if (name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".7z")) return "fa-regular fa-file-zipper";
    if (name.endsWith(".txt") || name.endsWith(".log") || name.endsWith(".md")) return "fa-regular fa-file-lines";

    return "fa-solid fa-paperclip";
  }

  function driveThumb(item) {
    const fileId = item?.provider_file_id || item?.file_id || "";

    if (!fileId) return "";

    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w600`;
  }

  function attachmentOpenUrl(item) {
    return item?.view_url || item?.preview_url || item?.download_url || item?.url || "#";
  }

  async function loadReplyAttachments(replyId) {
    const data = await api(`/community/replies/${encodeURIComponent(replyId)}/attachments`);
    return Array.isArray(data.items) ? data.items : [];
  }

  async function deleteAttachment(attachmentId) {
    return api(`/community/attachments/${encodeURIComponent(attachmentId)}`, {
      method: "DELETE",
    });
  }

  async function uploadReplyAttachments(replyId, files) {
    const list = Array.isArray(files) ? files : [];

    if (!list.length) return [];

    const formData = new FormData();

    list.forEach((file) => {
      formData.append("files", file, file.name || "archivo");
    });

    const data = await api(`/community/replies/${encodeURIComponent(replyId)}/attachments`, {
      method: "POST",
      body: formData,
    });

    return data.items || [];
  }

  function ensureState(replyId) {
    if (!stateByReplyId.has(replyId)) {
      stateByReplyId.set(replyId, {
        existing: [],
        removeIds: new Set(),
        newFiles: [],
      });
    }

    return stateByReplyId.get(replyId);
  }

  function renderExistingAttachments(editor, replyId) {
    const state = ensureState(replyId);
    const box = editor.querySelector("[data-inline-existing-attachments]");

    if (!box) return;

    const visible = state.existing.filter((item) => !state.removeIds.has(String(item.id)));

    if (!visible.length) {
      box.innerHTML = `<div class="community-inline-attach-empty">Sin adjuntos actuales.</div>`;
      return;
    }

    box.innerHTML = visible.map((item) => {
      const id = String(item.id || "");
      const thumb = driveThumb(item);
      const name = fileName(item);
      const size = formatBytes(fileSize(item));

      return `
        <div class="community-inline-existing-attach" data-inline-existing-attachment-id="${escapeHtml(id)}">
          ${isImage(item) && thumb ? `
            <img src="${escapeHtml(thumb)}" alt="${escapeHtml(name)}" loading="lazy">
          ` : `
            <div class="community-inline-existing-file-icon">
              <i class="fa-solid ${escapeHtml(iconFor(item))}"></i>
            </div>
          `}

          <div class="community-inline-existing-attach-info">
            <strong>${escapeHtml(name)}</strong>
            <small>${escapeHtml(size)}</small>
          </div>

          <a href="${escapeHtml(attachmentOpenUrl(item))}" target="_blank" rel="noopener" title="Abrir adjunto">
            <i class="fa-solid fa-up-right-from-square"></i>
          </a>

          <button type="button" data-inline-remove-existing-attachment="${escapeHtml(id)}" title="Quitar adjunto">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;
    }).join("");

    box.querySelectorAll("[data-inline-remove-existing-attachment]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = String(button.dataset.inlineRemoveExistingAttachment || "");

        if (!id) return;

        state.removeIds.add(id);
        renderExistingAttachments(editor, replyId);
      });
    });
  }

  function renderNewFiles(editor, replyId) {
    const state = ensureState(replyId);
    const box = editor.querySelector("[data-inline-new-attachments]");

    if (!box) return;

    if (!state.newFiles.length) {
      box.innerHTML = "";
      box.hidden = true;
      return;
    }

    box.hidden = false;
    box.innerHTML = state.newFiles.map((file, index) => `
      <div class="community-inline-new-attach">
        <i class="fa-solid ${escapeHtml(iconFor(file))}"></i>
        <span>${escapeHtml(file.name || "archivo")}</span>
        <small>${escapeHtml(formatBytes(file.size || 0))}</small>
        <button type="button" data-inline-remove-new-attachment="${index}" title="Quitar adjunto nuevo">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `).join("");

    box.querySelectorAll("[data-inline-remove-new-attachment]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.inlineRemoveNewAttachment);
        state.newFiles = state.newFiles.filter((_, i) => i !== index);
        renderNewFiles(editor, replyId);
      });
    });
  }

  function mountAttachmentEditor(comment, editor) {
    const replyId = comment?.dataset?.replyId;

    if (!replyId || !editor || editor.dataset.attachmentsMounted === "1") {
      return;
    }

    editor.dataset.attachmentsMounted = "1";

    const panel = document.createElement("div");
    panel.className = "community-inline-attachments-editor";
    panel.innerHTML = `
      <div class="community-inline-attachments-head">
        <div>
          <strong>Adjuntos</strong>
          <small>Quitá archivos actuales o agregá nuevos.</small>
        </div>
      </div>

      <div class="community-inline-existing-attachments" data-inline-existing-attachments>
        <div class="community-inline-attach-empty">Cargando adjuntos...</div>
      </div>

      <div class="community-inline-new-attachments" data-inline-new-attachments hidden></div>

      <div class="community-inline-attachment-picker">
        <input type="file" data-inline-attachment-input="image" accept="image/*" multiple hidden>
        <input type="file" data-inline-attachment-input="video" accept="video/*" multiple hidden>
        <input
          type="file"
          data-inline-attachment-input="file"
          accept="application/pdf,.pdf,.zip,.rar,.7z,.txt,.log,.csv,.json,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*,video/*,audio/*"
          multiple
          hidden
        >

        <button type="button" class="community-inline-attach-pick image" data-inline-attachment-pick="image">
          <i class="fa-solid fa-image"></i>
          Imagen
        </button>

        <button type="button" class="community-inline-attach-pick video" data-inline-attachment-pick="video">
          <i class="fa-solid fa-video"></i>
          Video
        </button>

        <button type="button" class="community-inline-attach-pick file" data-inline-attachment-pick="file">
          <i class="fa-solid fa-paperclip"></i>
          Archivo
        </button>
      </div>
    `;

    const actions = editor.querySelector(".community-inline-edit-actions");

    if (actions) {
      editor.insertBefore(panel, actions);
    } else {
      editor.appendChild(panel);
    }

    panel.querySelectorAll("[data-inline-attachment-pick]").forEach((button) => {
      button.addEventListener("click", () => {
        const kind = button.dataset.inlineAttachmentPick;
        panel.querySelector(`[data-inline-attachment-input="${CSS.escape(kind)}"]`)?.click();
      });
    });

    panel.querySelectorAll("[data-inline-attachment-input]").forEach((input) => {
      input.addEventListener("change", () => {
        const selected = Array.from(input.files || []);
        const state = ensureState(replyId);

        state.newFiles = [...state.newFiles, ...selected].slice(0, 20);

        if (selected.length && state.newFiles.length >= 20) {
          window.alert("Máximo 20 adjuntos nuevos por edición.");
        }

        renderNewFiles(editor, replyId);
        input.value = "";
      });
    });

    loadReplyAttachments(replyId)
      .then((items) => {
        const state = ensureState(replyId);
        state.existing = items;
        renderExistingAttachments(editor, replyId);
      })
      .catch((error) => {
        console.warn("[Comunidad] No pude cargar adjuntos para editar", replyId, error);
        panel.querySelector("[data-inline-existing-attachments]").innerHTML =
          `<div class="community-inline-attach-empty danger">No pude cargar adjuntos actuales.</div>`;
      });
  }

  async function applyAttachmentChanges(comment) {
    const replyId = comment?.dataset?.replyId;

    if (!replyId) return;

    const state = ensureState(replyId);
    const removeIds = Array.from(state.removeIds);
    const newFiles = Array.from(state.newFiles);

    for (const attachmentId of removeIds) {
      await deleteAttachment(attachmentId);
    }

    if (newFiles.length) {
      await uploadReplyAttachments(replyId, newFiles);
    }

    state.removeIds.clear();
    state.newFiles = [];
  }

  function enhanceInlineEditors() {
    document.querySelectorAll(".community-comment[data-reply-id]").forEach((comment) => {
      const editor = comment.querySelector(".community-reply-inline-editor");

      if (!editor) return;

      mountAttachmentEditor(comment, editor);
    });
  }

  function interceptSaveButtons() {
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-inline-save-reply]");

      if (!button) return;

      const comment = button.closest(".community-comment[data-reply-id]");

      if (!comment) return;

      const replyId = comment.dataset.replyId;
      const state = ensureState(replyId);

      if (!state.removeIds.size && !state.newFiles.length) {
        return;
      }

      /*
        No frenamos el handler anterior: lo dejamos guardar texto.
        Después de un mini delay aplicamos adjuntos. Si falla, avisamos.
      */
      setTimeout(async () => {
        try {
          await applyAttachmentChanges(comment);

          // Recargamos solo la vista de esa respuesta con un refresh simple.
          // Evitamos reload completo; la hidratación de previews existente vuelve a leer adjuntos.
          comment.querySelectorAll(
            ".community-reply-attachments-render-v2, .community-reply-attachments-render-v3, [data-reply-attachments-render-v2], [data-reply-attachments-render-v3]"
          ).forEach((node) => node.remove());

          // Permitimos que los módulos de preview vuelvan a hidratar.
          comment.dataset.replyAttachmentsFetchV2 = "0";

          window.dispatchEvent(new CustomEvent("community-reply-attachments-updated", {
            detail: { replyId },
          }));

          // Como los módulos existentes escuchan DOM, forzamos una pequeña mutación inocente.
          const marker = document.createElement("span");
          marker.hidden = true;
          marker.dataset.replyAttachmentRefreshMarker = replyId;
          comment.appendChild(marker);
          setTimeout(() => marker.remove(), 100);
        } catch (error) {
          console.error(error);
          window.alert(error.message || "El texto se guardó, pero no pude actualizar los adjuntos.");
        }
      }, 300);
    }, true);
  }

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .community-inline-attachments-editor {
        display: grid !important;
        gap: 10px !important;
        margin-top: 10px !important;
        padding: 12px !important;
        border-radius: 16px !important;
        border: 1px solid rgba(103, 235, 255, .20) !important;
        background: rgba(4, 8, 20, .26) !important;
      }

      .community-inline-attachments-head {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 10px !important;
      }

      .community-inline-attachments-head strong {
        display: block !important;
        color: var(--text-main, #eaf6ff) !important;
        font-weight: 950 !important;
      }

      .community-inline-attachments-head small,
      .community-inline-attach-empty {
        display: block !important;
        color: var(--text-muted, #9db4d6) !important;
        font-size: .82rem !important;
      }

      .community-inline-attach-empty.danger {
        color: #ff8aa8 !important;
      }

      .community-inline-existing-attachments,
      .community-inline-new-attachments {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 8px !important;
      }

      .community-inline-existing-attach {
        width: min(100%, 360px) !important;
        display: grid !important;
        grid-template-columns: 54px minmax(0, 1fr) auto auto !important;
        align-items: center !important;
        gap: 9px !important;
        padding: 8px !important;
        border-radius: 14px !important;
        border: 1px solid rgba(103, 235, 255, .18) !important;
        background: rgba(103, 235, 255, .07) !important;
      }

      .community-inline-existing-attach img,
      .community-inline-existing-file-icon {
        width: 54px !important;
        height: 42px !important;
        border-radius: 10px !important;
        object-fit: cover !important;
        background: rgba(0,0,0,.18) !important;
      }

      .community-inline-existing-file-icon {
        display: grid !important;
        place-items: center !important;
        color: #67ebff !important;
      }

      .community-inline-existing-attach-info {
        min-width: 0 !important;
        display: grid !important;
        gap: 2px !important;
      }

      .community-inline-existing-attach-info strong {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      .community-inline-existing-attach-info small {
        color: var(--text-muted, #9db4d6) !important;
        font-size: .78rem !important;
      }

      .community-inline-existing-attach a,
      .community-inline-existing-attach button,
      .community-inline-new-attach button {
        width: 30px !important;
        height: 30px !important;
        display: inline-grid !important;
        place-items: center !important;
        border-radius: 999px !important;
        border: 1px solid rgba(103, 235, 255, .22) !important;
        background: rgba(103, 235, 255, .08) !important;
        color: #67ebff !important;
        cursor: pointer !important;
        text-decoration: none !important;
      }

      .community-inline-existing-attach button,
      .community-inline-new-attach button {
        border-color: rgba(255, 123, 155, .35) !important;
        background: rgba(255, 123, 155, .10) !important;
        color: #ff8aa8 !important;
      }

      .community-inline-new-attach {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        max-width: min(100%, 360px) !important;
        padding: 8px 10px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(179, 119, 255, .22) !important;
        background: rgba(179, 119, 255, .08) !important;
      }

      .community-inline-new-attach span {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      .community-inline-new-attach small {
        opacity: .72 !important;
        white-space: nowrap !important;
      }

      .community-inline-attachment-picker {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 8px !important;
      }

      .community-inline-attach-pick {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 8px 10px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(103, 235, 255, .25) !important;
        background: rgba(103, 235, 255, .08) !important;
        color: var(--text-main, #eaf6ff) !important;
        cursor: pointer !important;
        font-weight: 850 !important;
      }

      .community-inline-attach-pick.image i {
        color: #67ebff !important;
      }

      .community-inline-attach-pick.video i {
        color: #c89cff !important;
      }

      .community-inline-attach-pick.file i {
        color: #ffd36b !important;
      }

      body.light-mode .community-inline-attachments-editor,
      html.light-mode .community-inline-attachments-editor,
      [data-theme="light"] .community-inline-attachments-editor,
      body.light-mode .community-inline-existing-attach,
      html.light-mode .community-inline-existing-attach,
      [data-theme="light"] .community-inline-existing-attach,
      body.light-mode .community-inline-new-attach,
      html.light-mode .community-inline-new-attach,
      [data-theme="light"] .community-inline-new-attach {
        background: rgba(255,255,255,.72) !important;
      }

      @media (max-width: 720px) {
        .community-inline-existing-attach {
          grid-template-columns: 48px minmax(0, 1fr) auto auto !important;
        }

        .community-inline-existing-attach img,
        .community-inline-existing-file-icon {
          width: 48px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function boot() {
    injectStyles();
    interceptSaveButtons();
    enhanceInlineEditors();

    const observer = new MutationObserver(() => {
      enhanceInlineEditors();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log(`[Comunidad] ${PATCH_ID} activo.`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


// COMMUNITY_REPLY_INLINE_ATTACHMENT_EDIT_V1_20260627
