"use strict";

const CursosCleanPage = {
  courses: [],
  profile: null,
  session: null,

  get apiBase() {
    return typeof EXAMPRO_API_BASE !== "undefined"
      ? EXAMPRO_API_BASE
      : "https://api.andyazhtec.com";
  },

  init() {
    this.catalog = document.getElementById("coursesCatalog");

    if (!this.catalog) return;

    this.bindCatalogEvents();
    this.patchPelusita();

    void this.loadCatalog();
  },

  getSession() {
    if (typeof ClassroomAuth === "undefined") return null;

    return ClassroomAuth.getSession();
  },

  getToken(session) {
    return (
      session?.classroomReadToken ||
      session?.exampro?.accessToken ||
      session?.exampro?.token ||
      session?.access_token ||
      session?.token ||
      session?.accessToken ||
      ""
    );
  },

  roleFor(session = this.session) {
    return String(
      session?.backendRole ||
      session?.role ||
      ""
    ).trim().toLowerCase();
  },

  isStaffSession(session = this.session) {
    return [
      "docente",
      "teacher",
      "classroom_moderator",
      "moderador",
      "moderator"
    ].includes(this.roleFor(session));
  },

  isStudentSession(session = this.session) {
    return [
      "alumno",
      "student"
    ].includes(this.roleFor(session));
  },

  async fetchCourses(token) {
    const response = await fetch(
      `${this.apiBase}/api/classroom/courses`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.detail ||
        "No se pudo cargar el catalogo de cursos."
      );
    }

    return data;
  },

  async fetchProfile(token) {
    const response = await fetch(
      `${this.apiBase}/api/classroom/me/profile`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.detail ||
        "No se pudo cargar el perfil academico."
      );
    }

    return data;
  },

  enrolledCourseSlugs() {
    const enrollments = Array.isArray(
      this.profile?.enrollments
    )
      ? this.profile.enrollments
      : [];

    return new Set(
      enrollments
        .filter(enrollment => {
          const status = String(
            enrollment?.status || ""
          ).trim().toLowerCase();

          return (
            status !== "withdrawn" &&
            !enrollment?.withdrawn_at
          );
        })
        .map(enrollment =>
          this.normalizeSlug(
            enrollment?.course?.slug
          )
        )
        .filter(Boolean)
    );
  },

  canAccessCourse(course) {
    if (this.isStaffSession()) {
      return true;
    }

    if (!this.isStudentSession()) {
      return false;
    }

    const slug = this.normalizeSlug(
      course?.slug
    );

    return (
      Boolean(slug) &&
      this.enrolledCourseSlugs().has(slug)
    );
  },

  async loadCatalog() {
    const session = this.getSession();
    const token = this.getToken(session);

    this.session = session;

    if (!token) {
      this.renderError(
        "No hay una sesion valida para consultar los cursos."
      );
      return;
    }

    try {
      const data = await this.fetchCourses(token);

      this.profile = null;

      if (this.isStudentSession(session)) {
        try {
          this.profile = await this.fetchProfile(token);
        } catch (error) {
          console.warn(
            "Cursos: no se pudo cargar la matricula del alumno.",
            error
          );
        }
      }

      this.courses = Array.isArray(data?.courses)
        ? data.courses
        : [];

      this.renderCourses();
    } catch (error) {
      console.warn(
        "Cursos: no se pudo cargar el catalogo dinamico.",
        error
      );

      this.renderError(
        "No se pudo cargar el catalogo de cursos."
      );
    }
  },

  normalizeSlug(value) {
    const slug = String(value || "")
      .trim()
      .toLowerCase();

    return /^[a-z0-9][a-z0-9-]*$/.test(slug)
      ? slug
      : "";
  },

  titleFor(course) {
    const slug = this.normalizeSlug(course?.slug);
    const year = Number(course?.year);

    if (
      /^ayrpc-\d{4}$/.test(slug) &&
      Number.isFinite(year)
    ) {
      return `AyRPC ${year}`;
    }

    return (
      String(course?.name || "").trim() ||
      slug ||
      "Curso"
    );
  },

  statusMeta(value) {
    const status = String(value || "")
      .trim()
      .toLowerCase();

    if (status === "active") {
      return {
        status,
        label: "Disponible",
        cardClass: "course-clean-card-active",
        chipClass: "complete",
        description:
          "Curso activo. Accede al panel academico y a las clases disponibles."
      };
    }

    if (status === "finished") {
      return {
        status,
        label: "Finalizado",
        cardClass: "course-clean-card-active",
        chipClass: "complete",
        description:
          "Edicion finalizada. Consulta el recorrido academico y las clases disponibles."
      };
    }

    if (status === "draft") {
      return {
        status,
        label: "Borrador",
        cardClass: "course-clean-card-soon",
        chipClass: "soon",
        description:
          "Curso en preparacion. Visible para el equipo mientras termina de configurarse."
      };
    }

    if (status === "archived") {
      return {
        status,
        label: "Archivado",
        cardClass: "course-clean-card-soon",
        chipClass: "soon",
        description:
          "Curso archivado. Se conserva como referencia historica."
      };
    }

    return {
      status,
      label: "Sin estado",
      cardClass: "course-clean-card-soon",
      chipClass: "soon",
      description:
        "Este curso todavia no tiene un estado reconocido por el Classroom."
    };
  },

  escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  panelRoute(course) {
    const slug = this.normalizeSlug(course?.slug);

    const routes = {
      "ayrpc-2025": "curso-ayrpc-2025.html",
      "ayrpc-2026": "curso-ayrpc-2026.html"
    };

    return routes[slug] || "";
  },

  classesRoute(course) {
    const slug = this.normalizeSlug(course?.slug);

    const routes = {
      "ayrpc-2025": "clases-ayrpc-2025.html",
      "ayrpc-2026": "clases-ayrpc-2026.html"
    };

    return routes[slug] || "";
  },

  renderCourses() {
    if (!this.courses.length) {
      this.catalog.innerHTML = `
        <article class="course-clean-card course-clean-card-soon">
          <div class="course-clean-body">
            <h3>No hay cursos visibles</h3>
            <p>El catalogo no tiene cursos disponibles para esta sesion.</p>
          </div>
        </article>
      `;
      return;
    }

    this.catalog.innerHTML = this.courses
      .map(course => this.renderCourse(course))
      .join("");
  },

  renderCourse(course) {
    const meta = this.statusMeta(course?.status);
    const title = this.titleFor(course);

    const totalClasses = Math.max(
      0,
      Number(course?.total_classes || 0)
    );

    const canOpen =
      meta.status === "active" ||
      meta.status === "finished";

    const hasAccess =
      this.canAccessCourse(course);

    const panelRoute = this.panelRoute(course);
    const classesRoute = this.classesRoute(course);

    const panelAction =
      canOpen && hasAccess && panelRoute
        ? `
          <a href="${panelRoute}" class="btn btn-primary">
            <i class="fa-solid fa-chart-line"></i>
            ${meta.status === "finished" ? "Ver panel" : "Entrar al panel"}
          </a>
        `
        : "";

    const classesAction =
      canOpen &&
      hasAccess &&
      totalClasses > 0 &&
      classesRoute
        ? `
          <a href="${classesRoute}" class="btn btn-outline">
            <i class="fa-solid fa-video"></i>
            Ver clases
          </a>
        `
        : "";

    const helpAction =
      !panelAction
        ? `
          <button
            class="btn btn-outline"
            type="button"
            data-course-pelusita
          >
            <i class="fa-solid fa-paw"></i>
            Preguntarle a Pelusita
          </button>
        `
        : "";

    return `
      <article class="course-clean-card ${meta.cardClass}">
        <div class="course-clean-top">
          <div class="course-clean-icon">
            <i class="fa-solid fa-microchip"></i>
          </div>

          <span class="course-chip ${meta.chipClass}">
            ${this.escapeHtml(meta.label)}
          </span>
        </div>

        <div class="course-clean-body">
          <h3>${this.escapeHtml(title)}</h3>

          <p>
            ${this.escapeHtml(meta.description)}
          </p>

          <p>
            ${totalClasses} ${
              totalClasses === 1
                ? "clase cargada"
                : "clases cargadas"
            }.
          </p>

          ${
            !hasAccess &&
            this.isStudentSession()
              ? "<p>No figura entre tus inscripciones actuales.</p>"
              : ""
          }
        </div>

        <div class="course-clean-actions">
          ${panelAction}
          ${classesAction}
          ${helpAction}
        </div>
      </article>
    `;
  },

  renderError(message) {
    this.catalog.innerHTML = `
      <article class="course-clean-card course-clean-card-soon">
        <div class="course-clean-top">
          <div class="course-clean-icon">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>

          <span class="course-chip soon">Error</span>
        </div>

        <div class="course-clean-body">
          <h3>No pudimos cargar los cursos</h3>
          <p>${this.escapeHtml(message)}</p>
        </div>
      </article>
    `;
  },

  bindCatalogEvents() {
    this.catalog.addEventListener("click", event => {
      const button = event.target.closest(
        "[data-course-pelusita]"
      );

      if (!button) return;

      window.PelusitaClassroom?.open?.();
    });
  },

  patchPelusita() {
    const page = this;

    window.addEventListener("load", () => {
      if (!window.PelusitaClassroom) return;

      const originalOpen =
        window.PelusitaClassroom.open;

      window.PelusitaClassroom.open = function() {
        const dlg =
          document.getElementById("pelusitaDialog");

        const msg =
          document.getElementById("pelusitaDialogMsg");

        const opts =
          document.getElementById("pelusitaDialogOpts");

        if (!dlg || !msg || !opts) {
          originalOpen?.call(
            window.PelusitaClassroom
          );
          return;
        }

        msg.textContent =
          "Soy Pelusita.\n\n" +
          "Este catalogo se actualiza directamente desde Classroom. " +
          "Aca aparecen los cursos que estan visibles para tu sesion.";

        const buttons = page.courses
          .map(course => {
            const meta =
              page.statusMeta(course?.status);

            const title =
              page.titleFor(course);

            const route =
              page.panelRoute(course);

            const canOpen =
              page.canAccessCourse(course) &&
              (
                meta.status === "active" ||
                meta.status === "finished"
              ) &&
              route;

            if (!canOpen) {
              return `
                <button
                  class="pelusita-opt"
                  type="button"
                  disabled
                >
                  ${page.escapeHtml(title)}
                  ·
                  ${page.escapeHtml(meta.label)}
                </button>
              `;
            }

            return `
              <button
                class="pelusita-opt"
                type="button"
                data-course-route="${page.escapeHtml(route)}"
              >
                Abrir ${page.escapeHtml(title)}
              </button>
            `;
          })
          .join("");

        opts.innerHTML = `
          ${buttons}

          <button
            class="pelusita-opt"
            type="button"
            data-cursos-clean="cerrar"
          >
            Cerrar
          </button>
        `;

        opts.querySelectorAll(
          "[data-course-route]"
        ).forEach(button => {
          button.addEventListener("click", () => {
            window.location.href =
              button.dataset.courseRoute;
          });
        });

        opts.querySelector(
          '[data-cursos-clean="cerrar"]'
        )?.addEventListener("click", () => {
          window.PelusitaClassroom.close();
        });

        dlg.classList.add("show");

        window.PelusitaClassroom.state?.(
          "pelusita-state2"
        );
      };
    });
  }
};

document.addEventListener(
  "DOMContentLoaded",
  () => {
    CursosCleanPage.init();
  }
);