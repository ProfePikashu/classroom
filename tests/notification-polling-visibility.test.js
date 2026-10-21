const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('frontend/js/notifications-local.js', 'utf8');

assert.match(
  source,
  /const\s+POLL_MS\s*=\s*300000\s*;/,
  'El polling de respaldo debe ser cada 5 minutos.'
);

assert.match(
  source,
  /async\s+function\s+syncBackendQuietly\(\)\s*\{[\s\S]*?document\.visibilityState\s*!==\s*["']visible["'][\s\S]*?return\s*;/,
  'No debe consultar backend cuando la pestaña no está visible.'
);

assert.match(
  source,
  /document\.addEventListener\(["']visibilitychange["'][\s\S]*?document\.visibilityState\s*===\s*["']visible["'][\s\S]*?syncBackendQuietly\(\)/,
  'Debe refrescar al volver a una pestaña visible.'
);

assert.match(
  source,
  /event\.target\.closest\(["']#notificationsToggle["']\)[\s\S]*?syncBackendQuietly\(\)/,
  'Debe refrescar backend al abrir la campanita.'
);

console.log('OK: low-frequency visible-only notification polling');
