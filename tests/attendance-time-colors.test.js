"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../frontend/js/asistencias.js"),
  "utf8"
);

assert.match(
  source,
  /live_presence_seconds/,
  "la vista debe consumir los segundos reales guardados para cada clase"
);

assert.match(
  source,
  /live_presence_percent/,
  "la vista debe consumir el porcentaje real guardado para cada clase"
);

assert.match(
  source,
  /formatAttendanceDuration\s*\(seconds\)/,
  "debe existir un formateador de duracion exacta para 2026"
);

assert.match(
  source,
  /attendanceTimeTone\s*\(percent\)/,
  "debe existir una regla unica para decidir el color del tiempo"
);

assert.match(
  source,
  /if\s*\(value\s*>=\s*75\)\s*return\s*["']success["']/,
  "75% o mas debe ser verde"
);

assert.match(
  source,
  /if\s*\(value\s*>=\s*70\)\s*return\s*["']warning["']/,
  "70% a 74.99% debe ser amarillo"
);

assert.match(
  source,
  /return\s*["']danger["']/,
  "por debajo de 70% debe ser rojo"
);

assert.match(
  source,
  /if\s*\(!Number\.isFinite\(value\)\)\s*return\s*["']["']/,
  "si no hay porcentaje no debe inventar color"
);

assert.match(
  source,
  /course\s*!==\s*["']ayrpc-2026["']/,
  "AyRPC 2025 debe conservar su tiempo legacy sin aplicar el nuevo formato"
);

assert.match(
  source,
  /renderAttendanceTime\s*\(/,
  "el tiempo renderizado debe pasar por el helper nuevo"
);

console.log("attendance time color tests passed");
