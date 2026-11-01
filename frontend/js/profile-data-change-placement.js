(() => {
  "use strict";

  function getText(node) {
    return (node?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function findInfoPanel() {
    const panels = Array.from(document.querySelectorAll(".panel, section, article"));

    return panels.find((panel) => {
      const text = getText(panel);
      return text.includes("información del alumno")
        || text.includes("informacion del alumno")
        || text.includes("información registrada")
        || text.includes("informacion registrada")
        || text.includes("datos registrados");
    });
  }

  function findHeader(panel) {
    return panel?.querySelector(".panel-header")
      || panel?.querySelector(".profile-card-header")
      || panel?.querySelector("header")
      || panel?.firstElementChild;
  }

  function getRequestPanel() {
    return document.getElementById("profileChangeRequestPanel");
  }

  function getRequestForm() {
    return document.getElementById("profileChangeRequestForm");
  }

  function getRequestTextarea() {
    return document.getElementById("profileChangeRequestText");
  }

  function syncPanelState() {
    const panel = getRequestPanel();
    const form = getRequestForm();
    if (!panel || !form) return;

    panel.classList.toggle("is-open", !form.hidden);
  }

  function openRequestCard() {
    const panel = getRequestPanel();
    const form = getRequestForm();
    const textarea = getRequestTextarea();
    if (!panel || !form) return;

    form.hidden = false;
    panel.classList.add("is-open");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => textarea?.focus(), 180);
  }

  function closeRequestCard() {
    const panel = getRequestPanel();
    const form = getRequestForm();
    if (!panel || !form) return;

    form.hidden = true;
    form.reset();
    panel.classList.remove("is-open");
  }

  function neutralizeRealNamePlaceholders() {
    const textarea = getRequestTextarea();
    if (!textarea) return;

    textarea.placeholder = [
      "Ejemplo: NOMBRE, cambiar a: [nuevo nombre correcto].",
      "Ejemplo: CORREO, cambiar a: [correo correcto].",
      "Ejemplo: TELÉFONO, cambiar a: [nuevo teléfono correcto].",
    ].join("\n");
  }

  function hideInlineButton() {
    const inlineButton = document.getElementById("profileChangeRequestToggle");
    if (!inlineButton) return;

    inlineButton.classList.add("profile-change-request-old-toggle-hidden");
    inlineButton.setAttribute("tabindex", "-1");
    inlineButton.setAttribute("aria-hidden", "true");
  }

  function injectTopButton() {
    const infoPanel = findInfoPanel();
    const requestPanel = getRequestPanel();
    if (!infoPanel || !requestPanel) return false;

    infoPanel.classList.add("profile-info-panel-with-change-action");

    const header = findHeader(infoPanel) || infoPanel;
    header.classList.add("profile-info-change-action-host");

    let button = document.getElementById("profileChangeRequestTopButton");

    if (!button) {
      button = document.createElement("button");
      button.id = "profileChangeRequestTopButton";
      button.className = "btn btn-outline profile-change-request-top-button";
      button.type = "button";
      button.innerHTML = `
        <i class="fa-solid fa-pen-to-square"></i>
        Solicitar cambios
      `;
      header.appendChild(button);
    }

    if (button.dataset.placementV3Bound !== "true") {
      button.dataset.placementV3Bound = "true";
      button.addEventListener("click", () => {
        const form = getRequestForm();
        if (!form) return;

        if (form.hidden) {
          openRequestCard();
        } else {
          closeRequestCard();
        }
      });
    }

    if (requestPanel.previousElementSibling !== infoPanel) {
      infoPanel.insertAdjacentElement("afterend", requestPanel);
    }

    syncPanelState();
    return true;
  }

  function bindCancelSync() {
    const cancel = document.getElementById("profileChangeRequestCancel");
    if (!cancel || cancel.dataset.placementV3Bound === "true") return;

    cancel.dataset.placementV3Bound = "true";
    cancel.addEventListener("click", () => {
      setTimeout(syncPanelState, 0);
    });
  }

  function bindSubmitSync() {
    const form = getRequestForm();
    if (!form || form.dataset.placementV3Bound === "true") return;

    form.dataset.placementV3Bound = "true";
    form.addEventListener("submit", () => {
      setTimeout(syncPanelState, 80);
    });
  }

  function refine() {
    const requestPanel = getRequestPanel();

    if (!requestPanel) {
      document.getElementById("profileChangeRequestTopButton")?.remove();
      return false;
    }

    neutralizeRealNamePlaceholders();
    hideInlineButton();
    const ok = injectTopButton();
    bindCancelSync();
    bindSubmitSync();
    syncPanelState();
    return ok;
  }

  function init() {
    refine();
    setTimeout(refine, 120);
    setTimeout(refine, 350);
    setTimeout(refine, 800);

    const root = document.querySelector("main") || document.body;
    const observer = new MutationObserver(refine);
    observer.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
