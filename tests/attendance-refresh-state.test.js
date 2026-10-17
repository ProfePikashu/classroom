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
  /\/api\/classroom\/attendance\/state\?course=/,
  "al recargar, alumnos y staff deben recuperar el estado de la ventana activa"
);

assert.match(
  source,
  /const hasActiveCode\s*=\s*isThisClassOpen\s*&&\s*state\.attendance\.expiresAt\s*&&\s*Date\.now\(\)\s*<\s*state\.attendance\.expiresAt/,
  "el formulario debe depender del token activo del backend, no del codigo en memoria"
);

assert.match(
  source,
  /sessionStorage\.setItem\(/,
  "el navegador que genero el codigo debe conservarlo al recargar"
);

console.log("attendance refresh state tests passed");
