import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("frontend/perfil.html", "utf8");
const api = fs.readFileSync("frontend/js/profile-data-change-requests-api.js", "utf8");

assert.doesNotMatch(
  html,
  /<script[^>]+src=["']js\/perfil\.js(?:\?[^"']*)?["']/,
  "perfil.html must stop loading the legacy perfil.js bundle"
);
assert.match(html, /js\/perfil-core\.js/);
assert.match(html, /js\/profile-data-change-requests-api\.js/);
assert.match(html, /js\/profile-data-change-placement\.js/);

const corePath = "frontend/js/perfil-core.js";
const placementPath = "frontend/js/profile-data-change-placement.js";
assert.ok(fs.existsSync(corePath), "perfil-core.js must exist");
assert.ok(fs.existsSync(placementPath), "profile-data-change-placement.js must exist");

const core = fs.readFileSync(corePath, "utf8");
const placement = fs.readFileSync(placementPath, "utf8");

assert.doesNotMatch(core, /andyazh-classroom-data-change-requests-v1/);
assert.doesNotMatch(core, /localStorage\.getItem\(.*data-change/i);
assert.match(core, /ClassroomProfile\.init/);

assert.match(placement, /profileChangeRequestTopButton/);
assert.match(
  placement,
  /if \(button\.dataset\.placementV3Bound !== ["']true["']\)/,
  "top button must guard against duplicate click listeners"
);
assert.match(placement, /button\.dataset\.placementV3Bound = ["']true["']/);

assert.match(api, /\/api\/classroom\/me\/data-change-requests/);
assert.match(api, /profileChangeRequestToggle/);

const coreIndex = html.indexOf("js/perfil-core.js");
const apiIndex = html.indexOf("js/profile-data-change-requests-api.js");
const placementIndex = html.indexOf("js/profile-data-change-placement.js");
assert.ok(coreIndex >= 0 && coreIndex < apiIndex && apiIndex < placementIndex,
  "profile scripts must load core -> API -> placement");

console.log("profile data change button contract: ok");
