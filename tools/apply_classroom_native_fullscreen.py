from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"anchor not found: {label} ({path})")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# HTML: Classroom-owned fullscreen button + cache busts.
replace_once(
    "frontend/clases-ayrpc-2026.html",
    '''          <div id="videoPlayerBox" class="video-player-box">\n            <div id="youtubePlayer"></div>\n          </div>''',
    '''          <div id="videoPlayerBox" class="video-player-box ayrpc2026-video-shell">\n            <div id="youtubePlayer"></div>\n            <button\n              id="classroomVideoFullscreen"\n              class="ayrpc2026-video-fullscreen"\n              type="button"\n              aria-label="Ver video en pantalla completa"\n              aria-controls="youtubePlayer"\n              title="Pantalla completa"\n              hidden\n            >\n              <i class="fa-solid fa-expand" aria-hidden="true"></i>\n            </button>\n          </div>''',
    "video fullscreen button",
)

html_path = Path("frontend/clases-ayrpc-2026.html")
html = html_path.read_text(encoding="utf-8")
replacements = {
    "css/clases-ayrpc-2026.css?v=20261027-fullscreen-v3": "css/clases-ayrpc-2026.css?v=20261027-fullscreen-v4",
    "js/clases-ayrpc-2026.js?v=20261027-bandwidth-v1": "js/clases-ayrpc-2026.js?v=20261027-fullscreen-v4",
    "js/ayrpc2026-recovery.js?v=20261027-bandwidth-v1": "js/ayrpc2026-recovery.js?v=20261027-fullscreen-v4",
    "js/ayrpc2026-recovery-ux.js?v=20261027-fullscreen-v3": "js/ayrpc2026-recovery-ux.js?v=20261027-fullscreen-v4",
}
for old, new in replacements.items():
    if old not in html:
        raise SystemExit(f"html cache anchor not found: {old}")
    html = html.replace(old, new, 1)
html_path.write_text(html, encoding="utf-8")


# Normal class player: keep YouTube fullscreen only as fallback when top-level Fullscreen API is unavailable.
replace_once(
    "frontend/js/clases-ayrpc-2026.js",
    '''  const $ = id => document.getElementById(id);\n\n  function attendanceCodeStorageKey(windowId) {''',
    '''  const $ = id => document.getElementById(id);\n\n  function classroomFullscreenSupported() {\n    const target = $("videoPlayerBox");\n    return Boolean(\n      target &&\n      (\n        typeof target.requestFullscreen === "function" ||\n        typeof target.webkitRequestFullscreen === "function"\n      )\n    );\n  }\n\n  function attendanceCodeStorageKey(windowId) {''',
    "classes fullscreen support helper",
)
replace_once(
    "frontend/js/clases-ayrpc-2026.js",
    '''    player.innerHTML = `\n      <iframe\n        width="100%"\n        height="100%"\n        src="https://www.youtube.com/embed/${item.videoId}?cc_load_policy=0&playsinline=1"\n        title="${item.title}"\n        frameborder="0"\n        allowfullscreen\n      ></iframe>\n    `;''',
    '''    let videoSrc =\n      `https://www.youtube.com/embed/${item.videoId}?cc_load_policy=0&playsinline=1&fs=0`;\n\n    if (!classroomFullscreenSupported()) {\n      videoSrc = videoSrc.replace("&fs=0", "&fs=1");\n    }\n\n    player.innerHTML = `\n      <iframe\n        width="100%"\n        height="100%"\n        src="${videoSrc}"\n        title="${item.title}"\n        frameborder="0"\n        allowfullscreen\n      ></iframe>\n    `;''',
    "normal player fullscreen policy",
)


# Recovery player: same fullscreen policy without touching 1x/tracking rules.
replace_once(
    "frontend/js/ayrpc2026-recovery.js",
    '''  const $ = id => document.getElementById(id);\n\n  function apiBase() {''',
    '''  const $ = id => document.getElementById(id);\n\n  function classroomFullscreenSupported() {\n    const target = $("videoPlayerBox");\n    return Boolean(\n      target &&\n      (\n        typeof target.requestFullscreen === "function" ||\n        typeof target.webkitRequestFullscreen === "function"\n      )\n    );\n  }\n\n  function apiBase() {''',
    "recovery fullscreen support helper",
)
replace_once(
    "frontend/js/ayrpc2026-recovery.js",
    '''    try {\n      state.player = new window.YT.Player("ayrpc2026RecoveryPlayerMount", {\n        videoId,\n        playerVars: {\n          rel: 0,\n          modestbranding: 1,\n          playsinline: 1,\n          enablejsapi: 1,\n          cc_load_policy: 0,\n        },\n        events: {''',
    '''    try {\n      const playerVars = {\n        rel: 0,\n        modestbranding: 1,\n        playsinline: 1,\n        enablejsapi: 1,\n        cc_load_policy: 0,\n        fs: 0,\n      };\n\n      if (!classroomFullscreenSupported()) {\n        playerVars.fs = 1;\n      }\n\n      state.player = new window.YT.Player("ayrpc2026RecoveryPlayerMount", {\n        videoId,\n        playerVars,\n        events: {''',
    "recovery player fullscreen policy",
)


