(() => {
  "use strict";

  if (typeof ClassroomStudents === "undefined") return;

  const courseLabels = {
    "ayrpc-2025": "AyRPC 2025",
    "ayrpc-2026": "AyRPC 2026",
  };

  function formatDate(value) {
    if (!value) return "";

    try {
      return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function courseLabel(value) {
    const slug = String(value || "").trim().toLowerCase();
    return courseLabels[slug] || value || "Cursada";
  }

  function statusMeta(value) {
    const status = String(value || "pending").trim().toLowerCase();

    if (status === "approved") {
      return {
        label: "Aprobada",
        icon: "fa-user-slash",
        className: "is-resolved",
      };
    }

    if (status === "rejected") {
      return {
        label: "Rechazada",
        icon: "fa-ban",
        className: "is-resolved",
      };
    }

    return {
      label: "Pendiente",
      icon: "fa-triangle-exclamation",
      className: "is-pending",
    };
  }

  function approvalMessage(data, item) {
    const mail = data?.mail;
    const email = item?.email || data?.item?.email || "el correo registrado";

    if (!mail) {
      return "Baja aplicada correctamente.";
    }

    if (mail.ok && !mail.skipped) {
      return `Baja aplicada correctamente. El correo de confirmación fue enviado a ${email}.`;
    }

    if (mail.skipped) {
      return `Baja aplicada correctamente, pero el correo no se envió (${mail.error || mail.status || "envío omitido"}).`;
    }

    return `Baja aplicada correctamente, pero falló el correo de confirmación: ${mail.error || mail.status || "error desconocido"}.`;
  }

  ClassroomStudents.rejectWithdrawalRequest = async function (requestId, notes = "") {
    if (!this.canWithdrawStudents()) {
      throw new Error("No tenés permiso para rechazar bajas.");
    }

    const response = await fetch(
      `${this.getApiBase()}/api/classroom/admin/withdrawal-requests/${encodeURIComponent(requestId)}/reject`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({ notes }),
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.detail ||
        data?.error ||
        "No se pudo rechazar la solicitud de baja."
      );
    }

    return data;
  };

  ClassroomStudents.bindWithdrawalRequestsPanel = function () {
    if (this.withdrawalReviewPanelBound) return;

    this.withdrawalReviewPanelBound = true;
    this.withdrawalRequestsPanelBound = true;

    document.addEventListener("click", async (event) => {
      const refreshButton = event.target.closest("#adminWithdrawalRefresh");
      if (refreshButton) {
        this.renderWithdrawalRequestsPanel();
        return;
      }

      const approveButton = event.target.closest("[data-withdrawal-review-approve]");
      const rejectButton = event.target.closest("[data-withdrawal-review-reject]");

      if (!approveButton && !rejectButton) return;

      if (!this.canWithdrawStudents()) {
        alert("No tenés permiso para resolver solicitudes de baja.");
        return;
      }

      const button = approveButton || rejectButton;
      const requestId =
        approveButton?.dataset.withdrawalReviewApprove ||
        rejectButton?.dataset.withdrawalReviewReject ||
        "";

      if (!requestId) return;

      const card = button.closest("[data-withdrawal-id]");
      const item = this.withdrawalReviewItems?.find(
        (candidate) => String(candidate.id) === String(requestId)
      );

      if (approveButton) {
        const ok = window.confirm(
          "¿Confirmás aprobar la baja? El alumno dejará de figurar activo en esta cursada y recibirá un correo de confirmación."
        );

        if (!ok) return;

        const notes = window.prompt(
          "Opcional: nota interna de resolución.",
          "Baja aprobada por el equipo docente."
        );

        if (notes === null) return;

        approveButton.disabled = true;
        approveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aplicando...';

        try {
          const data = await this.approveWithdrawalRequest(
            requestId,
            String(notes || "").trim()
          );

          alert(approvalMessage(data, item));
          await this.renderWithdrawalRequestsPanel();
          await this.loadStudents(true);
        } catch (error) {
          alert("Error: " + (error?.message || "No se pudo aprobar la baja."));
          await this.renderWithdrawalRequestsPanel();
        }

        return;
      }

      const ok = window.confirm(
        "¿Confirmás rechazar esta solicitud? No se modificará la cursada del alumno y no se enviará correo de baja."
      );

      if (!ok) return;

      const notes = window.prompt(
        "Motivo o nota interna del rechazo:",
        "La solicitud no corresponde a una baja de cursada."
      );

      if (notes === null) return;

      rejectButton.disabled = true;
      rejectButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rechazando...';

      try {
        await this.rejectWithdrawalRequest(
          requestId,
          String(notes || "").trim()
        );

        alert("Solicitud rechazada. No se aplicó ninguna baja al alumno.");
        await this.renderWithdrawalRequestsPanel();
      } catch (error) {
        alert("Error: " + (error?.message || "No se pudo rechazar la solicitud."));
        await this.renderWithdrawalRequestsPanel();
      }

      card?.scrollIntoView?.({ block: "nearest" });
    });
  };

  ClassroomStudents.renderWithdrawalRequestsPanel = async function () {
    if (!this.canViewWithdrawalRequests()) return;

    const panel = this.ensureWithdrawalRequestsPanel();
    const list = panel.querySelector("#adminWithdrawalList");
    const counter = panel.querySelector("#adminWithdrawalCounter");
    const headParagraphs = panel.querySelectorAll(".admin-data-change-head p");

    if (headParagraphs.length > 1) {
      headParagraphs[1].textContent =
        "Revisá cada pedido antes de modificar la cursada. Podés aprobar la baja o rechazar solicitudes incorrectas.";
    }

    if (!list || !counter) return;

    const canWithdraw = this.canWithdrawStudents();

    try {
      const items = await this.fetchWithdrawalRequests("all");
      this.withdrawalReviewItems = items;

      const pending = items.filter(
        (item) => String(item.status || "").toLowerCase() === "pending"
      );

      counter.textContent = `${pending.length} pendiente${pending.length === 1 ? "" : "s"}`;

      if (!items.length) {
        list.innerHTML = `
          <div class="admin-data-change-empty">
            <i class="fa-solid fa-circle-check"></i>
            <span>No hay solicitudes de baja por ahora.</span>
          </div>
        `;
        return;
      }

      list.innerHTML = items.map((item) => {
        const status = String(item.status || "pending").toLowerCase();
        const meta = statusMeta(status);
        const isPending = status === "pending";
        const resolvedAt = formatDate(item.resolved_at);
        const createdAt = formatDate(item.created_at);
        const resolvedBy = item.resolved_by || "";
        const resolutionNotes = item.resolution_notes || "";

        return `
          <article class="admin-data-change-item ${meta.className}" data-withdrawal-id="${this.escapeHtml(item.id)}">
            <div class="admin-data-change-alert">
              <i class="fa-solid ${meta.icon}"></i>
            </div>

            <div class="admin-data-change-body">
              <div class="admin-data-change-titleline">
                <strong>${this.escapeHtml(item.student_name || "Alumno")}</strong>
                <span>${this.escapeHtml(meta.label)}</span>
              </div>

              <p>${this.escapeHtml(item.reason || "Sin motivo detallado.")}</p>

              <div class="admin-data-change-meta">
                <span>Curso: ${this.escapeHtml(courseLabel(item.course_slug))}</span>
                ${item.dni ? `<span>DNI: ${this.escapeHtml(item.dni)}</span>` : ""}
                ${item.twitch ? `<span>Twitch: ${this.escapeHtml(item.twitch)}</span>` : ""}
                ${item.email ? `<span>Email: ${this.escapeHtml(item.email)}</span>` : ""}
                ${createdAt ? `<span>Solicitada: ${this.escapeHtml(createdAt)}</span>` : ""}
              </div>

              ${!isPending ? `
                <div class="admin-data-change-resolution">
                  <strong>${status === "approved" ? "Baja aprobada" : "Solicitud rechazada"}</strong>
                  ${resolutionNotes ? `<p>${this.escapeHtml(resolutionNotes)}</p>` : ""}
                  <div class="admin-data-change-meta">
                    ${resolvedBy ? `<span>Resuelta por: ${this.escapeHtml(resolvedBy)}</span>` : ""}
                    ${resolvedAt ? `<span>${this.escapeHtml(resolvedAt)}</span>` : ""}
                  </div>
                </div>
              ` : ""}

              <div class="admin-data-change-actions">
                ${isPending && canWithdraw ? `
                  <button type="button" class="danger" data-withdrawal-review-approve="${this.escapeHtml(item.id)}">
                    <i class="fa-solid fa-user-slash"></i>
                    Aprobar baja
                  </button>

                  <button type="button" data-withdrawal-review-reject="${this.escapeHtml(item.id)}">
                    <i class="fa-solid fa-ban"></i>
                    Rechazar
                  </button>
                ` : isPending ? `
                  <button type="button" disabled title="Requiere permiso students.withdraw">
                    <i class="fa-solid fa-eye"></i>
                    Solo lectura
                  </button>
                ` : `
                  <button type="button" disabled>
                    <i class="fa-solid ${status === "approved" ? "fa-check" : "fa-ban"}"></i>
                    ${status === "approved" ? "Baja aplicada" : "Solicitud rechazada"}
                  </button>
                `}
              </div>
            </div>
          </article>
        `;
      }).join("");
    } catch (error) {
      counter.textContent = "Error";
      list.innerHTML = `
        <div class="admin-data-change-empty">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>${this.escapeHtml(error?.message || "No se pudieron cargar las solicitudes de baja.")}</span>
        </div>
      `;
    }
  };
})();
