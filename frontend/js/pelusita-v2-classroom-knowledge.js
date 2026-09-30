(() => {
  "use strict";

  let booted = false;

  function pageName() {
    return (
      window.location.pathname
        .split("/")
        .pop()
        .toLowerCase() ||
      "index.html"
    );
  }

  function registerFaq(items) {
    window.PelusitaV2.registerFaq(items);
  }

  function registerTutorial(id, title, steps) {
    window.PelusitaV2.registerTutorial(id, {
      title,
      steps
    });
  }

  function registerNotifications() {
    registerFaq({
      id: "classroom-notifications",
      question: "¿Para qué sirve la campanita, NYA!?",
      short:
        "La campanita te avisa cuando tenés novedades, respuestas, avisos del Classroom u otras notificaciones para revisar, NYA!!",
      long:
        "Si aparece un número sobre la campanita significa que tenés notificaciones pendientes. Desde ahí podés abrirlas, marcarlas como leídas y revisar los avisos que correspondan, NYAAA!!",
      tutorial: "classroom-notifications-guide",
      state: "greeting"
    });

    registerTutorial(
      "classroom-notifications-guide",
      "Cómo usar las notificaciones",
      [
        {
          target: "#notificationsToggle",
          text:
            "Esta es la campanita de notificaciones. Si ves un número sobre ella, significa que tenés avisos pendientes para revisar, NYA!!",
          state: "greeting",
          position: "left",
          missing:
            "No encuentro la campanita en esta pantalla todavía, NYA!!"
        },
        {
          target: "#notificationsPanel",
          text:
            "Al abrirla aparece esta sección con tus notificaciones del Classroom. Acá pueden aparecer avisos académicos, respuestas de Comunidad y otras novedades importantes, NYAAA!!",
          state: "thinking",
          position: "left",
          missing:
            "Abrí primero la campanita para que pueda mostrarte esta sección, NYA!!"
        },
        {
          target: "#notificationsList",
          text:
            "En esta parte aparecen tus avisos. Podés entrar a cada notificación y revisar qué pasó o a qué parte del Classroom te lleva, NYA!!",
          state: "thinking",
          position: "left"
        },
        {
          target: "#notificationsReadAll",
          text:
            "Si ya revisaste todo, desde acá podés marcar todas las notificaciones como leídas, NYA!!",
          state: "success",
          position: "left"
        }
      ]
    );
  }

  function registerHome() {
    registerFaq([
      {
        id: "classroom-home",
        question: "¿Qué encuentro en Inicio, NYA!?",
        short:
          "Inicio es tu punto de entrada al Classroom. Desde acá podés revisar novedades y acceder rápidamente a las partes principales de tu cursada, NYA!!",
        long:
          "Pensalo como tu base dentro del Classroom. Acá aparecen accesos importantes, avisos y novedades para que puedas ubicarte rápido sin recorrer todo el sitio, NYAAA!!",
        tutorial: "classroom-home-guide",
        state: "greeting"
      },
      {
        id: "classroom-profile-access",
        question: "¿Dónde puedo ver mis datos, NYA!?",
        short:
          "Desde el menú de tu usuario podés entrar a Mis Datos y revisar la información asociada a tu perfil, NYA!!",
        tutorial: "classroom-profile-access-guide",
        state: "thinking"
      }
    ]);

    registerTutorial(
      "classroom-home-guide",
      "Conociendo Inicio",
      [
        {
          target: ".hero-panel",
          text:
            "Este es el Inicio del Classroom. Desde acá tenés acceso rápido a las partes principales de tu cursada, NYA!!",
          state: "greeting",
          position: "right"
        },
        {
          target: "#homeTerminalFeedTitle",
          text:
            "En esta sección aparecen avisos y novedades importantes para que puedas enterarte de cambios o información de la cursada, NYAAA!!",
          state: "thinking",
          position: "right"
        },
        {
          target: "#notificationsToggle",
          text:
            "Y esta es tu campanita. Cuando tenga un número, significa que hay notificaciones nuevas esperando que las revises, NYA!!",
          state: "greeting",
          position: "left"
        },
        {
          target: "#userMenuToggle",
          text:
            "Desde acá abrís tu menú personal, donde podés entrar a Mis Datos y revisar tu perfil, NYA!!",
          state: "success",
          position: "left"
        }
      ]
    );

    registerTutorial(
      "classroom-profile-access-guide",
      "Cómo entrar a Mis Datos",
      [
        {
          target: "#userMenuToggle",
          text:
            "Abrí este menú para acceder a las opciones de tu usuario, NYA!!",
          state: "greeting",
          position: "left"
        },
        {
          target: '#userDropdown a[href="perfil.html"]',
          text:
            "Desde Mis Datos entrás a tu perfil para consultar la información asociada a tu cuenta y a tu cursada, NYAAA!!",
          state: "success",
          position: "left",
          missing:
            "Primero abrí el menú de tu usuario para que pueda mostrarte Mis Datos, NYA!!"
        }
      ]
    );
  }

  function registerProfile() {
    registerFaq({
      id: "classroom-profile",
      question: "¿Qué puedo revisar en mi perfil, NYA!?",
      short:
        "En tu perfil podés consultar tus datos personales y la información académica disponible de tu cursada, NYA!!",
      long:
        "Esta sección reúne los datos que el Classroom tiene asociados a tu usuario, como nombre, DNI, correo, Twitch y estado académico cuando corresponda, NYAAA!!",
      tutorial: "classroom-profile-guide",
      state: "greeting"
    });

    registerTutorial(
      "classroom-profile-guide",
      "Conociendo tu perfil",
      [
        {
          target: ".profile-hero",
          text:
            "Este es tu perfil dentro del Classroom. Acá podés comprobar que estás viendo la información correspondiente a tu usuario, NYA!!",
          state: "greeting",
          position: "right"
        },
        {
          target: "#profileName",
          text:
            "En esta sección aparecen tus datos personales registrados en el Classroom, NYA!!",
          state: "thinking",
          position: "right"
        },
        {
          target: "#profileCourse",
          text:
            "Más abajo podés consultar información relacionada con tu curso y tu estado académico disponible, NYAAA!!",
          state: "thinking",
          position: "right"
        },
        {
          target: "#profileApto",
          text:
            "En esta parte podés revisar si figurás como apto para el examen cuando esa información esté disponible, NYA!!",
          state: "success",
          position: "right"
        }
      ]
    );
  }

  function registerMaterials() {
    registerFaq({
      id: "classroom-materials",
      question: "¿Dónde están los materiales, NYA!?",
      short:
        "En Materiales encontrás el acceso a los archivos y documentos compartidos para la cursada, NYA!!",
      long:
        "Desde esta sección podés abrir la carpeta enlazada de Google Drive para consultar materiales, documentos y archivos grandes sin perder el acceso al Classroom, NYAAA!!",
      tutorial: "classroom-materials-guide",
      state: "greeting"
    });

    registerTutorial(
      "classroom-materials-guide",
      "Cómo acceder a los materiales",
      [
        {
          target: "main, .main-content",
          text:
            "Esta es la sección de Materiales del Classroom. Acá vas a encontrar el acceso a los archivos compartidos para la cursada, NYA!!",
          state: "greeting",
          position: "right"
        },
        {
          target: 'a.btn[href*="drive.google.com"]',
          text:
            "Desde este botón podés abrir la carpeta de materiales en Google Drive. Se abre aparte para que puedas seguir teniendo el Classroom disponible, NYAAA!!",
          state: "success",
          position: "left"
        }
      ]
    );
  }

  function registerExamPro() {
    registerFaq({
      id: "classroom-exampro",
      question: "¿Para qué sirve ExamPro, NYA!?",
      short:
        "ExamPro es la plataforma donde podés consultar tus exámenes, recuperatorios y devoluciones cuando estén disponibles, NYA!!",
      long:
        "ExamPro se abre en una pestaña nueva para que puedas trabajar con tus evaluaciones sin cerrar el Classroom. Después podés volver a tus clases y materiales cuando quieras, NYAAA!!",
      tutorial: "classroom-exampro-guide",
      state: "greeting"
    });

    registerTutorial(
      "classroom-exampro-guide",
      "Cómo entrar a ExamPro",
      [
        {
          target: ".exampro-access-clean",
          text:
            "En esta sección tenés el acceso a ExamPro, donde podés consultar exámenes, recuperatorios y devoluciones corregidas cuando estén disponibles, NYAAA!!",
          state: "greeting",
          position: "right"
        },
        {
          target: ".exampro-access-points",
          text:
            "Acá podés ver un resumen de lo que vas a encontrar dentro de ExamPro, NYA!!",
          state: "thinking",
          position: "right"
        },
        {
          target: ".btn-exampro-open",
          text:
            "Con este botón abrís ExamPro en una pestaña nueva. El Classroom queda abierto para que puedas volver cuando lo necesites, NYAAA!!",
          state: "success",
          position: "left"
        }
      ]
    );
  }


  function registerGestion() {
    registerFaq([
      {
        id: "classroom-gestion",
        question: "¿Para qué sirve Gestión, NYA!?",
        short:
          "Desde Gestión podés realizar trámites relacionados con tu cursada, como certificados, constancias o solicitudes disponibles para tu usuario, NYA!!",
        tutorial: "classroom-gestion-guide",
        state: "greeting"
      },
      {
        id: "classroom-certificate",
        question: "¿Cómo saco mi certificado, NYA!?",
        short:
          "Si cumplís los requisitos del curso, desde Gestión podés elegir el curso y generar tu certificado de aprobación, NYA!!",
        tutorial: "classroom-certificate-guide",
        state: "thinking"
      }
    ]);

    registerTutorial(
      "classroom-gestion-guide",
      "Conociendo Gestión",
      [
        {
          target: ".gestion-hero",
          text:
            "Esta es la sección de Gestión. Desde acá podés realizar distintos trámites relacionados con tu cursada, NYA!!",
          state: "greeting",
          position: "right"
        },
        {
          target: "#btnGestionCertificado",
          text:
            "Desde esta parte podés generar tu certificado cuando cumplas los requisitos correspondientes, NYA!!",
          state: "thinking",
          position: "left"
        },
        {
          target: "#btnGestionConstancia",
          text:
            "Desde acá podés solicitar o generar una constancia cuando esta opción esté disponible para tu situación, NYA!!",
          state: "thinking",
          position: "left"
        },
        {
          target: "#btnGestionBaja",
          text:
            "Y esta opción corresponde a la baja. Usala solamente si realmente querés solicitar la baja de tu cursada, NYAAA!!",
          state: "error",
          position: "left"
        }
      ]
    );

    registerTutorial(
      "classroom-certificate-guide",
      "Cómo generar tu certificado",
      [
        {
          target: "#certificateCourse",
          text:
            "Primero elegí el curso para el que querés consultar tu certificado, NYA!!",
          state: "thinking",
          position: "right"
        },
        {
          target: "#btnGestionCertificado",
          text:
            "Si cumplís los requisitos, desde este botón podés generar tu certificado de aprobación, NYAAA!!",
          state: "success",
          position: "left"
        }
      ]
    );
  }


  function registerCommunity() {
    registerFaq([
      {
        id: "classroom-community",
        question: "¿Qué puedo hacer en Comunidad, NYA!?",
        short:
          "Comunidad es el espacio para hacer consultas, compartir aportes y responder a otros alumnos, NYA!!",
        long:
          "Podés buscar temas existentes, filtrar publicaciones o crear una nueva consulta con texto y archivos cuando lo necesites, NYAAA!!",
        tutorial: "classroom-community-guide",
        state: "greeting"
      },
      {
        id: "classroom-community-post",
        question: "¿Cómo hago una consulta, NYA!?",
        short:
          "Desde el botón para crear una publicación podés abrir el formulario y escribir tu consulta con todos los detalles necesarios, NYA!!",
        tutorial: "classroom-community-post-guide",
        state: "thinking"
      }
    ]);

    registerTutorial(
      "classroom-community-guide",
      "Conociendo Comunidad",
      [
        {
          target: "#communitySearch",
          text:
            "Desde acá podés buscar consultas y aportes que ya hayan publicado otros alumnos, NYA!!",
          state: "greeting",
          position: "right"
        },
        {
          target: "#communityFilterToggle",
          text:
            "Con este botón podés abrir los filtros para ordenar mejor lo que estás buscando, NYA!!",
          state: "thinking",
          position: "left"
        },
        {
          target: "#communityOpenComposer",
          text:
            "Y desde acá podés crear tu propia consulta, aporte o recomendación para la comunidad, NYAAA!!",
          state: "success",
          position: "left"
        }
      ]
    );

    registerTutorial(
      "classroom-community-post-guide",
      "Cómo hacer una consulta",
      [
        {
          target: "#communityOpenComposer",
          text:
            "Primero abrí el formulario para crear una nueva publicación, NYA!!",
          state: "greeting",
          position: "left"
        },
        {
          target: "#communityTitle",
          text:
            "Acá escribí un título corto y claro para que se entienda rápidamente cuál es tu consulta, NYA!!",
          state: "thinking",
          position: "right",
          missing:
            "Abrí primero el formulario para crear una publicación, NYA!!"
        },
        {
          target: "#communityContent",
          text:
            "En esta parte contá bien el problema, qué probaste y qué resultado obtuviste. Cuanto más contexto des, más fácil será ayudarte, NYAAA!!",
          state: "thinking",
          position: "right"
        },
        {
          target: "#communityImages",
          text:
            "Si necesitás mostrar capturas, videos, documentos o archivos relacionados, podés adjuntarlos desde acá, NYA!!",
          state: "thinking",
          position: "right"
        }
      ]
    );
  }


  function registerCourse2025() {
    registerFaq({
      id: "classroom-ayrpc-2025",
      question: "¿Qué encuentro en AyRPC 2025, NYA!?",
      short:
        "En AyRPC 2025 podés revisar el estado de tu cursada, tus asistencias y el recorrido que completaste durante el curso, NYA!!",
      tutorial: "classroom-ayrpc-2025-guide",
      state: "greeting"
    });

    registerTutorial(
      "classroom-ayrpc-2025-guide",
      "Tu cursada AyRPC 2025",
      [
        {
          target: ".ayrpc2025-hero",
          text:
            "Esta es la portada de AyRPC 2025. Desde acá podés volver rápidamente a las clases del curso, NYA!!",
          state: "greeting",
          position: "right"
        },
        {
          target: ".ayrpc-course-status-panel",
          text:
            "En esta sección podés consultar el estado general de tu cursada, NYA!!",
          state: "thinking",
          position: "right"
        },
        {
          target: ".ayrpc-attendance-panel",
          text:
            "Acá tenés el resumen de tus asistencias y el recorrido de las clases, NYAAA!!",
          state: "thinking",
          position: "right"
        },
        {
          target: "#ayrpcAttendanceProgress",
          text:
            "Este indicador representa tu avance dentro del recorrido de clases registrado en el Classroom, NYA!!",
          state: "success",
          position: "right"
        }
      ]
    );
  }


  function registerCourse2026() {
    registerFaq({
      id: "classroom-ayrpc-2026",
      question: "¿Qué encuentro en AyRPC 2026, NYA!?",
      short:
        "En AyRPC 2026 podés revisar el temario, el estado de tu cursada, tus asistencias y acceder a las clases, NYA!!",
      tutorial: "classroom-ayrpc-2026-guide",
      state: "greeting"
    });

    registerTutorial(
      "classroom-ayrpc-2026-guide",
      "Tu cursada AyRPC 2026",
      [
        {
          target: ".ayrpc2025-hero",
          text:
            "Esta es la portada de AyRPC 2026. Desde acá podés entrar directamente a las clases del curso, NYA!!",
          state: "greeting",
          position: "right"
        },
        {
          target: "#ayrpc2026Temario",
          text:
            "En esta sección podés consultar el temario y conocer los módulos que forman parte del curso, NYAAA!!",
          state: "thinking",
          position: "right"
        },
        {
          target: ".ayrpc-course-status-panel",
          text:
            "Acá podés revisar el estado general de tu cursada y la información disponible para tu usuario, NYA!!",
          state: "thinking",
          position: "right"
        },
        {
          target: ".ayrpc-attendance-panel",
          text:
            "En esta parte aparece el resumen de tus clases y asistencias registradas, NYAAA!!",
          state: "success",
          position: "right"
        }
      ]
    );
  }


  function registerClassesGeneral() {
    registerFaq({
      id: "classroom-classes-general",
      question: "¿Qué puedo hacer en Clases, NYA!?",
      short:
        "En Clases podés revisar las grabaciones, consultar tu estado y recuperar una asistencia cuando corresponda, NYA!!",
      long:
        "Cada clase muestra su estado y la acción disponible. Si necesitás recuperar una asistencia, Pelusita también puede guiarte paso a paso por todo el proceso, NYAAA!!",
      state: "greeting"
    });
  }


  function boot() {
    if (
      booted ||
      !window.PelusitaV2
    ) return;

    booted = true;

    const page = pageName();

    registerNotifications();

    if (page === "index.html") {
      registerHome();
    }

    if (page === "perfil.html") {
      registerProfile();
    }

    if (page === "archivos.html") {
      registerMaterials();
    }

    if (page === "exampro.html") {
      registerExamPro();
    }

    if (page === "gestion.html") {
      registerGestion();
    }

    if (page === "comunidad.html") {
      registerCommunity();
    }

    if (page === "curso-ayrpc-2025.html") {
      registerCourse2025();
    }

    if (page === "curso-ayrpc-2026.html") {
      registerCourse2026();
    }

    if (
      page === "clases-ayrpc-2025.html" ||
      page === "clases-ayrpc-2026.html"
    ) {
      registerClassesGeneral();
    }
  }

  if (document.readyState === "loading") {
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
