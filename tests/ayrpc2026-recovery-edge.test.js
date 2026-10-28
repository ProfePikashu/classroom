"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const recovery = fs.readFileSync("frontend/js/ayrpc2026-recovery.js", "utf8");
const recoveryUx = fs.readFileSync("frontend/js/ayrpc2026-recovery-ux.js", "utf8");
const html = fs.readFileSync("frontend/clases-ayrpc-2026.html", "utf8");

assert.match(
  recovery,
  /const\s+RECOVERY_EDGE_BASE\s*=\s*["']https:\/\/recovery\.andyazhtec\.com["']\s*;/,
  "el tracker debe tener Cloudflare recovery.andyazhtec.com como transporte edge por defecto"
);

assert.match(
  recovery,
  /function\s+edgeSessionEndpoint\([\s\S]*?\/edge-session/,
  "el frontend debe pedir al backend una sesión edge limitada antes de trackear"
);

assert.match(
  recovery,
  /function\s+edgeHeartbeatEndpoint\([\s\S]*?\/v1\/recovery\/heartbeat/,
  "los heartbeats normales deben apuntar al Worker, no a Render"
);

assert.match(
  recovery,
  /session_token:\s*state\.edgeSessionToken/,
  "el heartbeat edge debe usar el token limitado y no el Classroom token"
);

assert.match(
  recovery,
  /persisted_watched_seconds:\s*state\.serverWatchedSeconds/,
  "Cloudflare debe conocer el progreso ya persistido para separar confirmado de provisional"
);

assert.match(
  recovery,
  /required_watch_seconds:\s*knownDuration\(\)/,
  "Cloudflare debe conocer el corte académico para forzar checkpoint al acercarse al final"
);

assert.match(
  recovery,
  /force:\s*Boolean\(force\)/,
  "pausa, salida y cierre deben pedir flush inmediato al edge"
);

assert.match(
  recovery,
  /function\s+flushDirectWatchHeartbeat\(/,
  "el endpoint directo de Render debe conservarse como fallback de rollout"
);

assert.match(
  recovery,
  /edgeSessionUnavailable[\s\S]*flushDirectWatchHeartbeat/,
  "si no se pudo crear una sesión edge el tracker debe seguir por el fallback directo"
);

assert.match(
  recovery,
  /edgeFallbackUntil/,
  "si el Worker falla temporalmente debe existir una ventana de fallback directo sin martillar Cloudflare"
);

assert.match(
  recovery,
  /edgePendingSeconds/,
  "la UI debe separar progreso aceptado en edge pero todavía no persistido"
);

assert.match(
  recovery,
  /edgeConfirmedComplete/,
  "el frontend debe tener una señal distinta para final confirmado por backend"
);

assert.match(
  recovery,
  /function\s+completionReached\(\)[\s\S]*edgeConfirmedComplete/,
  "el cuestionario no debe desbloquearse solamente por progreso provisional"
);

assert.match(
  recovery,
  /Math\.min\(99,[\s\S]*provisional/i,
  "el progreso provisional debe quedar visualmente en 99% hasta el checkpoint final"
);

assert.match(
  recoveryUx,
  /recovery\.andyazhtec\.com/,
  "el watchdog debe reconocer respuestas del Worker edge"
);

assert.match(
  recoveryUx,
  /accepted[\s\S]*markValidationActive/,
  "un heartbeat aceptado por Cloudflare debe mantener la validación visual activa aunque todavía no haya checkpoint"
);

assert.match(
  html,
  /js\/ayrpc2026-recovery\.js\?v=20261028-edge-v1/,
  "la vista debe invalidar el cache del tracker al activar el transporte edge"
);

assert.match(
  html,
  /js\/ayrpc2026-recovery-ux\.js\?v=20261028-edge-v1/,
  "la vista debe invalidar también el cache del watchdog edge"
);

console.log("AyRPC 2026 recovery edge transport contract tests passed");
