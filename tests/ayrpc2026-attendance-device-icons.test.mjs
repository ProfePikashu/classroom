import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

const read = path => fs.readFileSync(path, "utf8");
const context = vm.createContext({
  document: { addEventListener() {} },
  window: {},
  console,
});
vm.runInContext(read("frontend/js/asistencias.js"), context);
const admin = vm.runInContext("AdminAsistencias", context);

test("device emojis sit beside colored attendance time", () => {
  const cell = admin.renderAttendanceTime(
    "ayrpc-2026", "-", 7600, 80, "smart_tv", ["mobile", "pc"]
  );
  assert.match(cell, /var\(--green\)/);
  assert.match(cell, /2h 06m 40s/);
  assert.match(cell, /📺📱💻/);
  assert.match(cell, /aria-label="Dispositivos declarados: Televisor \/ Smart TV \+ Celular \+ PC o notebook"/);
  assert.ok(cell.indexOf("</strong>") < cell.indexOf("📺"), "device emoji must not inherit time color");
});

test("legacy TV+mobile values and duplicate devices normalize safely", () => {
  const cell = admin.renderAttendanceTime(
    "ayrpc-2026", "-", 100, 50, "tv_mobile_chat", ["mobile", "pc"]
  );
  assert.match(cell, /📺📱💻/);
  assert.equal((cell.match(/📱/g) || []).length, 1);
  assert.match(cell, /var\(--red\)/);
});

test("missing or private device selection shows no icon and old course stays unchanged", () => {
  const empty = admin.renderAttendanceTime("ayrpc-2026", "-", 0, 0, null, []);
  const privateChoice = admin.renderAttendanceTime("ayrpc-2026", "-", 0, 0, "prefer_not_say", ["pc"]);
  const legacy = admin.renderAttendanceTime("ayrpc-2025", "2:00", 7200, 100, "smart_tv", []);
  assert.doesNotMatch(empty, /attendance-device-icons/);
  assert.doesNotMatch(privateChoice, /attendance-device-icons/);
  assert.equal(legacy, "2:00");
});

test("malformed extra devices cannot inject markup", () => {
  const cell = admin.renderAttendanceTime("ayrpc-2026", "-", 0, 0, "pc", ["<img src=x>", "__proto__", "pc"]);
  assert.match(cell, /💻/);
  assert.doesNotMatch(cell, /<img/);
});

test("filtered attendance table retains registered device fields", () => {
  vm.runInContext(read("frontend/js/asistencias-class-filter.js"), context);
  admin.clases = [{ n: 3, label: "Clase 3" }];
  const row = admin.normalizeApiRow({
    classes: [{
      class_number: 3,
      status: "PRESENTE",
      live_presence_seconds: 0,
      live_presence_percent: 0,
      viewing_device: "smart_tv",
      secondary_devices: ["mobile", "pc"],
    }],
    enrollment_status: "active",
    attendance_valid_classes: 1,
  });
  assert.equal(row.clases[0][4], "smart_tv");
  assert.deepEqual(Array.from(row.clases[0][5]), ["mobile", "pc"]);
  assert.equal(row.clases[0][0], "PRESENTE");
});

test("student can specify multiple devices without entering chat", () => {
  const html = read("frontend/clases-ayrpc-2026.html");
  const js = read("frontend/js/clases-ayrpc-2026.js");
  const deviceIndex = html.indexOf('id="liveAttendanceDevice"');
  const tokenIndex = html.indexOf('id="liveAttendanceCode"');
  assert.ok(deviceIndex >= 0 && tokenIndex > deviceIndex);
  assert.match(html, /attendance_secondary_device/g);
  assert.match(html, /value="smart_tv"/);
  assert.doesNotMatch(html, /name="attendance_secondary_device"[^>]*required/);
  assert.match(js, /secondary_devices:\s*Array\.from/);
  assert.match(html, /No necesitás escribir en Twitch/);
});
