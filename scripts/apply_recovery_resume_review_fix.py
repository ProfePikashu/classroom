from pathlib import Path

path = Path("frontend/js/ayrpc2026-recovery.js")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    '    resumePosition: 0,\n    pendingSeconds: 0,\n',
    '    resumePosition: 0,\n    resumeActionDismissed: false,\n    pendingSeconds: 0,\n',
    "dismiss state",
)

replace_once(
    '      state.config?.eligible === true &&\n      resumePosition >= MIN_RESUME_POSITION_SECONDS &&\n      !state.quizUnlocked;\n',
    '      state.config?.eligible === true &&\n      Boolean(state.player) &&\n      resumePosition >= MIN_RESUME_POSITION_SECONDS &&\n      !state.resumeActionDismissed &&\n      !state.quizUnlocked;\n',
    "button readiness",
)

replace_once(
    '      state.resumePosition = resumePosition;\n      refreshResumeAction();\n',
    '      state.resumePosition = resumePosition;\n      state.resumeActionDismissed = true;\n      refreshResumeAction();\n',
    "dismiss after continue",
)

replace_once(
    '    state.resumePosition = 0;\n    state.pendingSeconds = 0;\n',
    '    state.resumePosition = 0;\n    state.resumeActionDismissed = false;\n    state.pendingSeconds = 0;\n',
    "reset dismiss state",
)

path.write_text(text, encoding="utf-8")
print("recovery resume review fixes applied")
