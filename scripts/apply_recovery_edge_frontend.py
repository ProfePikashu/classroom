from pathlib import Path
import re


RECOVERY = Path("frontend/js/ayrpc2026-recovery.js")
UX = Path("frontend/js/ayrpc2026-recovery-ux.js")
HTML = Path("frontend/clases-ayrpc-2026.html")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"No encontré bloque esperado: {label}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    if re.search(pattern, text, flags=re.S) is None:
        raise SystemExit(f"No encontré patrón esperado: {label}")
    return re.sub(pattern, replacement, text, count=1, flags=re.S)


recovery = RECOVERY.read_text(encoding="utf-8")

recovery = replace_once(
    recovery,
    '  const HEARTBEAT_SECONDS = 30;\n',
    '  const HEARTBEAT_SECONDS = 30;\n  const RECOVERY_EDGE_BASE = "https://recovery.andyazhtec.com";\n  const EDGE_FALLBACK_MS = 60000;\n',
    "constantes edge",
)

recovery = replace_once(
    recovery,
    '    serverWatchedSeconds: 0,\n    pendingSeconds: 0,\n    heartbeatSending: false,\n',
    '    serverWatchedSeconds: 0,\n    pendingSeconds: 0,\n    edgePendingSeconds: 0,\n    edgeSessionToken: "",\n    edgeSessionUnavailable: false,\n    edgeSessionLoading: false,\n    edgeConfirmedComplete: false,\n    edgeFallbackUntil: 0,\n    heartbeatSending: false,\n',
    "estado edge",
)

recovery = replace_once(
    recovery,
    '''  function recoveryWatchEndpoint(classNumber) {\n    return `${recoveryEndpoint(classNumber)}/watch`;\n  }\n''',
    '''  function recoveryWatchEndpoint(classNumber) {\n    return `${recoveryEndpoint(classNumber)}/watch`;\n  }\n\n  function recoveryEdgeBase() {\n    const configured = window.CLASSROOM_RECOVERY_EDGE_BASE || RECOVERY_EDGE_BASE;\n    return String(configured).replace(/\\/+$/, "");\n  }\n\n  function edgeSessionEndpoint(classNumber) {\n    return `${recoveryEndpoint(classNumber)}/edge-session`;\n  }\n\n  function edgeHeartbeatEndpoint() {\n    return `${recoveryEdgeBase()}/v1/recovery/heartbeat`;\n  }\n''',
    "endpoints edge",
)

recovery = replace_once(
    recovery,
    '''  function watchedTotal() {\n    return Math.max(0, state.serverWatchedSeconds + state.pendingSeconds);\n  }\n''',
    '''  function watchedTotal() {\n    return Math.max(\n      0,\n      state.serverWatchedSeconds + state.edgePendingSeconds + state.pendingSeconds\n    );\n  }\n''',
    "watched total edge",
)

recovery = replace_once(
    recovery,
    '''  function updateProgressFromSeconds() {\n    const duration = knownDuration();\n\n    if (!duration) {\n      updateProgress(Number(state.config?.video_watch_percent || 0));\n      return;\n    }\n\n    updateProgress((watchedTotal() / duration) * 100);\n  }\n''',
    '''  function updateProgressFromSeconds() {\n    const duration = knownDuration();\n\n    if (!duration) {\n      updateProgress(Number(state.config?.video_watch_percent || 0));\n      return;\n    }\n\n    const provisionalPercent = (watchedTotal() / duration) * 100;\n    if (state.edgeSessionToken && !state.edgeConfirmedComplete) {\n      updateProgress(Math.min(99, provisionalPercent));\n      return;\n    }\n\n    updateProgress(provisionalPercent);\n  }\n''',
    "progreso provisional",
)

recovery = replace_once(
    recovery,
    '''    state.serverWatchedSeconds = 0;\n    state.pendingSeconds = 0;\n    state.heartbeatSending = false;\n''',
    '''    state.serverWatchedSeconds = 0;\n    state.pendingSeconds = 0;\n    state.edgePendingSeconds = 0;\n    state.edgeSessionToken = "";\n    state.edgeSessionUnavailable = false;\n    state.edgeSessionLoading = false;\n    state.edgeConfirmedComplete = false;\n    state.edgeFallbackUntil = 0;\n    state.heartbeatSending = false;\n''',
    "reset edge",
)

