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

const auth = fs.readFileSync(
  path.join(__dirname, "../frontend/js/auth.js"),
  "utf8"
);

const classesCss = fs.readFileSync(
  path.join(__dirname, "../frontend/css/clases-ayrpc-2026.css"),
  "utf8"
);

assert.match(html, /js\/ayrpc2026-recovery\.js/, "la vista 2026 debe cargar el controlador de recuperación");
assert.match(html, /js\/auth\.js\?v=20261025-recovery-auth-v2/, "la vista debe invalidar el cache de auth al exponer ClassroomAuth para recuperación");
assert.match(html, /js\/ayrpc2026-recovery\.js\?v=20261025-watch-heartbeat-v4/, "la vista debe forzar el asset nuevo del tracker");
assert.match(html, /css\/clases-ayrpc-2026\.css\?v=20261025-player-fit-v1/, "la vista debe invalidar el cache del ajuste visual del player");
assert.match(classesCss, /#youtubePlayer\s+iframe[\s\S]*width:\s*100%[\s\S]*height:\s*100%/, "el iframe controlado de YouTube debe llenar todo el recuadro 16:9");
assert.match(classesCss, /#youtubePlayer\s+iframe[\s\S]*display:\s*block/, "el iframe no debe dejar espacio de línea dentro del recuadro");
assert.match(recovery, /const COURSE_SLUG = "ayrpc-2026"/, "la recuperación debe apuntar al curso AyRPC 2026");
assert.match(recovery, /const CLASS1_REQUIRED_WATCH_SECONDS = 6960/, "la Clase 1 debe llegar al 100% en 1h56 desde el inicio");
assert.match(recovery, /const VIDEO_COMPLETION_RATIO = 1(?:\.0)?;/, "la Clase 1 debe completarse exactamente al llegar al corte configurado");
assert.match(recovery, /function knownDuration\(\)[\s\S]*required_watch_seconds[\s\S]*CLASS1_REQUIRED_WATCH_SECONDS/, "la barra debe usar el corte académico y no la duración completa subida a YouTube");
assert.match(recovery, /Math\.floor\(rawPercent\)/, "la barra no debe redondear a 100% antes de alcanzar 1h56:00");
assert.match(auth, /window\.ClassroomAuth\s*=\s*ClassroomAuth\s*;/, "auth.js debe exponer ClassroomAuth en window para los controladores que lo consumen como propiedad global");
assert.match(recovery, /\/api\/classroom\/courses\/\$\{COURSE_SLUG\}\/classes\/\$\{classNumber\}\/recovery/, "la recuperación debe usar el endpoint autenticado del backend");
assert.match(recovery, /function recoveryWatchEndpoint[\s\S]*recoveryEndpoint\(classNumber\)[\s\S]*\/watch/, "el frontend debe reportar heartbeats de tiempo visto al backend");
assert.match(recovery, /video_duration_seconds:\s*Number\(safePlayerDuration\(\)/, "el heartbeat debe informar la duración real del player");
assert.match(recovery, /required_correct_answers/, "la UI debe mostrar el requisito de respuestas correctas recibido del backend");
assert.match(recovery, /AUSENTE|REVISAR/, "solo estados recuperables deben habilitar el flujo real");
assert.match(recovery, /preview_mode/, "la UI debe reconocer la vista previa docente del backend");
assert.match(recovery, /Vista previa docente/, "la vista previa debe identificarse claramente como docente");
assert.match(recovery, /function canTrackPlayback\(\)[\s\S]*state\.config\?\.eligible[\s\S]*isPreviewMode\(\)/, "el preview docente debe poder medir el tiempo visto sin volver elegible una recuperación real");
assert.match(recovery, /function extractVideoId\(\)[\s\S]*querySelector\("iframe"\)/, "la recuperación debe tomar el video seleccionado y luego hacerse dueña del player");
assert.match(recovery, /host\.innerHTML\s*=\s*'<div id="ayrpc2026RecoveryPlayerMount"><\/div>'/, "el iframe general debe ser reemplazado por el mount controlado");
assert.match(recovery, /new window\.YT\.Player\("ayrpc2026RecoveryPlayerMount"/, "la recuperación debe ser la única dueña del player controlado");
assert.match(recovery, /onReady:[\s\S]*startTracking\(\)/, "el watchdog debe arrancar al estar listo el player y no depender exclusivamente del evento PLAYING");
assert.match(recovery, /getPlayerState\(\)[\s\S]*PlayerState\.PLAYING/, "el watchdog debe consultar el estado real de YouTube antes de sumar tiempo");
assert.match(recovery, /visibilitychange/, "el tracker debe reaccionar cuando la pestaña deja de estar visible");
assert.match(recovery, /document\.hidden|document\.visibilityState/, "el tiempo válido no debe contarse con la pestaña oculta");
assert.doesNotMatch(recovery, /window\.addEventListener\("blur"/, "hacer click dentro del iframe de YouTube no debe detener el tracking");
assert.match(recovery, /Para recuperar esta clase tenés que ver el video completo desde esta vista/, "un alumno recuperable debe recibir la advertencia antes de iniciar");
assert.doesNotMatch(recovery, /FORMAT_CATEGORIES|ETHICS_CATEGORIES|cobrar de mas|pc de escritorio/, "las reglas de corrección no deben viajar al navegador");

console.log("AyRPC 2026 class 1 recovery contract tests passed");
