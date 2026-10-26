from pathlib import Path

js_path = Path("frontend/js/ayrpc2026-recovery.js")
html_path = Path("frontend/clases-ayrpc-2026.html")

js = js_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


js = replace_once(
    js,
    '  const HEARTBEAT_SECONDS = 5;\n',
    '  const HEARTBEAT_SECONDS = 5;\n'
    '  const MAX_LOCAL_CHECKPOINT_LEAD_SECONDS = 10;\n'
    '  const RESUME_REWIND_SECONDS = 5;\n'
    '  const MIN_RESUME_POSITION_SECONDS = 10;\n',
    "resume constants",
)

js = replace_once(
    js,
    '    serverWatchedSeconds: 0,\n    pendingSeconds: 0,\n',
    '    serverWatchedSeconds: 0,\n'
    '    serverResumePosition: 0,\n'
    '    resumePosition: 0,\n'
    '    pendingSeconds: 0,\n',
    "resume state",
)

anchor = '''  function recoveryWatchEndpoint(classNumber) {\n    return `${recoveryEndpoint(classNumber)}/watch`;\n  }\n\n'''
helpers = '''  function recoveryWatchEndpoint(classNumber) {\n    return `${recoveryEndpoint(classNumber)}/watch`;\n  }\n\n  function recoveryCheckpointKey(classNumber = state.classNumber) {\n    return `${COURSE_SLUG}:recovery:class-${Number(classNumber) || 0}:checkpoint`;\n  }\n\n  function readLocalCheckpoint() {\n    if (isPreviewMode() || !state.classNumber) return 0;\n\n    try {\n      const raw = localStorage.getItem(recoveryCheckpointKey());\n      const parsed = JSON.parse(raw || "{}");\n      const position = Number(parsed?.position_seconds || 0);\n      return Number.isFinite(position) && position > 0 ? position : 0;\n    } catch {\n      return 0;\n    }\n  }\n\n  function writeLocalCheckpoint(positionSeconds) {\n    if (isPreviewMode() || !state.config?.eligible || !state.classNumber) return;\n\n    const position = Math.max(0, Number(positionSeconds) || 0);\n    if (!position) return;\n\n    try {\n      localStorage.setItem(\n        recoveryCheckpointKey(),\n        JSON.stringify({\n          position_seconds: Number(position.toFixed(3)),\n          saved_at: Date.now(),\n        })\n      );\n    } catch {}\n  }\n\n  function clearLocalCheckpoint() {\n    if (!state.classNumber) return;\n    try {\n      localStorage.removeItem(recoveryCheckpointKey());\n    } catch {}\n  }\n\n  function formatResumeTime(seconds) {\n    const total = Math.max(0, Math.floor(Number(seconds) || 0));\n    const hours = Math.floor(total / 3600);\n    const minutes = Math.floor((total % 3600) / 60);\n    const secs = total % 60;\n    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;\n  }\n\n  function computeResumePosition() {\n    const serverPosition = Math.max(\n      0,\n      Number(state.serverResumePosition || state.config?.resume_position_seconds || 0)\n    );\n    const localPosition = Math.max(0, Number(readLocalCheckpoint() || 0));\n    const boundedLocalPosition = Math.min(\n      localPosition,\n      serverPosition + MAX_LOCAL_CHECKPOINT_LEAD_SECONDS\n    );\n    const checkpoint = Math.max(serverPosition, boundedLocalPosition);\n    return Math.max(0, checkpoint - RESUME_REWIND_SECONDS);\n  }\n\n  function ensureResumeButton() {\n    const actions = document.querySelector(".recovery-actions");\n    if (!actions) return null;\n\n    let button = $("resumeRecoveryButton");\n    if (button) return button;\n\n    button = document.createElement("button");\n    button.id = "resumeRecoveryButton";\n    button.type = "button";\n    button.className = "btn btn-outline";\n    button.hidden = true;\n    button.addEventListener("click", continueRecoveryPlayback);\n    actions.insertBefore(button, $("quizButton") || null);\n    return button;\n  }\n\n  function refreshResumeAction() {\n    const button = ensureResumeButton();\n    if (!button) return;\n\n    const resumePosition = computeResumePosition();\n    state.resumePosition = resumePosition;\n    const show =\n      !isPreviewMode() &&\n      state.config?.eligible === true &&\n      resumePosition >= MIN_RESUME_POSITION_SECONDS &&\n      !state.quizUnlocked;\n\n    button.hidden = !show;\n    if (!show) return;\n\n    button.innerHTML =\n      `<i class="fa-solid fa-rotate-right"></i> Continuar desde ${formatResumeTime(resumePosition)}`;\n  }\n\n  function continueRecoveryPlayback() {\n    if (!state.player || isPreviewMode() || !state.config?.eligible) return;\n\n    const resumePosition = computeResumePosition();\n    if (resumePosition < MIN_RESUME_POSITION_SECONDS) return;\n\n    try {\n      state.player.seekTo(resumePosition, true);\n      state.player.playVideo?.();\n      state.lastTickAt = Date.now();\n      state.lastVideoTime = resumePosition;\n      state.resumePosition = resumePosition;\n      refreshResumeAction();\n    } catch (error) {\n      console.warn("No se pudo reanudar la reproducción:", error);\n    }\n  }\n\n'''
js = replace_once(js, anchor, helpers, "resume helpers")

