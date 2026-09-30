
(() => {
  "use strict";

  const BugReporter = {
    init() {
      if (!this.isProtectedPage()) return;
      this.inject();
      this.bind();
    },

    isProtectedPage() {
      const file =
        window.location.pathname.split("/").pop() ||
        "index.html";

      return file !== "login.html";
    },

    apiBase() {
      if (typeof EXAMPRO_API_BASE !== "undefined") {
        return EXAMPRO_API_BASE;
      }

      const local =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.protocol === "file:";

      return local
        ? "http://127.0.0.1:8000"
        : "https://api.andyazhtec.com";
    },

    getSession() {
      if (
        typeof ClassroomAuth !== "undefined" &&
        typeof ClassroomAuth.getSession === "function"
      ) {
        return ClassroomAuth.getSession();
      }

      try {
        return JSON.parse(
          localStorage.getItem(
            "andyazh-classroom-session"
          ) || "null"
        );
      } catch {
        return null;
      }
    },

    getToken() {
      const session = this.getSession();

      return (
        session?.classroomReadToken ||
        session?.exampro?.accessToken ||
        session?.access_token ||
        session?.accessToken ||
        session?.token ||
        ""
      );
    },

    inject() {
      if (
        document.getElementById("bugReporterButton")
      ) return;

      const wrap = document.createElement("div");

      wrap.innerHTML = `
        <button
          id="bugReporterButton"
          class="bug-reporter-button"
          type="button"
          aria-label="Reportar un problema"
          title="Reportar un problema"
        >
          <i class="fa-solid fa-bug"></i>
        </button>

        <div
          id="bugReporterModal"
          class="bug-reporter-modal"
          aria-hidden="true"
        >
          <div
            class="bug-reporter-backdrop"
            data-bug-close
          ></div>

          <section
            class="bug-reporter-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bugReporterTitle"
          >
            <button
              class="bug-reporter-close"
              type="button"
              data-bug-close
              aria-label="Cerrar"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>

            <div class="bug-reporter-header">
              <div class="bug-reporter-icon">
                <i class="fa-solid fa-bug"></i>
              </div>

              <div>
                <p class="eyebrow">
                  Ayudanos a mejorar
                </p>

                <h2 id="bugReporterTitle">
                  Reportar un problema
                </h2>

                <p>
                  Contanos qué pasó y en qué parte del
                  Classroom lo viste.
                </p>
              </div>
            </div>

            <form
              id="bugReporterForm"
              class="bug-reporter-form"
            >
              <fieldset>
                <legend>Tipo de problema</legend>

                <div class="bug-type-grid">
                  <label class="bug-choice">
                    <input
                      type="radio"
                      name="bugType"
                      value="ESTETICO"
                      checked
                    />

                    <span>
                      <i class="fa-solid fa-palette"></i>
                      <strong>Estético</strong>
                      <small>
                        Algo se ve mal, desalineado
                        o raro.
                      </small>
                    </span>
                  </label>

                  <label class="bug-choice">
                    <input
                      type="radio"
                      name="bugType"
                      value="FUNCIONAL"
                    />

                    <span>
                      <i class="fa-solid fa-gears"></i>
                      <strong>Funcional</strong>
                      <small>
                        Algo no funciona como debería.
                      </small>
                    </span>
                  </label>
                </div>
              </fieldset>

              <div
                id="bugPriorityBlock"
                class="bug-priority-block"
                hidden
              >
                <span class="bug-field-title">
                  Prioridad
                </span>

                <div class="bug-priority-grid">
                  <label>
                    <input
                      type="radio"
                      name="bugPriority"
                      value="ALTA"
                    />

                    <span class="bug-priority alta">
                      <strong>Alta</strong>
                      <small>
                        Me impide continuar.
                      </small>
                    </span>
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="bugPriority"
                      value="MEDIA"
                    />

                    <span class="bug-priority media">
                      <strong>Media</strong>
                      <small>
                        Molesta o dificulta bastante.
                      </small>
                    </span>
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="bugPriority"
                      value="BAJA"
                    />

                    <span class="bug-priority baja">
                      <strong>Baja</strong>
                      <small>
                        Es menor y puedo seguir.
                      </small>
                    </span>
                  </label>
                </div>
              </div>

              <label class="bug-field">
                <span>¿Qué pasó?</span>

                <textarea
                  id="bugDescription"
                  rows="5"
                  maxlength="4000"
                  placeholder="Ej: Al tocar Recuperar clase no se abre el video..."
                  required
                ></textarea>
              </label>

              <label class="bug-field">
                <span>¿Qué esperabas que pasara?</span>

                <textarea
                  id="bugExpected"
                  rows="3"
                  maxlength="4000"
                  placeholder="Opcional"
                ></textarea>
              </label>

              <div
                id="bugReporterMessage"
                class="bug-reporter-message"
                aria-live="polite"
              ></div>

              <div class="bug-reporter-actions">
                <button
                  class="btn btn-outline"
                  type="button"
                  data-bug-close
                >
                  Cancelar
                </button>

                <button
                  id="bugSubmitButton"
                  class="btn btn-primary"
                  type="submit"
                >
                  <i class="fa-solid fa-paper-plane"></i>
                  Enviar reporte
                </button>
              </div>
            </form>
          </section>
        </div>
      `;

      document.body.append(...wrap.children);
    },

    bind() {
      const button =
        document.getElementById("bugReporterButton");

      const modal =
        document.getElementById("bugReporterModal");

      const form =
        document.getElementById("bugReporterForm");

      if (!button || !modal || !form) return;

      button.addEventListener("click", () => {
        this.open();
      });

      modal.addEventListener("click", (event) => {
        if (event.target.closest("[data-bug-close]")) {
          this.close();
        }
      });

      form.addEventListener("change", () => {
        this.syncPriority();
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await this.submit();
      });

      document.addEventListener("keydown", (event) => {
        if (
          event.key === "Escape" &&
          modal.classList.contains("show")
        ) {
          this.close();
        }
      });

      this.syncPriority();
    },

    open() {
      const modal =
        document.getElementById("bugReporterModal");

      if (!modal) return;

      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add(
        "bug-reporter-open"
      );

      setTimeout(() => {
        document
          .getElementById("bugDescription")
          ?.focus();
      }, 80);
    },

    close() {
      const modal =
        document.getElementById("bugReporterModal");

      if (!modal) return;

      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove(
        "bug-reporter-open"
      );

      this.clearMessage();
    },

    syncPriority() {
      const type =
        document.querySelector(
          'input[name="bugType"]:checked'
        )?.value || "ESTETICO";

      const block =
        document.getElementById(
          "bugPriorityBlock"
        );

      if (!block) return;

      block.hidden = type !== "FUNCIONAL";

      if (type !== "FUNCIONAL") {
        document
          .querySelectorAll(
            'input[name="bugPriority"]'
          )
          .forEach((input) => {
            input.checked = false;
          });
      }
    },

    setMessage(text, kind = "") {
      const el =
        document.getElementById(
          "bugReporterMessage"
        );

      if (!el) return;

      el.textContent = text || "";
      el.className =
        "bug-reporter-message" +
        (kind ? ` ${kind}` : "");
    },

    clearMessage() {
      this.setMessage("");
    },

    setBusy(busy) {
      const button =
        document.getElementById(
          "bugSubmitButton"
        );

      if (!button) return;

      button.disabled = busy;

      button.innerHTML = busy
        ? `
          <i class="fa-solid fa-spinner fa-spin"></i>
          Enviando...
        `
        : `
          <i class="fa-solid fa-paper-plane"></i>
          Enviar reporte
        `;
    },

    async submit() {
      const token = this.getToken();

      if (!token) {
        this.setMessage(
          "Tu sesión no es válida. Volvé a iniciar sesión.",
          "error"
        );
        return;
      }

      const type =
        document.querySelector(
          'input[name="bugType"]:checked'
        )?.value || "ESTETICO";

      const priority =
        document.querySelector(
          'input[name="bugPriority"]:checked'
        )?.value || null;

      if (
        type === "FUNCIONAL" &&
        !priority
      ) {
        this.setMessage(
          "Elegí una prioridad para el problema funcional.",
          "error"
        );
        return;
      }

      const description =
        document
          .getElementById("bugDescription")
          ?.value.trim() || "";

      const expected =
        document
          .getElementById("bugExpected")
          ?.value.trim() || "";

      if (description.length < 5) {
        this.setMessage(
          "Contanos un poquito más sobre lo que pasó.",
          "error"
        );
        return;
      }

      this.setBusy(true);
      this.clearMessage();

      try {
        const response = await fetch(
          `${this.apiBase()}/api/classroom/bug-reports`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              report_type: type,
              priority:
                type === "FUNCIONAL"
                  ? priority
                  : null,
              description,
              expected_behavior:
                expected || null,
              page_path:
                window.location.pathname,
              page_url:
                window.location.href,
              viewport_width:
                window.innerWidth,
              viewport_height:
                window.innerHeight,
              metadata: {
                referrer:
                  document.referrer || null,
                language:
                  navigator.language || null,
              },
            }),
          }
        );

        const data = await response
          .json()
          .catch(() => null);

        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.detail ||
            data?.message ||
            `Error HTTP ${response.status}`
          );
        }

        this.setMessage(
          "Reporte enviado. Gracias por avisarnos.",
          "success"
        );

        document
          .getElementById("bugReporterForm")
          ?.reset();

        this.syncPriority();

        setTimeout(() => {
          this.close();
        }, 1300);
      } catch (error) {
        this.setMessage(
          error?.message ||
          "No se pudo enviar el reporte.",
          "error"
        );
      } finally {
        this.setBusy(false);
      }
    },
  };

  window.ClassroomBugReporter =
    BugReporter;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => BugReporter.init()
    );
  } else {
    BugReporter.init();
  }
})();
