(function(){
  const ASSET_BASE = "media/pelusita/";
  const EXAMPRO_URL = "https://exampro-backend-1n6d.onrender.com/login";

  const IMGS = {
    idle: ASSET_BASE + "idle.png",
    happy: ASSET_BASE + "happy.png",
    horror: ASSET_BASE + "horror.png",
    see: ASSET_BASE + "see.png",
    wave: ASSET_BASE + "wave.png",
    welcome: ASSET_BASE + "welcome.png",
    arriving: ASSET_BASE + "arriving.gif"
  };

  const PHRASES = {
    idle:[
      "nya~ 🐱",
      "¿me llamaste? 👀",
      "*se acomoda* 🐾",
      "Classroom vigilado, nya~",
      "no cierres esta pestaña ♡"
    ],
    happy:[
      "¡purrrfecto! ♡",
      "NYA NYA!! 🎉",
      "¡bien ahí! 🐾"
    ],
    horror:[
      "NYA?! 😱",
      "*se eriza*",
      "algo no cargó, nya..."
    ],
    see:[
      "hmm... purr...",
      "a ver, nya...",
      "te explico ♡"
    ],
    wave:[
      "¡NYA! ♡ ¿en qué te ayudo?",
      "¡hola hola! 🐾",
      "*agita la patita* nya~"
    ],
    welcome:[
      "¡NYA NYA! ♡",
      "¡te estaba esperando!",
      "hola~ 🐱"
    ]
  };

  const ANIMS = {
    idle: "pelusitaFloat 4s ease-in-out infinite",
    happy: "pelusitaBounce .8s cubic-bezier(.34,1.56,.64,1) forwards",
    horror: "pelusitaShake .6s ease forwards",
    see: "pelusitaWobble .8s ease forwards",
    wave: "pelusitaWave 1s ease-in-out forwards",
    welcome: "pelusitaBounce .9s cubic-bezier(.34,1.56,.64,1) forwards"
  };

  const MENUS = {
    main: [
      { text:"🚀 Abrir ExamPro", action: () => openExamPro(), cls:"pelusita-opt-primary" },
      { text:"📘 ¿Para qué sirve esta pantalla?", action: () => showMsg("que_es") },
      { text:"📝 ¿Cómo veo mis exámenes?", action: () => showMsg("examenes") },
      { text:"📬 ¿Dónde veo devoluciones?", action: () => showMsg("devoluciones") },
      { text:"🔐 ¿Por qué se abre aparte?", action: () => showMsg("seguridad") },
      { text:"🆘 Contactar al profe", action: () => showMsg("soporte") },
      { text:"¡nya, gracias! ♡", action: () => closeDialog() }
    ],
    que_es: {
      msg:
`📘 CLASSROOM + EXAMPRO

Este Classroom queda abierto para que puedas volver a tus cursos, clases, materiales y avisos.

ExamPro se abre en otra pestaña para rendir, consultar resultados o leer devoluciones sin romper la sesión. nya~`,
      opts: backOpts()
    },
    examenes: {
      msg:
`📝 EXÁMENES

Entrá a ExamPro con tu usuario de Twitch y DNI.

Ahí vas a ver los cursos/exámenes habilitados para tu alumno. Si todavía no aparece nada, puede que el profe aún no lo haya habilitado o que tus datos no coincidan.`,
      opts: [
        { text:"🚀 Abrir ExamPro", action: () => openExamPro(), cls:"pelusita-opt-primary" },
        { text:"← Volver", action: () => openMain() }
      ]
    },
    devoluciones: {
      msg:
`📬 DEVOLUCIONES

Cuando el profe corrija tu examen o recuperatorio, la devolución se consulta desde ExamPro.

No cierres esta pestaña del Classroom: abrí ExamPro aparte y después volvés acá cuando termines. ♡`,
      opts: [
        { text:"🚀 Abrir ExamPro", action: () => openExamPro(), cls:"pelusita-opt-primary" },
        { text:"← Volver", action: () => openMain() }
      ]
    },
    seguridad: {
      msg:
`🔐 ¿POR QUÉ SE ABRE APARTE?

Porque dentro de un iframe algunas sesiones pueden fallar por cookies y seguridad del navegador.

Abrir ExamPro en una pestaña nueva evita el error de "No autenticado" y mantiene abierto este Classroom. Pelusita aprueba esta decisión técnica. 🐾`,
      opts: backOpts()
    },
    soporte: {
      msg:
`🆘 CONTACTAR AL PROFE

Si no podés entrar, no te aparecen los exámenes o tus datos no coinciden, contactá al profe con tu nombre, DNI y usuario de Twitch.`,
      opts: [
        { text:"💬 WhatsApp", action: () => window.open("https://wa.me/5492236689580", "_blank", "noopener,noreferrer"), cls:"pelusita-opt-wa" },
        { text:"✉️ Email", action: () => window.open("mailto:acoria@frba.utn.edu.ar", "_blank", "noopener,noreferrer"), cls:"pelusita-opt-mail" },
        { text:"← Volver", action: () => openMain() }
      ]
    }
  };

  let open = false;
  let bubbleTimer = null;
  let idleTimer = null;

  function backOpts(){
    return [{ text:"← Volver", action: () => openMain() }];
  }

  function rnd(arr){
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function el(id){
    return document.getElementById(id);
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
    const src = IMGS[state] || IMGS.idle;
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

    clearTimeout(bubbleTimer);
    clearTimeout(idleTimer);

    setImg(state);
    char.style.animation = "none";
    void char.offsetHeight;
    char.style.animation = ANIMS[state] || ANIMS.idle;

    if(state !== "idle"){
      bubble.textContent = rnd(PHRASES[state] || PHRASES.idle);
      bubble.classList.add("show");
      bubbleTimer = setTimeout(() => setState("idle"), 3500);
    }else{
      bubble.classList.remove("show");
      idleTimer = setTimeout(function tick(){
        if(open) return;
        bubble.textContent = rnd(PHRASES.idle);
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
        opts[i].action();
      });
    });
  }

  function openMain(){
    el("pelusitaDialogMsg").textContent =
`¡NYA! ♡ Soy Pelusita~

Te acompaño en el Classroom para que no te pierdas entre cursos, exámenes y devoluciones. 🐾`;

    renderOptions(MENUS.main);
    el("pelusitaDialog").classList.add("show");
    open = true;
    setImg("wave");
    setState("wave");
  }

  function showMsg(key){
    const data = MENUS[key];
    if(!data) return;

    el("pelusitaDialogMsg").textContent = data.msg;
    renderOptions(data.opts || backOpts());
    el("pelusitaDialog").classList.add("show");
    open = true;
    setImg("see");
    setState("see");
  }

  function closeDialog(){
    const dlg = el("pelusitaDialog");
    if(dlg) dlg.classList.remove("show");
    open = false;
    setState("idle");
  }

  function toggleDialog(){
    if(open){
      closeDialog();
      return;
    }

    setState("welcome");
    setTimeout(openMain, 260);
  }

  function openExamPro(){
    setState("happy");
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
    img.src = IMGS.arriving;
    char.style.animation = "none";

    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.style.transition = "transform .55s cubic-bezier(.34,1.56,.64,1),opacity .4s ease";
      wrap.style.transform = "translateY(0)";
      wrap.style.opacity = "1";
    }));

    setTimeout(() => {
      wrap.style.transition = "";
      wrap.style.transform = "";
      wrap.style.opacity = "";
      setState("idle");
    }, 2800);
  }

  window.PelusitaClassroom = {
    open: openMain,
    close: closeDialog,
    state: setState,
    msg: showMsg,
    openExamPro
  };

  document.addEventListener("DOMContentLoaded", build);
})();