recovery = replace_once(
    recovery,
    '''      state.pendingSeconds = 0;\n      return data;\n''',
    '''      state.pendingSeconds = 0;\n      state.edgePendingSeconds = 0;\n      state.edgeConfirmedComplete = Boolean(\n        Number(data.required_watch_seconds || 0) > 0 &&\n        state.serverWatchedSeconds >= Number(data.required_watch_seconds || 0)\n      );\n\n      if (data.eligible === true && data.preview_mode !== true) {\n        await ensureEdgeSession(classNumber);\n      }\n\n      return data;\n''',
    "mint edge session tras config",
)

recovery = replace_once(
    recovery,
    '''  function completionReached() {\n    if (isPreviewMode()) return true;\n    const duration = knownDuration();\n    if (!duration) return false;\n    return state.serverWatchedSeconds >= duration * VIDEO_COMPLETION_RATIO;\n  }\n''',
    '''  function completionReached() {\n    if (isPreviewMode()) return true;\n    const duration = knownDuration();\n    if (!duration) return false;\n    return (\n      state.edgeConfirmedComplete ||\n      state.serverWatchedSeconds >= duration * VIDEO_COMPLETION_RATIO\n    );\n  }\n''',
    "completion edge",
)

recovery = replace_once(
    recovery,
    '''      state.quizUnlocked = true;\n      state.pendingSeconds = 0;\n      updateProgress(100);\n''',
    '''      state.quizUnlocked = true;\n      state.pendingSeconds = 0;\n      state.edgePendingSeconds = 0;\n      updateProgress(100);\n''',
    "unlock confirmado",
)

