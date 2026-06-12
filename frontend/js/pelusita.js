(function(){
  const ASSET_BASE = "media/pelusita/";
  const SOUND_BASE = "media/sounds/";
  const EXAMPRO_URL = "https://exampro-backend-1n6d.onrender.com/login";

  /*
    Estados visuales de Pelusita
    --------------------------------
    pelusita-state1 = standby / idle
    pelusita-state2 = saludo / welcome
    pelusita-state3 = pensativa / see
    pelusita-state4 = festejo / happy
    pelusita-state5 = alerta / horror
    pelusita-state6 = entrada / arriving.gif
  */
  const PELUSITA_STATES = {
    "pelusita-state1": {
      key: "idle",
      img: ASSET_BASE + "idle.png",
      anim: "pelusitaFloat 4s ease-in-out infinite",
      phrases: [
        "Estoy por acá si necesitás ayuda.",
        "Classroom listo.",
        "Tocame cuando quieras consultar algo.",
        "Te acompaño durante el recorrido."
      ],
      // sound: SOUND_BASE + "click.mp3"
    },

    "pelusita-state2": {
      key: "welcome",
      img: ASSET_BASE + "welcome.png",
      anim: "pelusitaBounce .9s cubic-bezier(.34,1.56,.64,1) forwards",
      phrases: [
        "¡Hola! Soy Pelusita.",
        "Bienvenido al Classroom.",
        "Estoy lista para ayudarte.",
        "Vamos paso a paso."
      ],
      // sound: SOUND_BASE + "duck.mp3"
    },

    "pelusita-state3": {
      key: "see",
      img: ASSET_BASE + "see.png",
      anim: "pelusitaWobble .8s ease forwards",
      phrases: [
        "A ver...",
        "Revisemos esto.",
        "Te explico.",
        "Miremos bien la información."
      ],
      // sound: SOUND_BASE + "close.mp3"
    },

    "pelusita-state4": {
      key: "happy",
      img: ASSET_BASE + "happy.png",
      anim: "pelusitaBounce .8s cubic-bezier(.34,1.56,.64,1) forwards",
      phrases: [
        "¡Perfecto!",
        "¡Bien ahí!",
        "Listo, seguimos.",
        "Eso salió bien."
      ],
      // sound: SOUND_BASE + "click.mp3"
    },

    "pelusita-state5": {
      key: "horror",
      img: ASSET_BASE + "horror.png",
      anim: "pelusitaShake .6s ease forwards",
      phrases: [
        "Algo no salió como esperaba.",
        "Revisemos ese dato.",
        "Puede faltar información.",
        "Ojo, acá hay que verificar."
      ],
      // sound: SOUND_BASE + "error-simple.mp3"
    },

    "pelusita-state6": {
      key: "arriving",
      img: ASSET_BASE + "arriving.gif",
      anim: "none",
      phrases: [
        "Llegué.",
        "Pelusita online."
      ],
      // sound: SOUND_BASE + "duck.mp3"
    }
  };

  const STATE_ALIAS = {
    idle: "pelusita-state1",
    standby: "pelusita-state1",
    welcome: "pelusita-state2",
    wave: "pelusita-state2",
    see: "pelusita-state3",
    think: "pelusita-state3",
    thinking: "pelusita-state3",
    happy: "pelusita-state4",
    success: "pelusita-state4",
    horror: "pelusita-state5",
    error: "pelusita-state5",
    alert: "pelusita-state5",
    arriving: "pelusita-state6"
  };

  const IMGS = {
    idle: PELUSITA_STATES["pelusita-state1"].img,
    welcome: PELUSITA_STATES["pelusita-state2"].img,
    wave: ASSET_BASE + "wave.png",
    see: PELUSITA_STATES["pelusita-state3"].img,
    happy: PELUSITA_STATES["pelusita-state4"].img,
    horror: PELUSITA_STATES["pelusita-state5"].img,
    arriving: PELUSITA_STATES["pelusita-state6"].img
  };

  const PAGE_COPY = {
    home: {
      intro:
`¡Hola! Soy Pelusita.

Estoy para guiarte dentro del Classroom. Desde acá podés entrar a tus cursos, revisar materiales, ver avisos y acceder a ExamPro cuando corresponda.`,

      menu: [
        { text:"📚 Ver cursos", action: () => openUrl("cursos.html"), cls:"pelusita-opt-primary", state:"pelusita-state3" },
        { text:"📝 Ir a ExamPro", action: () => openExamPro(), cls:"pelusita-opt-primary", state:"pelusita-state4" },
        { text:"📣 ¿Qué aparecerá en Actividad reciente?", action: () => showCustomMsg("newsletter") },
        { text:"🆘 Necesito ayuda", action: () => showCustomMsg("soporte") },
        { text:"Cerrar", action: () => closeDialog() }
      ]
    },

    exampro: {
      intro:
`Soy Pelusita.

En esta pantalla te dejo el acceso a ExamPro. Se abre en una pestaña nueva para que puedas ver exámenes, recuperatorios y devoluciones sin cerrar el Classroom.`,

      menu: [
        { text:"🚀 Abrir ExamPro", action: () => openExamPro(), cls:"pelusita-opt-primary", state:"pelusita-state4" },
        { text:"📘 ¿Para qué sirve esta pantalla?", action: () => showCustomMsg("que_es") },
        { text:"📝 ¿Cómo veo mis exámenes?", action: () => showCustomMsg("examenes") },
        { text:"📬 ¿Dónde veo devoluciones?", action: () => showCustomMsg("devoluciones") },
        { text:"🔐 ¿Por qué se abre aparte?", action: () => showCustomMsg("seguridad") },
        { text:"🆘 Contactar al profe", action: () => showCustomMsg("soporte") },
        { text:"Cerrar", action: () => closeDialog() }
      ]
    },

    generic: {
      intro:
`Soy Pelusita.

Estoy para ayudarte a moverte por el Classroom y encontrar rápido cursos, materiales, avisos y accesos importantes.`,

      menu: [
        { text:"📚 Ver cursos", action: () => openUrl("cursos.html"), cls:"pelusita-opt-primary", state:"pelusita-state3" },
        { text:"📝 Ir a ExamPro", action: () => openExamPro(), cls:"pelusita-opt-primary", state:"pelusita-state4" },
        { text:"🆘 Necesito ayuda", action: () => showCustomMsg("soporte") },
        { text:"Cerrar", action: () => closeDialog() }
      ]
    }
  };

  const MESSAGES = {
    newsletter: {
      state: "pelusita-state3",
      msg:
`📣 ACTIVIDAD RECIENTE

Más adelante este bloque va a funcionar como un panel de novedades: anuncios del curso, recordatorios, accesos importantes y avisos de ExamPro.

Por ahora queda preparado como sección "Próximamente".`,
      opts: backOpts()
    },

    que_es: {
      state: "pelusita-state3",
      msg:
`📘 CLASSROOM + EXAMPRO

Classroom concentra el recorrido del curso: clases, materiales, avisos y accesos.

ExamPro se usa para consultar evaluaciones, recuperatorios y devoluciones corregidas.`,
      opts: backOpts()
    },

    examenes: {
      state: "pelusita-state3",
      msg:
`📝 EXÁMENES

Entrá a ExamPro con tu usuario de Twitch y DNI.

Ahí vas a ver las evaluaciones o recuperatorios que estén habilitados para tu alumno.`,
      opts: [
        { text:"🚀 Abrir ExamPro", action: () => openExamPro(), cls:"pelusita-opt-primary", state:"pelusita-state4" },
        { text:"← Volver", action: () => openMain() }
      ]
    },

    devoluciones: {
      state: "pelusita-state3",
      msg:
`📬 DEVOLUCIONES

Cuando haya una corrección disponible, vas a poder verla desde ExamPro.

El Classroom queda abierto para que puedas volver al curso después.`,
      opts: [
        { text:"🚀 Abrir ExamPro", action: () => openExamPro(), cls:"pelusita-opt-primary", state:"pelusita-state4" },
        { text:"← Volver", action: () => openMain() }
      ]
    },

    seguridad: {
      state: "pelusita-state3",
      msg:
`🔐 ¿POR QUÉ SE ABRE APARTE?

ExamPro se abre en una pestaña nueva para evitar problemas de sesión, cookies o autenticación dentro del Classroom.

Así se mantiene más estable y no se pierde el recorrido del curso.`,
      opts: backOpts()
    },

    soporte: {
      state: "pelusita-state3",
      msg:
`🆘 SOPORTE

Si algo no aparece, tus datos no coinciden o no podés ingresar, contactá al profe indicando:

• Nombre completo
• DNI
• Usuario de Twitch
• Qué problema estás viendo`,
      opts: [
        { text:"💬 WhatsApp", action: () => openUrl("https://wa.me/5492236689580", true), cls:"pelusita-opt-wa", state:"pelusita-state4" },
        { text:"✉️ Email", action: () => openUrl("mailto:acoria@frba.utn.edu.ar", true), cls:"pelusita-opt-mail", state:"pelusita-state4" },
        { text:"← Volver", action: () => openMain() }
      ]
    }
  };

  let open = false;
  let bubbleTimer = null;
  let idleTimer = null;

  function getPageContext(){
    if(document.body.classList.contains("page-home")) return "home";
    if(document.body.classList.contains("page-exampro")) return "exampro";

    const file = (location.pathname.split("/").pop() || "").toLowerCase();
    if(file === "index.html" || file === "") return "home";
    if(file === "exampro.html") return "exampro";

    return "generic";
  }

  function resolveState(state){
    return PELUSITA_STATES[state] ? state : (STATE_ALIAS[state] || "pelusita-state1");
  }

  function backOpts(){
    return [{ text:"← Volver", action: () => openMain() }];
  }

  function rnd(arr){
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function el(id){
    return document.getElementById(id);
  }

  function playPelusitaSound(state){
    const stateKey = resolveState(state);
    const cfg = PELUSITA_STATES[stateKey];
    if(!cfg || !cfg.sound) return;

    /*
      Sonidos preparados para activar después.
      Para habilitarlos, descomentá este bloque.

      try {
        const audio = new Audio(cfg.sound);
        audio.volume = 0.35;
        audio.play().catch(() => {});
      } catch(e) {}
    */
  }

  function build(){
    if(el("pelusitaWrapper")) return;

    document.body.insertAdjacentHTML("beforeend", `
      <div id="pelusitaWrapper" class="pelusita-wrapper">
        <div id="pelusitaDialog" class="pelusita-dialog">
          <div class="pelusita-dialog-header">
            <img src="${IMGS.wave}" class="pelusita-dialog-avatar" alt="Pelusita">
            <span class="pelusita-dialog-name">Pelusita</span>
            <span class="pelusita-dialog-close" id="pelusitaClose">✕</span>
          </div>
          <div id="pelusitaDialogMsg" class="pelusita-dialog-msg"></div>
          <div id="pelusitaDialogOpts" class="pelusita-dialog-opts"></div>
        </div>

        <div id="pelusitaBubble" class="pelusita-bubble"></div>

        <div id="pelusitaChar" class="pelusita-char" title="Pelusita — click para ayuda">
          <img id="pelusitaImg" class="pelusita-img" src="${IMGS.idle}" alt="Pelusita">
        </div>
      </div>
    `);

    el("pelusitaChar").addEventListener("click", toggleDialog);
    el("pelusitaClose").addEventListener("click", closeDialog);

    document.addEventListener("click", function(e){
      if(open && !e.target.closest("#pelusitaWrapper")){
        closeDialog();
      }
    });

    arriving();
  }

  function setImg(state){
    const img = el("pelusitaImg");
    if(!img) return;

    const stateKey = resolveState(state);
    const cfg = PELUSITA_STATES[stateKey];
    const src = cfg?.img || IMGS.idle;

    if(img.getAttribute("src") === src) return;

    img.classList.add("switching");

    setTimeout(() => {
      img.setAttribute("src", src);
      img.classList.remove("switching");
    }, 100);
  }

  function setState(state){
    const char = el("pelusitaChar");
    const bubble = el("pelusitaBubble");
    if(!char || !bubble) return;

    const stateKey = resolveState(state);
    const cfg = PELUSITA_STATES[stateKey] || PELUSITA_STATES["pelusita-state1"];

    clearTimeout(bubbleTimer);
    clearTimeout(idleTimer);

    setImg(stateKey);
    playPelusitaSound(stateKey);

    char.dataset.pelusitaState = stateKey;
    char.style.animation = "none";
    void char.offsetHeight;
    char.style.animation = cfg.anim || PELUSITA_STATES["pelusita-state1"].anim;

    if(stateKey !== "pelusita-state1"){
      bubble.textContent = rnd(cfg.phrases || PELUSITA_STATES["pelusita-state1"].phrases);
      bubble.classList.add("show");
      bubbleTimer = setTimeout(() => setState("pelusita-state1"), 3500);
    }else{
      bubble.classList.remove("show");

      idleTimer = setTimeout(function tick(){
        if(open) return;

        bubble.textContent = rnd(PELUSITA_STATES["pelusita-state1"].phrases);
        bubble.classList.add("show");

        setTimeout(() => bubble.classList.remove("show"), 3000);
        idleTimer = setTimeout(tick, 14000);
      }, 7000);
    }
  }

  function renderOptions(opts){
    const box = el("pelusitaDialogOpts");
    if(!box) return;

    box.innerHTML = opts.map((o, i) =>
      `<button class="pelusita-opt ${o.cls || ""}" data-pelusita-opt="${i}">${o.text}</button>`
    ).join("");

    box.querySelectorAll(".pelusita-opt").forEach(btn => {
      btn.addEventListener("click", function(ev){
        ev.stopPropagation();

        const i = parseInt(btn.getAttribute("data-pelusita-opt"), 10);
        const opt = opts[i];

        if(opt?.state) setState(opt.state);
        opt.action();
      });
    });
  }

  function openMain(){
    const page = PAGE_COPY[getPageContext()] || PAGE_COPY.generic;

    el("pelusitaDialogMsg").textContent = page.intro;
    renderOptions(page.menu);

    el("pelusitaDialog").classList.add("show");
    open = true;

    setState("pelusita-state2");
  }

  function showCustomMsg(key){
    const data = MESSAGES[key];
    if(!data) return;

    el("pelusitaDialogMsg").textContent = data.msg;
    renderOptions(data.opts || backOpts());

    el("pelusitaDialog").classList.add("show");
    open = true;

    setState(data.state || "pelusita-state3");
  }

  function closeDialog(){
    const dlg = el("pelusitaDialog");
    if(dlg) dlg.classList.remove("show");

    open = false;
    setState("pelusita-state1");
  }

  function toggleDialog(){
    if(open){
      closeDialog();
      return;
    }

    setState("pelusita-state2");
    setTimeout(openMain, 260);
  }

  function openUrl(url, blank=false){
    if(blank || /^https?:|^mailto:/.test(url)){
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.href = url;
  }

  function openExamPro(){
    setState("pelusita-state4");
    window.open(EXAMPRO_URL, "_blank", "noopener,noreferrer");
  }

  function arriving(){
    const wrap = el("pelusitaWrapper");
    const img = el("pelusitaImg");
    const char = el("pelusitaChar");

    if(!wrap || !img || !char) return;

    wrap.style.transition = "none";
    wrap.style.transform = "translateY(160px)";
    wrap.style.opacity = "0";

    img.src = PELUSITA_STATES["pelusita-state6"].img;
    char.dataset.pelusitaState = "pelusita-state6";
    char.style.animation = "none";

    playPelusitaSound("pelusita-state6");

    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.style.transition = "transform .55s cubic-bezier(.34,1.56,.64,1),opacity .4s ease";
      wrap.style.transform = "translateY(0)";
      wrap.style.opacity = "1";
    }));

    setTimeout(() => {
      wrap.style.transition = "";
      wrap.style.transform = "";
      wrap.style.opacity = "";
      setState("pelusita-state1");
    }, 2800);
  }

  window.PelusitaClassroom = {
    open: openMain,
    close: closeDialog,
    state: setState,
    msg: showCustomMsg,
    openExamPro,
    states: PELUSITA_STATES
  };

  document.addEventListener("DOMContentLoaded", build);
})();