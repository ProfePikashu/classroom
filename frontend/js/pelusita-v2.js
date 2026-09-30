(() => {
  "use strict";

  const VERSION = "2.0.0-alpha.1";

  const ASSETS = {
    idle: "media/pelusita/idle.png",
    arriving: "media/pelusita/arriving.gif",
    greeting: "media/pelusita/welcome.png",
    wave: "media/pelusita/wave.png",
    thinking: "media/pelusita/see.png",
    success: "media/pelusita/happy.png",
    error: "media/pelusita/horror.png",
    goodbye: "media/pelusita/wave.png"
  };

  const STORAGE = {
    speech: "pelusita-v2-speech-enabled",
    voice: "pelusita-v2-voice",
    intro: "pelusita-v2-intro-seen"
  };

  const state = {
    ready: false,
    open: false,
    visual: "idle",
    tutorials: new Map(),
    faq: [],
    tutorial: null,
    step: -1,
    target: null,
    context: {}
  };

  const els = {};

  const $ = (s, root = document) => root.querySelector(s);

  const clamp = (n, min, max) =>
    Math.max(min, Math.min(max, n));

  function emit(name, detail = {}) {
    window.dispatchEvent(new CustomEvent(`pelusita:${name}`, {
      detail: { ...detail, version: VERSION }
    }));
  }

  function getPage() {
    return (location.pathname.split("/").pop() || "index.html").toLowerCase();
  }

  function getContext() {
    const page = getPage();

    let course = document.body?.dataset?.course || null;

    if (!course) {
      if (page.includes("ayrpc-2026")) course = "ayrpc-2026";
      if (page.includes("ayrpc-2025")) course = "ayrpc-2025";
    }

    return {
      page,
      course,
      role: document.body?.dataset?.role || null,
      path: location.pathname,
      ...state.context
    };
  }

  function safeContext(input = {}) {
    const blocked = /token|secret|jwt|authorization|service.?role|api.?key/i;
    const out = {};

    for (const [key, value] of Object.entries(input)) {
      if (!blocked.test(key)) out[key] = value;
    }

    return out;
  }

  class PelusitaSpeech {
    static isFemaleCandidate(voice) {
      const femaleNames = [
        "elena",
        "dalia",
        "ximena",
        "lia",
        "laia",
        "vera",
        "triana",
        "estrella",
        "irene",
        "marta",
        "salome",
        "catalina",
        "camila",
        "paloma",
        "valentina",
        "paola",
        "yolanda",
        "karina",
        "sofia",
        "maria",
        "margarita",
        "belkys",
        "lorena",
        "tania",
        "helena",
        "laura",
        "sabina"
      ];

      const name = String(voice?.name || "").toLowerCase();

      return femaleNames.some(candidate =>
        name.includes(candidate)
      );
    }

    constructor() {
      this.enabled = false;
      this.voiceName = localStorage.getItem(STORAGE.voice) || "";
      this.voices = [];

      if ("speechSynthesis" in window) {
        speechSynthesis.addEventListener?.(
          "voiceschanged",
          () => this.loadVoices()
        );

        this.loadVoices();
      }
    }

    loadVoices() {
      if (!("speechSynthesis" in window)) return;

      this.voices = speechSynthesis.getVoices() || [];

      if (!els.voice) return;

      els.voice.innerHTML = "";

      const auto = document.createElement("option");
      auto.value = "";
      auto.textContent = "Automática";
      els.voice.appendChild(auto);

      this.voices
        .filter(v => /^es/i.test(v.lang) && PelusitaSpeech.isFemaleCandidate(v))
        .sort((a, b) => {
          const aa = /es[-_]AR/i.test(a.lang) ? 0 : 1;
          const bb = /es[-_]AR/i.test(b.lang) ? 0 : 1;
          return aa - bb;
        })
        .forEach(v => {
          const option = document.createElement("option");
          option.value = v.name;
          option.textContent = `${v.name} · ${v.lang}`;
          els.voice.appendChild(option);
        });

      els.voice.value = this.voiceName;
    }

    chooseVoice() {
      if (this.voiceName) {
        const exact = this.voices.find(v => v.name === this.voiceName);

        if (exact && PelusitaSpeech.isFemaleCandidate(exact)) {
          return exact;
        }
      }

      const preferred = [
        "Elena",
        "Dalia",
        "Ximena",
        "Lia",
        "Laia",
        "Vera",
        "Triana",
        "Estrella",
        "Irene",
        "Marta",
        "Salome",
        "Catalina",
        "Camila",
        "Paloma",
        "Valentina",
        "Paola",
        "Yolanda",
        "Karina",
        "Sofia",
        "Maria",
        "Margarita",
        "Belkys",
        "Lorena",
        "Tania",
        "Helena",
        "Laura",
        "Sabina"
      ];

      for (const name of preferred) {
        const voice = this.voices.find(v =>
          /^es/i.test(v.lang) &&
          v.name.toLowerCase().includes(name.toLowerCase())
        );

        if (voice) return voice;
      }

      return null;
    }

    enable(value) {
      this.enabled = Boolean(value);
      localStorage.setItem(STORAGE.speech, String(this.enabled));

      if (!this.enabled) speechSynthesis?.cancel?.();

      updateSpeechButton();
    }

    speak(text, options = {}) {
      if (
        !this.enabled ||
        !text ||
        !("speechSynthesis" in window)
      ) return;

      speechSynthesis.cancel();

      let spokenText = String(text || "").trim();

      if (spokenText) {
        spokenText = spokenText.replace(
          /([.!?]+)(\s|$)/g,
          ", nia$1$2"
        );

        if (!/[.!?]$/.test(spokenText)) {
          spokenText += ", nia.";
        }
      }

      const u = new SpeechSynthesisUtterance(spokenText);

      const voice = this.chooseVoice();

      if (!voice) {
        console.warn("[PelusitaV2] No encontré una voz femenina permitida.");
        return;
      }

      u.voice = voice;
      u.lang = voice.lang || "es-AR";
      u.rate = clamp(options.rate ?? 1.20, .7, 1.50);
      u.pitch = clamp(options.pitch ?? 2.0, .7, 2.0);
      u.volume = 1;

      speechSynthesis.speak(u);
    }

    stop() {
      speechSynthesis?.cancel?.();
    }
  }

  const speech = new PelusitaSpeech();

  function build() {
    if ($("#pelusitaV2")) return;

    const root = document.createElement("div");

    root.id = "pelusitaV2";

    root.innerHTML = `
      <div id="pelusitaV2Spotlight" class="pelusita-v2-spotlight">
        <div class="pelusita-v2-mask top"></div>
        <div class="pelusita-v2-mask left"></div>
        <div class="pelusita-v2-mask right"></div>
        <div class="pelusita-v2-mask bottom"></div>
        <div id="pelusitaV2Ring" class="pelusita-v2-ring"></div>
      </div>

      <button
        id="pelusitaV2Character"
        class="pelusita-v2-character"
        type="button"
        aria-label="Abrir Pelusita"
      >
        <img id="pelusitaV2Image" alt="Pelusita">
      </button>

      <section
        id="pelusitaV2Panel"
        class="pelusita-v2-panel"
        aria-live="polite"
      >
        <header class="pelusita-v2-header">

          <div>
            <small>Asistente del Classroom</small>
            <strong>Pelusita</strong>
          </div>

          <div class="pelusita-v2-header-actions">

            <button
              id="pelusitaV2Speech"
              type="button"
              title="Activar o desactivar voz"
            >
              🔊
            </button>

            <button
              id="pelusitaV2Close"
              type="button"
              title="Cerrar"
            >
              ✕
            </button>

          </div>

        </header>

        <div class="pelusita-v2-body">

          <p id="pelusitaV2Message">
            Estoy acá para ayudarte.
          </p>

          <div id="pelusitaV2Actions"></div>

        </div>

        <div
          id="pelusitaV2TutorialNav"
          class="pelusita-v2-tutorial-nav"
          hidden
        >

          <button id="pelusitaV2Prev" type="button">
            ← Atrás
          </button>

          <span id="pelusitaV2Progress"></span>

          <button id="pelusitaV2Next" type="button">
            Siguiente →
          </button>

          <button id="pelusitaV2Exit" type="button">
            Salir de la guía
          </button>

        </div>

        <details class="pelusita-v2-settings">

          <summary>Voz</summary>

          <label>
            Voz instalada
            <select id="pelusitaV2Voice"></select>
          </label>

        </details>

      </section>
    `;

    document.body.appendChild(root);

    els.root = root;
    els.character = $("#pelusitaV2Character");
    els.image = $("#pelusitaV2Image");
    els.panel = $("#pelusitaV2Panel");
    els.message = $("#pelusitaV2Message");
    els.actions = $("#pelusitaV2Actions");
    els.speech = $("#pelusitaV2Speech");
    els.close = $("#pelusitaV2Close");
    els.voice = $("#pelusitaV2Voice");
    els.spotlight = $("#pelusitaV2Spotlight");
    els.ring = $("#pelusitaV2Ring");
    els.nav = $("#pelusitaV2TutorialNav");
    els.prev = $("#pelusitaV2Prev");
    els.next = $("#pelusitaV2Next");
    els.exit = $("#pelusitaV2Exit");
    els.progress = $("#pelusitaV2Progress");

    const sidebarDock =
      document.getElementById("sidebarPelusitaDock");

    if (sidebarDock && els.character) {
      sidebarDock.appendChild(els.character);
      els.character.classList.add("docked");
    }

    els.character.addEventListener("click", toggle);

    els.close.addEventListener("click", close);

    els.speech.hidden = true;

    const voiceDetails =
      els.voice?.closest("details");

    if (voiceDetails) {
      voiceDetails.hidden = true;
    }

    els.speech.addEventListener("click", () => {
      speech.enable(!speech.enabled);
    });

    els.voice.addEventListener("change", e => {
      speech.voiceName = e.target.value;
      localStorage.setItem(STORAGE.voice, speech.voiceName);
    });

    els.prev.addEventListener("click", tutorialPrev);
    els.next.addEventListener("click", tutorialNext);
    els.exit.addEventListener("click", tutorialStop);

    window.addEventListener("resize", refreshSpotlight);
    window.addEventListener("scroll", refreshSpotlight, true);

    speech.loadVoices();
    updateSpeechButton();
    setState("idle");
  }

  function updateSpeechButton() {
    if (!els.speech) return;

    els.speech.textContent = speech.enabled
      ? "🔊"
      : "🔇";

    els.speech.title = speech.enabled
      ? "Desactivar voz"
      : "Activar voz";
  }

  function setState(name) {
    if (!ASSETS[name]) name = "idle";

    state.visual = name;

    if (!els.image) return;

    els.character.dataset.state = name;
    els.image.src = ASSETS[name];

    emit("state", { state: name });
  }

  function say(text, options = {}) {
    if (!text) return;

    els.message.textContent = text;

    if (options.state) {
      setState(options.state);
    }

    renderActions(options.actions || []);

    if (options.speak !== false) {
      speech.speak(text, options.tts || {});
    }
  }

  function renderActions(actions) {
    els.actions.innerHTML = "";

    for (const action of actions) {
      const button = document.createElement("button");

      button.type = "button";
      button.className =
        "pelusita-v2-action" +
        (action.primary ? " primary" : "");

      button.textContent = action.label;

      button.addEventListener(
        "click",
        () => action.onClick?.()
      );

      els.actions.appendChild(button);
    }
  }

  function open() {
    state.open = true;
    els.panel.classList.add("open");

    showHome();

    emit("open", {
      context: getContext()
    });
  }

  function close() {
    tutorialStop(true);

    state.open = false;

    els.panel.classList.remove("open");

    speech.stop();

    setState("goodbye");

    setTimeout(() => {
      if (!state.open) setState("idle");
    }, 900);

    emit("close");
  }

  function toggle() {
    state.open ? close() : open();
  }

  function showHome() {
    const ctx = getContext();

    const actions = state.faq
      .filter(item => matches(item, ctx))
      .slice(0, 6)
      .map(item => ({
        label: item.question,
        primary: item.primary,
        onClick: () => answer(item.id)
      }));

    if (
      ctx.page.includes("clases") &&
      state.tutorials.has("recover-class")
    ) {
      actions.unshift({
        label: "Guiame para recuperar una clase",
        primary: true,
        onClick: () => tutorialStart("recover-class")
      });
    }

    say(
      "¿Qué necesitás? Te lo puedo explicar o mostrar paso a paso.",
      {
        state: "greeting",
        speak: false,
        actions
      }
    );
  }

  function matches(item, ctx) {
    if (
      item.pages?.length &&
      !item.pages.includes(ctx.page)
    ) return false;

    if (
      item.courses?.length &&
      !item.courses.includes(ctx.course)
    ) return false;

    if (
      item.roles?.length &&
      !item.roles.includes(ctx.role)
    ) return false;

    return true;
  }

  function registerFaq(items) {
    if (!Array.isArray(items)) items = [items];

    for (const item of items) {
      if (
        !item?.id ||
        !item?.question ||
        !item?.short
      ) continue;

      state.faq.push(item);
    }
  }

  function answer(id) {
    const item = state.faq.find(x => x.id === id);

    if (!item) return;

    const actions = [];

    if (item.long) {
      actions.push({
        label: "Ver más",
        onClick: () => {
          say(item.long, {
            state: "thinking",
            actions: [{
              label: "Otra pregunta",
              onClick: showHome
            }]
          });
        }
      });
    }

    if (
      item.tutorial &&
      state.tutorials.has(item.tutorial)
    ) {
      actions.push({
        label: "Mostrame",
        primary: true,
        onClick: () =>
          tutorialStart(item.tutorial)
      });
    }

    actions.push({
      label: "Otra pregunta",
      onClick: showHome
    });

    say(item.short, {
      state: item.state || "thinking",
      actions
    });
  }

  function registerTutorial(id, tutorial) {
    if (
      !id ||
      !tutorial?.steps?.length
    ) return;

    state.tutorials.set(id, {
      id,
      title: tutorial.title || id,
      steps: tutorial.steps
    });
  }

  function resolveTarget(step) {
    if (
      typeof step.target === "function"
    ) {
      return step.target();
    }

    if (
      step.target instanceof Element
    ) {
      return step.target;
    }

    if (
      typeof step.target === "string"
    ) {
      return document.querySelector(step.target);
    }

    return null;
  }

  function tutorialStart(id) {
    const tutorial = state.tutorials.get(id);

    if (!tutorial) return;

    state.tutorial = tutorial;
    state.step = 0;

    els.nav.hidden = false;

    if (!state.open) {
      state.open = true;
      els.panel.classList.add("open");
    }

    renderTutorialStep();
  }

  function renderTutorialStep() {
    const tutorial = state.tutorial;

    if (!tutorial) return;

    const step =
      tutorial.steps[state.step];

    if (!step) {
      tutorialStop();
      return;
    }

    const target = resolveTarget(step);

    if (!target) {
      clearSpotlight();

      say(
        step.missing ||
        "No encuentro esa opción en esta pantalla.",
        {
          state: "error",
          actions: [{
            label: "Salir",
            onClick: tutorialStop
          }]
        }
      );

      return;
    }

    spotlight(target, step);

    els.progress.textContent =
      `${state.step + 1} / ${tutorial.steps.length}`;

    els.prev.disabled =
      state.step === 0;

    els.next.textContent =
      state.step === tutorial.steps.length - 1
        ? "Terminar ✓"
        : "Siguiente →";

    say(step.text, {
      state: step.state || "thinking"
    });
  }

  function tutorialNext() {
    if (!state.tutorial) return;

    if (
      state.step >=
      state.tutorial.steps.length - 1
    ) {
      tutorialStop(false, true);
      return;
    }

    state.step++;

    renderTutorialStep();
  }

  function tutorialPrev() {
    if (
      !state.tutorial ||
      state.step <= 0
    ) return;

    state.step--;

    renderTutorialStep();
  }

  function tutorialStop(
    silent = false,
    finished = false
  ) {
    clearSpotlight();

    state.tutorial = null;
    state.step = -1;

    if (els.nav) {
      els.nav.hidden = true;
    }

    speech.stop();

    if (silent) return;

    if (finished) {
      say(
        "¡Listo! Ya sabés cómo hacerlo, NYAAA!!",
        {
          state: "success",
          actions: [{
            label: "Otra pregunta",
            onClick: showHome
          }]
        }
      );
    } else {
      say(
        "Salimos de la guía. Cuando quieras seguimos, NYA!!",
        {
          state: "wave",
          actions: [{
            label: "Volver",
            onClick: showHome
          }]
        }
      );
    }
  }

  function spotlight(target, options = {}) {
    if (
      state.target &&
      state.target !== target
    ) {
      state.target.classList.remove(
        "pelusita-v2-target-pulse"
      );
    }

    state.target = target;

    els.spotlight.classList.add("active");

    document.documentElement.classList.add(
      "pelusita-tutorial-active"
    );

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });

    setTimeout(() => {
      refreshSpotlight();

      document
        .querySelectorAll(
          ".pelusita-v2-target-pulse"
        )
        .forEach(el => {
          el.classList.remove(
            "pelusita-v2-target-pulse"
          );
        });

      undockCharacterForGuide();

      positionPanelNear(target);

      positionCharacter(
        target,
        options.position
      );

      setTimeout(() => {
        if (state.target !== target) return;

        target.classList.add(
          "pelusita-v2-target-pulse"
        );
      }, 300);
    }, 320);
  }

  function refreshSpotlight() {
    if (!state.target) return;

    const r =
      state.target.getBoundingClientRect();

    const pad = 10;

    const top =
      clamp(r.top - pad, 0, innerHeight);

    const left =
      clamp(r.left - pad, 0, innerWidth);

    const right =
      clamp(r.right + pad, 0, innerWidth);

    const bottom =
      clamp(r.bottom + pad, 0, innerHeight);

    const topMask =
      $(".top", els.spotlight);

    const leftMask =
      $(".left", els.spotlight);

    const rightMask =
      $(".right", els.spotlight);

    const bottomMask =
      $(".bottom", els.spotlight);

    Object.assign(topMask.style, {
      left: "0",
      top: "0",
      width: "100vw",
      height: `${top}px`
    });

    Object.assign(bottomMask.style, {
      left: "0",
      top: `${bottom}px`,
      width: "100vw",
      height: `${innerHeight - bottom}px`
    });

    Object.assign(leftMask.style, {
      left: "0",
      top: `${top}px`,
      width: `${left}px`,
      height: `${bottom - top}px`
    });

    Object.assign(rightMask.style, {
      left: `${right}px`,
      top: `${top}px`,
      width: `${innerWidth - right}px`,
      height: `${bottom - top}px`
    });

    Object.assign(els.ring.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${right - left}px`,
      height: `${bottom - top}px`
    });
  }


  function undockCharacterForGuide() {
    if (!els.character) return;

    const root = document.body;

    if (els.character.parentElement !== root) {
      root.appendChild(els.character);
    }

    els.character.classList.remove("docked");
    els.character.classList.add("tutorial-floating");
  }

  function redockCharacterAfterGuide() {
    if (!els.character) return;

    const dock =
      document.getElementById("sidebarPelusitaDock");

    els.character.classList.remove(
      "tutorial-floating",
      "guiding"
    );

    els.character.style.removeProperty("--pelusita-x");
    els.character.style.removeProperty("--pelusita-y");

    if (dock) {
      dock.appendChild(els.character);
      els.character.classList.add("docked");
    }
  }


  function positionCharacter(target, preferred = "auto") {
    if (!target || !els.character) return;

    const r =
      target.getBoundingClientRect();

    const characterRect =
      els.character.getBoundingClientRect();

    const w =
      characterRect.width || 104;

    const h =
      characterRect.height || 122;

    const gap = 22;
    const edge = 12;

    const panelRect =
      els.panel?.classList.contains("guiding")
        ? els.panel.getBoundingClientRect()
        : null;


    function overlaps(a, b, padding = 0) {
      if (!a || !b) return false;

      return !(
        a.right + padding <= b.left ||
        a.left >= b.right + padding ||
        a.bottom + padding <= b.top ||
        a.top >= b.bottom + padding
      );
    }


    function coords(position) {
      let x;
      let y;

      if (position === "left") {
        x = r.left - w - gap;
        y =
          r.top +
          r.height / 2 -
          h / 2;
      }
      else if (position === "top") {
        x =
          r.left +
          r.width / 2 -
          w / 2;

        y =
          r.top -
          h -
          gap;
      }
      else if (position === "bottom") {
        x =
          r.left +
          r.width / 2 -
          w / 2;

        y =
          r.bottom +
          gap;
      }
      else {
        x =
          r.right +
          gap;

        y =
          r.top +
          r.height / 2 -
          h / 2;
      }

      return { x, y };
    }


    function candidateRect(x, y) {
      return {
        left: x,
        top: y,
        right: x + w,
        bottom: y + h
      };
    }


    const preferredPosition =
      preferred &&
      preferred !== "auto"
        ? preferred
        : null;

    const order = [];

    if (preferredPosition) {
      order.push(preferredPosition);
    }

    [
      "right",
      "left",
      "bottom",
      "top"
    ].forEach(position => {
      if (!order.includes(position)) {
        order.push(position);
      }
    });


    let chosen = null;

    for (const position of order) {
      const point =
        coords(position);

      const fitsViewport =
        point.x >= edge &&
        point.y >= edge &&
        point.x + w <=
          window.innerWidth - edge &&
        point.y + h <=
          window.innerHeight - edge;

      if (!fitsViewport) {
        continue;
      }

      const box =
        candidateRect(
          point.x,
          point.y
        );

      if (
        overlaps(
          box,
          r,
          8
        )
      ) {
        continue;
      }

      if (
        panelRect &&
        overlaps(
          box,
          panelRect,
          10
        )
      ) {
        continue;
      }

      chosen = point;
      break;
    }


    if (!chosen) {
      /*
       * Fallback:
       * elegimos arriba o abajo segun donde haya
       * mas espacio, pero nunca encima del target.
       */
      const spaceBelow =
        window.innerHeight - r.bottom;

      const spaceAbove =
        r.top;

      const fallbackPosition =
        spaceBelow >= spaceAbove
          ? "bottom"
          : "top";

      chosen =
        coords(fallbackPosition);

      chosen.x = clamp(
        chosen.x,
        edge,
        window.innerWidth -
          w -
          edge
      );

      chosen.y = clamp(
        chosen.y,
        edge,
        window.innerHeight -
          h -
          edge
      );
    }


    els.character.style.setProperty(
      "--pelusita-x",
      `${chosen.x}px`
    );

    els.character.style.setProperty(
      "--pelusita-y",
      `${chosen.y}px`
    );

    els.character.classList.add(
      "guiding"
    );
  }


  function positionPanelNear(target) {
    if (!target || !els.panel) return;

    if (window.innerWidth <= 760) {
      els.panel.classList.remove("guiding");
      return;
    }

    const r = target.getBoundingClientRect();

    const panelWidth = 370;
    const panelHeight = Math.min(
      els.panel.offsetHeight || 260,
      window.innerHeight - 30
    );

    const gap = 18;

    let x;
    let y;

    if (window.innerWidth - r.right >= panelWidth + gap) {
      x = r.right + gap;
      y = r.top;
    }
    else if (r.left >= panelWidth + gap) {
      x = r.left - panelWidth - gap;
      y = r.top;
    }
    else {
      x = (window.innerWidth - panelWidth) / 2;

      if (window.innerHeight - r.bottom >= panelHeight + gap) {
        y = r.bottom + gap;
      }
      else {
        y = r.top - panelHeight - gap;
      }
    }

    x = clamp(
      x,
      10,
      window.innerWidth - panelWidth - 10
    );

    y = clamp(
      y,
      10,
      window.innerHeight - panelHeight - 10
    );

    els.panel.style.setProperty(
      "--pelusita-panel-x",
      `${x}px`
    );

    els.panel.style.setProperty(
      "--pelusita-panel-y",
      `${y}px`
    );

    els.panel.classList.add("guiding");
  }
  function clearSpotlight() {
    document
      .querySelectorAll(
        ".pelusita-v2-target-pulse"
      )
      .forEach(el =>
        el.classList.remove(
          "pelusita-v2-target-pulse"
        )
      );

    state.target = null;

    els.spotlight?.classList.remove(
      "active"
    );

    document.documentElement.classList.remove(
      "pelusita-tutorial-active"
    );

    els.character?.classList.remove(
      "guiding"
    );

    redockCharacterAfterGuide();

    els.panel?.classList.remove(
      "guiding"
    );

    els.panel?.style.removeProperty(
      "--pelusita-panel-x"
    );

    els.panel?.style.removeProperty(
      "--pelusita-panel-y"
    );
  }

  function setContext(context = {}) {
    state.context = {
      ...state.context,
      ...safeContext(context)
    };
  }

  function intro() {
    if (
      sessionStorage.getItem(
        STORAGE.intro
      ) === "1"
    ) return;

    sessionStorage.setItem(
      STORAGE.intro,
      "1"
    );

    setState("arriving");

    setTimeout(
      () => setState("idle"),
      2600
    );
  }

  function init() {
    if (state.ready) return;

    build();

    state.ready = true;

    intro();

    emit("ready", {
      context: getContext()
    });
  }

  const api = {
    version: VERSION,

    init,
    open,
    close,
    toggle,
    say,
    answer,

    registerFaq,
    registerTutorial,

    tutorialStart,
    tutorialNext,
    tutorialPrev,
    tutorialStop,

    setState,
    setContext,
    getContext,

    speech: {
      enable: () => speech.enable(true),
      disable: () => speech.enable(false),
      toggle: () =>
        speech.enable(!speech.enabled),
      speak: (text, options) =>
        speech.speak(text, options),
      stop: () => speech.stop()
    }
  };

  window.PelusitaV2 = api;

  document.addEventListener(
    "DOMContentLoaded",
    init
  );
})();



