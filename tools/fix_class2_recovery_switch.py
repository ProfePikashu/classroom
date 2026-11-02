from pathlib import Path
import re

classes_path = Path("frontend/js/clases-ayrpc-2026.js")
classes = classes_path.read_text(encoding="utf-8")
old = '''  function paintVideo(item) {
    const player = $("youtubePlayer");

    if (!player) return;

    if (!item.videoId) {'''
new = '''  function paintVideo(item) {
    const player = $("youtubePlayer");

    if (!player) return;

    player.dataset.videoId = String(item.videoId || "");

    if (!item.videoId) {'''
if classes.count(old) != 1:
    raise SystemExit(f"paintVideo anchor count={classes.count(old)}")
classes = classes.replace(old, new, 1)
classes_path.write_text(classes, encoding="utf-8")

recovery_path = Path("frontend/js/ayrpc2026-recovery.js")
recovery = recovery_path.read_text(encoding="utf-8")

old = '''    config: null,
    configLoading: false,
    player: null,'''
new = '''    config: null,
    configLoadingClassNumber: null,
    selectionRevision: 0,
    player: null,'''
if recovery.count(old) != 1:
    raise SystemExit(f"state anchor count={recovery.count(old)}")
recovery = recovery.replace(old, new, 1)

old = '''  function resetSelection(nextKey, classNumber, status) {
    destroyRecoveryPlayer();

    state.key = nextKey;
    state.classNumber = classNumber;
    state.status = status;
    state.config = null;
    state.configLoading = false;'''
new = '''  function resetSelection(nextKey, classNumber, status) {
    destroyRecoveryPlayer();

    state.selectionRevision += 1;
    state.key = nextKey;
    state.classNumber = classNumber;
    state.status = status;
    state.config = null;
    state.configLoadingClassNumber = null;'''
if recovery.count(old) != 1:
    raise SystemExit(f"resetSelection anchor count={recovery.count(old)}")
recovery = recovery.replace(old, new, 1)

load_pattern = re.compile(
    r'''  async function loadRecoveryConfig\(classNumber\) \{[\s\S]*?\n  \}\n\n  function extractVideoId\(\) \{[\s\S]*?\n  \}\n\n  function completionReached'''
)
match = load_pattern.search(recovery)
if not match:
    raise SystemExit("loadRecoveryConfig/extractVideoId block not found")
replacement = '''  async function loadRecoveryConfig(classNumber, revision = state.selectionRevision) {
    if (!ENABLED_CLASS_NUMBERS.has(Number(classNumber))) {
      return null;
    }

    if (
      state.config &&
      classNumber === state.classNumber &&
      revision === state.selectionRevision
    ) {
      return state.config;
    }

    if (
      state.configLoadingClassNumber === classNumber &&
      revision === state.selectionRevision
    ) {
      return null;
    }

    const token = classroomToken();
    if (!token) return null;

    state.configLoadingClassNumber = classNumber;

    try {
      const response = await fetch(recoveryEndpoint(classNumber), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) return null;

      if (
        revision !== state.selectionRevision ||
        classNumber !== state.classNumber
      ) {
        return null;
      }

      state.config = data;
      state.serverWatchedSeconds = Math.max(
        0,
        Number(data.video_watch_seconds || data.watched_seconds || 0)
      );
      state.pendingSeconds = 0;
      state.edgePendingSeconds = 0;
      state.edgeConfirmedComplete = Boolean(
        Number(data.required_watch_seconds || 0) > 0 &&
        state.serverWatchedSeconds >= Number(data.required_watch_seconds || 0)
      );

      if (data.eligible === true && data.preview_mode !== true) {
        await ensureEdgeSession(classNumber);
      }

      if (
        revision !== state.selectionRevision ||
        classNumber !== state.classNumber
      ) {
        return null;
      }

      return data;
    } catch (error) {
      console.warn("No se pudo cargar la recuperación de la clase:", error);
      return null;
    } finally {
      if (state.configLoadingClassNumber === classNumber) {
        state.configLoadingClassNumber = null;
      }
    }
  }

  function extractVideoId() {
    if (state.playerVideoId) return state.playerVideoId;

    const host = $("youtubePlayer");
    const iframe = host?.querySelector("iframe");
    const src = iframe?.src || "";

    if (src) {
      try {
        const parsed = new URL(src);
        const embedMatch = parsed.pathname.match(/\\/embed\\/([^/?]+)/i);
        if (embedMatch?.[1]) return embedMatch[1];
        const queryVideoId = parsed.searchParams.get("v") || "";
        if (queryVideoId) return queryVideoId;
      } catch {}
    }

    const explicit = String(host?.dataset?.videoId || "").trim();
    return explicit;
  }

  function completionReached'''
recovery = recovery[:match.start()] + replacement + recovery[match.end():]

old = '''    const config = await loadRecoveryConfig(classNumber);
    const preview = config?.preview_mode === true;'''
new = '''    const revision = state.selectionRevision;
    const config = await loadRecoveryConfig(classNumber, revision);

    if (
      revision !== state.selectionRevision ||
      classNumber !== state.classNumber
    ) {
      return;
    }

    const preview = config?.preview_mode === true;'''
if recovery.count(old) != 1:
    raise SystemExit(f"syncSelection anchor count={recovery.count(old)}")
recovery = recovery.replace(old, new, 1)

recovery_path.write_text(recovery, encoding="utf-8")
