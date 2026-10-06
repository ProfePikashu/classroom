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

test("El historial de correo vive solo dentro del modal amarillo", () => {
  assert.doesNotMatch(html, /id="notificationMailHistory"/);
  assert.doesNotMatch(html, /id="notificationMailHistoryRefresh"/);
  assert.match(js, /id = "notificationBackendBadge"/);
  assert.match(js, /window\.ClassroomMailLogsModal/);
  assert.match(js, /classroomMailLogsContent/);
  assert.doesNotMatch(js, /function initNotificationMailHistory\(\)/);
  assert.match(js, /\/api\/classroom\/notifications\/admin\/mail-logs/);
});

test("El modal ordena historial e intentos por fecha descendente", () => {
  assert.match(js, /sortMailLogGroupsByNewest/);
  assert.match(js, /sortMailLogItemsByNewest/);
  assert.match(js, /attempted_at/);
  assert.match(js, /sent_at/);
});


test("El historial consolida los intentos en una fila por usuario", () => {
  assert.match(js, /groupMailLogItemsByRecipient/);
  assert.match(js, /uniqueMailLogSummary/);
  assert.match(js, /mailLogRecipientKey/);
  assert.match(js, /recipient_id/);
  assert.match(js, /attempts\.length/);
});



test("El envio principal habla de cola y no de envio SMTP inmediato", () => {
  assert.doesNotMatch(js, /Enviando \$\{expected\} correo/);
  assert.doesNotMatch(js, /uno o m\?s correos no fueron aceptados/);
  assert.match(js, /Encolando \$\{expected\} correo/);
  assert.match(js, /correos no pudieron ponerse en cola/);
  assert.doesNotMatch(js, /Guardada \?/);
  assert.doesNotMatch(js, /"S\?"/);
});


test("El modal de historial usa el bridge autenticado del backend", () => {
  const start = js.indexOf("(function initClassroomMailLogsModal()");
  assert.notEqual(start, -1);

  const history = js.slice(start);

  assert.match(history, /window\.ClassroomBackendNotifications/);
  assert.match(history, /ensureBackendToken/);
  assert.match(history, /getApiBase/);
  assert.match(history, /Authorization/);
});



test("El modal muestra explicitamente errores del proveedor", () => {
  const start = js.indexOf("(function initClassroomMailLogsModal()");
  assert.notEqual(start, -1);

  const history = js.slice(start);

  assert.match(history, /item\.error_type \|\| item\.status/);
  assert.match(history, /provider_quota/);
  assert.match(history, /provider_rate_limit/);
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
