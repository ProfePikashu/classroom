import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("frontend/js/profile-data-change-requests-api.js", "utf8");

assert.match(source, /\/api\/classroom\/me\/data-change-requests/);
assert.match(source, /method:\s*["']POST["']/);
assert.doesNotMatch(source, /localStorage\.setItem/);
assert.match(source, /Solicitud enviada/);

console.log("profile data change request contract: ok");
