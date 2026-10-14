"use strict";

const assert = require("node:assert/strict");
const status = require("../frontend/js/withdrawal-status.js");

const enrollments = [
  {
    course_slug: "ayrpc-2025",
    course_year: 2025,
    status: "active",
    enrolled_at: "2026-03-18T02:42:08Z",
  },
  {
    course_slug: "ayrpc-2026",
    course_year: 2026,
    status: "active",
    enrolled_at: "2026-10-12T23:14:29Z",
  },
];

assert.equal(
  status.selectCurrentEnrollment(enrollments).course_slug,
  "ayrpc-2026",
  "debe elegir la cursada activa más reciente"
);

assert.equal(
  status.getStatusForCourse(
    [
      ...enrollments,
      {
        course_slug: "ayrpc-2026",
        course_year: 2026,
        status: "withdrawn",
      },
    ],
    "ayrpc-2026"
  ),
  "active",
  "si hay duplicados conserva la primera fila del curso"
);

const withdrawnEnrollments = [
  {
    course_slug: "ayrpc-2025",
    course_year: 2025,
    status: "active",
  },
  {
    course_slug: "ayrpc-2026",
    course_year: 2026,
    status: "withdrawn",
  },
];

assert.equal(
  status.getStatusForCourse(withdrawnEnrollments, "ayrpc-2026"),
  "withdrawn"
);

assert.equal(
  status.decorateCourseLabel("AyRPC 2026", "withdrawn"),
  "AyRPC 2026 — Dado de baja"
);

assert.equal(
  status.decorateCourseLabel("AyRPC 2025", "active"),
  "AyRPC 2025"
);

console.log("withdrawal-status tests passed");
