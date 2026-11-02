from pathlib import Path

html_path = Path("frontend/clases-ayrpc-2026.html")
html = html_path.read_text(encoding="utf-8")
replacements = {
    'js/clases-ayrpc-2026.js?v=20261030-paste-v1': 'js/clases-ayrpc-2026.js?v=20261102-class2-switch-fix-v1',
    'js/ayrpc2026-recovery.js?v=20261102-class2-qa-v1': 'js/ayrpc2026-recovery.js?v=20261102-class2-switch-fix-v1',
}
for old, new in replacements.items():
    count = html.count(old)
    if count != 1:
        raise SystemExit(f"HTML expected exactly one {old!r}, got {count}")
    html = html.replace(old, new, 1)
html_path.write_text(html, encoding="utf-8")

class1_test_path = Path("tests/ayrpc2026-class1-recovery.test.js")
class1_test = class1_test_path.read_text(encoding="utf-8")
old = 'assert.match(html, /js\\/clases-ayrpc-2026\\.js\\?v=20261030-paste-v1/, "la vista debe invalidar el cache del polling de asistencia optimizado");'
new = 'assert.match(html, /js\\/clases-ayrpc-2026\\.js\\?v=[A-Za-z0-9._-]+/, "la vista debe invalidar cache al cargar la selección y asistencia de clases");'
count = class1_test.count(old)
if count != 1:
    raise SystemExit(f"class1 test expected exact cache assertion once, got {count}")
class1_test = class1_test.replace(old, new, 1)
class1_test_path.write_text(class1_test, encoding="utf-8")

player_test_path = Path("tests/ayrpc2026-player-policy.test.js")
player_test = player_test_path.read_text(encoding="utf-8")
old = '/js\\/clases-ayrpc-2026\\.js\\?v=20261030-paste-v1/'
new = '/js\\/clases-ayrpc-2026\\.js\\?v=[A-Za-z0-9._-]+/'
count = player_test.count(old)
if count != 1:
    raise SystemExit(f"player test expected exact cache assertion once, got {count}")
player_test = player_test.replace(old, new, 1)
player_test_path.write_text(player_test, encoding="utf-8")
