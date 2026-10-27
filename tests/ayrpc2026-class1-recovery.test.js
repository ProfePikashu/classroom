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

const recoveryUxPath = path.join(
  __dirname,
  "../frontend/js/ayrpc2026-recovery-ux.js"
);
const recoveryUx = fs.existsSync(recoveryUxPath)
  ? fs.readFileSync(recoveryUxPath, "utf8")
  : "";

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
assert.match(html, /js\/clases-ayrpc-2026\.js\?v=20261027-bandwidth-v1/, "la vista debe invalidar el cache del polling de asistencia optimizado");
assert.match(html, /js\/ayrpc2026-recovery\.js\?v=20261027-bandwidth-v1/, "la vista debe forzar el tracker con heartbeats agrupados");
assert.match(html, /js\/ayrpc2026-recovery-ux\.js\?v=20261027-bandwidth-v1/, "la vista debe cargar el watchdog alineado al heartbeat agrupado");
assert.match(classesCss, /#youtubePlayer\s+iframe[\s\S]*width:\s*100%[\s\S]*height:\s*100%/, "el iframe controlado de YouTube debe llenar todo el recuadro 16:9");
assert.match(classesCss, /#youtubePlayer\s+iframe[\s\S]*display:\s*block/, "el iframe no debe dejar espacio de línea dentro del recuadro");
assert.match(recovery, /const COURSE_SLUG = "ayrpc-2026"/, "la recuperación debe apuntar al curso AyRPC 2026");
assert.match(recovery, /const CLASS1_REQUIRED_WATCH_SECONDS = 6960/, "la Clase 1 debe llegar al 100% en 1h56 desde el inicio");
assert.match(recovery, /const VIDEO_COMPLETION_RATIO = 1(?:\.0)?;/, "la Clase 1 debe completarse exactamente al llegar al corte configurado");
assert.match(recovery, /const HEARTBEAT_SECONDS = 30/, "el tracker debe agrupar el tiempo visto en heartbeats de 30 segundos");
assert.match(recovery, /const PLAYER_ATTACH_TIMEOUT_MS = 15000/, "el montaje del player académico mantiene su timeout conocido");
assert.match(recovery, /function knownDuration\(\)[\s\S]*required_watch_seconds[\s\S]*CLASS1_REQUIRED_WATCH_SECONDS/, "la barra debe usar el corte académico y no la duración completa subida a YouTube");
assert.match(recovery, /Math\.floor\(rawPercent\)/, "la barra no debe redondear a 100% antes de alcanzar 1h56:00");
assert.match(auth, /window\.ClassroomAuth\s*=\s*ClassroomAuth\s*;/, "auth.js debe exponer ClassroomAuth en window para los controladores que lo consumen como propiedad global");
assert.match(recovery, /\/api\/classroom\/courses\/\$\{COURSE_SLUG\}\/classes\/\$\{classNumber\}\/recovery/, "la recuperación debe usar el endpoint autenticado del backend");
assert.match(recovery, /function recoveryWatchEndpoint[\s\S]*recoveryEndpoint\(classNumber\)[\s\S]*\/watch/, "el frontend debe reportar heartbeats de tiempo visto al backend");
assert.match(recovery, /video_duration_seconds:\s*Number\(safePlayerDuration\(\)/, "el heartbeat debe informar la duración real del player");
assert.match(recovery, /keepalive:\s*force/, "un flush forzado debe usar keepalive para no perder progreso al cerrar la vista");
assert.match(recovery, /window\.addEventListener\(\s*["']pagehide["'][\s\S]*flushWatchHeartbeat\(true\)/, "al cerrar o abandonar la página debe intentarse un último flush del tiempo pendiente");
assert.doesNotMatch(recovery, /readLocalCheckpoint|writeLocalCheckpoint|recoveryCheckpointKey/, "el tracker académico restaurado no debe contener la lógica de reanudación local");
assert.match(recovery, /function startTracking\(\)[\s\S]*getPlayerState\(\)[\s\S]*PlayerState\.PLAYING/, "el tracker restaurado debe medir reproducción real de YouTube");
assert.match(recovery, /onReady:[\s\S]*startTracking\(\)/, "el tracker debe arrancar cuando el player controlado está listo");
assert.match(recoveryUx, /const WATCHDOG_TIMEOUT_MS = 60000/, "el watchdog separado debe tolerar hasta 60 segundos sin confirmación con heartbeats agrupados");
assert.match(recoveryUx, /resume_position_seconds/, "la capa UX debe consumir el último punto confirmado por servidor");
assert.match(recoveryUx, /function computeResumePosition\(\)[\s\S]*serverResumePosition/, "Continuar desde debe partir sólo del checkpoint confirmado por servidor");
assert.match(recoveryUx, /Continuar desde/, "debe conservar el botón explícito para reanudar");
assert.match(recoveryUx, /sendYouTubeCommand\(iframe,\s*"seekTo",\s*\[resumePosition,\s*true\]\)/, "la reanudación aislada debe ordenar el seek sin tocar el contador académico");
assert.match(recoveryUx, /watchValidationStatus/, "debe existir un estado visible de validación del tiempo");
assert.match(recoveryUx, /retryWatchValidation/, "debe existir una acción visible para reintentar el seguimiento");
assert.match(recoveryUx, /Validación activa/, "debe informar al alumno cuando el progreso se está confirmando");
assert.match(recoveryUx, /No estamos pudiendo validar tu tiempo de reproducción/, "debe advertir claramente cuando no llegan confirmaciones");
assert.match(recoveryUx, /function markValidationProblem\(/, "debe centralizar el estado de error del watchdog");
assert.match(recoveryUx, /function markValidationActive\(/, "debe centralizar el estado activo del watchdog");
assert.match(recoveryUx, /lastServerProgressAt/, "el watchdog debe recordar la última confirmación real del servidor");
assert.match(recoveryUx, /playbackStartedAt/, "el watchdog debe medir desde cuándo se reproduce sin confirmación");
assert.match(recoveryUx, /Date\.now\(\)\s*-\s*state\.playbackStartedAt\s*>?=\s*WATCHDOG_TIMEOUT_MS/, "la alerta no debe aparecer antes del timeout durante reproducción");
assert.match(recoveryUx, /PLAYER_ATTACH_TIMEOUT_MS[\s\S]*markValidationProblem/, "si no aparece el player controlado debe avisar en pantalla");
assert.doesNotMatch(recoveryUx, /localStorage\.setItem\([\s\S]*position_seconds|localStorage\.getItem\([\s\S]*checkpoint/, "la capa UX tampoco debe acreditar ni adelantar por checkpoint local");
assert.match(recovery, /required_correct_answers/, "la UI debe mostrar el requisito de respuestas correctas recibido del backend");
assert.match(recovery, /AUSENTE|REVISAR/, "solo estados recuperables deben habilitar el flujo real");
assert.match(recovery, /preview_mode/, "la UI debe reconocer la vista previa docente del backend");
assert.match(recovery, /Vista previa docente/, "la vista previa debe identificarse claramente como docente");
assert.match(recovery, /function canTrackPlayback\(\)[\s\S]*state\.config\?\.eligible[\s\S]*isPreviewMode\(\)/, "el preview docente debe poder medir el tiempo visto sin volver elegible una recuperación real");
assert.match(recovery, /function extractVideoId\(\)[\s\S]*querySelector\("iframe"\)/, "la recuperación debe tomar el video seleccionado y luego hacerse dueña del player");
assert.match(recovery, /host\.innerHTML\s*=\s*'<div id="ayrpc2026RecoveryPlayerMount"><\/div>'/, "el iframe general debe ser reemplazado por el mount controlado");
assert.match(recovery, /new window\.YT\.Player\("ayrpc2026RecoveryPlayerMount"/, "la recuperación debe ser la única dueña del player controlado");
assert.match(recovery, /visibilitychange/, "el tracker debe reaccionar cuando la pestaña deja de estar visible");
assert.match(recovery, /document\.hidden|document\.visibilityState/, "el tiempo válido no debe contarse con la pestaña oculta");
assert.doesNotMatch(recovery, /window\.addEventListener\("blur"/, "hacer click dentro del iframe de YouTube no debe detener el tracking");
assert.match(recovery, /Para recuperar esta clase tenés que ver el video completo desde esta vista/, "un alumno recuperable debe recibir la advertencia antes de iniciar");
assert.doesNotMatch(recovery, /FORMAT_CATEGORIES|ETHICS_CATEGORIES|cobrar de mas|pc de escritorio/, "las reglas de corrección no deben viajar al navegador");
assert.match(recovery, /function paintQuestionResults\(/, "la UI debe centralizar el pintado verde o rojo por respuesta");
assert.match(recovery, /data\?\.question_results/, "la UI debe usar el resultado por pregunta devuelto por el backend");
assert.match(recovery, /is-valid/, "una respuesta válida debe tener estado visual verde");
assert.match(recovery, /is-invalid/, "una respuesta insuficiente debe tener estado visual rojo");

console.log("AyRPC 2026 class 1 recovery contract tests passed");
