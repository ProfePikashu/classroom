"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../frontend/js/curso-ayrpc-2026.js"),
  "utf8"
);
const html = fs.readFileSync(
  path.join(__dirname, "../frontend/curso-ayrpc-2026.html"),
  "utf8"
);

assert.match(
  source,
  /live_presence_seconds/,
  "el panel del alumno debe consumir los segundos reales de asistencia"
);

assert.match(
  source,
  /live_presence_percent/,
  "el panel debe conservar el porcentaje real de presencia"
);

assert.match(
  source,
  /formatExactAttendanceTime\s*\(seconds\)/,
  "debe existir un formateador exacto que incluya segundos"
);

assert.match(
  source,
  /getHeldClassNumbers\s*\(/,
  "debe existir una regla para detectar clases ya dictadas"
);

assert.match(
  source,
  /paintCourseRoadmap\s*\(/,
  "el recorrido del curso debe pintarse desde el estado real"
);

assert.match(
  source,
  /fa-circle-check/,
  "las clases ya dictadas deben mostrar un tilde verde"
);

assert.match(
  source,
  /2026-10-24T21:35:00-03:00/,
  "la Clase 1 debe tener fallback de finalizacion conocido para alumnos sin progreso"
);

assert.match(
  html,
  /js\/curso-ayrpc-2026\.js\?v=20261025-live-attendance-v1/,
  "el HTML debe romper cache al publicar el panel corregido"
);

console.log("AyRPC 2026 live panel tests passed");
