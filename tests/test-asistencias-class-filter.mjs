import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("frontend/asistencias.html", "utf8");
const modulePath = "frontend/js/asistencias-class-filter.js";
const cssPath = "frontend/css/asistencias-class-filter.css";

assert.ok(fs.existsSync(modulePath), "attendance class filter module must exist");
assert.ok(fs.existsSync(cssPath), "attendance class filter css must exist");

const js = fs.readFileSync(modulePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

assert.match(html, /id="attendanceClassSelect"/);
assert.match(html, /Todas las clases/);
assert.match(html, /css\/asistencias-class-filter\.css/);
assert.match(html, /js\/asistencias-class-filter\.js/);

const baseIndex = html.indexOf("js/asistencias.js");
const extensionIndex = html.indexOf("js/asistencias-class-filter.js");
assert.ok(baseIndex >= 0 && extensionIndex > baseIndex, "extension must load after base attendance script");

assert.match(js, /attendanceClassSelect/);
assert.match(js, /params\.set\("class_number"/);
assert.match(js, /attendance_valid_classes/);
assert.match(js, /selectedClassNumber/);
assert.match(js, /Presentes/);
assert.match(js, /Pendientes/);
assert.match(js, /this\.totalClassCount/);
assert.match(js, /pointer:\s*coarse/);
assert.match(js, /PENDIENTE/);

assert.match(css, /pointer:\s*fine/);
assert.match(css, /attendance-table-scroll/);
assert.match(css, /cursor:\s*(auto|default)/);

console.log("attendance class filter frontend contract: ok");
