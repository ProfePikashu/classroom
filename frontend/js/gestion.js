/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — gestion.js
════════════════════════════════════════════════════════ */

"use strict";

const GESTION_API_CONSTANCIA = "https://script.google.com/macros/s/AKfycbwwMlT9cIOV3Nm057_XPfHT-tXaeKYv6cHZS4yMbtj5gd4q6NZZELCaMDRCb0YUD8v_hg/exec";
const GESTION_API_CERTIFICADO = "https://script.google.com/macros/s/AKfycbyglMr8TlH5BjsCfg57wmsSVhUqIwrSveAh6FH1fxIOJUgX4e35Jc5nuJ9Cl261rZ9dkQ/exec";
const GESTION_API_BAJA = "{ASIGNAR_ENDPOINT_BAJA}";

const ClassroomGestion = {
  init() {
    this.bindButtons();
  },

  getSession() {
    if (typeof ClassroomAuth === "undefined") return null;
    return ClassroomAuth.getSession();
  },

  getDni() {
    const session = this.getSession();
    return session?.dni || "";
  },

  bindButtons() {
    const btnCertificado = document.getElementById("btnGestionCertificado");
    const btnConstancia = document.getElementById("btnGestionConstancia");
    const btnBaja = document.getElementById("btnGestionBaja");

    if (btnCertificado) {
      btnCertificado.addEventListener("click", () => this.generarCertificado(btnCertificado));
    }

    if (btnConstancia) {
      btnConstancia.addEventListener("click", () => this.generarConstancia());
    }

    if (btnBaja) {
      btnBaja.addEventListener("click", () => this.solicitarBaja());
    }
  },

  async generarCertificado(button) {
    const dni = this.getDni();

    if (!dni) {
      alert("No se encontró el DNI del alumno en sesión.");
      return;
    }

    const originalHtml = button.innerHTML;

    // Abrimos la pestaña en el click del usuario para evitar bloqueo de popups.
    const certTab = window.open("about:blank", "_blank");

    if (certTab) {
      certTab.document.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Generando certificado...</title>
            <style>
              body {
                margin: 0;
                min-height: 100vh;
                display: grid;
                place-items: center;
                background: #08051a;
                color: #eaf6ff;
                font-family: system-ui, Segoe UI, Arial;
              }

              .card {
                max-width: 420px;
                padding: 24px;
                border: 1px solid rgba(0,245,255,.28);
                border-radius: 18px;
                background: rgba(18,8,42,.92);
                box-shadow: 0 0 28px rgba(0,245,255,.12);
                text-align: center;
              }

              h1 {
                margin: 0 0 10px;
                font-size: 22px;
              }

              p {
                margin: 0;
                opacity: .8;
                line-height: 1.45;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Generando certificado...</h1>
              <p>Un momento, estamos preparando tu PDF.</p>
            </div>
          </body>
        </html>
      `);
      certTab.document.close();
    }

    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';

    try {
      const response = await fetch(GESTION_API_CERTIFICADO + "?dni=" + encodeURIComponent(dni));
      const data = await response.json();

      if (data.error) {
        if (certTab && !certTab.closed) certTab.close();
        alert("Error: " + data.error);
        return;
      }

      if (data.url) {
        if (certTab && !certTab.closed) {
          certTab.location.href = data.url;
        } else {
          window.location.href = data.url;
        }
      }
    } catch (error) {
      if (certTab && !certTab.closed) certTab.close();
      alert("No se pudo generar el certificado.");
    } finally {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  },

  generarConstancia() {
    const dni = this.getDni();

    if (!dni) {
      alert("No se encontró el DNI del alumno en sesión.");
      return;
    }

    window.open(`${GESTION_API_CONSTANCIA}?action=constancia_pdf&dni=${encodeURIComponent(dni)}`, "_blank");
  },

  async solicitarBaja() {
    const session = this.getSession();

    if (!session?.dni) {
      alert("No se encontró una sesión válida.");
      return;
    }

    const confirmed = confirm("¿Confirmás que querés solicitar la baja del curso?");

    if (!confirmed) return;

    if (GESTION_API_BAJA.includes("{ASIGNAR")) {
      alert("Solicitud preparada. Falta conectar el endpoint de baja.");
      return;
    }

    try {
      const response = await fetch(GESTION_API_BAJA, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dni: session.dni,
          twitch: session.twitch,
          course: session.course || "AyRPC 2025",
          action: "request_course_withdrawal",
        }),
      });

      if (!response.ok) {
        alert("No se pudo enviar la solicitud.");
        return;
      }

      alert("Solicitud enviada correctamente.");
    } catch (error) {
      alert("No se pudo enviar la solicitud.");
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomGestion.init();
});

