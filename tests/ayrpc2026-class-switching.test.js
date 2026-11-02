"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const classes = fs.readFileSync(
  path.join(__dirname, "../frontend/js/clases-ayrpc-2026.js"),
  "utf8"
);
const recovery = fs.readFileSync(
  path.join(__dirname, "../frontend/js/ayrpc2026-recovery.js"),
  "utf8"
);

const paintVideoMatch = classes.match(
  /function paintVideo\(item\) \{([\s\S]*?)\n  \}\n\n  function resetRecoveryUI/
);
assert.ok(paintVideoMatch, "debe existir paintVideo para la clase seleccionada");
assert.match(
  paintVideoMatch[1],
  /player\.dataset\.videoId\s*=\s*String\(item\.videoId\s*\|\|\s*["']{2}\)/,
  "cada cambio de clase debe publicar el videoId canónico y limpiar el anterior"
);

const extractVideoMatch = recovery.match(
  /function extractVideoId\(\) \{([\s\S]*?)\n  \}\n\n  function completionReached/
);
assert.ok(extractVideoMatch, "debe existir extractVideoId");
const extractBody = extractVideoMatch[1];
const iframeLookup = extractBody.indexOf('querySelector("iframe")');
const datasetLookup = extractBody.indexOf("dataset?.videoId");
assert.ok(iframeLookup >= 0, "extractVideoId debe inspeccionar el iframe actualmente pintado");
assert.ok(datasetLookup >= 0, "extractVideoId puede conservar dataset como fallback");
assert.ok(
  iframeLookup < datasetLookup,
  "el iframe de la clase recién seleccionada debe tener prioridad sobre un dataset viejo"
);

assert.match(
  recovery,
  /selectionRevision\s*:\s*0/,
  "el recovery debe versionar la selección para descartar respuestas async obsoletas"
);
assert.doesNotMatch(
  recovery,
  /configLoading\s*:\s*false/,
  "un booleano global de carga no debe bloquear la configuración de otra clase"
);
assert.match(
  recovery,
  /revision\s*!==\s*state\.selectionRevision[\s\S]*classNumber\s*!==\s*state\.classNumber/,
  "una respuesta de configuración vieja no debe poder aplicarse después de cambiar de clase"
);
assert.match(
  recovery,
  /const revision = state\.selectionRevision;[\s\S]*await loadRecoveryConfig\(classNumber, revision\)[\s\S]*revision !== state\.selectionRevision/,
  "syncSelection debe abandonar un ciclo async que ya no corresponde a la selección visible"
);

console.log("AyRPC 2026 class switching regression tests passed");
