"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../frontend/asistencias.html"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "../frontend/js/asistencias.js"), "utf8");
const cssPath = path.join(__dirname, "../frontend/css/asistencias-admin.css");
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";

assert.match(
  html,
  /<option value="ayrpc-2026" selected>AyRPC 2026<\/option>/,
  "Asistencias debe abrir AyRPC 2026 por defecto"
);

assert.match(
  html,
  /css\/asistencias-admin\.css/,
  "la vista debe cargar un CSS dedicado de asistencias"
);

assert.match(
  js,
  /currentHasPermission\("attendance\.edit"\)/,
  "la edición manual debe depender del permiso attendance.edit"
);

assert.match(
  js,
  /enrollment_status/,
  "la planilla debe usar el estado canónico de la matrícula para detectar bajas"
);

assert.match(
  js,
  /\/api\/classroom\/admin\/attendance\/progress/,
  "la edición manual debe persistir por el endpoint admin de progreso"
);

assert.match(
  js,
  /attendance-withdrawn-row/,
  "las bajas deben tener una clase visual propia"
);

assert.match(
  js,
  />BAJA</,
  "el nombre del alumno dado de baja debe llevar badge BAJA"
);

assert.match(
  js,
  /data-attendance-status-trigger/,
  "la edición visible debe ser un botón contextual y no un select permanente"
);

assert.match(
  js,
  /fa-(?:solid\s+)?fa-pen|fa-pen/,
  "el botón de edición debe mostrar un lapicito"
);

assert.match(
  js,
  /data-attendance-status-edit[^>]*hidden|hidden[^>]*data-attendance-status-edit/,
  "el select real debe nacer oculto hasta tocar el lapicito"
);

assert.match(
  css,
  /\.attendance-status-popover[\s\S]*?position:\s*absolute/i,
  "el editor debe abrir como popover sin agrandar la fila"
);

assert.doesNotMatch(
  css,
  /\.attendance-status-editor\s*\{[\s\S]*?display:\s*block/i,
  "el editor no debe ocupar espacio permanente debajo de cada badge"
);

assert.match(
  css,
  /@media\s*\(max-width:\s*700px\)[\s\S]*?\.attendance-student-main[\s\S]*?max-width:\s*128px/i,
  "en mobile la columna alumno debe compactarse a aproximadamente 128 px"
);

assert.match(
  css,
  /\.attendance-withdrawn-row[\s\S]*?text-decoration[^;]*line-through/i,
  "la fila de baja debe quedar tachada"
);

assert.match(
  css,
  /\.attendance-withdrawn-row::after[\s\S]*?\.attendance-withdrawn-row::before|\.attendance-withdrawn-row::before[\s\S]*?\.attendance-withdrawn-row::after/i,
  "la baja debe tener doble trazo visual, no un simple tachado"
);

console.log("attendance admin UX tests passed");
