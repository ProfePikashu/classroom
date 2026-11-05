import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const html = fs.readFileSync("frontend/clases-ayrpc-2026.html", "utf8");
const source = fs.readFileSync("frontend/js/clases-ayrpc-2026.js", "utf8");

test("optional device selector appears before the six-character code", () => {
  const selector = html.indexOf('id="liveAttendanceDevice"');
  const token = html.indexOf('id="liveAttendanceCode"');
  assert.ok(selector >= 0 && selector < token);
  // Combinaciones con el selector principal y adicionales opcionales.
  assert.match(html, /name="attendance_secondary_device"/);
  assert.match(html, /value="smart_tv"/);
  assert.match(html, /value="other"/);
  assert.doesNotMatch(html, /id="liveAttendanceDevice"[^>]*required/);
});

test("device selected is submitted without replacing token validation", () => {
  assert.match(source, /viewing_device:\s*\$\("liveAttendanceDevice"\)\?\.value \|\| null/);
  assert.match(source, /course_slug:\s*"ayrpc-2026"/);
  assert.match(source, /class_number:\s*state\.selected\.number/);
  assert.match(source, /code,/);
});

test("no Twitch chat participation is required in the form", () => {
  assert.match(html, /No necesitás escribir en Twitch/);
  assert.match(html, /Es opcional/);
});
