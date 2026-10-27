from pathlib import Path

path = Path("tests/ayrpc2026-class1-recovery.test.js")
source = path.read_text(encoding="utf-8")
old = 'js\\/ayrpc2026-recovery\\.js\\?v=20261026-tracker-restored-v1'
new = 'js\\/ayrpc2026-recovery\\.js\\?v=20261027-question-feedback-v1'

if old in source:
    path.write_text(source.replace(old, new, 1), encoding="utf-8")
    print("patched")
else:
    print("no changes needed")
