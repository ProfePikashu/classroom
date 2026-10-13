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


test("El compositor permite administrar botones adicionales", () => {
  assert.match(
    html,
    /id="notificationMailActions"/
  );

  assert.match(
    html,
    /id="notificationMailActionAdd"/
  );

  assert.match(
    html,
    /Agregar botón/
  );
});


test("El draft incluye actions sin eliminar cta y link legacy", () => {
  const start = js.indexOf("function getMailDraft()");

  assert.notEqual(
    start,
    -1,
    "No se encontró getMailDraft()"
  );

  const end = js.indexOf(
    "function getMailSummary()",
    start
  );

  assert.notEqual(
    end,
    -1,
    "No se encontró el final de getMailDraft()"
  );

  const draft = js.slice(start, end);

  assert.match(
    draft,
    /\bactions\s*:/
  );

  // Compatibilidad con comunicaciones anteriores.
  assert.match(
    draft,
    /\bcta\s*:/
  );

  assert.match(
    draft,
    /\blink\s*:/
  );
});


test("El Centro tiene lógica para agregar y quitar acciones", () => {
  assert.match(
    js,
    /notificationMailActionAdd/
  );

  assert.match(
    js,
    /notificationMailActions/
  );

  assert.match(
    js,
    /data-mail-action-remove/
  );

  assert.match(
    js,
    /data-mail-action-label/
  );

  assert.match(
    js,
    /data-mail-action-url/
  );
});


test("El correo acepta varios destinos útiles", () => {
  assert.match(
    js,
    /https?:\/\//
  );

  assert.match(
    js,
    /mailto:/
  );
});


test("Los cambios mantienen UTF-8 limpio", () => {
  const htmlPath = path.join(
    root,
    "frontend",
    "centro-notificaciones.html"
  );

  const jsPath = path.join(
    root,
    "frontend",
    "js",
    "centro-notificaciones.js"
  );

  const decoder = new TextDecoder(
    "utf-8",
    { fatal: true }
  );

  assert.doesNotThrow(
    () => decoder.decode(fs.readFileSync(htmlPath))
  );

  assert.doesNotThrow(
    () => decoder.decode(fs.readFileSync(jsPath))
  );

  const mojibake =
    /\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2\u20AC/;

  assert.doesNotMatch(html, mojibake);
  assert.doesNotMatch(js, mojibake);
});
test("La vista previa incluye y renderiza los botones adicionales", () => {
  const previewStart = js.indexOf("function getPreviewData()");

  assert.notEqual(
    previewStart,
    -1,
    "No se encontró getPreviewData()"
  );

  const previewEnd = js.indexOf(
    "function renderMailHtml(data)",
    previewStart
  );

  assert.notEqual(
    previewEnd,
    -1,
    "No se encontró renderMailHtml(data)"
  );

  const previewData = js.slice(
    previewStart,
    previewEnd
  );

  assert.match(
    previewData,
    /\bactions\s*:/
  );

  const renderStart = previewEnd;

  const renderEnd = js.indexOf(
    "function renderPreview()",
    renderStart
  );

  assert.notEqual(
    renderEnd,
    -1,
    "No se encontró renderPreview()"
  );

  const renderer = js.slice(
    renderStart,
    renderEnd
  );

  assert.match(
    renderer,
    /data\.actions/
  );
});
