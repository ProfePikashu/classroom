"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ux = fs.readFileSync(
  path.join(__dirname, "../frontend/js/ayrpc2026-recovery-ux.js"), "utf8"
);
const html = fs.readFileSync(
  path.join(__dirname, "../frontend/clases-ayrpc-2026.html"), "utf8"
);

assert.doesNotMatch(
  ux, /ENABLED_CLASS_NUMBERS|new Set\(\[1, 2\]\)/,
  "La UX no puede depender de un catálogo manual de clases"
);
assert.match(
  ux,
  /#watchValidationStatus\[hidden\], #retryWatchValidation\[hidden\], #resumeRecoveryButton\[hidden\] \{ display:none !important; \}/,
  "Las tarjetas y botones ocultos no deben aparecer vacíos por CSS"
);
assert.match(
  html, /ayrpc2026-recovery-ux\.js\?v=20261109-recovery-ux-dynamic-v1/,
  "El HTML debe invalidar la caché de la UX anterior en celulares"
);

function createFakeResponse(payload, ok = true) {
  return {
    ok,
    clone() { return this; },
    async json() { return payload; },
  };
}

function createBrowserSimulator() {
  const box = { id: "watchValidationStatus", hidden: true, className: "watch-validation-status waiting" };
  const message = { id: "watchValidationMessage", textContent: "" };
  const retry = { id: "retryWatchValidation", hidden: true };
  const resume = { id: "resumeRecoveryButton", hidden: true };
  const ids = new Map([
    [box.id, box],
    [message.id, message],
    [retry.id, retry],
    [resume.id, resume],
  ]);
  const server = { payload: null, ok: true };
  let refreshCount = 0;

  const document = {
    getElementById: id => ids.get(id) || null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
  };
  const window = {
    location: { href: "https://classroom.andyazhtec.com/clases-ayrpc-2026.html" },
    setInterval: () => 1,
    fetch: async () => {
      refreshCount += 1;
      return createFakeResponse(server.payload, server.ok);
    },
  };
  vm.runInNewContext(ux, { window, document, URL, console, Date, screen: {} }, {
    filename: "ayrpc2026-recovery-ux.js",
  });

  return {
    box,
    message,
    retry,
    server,
    window,
    count: () => refreshCount,
    async request(url, method = "GET") {
      await window.fetch(url, { method });
      // El observador procesa una copia de la respuesta en otra microtarea.
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}

function statusUrl(classNumber) {
  return "/api/classroom/courses/ayrpc-2026/classes/" + classNumber + "/recovery";
}

(async () => {
  for (const classNumber of [1, 2, 3, 4, 12]) {
    const browser = createBrowserSimulator();
    browser.server.payload = {
      ok: true, class_number: classNumber, eligible: true,
      preview_mode: false, required_watch_seconds: 10320,
      video_watch_seconds: 0,
    };
    await browser.request(statusUrl(classNumber));

    assert.equal(
      browser.box.hidden, false,
      "La clase " + classNumber + " debe mostrar estado cuando el servidor la habilita"
    );
    assert.match(
      browser.message.textContent, /Validación lista/,
      "La clase " + classNumber + " debe mostrar el mensaje inicial"
    );

    browser.server.payload = {
      ok: true, credited_seconds: 30, watched_seconds: 30,
    };
    await browser.request(statusUrl(classNumber) + "/watch", "POST");
    assert.match(
      browser.message.textContent, /Validación activa/,
      "La clase " + classNumber + " debe confirmar el tiempo de backend"
    );
    assert.equal(browser.retry.hidden, true, "No debe ofrecer reintento sin error");
  }

  const denied = createBrowserSimulator();
  denied.server.payload = { ok: false, class_number: 3, eligible: true };
  denied.server.ok = false;
  await denied.request(statusUrl(3));
  assert.equal(denied.box.hidden, true, "Un backend que rechaza la clase no debe activar la UX");

  const ineligible = createBrowserSimulator();
  ineligible.server.payload = {
    ok: true, class_number: 3, eligible: false,
    preview_mode: false, required_watch_seconds: 10320,
  };
  await ineligible.request(statusUrl(3));
  assert.equal(ineligible.box.hidden, true, "Un alumno no elegible no debe ver estado de seguimiento");

  const unrelated = createBrowserSimulator();
  unrelated.server.payload = {
    ok: true, class_number: 3, eligible: true,
    preview_mode: false, required_watch_seconds: 10320,
  };
  await unrelated.request("/api/classroom/courses/otro-curso/classes/3/recovery");
  assert.equal(unrelated.box.hidden, true, "La UX AyRPC no debe activarse por otro curso");

  console.log("AyRPC 2026 recovery UX dynamic class and server-ack tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
