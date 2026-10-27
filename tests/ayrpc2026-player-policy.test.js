"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const recovery = fs.readFileSync(
  path.join(__dirname, "../frontend/js/ayrpc2026-recovery.js"),
  "utf8"
);

const classes = fs.readFileSync(
  path.join(__dirname, "../frontend/js/clases-ayrpc-2026.js"),
  "utf8"
);

const html = fs.readFileSync(
  path.join(__dirname, "../frontend/clases-ayrpc-2026.html"),
  "utf8"
);

assert.match(
  recovery,
  /cc_load_policy:\s*0/,
  "el player controlado de recuperación debe pedir captions apagados de inicio"
);

assert.match(
  recovery,
  /function suppressCaptions\(/,
  "la recuperación debe tener una defensa best-effort para apagar captions"
);

assert.match(
  recovery,
  /unloadModule\(["']captions["']\)/,
  "la defensa best-effort debe intentar descargar el módulo captions"
);

assert.match(
  recovery,
  /function enforceNormalPlaybackRate\(/,
  "la recuperación debe centralizar el bloqueo de velocidad a 1x"
);

assert.match(
  recovery,
  /getPlaybackRate/,
  "la recuperación debe verificar la velocidad real del player"
);

assert.match(
  recovery,
  /setPlaybackRate\(1\)/,
  "la recuperación debe devolver el player a 1x"
);

assert.match(
  recovery,
  /onPlaybackRateChange:\s*event\s*=>[\s\S]*enforceNormalPlaybackRate/,
  "un cambio manual de velocidad debe corregirse de inmediato"
);

assert.match(
  recovery,
  /velocidad 1x/i,
  "la interfaz debe explicar que la recuperación se valida a velocidad 1x"
);

assert.match(
  classes,
  /cc_load_policy=0/,
  "el reproductor normal del Classroom debe pedir captions apagados de inicio"
);

assert.match(
  classes,
  /fullscreenchange/,
  "la vista de clases debe reaccionar al entrar o salir de pantalla completa"
);

assert.match(
  classes,
  /screen\?\.orientation\?\.lock\(["']landscape["']\)/,
  "el reproductor debe pedir orientación horizontal al entrar en fullscreen"
);

assert.match(
  classes,
  /screen\?\.orientation\?\.unlock\(\)/,
  "la orientación debe liberarse al salir del fullscreen del video"
);

assert.match(
  html,
  /js\/ayrpc2026-recovery\.js\?v=20261027-bandwidth-v1/,
  "la vista debe invalidar cache para la política del player y el heartbeat agrupado"
);

assert.match(
  html,
  /js\/clases-ayrpc-2026\.js\?v=20261027-bandwidth-v1/,
  "la vista debe invalidar cache para el embed normal y el polling optimizado"
);

console.log("AyRPC 2026 player policy tests passed");
