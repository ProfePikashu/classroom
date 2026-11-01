import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const mainPath = "frontend/js/clases-ayrpc-2026.js";
const stabilityPath = "frontend/js/attendance-token-stability.js";
const htmlPath = "frontend/clases-ayrpc-2026.html";

const read = path => fs.readFileSync(path, "utf8");

// Regression contract for the live-attendance incident from 2026-10-31.
test("keeps the proven attendance polling mitigation", () => {
  const source = read(mainPath);

  assert.match(source, /ATTENDANCE_POLL_OPEN_MS\s*=\s*60000/);
  assert.match(source, /ATTENDANCE_POLL_CLOSED_MS\s*=\s*120000/);
  assert.match(source, /ATTENDANCE_POLL_JITTER_MS\s*=\s*15000/);
  assert.match(source, /Math\.random\(\)\s*\*\s*ATTENDANCE_POLL_JITTER_MS/);
});


test("loads token stability after the main classroom attendance script", () => {
  const html = read(htmlPath);
  const mainIndex = html.indexOf("js/clases-ayrpc-2026.js");
  const stabilityIndex = html.indexOf("js/attendance-token-stability.js");

  assert.ok(mainIndex >= 0, "main attendance script must exist");
  assert.ok(stabilityIndex > mainIndex, "stability layer must load after main attendance script");
});


test("restores the active staff code returned by backend into existing storage contract", () => {
  const source = read(stabilityPath);

  assert.match(source, /active_token_code/);
  assert.match(source, /active_token_expires_at/);
  assert.match(source, /response\.clone\(\)/);
  assert.match(source, /ayrpc2026\.attendance-code\./);
  assert.match(source, /sessionStorage\.setItem/);
});


test("guards staff token generation and student check-in against duplicate concurrent submissions", () => {
  const source = read(stabilityPath);

  assert.match(source, /staffGenerateAttendanceCode/);
  assert.match(source, /liveAttendanceForm/);
  assert.match(source, /liveAttendanceSubmit/);
  assert.match(source, /capture:\s*true/);
  assert.match(source, /tokenRequestInFlight/);
  assert.match(source, /checkinRequestInFlight/);
});


test("lets the first staff click reach the original handler before disabling the button", () => {
  const source = read(stabilityPath);

  assert.match(source, /deferDisable/);
  assert.match(source, /queueMicrotask/);
});
