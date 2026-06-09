/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — verificador-ayrpc-2025.js
════════════════════════════════════════════════════════ */

"use strict";

const API = "https://script.google.com/macros/s/AKfycbxdB1fbiT1S04N5LaiOqHCojJcO12YCOPg7ln21bFrMrEot5GSdyWzy6j6CyEAsuDen/exec";
const API_CONSTANCIA = "https://script.google.com/macros/s/AKfycbwwMlT9cIOV3Nm057_XPfHT-tXaeKYv6cHZS4yMbtj5gd4q6NZZELCaMDRCb0YUD8v_hg/exec";
const API_CERTIFICADO = "https://script.google.com/macros/s/AKfycbyeFYWpfUel-6aWGBgfCmXOS7-KaDGBkZe5bkfxZRkyjgw9jezNJEJ68pmO4FAhoQ3o/exec";

const LINKEDIN_RECOMENDACION_URL = "https://www.linkedin.com/in/arturoandrescoria/";
const RECUPERATORIO_URL = "https://bit.ly/RecuperatorioAyRPC2025";

const ORDEN = [
  { n: "Primera Clase", k: "1er" },
  { n: "Segunda Clase", k: "2da" },
  { n: "Tercera Clase", k: "3er" },
  { n: "Cuarta Clase", k: "4ta" },
  { n: "Quinta Clase", k: "5ta" },
  { n: "Sexta Clase", k: "6ta" },
  { n: "Última Clase", k: "Ultima" },
];

const CFG = {
  "1er": { total: 11400, min: 8550 },
  "2da": { total: 6800, min: 5100 },
  "3er": { total: 7600, min: 5700 },
  "4ta": { total: 7600, min: 5700 },
  "5ta": { total: 10080, min: 7560 },
  "6ta": { total: 8940, min: 6705 },
  "Ultima": { total: 7980, min: 5985 },
};

const TOTAL_EVALUADAS = 7;

