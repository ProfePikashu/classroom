const CursosCleanPage = {
  init() {
    this.bindPelusitaButton();
    this.patchPelusita();
  },

  bindPelusitaButton() {
    const btn = document.getElementById("coursesAskPelusita");
    if (!btn) return;

    btn.addEventListener("click", () => {
      window.PelusitaClassroom?.open?.();
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

En esta pantalla elegís qué edición de AyRPC querés abrir. AyRPC 2025 ya tiene panel académico activo. AyRPC 2026 queda como promesa hasta que el temario esté cerrado.`;

        opts.innerHTML = `
          <button class="pelusita-opt pelusita-opt-primary" data-cursos-clean="2025">
            📚 Entrar a AyRPC 2025
          </button>

          <button class="pelusita-opt" data-cursos-clean="2026">
            ✨ Ver promesa AyRPC 2026
          </button>

          <button class="pelusita-opt" data-cursos-clean="cerrar">
            Cerrar
          </button>
        `;

        opts.querySelector('[data-cursos-clean="2025"]')?.addEventListener("click", () => {
          window.location.href = "curso-ayrpc-2025.html";
        });

        opts.querySelector('[data-cursos-clean="2026"]')?.addEventListener("click", () => {
          window.location.href = "curso-ayrpc-2026.html";
        });

        opts.querySelector('[data-cursos-clean="cerrar"]')?.addEventListener("click", () => {
          window.PelusitaClassroom.close();
        });

        dlg.classList.add("show");
        window.PelusitaClassroom.state?.("pelusita-state2");
      };
    });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  CursosCleanPage.init();
});
