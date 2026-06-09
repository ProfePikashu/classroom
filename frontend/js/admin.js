"use strict";

const ClassroomAdmin = {
  init() {
    if (!this.checkAccess()) return;

    this.bindForm();
    this.renderModerators();
  },

  checkAccess() {
    const isTeacher = typeof ClassroomRoles !== "undefined" && ClassroomRoles.isCurrentTeacher();

    const denied = document.getElementById("adminDenied");
    const app = document.getElementById("adminApp");

    if (denied) denied.style.display = isTeacher ? "none" : "block";
    if (app) app.style.display = isTeacher ? "grid" : "none";

    return isTeacher;
  },

  bindForm() {
    const form = document.getElementById("moderatorForm");

    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const twitch = document.getElementById("moderatorTwitch").value;
      const dni = document.getElementById("moderatorDni").value;

      this.addModerator(twitch, dni);

      form.reset();
    });
  },

  normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  },

  normalizeDni(value) {
    return String(value || "").replace(/\D/g, "").trim();
  },

  getAssignments() {
    if (typeof ClassroomRoles === "undefined") return [];

    return ClassroomRoles.getAssignments();
  },

  saveAssignments(assignments) {
    if (typeof ClassroomRoles === "undefined") return;

    ClassroomRoles.saveAssignments(assignments);
    ClassroomRoles.paintRole();
  },

  addModerator(twitch, dni) {
    const normalizedTwitch = this.normalize(twitch);
    const normalizedDni = this.normalizeDni(dni);

    if (!normalizedTwitch || !normalizedDni) {
      alert("Completá usuario de Twitch y DNI.");
      return;
    }

    const assignments = this.getAssignments();

    const exists = assignments.some((item) => {
      return this.normalize(item.twitch) === normalizedTwitch && this.normalizeDni(item.dni) === normalizedDni;
    });

    if (exists) {
      alert("Ese usuario ya tiene rol asignado.");
      return;
    }

    assignments.push({
      twitch: normalizedTwitch,
      dni: normalizedDni,
      role: "moderator",
      roleLabel: "Moderador",
      createdAt: new Date().toISOString(),
    });

    this.saveAssignments(assignments);
    this.renderModerators();
  },

  removeModerator(index) {
    const assignments = this.getAssignments();

    assignments.splice(index, 1);

    this.saveAssignments(assignments);
    this.renderModerators();
  },

  renderModerators() {
    const container = document.getElementById("moderatorsList");

    if (!container) return;

    const assignments = this.getAssignments().filter((item) => item.role === "moderator");

    if (!assignments.length) {
      container.innerHTML = `
        <div class="empty-admin-state">
          No hay moderadores asignados.
        </div>
      `;
      return;
    }

    container.innerHTML = assignments.map((item, index) => `
      <article class="moderator-card">
        <div>
          <strong>@${item.twitch}</strong>
          <span>DNI ${item.dni}</span>
          <small>${item.roleLabel || "Moderador"}</small>
        </div>

        <button class="btn btn-outline danger-btn" type="button" data-remove-moderator="${index}">
          <i class="fa-solid fa-user-minus"></i>
          Quitar
        </button>
      </article>
    `).join("");

    container.querySelectorAll("[data-remove-moderator]").forEach((button) => {
      button.addEventListener("click", () => {
        const ok = confirm("¿Quitar rol de moderador?");
        if (!ok) return;

        this.removeModerator(Number(button.dataset.removeModerator));
      });
    });
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomAdmin.init();
});
