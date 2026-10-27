const fs = require('fs');
const assert = require('assert');

const notificationsPath = 'frontend/js/notifications-local.js';
const course2025Path = 'frontend/js/curso-ayrpc-2025.js';
const course2026Path = 'frontend/js/curso-ayrpc-2026.js';
const classes2026Path = 'frontend/js/clases-ayrpc-2026.js';
const recovery2026Path = 'frontend/js/ayrpc2026-recovery.js';
const recoveryUx2026Path = 'frontend/js/ayrpc2026-recovery-ux.js';

const notifications = fs.readFileSync(notificationsPath, 'utf8');
const course2025 = fs.readFileSync(course2025Path, 'utf8');
const course2026 = fs.readFileSync(course2026Path, 'utf8');
const classes2026 = fs.readFileSync(classes2026Path, 'utf8');
const recovery2026 = fs.readFileSync(recovery2026Path, 'utf8');
const recoveryUx2026 = fs.readFileSync(recoveryUx2026Path, 'utf8');

assert.match(
  notifications,
  /const\s+POLL_MS\s*=\s*300000\s*;/,
  'El polling de notificaciones debe ser de 5 minutos para reducir lecturas repetidas.'
);

assert.match(
  notifications,
  /const\s+REALTIME_WS_ENABLED\s*=\s*false\s*;/,
  'El WebSocket realtime debe quedar temporalmente deshabilitado mientras responda 403.'
);

assert.match(
  notifications,
  /function\s+init\(\)\s*\{[\s\S]*?if\s*\(!REALTIME_WS_ENABLED\)\s*\{[\s\S]*?return\s*;[\s\S]*?\}/,
  'El bridge WebSocket no debe intentar conectar cuando realtime está deshabilitado.'
);

for (const [name, source] of [
  ['AyRPC 2025', course2025],
  ['AyRPC 2026', course2026],
]) {
  assert.match(
    source,
    /isTeacherSession\(session\)/,
    `${name} debe detectar explícitamente sesiones docentes.`
  );

  assert.match(
    source,
    /if\s*\(this\.isTeacherSession\(session\)\)\s*\{[\s\S]*?return\s*;[\s\S]*?\}/,
    `${name} no debe consultar estado académico de alumno para una sesión docente.`
  );
}

assert.match(
  classes2026,
  /const\s+ATTENDANCE_POLL_OPEN_MS\s*=\s*15000\s*;/,
  'Con una ventana de asistencia abierta se debe conservar polling rápido de 15 segundos.'
);

assert.match(
  classes2026,
  /const\s+ATTENDANCE_POLL_CLOSED_MS\s*=\s*60000\s*;/,
  'Con la asistencia cerrada el polling debe bajar a una vez por minuto.'
);

assert.match(
  classes2026,
  /function\s+attendancePollDelay\(\)[\s\S]*?state\.attendance\?\.open[\s\S]*?ATTENDANCE_POLL_OPEN_MS[\s\S]*?ATTENDANCE_POLL_CLOSED_MS/,
  'La frecuencia de asistencia debe adaptarse a si la ventana está abierta o cerrada.'
);

assert.match(
  classes2026,
  /function\s+scheduleAttendancePolling\([\s\S]*?document\.hidden[\s\S]*?window\.setTimeout/,
  'El polling debe programarse sólo con la pestaña visible y con timeout reprogramable.'
);

assert.match(
  classes2026,
  /document\.addEventListener\(\s*["']visibilitychange["'][\s\S]*?stopAttendancePolling\(\)[\s\S]*?refreshAttendanceWindowState/,
  'Al ocultar la pestaña debe detenerse el polling y al volver debe refrescarse una vez.'
);

assert.doesNotMatch(
  classes2026,
  /function\s+startAttendancePolling\(\)[\s\S]*?setInterval\([\s\S]*?15000/,
  'La asistencia no debe conservar un setInterval fijo de 15 segundos.'
);

assert.match(
  recovery2026,
  /const\s+HEARTBEAT_SECONDS\s*=\s*30\s*;/,
  'La recuperación debe agrupar el progreso y sincronizarlo cada 30 segundos.'
);

assert.match(
  recovery2026,
  /function\s+pauseForInactiveView\(\)[\s\S]*?flushWatchHeartbeat\(true\)/,
  'Al ocultar o pausar la recuperación debe forzarse el guardado pendiente.'
);

assert.match(
  recoveryUx2026,
  /const\s+WATCHDOG_TIMEOUT_MS\s*=\s*60000\s*;/,
  'El watchdog debe tolerar el heartbeat agrupado antes de marcar un problema.'
);

console.log('OK: runtime load shedding for notifications, course panels, attendance and recovery');
