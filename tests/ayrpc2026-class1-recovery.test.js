"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(
  path.join(__dirname, "../frontend/clases-ayrpc-2026.html"),
  "utf8"
);

const recovery = fs.readFileSync(
  path.join(__dirname, "../frontend/js/ayrpc2026-recovery.js"),
  "utf8"
);

assert.match(
  html,
  /js\/ayrpc2026-recovery\.js/,
  "la vista 2026 debe cargar el controlador de recuperación"
);

assert.match(
  html,
  /js\/ayrpc2026-recovery\.js\?v=20261025-teacher-preview-v2/,
  "la vista debe invalidar el cache al publicar el preview docente"
);

assert.match(
  recovery,
  /const COURSE_SLUG = "ayrpc-2026"/,
  "la recuperación debe apuntar al curso AyRPC 2026"
);

assert.match(
  recovery,
  /\/api\/classroom\/courses\/\$\{COURSE_SLUG\}\/classes\/\$\{classNumber\}\/recovery/,
  "la recuperación debe usar el endpoint autenticado del backend"
);

assert.match(
  recovery,
  /required_correct_answers/,
  "la UI debe mostrar el requisito de respuestas correctas recibido del backend"
);

assert.match(
  recovery,
  /AUSENTE|REVISAR/,
  "solo estados recuperables deben habilitar el flujo real"
);

assert.match(
  recovery,
  /preview_mode/,
  "la UI debe reconocer la vista previa docente del backend"
);

assert.match(
  recovery,
  /Vista previa docente/,
  "la vista previa debe identificarse claramente como docente"
);

assert.match(
  recovery,
  /function canTrackPlayback\(\)[\s\S]*state\.config\?\.eligible[\s\S]*isPreviewMode\(\)/,
  "el preview docente debe poder medir el tiempo visto sin volver elegible una recuperación real"
);

assert.match(
  recovery,
  /0\.98/,
  "el cuestionario real debe habilitarse recién al completar prácticamente todo el video"
);

assert.doesNotMatch(
  recovery,
  /FORMAT_CATEGORIES|ETHICS_CATEGORIES|cobrar de mas|pc de escritorio/,
  "las reglas de corrección no deben viajar al navegador"
);

console.log("AyRPC 2026 class 1 recovery contract tests passed");
