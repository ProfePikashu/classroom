"use strict";

const RUBRICS_STORAGE_KEY = "ayrpc-2025-rubrics-v2";

const RUBRICS_DEFAULT_CLASSES = [
  { id: "clase-1", number: 1, title: "Armado y Componentes" },
  { id: "clase-2", number: 2, title: "Instalación de SO" },
  { id: "clase-3", number: 3, title: "Programación de BIOS" },
  { id: "clase-4", number: 4, title: "Drivers y Software de mantenimiento" },
  { id: "clase-5", number: 5, title: "Introducción a la microsoldadura" },
  { id: "clase-6", number: 6, title: "Solución de problemas" },
  { id: "clase-7", number: 7, title: "Virus y Malware + Sorteo" },
];

const ClassroomRubrics = {
  data: null,
  selectedClassId: "clase-1",

  init() {
    if (!this.checkTeacherAccess()) return;

    this.data = this.load();
    this.bind();
    this.renderClassSelect();
    this.loadSelectedClass();
  },

  checkTeacherAccess() {
    const isTeacher = typeof ClassroomRoles !== "undefined" && ClassroomRoles.isCurrentTeacher();

    document.getElementById("teacherDenied").style.display = isTeacher ? "none" : "block";
    document.getElementById("rubricsApp").style.display = isTeacher ? "grid" : "none";

    return isTeacher;
  },

  defaultQuestion(classId, index = 1) {
    return {
      id: `${classId}-p${index}`,
      code: `P${index}`,
      type: "DESARROLLO",
      suggested_result: "incorrect",
      prompt: "{ASIGNAR PREGUNTA}",
      minimum_criterion: "{ASIGNAR CRITERIO MINIMO}",
      correction_observation: "Devolución al alumno...",
      criteria: [
        {
          title: "{ASIGNAR CRITERIO}",
          expected: "{ASIGNAR DESCRIPCION}",
          keywords: "{ASIGNAR PALABRAS CLAVE}",
          missing_message: "{ASIGNAR DEVOLUCION SI FALTA}",
        },
      ],
      options: [
        "{ASIGNAR OPCION}",
        "{ASIGNAR OPCION}",
        "{ASIGNAR OPCION}",
        "{ASIGNAR OPCION}",
      ],
      answer: 0,
    };
  },

  defaultData() {
    return {
      course_id: "ayrpc-2025",
      min_score_percent: 70,
      quizzes: RUBRICS_DEFAULT_CLASSES.reduce((acc, item) => {
        acc[item.id] = {
          title: `Recuperatorio Clase ${item.number}`,
          questions: [
            this.defaultQuestion(item.id, 1),
          ],
        };

        return acc;
      }, {}),
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(RUBRICS_STORAGE_KEY);
      if (!raw) return this.defaultData();

      return {
        ...this.defaultData(),
        ...JSON.parse(raw),
      };
    } catch (error) {
      return this.defaultData();
    }
  },

  save() {
    localStorage.setItem(RUBRICS_STORAGE_KEY, JSON.stringify(this.data));
  },

  bind() {
    document.getElementById("rubricClassSelect").addEventListener("change", (event) => {
      this.selectedClassId = event.target.value;
      this.loadSelectedClass();
    });

    document.getElementById("rubricQuizTitle").addEventListener("input", () => {
      this.updateCurrentFromForm();
      this.renderPreview();
    });

    document.getElementById("rubricMinScore").addEventListener("input", (event) => {
      this.data.min_score_percent = Number(event.target.value || 70);
      this.renderPreview();
    });

    document.getElementById("btnAddQuestion").addEventListener("click", () => {
      this.addQuestion();
    });

    document.getElementById("btnSaveRubric").addEventListener("click", () => {
      this.updateCurrentFromForm();
      this.save();
      alert("Rúbrica guardada localmente.");
    });

    document.getElementById("btnResetRubric").addEventListener("click", () => {
      const ok = confirm("¿Seguro que querés borrar las rúbricas locales?");
      if (!ok) return;

      localStorage.removeItem(RUBRICS_STORAGE_KEY);
      this.data = this.defaultData();
      this.loadSelectedClass();
      alert("Rúbricas locales reiniciadas.");
    });
  },

  renderClassSelect() {
    const select = document.getElementById("rubricClassSelect");

    select.innerHTML = RUBRICS_DEFAULT_CLASSES.map((item) => `
      <option value="${item.id}">Clase ${item.number} — ${item.title}</option>
    `).join("");

    select.value = this.selectedClassId;
  },

  getCurrentQuiz() {
    if (!this.data.quizzes[this.selectedClassId]) {
      this.data.quizzes[this.selectedClassId] = {
        title: "Recuperatorio",
        questions: [],
      };
    }

    return this.data.quizzes[this.selectedClassId];
  },

  loadSelectedClass() {
    const quiz = this.getCurrentQuiz();

    document.getElementById("rubricQuizTitle").value = quiz.title || "";
    document.getElementById("rubricMinScore").value = this.data.min_score_percent || 70;

    this.renderQuestions();
    this.renderPreview();
  },

  updateCurrentFromForm() {
    const quiz = this.getCurrentQuiz();
    quiz.title = document.getElementById("rubricQuizTitle").value || "{ASIGNAR TITULO}";
  },

  addQuestion() {
    const quiz = this.getCurrentQuiz();
    const index = quiz.questions.length + 1;

    quiz.questions.push(this.defaultQuestion(this.selectedClassId, index));

    this.renderQuestions();
    this.renderPreview();
  },

  deleteQuestion(index) {
    const quiz = this.getCurrentQuiz();
    quiz.questions.splice(index, 1);

    this.renderQuestions();
    this.renderPreview();
  },

  addCriterion(questionIndex) {
    const quiz = this.getCurrentQuiz();

    quiz.questions[questionIndex].criteria.push({
      title: "{ASIGNAR CRITERIO}",
      expected: "{ASIGNAR DESCRIPCION}",
      keywords: "{ASIGNAR PALABRAS CLAVE}",
      missing_message: "{ASIGNAR DEVOLUCION SI FALTA}",
    });

    this.renderQuestions();
    this.renderPreview();
  },

  deleteCriterion(questionIndex, criterionIndex) {
    const quiz = this.getCurrentQuiz();

    quiz.questions[questionIndex].criteria.splice(criterionIndex, 1);

    this.renderQuestions();
    this.renderPreview();
  },

  setSuggestedResult(questionIndex, value) {
    const quiz = this.getCurrentQuiz();
    quiz.questions[questionIndex].suggested_result = value;

    this.renderQuestions();
    this.renderPreview();
  },

  renderQuestions() {
    const container = document.getElementById("rubricQuestions");
    const quiz = this.getCurrentQuiz();

    container.innerHTML = quiz.questions.map((question, index) => `
      <article class="exampro-rubric-card" data-index="${index}">
        <div class="exampro-rubric-head">
          <div>
            <span class="exampro-question-code">${question.code || `P${index + 1}`} · CORRECCIÓN</span>
            <input class="exampro-question-title" data-question-prompt="${index}" type="text" value="${this.escapeAttr(question.prompt)}" />
          </div>

          <button class="rubric-trash-btn" type="button" data-delete-question="${index}" title="Eliminar pregunta">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>

        <div class="exampro-rubric-meta">
          <label>
            <span>Tipo</span>
            <select data-question-type="${index}">
              <option value="DESARROLLO" ${question.type === "DESARROLLO" ? "selected" : ""}>DESARROLLO</option>
              <option value="MULTIPLE_CHOICE" ${question.type === "MULTIPLE_CHOICE" ? "selected" : ""}>MULTIPLE CHOICE</option>
              <option value="VERDADERO_FALSO" ${question.type === "VERDADERO_FALSO" ? "selected" : ""}>VERDADERO / FALSO</option>
            </select>
          </label>

          <label>
            <span>Sugerido</span>
            <select data-question-suggested="${index}">
              <option value="correct" ${question.suggested_result === "correct" ? "selected" : ""}>Correcto</option>
              <option value="partial" ${question.suggested_result === "partial" ? "selected" : ""}>Parcial</option>
              <option value="incorrect" ${question.suggested_result === "incorrect" ? "selected" : ""}>Incorrecto</option>
            </select>
          </label>
        </div>

        <section class="criterion-minimum-box">
          <div class="criterion-title">
            <i class="fa-solid fa-lightbulb"></i>
            CRITERIO MÍNIMO
          </div>

          <textarea data-question-minimum="${index}" rows="3">${question.minimum_criterion || ""}</textarea>
        </section>

        <section class="criteria-list-box">
          ${(question.criteria || []).map((criterion, criterionIndex) => `
            <article class="criterion-item">
              <div class="criterion-item-head">
                <strong>✘ ${criterion.title || "{ASIGNAR CRITERIO}"}</strong>

                <button class="criterion-delete-btn" type="button" data-delete-criterion="${index}:${criterionIndex}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>

              <label>
                <span>Qué debería desarrollar</span>
                <textarea data-criterion-expected="${index}:${criterionIndex}" rows="2">${criterion.expected || ""}</textarea>
              </label>

              <label>
                <span>Palabras clave / faltantes</span>
                <input data-criterion-keywords="${index}:${criterionIndex}" type="text" value="${this.escapeAttr(criterion.keywords || "")}" />
              </label>

              <label>
                <span>Devolución sugerida si falta</span>
                <input data-criterion-missing="${index}:${criterionIndex}" type="text" value="${this.escapeAttr(criterion.missing_message || "")}" />
              </label>
            </article>
          `).join("")}
        </section>

        <button class="btn btn-outline" type="button" data-add-criterion="${index}">
          <i class="fa-solid fa-plus"></i>
          Agregar criterio
        </button>

        ${question.type === "MULTIPLE_CHOICE" ? this.renderMultipleChoiceEditor(question, index) : ""}

        <div class="exampro-result-buttons">
          <button type="button" class="result-btn correct ${question.suggested_result === "correct" ? "active" : ""}" data-result="${index}:correct">
            <i class="fa-solid fa-check"></i>
            Correcto
          </button>

          <button type="button" class="result-btn partial ${question.suggested_result === "partial" ? "active" : ""}" data-result="${index}:partial">
            <i class="fa-solid fa-circle-half-stroke"></i>
            Parcial
          </button>

          <button type="button" class="result-btn incorrect ${question.suggested_result === "incorrect" ? "active" : ""}" data-result="${index}:incorrect">
            <i class="fa-solid fa-xmark"></i>
            Incorrecto
          </button>
        </div>

        <label class="observation-box">
          <span>Observación</span>
          <textarea data-question-observation="${index}" rows="4">${question.correction_observation || ""}</textarea>
        </label>
      </article>
    `).join("");

    this.bindQuestionEvents(container, quiz);
  },

  renderMultipleChoiceEditor(question, index) {
    return `
      <section class="multiple-choice-editor">
        <div class="criterion-title">
          <i class="fa-solid fa-list-ul"></i>
          OPCIONES
        </div>

        <div class="rubric-options-grid">
          ${(question.options || []).map((option, optionIndex) => `
            <label>
              <span>Opción ${optionIndex + 1}</span>
              <input data-question-option="${index}:${optionIndex}" type="text" value="${this.escapeAttr(option)}" />
            </label>
          `).join("")}
        </div>

        <label>
          <span>Respuesta correcta</span>
          <select data-question-answer="${index}">
            ${(question.options || []).map((_, optionIndex) => `
              <option value="${optionIndex}" ${Number(question.answer) === optionIndex ? "selected" : ""}>
                Opción ${optionIndex + 1}
              </option>
            `).join("")}
          </select>
        </label>
      </section>
    `;
  },

  bindQuestionEvents(container, quiz) {
    container.querySelectorAll("[data-delete-question]").forEach((button) => {
      button.addEventListener("click", () => {
        this.deleteQuestion(Number(button.dataset.deleteQuestion));
      });
    });

    container.querySelectorAll("[data-add-criterion]").forEach((button) => {
      button.addEventListener("click", () => {
        this.addCriterion(Number(button.dataset.addCriterion));
      });
    });

    container.querySelectorAll("[data-delete-criterion]").forEach((button) => {
      button.addEventListener("click", () => {
        const [qIndex, cIndex] = button.dataset.deleteCriterion.split(":").map(Number);
        this.deleteCriterion(qIndex, cIndex);
      });
    });

    container.querySelectorAll("[data-result]").forEach((button) => {
      button.addEventListener("click", () => {
        const [qIndex, value] = button.dataset.result.split(":");
        this.setSuggestedResult(Number(qIndex), value);
      });
    });

    container.querySelectorAll("[data-question-prompt]").forEach((field) => {
      field.addEventListener("input", () => {
        const index = Number(field.dataset.questionPrompt);
        quiz.questions[index].prompt = field.value;
        this.renderPreview();
      });
    });

    container.querySelectorAll("[data-question-type]").forEach((field) => {
      field.addEventListener("change", () => {
        const index = Number(field.dataset.questionType);
        quiz.questions[index].type = field.value;
        this.renderQuestions();
        this.renderPreview();
      });
    });

    container.querySelectorAll("[data-question-suggested]").forEach((field) => {
      field.addEventListener("change", () => {
        const index = Number(field.dataset.questionSuggested);
        quiz.questions[index].suggested_result = field.value;
        this.renderQuestions();
        this.renderPreview();
      });
    });

    container.querySelectorAll("[data-question-minimum]").forEach((field) => {
      field.addEventListener("input", () => {
        const index = Number(field.dataset.questionMinimum);
        quiz.questions[index].minimum_criterion = field.value;
        this.renderPreview();
      });
    });

    container.querySelectorAll("[data-question-observation]").forEach((field) => {
      field.addEventListener("input", () => {
        const index = Number(field.dataset.questionObservation);
        quiz.questions[index].correction_observation = field.value;
        this.renderPreview();
      });
    });

    container.querySelectorAll("[data-criterion-expected]").forEach((field) => {
      field.addEventListener("input", () => {
        const [qIndex, cIndex] = field.dataset.criterionExpected.split(":").map(Number);
        quiz.questions[qIndex].criteria[cIndex].expected = field.value;
        this.renderPreview();
      });
    });

    container.querySelectorAll("[data-criterion-keywords]").forEach((field) => {
      field.addEventListener("input", () => {
        const [qIndex, cIndex] = field.dataset.criterionKeywords.split(":").map(Number);
        quiz.questions[qIndex].criteria[cIndex].keywords = field.value;
        this.renderPreview();
      });
    });

    container.querySelectorAll("[data-criterion-missing]").forEach((field) => {
      field.addEventListener("input", () => {
        const [qIndex, cIndex] = field.dataset.criterionMissing.split(":").map(Number);
        quiz.questions[qIndex].criteria[cIndex].missing_message = field.value;
        this.renderPreview();
      });
    });

    container.querySelectorAll("[data-question-option]").forEach((field) => {
      field.addEventListener("input", () => {
        const [qIndex, optIndex] = field.dataset.questionOption.split(":").map(Number);
        quiz.questions[qIndex].options[optIndex] = field.value;
        this.renderPreview();
      });
    });

    container.querySelectorAll("[data-question-answer]").forEach((field) => {
      field.addEventListener("change", () => {
        const index = Number(field.dataset.questionAnswer);
        quiz.questions[index].answer = Number(field.value);
        this.renderPreview();
      });
    });
  },

  renderPreview() {
    this.updateCurrentFromForm();

    const preview = document.getElementById("rubricPreview");
    const quiz = this.getCurrentQuiz();

    preview.innerHTML = `
      <h3>${quiz.title}</h3>
      <p>Mínimo de aprobación: <strong>${this.data.min_score_percent || 70}%</strong></p>

      <div class="quiz-preview-list">
        ${quiz.questions.map((question, index) => `
          <div class="quiz-preview-question">
            <strong>${question.code || `P${index + 1}`} · ${question.prompt}</strong>

            <div class="preview-pill-row">
              <span class="preview-pill">${question.type}</span>
              <span class="preview-pill ${question.suggested_result}">Sugerido: ${this.labelResult(question.suggested_result)}</span>
            </div>

            <p class="preview-minimum">${question.minimum_criterion || ""}</p>

            <ul class="preview-criteria-list">
              ${(question.criteria || []).map((criterion) => `
                <li>
                  <strong>${criterion.title}</strong>
                  <span>${criterion.expected}</span>
                  <small>${criterion.missing_message}</small>
                </li>
              `).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    `;
  },

  labelResult(value) {
    const map = {
      correct: "Correcto",
      partial: "Parcial",
      incorrect: "Incorrecto",
    };

    return map[value] || value;
  },

  escapeAttr(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomRubrics.init();
});
