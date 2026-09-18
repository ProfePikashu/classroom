"use strict";

const ClassroomAdmin = {
  roles: [],

  permissionCatalog: [
    {
      group: "Alumnos",
      items: [
        ["students.view", "Ver alumnos", "Puede consultar el listado y las fichas."],
        ["students.edit", "Editar fichas", "Puede modificar nombre, identificación, Twitch, email y teléfono."],
        ["students.withdraw", "Dar de baja alumnos", "Reservado para la gestión de bajas."],
      ],
    },
    {
      group: "Asistencias",
      items: [
        ["attendance.view", "Ver asistencias", "Puede consultar asistencias y resúmenes."],
        ["attendance.token.create", "Crear token de asistencia", "Podrá abrir tokens temporales para tomar presente."],
        ["attendance.validate", "Validar asistencia", "Podrá validar registros y clases."],
        ["attendance.edit", "Corregir asistencias", "Podrá modificar asistencias ya registradas."],
      ],
    },
    {
      group: "Administración",
      items: [
        ["withdrawals.view", "Ver solicitudes de baja", "Puede consultar solicitudes de baja."],
        ["notifications.manage", "Gestionar notificaciones", "Puede administrar avisos del Classroom."],
        ["community.moderate", "Moderar comunidad", "Puede usar herramientas de moderación."],
        ["roles.manage", "Administrar roles", "Por seguridad permanece reservado al docente."],
      ],
    },
  ],

  init() {
    if (!this.checkAccess()) return;

    this.bindForm();
    this.loadRoles();
  },

  checkAccess() {
    const isTeacher =
      typeof ClassroomRoles !== "undefined" &&
      ClassroomRoles.isCurrentTeacher();

    const denied = document.getElementById("adminDenied");
    const app = document.getElementById("adminApp");

    if (denied) denied.style.display = isTeacher ? "none" : "block";
    if (app) app.style.display = isTeacher ? "grid" : "none";

    return isTeacher;
  },

  apiBase() {
    if (typeof EXAMPRO_API_BASE !== "undefined") {
      return EXAMPRO_API_BASE;
    }

    const local =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "file:";

    return local
      ? "http://127.0.0.1:8000"
      : "https://api.andyazhtec.com";
  },

  getSession() {
    if (
      typeof ClassroomAuth !== "undefined" &&
      typeof ClassroomAuth.getSession === "function"
    ) {
      return ClassroomAuth.getSession();
    }

    try {
      return JSON.parse(
        localStorage.getItem("andyazh-classroom-session") || "null"
      );
    } catch {
      return null;
    }
  },

  getToken() {
    const session = this.getSession();

    return (
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      ""
    );
  },

  async api(path, options = {}) {
    const token = this.getToken();

    if (!token) {
      throw new Error("La sesión no tiene un token válido de Classroom.");
    }

    const response = await fetch(
      `${this.apiBase()}${path}`,
      {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.detail ||
        data?.message ||
        `Error HTTP ${response.status}`
      );
    }

    return data;
  },

  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  bindForm() {
    const form = document.getElementById("moderatorForm");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const displayName =
        document.getElementById("moderatorName")?.value || "";

      const twitch =
        document.getElementById("moderatorTwitch")?.value || "";

      const dni =
        document.getElementById("moderatorDni")?.value || "";

      await this.createModerator({
        display_name: displayName.trim() || null,
        twitch,
        dni,
      });
    });
  },

  setLoading(message = "Cargando roles y permisos...") {
    const container = document.getElementById("moderatorsList");

    if (!container) return;

    container.innerHTML = `
      <div class="empty-admin-state">
        <i class="fa-solid fa-spinner fa-spin"></i>
        ${this.escapeHtml(message)}
      </div>
    `;
  },

  async loadRoles() {
    this.setLoading();

    try {
      const data = await this.api(
        "/api/classroom/admin/roles"
      );

      this.roles = Array.isArray(data.items)
        ? data.items
        : [];

      this.renderModerators();
    } catch (error) {
      const container =
        document.getElementById("moderatorsList");

      if (container) {
        container.innerHTML = `
          <div class="empty-admin-state role-error-state">
            <strong>No se pudieron cargar los roles.</strong>
            <span>${this.escapeHtml(error.message)}</span>
          </div>
        `;
      }
    }
  },

  async createModerator(payload) {
    try {
      await this.api(
        "/api/classroom/admin/roles",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      const form =
        document.getElementById("moderatorForm");

      if (form) form.reset();

      await this.loadRoles();
    } catch (error) {
      alert(`No se pudo crear el moderador.\n\n${error.message}`);
    }
  },

  renderPermission(permission, label, description, item) {
    const checked =
      Boolean(item.permissions?.[permission]);

    const locked =
      permission === "roles.manage";

    return `
      <label class="role-permission-row ${locked ? "is-locked" : ""}">
        <span class="role-permission-copy">
          <strong>${this.escapeHtml(label)}</strong>
          <small>${this.escapeHtml(description)}</small>
        </span>

        <span class="role-switch">
          <input
            type="checkbox"
            data-role-permission="${this.escapeHtml(permission)}"
            ${checked ? "checked" : ""}
            ${locked ? "disabled" : ""}
          />
          <span class="role-switch-ui"></span>
        </span>
      </label>
    `;
  },

  renderModerators() {
    const container =
      document.getElementById("moderatorsList");

    if (!container) return;

    if (!this.roles.length) {
      container.innerHTML = `
        <div class="empty-admin-state">
          No hay moderadores configurados.
        </div>
      `;
      return;
    }

    container.innerHTML = this.roles.map((item) => {
      const permissionGroups = this.permissionCatalog
        .map((group) => `
          <section class="role-permission-group">
            <h4>${this.escapeHtml(group.group)}</h4>

            <div class="role-permission-grid">
              ${group.items.map(([permission, label, description]) =>
                this.renderPermission(
                  permission,
                  label,
                  description,
                  item
                )
              ).join("")}
            </div>
          </section>
        `)
        .join("");

      return `
        <article
          class="moderator-card role-manager-card ${item.is_active ? "" : "is-inactive"}"
          data-role-card="${Number(item.id)}"
        >
          <div class="role-card-header">
            <div class="role-identity">
              <div class="role-status-dot ${item.is_active ? "active" : "inactive"}"></div>

              <div>
                <strong>
                  ${this.escapeHtml(item.display_name || item.twitch)}
                </strong>

                <span>@${this.escapeHtml(item.twitch)}</span>
                <small>DNI ${this.escapeHtml(item.dni)}</small>
              </div>
            </div>

            <label class="role-active-control">
              <span>Rol activo</span>

              <span class="role-switch">
                <input
                  type="checkbox"
                  data-role-active
                  ${item.is_active ? "checked" : ""}
                />
                <span class="role-switch-ui"></span>
              </span>
            </label>
          </div>

          <label class="role-display-name-field">
            <span>Nombre visible</span>

            <input
              type="text"
              data-role-display-name
              value="${this.escapeHtml(item.display_name || "")}"
              placeholder="Nombre del moderador"
              maxlength="120"
            />
          </label>

          <div class="role-permissions">
            ${permissionGroups}
          </div>

          <div class="role-card-footer">
            <small>
              Los cambios quedan registrados en auditoría.
            </small>

            <button
              class="btn btn-primary"
              type="button"
              data-save-role="${Number(item.id)}"
            >
              <i class="fa-solid fa-floppy-disk"></i>
              Guardar permisos
            </button>
          </div>
        </article>
      `;
    }).join("");

    container
      .querySelectorAll("[data-save-role]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => this.saveRole(Number(button.dataset.saveRole))
        );
      });
  },

  collectPermissions(card) {
    const permissions = {};

    this.permissionCatalog.forEach((group) => {
      group.items.forEach(([permission]) => {
        if (permission === "roles.manage") {
          permissions[permission] = false;
          return;
        }

        const input = card.querySelector(
          `[data-role-permission="${permission}"]`
        );

        permissions[permission] =
          Boolean(input?.checked);
      });
    });

    return permissions;
  },

  async saveRole(roleId) {
    const card = document.querySelector(
      `[data-role-card="${roleId}"]`
    );

    if (!card) return;

    const current = this.roles.find(
      (item) => Number(item.id) === Number(roleId)
    );

    if (!current) return;

    const displayName =
      card.querySelector("[data-role-display-name]")
        ?.value
        ?.trim() || null;

    const isActive =
      Boolean(
        card.querySelector("[data-role-active]")
          ?.checked
      );

    const permissions =
      this.collectPermissions(card);

    if (current.is_active && !isActive) {
      const ok = confirm(
        `Vas a desactivar a ${current.display_name || "este moderador"}.\n\n` +
        "Perderá acceso como moderador, pero su configuración quedará guardada y podrá reactivarse más adelante.\n\n" +
        "¿Continuar?"
      );

      if (!ok) {
        const activeInput =
          card.querySelector("[data-role-active]");

        if (activeInput) activeInput.checked = true;

        return;
      }
    }

    const ok = confirm(
      "¿Guardar estos permisos?\n\n" +
      "Los cambios se aplicarán en el backend y quedarán registrados en auditoría."
    );

    if (!ok) return;

    const button =
      card.querySelector("[data-save-role]");

    if (button) {
      button.disabled = true;
      button.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    }

    try {
      await this.api(
        `/api/classroom/admin/roles/${roleId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            display_name: displayName,
            is_active: isActive,
            permissions,
          }),
        }
      );

      await this.loadRoles();
    } catch (error) {
      alert(
        `No se pudieron guardar los permisos.\n\n${error.message}`
      );

      if (button) {
        button.disabled = false;
        button.innerHTML =
          '<i class="fa-solid fa-floppy-disk"></i> Guardar permisos';
      }
    }
  },
};

document.addEventListener(
  "DOMContentLoaded",
  () => ClassroomAdmin.init()
);