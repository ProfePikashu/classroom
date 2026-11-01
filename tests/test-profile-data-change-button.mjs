import fs from "node:fs";
import assert from "node:assert/strict";

const profile = fs.readFileSync("frontend/js/perfil.js", "utf8");
const api = fs.readFileSync("frontend/js/profile-data-change-requests-api.js", "utf8");

assert.doesNotMatch(
  profile,
  /andyazh-classroom-data-change-requests-v1/,
  "perfil.js must not keep the legacy localStorage data-change implementation"
);

assert.match(profile, /profileChangeRequestTopButton/);
assert.match(
  profile,
  /if \(button\.dataset\.placementV2Bound !== ["']true["']\)/,
  "top button must guard against duplicate click listeners"
);
assert.match(profile, /button\.dataset\.placementV2Bound = ["']true["']/);

assert.match(api, /\/api\/classroom\/me\/data-change-requests/);
assert.match(api, /profileChangeRequestToggle/);

console.log("profile data change button contract: ok");
