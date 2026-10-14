(function () {
  "use strict";

  if (
    typeof ClassroomGestion === "undefined" ||
    typeof ClassroomWithdrawalStatus === "undefined"
  ) {
    return;
  }

  ClassroomGestion.getCurrentWithdrawalEnrollment = async function () {
    const response = await fetch(
      `${this.getApiBase()}/api/classroom/me/profile`,
      {
        cache: "no-store",
        headers: this.getAuthHeaders(),
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.detail ||
        data?.error ||
        "No se pudo identificar tu cursada activa."
      );
    }

    const enrollment = ClassroomWithdrawalStatus.selectCurrentEnrollment(
      data.enrollments
    );

    if (!enrollment?.course?.slug) {
      throw new Error("No tenés una cursada activa disponible para dar de baja.");
    }

    return enrollment;
  };

  ClassroomGestion.solicitarBaja = async function () {
    const session = this.getSession();

    if (!session?.dni) {
      alert("No se encontro una sesion valida.");
      return;
    }

    let enrollment;

    try {
      enrollment = await this.getCurrentWithdrawalEnrollment();
    } catch (error) {
      alert("Error: " + (error?.message || "No se pudo identificar la cursada."));
      return;
    }

    const courseSlug = String(enrollment.course.slug).trim().toLowerCase();
    const courseName =
      enrollment.course.name ||
      (courseSlug === "ayrpc-2026" ? "AyRPC 2026" :
        courseSlug === "ayrpc-2025" ? "AyRPC 2025" : courseSlug);

    const confirmed = confirm(
      `Confirmas que queres solicitar la baja de ${courseName}? ` +
      "El equipo docente revisara el pedido antes de aplicarlo."
    );

    if (!confirmed) return;

    const reason = prompt(
      "Opcional: indica brevemente el motivo de la baja.",
      ""
    ) || "";

    try {
      const params = new URLSearchParams({
        course: courseSlug,
      });

      const response = await fetch(
        `${this.getApiBase()}/api/classroom/me/withdrawal-request?${params.toString()}`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            ...this.getAuthHeaders(),
          },
          body: JSON.stringify({
            reason: reason.trim(),
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        const message =
          data?.detail ||
          data?.error ||
          "No se pudo enviar la solicitud de baja.";
        alert("Error: " + message);
        return;
      }

      if (data.already_pending) {
        alert(
          `Ya tenes una solicitud de baja pendiente para ${courseName}.`
        );
        return;
      }

      alert(
        `Solicitud de baja de ${courseName} enviada correctamente. ` +
        "El equipo docente la revisara antes de confirmar la baja."
      );
    } catch (error) {
      alert("No se pudo enviar la solicitud de baja.");
    }
  };
})();
