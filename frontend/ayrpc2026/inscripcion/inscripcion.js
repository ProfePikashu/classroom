"use strict";

(() => {

  const DRAFT_KEY =
    "andyazh-ayrpc2026-registration-draft-v1";

  const THEME_KEY =
    "andyazh-ayrpc2026-registration-theme";

  const TOTAL_STEPS = 4;
  const TURNSTILE_SITE_KEY =
    "0x4AAAAAAEij_Z9z2XG5mH63";

  const API_BASE =
    (
      window.location.protocol === "file:" ||
      ["localhost", "127.0.0.1"].includes(
        window.location.hostname
      )
    )
      ? "http://127.0.0.1:8000"
      : "https://api.andyazhtec.com";

  const REGISTRATION_ENDPOINT =
    `${API_BASE}/api/classroom/course-registration`;

  let turnstileWidgetId = null;
  let turnstileToken = "";
  let turnstileRenderTimer = null;


  const form =
    document.getElementById("registrationForm");

  const card =
    document.querySelector(".registration-card");

  const success =
    document.getElementById("registrationSuccess");

  const formSteps =
    [...document.querySelectorAll("[data-form-step]")];

  const progressSteps =
    [...document.querySelectorAll("[data-progress-step]")];

  const prevButton =
    document.getElementById("prevButton");

  const nextButton =
    document.getElementById("nextButton");

  const submitButton =
    document.getElementById("submitButton");
  const honeypotInput =
    document.getElementById("website");

  const stepTitle =
    document.getElementById("stepTitle");

  const stepCounter =
    document.getElementById("stepCounter");

  const progressLine =
    document.getElementById("progressLine");

  const themeToggle =
    document.getElementById("themeToggle");

  const saveStatus =
    document.getElementById("saveStatus");

  const draftPercent =
    document.getElementById("draftPercent");

  const summary =
    document.getElementById("registrationSummary");

  const resumeModal =
    document.getElementById("resumeModal");

  const resumeButton =
    document.getElementById("resumeButton");

  const restartButton =
    document.getElementById("restartButton");

  const restartDemoButton =
    document.getElementById("restartDemoButton");

  const resumeSavedAt =
    document.getElementById("resumeSavedAt");

  const resumePercent =
    document.getElementById("resumePercent");

  const dniInput =
    document.getElementById("dni");

  const foreignIdentification =
    document.getElementById("foreignIdentification");

  const identificationLabel =
    document.getElementById("identificationLabel");

  const identificationHelp =
    document.getElementById("identificationHelp");

  const nameInput =
    document.getElementById("nombre");

  const surnameInput =
    document.getElementById("apellido");
  const emailInput =
    document.getElementById("email");

  const emailConfirmInput =
    document.getElementById("emailConfirm");

  const reviewEmail =
    document.getElementById("reviewEmail");

  const reviewPhone =
    document.getElementById("reviewPhone");

  const phoneCountryInput =
    document.getElementById("telefonoPais");

  const phoneAreaInput =
    document.getElementById("telefonoArea");

  const phoneNumberInput =
    document.getElementById("telefonoNumero");

  const twitchInput =
    document.getElementById("twitch");

  let currentStep = 1;

  let saveTimer = null;

  const progressFieldNames = [
    "nombre",
    "apellido",
    "dni",
    "email",
    "telefono_pais",
    "telefono_area",
    "telefono_numero",
    "twitch",
    "como_te_enteraste",
    "experiencia_previa",
    "situacion_it",
    "provincia",
    "localidad",
    "objetivo"
  ];

  function cleanDni(value) {
    return String(value || "")
      .replace(/\D/g, "")
      .slice(0, 8);
  }

  function normalizePersonName(value) {

    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("es-AR")
      .replace(
        /(^|[\s'-])([a-záéíóúüñ])/g,
        (match, separator, letter) =>
          separator + letter.toLocaleUpperCase("es-AR")
      );
  }

  function cleanPhoneDigits(value) {
    return String(value || "")
      .replace(/\D/g, "");
  }

  function normalizeCountryCode(value) {

    const digits =
      cleanPhoneDigits(value);

    return digits
      ? `+${digits}`
      : "";
  }

  function buildPhoneValue(data) {

    const country =
      normalizeCountryCode(
        data.telefono_pais
      );

    const area =
      cleanPhoneDigits(
        data.telefono_area
      );

    const number =
      cleanPhoneDigits(
        data.telefono_numero
      );

    return [
      country,
      area,
      number
    ]
      .filter(Boolean)
      .join(" ");
  }

  function cleanTwitch(value) {

    let clean =
      String(value || "")
        .trim()
        .toLowerCase();

    clean =
      clean.replace(
        /^https?:\/\/(www\.)?twitch\.tv\//,
        ""
      );

    clean =
      clean
        .replace(/^@/, "")
        .replace(/\/.*$/, "")
        .trim();

    return clean;
  }

  function ensureTurnstileRendered() {

    if (turnstileWidgetId !== null) {
      return;
    }

    if (
      !window.turnstile ||
      typeof window.turnstile.render !== "function"
    ) {

      clearTimeout(turnstileRenderTimer);

      turnstileRenderTimer =
        setTimeout(
          ensureTurnstileRendered,
          150
        );

      return;
    }

    clearTimeout(turnstileRenderTimer);

    turnstileWidgetId =
      window.turnstile.render(
        "#turnstileWidget",
        {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "auto",

          callback(token) {
            turnstileToken =
              String(token || "").trim();
          },

          "expired-callback"() {
            turnstileToken = "";
          },

          "error-callback"() {
            turnstileToken = "";
          }
        }
      );
  }


  function resetTurnstileVerification() {

    turnstileToken = "";

    if (
      window.turnstile &&
      turnstileWidgetId !== null
    ) {

      try {
        window.turnstile.reset(
          turnstileWidgetId
        );
      } catch {
        // Si Cloudflare ya destruyo el widget,
        // permitimos que vuelva a renderizarse.
        turnstileWidgetId = null;
        ensureTurnstileRendered();
      }
    }
  }


  function buildRegistrationPayload(data) {

    return {
      nombre:
        data.nombre,

      apellido:
        data.apellido,

      identificacion:
        data.dni,

      identificacion_extranjera:
        Boolean(
          data.identificacion_extranjera
        ),

      email:
        data.email,

      telefono_pais:
        data.telefono_pais,

      telefono_area:
        data.telefono_area,

      telefono_numero:
        data.telefono_numero,

      twitch:
        cleanTwitch(data.twitch),

      como_te_enteraste:
        data.como_te_enteraste || null,

      experiencia_previa:
        data.experiencia_previa || null,

      situacion_it:
        data.situacion_it || null,

      provincia:
        data.provincia || null,

      localidad:
        data.localidad || null,

      objetivo:
        data.objetivo || null,

      turnstile_token:
        turnstileToken,

      website:
        String(
          honeypotInput?.value || ""
        ).trim()
    };
  }


  async function readApiResponse(response) {

    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  function collectData() {

    const data = {};

    for (const fieldName of progressFieldNames) {

      const field =
        form.elements[fieldName];

      if (!field) continue;

      data[fieldName] =
        String(field.value || "").trim();
    }

    data.identificacion_extranjera =
      Boolean(foreignIdentification.checked);

    data.nombre =
      normalizePersonName(data.nombre);

    data.apellido =
      normalizePersonName(data.apellido);

    data.telefono =
      buildPhoneValue(data);

    return data;
  }

  function calculatePercent(data = collectData()) {

    const completed =
      progressFieldNames.filter((name) => {
        return String(data[name] || "").trim() !== "";
      }).length;

    return Math.round(
      (completed / progressFieldNames.length) * 100
    );
  }

  function updateDraftPercentage(data) {

    const percent =
      calculatePercent(data);

    draftPercent.textContent =
      `${percent}%`;

    return percent;
  }

  function saveDraft() {

    const data =
      collectData();

    const payload = {
      version: 1,
      course: "ayrpc-2026",
      currentStep,
      fields: data,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify(payload)
    );

    const percent =
      updateDraftPercentage(data);

    saveStatus.textContent =
      percent > 0
        ? "Cambios guardados"
        : "Borrador local preparado";
  }

  function scheduleSave() {

    clearTimeout(saveTimer);

    saveStatus.textContent =
      "Guardando...";

    saveTimer =
      setTimeout(saveDraft, 260);
  }

  function readDraft() {

    try {

      const raw =
        localStorage.getItem(DRAFT_KEY);

      if (!raw) return null;

      const parsed =
        JSON.parse(raw);

      if (!parsed || parsed.version !== 1) {
        return null;
      }

      return parsed;

    } catch {
      return null;
    }
  }

  function hasMeaningfulDraft(draft) {

    if (!draft?.fields) return false;

    return Object.values(draft.fields)
      .some((value) => {
        return String(value || "").trim() !== "";
      });
  }

  function restoreDraft(draft) {

    if (!draft?.fields) return;

    for (
      const [name, value]
      of Object.entries(draft.fields)
    ) {

      const field =
        form.elements[name];

      if (!field) continue;

      field.value =
        value ?? "";
    }

    foreignIdentification.checked =
      Boolean(draft.fields.identificacion_extranjera);

    updateIdentificationMode();

    currentStep =
      Math.min(
        Math.max(
          Number(draft.currentStep) || 1,
          1
        ),
        TOTAL_STEPS
      );

    updateDraftPercentage(draft.fields);

    showStep(
      currentStep,
      false
    );
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  function formatSavedDate(isoDate) {

    if (!isoDate) return "Hace un momento";

    const date =
      new Date(isoDate);

    if (Number.isNaN(date.getTime())) {
      return "Hace un momento";
    }

    return new Intl.DateTimeFormat(
      "es-AR",
      {
        dateStyle: "short",
        timeStyle: "short"
      }
    ).format(date);
  }

  function showResumeModalIfNeeded() {

    const draft =
      readDraft();

    if (!hasMeaningfulDraft(draft)) {
      return;
    }

    resumeSavedAt.textContent =
      formatSavedDate(draft.savedAt);

    resumePercent.textContent =
      `${calculatePercent(draft.fields)}%`;

    resumeModal.hidden = false;
  }

  function hideResumeModal() {
    resumeModal.hidden = true;
  }

  function updateProgressUI() {

    const percentage =
      ((currentStep - 1) /
        (TOTAL_STEPS - 1)) * 100;

    progressLine.style.width =
      `${percentage}%`;

    progressSteps.forEach((step) => {

      const number =
        Number(step.dataset.progressStep);

      step.classList.toggle(
        "active",
        number === currentStep
      );

      step.classList.toggle(
        "complete",
        number < currentStep
      );
    });
  }

  function showStep(
    stepNumber,
    save = true
  ) {

    currentStep =
      Math.min(
        Math.max(stepNumber, 1),
        TOTAL_STEPS
      );

    formSteps.forEach((step) => {

      const number =
        Number(step.dataset.formStep);

      step.classList.toggle(
        "active",
        number === currentStep
      );
    });

    const activeStep =
      formSteps.find((step) => {
        return Number(step.dataset.formStep) === currentStep;
      });

    stepTitle.textContent =
      activeStep?.dataset.stepName ||
      "Inscripción";

    stepCounter.textContent =
      `Paso ${currentStep} de ${TOTAL_STEPS}`;

    prevButton.disabled =
      currentStep === 1;

    nextButton.hidden =
      currentStep === TOTAL_STEPS;

    submitButton.hidden =
      currentStep !== TOTAL_STEPS;

    if (currentStep === TOTAL_STEPS) {
      paintSummary();
      ensureTurnstileRendered();
    }

    updateProgressUI();

    if (save) {
      saveDraft();
    }

    window.scrollTo({
      top:
        Math.max(
          card.offsetTop - 18,
          0
        ),
      behavior: "smooth"
    });
  }

  function validateCurrentStep() {

    const currentPanel =
      formSteps.find((step) => {
        return Number(step.dataset.formStep) === currentStep;
      });

    if (!currentPanel) return true;

    const requiredFields =
      [...currentPanel.querySelectorAll("[required]")];

    for (const field of requiredFields) {

      if (
        field.type === "checkbox" &&
        !field.checked
      ) {

        field.focus();

        alert(
          "Necesitamos que confirmes los datos antes de continuar."
        );

        return false;
      }

      if (!String(field.value || "").trim()) {

        field.focus();

        field.reportValidity();

        return false;
      }

      if (!field.checkValidity()) {

        field.focus();

        field.reportValidity();

        return false;
      }
    }

    if (currentStep === 1) {
      emailInput.value =
        String(emailInput.value || "").trim();

      emailConfirmInput.value =
        String(emailConfirmInput.value || "").trim();

      const normalizedEmail =
        emailInput.value.toLowerCase();

      const normalizedEmailConfirm =
        emailConfirmInput.value.toLowerCase();

      emailConfirmInput.setCustomValidity("");

      if (normalizedEmail !== normalizedEmailConfirm) {

        emailConfirmInput.setCustomValidity(
          "Los correos no coinciden. Volvé a escribirlos."
        );

        emailConfirmInput.focus();
        emailConfirmInput.reportValidity();

        return false;
      }


      nameInput.value =
        normalizePersonName(nameInput.value);

      surnameInput.value =
        normalizePersonName(surnameInput.value);

      if (!foreignIdentification.checked) {

        const dni =
          cleanDni(dniInput.value);

        dniInput.value =
          dni;

        const dniNumber =
          Number(dni);

        if (
          !Number.isInteger(dniNumber) ||
          dniNumber < 1000000 ||
          dniNumber > 99999999
        ) {

          dniInput.focus();

          alert(
            "Revisá el DNI. Debe estar entre 1.000.000 y 99.999.999 y escribirse sin puntos."
          );

          return false;
        }

      } else {

        const foreignId =
          String(dniInput.value || "")
            .trim();

        if (foreignId.length < 4) {

          dniInput.focus();

          alert(
            "Ingresá una identificación extranjera válida."
          );

          return false;
        }
      }

      phoneCountryInput.value =
        normalizeCountryCode(
          phoneCountryInput.value
        );

      phoneAreaInput.value =
        cleanPhoneDigits(
          phoneAreaInput.value
        );

      phoneNumberInput.value =
        cleanPhoneDigits(
          phoneNumberInput.value
        );

      if (
        !phoneCountryInput.value ||
        phoneAreaInput.value.length < 2 ||
        phoneNumberInput.value.length < 5
      ) {

        alert(
          "Revisá el teléfono. Necesitamos código de país, código de área y número."
        );

        return false;
      }
    }

    if (currentStep === 2) {

      const twitch =
        cleanTwitch(twitchInput.value);

      twitchInput.value =
        twitch;

      if (
        twitch.length < 3 ||
        !/^[a-z0-9_]+$/i.test(twitch)
      ) {

        twitchInput.focus();

        alert(
          "Revisá el usuario de Twitch. Escribí solamente el nombre de usuario, sin @ ni enlaces."
        );

        return false;
      }
    }

    return true;
  }

  function prettySelectValue(
    fieldName,
    rawValue
  ) {

    const field =
      form.elements[fieldName];

    if (
      !field ||
      field.tagName !== "SELECT"
    ) {
      return rawValue;
    }

    return (
      field.options[field.selectedIndex]
        ?.textContent
        ?.trim() ||
      rawValue
    );
  }

  function addSummaryItem(
    label,
    value
  ) {

    const item =
      document.createElement("div");

    item.className =
      "registration-summary-item";

    const small =
      document.createElement("small");

    small.textContent =
      label;

    const strong =
      document.createElement("strong");

    strong.textContent =
      value || "No informado";

    item.append(
      small,
      strong
    );

    summary.appendChild(item);
  }

  function paintSummary() {

    const data =
      collectData();

    summary.innerHTML = "";

    addSummaryItem(
      "Nombre y apellido",
      `${data.nombre} ${data.apellido}`.trim()
    );

    addSummaryItem(
      data.identificacion_extranjera
        ? "Identificación"
        : "DNI",
      data.dni
    );

    addSummaryItem(
      "Correo",
      data.email
    );

    addSummaryItem(
      "WhatsApp",
      data.telefono
    );

    addSummaryItem(
      "Twitch",
      data.twitch
        ? `@${data.twitch}`
        : ""
    );

    addSummaryItem(
      "Cómo se enteró",
      prettySelectValue(
        "como_te_enteraste",
        data.como_te_enteraste
      )
    );

    addSummaryItem(
      "Experiencia previa",
      prettySelectValue(
        "experiencia_previa",
        data.experiencia_previa
      )
    );

    addSummaryItem(
      "Ubicación",
      [
        data.localidad,
        data.provincia
      ]
        .filter(Boolean)
        .join(", ")
    );
  }

  function applyTheme(theme) {

    const cleanTheme =
      theme === "light"
        ? "light"
        : "dark";

    document.documentElement
      .setAttribute(
        "data-theme",
        cleanTheme
      );

    localStorage.setItem(
      THEME_KEY,
      cleanTheme
    );

    const icon =
      themeToggle.querySelector("i");

    icon.className =
      cleanTheme === "dark"
        ? "fa-solid fa-moon"
        : "fa-solid fa-sun";

    themeToggle.title =
      cleanTheme === "dark"
        ? "Cambiar a modo claro"
        : "Cambiar a modo oscuro";
  }

  function initTheme() {

    const saved =
      localStorage.getItem(THEME_KEY);

    applyTheme(
      saved === "light"
        ? "light"
        : "dark"
    );
  }

  function paintSuccess(result = {}) {

    const data =
      collectData();

    document.getElementById(
      "successName"
    ).textContent =
      `${data.nombre} ${data.apellido}`.trim();

    document.getElementById(
      "successTwitch"
    ).textContent =
      data.twitch
        ? `@${data.twitch}`
        : "—";

        const successMessage =
      document.getElementById("successMessage");

    if (result.email_sent === true) {

      successMessage.innerHTML =
        'Te enviamos un correo de confirmación con la información para ingresar al <strong>Classroom</strong>. ' +
        'Buscá el mensaje enviado por <strong>Profesor Andres Coria &lt;cursos@andyazhtec.com&gt;</strong>. ' +
        'Si no lo encontrás en tu bandeja de entrada, revisá <strong>Spam / Correo no deseado / Promociones</strong>.';

    } else {

      successMessage.innerHTML =
        'Tu inscripción quedó registrada correctamente, pero no pudimos enviar el correo de confirmación en este momento. ' +
        'Tu lugar en <strong>AyRPC 2026</strong> está confirmado igualmente.';
    }

form.closest(
      ".registration-card"
    ).hidden = true;

    document.querySelector(
      ".registration-autosave-bar"
    ).hidden = true;

    success.hidden = false;

    window.scrollTo({
      top:
        Math.max(
          success.offsetTop - 30,
          0
        ),
      behavior: "smooth"
    });
  }

  // -------------------------------------------------------
  // Eventos
  // -------------------------------------------------------

    // -------------------------------------------------------
  // Confirmación manual del correo
  // -------------------------------------------------------

  emailInput.addEventListener(
    "input",
    () => {

      if (emailConfirmInput.value) {
        emailConfirmInput.value = "";
      }

      emailConfirmInput.setCustomValidity("");
    }
  );

  emailConfirmInput.addEventListener(
    "input",
    () => {
      emailConfirmInput.setCustomValidity("");
    }
  );

  for (const blockedEvent of ["paste", "drop"]) {

    emailConfirmInput.addEventListener(
      blockedEvent,
      (event) => {

        event.preventDefault();

        emailConfirmInput.setCustomValidity(
          "Por seguridad, volvé a escribir el correo manualmente."
        );

        emailConfirmInput.reportValidity();

        window.setTimeout(
          () => emailConfirmInput.setCustomValidity(""),
          1800
        );
      }
    );
  }

  function updateCriticalContactReview() {

    reviewEmail.textContent =
      String(emailInput.value || "").trim() || "—";

    reviewPhone.textContent =
      buildPhoneValue({
        telefono_pais:
          phoneCountryInput.value,
        telefono_area:
          phoneAreaInput.value,
        telefono_numero:
          phoneNumberInput.value
      }) || "—";
  }

  form.addEventListener(
    "input",
    updateCriticalContactReview
  );

  form.addEventListener(
    "change",
    updateCriticalContactReview
  );

  updateCriticalContactReview();

form.addEventListener(
    "input",
    scheduleSave
  );

  form.addEventListener(
    "change",
    scheduleSave
  );

  dniInput.addEventListener(
    "input",
    () => {

      if (foreignIdentification.checked) {
        return;
      }

      const clean =
        cleanDni(dniInput.value);

      if (dniInput.value !== clean) {
        dniInput.value = clean;
      }
    }
  );

  function updateIdentificationMode() {

    const foreign =
      foreignIdentification.checked;

    const fieldContainer =
      dniInput.closest(".registration-field");

    fieldContainer?.classList.toggle(
      "foreign-identification-active",
      foreign
    );

    if (foreign) {

      identificationLabel.innerHTML =
        'Identificación extranjera <b>*</b>';

      identificationHelp.textContent =
        "Podés ingresar pasaporte, cédula u otra identificación oficial de tu país.";

      dniInput.placeholder =
        "Pasaporte / identificación";

      dniInput.inputMode =
        "text";

      dniInput.minLength =
        4;

      dniInput.maxLength =
        30;

    } else {

      identificationLabel.innerHTML =
        'DNI argentino <b>*</b>';

      identificationHelp.textContent =
        "Ingresá entre 1.000.000 y 99.999.999, sin puntos. Si ya participaste de otra edición de AyRPC, utilizaremos este dato para reconocer tu mismo perfil.";

      dniInput.placeholder =
        "Ej: 30123456";

      dniInput.inputMode =
        "numeric";

      dniInput.minLength =
        7;

      dniInput.maxLength =
        8;

      dniInput.value =
        cleanDni(dniInput.value);
    }

    scheduleSave();
  }

  foreignIdentification.addEventListener(
    "change",
    updateIdentificationMode
  );

  function normalizeNameField(field) {

    field.value =
      normalizePersonName(field.value);

    scheduleSave();
  }

  nameInput.addEventListener(
    "blur",
    () => normalizeNameField(nameInput)
  );

  surnameInput.addEventListener(
    "blur",
    () => normalizeNameField(surnameInput)
  );

  phoneCountryInput.addEventListener(
    "blur",
    () => {

      phoneCountryInput.value =
        normalizeCountryCode(
          phoneCountryInput.value
        );

      scheduleSave();
    }
  );

  phoneAreaInput.addEventListener(
    "input",
    () => {

      phoneAreaInput.value =
        cleanPhoneDigits(
          phoneAreaInput.value
        );
    }
  );

  phoneNumberInput.addEventListener(
    "input",
    () => {

      phoneNumberInput.value =
        cleanPhoneDigits(
          phoneNumberInput.value
        );
    }
  );

  twitchInput.addEventListener(
    "blur",
    () => {

      twitchInput.value =
        cleanTwitch(twitchInput.value);

      scheduleSave();
    }
  );

  prevButton.addEventListener(
    "click",
    () => {

      showStep(
        currentStep - 1
      );
    }
  );

  nextButton.addEventListener(
    "click",
    () => {

      if (!validateCurrentStep()) {
        return;
      }

      showStep(
        currentStep + 1
      );
    }
  );

  form.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      if (!validateCurrentStep()) {
        return;
      }

      if (!turnstileToken) {

        ensureTurnstileRendered();

        alert(
          "Esperá un momento y completá la verificación de seguridad antes de confirmar la inscripción."
        );

        return;
      }

      const data =
        collectData();

      const payload =
        buildRegistrationPayload(data);

      const originalButtonHtml =
        submitButton.innerHTML;

      submitButton.disabled = true;

      submitButton.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';

      try {

        const response =
          await fetch(
            REGISTRATION_ENDPOINT,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify(payload)
            }
          );

        const result =
          await readApiResponse(response);

        if (!response.ok) {

          resetTurnstileVerification();

          if (response.status === 409) {

            alert(
              result.detail ||
              "La identificación ingresada ya está asociada a otro usuario de Twitch. Revisá los datos o contactanos."
            );

            return;
          }

          if (response.status === 403) {

            alert(
              "No pudimos validar la verificación de seguridad. Volvé a verificarte e intentá nuevamente."
            );

            return;
          }

          alert(
            result.detail ||
            "No pudimos completar la inscripción. Revisá los datos e intentá nuevamente."
          );

          return;
        }

        clearDraft();

        paintSuccess(result);

      } catch (error) {

        console.error(
          "Error enviando inscripción AyRPC 2026:",
          error
        );

        resetTurnstileVerification();

        alert(
          "No pudimos comunicarnos con el servidor. Tus datos siguen guardados en este navegador; podés volver a intentarlo."
        );

      } finally {

        submitButton.disabled = false;

        submitButton.innerHTML =
          originalButtonHtml;
      }
    }
  );

  themeToggle.addEventListener(
    "click",
    () => {

      const currentTheme =
        document.documentElement
          .getAttribute("data-theme");

      applyTheme(
        currentTheme === "dark"
          ? "light"
          : "dark"
      );
    }
  );

  resumeButton.addEventListener(
    "click",
    () => {

      const draft =
        readDraft();

      restoreDraft(draft);

      hideResumeModal();
    }
  );

  restartButton.addEventListener(
    "click",
    () => {

      clearDraft();

      form.reset();

      currentStep = 1;

      updateDraftPercentage({});

      showStep(
        1,
        false
      );

      hideResumeModal();
    }
  );

  restartDemoButton.addEventListener(
    "click",
    () => {

      clearDraft();

      form.reset();

      success.hidden = true;

      card.hidden = false;

      document.querySelector(
        ".registration-autosave-bar"
      ).hidden = false;

      currentStep = 1;

      updateDraftPercentage({});

      showStep(
        1,
        false
      );
    }
  );

  // -------------------------------------------------------
  // Inicio
  // -------------------------------------------------------

  initTheme();

  updateDraftPercentage(
    collectData()
  );

  showStep(
    1,
    false
  );

  setTimeout(
    showResumeModalIfNeeded,
    120
  );

})();