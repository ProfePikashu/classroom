(function (root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ClassroomWithdrawalStatus = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isWithdrawn(status) {
    return normalizeStatus(status) === "withdrawn";
  }

  function courseSlug(enrollment) {
    return String(
      enrollment?.course_slug ||
      enrollment?.course?.slug ||
      ""
    ).trim().toLowerCase();
  }

  function courseYear(enrollment) {
    return Number(
      enrollment?.course_year ||
      enrollment?.course?.year ||
      0
    ) || 0;
  }

  function selectCurrentEnrollment(enrollments) {
    const active = (Array.isArray(enrollments) ? enrollments : [])
      .filter((item) => item && !isWithdrawn(item.status || item.enrollment_status))
      .slice()
      .sort((a, b) => {
        const yearDiff = courseYear(b) - courseYear(a);
        if (yearDiff) return yearDiff;

        const dateA = Date.parse(a?.enrolled_at || "") || 0;
        const dateB = Date.parse(b?.enrolled_at || "") || 0;
        return dateB - dateA;
      });

    return active[0] || null;
  }

  function getStatusForCourse(enrollments, slug) {
    const cleanSlug = String(slug || "").trim().toLowerCase();
    if (!cleanSlug) return "";

    const row = (Array.isArray(enrollments) ? enrollments : [])
      .find((item) => courseSlug(item) === cleanSlug);

    return normalizeStatus(
      row?.status || row?.enrollment_status || ""
    );
  }

  function decorateCourseLabel(label, status) {
    const cleanLabel = String(label || "").trim();
    if (!cleanLabel) return "";

    return isWithdrawn(status)
      ? `${cleanLabel} — Dado de baja`
      : cleanLabel;
  }

  return {
    normalizeStatus,
    isWithdrawn,
    selectCurrentEnrollment,
    getStatusForCourse,
    decorateCourseLabel,
  };
});
