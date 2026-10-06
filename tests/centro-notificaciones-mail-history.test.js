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

test("Centro de notificaciones muestra y carga el historial de correo", () => {
  assert.match(html, /id="notificationMailHistory"/);
  assert.match(html, /id="notificationMailHistoryRefresh"/);
  assert.match(js, /\/api\/classroom\/notifications\/admin\/mail-logs/);
  assert.match(js, /attempt_no/);
  assert.match(js, /attempted_at/);
});


test("El envio principal habla de cola y no de envio SMTP inmediato", () => {
  assert.doesNotMatch(js, /Enviando \$\{expected\} correo/);
  assert.doesNotMatch(js, /uno o m\?s correos no fueron aceptados/);
  assert.match(js, /Encolando \$\{expected\} correo/);
  assert.match(js, /correos no pudieron ponerse en cola/);
  assert.doesNotMatch(js, /Guardada \?/);
  assert.doesNotMatch(js, /"S\?"/);
});


test("El historial de correo tiene autenticacion y helpers propios", () => {
  const start = js.indexOf("(function initNotificationMailHistory()");
  assert.notEqual(start, -1);

  const history = js.slice(start);

  assert.doesNotMatch(history, /localStorage\.getItem\("classroom_token"\)/);
  assert.doesNotMatch(history, /sessionStorage\.getItem\("classroom_token"\)/);

  assert.match(history, /window\.ClassroomAuth/);
  assert.match(history, /andyazh-classroom-session/);
  assert.match(history, /function getHistoryToken/);
  assert.match(history, /function getHistoryApiBase/);
  assert.match(history, /function historyBackendError/);
});


test("El historial muestra explicitamente errores de cuota del proveedor", () => {
  const start = js.indexOf("(function initNotificationMailHistory()");
  assert.notEqual(start, -1);

  const history = js.slice(start);

  assert.match(history, /item\?\.error_type/);
  assert.match(
    history,
    /statusLabel\(item\?\.error_type \|\| item\?\.status\)/
  );
});


test("Los archivos del centro usan UTF-8 sin BOM ni mojibake conocido", () => {
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

  const htmlBytes = fs.readFileSync(htmlPath);
  const jsBytes = fs.readFileSync(jsPath);

  const bom = Buffer.from([0xef, 0xbb, 0xbf]);

  assert.equal(
    htmlBytes.subarray(0, 3).equals(bom),
    false
  );

  assert.equal(
    jsBytes.subarray(0, 3).equals(bom),
    false
  );

  const decoder = new TextDecoder(
    "utf-8",
    { fatal: true }
  );

  assert.doesNotThrow(() => decoder.decode(htmlBytes));
  assert.doesNotThrow(() => decoder.decode(jsBytes));

  const mojibake = /\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2\u20AC/;

  assert.doesNotMatch(html, mojibake);
  assert.doesNotMatch(js, mojibake);
});
