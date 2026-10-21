const fs = require('fs');
const assert = require('assert');

const notificationsPath = 'frontend/js/notifications-local.js';
const course2025Path = 'frontend/js/curso-ayrpc-2025.js';
const course2026Path = 'frontend/js/curso-ayrpc-2026.js';

const notifications = fs.readFileSync(notificationsPath, 'utf8');
const course2025 = fs.readFileSync(course2025Path, 'utf8');
const course2026 = fs.readFileSync(course2026Path, 'utf8');

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

console.log('OK: runtime load shedding for notifications and teacher course panels');
