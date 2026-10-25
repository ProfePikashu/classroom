"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const helperPath = path.join(
  __dirname,
  "../frontend/js/curso-ayrpc-2026-teacher-preview.js"
);
const html = fs.readFileSync(
  path.join(__dirname, "../frontend/curso-ayrpc-2026.html"),
  "utf8"
);

assert.ok(
  fs.existsSync(helperPath),
  "debe existir el controlador de vista docente"
);

const source = fs.readFileSync(helperPath, "utf8");

assert.match(source, /isTeacherSession\s*\(/);
assert.match(source, /teacher_preview/);
assert.match(source, /REGISTRADO/);
assert.match(source, /live_presence_seconds/);
assert.match(source, /Vista docente/);
assert.match(
  html,
  /curso-ayrpc-2026-teacher-preview\.js\?v=20261025-teacher-live-v1/,
  "el HTML debe cargar el controlador docente con cache busting"
);

console.log("AyRPC 2026 teacher live panel tests passed");
