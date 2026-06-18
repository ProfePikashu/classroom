(() => {
  "use strict";

  const PROFE_EMAIL = "acoria@frba.utn.edu.ar";
  const PROFE_WHATSAPP = "5492236689580";

  const PAGE_HELP = {
    "index.html": {
      title: "Inicio",
      state: "pelusita-state2",
      intro:
`Hola, soy Pelusita 🐾

Este es el inicio del Classroom. Acá vas a encontrar avisos importantes, novedades del curso y accesos rápidos.`,
      guide: [
        {
          title: "Avisos del Classroom",
          text: "Acá aparecen las novedades importantes del curso. Si el profe publica algo nuevo, lo vas a ver en esta sección."
        },
        {
          title: "Campanita",
          text: "La campanita sirve para enterarte de novedades o avisos sin tener que revisar todo a mano."
        },
        {
          title: "Menú lateral",
          text: "Desde el menú de la izquierda podés entrar a cursos, materiales, ExamPro y gestión."
        }
      ]
    },

    "cursos.html": {
      title: "Cursos",
      state: "pelusita-state3",
      intro:
`Acá elegís la edición del curso.

AyRPC 2025 ya tiene panel académico activo. AyRPC 2026 todavía está en preparación.`,
      guide: [
        {
          title: "AyRPC 2025",
          text: "Entrá acá para ver tu panel académico, asistencias, tiempos registrados y estado de evaluación."
        },
        {
          title: "AyRPC 2026",
          text: "Por ahora muestra la promesa de la próxima edición. El temario se va a activar cuando esté cerrado."
        },
        {
          title: "Ver clases",
          text: "El botón de clases te lleva directo al recorrido de clases grabadas y recuperaciones."
        }
      ]
    },

    "curso-ayrpc-2025.html": {
      title: "AyRPC 2025",
      state: "pelusita-state3",
      intro:
`Este es tu panel académico de AyRPC 2025.

Acá podés revisar asistencia, tiempos registrados, estado de examen y recuperatorio si corresponde.`,
      guide: [
        {
          title: "Alumno",
          text: "Esta tarjeta muestra tus datos principales: nombre, DNI, Twitch, correo y estado de examen."
        },
        {
          title: "Recuperatorio",
          text: "Si figurás como apto para examen y todavía no tenés una evaluación aprobada, se habilita el acceso al recuperatorio."
        },
        {
          title: "Asistencia",
          text: "Acá se ve el estado de cada clase. PRESENTE y RECUPERADA cuentan como clases cubiertas."
        },
        {
          title: "Métricas",
          text: "El gráfico muestra el tiempo registrado por clase. Sirve para revisar participación y detectar si falta recuperar algo."
        }
      ]
    },

    "clases-ayrpc-2025.html": {
      title: "Clases",
      state: "pelusita-state3",
      intro:
`En esta sección están las clases de AyRPC 2025.

Si tenés una clase en AUSENTE o REVISAR, revisá si podés recuperarla desde acá.`,
      guide: [
        {
          title: "Lista de clases",
          text: "Cada clase aparece con su estado. Si está PRESENTE o RECUPERADA, esa clase ya cuenta como cubierta."
        },
        {
          title: "Reproductor",
          text: "Cuando elegís una clase, se abre el video correspondiente. La idea es que puedas revisar o recuperar el contenido."
        },
        {
          title: "Recuperación",
          text: "Si una clase está pendiente, seguí las instrucciones de la pantalla para completar la recuperación."
        }
      ]
    },

    "curso-ayrpc-2026.html": {
      title: "AyRPC 2026",
      state: "pelusita-state2",
      intro:
`AyRPC 2026 todavía se está preparando.

Cuando el temario esté cerrado, esta pantalla va a transformarse en el panel completo del curso.`,
      guide: [
        {
          title: "Promesa 2026",
          text: "Por ahora esta pantalla no muestra módulos ni temario para no prometer cosas a medio cerrar."
        },
        {
          title: "Próxima etapa",
          text: "Cuando el curso esté armado, acá se van a activar clases, materiales, asistencia y evaluaciones."
        }
      ]
    },

    "exampro.html": {
      title: "ExamPro",
      state: "pelusita-state3",
      intro:
`ExamPro es el espacio para evaluaciones, recuperatorios y devoluciones.

Si una corrección está disponible, vas a poder revisarla desde ahí.`,
      guide: [
        {
          title: "Evaluaciones",
          text: "Desde ExamPro se accede a exámenes, recuperatorios y correcciones."
        },
        {
          title: "Devoluciones",
          text: "Cuando el profe corrige, la devolución debería aparecer para que puedas revisar qué pasó."
        },
        {
          title: "Problemas de acceso",
          text: "Si no podés entrar o ves algo raro, contactá al profe con el botón de contacto."
        }
      ]
    },

    "archivos.html": {
      title: "Materiales",
      state: "pelusita-state3",
      intro:
`Acá van los materiales del curso.

La idea es que tengas todo ordenado sin andar cazando links por todos lados.`,
      guide: [
        {
          title: "Materiales",
          text: "Entrá acá para revisar archivos, recursos y material de apoyo del curso."
        }
      ]
    },

    "gestion.html": {
      title: "Gestión",
      state: "pelusita-state3",
      intro:
`Esta sección reúne trámites y documentación del curso.`,
      guide: [
        {
          title: "Gestión académica",
          text: "Acá deberían vivir certificados, constancias, bajas y otros trámites del curso."
        }
      ]
    },

    "asistencias.html": {
      title: "Asistencias",
      state: "pelusita-state3",
      intro:
`Este panel sirve para revisar asistencias.

Es una zona de gestión para el profe y moderadores.`,
      guide: [
        {
          title: "Revisión de asistencia",
          text: "Acá se revisan estados de alumnos, clases presentes, recuperadas o pendientes."
        }
      ]
    },

    "alumnos.html": {
      title: "Alumnos",
      state: "pelusita-state3",
      intro:
`Este panel es para gestión interna de alumnos.`,
      guide: [
        {
          title: "Listado de alumnos",
          text: "Sirve para buscar alumnos, revisar datos y controlar estados dentro del Classroom."
        }
      ]
    },

    "admin.html": {
      title: "Administrar",
      state: "pelusita-state5",
      intro:
`Esta zona es delicada, profe.

Acá se administran permisos y accesos.`,
      guide: [
        {
          title: "Roles y permisos",
          text: "Tocá esta sección con cuidado. Cambiar permisos afecta qué puede ver o hacer cada persona."
        }
      ]
    },

    "rubricas-ayrpc-2025.html": {
      title: "Rúbricas",
      state: "pelusita-state3",
      intro:
`Acá se preparan y revisan rúbricas.

Sirven para que las correcciones sean más claras y justas.`,
      guide: [
        {
          title: "Rúbricas",
          text: "Cada rúbrica ayuda a corregir con criterios más ordenados y explicables para el alumno."
        }
      ]
    },

    "perfil.html": {
      title: "Perfil",
      state: "pelusita-state2",
      intro:
`Acá aparecen tus datos personales del Classroom.`,
      guide: [
        {
          title: "Mis datos",
          text: "Revisá que tus datos estén bien, especialmente si después se usan en certificados o constancias."
        }
      ]
    }
  };

  let guideIndex = 0;
  let currentMode = "intro";

  function currentFile() {
    return window.location.pathname.split("/").pop() || "index.html";
  }

  function pageData() {
    return PAGE_HELP[currentFile()] || {
      title: "Classroom",
      state: "pelusita-state2",
      intro:
`Hola, soy Pelusita 🐾

Estoy para ayudarte a moverte por el Classroom.`,
      guide: [
        {
          title: "Ayuda general",
          text: "Usá el menú lateral para entrar a cursos, materiales, ExamPro o gestión."
        }
      ]
    };
  }

  function whatsappUrl() {
    const data = pageData();
    const message = encodeURIComponent(
      `Hola profe, soy alumno/a del Classroom. Necesito ayuda con la sección "${data.title}".`
    );

    return `https://wa.me/${PROFE_WHATSAPP}?text=${message}`;
  }

  function mailUrl() {
    const data = pageData();
    const subject = encodeURIComponent(`Consulta Classroom - ${data.title}`);
    const body = encodeURIComponent(
`Hola profe,

Necesito ayuda con la sección "${data.title}" del Classroom.

Detalle de la consulta:
`
    );

    return `mailto:${PROFE_EMAIL}?subject=${subject}&body=${body}`;
  }

  function ensureDialog() {
    let dialog = document.getElementById("pelusitaGlobalDialog");
    if (dialog) return dialog;

    dialog = document.createElement("section");
    dialog.id = "pelusitaGlobalDialog";
    dialog.className = "pelusita-global-dialog";
    dialog.setAttribute("aria-live", "polite");

    dialog.innerHTML = `
      <div class="pelusita-global-head">
        <div>
          <span class="pelusita-global-kicker">Asistente del Classroom</span>
          <h3 id="pelusitaGlobalTitle">Pelusita</h3>
        </div>

        <button type="button" class="pelusita-global-close" id="pelusitaGlobalClose" aria-label="Cerrar ayuda">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="pelusita-global-body">
        <p id="pelusitaGlobalText"></p>
      </div>

      <div class="pelusita-global-actions">
        <button type="button" class="pelusita-global-action pelusita-global-primary" id="pelusitaGlobalGuide">
          <i class="fa-solid fa-paw"></i>
          Guiame
        </button>

        <button type="button" class="pelusita-global-action" id="pelusitaGlobalContact">
          <i class="fa-solid fa-headset"></i>
          Contactar al profe
        </button>
      </div>

      <div class="pelusita-contact-panel" id="pelusitaContactPanel">
        <a class="pelusita-contact-link whatsapp" id="pelusitaGlobalWhatsapp" target="_blank" rel="noopener noreferrer">
          <i class="fa-brands fa-whatsapp"></i>
          WhatsApp
        </a>

        <a class="pelusita-contact-link mail" id="pelusitaGlobalMail">
          <i class="fa-solid fa-envelope"></i>
          Correo
        </a>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector("#pelusitaGlobalClose")?.addEventListener("click", close);
    dialog.querySelector("#pelusitaGlobalGuide")?.addEventListener("click", guide);
    dialog.querySelector("#pelusitaGlobalContact")?.addEventListener("click", toggleContact);

    return dialog;
  }

  function renderIntro() {
    const data = pageData();
    const dialog = ensureDialog();

    currentMode = "intro";
    guideIndex = 0;

    dialog.querySelector("#pelusitaGlobalTitle").textContent = data.title;
    dialog.querySelector("#pelusitaGlobalText").textContent = data.intro;

    const guideBtn = dialog.querySelector("#pelusitaGlobalGuide");
    guideBtn.innerHTML = `<i class="fa-solid fa-paw"></i> Guiame`;

    dialog.querySelector("#pelusitaGlobalWhatsapp").href = whatsappUrl();
    dialog.querySelector("#pelusitaGlobalMail").href = mailUrl();
    dialog.querySelector("#pelusitaContactPanel").classList.remove("show");

    if (window.PelusitaClassroom?.state) {
      window.PelusitaClassroom.state(data.state || "pelusita-state2");
    }
  }

  function open() {
    const dialog = ensureDialog();
    renderIntro();
    dialog.classList.add("show");
  }

  function close() {
    document.getElementById("pelusitaGlobalDialog")?.classList.remove("show");
  }

  function guide() {
    const data = pageData();
    const steps = data.guide || [];

    if (!steps.length) {
      renderIntro();
      return;
    }

    const dialog = ensureDialog();
    currentMode = "guide";

    const step = steps[guideIndex % steps.length];
    const currentStep = guideIndex + 1;
    const totalSteps = steps.length;

    dialog.querySelector("#pelusitaGlobalTitle").textContent = `${step.title}`;
    dialog.querySelector("#pelusitaGlobalText").textContent =
`${step.text}

Paso ${currentStep} de ${totalSteps}`;

    guideIndex = (guideIndex + 1) % steps.length;

    const guideBtn = dialog.querySelector("#pelusitaGlobalGuide");
    guideBtn.innerHTML = guideIndex === 0
      ? `<i class="fa-solid fa-rotate-left"></i> Repetir guía`
      : `<i class="fa-solid fa-forward"></i> Siguiente`;

    if (window.PelusitaClassroom?.state) {
      window.PelusitaClassroom.state("pelusita-state3");
    }
  }

  function toggleContact() {
    const panel = document.getElementById("pelusitaContactPanel");
    if (!panel) return;

    panel.classList.toggle("show");

    if (window.PelusitaClassroom?.state) {
      window.PelusitaClassroom.state("pelusita-state2");
    }
  }

  function bindTriggers() {
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest(
        "#sidebarPelusitaDock, .pelusita-sidebar-docked, .sidebar-v2-pelusita-dock"
      );

      if (!trigger) return;

      event.preventDefault();
      event.stopPropagation();
      open();
    });
  }

  window.PelusitaBot = {
    open,
    close,
    guide
  };

  document.addEventListener("DOMContentLoaded", () => {
    ensureDialog();
    bindTriggers();
  });
})();
