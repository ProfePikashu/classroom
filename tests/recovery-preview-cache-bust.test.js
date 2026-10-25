"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(
  path.join(__dirname, "../frontend/clases-ayrpc-2026.html"),
  "utf8"
);

assert.match(
  html,
  /js\/ayrpc2026-recovery\.js\?v=20261025-teacher-preview-v2/,
  "la vista debe invalidar el cache del controlador al publicar el preview docente"
);

console.log("Recovery teacher preview cache-bust test passed");