const VerificadorAyRPC = {
  init() {
    this.cacheDom();
    this.bindEvents();
    this.autofillFromSession();
    this.autoLoadFromSession();
  },

  cacheDom() {
    this.login = document.getElementById("login");
    this.contenido = document.getElementById("contenido");
    this.btnVolver = document.getElementById("btnVolver");
    this.debug = document.getElementById("debug");

    this.nombre = document.getElementById("nombre");
    this.dCorreo = document.getElementById("d-correo");
    this.dTelefono = document.getElementById("d-telefono");
    this.dTwitch = document.getElementById("d-twitch");
    this.dObs = document.getElementById("d-obs");

    this.tablaClases = document.getElementById("tablaClases");
    this.graficos = document.getElementById("graficos");

    this.kAsistencia = document.getElementById("k-asistencia");
    this.kPorcentaje = document.getElementById("k-porcentaje");
    this.kEstado = document.getElementById("k-estado");
    this.aptoValor = document.getElementById("aptoValor");
  },

  autofillFromSession() {
    if (typeof ClassroomAuth === "undefined") return;

    const session = ClassroomAuth.getSession();

    if (!session || !session.dni) return;

    const dniInput = document.getElementById("dniInput");

    if (dniInput) {
      dniInput.value = session.dni;
    }
  },

  autoLoadFromSession() {
    if (typeof ClassroomAuth === "undefined") return;

    const session = ClassroomAuth.getSession();

    if (!session || !session.dni) return;

    const searchPanel = document.getElementById("login");
    const dniInput = document.getElementById("dniInput");

    if (dniInput) {
      dniInput.value = session.dni;
    }

    if (searchPanel) {
      searchPanel.style.display = "none";
    }

    this.cargar();
  },

  bindEvents() {
    const btnBuscar = document.getElementById("btnBuscar");

    if (btnBuscar) {
      btnBuscar.addEventListener("click", () => this.cargar());
    }

    const dniInput = document.getElementById("dniInput");

    if (dniInput) {
      dniInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") this.cargar();
      });
    }

    if (this.btnVolver) {
      this.btnVolver.addEventListener("click", () => this.volver());
    }
  },

  async cargar() {
    const dniInput = document.getElementById("dniInput");
    const dni = dniInput.value.trim();

    if (!dni) {
      alert("Ingresá un DNI");
      return;
    }

    document.getElementById("errorBox").style.display = "none";
    document.getElementById("loadingBox").style.display = "grid";
    this.contenido.style.display = "none";

    try {
      const response = await fetch(API + "?dni=" + encodeURIComponent(dni));
      const data = await response.json();

      if (data.estado === "BAJA") {
        this.showError("Alumno dado de baja", "Este alumno ya no forma parte del curso.");
        return;
      }

      document.getElementById("loadingBox").style.display = "none";

      if (!data || !data["Nombre Completo"]) {
        this.showError("Documento inválido", "Introduzca el mismo con el que se inscribió, sin puntos ni espacios.");
        return;
      }

      this.procesar(data);
    } catch (error) {
      this.showError("Error de consulta", "No se pudo consultar el estado académico.");
    }
  },

  showError(title, message) {
    document.getElementById("loadingBox").style.display = "none";

    const errorBox = document.getElementById("errorBox");
    errorBox.style.display = "grid";
    errorBox.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  },

  procesar(alumno) {
    this.login.style.display = "none";
    this.contenido.style.display = "grid";

    this.nombre.textContent = alumno["Nombre Completo"] || "-";
    this.dCorreo.textContent = alumno["Correo"] || "-";
    this.dTelefono.textContent = alumno["Teléfono (con Código de Área)"] || "-";
    this.dTwitch.textContent = alumno["Usuario de Twitch (en caso de no tener, deberá crear uno y usarlo en la cursada)"] || "-";
    this.dObs.textContent = alumno["Observaciones"] || "-";

    const apto = (alumno["APTO"] || "").toString().trim().toUpperCase();

    this.aptoValor.textContent = apto || "-";
    this.aptoValor.className = "apto-valor " + (apto === "SI" ? "apto-si" : "apto-no");

    const dniAlumno = (alumno["DNI"] || document.getElementById("dniInput").value || "").toString().trim();

    this.configurarResultado(alumno, apto, dniAlumno);
    this.configurarConstancia(apto, dniAlumno);
    this.renderClases(alumno);
  },

  configurarResultado(alumno, apto, dniAlumno) {
    const resultadoBox = document.getElementById("resultadoBox");
    const resultadoValor = document.getElementById("resultadoValor");
    const boxCert = document.getElementById("certificadoBox");
    const btnCert = document.getElementById("btnCertificado");
    const boxRecup = document.getElementById("recuperatorioBox");

    resultadoBox.style.display = "none";
    if (boxCert) boxCert.style.display = "none";
    if (boxRecup) boxRecup.style.display = "none";

    if (apto !== "SI") return;

    const resultado = (alumno["Resultado"] || "").toString().trim().toUpperCase();

    if (!resultado) return;

    resultadoBox.style.display = "block";
    resultadoValor.textContent = resultado;
    resultadoValor.className = "resultado-valor " + (
      resultado === "APROBADO" ? "resultado-ok" :
      resultado === "DESAPROBADO" ? "resultado-bad" :
      "resultado-neutral"
    );

    if ((resultado === "DESAPROBADO" || resultado === "SIN ENTREGA") && boxRecup) {
      boxRecup.style.display = "contents";
    }

    if (resultado === "APROBADO" && boxCert && btnCert) {
      boxCert.style.display = "contents";

      btnCert.onclick = async () => {
        if (!dniAlumno) return alert("No se encontró el DNI para generar el certificado.");

        const textoOriginal = btnCert.innerHTML;
        btnCert.innerHTML = "<span>⏳</span><strong>Generando...</strong>";
        btnCert.disabled = true;

        try {
          const response = await fetch(API_CERTIFICADO + "?dni=" + encodeURIComponent(dniAlumno));
          const data = await response.json();

          if (data.error) {
            alert("Error: " + data.error);
          } else if (data.url) {
            window.open(data.url, "_blank");
          }
        } catch (error) {
          alert("No se pudo generar el certificado. Intentá de nuevo.");
        } finally {
          btnCert.innerHTML = textoOriginal;
          btnCert.disabled = false;
        }
      };
    }
  },

  configurarConstancia(apto, dniAlumno) {
    const boxConst = document.getElementById("constanciaBox");
    const btnConst = document.getElementById("btnConstancia");

    if (!boxConst || !btnConst) return;

    boxConst.style.display = apto === "SI" ? "contents" : "none";

    btnConst.onclick = () => {
      if (!dniAlumno) return alert("No se encontró el DNI para generar la constancia.");

      window.open(`${API_CONSTANCIA}?action=constancia_pdf&dni=${encodeURIComponent(dniAlumno)}`, "_blank");
    };
  },

  renderClases(alumno) {
    this.tablaClases.innerHTML = "";
    this.graficos.innerHTML = "";

    let ok = 0;

    ORDEN.forEach((clase, index) => {
      const estado = (alumno[clase.k + "Clase – Presente"] || "-").toUpperCase();
      const tiempo = alumno[clase.k + "Clase – Tiempo"] || "-";

      let cls = "estado-neutral";
      if (estado === "PRESENTE" || estado === "RECUPERADA") cls = "estado-ok";
      if (estado === "AUSENTE") cls = "estado-bad";

      this.tablaClases.innerHTML += `
        <tr>
          <td>${clase.n}</td>
          <td class="${cls}">${estado}</td>
          <td>${tiempo}</td>
          <td>${index < TOTAL_EVALUADAS ? "Evaluada" : "Pendiente"}</td>
        </tr>
      `;

      if (index < TOTAL_EVALUADAS && (estado === "PRESENTE" || estado === "RECUPERADA")) {
        ok++;
      }

      if (CFG[clase.k]) {
        const div = document.createElement("div");
        this.graficos.appendChild(div);
        this.grafico(div, clase, tiempo);
      }
    });

    this.kAsistencia.textContent = ok + "/" + TOTAL_EVALUADAS;
    this.kPorcentaje.textContent = Math.round(ok / TOTAL_EVALUADAS * 100) + "%";

    const debe = TOTAL_EVALUADAS - ok;

    this.kEstado.textContent =
      debe === 0 ? "EXCELENTE" :
      debe === 1 ? "DEBE 1 CLASE" :
      "DEBE " + debe + " CLASES";

    this.kEstado.className = debe === 0 ? "estado-ok" : "estado-bad";
  },

  parseTiempo(tiempo) {
    if (!tiempo) return 0;

    const h = /(\d+)h/.exec(tiempo);
    const m = /(\d+)m/.exec(tiempo);
    const s = /(\d+)s/.exec(tiempo);

    return (h ? +h[1] : 0) * 3600 + (m ? +m[1] : 0) * 60 + (s ? +s[1] : 0);
  },

  grafico(element, clase, tiempo) {
    const segundos = this.parseTiempo(tiempo);
    const total = CFG[clase.k].total;
    const minimo = CFG[clase.k].min;

    const porcentaje = Math.max(0, Math.min(100, Math.round((segundos / total) * 100)));
    const color = segundos >= minimo ? "#22c55e" : "#ef4444";

    element.innerHTML = "";

    const plotWrap = document.createElement("div");
    plotWrap.className = "plotWrap";
    element.appendChild(plotWrap);

    Plotly.newPlot(plotWrap, [{
      type: "pie",
      hole: 0.72,
      values: [segundos, Math.max(total - segundos, 0)],
      textinfo: "none",
      marker: {
        colors: [color, "rgba(148, 163, 184, 0.18)"],
      },
      sort: false,
      direction: "clockwise",
      hoverinfo: "skip",
    }], {
      margin: { t: 0, b: 0, l: 0, r: 0 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      showlegend: false,
      annotations: [{
        text: porcentaje + "%",
        showarrow: false,
        x: 0.5,
        y: 0.5,
        font: { size: 22, color },
      }],
    }, {
      displayModeBar: false,
      responsive: true,
    });

    const label = document.createElement("div");
    label.className = "plotLabel";
    label.textContent = clase.n;
    element.appendChild(label);

    setTimeout(() => {
      Plotly.Plots.resize(plotWrap);
    }, 0);
  },

  volver() {
    this.contenido.style.display = "none";
    this.login.style.display = "block";

    const boxConst = document.getElementById("constanciaBox");
    const resultadoBox = document.getElementById("resultadoBox");
    const boxCert = document.getElementById("certificadoBox");
    const boxRecup = document.getElementById("recuperatorioBox");

    if (boxConst) boxConst.style.display = "none";
    if (resultadoBox) resultadoBox.style.display = "none";
    if (boxCert) boxCert.style.display = "none";
    if (boxRecup) boxRecup.style.display = "none";
  },
};

document.addEventListener("DOMContentLoaded", () => {
  VerificadorAyRPC.init();
});
