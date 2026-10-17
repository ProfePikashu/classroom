(() => {
  "use strict";

  function setCollapsed(panel, button, collapsed) {
    panel.classList.toggle("is-collapsed", collapsed);
    button.setAttribute("aria-expanded", String(!collapsed));
    button.innerHTML = `
      <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
      <span>${collapsed ? "Mostrar" : "Ocultar"}</span>
    `;
  }

  function enhanceWithdrawalPanel() {
    const panel = document.getElementById("solicitudes-baja-curso");

    if (!panel || panel.dataset.compactPanelReady === "1") {
      return;
    }

    const page = panel.closest(".students-page-panel");
    const actions = panel.querySelector(".admin-data-change-actions");
    const list = panel.querySelector("#adminWithdrawalList");

    if (!actions || !list) {
      return;
    }

    page?.classList.add("has-withdrawal-summary");

    const button = document.createElement("button");
    button.type = "button";
    button.id = "adminWithdrawalToggle";
    button.className = "admin-withdrawal-toggle";
    button.setAttribute("aria-controls", "adminWithdrawalList");

    actions.appendChild(button);
    setCollapsed(panel, button, true);

    button.addEventListener("click", () => {
      const collapsed = !panel.classList.contains("is-collapsed");
      setCollapsed(panel, button, collapsed);
    });

    panel.dataset.compactPanelReady = "1";
  }

  function init() {
    enhanceWithdrawalPanel();

    const root = document.querySelector(".students-page-panel") || document.body;
    const observer = new MutationObserver(() => {
      enhanceWithdrawalPanel();
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
