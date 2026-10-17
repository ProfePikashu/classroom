from pathlib import Path

path = Path("frontend/js/clases-ayrpc-2026.js")
source = path.read_text(encoding="utf-8-sig")


def replace_once(old, new, label):
    global source
    if old not in source:
        raise SystemExit(f"patch marker not found: {label}")
    source = source.replace(old, new, 1)


anchor = '  const $ = id => document.getElementById(id);\n\n'
if "function attendanceCodeStorageKey" not in source:
    helpers = '''  function attendanceCodeStorageKey(windowId) {
    return `ayrpc2026.attendance-code.${windowId}`;
  }

  function storeAttendanceCode(attendance) {
    if (!attendance?.windowId || !attendance?.code || !attendance?.expiresAt) return;

    try {
      sessionStorage.setItem(
        attendanceCodeStorageKey(attendance.windowId),
        JSON.stringify({
          code: attendance.code,
          expiresAt: attendance.expiresAt
        })
      );
    } catch {}
  }

  function restoreAttendanceCode(windowId, expiresAt) {
    if (!windowId || !expiresAt || Date.now() >= expiresAt) return "";

    try {
      const key = attendanceCodeStorageKey(windowId);
      const raw = sessionStorage.getItem(key);

      if (!raw) return "";

      const saved = JSON.parse(raw);
      const savedExpiresAt = Number(saved?.expiresAt || 0);
      const code = String(saved?.code || "");

      if (
        code &&
        Math.abs(savedExpiresAt - expiresAt) < 1000 &&
        Date.now() < savedExpiresAt
      ) {
        return code;
      }

      sessionStorage.removeItem(key);
    } catch {}

    return "";
  }

  function clearStoredAttendanceCode(windowId) {
    if (!windowId) return;

    try {
      sessionStorage.removeItem(
        attendanceCodeStorageKey(windowId)
      );
    } catch {}
  }

'''
    replace_once(anchor, anchor + helpers, "storage helpers")

replace_once(
'''    if (
      !item ||
      !hasPermission("attendance.view")
    ) {
      return;
    }
''',
'''    if (!item) return;
''',
"refresh permission gate",
)

replace_once(
'''      const response = await fetch(
        `${apiBase}/api/classroom/admin/attendance/window-state?course=ayrpc-2026&class_number=${encodeURIComponent(item.number)}`,
        {
''',
'''      const canViewAdminState =
        hasPermission("attendance.view");

      const statePath = canViewAdminState
        ? `/api/classroom/admin/attendance/window-state?course=ayrpc-2026&class_number=${encodeURIComponent(item.number)}`
        : `/api/classroom/attendance/state?course=ayrpc-2026&class_number=${encodeURIComponent(item.number)}`;

      const response = await fetch(
        `${apiBase}${statePath}`,
        {
''',
"attendance state endpoint",
)

replace_once(
'''      if (!data.window) {
        attendance.windowId = "";
        attendance.open = false;
        attendance.code = "";
        attendance.expiresAt = 0;
        attendance.visible = false;
        attendance.count = 0;

        paintAttendance();
        return;
      }

      const backendWindowId =
        data.window.id || "";
''',
'''      const backendOpen = canViewAdminState
        ? Boolean(data.window)
        : Boolean(data.open);

      if (!backendOpen) {
        clearStoredAttendanceCode(attendance.windowId);
        attendance.windowId = "";
        attendance.open = false;
        attendance.code = "";
        attendance.expiresAt = 0;
        attendance.visible = false;
        attendance.count = 0;

        stopTimer();
        paintAttendance();
        return;
      }

      const backendWindowId = canViewAdminState
        ? (data.window?.id || "")
        : (data.window_id || "");
''',
"backend open/window normalization",
)

replace_once(
'''      attendance.count =
        Number(data.registered_count || 0);

      if (!keepLocalCode) {
        attendance.code = "";
        attendance.visible = false;

        attendance.expiresAt =
          Number.isFinite(backendExpiresAt)
            ? backendExpiresAt
            : 0;
      }

      paintAttendance();
''',
'''      attendance.count = canViewAdminState
        ? Number(data.registered_count || 0)
        : attendance.count;

      attendance.expiresAt =
        Number.isFinite(backendExpiresAt)
          ? backendExpiresAt
          : 0;

      if (!keepLocalCode) {
        attendance.code = restoreAttendanceCode(
          backendWindowId,
          attendance.expiresAt
        );
        attendance.visible = Boolean(attendance.code);
      }

      if (attendance.expiresAt > Date.now()) {
        startTimer();
      } else {
        stopTimer();
      }

      paintAttendance();
''',
"backend state restoration",
)

replace_once(
'''    if (!hasPermission("attendance.view")) {
      return;
    }

    state.attendancePollTimer =
''',
'''    state.attendancePollTimer =
''',
"polling permission gate",
)

replace_once(
'''    const hasActiveCode =
      isThisClassOpen &&
      state.attendance.code &&
      Date.now() < state.attendance.expiresAt;
''',
'''    const hasActiveCode =
      isThisClassOpen &&
      state.attendance.expiresAt &&
      Date.now() < state.attendance.expiresAt;
''',
"student active-code state",
)

replace_once(
'''      state.attendance.visible = true;

      startTimer();
      paintAttendance();
''',
'''      state.attendance.visible = true;
      storeAttendanceCode(state.attendance);

      startTimer();
      paintAttendance();
''',
"preview code persistence",
)

replace_once(
'''      state.attendance.visible = true;

      startTimer();
      paintAttendance();
''',
'''      state.attendance.visible = true;
      storeAttendanceCode(state.attendance);

      startTimer();
      paintAttendance();
''',
"real code persistence",
)

replace_once(
'''      state.attendance.open = false;
      state.attendance.windowId = "";
      state.attendance.code = "";
''',
'''      clearStoredAttendanceCode(state.attendance.windowId);
      state.attendance.open = false;
      state.attendance.windowId = "";
      state.attendance.code = "";
''',
"preview close storage cleanup",
)

replace_once(
'''      state.attendance.open = false;
      state.attendance.windowId = "";
      state.attendance.code = "";
''',
'''      clearStoredAttendanceCode(state.attendance.windowId);
      state.attendance.open = false;
      state.attendance.windowId = "";
      state.attendance.code = "";
''',
"real close storage cleanup",
)

replace_once(
'''    const codeActive =
      Boolean(
        isThisClassOpen &&
        attendance?.code &&
        Date.now() < attendance.expiresAt
      );
''',
'''    const codeActive =
      Boolean(
        isThisClassOpen &&
        attendance?.expiresAt &&
        Date.now() < attendance.expiresAt
      );
''',
"staff active-code state",
)

replace_once(
'''      generateBtn.disabled =
        !canGenerate ||
        !isThisClassOpen;
''',
'''      generateBtn.disabled =
        !canGenerate ||
        !isThisClassOpen ||
        codeActive;
''',
"prevent duplicate active code",
)

replace_once(
'''        if (
          state.attendance.code &&
          Date.now() >= state.attendance.expiresAt
        ) {
          state.attendance.code = "";
''',
'''        if (
          state.attendance.expiresAt &&
          Date.now() >= state.attendance.expiresAt
        ) {
          clearStoredAttendanceCode(state.attendance.windowId);
          state.attendance.code = "";
''',
"expiration state",
)

replace_once(
'''    if (
      !state.attendance.code ||
      !state.attendance.expiresAt
    ) {
''',
'''    if (!state.attendance.expiresAt) {
''',
"timer without plaintext code",
)

path.write_text(source, encoding="utf-8")
