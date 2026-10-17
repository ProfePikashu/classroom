from pathlib import Path

path = Path("frontend/js/clases-ayrpc-2026.js")
source = path.read_text(encoding="utf-8-sig")

old_state = '''          visible: false,\n          count: 0\n'''
new_state = '''          visible: false,\n          count: 0,\n          registered: false\n'''
if source.count(old_state) < 2:
    raise SystemExit("attendance state initializer markers not found")
source = source.replace(old_state, new_state, 2)

old_closed = '''        attendance.visible = false;\n        attendance.count = 0;\n\n        stopTimer();\n'''
new_closed = '''        attendance.visible = false;\n        attendance.count = 0;\n        attendance.registered = false;\n\n        stopTimer();\n'''
if old_closed not in source:
    raise SystemExit("closed attendance marker not found")
source = source.replace(old_closed, new_closed, 1)

old_count = '''      attendance.count = canViewAdminState\n        ? Number(data.registered_count || 0)\n        : attendance.count;\n\n      attendance.expiresAt =\n'''
new_count = '''      attendance.count = canViewAdminState\n        ? Number(data.registered_count || 0)\n        : attendance.count;\n\n      attendance.registered = Boolean(data.registered);\n\n      attendance.expiresAt =\n'''
if old_count not in source:
    raise SystemExit("refresh attendance marker not found")
source = source.replace(old_count, new_count, 1)

old_active = '''    const hasActiveCode =\n      isThisClassOpen &&\n      state.attendance.expiresAt &&\n      Date.now() < state.attendance.expiresAt;\n\n    if (status === "PRESENTE") {\n'''
new_active = '''    const hasActiveCode =\n      isThisClassOpen &&\n      state.attendance.expiresAt &&\n      Date.now() < state.attendance.expiresAt;\n\n    if (isThisClassOpen && state.attendance.registered) {\n      if (message) {\n        message.textContent =\n          "Tu código de asistencia ya fue registrado correctamente. El estado final seguirá PENDIENTE hasta cerrar la clase.";\n      }\n\n      if (form) {\n        form.hidden = true;\n      }\n\n      paintStaff();\n\n      return;\n    }\n\n    if (status === "PRESENTE") {\n'''
if old_active not in source:
    raise SystemExit("paint attendance marker not found")
source = source.replace(old_active, new_active, 1)

old_preview_open = '''      state.attendance.open = true;\n      state.attendance.code = "";\n      state.attendance.visible = false;\n      state.attendance.expiresAt = 0;\n\n      paintAttendance();\n'''
new_preview_open = '''      state.attendance.open = true;\n      state.attendance.code = "";\n      state.attendance.visible = false;\n      state.attendance.expiresAt = 0;\n      state.attendance.registered = false;\n\n      paintAttendance();\n'''
if old_preview_open not in source:
    raise SystemExit("preview open marker not found")
source = source.replace(old_preview_open, new_preview_open, 1)

old_open_success = '''      state.attendance.visible = false;\n      state.attendance.expiresAt = 0;\n      state.attendance.count = 0;\n\n      paintAttendance();\n'''
new_open_success = '''      state.attendance.visible = false;\n      state.attendance.expiresAt = 0;\n      state.attendance.count = 0;\n      state.attendance.registered = false;\n\n      paintAttendance();\n'''
if old_open_success not in source:
    raise SystemExit("open success marker not found")
source = source.replace(old_open_success, new_open_success, 1)

old_close = '''      state.attendance.code = "";\n      state.attendance.visible = false;\n      state.attendance.expiresAt = 0;\n\n      stopTimer();\n      paintAttendance();\n'''
new_close = '''      state.attendance.code = "";\n      state.attendance.visible = false;\n      state.attendance.expiresAt = 0;\n      state.attendance.registered = false;\n\n      stopTimer();\n      paintAttendance();\n'''
if source.count(old_close) < 2:
    raise SystemExit("close markers not found")
source = source.replace(old_close, new_close, 2)

old_registered = '''          if (data.registered) {\n            input.value = "";\n          }\n'''
new_registered = '''          if (data.registered) {\n            input.value = "";\n            state.attendance.registered = true;\n            paintAttendance();\n          }\n'''
if old_registered not in source:
    raise SystemExit("successful checkin marker not found")
source = source.replace(old_registered, new_registered, 1)

path.write_text(source, encoding="utf-8")
