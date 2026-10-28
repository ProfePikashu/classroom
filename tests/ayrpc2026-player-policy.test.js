"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const recovery = fs.readFileSync(
  path.join(__dirname, "../frontend/js/ayrpc2026-recovery.js"),
  "utf8"
);

const recoveryUx = fs.readFileSync(
  path.join(__dirname, "../frontend/js/ayrpc2026-recovery-ux.js"),
  "utf8"
);

const classes = fs.readFileSync(
  path.join(__dirname, "../frontend/js/clases-ayrpc-2026.js"),
  "utf8"
);

const classesCss = fs.readFileSync(
  path.join(__dirname, "../frontend/css/clases-ayrpc-2026.css"),
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
  recoveryUx,
  /fullscreenchange/,
  "la vista de clases debe reaccionar al entrar o salir de pantalla completa"
);

assert.match(
  recoveryUx,
  /screen\?\.orientation\?\.lock\(["']landscape["']\)/,
  "el reproductor debe pedir orientación horizontal al entrar en fullscreen"
);

assert.match(
  recoveryUx,
  /screen\?\.orientation\?\.unlock\(\)/,
  "la orientación debe liberarse al salir del fullscreen del video"
);

assert.match(
  recoveryUx,
  /#youtubePlayer iframe/,
  "el bloqueo de orientación debe limitarse al reproductor de YouTube del Classroom"
);

assert.match(
  recoveryUx,
  /function fullscreenViewportSize\(/,
  "fullscreen debe recalcular el viewport real después de rotar"
);

assert.match(
  recoveryUx,
  /visualViewport/,
  "fullscreen debe usar visualViewport cuando el navegador lo exponga"
);

assert.match(
  recoveryUx,
  /setAttribute\(["']width["']/,
  "el iframe debe actualizar su ancho real y no sólo el CSS"
);

assert.match(
  recoveryUx,
  /setAttribute\(["']height["']/,
  "el iframe debe actualizar su alto real y no sólo el CSS"
);

assert.match(
  recoveryUx,
  /orientationchange/,
  "el player debe recalcular tamaño cuando cambia la orientación"
);

assert.match(
  recovery,
  /fs:\s*0/,
  "el player de recuperación debe ocultar el fullscreen interno de YouTube"
);

assert.match(
  classes,
  /[?&]fs=0/,
  "el player normal debe ocultar el fullscreen interno de YouTube"
);

assert.match(
  html,
  /id=["']classroomVideoFullscreen["']/,
  "la vista debe ofrecer un botón fullscreen controlado por el Classroom"
);

assert.match(
  recoveryUx,
  /function toggleClassroomVideoFullscreen\(/,
  "la UX debe controlar el fullscreen desde el documento principal"
);

assert.match(
  recoveryUx,
  /requestFullscreen\(/,
  "el fullscreen propio debe usar la Fullscreen API estándar"
);

assert.match(
  recoveryUx,
  /webkitRequestFullscreen\(/,
  "el fullscreen propio debe conservar fallback WebKit"
);

assert.match(
  recoveryUx,
  /videoPlayerBox/,
  "el fullscreen propio debe aplicarse al contenedor del video del Classroom"
);

assert.match(
  classesCss,
  /#videoPlayerBox\s*:\s*fullscreen[\s\S]*width:\s*100vw[\s\S]*height:\s*100vh/,
  "el contenedor propio debe ocupar todo el viewport en fullscreen"
);

assert.match(
  classesCss,
  /#youtubePlayer\s*:\s*fullscreen[\s\S]*width:\s*100vw[\s\S]*height:\s*100vh/,
  "el contenedor fullscreen heredado debe seguir ocupando todo el viewport móvil"
);

assert.match(
  classesCss,
  /#youtubePlayer\s*:\s*fullscreen[\s\S]*iframe[\s\S]*width:\s*100vw[\s\S]*height:\s*100vh/,
  "el iframe de YouTube debe llenar todo el viewport cuando está en fullscreen"
);

assert.match(
  html,
  /css\/clases-ayrpc-2026\.css\?v=20261027-fullscreen-v4/,
  "la vista debe invalidar cache del CSS del fullscreen propio"
);

assert.match(
  html,
  /js\/ayrpc2026-recovery\.js\?v=20261028-edge-v1/,
  "la vista debe invalidar cache del player de recuperación sin fullscreen interno"
);

assert.match(
  html,
  /js\/clases-ayrpc-2026\.js\?v=20261027-fullscreen-v4/,
  "la vista debe invalidar cache del embed normal sin fullscreen interno"
);

assert.match(
  html,
  /js\/ayrpc2026-recovery-ux\.js\?v=20261027-fullscreen-v4/,
  "la vista debe invalidar cache para la UX de fullscreen controlado"
);

console.log("AyRPC 2026 player policy tests passed");
