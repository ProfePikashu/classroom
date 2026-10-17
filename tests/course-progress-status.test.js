"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../frontend/js/clases-ayrpc-2026.js"),
  "utf8"
);

assert.match(
  source,
  /\/api\/classroom\/me\/course-status\?course=ayrpc-2026/,
  "la vista de clases debe cargar el progreso real del usuario"
);

assert.match(
  source,
  /state\.statuses\[classItem\.id\]\s*=\s*normalizedStatus/,
  "los estados devueltos por el backend deben reflejarse en las tarjetas y en la clase seleccionada"
);

assert.match(
  source,
  /await loadCourseProgress\(\);/,
  "el progreso debe cargarse antes de renderizar las clases"
);

console.log("course progress status tests passed");
