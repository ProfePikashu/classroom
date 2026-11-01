import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("frontend/js/alumnos-data-change-requests-api.js", "utf8");
const compact = fs.readFileSync("frontend/js/alumnos-compact-panels.js", "utf8");
const css = fs.readFileSync("frontend/css/alumnos-compact.css", "utf8");

assert.match(source, /solicitudes-baja-curso/);
assert.match(source, /\/api\/classroom\/admin\/data-change-requests/);
assert.match(source, /method:\s*["']PATCH["']/);
assert.doesNotMatch(source, /localStorage\.getItem/);

assert.match(compact, /students-admin-summary-stack/);
assert.match(compact, /appendChild\(withdrawalPanel\)/);
assert.match(compact, /appendChild\(dataChangePanel\)/);

assert.match(css, /\.students-admin-summary-stack\s*\{/);
assert.match(css, /grid-column:\s*2/);
assert.match(css, /grid-row:\s*1/);

assert.match(source, /adminDataChangeToggle/);
assert.match(source, /admin-data-change-body/);
assert.match(source, /classList\.toggle\(["']is-collapsed["']/);
assert.match(source, /setDataChangeCollapsed\(panel,\s*true\)/);
assert.match(css, /#solicitudes-cambios-datos\.is-collapsed\s+\.admin-data-change-body\s*\{[^}]*display:\s*none/s);
assert.match(css, /#solicitudes-cambios-datos\s*\{[^}]*--data-change-accent:\s*#facc15/s);
assert.match(css, /#solicitudes-cambios-datos\s*\{[^}]*border-color:\s*rgba\(250,\s*204,\s*21,/s);

console.log("alumnos data change request contract: ok");
