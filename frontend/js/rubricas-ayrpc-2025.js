"use strict";

const RUBRICS_STORAGE_KEY = "ayrpc-2025-rubrics-v1";

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

  defaultData() {
    return {
      course_id: "ayrpc-2025",
      min_score_percent: 70,
      quizzes: RUBRICS_DEFAULT_CLASSES.reduce((acc, item) => {
        acc[item.id] = {
          title: `Recuperatorio Clase ${item.number}`,
          questions: [
            {
              id: `${item.id}-q1`,
              prompt: "{ASIGNAR PREGUNTA}",
              options: [
                "{ASIGNAR OPCION}",
                "{ASIGNAR OPCION}",
                "{ASIGNAR OPCION}",
                "{ASIGNAR OPCION}",
              ],
              answer: 0,
            },
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

    quiz.questions.push({
      id: `${this.selectedClassId}-q${index}-${Date.now()}`,
      prompt: "{ASIGNAR PREGUNTA}",
      options: [
        "{ASIGNAR OPCION}",
        "{ASIGNAR OPCION}",
        "{ASIGNAR OPCION}",
        "{ASIGNAR OPCION}",
      ],
      answer: 0,
    });

    this.renderQuestions();
    this.renderPreview();
  },

  deleteQuestion(index) {
    const quiz = this.getCurrentQuiz();
    quiz.questions.splice(index, 1);

    this.renderQuestions();
    this.renderPreview();
  },

  renderQuestions() {
    const container = document.getElementById("rubricQuestions");
    const quiz = this.getCurrentQuiz();

    container.innerHTML = quiz.questions.map((question, index) => `
      <article class="rubric-question-card" data-index="${index}">
        <div class="rubric-question-head">
          <strong>Pregunta ${index + 1}</strong>

          <button class="btn btn-outline danger-btn" type="button" data-delete-question="${index}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>

        <label>
          <span>Enunciado</span>
          <textarea data-question-prompt="${index}" rows="3">${question.prompt}</textarea>
        </label>

        <div class="rubric-options-grid">
          ${question.options.map((option, optionIndex) => `
            <label>
              <span>Opción ${optionIndex + 1}</span>
              <input data-question-option="${index}:${optionIndex}" type="text" value="${option}" />
            </label>
          `).join("")}
        </div>

        <label>
          <span>Respuesta correcta</span>
          <select data-question-answer="${index}">
            ${question.options.map((_, optionIndex) => `
              <option value="${optionIndex}" ${Number(question.answer) === optionIndex ? "selected" : ""}>
                Opción ${optionIndex + 1}
              </option>
            `).join("")}
          </select>
        </label>
      </article>
    `).join("");

    container.querySelectorAll("[data-delete-question]").forEach((button) => {
      button.addEventListener("click", () => {
        this.deleteQuestion(Number(button.dataset.deleteQuestion));
      });
    });

    container.querySelectorAll("[data-question-prompt]").forEach((field) => {
      field.addEventListener("input", () => {
        const index = Number(field.dataset.questionPrompt);
        quiz.questions[index].prompt = field.value;
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
            <strong>${index + 1}. ${question.prompt}</strong>

            <ol type="A">
              ${question.options.map((option, optionIndex) => `
                <li class="${Number(question.answer) === optionIndex ? "correct" : ""}">
                  ${option}
                </li>
              `).join("")}
            </ol>
          </div>
        `).join("")}
      </div>
    `;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ClassroomRubrics.init();
});
