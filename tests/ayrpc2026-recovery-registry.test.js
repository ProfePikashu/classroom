"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const recovery = fs.readFileSync(
  path.join(__dirname, "../frontend/js/ayrpc2026-recovery.js"),
  "utf8"
);

assert.doesNotMatch(
  recovery,
  /ENABLED_CLASS_NUMBERS/,
  "el frontend no debe mantener una allowlist local de clases recuperables"
);
assert.doesNotMatch(
  recovery,
  /REQUIRED_WATCH_SECONDS_BY_CLASS/,
  "el tiempo academico debe venir del backend"
);
assert.doesNotMatch(
  recovery,
  /RECOVERY_TITLES/,
  "los titulos de recuperacion deben venir del backend"
);

const knownDurationMatch = recovery.match(
  /function knownDuration\(\) \{([\s\S]*?)\n  \}\n\n  function watchedTotal/
);
assert.ok(knownDurationMatch, "debe existir knownDuration");
assert.match(
  knownDurationMatch[1],
  /state\.config\?\.required_watch_seconds/,
  "el corte academico configurado por backend debe tener prioridad"
);

const renderQuizMatch = recovery.match(
  /function renderQuiz\(\) \{([\s\S]*?)\n  \}\n\n  function paintRecoveredState/
);
assert.ok(renderQuizMatch, "debe existir renderQuiz");
assert.match(
  renderQuizMatch[1],
  /config\.title/,
  "el titulo visible del cuestionario debe venir de la configuracion backend"
);

const syncMatch = recovery.match(
  /async function syncSelection\(\) \{([\s\S]*?)\n  \}\n\n  function scheduleSync/
);
assert.ok(syncMatch, "debe existir syncSelection");
assert.match(
  syncMatch[1],
  /await loadRecoveryConfig\(classNumber, revision\)/,
  "cualquier clase seleccionada debe consultar si el backend tiene recuperacion configurada"
);
assert.doesNotMatch(
  syncMatch[1],
  /classNumber\)\)\s*\{[\s\S]*showRecoveryProgress\(false\)/,
  "el frontend no debe rechazar una clase por una lista local antes de consultar backend"
);

const buttonMatch = recovery.match(
  /function isEnabledRecoveryButton\(button\) \{([\s\S]*?)\n  \}\n\n  function bindRecoveryStartWarning/
);
assert.ok(buttonMatch, "debe existir el guard del boton Recuperar clase");
assert.match(
  buttonMatch[1],
  /pelusitaAction\s*!==\s*["']recover-class["']/,
  "la advertencia debe aplicarse al boton de recuperar"
);
assert.doesNotMatch(
  buttonMatch[1],
  /ENABLED_CLASS_NUMBERS/,
  "la advertencia debe servir tambien para clases futuras"
);

assert.match(
  recovery,
  /YouTube/i,
  "la advertencia debe mencionar la salida a YouTube"
);
assert.match(
  recovery,
  /pantalla completa/i,
  "la advertencia debe recomendar pantalla completa dentro del Classroom"
);
assert.match(
  recovery,
  /puede no registrarse/i,
  "la advertencia debe explicar que el tiempo fuera del Classroom puede no registrarse"
);

console.log("AyRPC 2026 backend-driven recovery registry frontend tests passed");