js = replace_once(
    js,
    '    state.serverWatchedSeconds = 0;\n    state.pendingSeconds = 0;\n',
    '    state.serverWatchedSeconds = 0;\n'
    '    state.serverResumePosition = 0;\n'
    '    state.resumePosition = 0;\n'
    '    state.pendingSeconds = 0;\n'
    '    const resumeButton = $("resumeRecoveryButton");\n'
    '    if (resumeButton) resumeButton.hidden = true;\n',
    "reset resume state",
)

js = replace_once(
    js,
    '      state.pendingSeconds = 0;\n      return data;\n',
    '      state.serverResumePosition = Math.max(\n'
    '        0,\n'
    '        Number(data.resume_position_seconds || 0)\n'
    '      );\n'
    '      state.pendingSeconds = 0;\n'
    '      refreshResumeAction();\n'
    '      return data;\n',
    "load resume state",
)

js = replace_once(
    js,
    '      state.serverWatchedSeconds = Math.max(\n        state.serverWatchedSeconds,\n        Number(data.watched_seconds || data.video_watch_seconds || 0)\n      );\n\n',
    '      state.serverWatchedSeconds = Math.max(\n'
    '        state.serverWatchedSeconds,\n'
    '        Number(data.watched_seconds || data.video_watch_seconds || 0)\n'
    '      );\n'
    '      state.serverResumePosition = Math.max(\n'
    '        state.serverResumePosition,\n'
    '        Number(data.resume_position_seconds || 0)\n'
    '      );\n\n',
    "heartbeat resume anchor",
)

js = replace_once(
    js,
    '      refreshUnlockState();\n    } catch (error) {\n',
    '      refreshUnlockState();\n'
    '      refreshResumeAction();\n'
    '    } catch (error) {\n',
    "refresh resume after heartbeat",
)

js = replace_once(
    js,
    '      if (!hidden && playing) {\n        const realDelta = Math.max(0, (now - state.lastTickAt) / 1000);\n',
    '      if (!hidden && playing) {\n'
    '        writeLocalCheckpoint(currentVideoTime);\n'
    '        const realDelta = Math.max(0, (now - state.lastTickAt) / 1000);\n',
    "write local checkpoint",
)

js = replace_once(
    js,
    '  function pauseForInactiveView() {\n    if (!canTrackPlayback()) return;\n\n    void flushWatchHeartbeat(true);\n',
    '  function pauseForInactiveView() {\n'
    '    if (!canTrackPlayback()) return;\n\n'
    '    writeLocalCheckpoint(safePlayerTime());\n'
    '    void flushWatchHeartbeat(true);\n',
    "pause checkpoint",
)

js = replace_once(
    js,
    '            startTracking();\n            refreshUnlockState();\n',
    '            startTracking();\n'
    '            refreshUnlockState();\n'
    '            refreshResumeAction();\n',
    "ready resume action",
)

js = replace_once(
    js,
    '            ) {\n              void flushWatchHeartbeat(true);\n            }\n',
    '            ) {\n'
    '              writeLocalCheckpoint(safePlayerTime());\n'
    '              void flushWatchHeartbeat(true);\n'
    '            }\n',
    "pause ended checkpoint",
)

js = replace_once(
    js,
    '  function paintRecoveredState() {\n    void flushWatchHeartbeat(true);\n',
    '  function paintRecoveredState() {\n'
    '    void flushWatchHeartbeat(true);\n'
    '    clearLocalCheckpoint();\n',
    "clear recovered checkpoint",
)

js = replace_once(
    js,
    '    if (state.config) state.config.eligible = false;\n    setQuizEnabled(false);\n',
    '    if (state.config) state.config.eligible = false;\n'
    '    setQuizEnabled(false);\n'
    '    refreshResumeAction();\n',
    "hide resume when recovered",
)

js = replace_once(
    js,
    '    refreshUnlockState();\n    schedulePlayerAttach();\n  }\n',
    '    refreshUnlockState();\n'
    '    refreshResumeAction();\n'
    '    schedulePlayerAttach();\n'
    '  }\n',
    "sync resume action",
)

js = replace_once(
    js,
    '    window.addEventListener("beforeunload", event => {\n      if (!state.config?.eligible || watchedTotal() <= 0 || state.quizUnlocked) {\n',
    '    window.addEventListener("beforeunload", event => {\n'
    '      writeLocalCheckpoint(safePlayerTime());\n'
    '      if (!state.config?.eligible || watchedTotal() <= 0 || state.quizUnlocked) {\n',
    "beforeunload checkpoint",
)

html = replace_once(
    html,
    'js/ayrpc2026-recovery.js?v=20261025-watch-heartbeat-v4',
    'js/ayrpc2026-recovery.js?v=20261025-resume-checkpoint-v1',
    "cache bust",
)

js_path.write_text(js, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
print("recovery resume patch applied")
