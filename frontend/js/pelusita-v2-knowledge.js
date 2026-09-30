(() => {
  "use strict";

  const FAQS = [
    {
      id: "classroom.help",
      question: "¿Qué puedo hacer acá?",
      short:
        "Puedo explicarte esta pantalla y mostrarte dónde está cada opción importante.",
      long:
        "Elegí una pregunta rápida o pedime una guía. Voy a oscurecer el resto de la pantalla y señalar exactamente lo que tenés que mirar.",
      state: "greeting"
    },

    {
      id: "attendance.info",
      question: "¿Cómo funciona mi asistencia?",
      pages: [
        "clases-ayrpc-2025.html",
        "clases-ayrpc-2026.html",
        "curso-ayrpc-2025.html",
        "curso-ayrpc-2026.html"
      ],
      short:
        "Cada clase muestra tu estado. Cuando una clase necesita recuperación, el Classroom cambia la acción disponible para esa clase.",
      state: "thinking"
    },

    {
      id: "recovery.help",
      question: "¿Cómo recupero una clase?",
      pages: [
        "clases-ayrpc-2026.html"
      ],
      short:
        "Te muestro todo el recorrido. No importa si ahora mismo no tenés una clase pendiente de recuperación.",
      tutorial: "recover-class",
      state: "thinking",
      primary: true
    },

    {
      id: "exampro.info",
      question: "¿Para qué sirve ExamPro?",
      pages: [
        "exampro.html",
        "curso-ayrpc-2025.html",
        "curso-ayrpc-2026.html"
      ],
      short:
        "ExamPro concentra evaluaciones, recuperatorios y devoluciones disponibles para tu cursada.",
      state: "thinking"
    },

    {
      id: "community.info",
      question: "¿Cómo uso la Comunidad?",
      pages: [
        "comunidad.html"
      ],
      short:
        "Desde Comunidad podés crear hilos, responder consultas y compartir material útil.",
      state: "greeting"
    }
  ];


  function findRecoverableCard() {
    return document.querySelector(
      '[data-pelusita-class-card="true"][data-pelusita-recoverable="true"]'
    );
  }


  function findAnyClassCard() {
    return (
      findRecoverableCard() ||
      document.querySelector(
        '[data-pelusita-class-card="true"]'
      ) ||
      document.querySelector(
        ".class-row-card"
      )
    );
  }


  function findRecoverableButton() {
    return document.querySelector(
      '[data-pelusita-action="recover-class"]'
    );
  }


  function findAnyClassButton() {
    return (
      findRecoverableButton() ||
      document.querySelector(
        '[data-pelusita-action="view-class"]'
      ) ||
      document.querySelector(
        ".class-row-card button"
      )
    );
  }


  function buttonExplanation() {
    const recover = findRecoverableButton();

    if (recover) {
      return "Si necesitás recuperar una clase, entrá desde el botón Recuperar clase, NYA!!";
    }

    return "Ahora mismo no tenés una clase para recuperar. Cuando una clase quede AUSENTE o REVISAR, este botón cambiará a Recuperar clase, NYA!!";
  }


  const recoveryTutorial = {
    title: "Cómo recuperar una clase",

    steps: [
      {
        target: "#classesList",

        text:
          "Acá está la lista completa de tus clases. En cada sección podés ver su estado y la acción disponible, NYA!!",

        state: "thinking",

        position: "right"
      },

      {
        target: findAnyClassCard,

        text:
          "En esta sección podés ver el estado de la clase: PRESENTE, AUSENTE, REVISAR, RECUPERADA o pendiente, NYA!!",

        state: "thinking",

        position: "right"
      },

      {
        target: findAnyClassButton,

        text: buttonExplanation(),

        state: "greeting",

        position: "left"
      },

      {
        target: "#recoveryPanel",

        text:
          "Cuando elegís una clase, en esta sección aparece todo lo necesario para verla o recuperarla, NYA!!",

        state: "thinking",

        position: "left"
      },

      {
        target: "#videoPlayerBox",

        text:
          "Una vez que empieces a ver la clase, podés poner el video en pantalla completa, pero no minimices la ventana ni cambies de pestaña, porque el contador que valida el tiempo de clase volverá a 0, NYAAA!!",

        state: "thinking",

        position: "right"
      },

      {
        target: "#watchProgressWrap",

        text:
          "Este contador valida cuánto tiempo viste correctamente de la clase. Tenés que llevarlo hasta el 100%, NYA!!",

        state: "thinking",

        position: "right"
      },

      {
        target: "#quizButton",

        text:
          "Cuando el contador llegue al 100%, se habilitará este botón para responder el cuestionario y recuperar tu asistencia, NYAAA!!",

        state: "success",

        position: "left"
      }
    ]
  };


  let booted = false;

  function boot() {
    if (
      booted ||
      !window.PelusitaV2
    ) return;

    booted = true;

    window.PelusitaV2.registerFaq(
      FAQS
    );

    window.PelusitaV2.registerTutorial(
      "recover-class",
      recoveryTutorial
    );
  }


  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  }
  else {
    boot();
  }


  window.addEventListener(
    "pelusita:ready",
    boot,
    { once: true }
  );
})();
