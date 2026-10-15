"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");

const auth = fs.readFileSync(
  "frontend/js/auth.js",
  "utf8"
);

const notifications = fs.readFileSync(
  "frontend/js/notifications-local.js",
  "utf8"
);

assert.match(
  auth,
  /credentials:\s*"include"/,
  "El login debe incluir cookies cross-origin"
);

assert.doesNotMatch(
  notifications,
  /notifications\/ws\?token=/,
  "El WebSocket no debe llevar JWT en la URL"
);

assert.doesNotMatch(
  notifications,
  /getWsUrl\(token\)/,
  "La URL del WebSocket ya no debe depender del token"
);

console.log("websocket token security frontend tests passed");
