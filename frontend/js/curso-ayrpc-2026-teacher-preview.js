const CursoAyRPC2026TeacherPreview = {
  async init() {
    if (
      typeof CursoAyRPC2026Panel === "undefined" ||
      typeof ClassroomAuth === "undefined"
    ) {
      return;
    }

    const panel = CursoAyRPC2026Panel;
    const session = panel.getSession();

    if (!session || !panel.isTeacherSession(session)) return;

    const courseStatusData = await panel.refreshFromCourseStatus(session);

    if (!courseStatusData) {
      panel.paintUnavailable();

      const pendingState = Object.fromEntries(
        panel.classes.map(item => [item.statusKey, "PENDIENTE"])
      );
      pendingState.__courseStatus = { attendance: [], teacher_preview: true };

      panel.paintCourseRoadmap(pendingState);
      panel.paintAttendance(pendingState);
      return;
    }

    const apiData = courseStatusData.__courseStatus || {};
    const teacherPreview = Boolean(apiData.teacher_preview);

    if (teacherPreview) {
      const originalStatusClass = panel.statusClass.bind(panel);
      panel.statusClass = status => (
        panel.normalizeStatus(status) === "REGISTRADO"
          ? "ok"
          : originalStatusClass(status)
      );
    }

    panel.paintCourseState(courseStatusData);
    panel.paintCourseRoadmap(courseStatusData);
    panel.paintAttendance(courseStatusData);

    if (!teacherPreview) return;

    const attendance = Array.isArray(apiData.attendance)
      ? apiData.attendance
      : [];
    const registeredClasses = attendance.filter(row => (
      Number(row?.live_presence_seconds || 0) > 0
    )).length;
    const totalClasses = panel.classes.length;
    const registeredPercent = totalClasses
      ? Math.round((registeredClasses / totalClasses) * 100)
      : 0;

    const state = document.getElementById("ayrpcCourseState");
    const detail = document.getElementById("ayrpcCourseStateDetail");
    const source = document.getElementById("ayrpcDataSource");
    const totalBox = document.getElementById("ayrpcAttendanceTotal");
    const progress = document.getElementById("ayrpcAttendanceProgress");

    if (state) state.textContent = "Vista docente";
    if (detail) {
      detail.textContent =
        "Tu conexión de Twitch/MKC se muestra con los tiempos reales registrados durante cada clase.";
    }
    if (source) {
      source.textContent = "Datos sincronizados";
      source.className = "status-badge active";
    }
    if (totalBox) totalBox.textContent = `${registeredClasses}/${totalClasses}`;
    if (progress) progress.style.width = `${registeredPercent}%`;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  CursoAyRPC2026TeacherPreview.init();
});
