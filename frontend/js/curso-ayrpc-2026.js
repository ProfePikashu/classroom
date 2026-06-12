const CursoAyRPC2026Panel = {
  init() {
    this.bindAskButton();
    this.patchPelusita();
  },

  bindAskButton() {
    const btn = document.getElementById("ayrpc2026AskPelusita");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (window.PelusitaClassroom?.open) {
        window.PelusitaClassroom.open();
      }
    });
  },

  patchPelusita() {
    window.addEventListener("load", () => {
      if (!window.PelusitaClassroom) return;

      const originalOpen = window.PelusitaClassroom.open;

      window.PelusitaClassroom.open = function() {
        const dlg = document.getElementById("pelusitaDialog");
        const msg = document.getElementById("pelusitaDialogMsg");
        const opts = document.getElementById("pelusitaDialogOpts");

        if (!dlg || !msg || !opts) {
          originalOpen();
          return;
        }

        msg.textContent =
`Soy Pelusita.

AyRPC 2026 todavía está en preparación. Por ahora esta pantalla solo muestra la promesa general del curso.

Cuando el temario esté cerrado, acá se va a activar el panel completo: clases, asistencia, materiales, recuperatorios y conexión con ExamPro.`;

        opts.innerHTML = `
          <button class="pelusita-opt pelusita-opt-primary" data-ayrpc2026-help="promesa">
            ✨ ¿Qué se viene?
          </button>

          <button class="pelusita-opt" data-ayrpc2026-help="temario">
            📚 ¿Por qué no aparece el temario?
          </button>

          <button class="pelusita-opt" data-ayrpc2026-help="volver">
            ← Volver a cursos
          </button>

          <button class="pelusita-opt" data-ayrpc2026-help="cerrar">
            Cerrar
          </button>
        `;

        opts.querySelector('[data-ayrpc2026-help="promesa"]')?.addEventListener("click", () => {
          msg.textContent =
`La idea de AyRPC 2026 es que la cursada ya nazca ordenada dentro del Classroom.

Va a tener mejor seguimiento, más claridad para el alumno y una integración más prolija con ExamPro.`;
          window.PelusitaClassroom.state?.("pelusita-state3");
        });

        opts.querySelector('[data-ayrpc2026-help="temario"]')?.addEventListener("click", () => {
          msg.textContent =
`El temario todavía no se muestra porque no queremos prometer módulos a medio cerrar.

Cuando la planificación esté lista, esta página va a cambiar y va a mostrar el recorrido completo de la cursada.`;
          window.PelusitaClassroom.state?.("pelusita-state3");
        });

        opts.querySelector('[data-ayrpc2026-help="volver"]')?.addEventListener("click", () => {
          window.location.href = "cursos.html";
        });

        opts.querySelector('[data-ayrpc2026-help="cerrar"]')?.addEventListener("click", () => {
          window.PelusitaClassroom.close();
        });

        dlg.classList.add("show");
        window.PelusitaClassroom.state?.("pelusita-state2");
      };
    });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  CursoAyRPC2026Panel.init();
});
