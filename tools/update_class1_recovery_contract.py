from pathlib import Path


def replace_all(path: Path, replacements: dict[str, str]) -> None:
    text = path.read_text(encoding="utf-8")
    for old, new in replacements.items():
        count = text.count(old)
        if count != 1:
            raise SystemExit(f"{path}: expected exactly one match, got {count}: {old[:80]}")
        text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")


replace_all(
    Path("tests/ayrpc2026-class1-recovery.test.js"),
    {
        'assert.match(html, /js\\/ayrpc2026-recovery\\.js\\?v=20261028-edge-v1/, "la vista debe forzar el tracker edge nuevo");':
            'assert.match(html, /js\\/ayrpc2026-recovery\\.js\\?v=[A-Za-z0-9._-]+/, "la vista debe invalidar cache al cargar el tracker de recuperación");',
        'assert.match(html, /js\\/ayrpc2026-recovery-ux\\.js\\?v=20261028-edge-v1/, "la vista debe cargar la UX compatible con el tracker edge");':
            'assert.match(html, /js\\/ayrpc2026-recovery-ux\\.js\\?v=[A-Za-z0-9._-]+/, "la vista debe invalidar cache al cargar la UX del tracker");',
        'assert.match(recovery, /const CLASS1_REQUIRED_WATCH_SECONDS = 6960/, "la Clase 1 debe llegar al 100% en 1h56 desde el inicio");':
            'assert.match(recovery, /REQUIRED_WATCH_SECONDS_BY_CLASS[\\s\\S]*1:\\s*6960/, "la Clase 1 debe seguir llegando al 100% en 1h56 desde el inicio");',
        'assert.match(recovery, /function knownDuration\\(\\)[\\s\\S]*required_watch_seconds[\\s\\S]*CLASS1_REQUIRED_WATCH_SECONDS/, "la barra debe usar el corte académico y no la duración completa subida a YouTube");':
            'assert.match(recovery, /function knownDuration\\(\\)[\\s\\S]*required_watch_seconds[\\s\\S]*REQUIRED_WATCH_SECONDS_BY_CLASS/, "la barra debe priorizar el corte académico del backend y conservar el fallback por clase");',
    },
)

replace_all(
    Path("tests/ayrpc2026-recovery-edge.test.js"),
    {
        '/js\\/ayrpc2026-recovery\\.js\\?v=20261028-edge-v1/':
            '/js\\/ayrpc2026-recovery\\.js\\?v=[A-Za-z0-9._-]+/',
        '/js\\/ayrpc2026-recovery-ux\\.js\\?v=20261028-edge-v1/':
            '/js\\/ayrpc2026-recovery-ux\\.js\\?v=[A-Za-z0-9._-]+/',
    },
)