heartbeat_pattern = r'''  async function flushWatchHeartbeat\(force = false\) \{.*?\n  \}\n\n  function startTracking\(\) \{'''
heartbeat_replacement = '''  async function ensureEdgeSession(classNumber) {\n    if (isPreviewMode() || !state.config?.eligible) return false;\n    if (state.edgeSessionToken) return true;\n    if (state.edgeSessionUnavailable || state.edgeSessionLoading) return false;\n\n    const token = classroomToken();\n    if (!token) {\n      state.edgeSessionUnavailable = true;\n      return false;\n    }\n\n    state.edgeSessionLoading = true;\n    try {\n      const response = await fetch(edgeSessionEndpoint(classNumber), {\n        method: "POST",\n        cache: "no-store",\n        headers: { Authorization: `Bearer ${token}` },\n      });\n      const data = await response.json().catch(() => null);\n      if (!response.ok || !data?.ok || !data?.session_token) {\n        throw new Error(data?.detail || "No se pudo crear la sesión edge.");\n      }\n\n      state.edgeSessionToken = String(data.session_token);\n      state.edgeSessionUnavailable = false;\n      state.edgePendingSeconds = 0;\n      state.serverWatchedSeconds = Math.max(\n        state.serverWatchedSeconds,\n        Number(data.persisted_watched_seconds || data.video_watch_seconds || 0)\n      );\n      state.edgeConfirmedComplete = Boolean(data.complete);\n      if (state.config && Number(data.required_watch_seconds || 0) > 0) {\n        state.config.required_watch_seconds = Number(data.required_watch_seconds);\n      }\n      return true;\n    } catch (error) {\n      state.edgeSessionUnavailable = true;\n      console.warn("No se pudo iniciar el tracker edge; usamos fallback directo:", error);\n      return false;\n    } finally {\n      state.edgeSessionLoading = false;\n    }\n  }\n\n  function applyDirectHeartbeatResult(data) {\n    state.serverWatchedSeconds = Math.max(\n      state.serverWatchedSeconds,\n      Number(data?.watched_seconds || data?.video_watch_seconds || 0)\n    );\n    state.edgePendingSeconds = 0;\n    if (state.config && Number(data?.required_watch_seconds || 0) > 0) {\n      state.config.required_watch_seconds = Number(data.required_watch_seconds);\n    }\n    const duration = knownDuration();\n    if (duration > 0 && state.serverWatchedSeconds >= duration) {\n      state.edgeConfirmedComplete = true;\n    }\n  }\n\n  async function flushDirectWatchHeartbeat(delta, force = false) {\n    const token = classroomToken();\n    if (!token) throw new Error("Tu sesión venció.");\n\n    const response = await fetch(recoveryWatchEndpoint(state.classNumber), {\n      method: "POST",\n      keepalive: force,\n      headers: {\n        Authorization: `Bearer ${token}`,\n        "Content-Type": "application/json",\n      },\n      body: JSON.stringify({\n        delta_seconds: Number(delta.toFixed(3)),\n        video_position_seconds: Number(safePlayerTime().toFixed(3)),\n        video_duration_seconds: Number(safePlayerDuration().toFixed(3)),\n        visible: true,\n        playing: true,\n      }),\n    });\n\n    const data = await response.json().catch(() => null);\n    if (!response.ok || !data?.ok) {\n      throw new Error(data?.detail || "No se pudo guardar el tiempo visto válido.");\n    }\n    applyDirectHeartbeatResult(data);\n    return data;\n  }\n\n  async function flushEdgeHeartbeat(delta, force = false) {\n    const response = await fetch(edgeHeartbeatEndpoint(), {\n      method: "POST",\n      keepalive: force,\n      headers: { "Content-Type": "application/json" },\n      body: JSON.stringify({\n        session_token: state.edgeSessionToken,\n        course_slug: COURSE_SLUG,\n        class_number: state.classNumber,\n        delta_seconds: Number(delta.toFixed(3)),\n        video_position_seconds: Number(safePlayerTime().toFixed(3)),\n        video_duration_seconds: Number(safePlayerDuration().toFixed(3)),\n        visible: true,\n        playing: true,\n        force: Boolean(force),\n        persisted_watched_seconds: state.serverWatchedSeconds,\n        required_watch_seconds: knownDuration(),\n      }),\n    });\n\n    const data = await response.json().catch(() => null);\n    if (!response.ok || !data?.ok || data?.accepted !== true) {\n      throw new Error(data?.detail || "Cloudflare no pudo aceptar el heartbeat.");\n    }\n\n    state.serverWatchedSeconds = Math.max(\n      state.serverWatchedSeconds,\n      Number(data.persisted_watched_seconds || 0)\n    );\n    state.edgePendingSeconds = Math.max(0, Number(data.pending_seconds || 0));\n    state.edgeConfirmedComplete = state.edgeConfirmedComplete || Boolean(data.complete);\n    state.edgeFallbackUntil = 0;\n    if (state.config && Number(data.required_watch_seconds || 0) > 0) {\n      state.config.required_watch_seconds = Number(data.required_watch_seconds);\n    }\n    return data;\n  }\n\n  async function flushWatchHeartbeat(force = false) {\n    if (isPreviewMode()) return;\n    if (!state.config?.eligible || !state.classNumber) return;\n    if (state.heartbeatSending) return;\n\n    const delta = Math.min(state.pendingSeconds, HEARTBEAT_SECONDS);\n    if (delta <= 0) return;\n    if (!force && state.pendingSeconds < HEARTBEAT_SECONDS) return;\n\n    state.pendingSeconds = Math.max(0, state.pendingSeconds - delta);\n    state.heartbeatSending = true;\n\n    try {\n      if (!state.edgeSessionToken && !state.edgeSessionUnavailable) {\n        await ensureEdgeSession(state.classNumber);\n      }\n\n      const useDirect =\n        state.edgeSessionUnavailable ||\n        !state.edgeSessionToken ||\n        Date.now() < state.edgeFallbackUntil;\n\n      if (useDirect) {\n        await flushDirectWatchHeartbeat(delta, force);\n      } else {\n        try {\n          await flushEdgeHeartbeat(delta, force);\n        } catch (edgeError) {\n          state.edgeFallbackUntil = Date.now() + EDGE_FALLBACK_MS;\n          console.warn("Tracker edge temporalmente no disponible; fallback directo:", edgeError);\n          await flushDirectWatchHeartbeat(delta, force);\n        }\n      }\n\n      refreshUnlockState();\n    } catch (error) {\n      state.pendingSeconds += delta;\n      console.warn("No se pudo sincronizar el tiempo visto válido:", error);\n    } finally {\n      state.heartbeatSending = false;\n    }\n  }\n\n  function startTracking() {'''
recovery = regex_once(
    recovery,
    heartbeat_pattern,
    heartbeat_replacement,
    "heartbeat edge",
)

RECOVERY.write_text(recovery, encoding="utf-8")