# UX: top-document fullscreen owns the gesture and orientation lock.
replace_once(
    "frontend/js/ayrpc2026-recovery-ux.js",
    '''  function isYoutubePlayerFullscreen(element = currentFullscreenElement()) {\n    const host = $("youtubePlayer");\n    if (!host || !element) return false;\n\n    return (\n      element === host ||\n      host.contains(element) ||\n      element === host.querySelector("#youtubePlayer iframe")\n    );\n  }''',
    '''  function isYoutubePlayerFullscreen(element = currentFullscreenElement()) {\n    const shell = $("videoPlayerBox");\n    const host = $("youtubePlayer");\n    if (!host || !element) return false;\n\n    return (\n      element === shell ||\n      element === host ||\n      host.contains(element) ||\n      Boolean(shell?.contains(element))\n    );\n  }''',
    "fullscreen ownership detection",
)
replace_once(
    "frontend/js/ayrpc2026-recovery-ux.js",
    '''  function scheduleYoutubeFullscreenSize() {\n    [0, 60, 180, 350, 600].forEach(delay => {\n      window.setTimeout(applyYoutubeFullscreenSize, delay);\n    });\n  }\n\n  async function lockYoutubeLandscape() {''',
    '''  function scheduleYoutubeFullscreenSize() {\n    [0, 60, 180, 350, 600].forEach(delay => {\n      window.setTimeout(applyYoutubeFullscreenSize, delay);\n    });\n  }\n\n  function classroomFullscreenSupported() {\n    const target = $("videoPlayerBox");\n    return Boolean(\n      target &&\n      (\n        typeof target.requestFullscreen === "function" ||\n        typeof target.webkitRequestFullscreen === "function"\n      )\n    );\n  }\n\n  async function requestClassroomFullscreen(target) {\n    if (typeof target?.requestFullscreen === "function") {\n      await target.requestFullscreen();\n      return;\n    }\n\n    if (typeof target?.webkitRequestFullscreen === "function") {\n      target.webkitRequestFullscreen();\n      return;\n    }\n\n    throw new Error("Fullscreen API no disponible.");\n  }\n\n  async function exitClassroomFullscreen() {\n    if (typeof document.exitFullscreen === "function") {\n      await document.exitFullscreen();\n      return;\n    }\n\n    if (typeof document.webkitExitFullscreen === "function") {\n      document.webkitExitFullscreen();\n    }\n  }\n\n  function syncClassroomFullscreenButton() {\n    const button = $("classroomVideoFullscreen");\n    if (!button) return;\n\n    const supported = classroomFullscreenSupported();\n    button.hidden = !supported;\n    if (!supported) return;\n\n    const active = isYoutubePlayerFullscreen();\n    button.setAttribute(\n      "aria-label",\n      active ? "Salir de pantalla completa" : "Ver video en pantalla completa"\n    );\n    button.title = active ? "Salir de pantalla completa" : "Pantalla completa";\n\n    const icon = button.querySelector("i");\n    if (icon) {\n      icon.className = `fa-solid ${active ? "fa-compress" : "fa-expand"}`;\n    }\n  }\n\n  async function toggleClassroomVideoFullscreen() {\n    if (isYoutubePlayerFullscreen()) {\n      try {\n        await exitClassroomFullscreen();\n      } catch (error) {\n        console.debug("El navegador no permitió salir del fullscreen:", error);\n      }\n      return;\n    }\n\n    const target = $("videoPlayerBox");\n    if (!target || !classroomFullscreenSupported()) return;\n\n    try {\n      await requestClassroomFullscreen(target);\n      scheduleYoutubeFullscreenSize();\n      await lockYoutubeLandscape();\n    } catch (error) {\n      console.debug("El navegador no permitió abrir fullscreen del Classroom:", error);\n    } finally {\n      syncClassroomFullscreenButton();\n      scheduleYoutubeFullscreenSize();\n    }\n  }\n\n  async function lockYoutubeLandscape() {''',
    "classroom fullscreen controls",
)
replace_once(
    "frontend/js/ayrpc2026-recovery-ux.js",
    '''  function syncYoutubeFullscreenOrientation() {\n    if (isYoutubePlayerFullscreen()) {\n      scheduleYoutubeFullscreenSize();\n      void lockYoutubeLandscape().finally(scheduleYoutubeFullscreenSize);\n      return;\n    }\n\n    unlockYoutubeOrientation();\n    scheduleYoutubeFullscreenSize();\n  }''',
    '''  function syncYoutubeFullscreenOrientation() {\n    syncClassroomFullscreenButton();\n\n    if (isYoutubePlayerFullscreen()) {\n      scheduleYoutubeFullscreenSize();\n      void lockYoutubeLandscape().finally(scheduleYoutubeFullscreenSize);\n      return;\n    }\n\n    unlockYoutubeOrientation();\n    scheduleYoutubeFullscreenSize();\n  }''',
    "fullscreen state sync",
)
replace_once(
    "frontend/js/ayrpc2026-recovery-ux.js",
    '''  function bindYoutubeFullscreenOrientation() {\n    document.addEventListener(\n      "fullscreenchange",\n      syncYoutubeFullscreenOrientation\n    );''',
    '''  function bindYoutubeFullscreenOrientation() {\n    const button = $("classroomVideoFullscreen");\n    if (button) {\n      button.addEventListener("click", () => {\n        void toggleClassroomVideoFullscreen();\n      });\n    }\n\n    syncClassroomFullscreenButton();\n\n    document.addEventListener(\n      "fullscreenchange",\n      syncYoutubeFullscreenOrientation\n    );''',
    "bind custom fullscreen button",
)


