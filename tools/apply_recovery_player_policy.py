from pathlib import Path

recovery_path = Path("frontend/js/ayrpc2026-recovery.js")
recovery = recovery_path.read_text(encoding="utf-8")

old_message = '''  const RECOVERY_START_MESSAGE =
    "Para recuperar esta clase tenés que ver el video completo desde esta vista. Si abandonás la vista de la clase, cambiás de pestaña, minimizás o cerrás el navegador, ese tiempo no cuenta como tiempo visto válido. ¿Querés iniciar la recuperación?";
'''
new_message = '''  const RECOVERY_START_MESSAGE =
    "Para recuperar esta clase tenés que ver el video completo desde esta vista y a velocidad 1x. Si abandonás la vista de la clase, cambiás de pestaña, minimizás, cerrás el navegador o intentás acelerar la reproducción, ese tiempo no cuenta como tiempo visto válido. ¿Querés iniciar la recuperación?";
'''
recovery = recovery.replace(old_message, new_message, 1)

anchor_helpers = '''  function safePlayerDuration() {
    try {
      return Number(state.player?.getDuration?.() || 0);
    } catch {
      return 0;
    }
  }

  function knownDuration() {
'''
replacement_helpers = '''  function safePlayerDuration() {
    try {
      return Number(state.player?.getDuration?.() || 0);
    } catch {
      return 0;
    }
  }

  function safePlaybackRate() {
    try {
      return Number(state.player?.getPlaybackRate?.() || 1);
    } catch {
      return 1;
    }
  }

  function suppressCaptions() {
    if (!state.player) return;

    try {
      if (typeof state.player.unloadModule === "function") {
        state.player.unloadModule("captions");
        state.player.unloadModule("cc");
      }
    } catch (error) {
      console.debug("YouTube no permitió descargar captions:", error);
    }
  }

  function showPlaybackRateWarning() {
    const note = $("recoveryNote");
    if (!note || !state.config?.eligible) return;

    note.className = "recovery-note warn";
    note.textContent =
      "Para validar la recuperación, el video se reproduce a velocidad 1x. Si cambiás la velocidad, volverá automáticamente a 1x y ese instante no contará.";
  }

  function enforceNormalPlaybackRate({ warn = false } = {}) {
    if (!state.player) return true;

    const rate = safePlaybackRate();
    if (Math.abs(rate - 1) < 0.01) return true;

    try {
      state.player.setPlaybackRate(1);
    } catch (error) {
      console.warn("No se pudo restaurar la velocidad 1x:", error);
    }

    state.lastTickAt = Date.now();
    state.lastVideoTime = safePlayerTime();

    if (warn) showPlaybackRateWarning();
    return false;
  }

  function knownDuration() {
'''
if anchor_helpers not in recovery:
    raise SystemExit("helper anchor not found")
recovery = recovery.replace(anchor_helpers, replacement_helpers, 1)

anchor_tracking = '''      if (!hidden && playing) {
        const realDelta = Math.max(0, (now - state.lastTickAt) / 1000);
'''
replacement_tracking = '''      const normalPlaybackRate = enforceNormalPlaybackRate({ warn: false });

      if (!hidden && playing && normalPlaybackRate) {
        const realDelta = Math.max(0, (now - state.lastTickAt) / 1000);
'''
if anchor_tracking not in recovery:
    raise SystemExit("tracking anchor not found")
recovery = recovery.replace(anchor_tracking, replacement_tracking, 1)

anchor_player_vars = '''          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
'''
replacement_player_vars = '''          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          cc_load_policy: 0,
'''
if anchor_player_vars not in recovery:
    raise SystemExit("playerVars anchor not found")
recovery = recovery.replace(anchor_player_vars, replacement_player_vars, 1)

