/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — perfil.js
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomProfile = {
  init() {
    if (typeof ClassroomAuth === "undefined") return;

    const session = ClassroomAuth.getSession();

    if (!session) return;

    this.paint(session);
  },

  paint(session) {
    const alumno = session.alumno || {};

    this.setText("profileHeroName", alumno["Nombre Completo"] || session.displayName || "{ASIGNAR DATO}");
    this.setText("profileName", alumno["Nombre Completo"] || session.displayName || "{ASIGNAR DATO}");
    this.setText("profileDni", session.dni || alumno["DNI"] || "{ASIGNAR DATO}");
    this.setText("profileEmail", alumno["Correo"] || session.email || "{ASIGNAR DATO}");
    this.setText("profilePhone", alumno["Teléfono (con Código de Área)"] || "{ASIGNAR DATO}");
    this.setText("profileTwitch", session.twitch || alumno["Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)"] || "{ASIGNAR DATO}");
    this.setText("profileObservations", alumno["Observaciones"] || "{ASIGNAR DATO}");
    this.setText("profileApto", alumno["APTO"] || "{ASIGNAR DATO}");
    this.setText("profileResult", alumno["Resultado"] || "Pendiente / Sin cargar");
    this.setText("profileRole", session.roleLabel || "Alumno");
  },

  setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomProfile.init();
});
