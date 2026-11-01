import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("frontend/alumnos.html", "utf8");
const modulePath = "frontend/js/alumnos-withdrawal-review.js";

assert.ok(fs.existsSync(modulePath), "withdrawal review module must exist");
const review = fs.readFileSync(modulePath, "utf8");

assert.match(html, /js\/alumnos-withdrawal-review\.js/);
const baseIndex = html.indexOf("js/alumnos-withdrawal-status.js");
const reviewIndex = html.indexOf("js/alumnos-withdrawal-review.js");
assert.ok(baseIndex >= 0 && reviewIndex > baseIndex, "review module must load after course-aware withdrawal status");

assert.match(review, /withdrawal-requests\/\$\{encodeURIComponent\(requestId\)\}\/reject/);
assert.match(review, /data-withdrawal-review-approve/);
assert.match(review, /data-withdrawal-review-reject/);
assert.match(review, /Aprobar baja/);
assert.match(review, /Rechazar/);
assert.match(review, /Aprobada/);
assert.match(review, /Rechazada/);
assert.match(review, /Pendiente/);
assert.match(review, /resolution_notes/);
assert.match(review, /mail/);
assert.match(review, /canWithdrawStudents/);

console.log("withdrawal review frontend contract: ok");