anchor_ready = '''          onReady: () => {
            clearAttachRetry();
            state.lastTickAt = Date.now();
            state.lastVideoTime = safePlayerTime();
            startTracking();
            refreshUnlockState();
          },
'''
replacement_ready = '''          onReady: () => {
            clearAttachRetry();
            suppressCaptions();
            enforceNormalPlaybackRate({ warn: false });
            state.lastTickAt = Date.now();
            state.lastVideoTime = safePlayerTime();
            startTracking();
            refreshUnlockState();
          },
'''
if anchor_ready not in recovery:
    raise SystemExit("onReady anchor not found")
recovery = recovery.replace(anchor_ready, replacement_ready, 1)

anchor_playing = '''            if (event.data === window.YT.PlayerState.PLAYING) {
              state.lastTickAt = Date.now();
              state.lastVideoTime = safePlayerTime();
              return;
            }
'''
replacement_playing = '''            if (event.data === window.YT.PlayerState.PLAYING) {
              suppressCaptions();
              enforceNormalPlaybackRate({ warn: false });
              state.lastTickAt = Date.now();
              state.lastVideoTime = safePlayerTime();
              return;
            }
'''
if anchor_playing not in recovery:
    raise SystemExit("playing anchor not found")
recovery = recovery.replace(anchor_playing, replacement_playing, 1)

anchor_events_end = '''          onStateChange: event => {
            if (!canTrackPlayback()) return;

            if (event.data === window.YT.PlayerState.PLAYING) {
              suppressCaptions();
              enforceNormalPlaybackRate({ warn: false });
              state.lastTickAt = Date.now();
              state.lastVideoTime = safePlayerTime();
              return;
            }

            if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              void flushWatchHeartbeat(true);
            }
          },
'''
replacement_events_end = '''          onStateChange: event => {
            if (!canTrackPlayback()) return;

            if (event.data === window.YT.PlayerState.PLAYING) {
              suppressCaptions();
              enforceNormalPlaybackRate({ warn: false });
              state.lastTickAt = Date.now();
              state.lastVideoTime = safePlayerTime();
              return;
            }

            if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              void flushWatchHeartbeat(true);
            }
          },
          onPlaybackRateChange: event => {
            if (!canTrackPlayback()) return;
            if (Math.abs(Number(event.data || 1) - 1) < 0.01) return;
            enforceNormalPlaybackRate({ warn: true });
          },
          onApiChange: () => {
            suppressCaptions();
          },
'''
if anchor_events_end not in recovery:
    raise SystemExit("events anchor not found")
recovery = recovery.replace(anchor_events_end, replacement_events_end, 1)

recovery_path.write_text(recovery, encoding="utf-8")

classes_path = Path("frontend/js/clases-ayrpc-2026.js")
classes = classes_path.read_text(encoding="utf-8")
old_embed = 'src="https://www.youtube.com/embed/${item.videoId}"'
new_embed = 'src="https://www.youtube.com/embed/${item.videoId}?cc_load_policy=0&playsinline=1"'
if old_embed not in classes:
    raise SystemExit("normal embed anchor not found")
classes = classes.replace(old_embed, new_embed, 1)
classes_path.write_text(classes, encoding="utf-8")

html_path = Path("frontend/clases-ayrpc-2026.html")
html = html_path.read_text(encoding="utf-8")
html = html.replace(
    "js/clases-ayrpc-2026.js?v=20260924-canonical-classes-v1",
    "js/clases-ayrpc-2026.js?v=20261027-player-policy-v1",
    1,
)
html = html.replace(
    "js/ayrpc2026-recovery.js?v=20261027-question-feedback-v1",
    "js/ayrpc2026-recovery.js?v=20261027-player-policy-v1",
    1,
)
html_path.write_text(html, encoding="utf-8")

contract_path = Path("tests/ayrpc2026-class1-recovery.test.js")
contract = contract_path.read_text(encoding="utf-8")
contract = contract.replace(
    r'js\/ayrpc2026-recovery\.js\?v=20261027-question-feedback-v1',
    r'js\/ayrpc2026-recovery\.js\?v=20261027-player-policy-v1',
    1,
)
contract_path.write_text(contract, encoding="utf-8")

print("recovery player policy patched")
