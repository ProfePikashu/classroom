/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — home.js
   Datos del alumno en Inicio
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomHome = {
  init() {
    if (typeof ClassroomAuth === "undefined") return;

    const session = ClassroomAuth.getSession();

    if (!session) return;

    this.paintStudent(session);
  },

  paintStudent(session) {
    const alumno = session.alumno || {};

    this.setText("homeStudentName", alumno["Nombre Completo"] || session.displayName || "{ASIGNAR DATO}");
    this.setText("homeStudentTwitch", session.twitch || "{ASIGNAR DATO}");
    this.setText("homeStudentApto", alumno["APTO"] || "{ASIGNAR DATO}");
    this.setText("homeStudentResult", alumno["Resultado"] || "Pendiente / Sin cargar");
  },

  setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomHome.init();
});
