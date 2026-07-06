/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — gestion.js
════════════════════════════════════════════════════════ */

"use strict";

const ClassroomGestion = {
  init() {
    this.bindButtons();
    this.ensureLinkedInRecommendationPanel();
    this.restoreLinkedInRecommendationPanel();
  },

  getSession() {
    if (typeof ClassroomAuth === "undefined") return null;
    return ClassroomAuth.getSession();
  },

  getDni() {
    const session = this.getSession();
    return session?.dni || "";
  },

  getApiBase() {
    const configured =
      window.CLASSROOM_API_BASE ||
      window.EXAMPRO_API_BASE ||
      localStorage.getItem("andyazh-api-base") ||
      "";

    if (configured) {
      return String(configured).replace(/\/+$/, "");
    }

    const host = window.location.hostname;

    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:8000";
    }

    return "https://api.andyazhtec.com";
  },

  getClassroomToken() {
    const session = this.getSession();

    return (
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      session?.exampro?.access_token ||
      session?.accessToken ||
      session?.access_token ||
      session?.token ||
      ""
    );
  },

  getAuthHeaders() {
    const token = this.getClassroomToken();

    if (!token) {
      throw new Error("No se encontr? token de sesi?n Classroom.");
    }

    return {
      Authorization: `Bearer ${token}`,
    };
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
      const response = await fetch(`${this.getApiBase()}/api/classroom/me/documents/certificate?course=ayrpc-2025`, {
        cache: "no-store",
        headers: this.getAuthHeaders(),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        const message = data?.detail || data?.error || "No se pudo generar el certificado.";
        if (certTab && !certTab.closed) certTab.close();
        alert("Error: " + message);
        return;
      }

      if (data.url) {
        this.markLinkedInRecommendationReady(dni, data.url);
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


  getLinkedInStorageKey(dni) {
    return `andyazh-linkedin-recommendation-ready-${dni || "unknown"}-ayrpc2025`;
  },

  ensureLinkedInRecommendationPanel() {
    if (document.getElementById("linkedinRecommendationPanel")) return;

    const btnCertificado = document.getElementById("btnGestionCertificado");
    const host =
      btnCertificado?.closest(".gestion-card, .glass-card, article, section, div") ||
      document.querySelector(".main-content") ||
      document.querySelector("main") ||
      document.body;

    const panel = document.createElement("section");
    panel.id = "linkedinRecommendationPanel";
    panel.className = "linkedin-recommendation-panel";
    panel.hidden = true;

    panel.innerHTML = `
      <div class="linkedin-recommendation-head">
        <div class="linkedin-recommendation-icon">
          <i class="fa-brands fa-linkedin-in"></i>
        </div>

        <div>
          <h3>Recomendación en LinkedIn</h3>
          <p>
            Ya podés pedirle al profe una recomendación profesional.
            Antes, agregá el curso a tu perfil y conectá con Arturo en LinkedIn.
          </p>
        </div>
      </div>

      <ol class="linkedin-recommendation-steps">
        <li>
          <strong>Agregá el curso a tu perfil</strong>
          <span>Sumá “Armado y Reparación de Computadoras — AyRPC 2025” en tu formación, cursos o licencias/certificaciones.</span>
        </li>

        <li>
          <strong>Agregá habilidades aprendidas</strong>
          <span>Hardware, diagnóstico de PC, armado de computadoras, sistemas operativos, BIOS/UEFI, mantenimiento preventivo y seguridad informática básica.</span>
        </li>

        <li>
          <strong>Conectá con el profe</strong>
          <span>Entrá al perfil de Arturo y enviá solicitud de conexión si todavía no están conectados.</span>
        </li>

        <li>
          <strong>Pedí la recomendación</strong>
          <span>Copiá el mensaje sugerido y mandalo por LinkedIn cuando ya tengas el curso cargado.</span>
        </li>
      </ol>

      <div class="linkedin-recommendation-actions">
        <a class="btn btn-primary" href="https://www.linkedin.com/in/arturoandrescoria/" target="_blank" rel="noopener noreferrer">
          <i class="fa-brands fa-linkedin"></i>
          Abrir LinkedIn del profe
        </a>

        <button class="btn btn-ghost" type="button" id="btnCopyLinkedinSkills">
          <i class="fa-solid fa-copy"></i>
          Copiar habilidades
        </button>

        <button class="btn btn-ghost" type="button" id="btnCopyLinkedinMessage">
          <i class="fa-solid fa-message"></i>
          Copiar pedido
        </button>
      </div>

      <p class="linkedin-recommendation-note">
        Importante: la recomendación se pide después de aprobar el examen o recuperatorio y generar el certificado.
      </p>
    `;

    host.insertAdjacentElement("afterend", panel);

    document.getElementById("btnCopyLinkedinSkills")?.addEventListener("click", () => {
      this.copyToClipboard(
        "Hardware, diagnóstico de PC, armado de computadoras, sistemas operativos, BIOS/UEFI, mantenimiento preventivo, instalación de software, seguridad informática básica, solución de problemas técnicos.",
        "Habilidades copiadas."
      );
    });

    document.getElementById("btnCopyLinkedinMessage")?.addEventListener("click", () => {
      const session = this.getSession();
      const nombre =
        session?.nombre ||
        session?.alumno?.["Nombre Completo"] ||
        session?.student?.nombre ||
        "";

      const mensaje =
`Hola Arturo, ¿cómo estás?

Soy ${nombre || "alumno/a"} del curso Armado y Reparación de Computadoras — AyRPC 2025.

Ya aprobé el examen o recuperatorio, generé mi certificado y cargué el curso en mi perfil de LinkedIn con las habilidades aprendidas.

¿Podrías dejarme una recomendación profesional cuando tengas un momento?

Muchas gracias.`;

      this.copyToClipboard(mensaje, "Mensaje copiado.");
    });
  },

  restoreLinkedInRecommendationPanel() {
    const dni = this.getDni();
    if (!dni) return;

    const saved = localStorage.getItem(this.getLinkedInStorageKey(dni));
    if (!saved) return;

    this.showLinkedInRecommendationPanel();
  },

  markLinkedInRecommendationReady(dni, certificateUrl) {
    localStorage.setItem(
      this.getLinkedInStorageKey(dni),
      JSON.stringify({
        ready: true,
        certificateUrl,
        unlockedAt: new Date().toISOString(),
      })
    );

    this.showLinkedInRecommendationPanel();
  },

  showLinkedInRecommendationPanel() {
    const panel = document.getElementById("linkedinRecommendationPanel");
    if (!panel) return;

    panel.hidden = false;
    panel.classList.add("show");

    setTimeout(() => {
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 250);
  },

  async copyToClipboard(text, okMessage) {
    try {
      await navigator.clipboard.writeText(text);
      alert(okMessage || "Copiado.");
    } catch (error) {
      prompt("Copiá este texto:", text);
    }
  },

  generarConstancia() {
    const dni = this.getDni();

    if (!dni) {
      alert("No se encontr? el DNI del alumno en sesi?n.");
      return;
    }

    alert("La solicitud de constancia personalizada est? en preparaci?n. Pronto vas a poder pedirla desde Classroom para que el profe la revise y la genere con el formato correspondiente.");
  },

  async solicitarBaja() {
    const session = this.getSession();

    if (!session?.dni) {
      alert("No se encontr? una sesi?n v?lida.");
      return;
    }

    const confirmed = confirm("?Confirm?s que quer?s solicitar la baja del curso? El equipo docente revisar? el pedido antes de aplicarlo.");

    if (!confirmed) return;

    const reason = prompt("Opcional: indic? brevemente el motivo de la baja.", "") || "";

    try {
      const response = await fetch(`${this.getApiBase()}/api/classroom/me/withdrawal-request?course=ayrpc-2025`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          reason: reason.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        const message = data?.detail || data?.error || "No se pudo enviar la solicitud de baja.";
        alert("Error: " + message);
        return;
      }

      if (data.already_pending) {
        alert("Ya ten?s una solicitud de baja pendiente de revisi?n.");
        return;
      }

      alert("Solicitud de baja enviada correctamente. El equipo docente la revisar? antes de confirmar la baja.");
    } catch (error) {
      alert("No se pudo enviar la solicitud de baja.");
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomGestion.init();
});
