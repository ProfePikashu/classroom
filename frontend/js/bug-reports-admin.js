
(() => {
  "use strict";

  let reports = [];

  function apiBase() {
    if (typeof EXAMPRO_API_BASE !== "undefined") {
      return EXAMPRO_API_BASE;
    }

    const local =
      location.hostname === "127.0.0.1" ||
      location.hostname === "localhost";

    return local
      ? "http://127.0.0.1:8000"
      : "https://api.andyazhtec.com";
  }

  function getSession() {
    if (
      typeof ClassroomAuth !== "undefined" &&
      typeof ClassroomAuth.getSession === "function"
    ) {
      return ClassroomAuth.getSession();
    }

    try {
      return JSON.parse(
        localStorage.getItem(
          "andyazh-classroom-session"
        ) || "null"
      );
    } catch {
      return null;
    }
  }

  function getToken() {
    const session = getSession();

    return (
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      session?.access_token ||
      session?.accessToken ||
      session?.token ||
      ""
    );
  }

  function isTeacher() {
    return (
      typeof ClassroomRoles !== "undefined" &&
      typeof ClassroomRoles.isCurrentTeacher === "function" &&
      ClassroomRoles.isCurrentTeacher()
    );
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDate(value) {
    if (!value) return "";

    return new Intl.DateTimeFormat(
      "es-AR",
      {
        dateStyle: "short",
        timeStyle: "short",
      }
    ).format(new Date(value));
  }

  function statusLabel(value) {
    return {
      PENDIENTE: "Pendiente",
      EN_PROCESO: "En proceso",
      SOLUCIONADO: "Solucionado",
    }[value] || value;
  }

  function tagClass(report) {
    if (report.status === "SOLUCIONADO") return "green";
    if (report.priority === "ALTA") return "red";
    if (report.priority === "MEDIA") return "orange";
    return "purple";
  }

  function updateCounters() {
    document.getElementById("bugCountPending").textContent =
      reports.filter(r => r.status === "PENDIENTE").length;

    document.getElementById("bugCountProgress").textContent =
      reports.filter(r => r.status === "EN_PROCESO").length;

    document.getElementById("bugCountSolved").textContent =
      reports.filter(r => r.status === "SOLUCIONADO").length;

    document.getElementById("bugCountTotal").textContent =
      reports.length;
  }

  function render() {
    const status =
      document.getElementById("bugFilterStatus").value;

    const type =
      document.getElementById("bugFilterType").value;

    const priority =
      document.getElementById("bugFilterPriority").value;

    const filtered = reports.filter((report) => {
      if (status && report.status !== status) return false;
      if (type && report.report_type !== type) return false;
      if (
        priority &&
        report.priority !== priority
      ) return false;

      return true;
    });

    const list =
      document.getElementById("bugReportsList");

    if (!filtered.length) {
      list.innerHTML = `
        <div class="panel bug-empty">
          <i class="fa-solid fa-bug-slash"></i>
          No hay reportes con estos filtros.
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map((report) => `
      <article
        class="
          bug-report-card
          priority-${esc(report.priority || "")}
          type-${esc(report.report_type)}
        "
        data-report-id="${esc(report.id)}"
      >
        <div class="bug-report-head">
          <div class="bug-report-tags">
            <span class="bug-tag purple">
              <i class="fa-solid ${
                report.report_type === "FUNCIONAL"
                  ? "fa-gears"
                  : "fa-palette"
              }"></i>
              ${esc(report.report_type)}
            </span>

            ${
              report.priority
                ? `
                  <span class="bug-tag ${tagClass(report)}">
                    Prioridad ${esc(report.priority)}
                  </span>
                `
                : ""
            }

            <span class="bug-tag ${tagClass(report)}">
              ${esc(statusLabel(report.status))}
            </span>
          </div>

          <span class="bug-report-date">
            ${esc(fmtDate(report.created_at))}
          </span>
        </div>

        <div class="bug-report-user">
          <strong>
            <i class="fa-solid fa-user"></i>
            ${esc(
              report.reporter_name ||
              report.reporter_twitch ||
              "Usuario"
            )}
          </strong>

          <small>
            Twitch:
            ${esc(report.reporter_twitch || "-")}
            · DNI:
            ${esc(report.reporter_dni || "-")}
            · ID:
            ${esc(report.reporter_student_id || "-")}
          </small>
        </div>

        <div class="bug-report-section">
          <strong>¿Qué pasó?</strong>
          <p>${esc(report.description)}</p>
        </div>

        ${
          report.expected_behavior
            ? `
              <div class="bug-report-section">
                <strong>¿Qué esperaba?</strong>
                <p>${esc(report.expected_behavior)}</p>
              </div>
            `
            : ""
        }

        <div class="bug-report-tech">
          <div>
            <span>Página</span><br>
            ${esc(report.page_path || "-")}
          </div>

          <div>
            <span>Viewport</span><br>
            ${esc(report.viewport_width || "-")}
            ×
            ${esc(report.viewport_height || "-")}
          </div>

          <div>
            <span>URL</span><br>
            ${
              report.page_url
                ? `
                  <a
                    href="${esc(report.page_url)}"
                    target="_blank"
                    rel="noopener"
                  >
                    ${esc(report.page_url)}
                  </a>
                `
                : "-"
            }
          </div>

          <div>
            <span>Navegador</span><br>
            ${esc(report.user_agent || "-")}
          </div>
        </div>

        <div class="bug-report-controls">
          <label>
            <span>Estado</span>

            <select data-bug-status>
              <option
                value="PENDIENTE"
                ${
                  report.status === "PENDIENTE"
                    ? "selected"
                    : ""
                }
              >
                Pendiente
              </option>

              <option
                value="EN_PROCESO"
                ${
                  report.status === "EN_PROCESO"
                    ? "selected"
                    : ""
                }
              >
                En proceso
              </option>

              <option
                value="SOLUCIONADO"
                ${
                  report.status === "SOLUCIONADO"
                    ? "selected"
                    : ""
                }
              >
                Solucionado
              </option>
            </select>
          </label>

          <label>
            <span>Notas internas</span>

            <textarea
              data-bug-notes
              maxlength="8000"
              placeholder="Ej: corregido en comunidad.js..."
            >${esc(report.admin_notes || "")}</textarea>
          </label>

          <button
            class="btn btn-primary"
            type="button"
            data-bug-save
          >
            <i class="fa-solid fa-floppy-disk"></i>
            Guardar
          </button>
        </div>
      </article>
    `).join("");
  }

  async function loadReports() {
    const token = getToken();

    if (!token) {
      throw new Error("No hay token de sesión.");
    }

    const response = await fetch(
      `${apiBase()}/api/classroom/admin/bug-reports?limit=300`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.detail ||
        `Error HTTP ${response.status}`
      );
    }

    reports = Array.isArray(data)
      ? data
      : (data?.reports || data?.items || []);

    updateCounters();
    render();
  }

  async function saveReport(card) {
    const id = card.dataset.reportId;
    const token = getToken();

    const status =
      card.querySelector("[data-bug-status]").value;

    const adminNotes =
      card.querySelector("[data-bug-notes]").value.trim();

    const button =
      card.querySelector("[data-bug-save]");

    button.disabled = true;
    button.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      Guardando...
    `;

    try {
      const response = await fetch(
        `${apiBase()}/api/classroom/admin/bug-reports/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            admin_notes: adminNotes || null,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail ||
          `Error HTTP ${response.status}`
        );
      }

      await loadReports();
    } catch (error) {
      alert(
        error?.message ||
        "No se pudo actualizar el reporte."
      );
    } finally {
      button.disabled = false;
      button.innerHTML = `
        <i class="fa-solid fa-floppy-disk"></i>
        Guardar
      `;
    }
  }

  async function init() {
    const denied =
      document.getElementById("bugReportsDenied");

    const app =
      document.getElementById("bugReportsApp");

    setTimeout(async () => {
      if (!isTeacher()) {
        denied.style.display = "";
        return;
      }

      app.style.display = "";

      try {
        await loadReports();
      } catch (error) {
        document.getElementById(
          "bugReportsError"
        ).innerHTML = `
          <div class="bug-admin-error">
            ${esc(error?.message || "No se pudieron cargar los reportes.")}
          </div>
        `;
      }
    }, 250);

    document
      .getElementById("bugFilterStatus")
      ?.addEventListener("change", render);

    document
      .getElementById("bugFilterType")
      ?.addEventListener("change", render);

    document
      .getElementById("bugFilterPriority")
      ?.addEventListener("change", render);

    document
      .getElementById("bugRefresh")
      ?.addEventListener("click", async () => {
        try {
          await loadReports();
        } catch (error) {
          alert(error?.message || "Error");
        }
      });

    document
      .getElementById("bugReportsList")
      ?.addEventListener("click", async (event) => {
        const button =
          event.target.closest("[data-bug-save]");

        if (!button) return;

        const card =
          button.closest("[data-report-id]");

        if (!card) return;

        await saveReport(card);
      });
  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );
})();
