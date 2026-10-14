(function () {
  "use strict";

  if (
    typeof ClassroomStudents === "undefined" ||
    typeof ClassroomWithdrawalStatus === "undefined"
  ) {
    return;
  }

  const courseLabels = {
    "ayrpc-2025": "AyRPC 2025",
    "ayrpc-2026": "AyRPC 2026",
  };

  const originalNormalize = ClassroomStudents.normalizeExamProStudent;

  ClassroomStudents.normalizeExamProStudent = function (student) {
    const normalized = originalNormalize.call(this, student);
    const enrollments = Array.isArray(student?.enrollments)
      ? student.enrollments
      : [];

    const rawCourses = Array.isArray(student?.cursos)
      ? student.cursos.filter(Boolean)
      : [];

    if (!rawCourses.length) {
      return {
        ...normalized,
        enrollments,
      };
    }

    const decoratedCourses = rawCourses.map((course) => {
      const slug = String(course).trim().toLowerCase();
      const label = courseLabels[slug] || String(course);
      const status = ClassroomWithdrawalStatus.getStatusForCourse(
        enrollments,
        slug
      );

      return ClassroomWithdrawalStatus.decorateCourseLabel(
        label,
        status
      );
    });

    return {
      ...normalized,
      enrollments,
      cursos: decoratedCourses,
      cursada: decoratedCourses.join(" · "),
    };
  };

  ClassroomStudents.fetchWithdrawalRequests = async function (status = "all") {
    if (!this.canViewWithdrawalRequests()) {
      throw new Error("No tenés permiso para ver solicitudes de baja.");
    }

    const params = new URLSearchParams({
      status,
      limit: "100",
    });

    const response = await fetch(
      `${this.getApiBase()}/api/classroom/admin/withdrawal-requests?${params.toString()}`,
      {
        cache: "no-store",
        headers: this.getAuthHeaders(),
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.ok === false) {
      throw new Error(
        data?.detail ||
        data?.error ||
        "No se pudieron cargar las solicitudes de baja."
      );
    }

    return Array.isArray(data?.items) ? data.items : [];
  };

  const originalWithdrawStudentByIndex = ClassroomStudents.withdrawStudentByIndex;

  ClassroomStudents.withdrawStudentByIndex = async function (index) {
    await originalWithdrawStudentByIndex.call(this, index);

    // La API es la fuente de verdad. Tras cualquier intento de baja,
    // refrescamos para que la columna Cursada refleje el estado por curso.
    await this.loadStudents(true);
  };
})();
