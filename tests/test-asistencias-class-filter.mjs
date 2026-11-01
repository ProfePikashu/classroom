import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("frontend/asistencias.html", "utf8");
const js = fs.readFileSync("frontend/js/asistencias.js", "utf8");
const css = fs.readFileSync("frontend/css/asistencias-admin.css", "utf8");

assert.match(html, /id="attendanceClassSelect"/);
assert.match(html, /Todas las clases/);

assert.match(js, /attendanceClassSelect/);
assert.match(js, /params\.set\("class_number"/);
assert.match(js, /attendance_valid_classes/);
assert.match(js, /selectedClassNumber/);
assert.match(js, /Presentes/);
assert.match(js, /Pendientes/);
assert.match(js, /this\.totalClassCount/);
assert.match(js, /pointer:\s*coarse/);

assert.match(css, /pointer:\s*fine/);
assert.match(css, /attendance-table-scroll/);
assert.match(css, /cursor:\s*(auto|default)/);

console.log("attendance class filter frontend contract: ok");