ux = UX.read_text(encoding="utf-8")
ux = replace_once(
    ux,
    '  const CLASS_NUMBER = 1;\n',
    '  const CLASS_NUMBER = 1;\n  const RECOVERY_EDGE_HOST = "recovery.andyazhtec.com";\n',
    "host edge ux",
)

ux = replace_once(
    ux,
    '''  function matchesRecoveryRequest(url, kind) {\n    try {\n      const parsed = new URL(url, window.location.href);\n      return parsed.pathname.endsWith(recoveryPath(kind));\n    } catch {\n      return String(url || "").includes(recoveryPath(kind));\n    }\n  }\n''',
    '''  function matchesRecoveryRequest(url, kind) {\n    try {\n      const parsed = new URL(url, window.location.href);\n      return parsed.pathname.endsWith(recoveryPath(kind));\n    } catch {\n      return String(url || "").includes(recoveryPath(kind));\n    }\n  }\n\n  function matchesEdgeHeartbeat(url) {\n    try {\n      const parsed = new URL(url, window.location.href);\n      return (\n        parsed.hostname === RECOVERY_EDGE_HOST &&\n        parsed.pathname.endsWith("/v1/recovery/heartbeat")\n      );\n    } catch {\n      return String(url || "").includes(`${RECOVERY_EDGE_HOST}/v1/recovery/heartbeat`);\n    }\n  }\n''',
    "matcher edge ux",
)

ux = replace_once(
    ux,
    '''  async function inspectRecoveryResponse(response, kind) {\n    const data = await response.json().catch(() => null);\n\n    if (kind === "status") {\n      if (response.ok) handleRecoveryConfig(data);\n      return;\n    }\n\n    handleHeartbeatResponse(data, response.ok);\n  }\n''',
    '''  function handleEdgeHeartbeatResponse(data, responseOk) {\n    if (!state.eligible || state.preview) return;\n    if (!responseOk || !data?.ok || data?.accepted !== true) {\n      markValidationProblem();\n      return;\n    }\n\n    state.lastServerProgressAt = Date.now();\n    state.lastServerWatchedSeconds = Math.max(\n      state.lastServerWatchedSeconds,\n      Number(data.persisted_watched_seconds || 0)\n    );\n    markValidationActive();\n  }\n\n  async function inspectRecoveryResponse(response, kind) {\n    const data = await response.json().catch(() => null);\n\n    if (kind === "status") {\n      if (response.ok) handleRecoveryConfig(data);\n      return;\n    }\n\n    if (kind === "edge") {\n      handleEdgeHeartbeatResponse(data, response.ok);\n      return;\n    }\n\n    handleHeartbeatResponse(data, response.ok);\n  }\n''',
    "respuesta edge ux",
)

ux = replace_once(
    ux,
    '''      const isWatch =\n        method === "POST" && matchesRecoveryRequest(url, "watch");\n\n      try {\n        const response = await nativeFetch(input, init);\n\n        if (isStatus || isWatch) {\n          void inspectRecoveryResponse(\n            response.clone(),\n            isWatch ? "watch" : "status"\n          );\n        }\n\n        return response;\n      } catch (error) {\n        if (isWatch) markValidationProblem();\n        throw error;\n      }\n''',
    '''      const isWatch =\n        method === "POST" && matchesRecoveryRequest(url, "watch");\n      const isEdgeWatch =\n        method === "POST" && matchesEdgeHeartbeat(url);\n\n      try {\n        const response = await nativeFetch(input, init);\n\n        if (isStatus || isWatch || isEdgeWatch) {\n          void inspectRecoveryResponse(\n            response.clone(),\n            isEdgeWatch ? "edge" : isWatch ? "watch" : "status"\n          );\n        }\n\n        return response;\n      } catch (error) {\n        if (isWatch || isEdgeWatch) markValidationProblem();\n        throw error;\n      }\n''',
    "observer edge ux",
)
UX.write_text(ux, encoding="utf-8")

html = HTML.read_text(encoding="utf-8")
html = re.sub(
    r'js/ayrpc2026-recovery\.js\?v=[^"\']+',
    'js/ayrpc2026-recovery.js?v=20261028-edge-v1',
    html,
)
html = re.sub(
    r'js/ayrpc2026-recovery-ux\.js\?v=[^"\']+',
    'js/ayrpc2026-recovery-ux.js?v=20261028-edge-v1',
    html,
)
HTML.write_text(html, encoding="utf-8")

print("Recovery edge frontend patch aplicado")
