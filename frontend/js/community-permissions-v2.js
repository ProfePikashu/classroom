(function (root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.CommunityPermissionsV2 = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const SESSION_KEY = "andyazh-classroom-session";
  const API_BASE = "https://api.andyazhtec.com/api/classroom";

  const OWNER_OR_MOD_SELECTORS = [
    "[data-community-delete]",
    "[data-community-resolve]",
    "[data-community-edit-thread]",
  ];

  const MOD_ONLY_SELECTORS = [
    "[data-community-thread-moderation]",
    "[data-community-reply-moderation]",
    ".community-mod-toolbar",
    ".community-reply-mod-menu",
  ];

  const REPLY_OWNER_OR_MOD_SELECTORS = [
    ".community-reply-delete-btn",
    ".community-reply-edit-btn",
  ];

  function normalizeTwitch(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
  }

  function readSession() {
    try {
      if (root.ClassroomAuth?.getSession) {
        const session = root.ClassroomAuth.getSession();
        if (session) return session;
      }

      return JSON.parse(root.localStorage?.getItem(SESSION_KEY) || "null");
    } catch (_) {
      return null;
    }
  }

  function sessionCanModerate(session) {
    if (!session || typeof session !== "object") return false;

    const role = String(session.role || "").trim().toLowerCase();
    const backendRole = String(
      session.backendRole || session.exampro?.role || ""
    ).trim().toLowerCase();

    if (
      role === "teacher" ||
      role === "docente" ||
      backendRole === "docente"
    ) {
      return true;
    }

    return Boolean(session.permissions?.["community.moderate"]);
  }

  function currentCanModerate() {
    try {
      if (root.ClassroomRoles?.currentHasPermission) {
        return Boolean(
          root.ClassroomRoles.currentHasPermission("community.moderate")
        );
      }
    } catch (_) {
      // Fallback below.
    }

    return sessionCanModerate(readSession());
  }

  function currentTwitch() {
    const session = readSession();
    const alumno = session?.alumno || {};

    return normalizeTwitch(
      session?.twitch ||
      session?.student?.twitch ||
      session?.twitch_username ||
      alumno["Usuario de Twitch"] ||
      alumno[
        "Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)"
      ]
    );
  }

  function textContainsCurrentTwitch(rootNode, removeSelector) {
    const twitch = currentTwitch();
    if (!twitch || !rootNode?.cloneNode) return false;

    const clone = rootNode.cloneNode(true);

    if (removeSelector) {
      clone.querySelectorAll?.(removeSelector).forEach((node) => node.remove());
    }

    const text = String(clone.textContent || "").toLowerCase();
    return text.includes(`@${twitch}`);
  }

  function threadBelongsToCurrentUser(card) {
    return textContainsCurrentTwitch(card, ".community-comments");
  }

  function replyBelongsToCurrentUser(comment) {
    return textContainsCurrentTwitch(comment);
  }

  function setAllowed(node, allowed) {
    if (!node) return;

    if (allowed) {
      node.setAttribute("data-community-permission-allowed", "1");
      node.removeAttribute("aria-hidden");
      return;
    }

    node.removeAttribute("data-community-permission-allowed");
    node.setAttribute("aria-hidden", "true");
  }

  function enforceCard(card) {
    if (!card) return;

    const canModerate = currentCanModerate();
    const ownsThread = threadBelongsToCurrentUser(card);
    const canManageThread = canModerate || ownsThread;

    OWNER_OR_MOD_SELECTORS.forEach((selector) => {
      card.querySelectorAll(selector).forEach((node) => {
        setAllowed(node, canManageThread);
      });
    });

    MOD_ONLY_SELECTORS.forEach((selector) => {
      card.querySelectorAll(selector).forEach((node) => {
        setAllowed(node, canModerate);
      });
    });

    card.querySelectorAll(".community-comment[data-reply-id]").forEach((comment) => {
      const ownsReply = replyBelongsToCurrentUser(comment);
      const canManageReply = canModerate || ownsReply;

      REPLY_OWNER_OR_MOD_SELECTORS.forEach((selector) => {
        comment.querySelectorAll(selector).forEach((node) => {
          setAllowed(node, canManageReply);
        });
      });

      comment.querySelectorAll("[data-community-reply-moderation], .community-reply-mod-menu")
        .forEach((node) => setAllowed(node, canModerate));
    });
  }

  function enforceAll() {
    if (!root.document) return;

    root.document.querySelectorAll(".community-post-card[data-post-id]")
      .forEach(enforceCard);
  }

  function statusPresentation(status) {
    const clean = String(status || "abierto").trim().toLowerCase();

    if (clean === "resuelto") {
      return {
        label: "Resuelto",
        icon: "fa-circle-check",
        action: "Reabrir",
      };
    }

    if (clean === "cerrado") {
      return {
        label: "Cerrado",
        icon: "fa-lock",
        action: "Reabrir",
      };
    }

    if (clean === "oculto") {
      return {
        label: "Oculto",
        icon: "fa-eye-slash",
        action: "Reabrir",
      };
    }

    return {
      label: "Abierto",
      icon: "fa-circle-question",
      action: "Marcar resuelto",
    };
  }

  function applyStatusVisual(threadId, status) {
    if (!root.document || !threadId) return;

    const escapedId = root.CSS?.escape
      ? root.CSS.escape(String(threadId))
      : String(threadId).replace(/["\\]/g, "\\$&");

    const card = root.document.querySelector(
      `[data-post-id="${escapedId}"]`
    );

    if (!card) return;

    const cleanStatus = String(status || "abierto").trim().toLowerCase();
    const presentation = statusPresentation(cleanStatus);
    const badge = card.querySelector(".community-badge[class*='status-']");
    const button = card.querySelector("[data-community-resolve]");

    card.dataset.communityStatus = cleanStatus;

    if (badge) {
      Array.from(badge.classList)
        .filter((name) => name.startsWith("status-"))
        .forEach((name) => badge.classList.remove(name));

      badge.classList.add(`status-${cleanStatus}`);
      badge.innerHTML = `<i class="fa-solid ${presentation.icon}"></i> ${presentation.label}`;
    }

    if (button) {
      button.innerHTML = `<i class="fa-solid fa-check"></i> ${presentation.action}`;
    }

    enforceCard(card);
  }

  function tokenFromSession(session) {
    return (
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      session?.access_token ||
      session?.accessToken ||
      session?.token ||
      session?.classroomToken ||
      ""
    );
  }

  async function refreshThreadStatus(threadId) {
    if (!threadId || !root.fetch) return;

    const session = readSession();
    const token = tokenFromSession(session);
    const apiBase = session?.exampro?.apiBase
      ? `${String(session.exampro.apiBase).replace(/\/$/, "")}/api/classroom`
      : API_BASE;

    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const response = await root.fetch(
        `${apiBase}/community/threads/${encodeURIComponent(threadId)}?fresh=${Date.now()}`,
        {
          method: "GET",
          headers,
          credentials: "include",
          cache: "no-store",
        }
      );

      if (!response.ok) return;

      const data = await response.json();
      const item = data?.item || data?.thread || data;
      if (!item?.status) return;

      applyStatusVisual(threadId, item.status);
    } catch (_) {
      // Existing Community error handling remains authoritative.
    }
  }

  function installStyleGuard() {
    if (!root.document || root.document.getElementById("community-permissions-v2-style")) {
      return;
    }

    const style = root.document.createElement("style");
    style.id = "community-permissions-v2-style";
    style.textContent = `
      .community-permissions-v2 [data-community-delete]:not([data-community-permission-allowed="1"]),
      .community-permissions-v2 [data-community-resolve]:not([data-community-permission-allowed="1"]),
      .community-permissions-v2 [data-community-edit-thread]:not([data-community-permission-allowed="1"]),
      .community-permissions-v2 [data-community-thread-moderation]:not([data-community-permission-allowed="1"]),
      .community-permissions-v2 [data-community-reply-moderation]:not([data-community-permission-allowed="1"]),
      .community-permissions-v2 .community-mod-toolbar:not([data-community-permission-allowed="1"]),
      .community-permissions-v2 .community-reply-mod-menu:not([data-community-permission-allowed="1"]),
      .community-permissions-v2 .community-reply-delete-btn:not([data-community-permission-allowed="1"]),
      .community-permissions-v2 .community-reply-edit-btn:not([data-community-permission-allowed="1"]) {
        display: none !important;
      }
    `;

    root.document.head.appendChild(style);
    root.document.documentElement.classList.add("community-permissions-v2");
  }

  function bindStatusRefresh() {
    if (!root.document || root.__communityPermissionsV2StatusBound) return;
    root.__communityPermissionsV2StatusBound = true;

    root.document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-community-resolve]");
      if (!button) return;

      const card = button.closest("[data-post-id]");
      const threadId = card?.dataset?.postId;
      if (!threadId) return;

      root.setTimeout?.(() => refreshThreadStatus(threadId), 250);
      root.setTimeout?.(() => refreshThreadStatus(threadId), 900);
    });
  }

  function hookPermissionRefresh() {
    const roles = root.ClassroomRoles;
    if (!roles?.refreshPermissionsFromBackend || roles.__communityPermissionsV2Hooked) {
      return;
    }

    const original = roles.refreshPermissionsFromBackend.bind(roles);
    roles.refreshPermissionsFromBackend = async (...args) => {
      const result = await original(...args);
      enforceAll();
      return result;
    };
    roles.__communityPermissionsV2Hooked = true;
  }

  function boot() {
    if (!root.document) return;

    installStyleGuard();
    hookPermissionRefresh();
    bindStatusRefresh();
    enforceAll();

    const list = root.document.getElementById("communityList") || root.document.body;
    if (list && root.MutationObserver) {
      const observer = new root.MutationObserver(() => enforceAll());
      observer.observe(list, { childList: true, subtree: true });
    }

    root.setTimeout?.(enforceAll, 250);
    root.setTimeout?.(enforceAll, 1200);
  }

  if (root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }

  return {
    sessionCanModerate,
    statusPresentation,
    enforceAll,
    refreshThreadStatus,
  };
});
