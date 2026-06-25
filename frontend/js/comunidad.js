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

  async function renderPosts() {
    if (!els.list) return;
    if (isRendering) return;

    isRendering = true;

    try {
      showEmpty(false);
      showListMessage("Cargando Comunidad desde backend...", "fa-spinner fa-spin");

      const posts = await loadPostsFromApi();

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
          <span><i class="fa-regular fa-image"></i> ${escapeHtml(attachment.name)}</span>
          <button type="button" class="community-icon-btn" data-remove-attachment="${index}" aria-label="Quitar imagen">
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
      });
    });
  }

  function handleImageSelection(event) {
    const files = Array.from(event.target.files || []);

    pendingAttachments = files.slice(0, 3).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    if (pendingAttachments.length) {
      window.alert("Las imágenes todavía no se suben al backend. Las conectamos en la fase de adjuntos.");
    }

    renderAttachmentPreview();
  }

  function renderPostAttachments() {
    return "";
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
              <textarea rows="3" maxlength="900" placeholder="Escribí una respuesta útil, consejo o posible solución..." required></textarea>
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

  function init() {
    injectCommunityApiV2Styles();
    cacheElements();
    bindEvents();
    renderPosts();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
