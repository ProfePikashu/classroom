import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("frontend/js/alumnos-data-change-requests-api.js", "utf8");

assert.match(source, /solicitudes-baja-curso/);
assert.match(source, /insertAdjacentElement\(["']afterend["'],\s*panel\)/);
assert.match(source, /\/api\/classroom\/admin\/data-change-requests/);
assert.match(source, /method:\s*["']PATCH["']/);
assert.doesNotMatch(source, /localStorage\.getItem/);

console.log("alumnos data change request contract: ok");
