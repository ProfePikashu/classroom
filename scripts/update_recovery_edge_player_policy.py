from pathlib import Path

path = Path("tests/ayrpc2026-player-policy.test.js")
text = path.read_text(encoding="utf-8")
old = "js\\/ayrpc2026-recovery\\.js\\?v=20261027-fullscreen-v4"
new = "js\\/ayrpc2026-recovery\\.js\\?v=20261028-edge-v1"
if old in text:
    text = text.replace(old, new)
path.write_text(text, encoding="utf-8")
print("Player policy cache expectation actualizado")
