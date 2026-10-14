const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(
  path.join(root, "frontend", "centro-notificaciones.html"),
  "utf8"
);
const js = fs.readFileSync(
  path.join(root, "frontend", "js", "centro-notificaciones.js"),
  "utf8"
);

test("el centro ofrece una audiencia explicita para dados de baja", () => {
  assert.match(html, /value="withdrawn"/);
  assert.match(html, />Dados de baja</);
});

test("la audiencia de bajas se envia al backend sin convertirse en curso", () => {
  const start = js.indexOf("function normalizeAudience(value)");
  assert.notEqual(start, -1, "No se encontro normalizeAudience(value)");

  const end = js.indexOf("function", start + 20);
  const normalizeBlock = js.slice(start, end === -1 ? start + 1200 : end);

  assert.match(normalizeBlock, /withdrawn/);
  assert.match(normalizeBlock, /audience_type:\s*raw/);
});

test("la interfaz etiqueta claramente la audiencia de bajas", () => {
  assert.match(js, /Dados de baja/);
});