# CSS: custom control + fullscreen parent sizing.
css_path = Path("frontend/css/clases-ayrpc-2026.css")
css = css_path.read_text(encoding="utf-8")
anchor = '''#youtubePlayer iframe {\n  width: 100% !important;\n  height: 100% !important;\n  display: block;\n}\n'''
insert = '''#youtubePlayer iframe {\n  width: 100% !important;\n  height: 100% !important;\n  display: block;\n}\n\n.ayrpc2026-video-shell {\n  position: relative;\n  background: #000;\n}\n\n.ayrpc2026-video-fullscreen {\n  position: absolute;\n  right: 10px;\n  bottom: 10px;\n  z-index: 20;\n  width: 42px;\n  height: 42px;\n  display: grid;\n  place-items: center;\n  border: 0;\n  border-radius: 8px;\n  background: rgba(0, 0, 0, .72);\n  color: #fff;\n  cursor: pointer;\n  font-size: 1rem;\n  transition: background .18s ease, transform .18s ease;\n}\n\n.ayrpc2026-video-fullscreen:hover,\n.ayrpc2026-video-fullscreen:focus-visible {\n  background: rgba(0, 0, 0, .92);\n  transform: scale(1.05);\n}\n\n.ayrpc2026-video-fullscreen[hidden] {\n  display: none !important;\n}\n'''
if anchor not in css:
    raise SystemExit("css iframe anchor not found")
css = css.replace(anchor, insert, 1)
old_fullscreen = '''#youtubePlayer:fullscreen,\n#youtubePlayer:-webkit-full-screen {\n  width: 100vw !important;\n  height: 100vh !important;\n  max-width: none !important;\n  max-height: none !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  background: #000;\n}\n\n#youtubePlayer:fullscreen iframe,\n#youtubePlayer:-webkit-full-screen iframe,\n#youtubePlayer iframe:fullscreen,\n#youtubePlayer iframe:-webkit-full-screen {\n  width: 100vw !important;\n  height: 100vh !important;\n  max-width: none !important;\n  max-height: none !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  display: block;\n}\n'''
new_fullscreen = '''#videoPlayerBox:fullscreen,\n#videoPlayerBox:-webkit-full-screen,\n#youtubePlayer:fullscreen,\n#youtubePlayer:-webkit-full-screen {\n  width: 100vw !important;\n  height: 100vh !important;\n  max-width: none !important;\n  max-height: none !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  background: #000;\n}\n\n#videoPlayerBox:fullscreen #youtubePlayer,\n#videoPlayerBox:-webkit-full-screen #youtubePlayer {\n  width: 100vw !important;\n  height: 100vh !important;\n}\n\n#videoPlayerBox:fullscreen #youtubePlayer iframe,\n#videoPlayerBox:-webkit-full-screen #youtubePlayer iframe,\n#youtubePlayer:fullscreen iframe,\n#youtubePlayer:-webkit-full-screen iframe,\n#youtubePlayer iframe:fullscreen,\n#youtubePlayer iframe:-webkit-full-screen {\n  width: 100vw !important;\n  height: 100vh !important;\n  max-width: none !important;\n  max-height: none !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  display: block;\n}\n'''
if old_fullscreen not in css:
    raise SystemExit("css fullscreen anchor not found")
css = css.replace(old_fullscreen, new_fullscreen, 1)
css_path.write_text(css, encoding="utf-8")


# Keep legacy recovery contract aligned with cache-bust changes.
test_path = Path("tests/ayrpc2026-class1-recovery.test.js")
test = test_path.read_text(encoding="utf-8")
for old, new in {
    r'js\\/clases-ayrpc-2026\\.js\\?v=20261027-bandwidth-v1': r'js\\/clases-ayrpc-2026\\.js\\?v=20261027-fullscreen-v4',
    r'js\\/ayrpc2026-recovery\\.js\\?v=20261027-bandwidth-v1': r'js\\/ayrpc2026-recovery\\.js\\?v=20261027-fullscreen-v4',
    r'js\\/ayrpc2026-recovery-ux\\.js\\?v=20261027-fullscreen-v3': r'js\\/ayrpc2026-recovery-ux\\.js\\?v=20261027-fullscreen-v4',
}.items():
    if old not in test:
        raise SystemExit(f"legacy test cache anchor not found: {old}")
    test = test.replace(old, new, 1)
test_path.write_text(test, encoding="utf-8")

print("Classroom native fullscreen patch applied")
