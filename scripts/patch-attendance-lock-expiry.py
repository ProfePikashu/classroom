from pathlib import Path

path = Path('frontend/js/clases-ayrpc-2026.js')
text = path.read_text(encoding='utf-8')

old_message = '''      if (message) {
        message.textContent =
          "La asistencia está habilitada. Seguí las indicaciones dadas durante la transmisión.";
      }
'''
new_message = '''      if (message) {
        message.textContent =
          "No hay un código de asistencia activo. Esperá que se genere uno nuevo.";
      }
'''

if old_message not in text and new_message not in text:
    raise SystemExit('No se encontró el bloque del mensaje sin token activo')
text = text.replace(old_message, new_message, 1)

anchor = '''        event.preventDefault();

        if (!feedback || !state.selected) return;

        const code =
'''
replacement = '''        event.preventDefault();

        if (!feedback || !state.selected) return;

        if (state.attendance?.registered) {
          feedback.hidden = false;
          feedback.className =
            "ayrpc2026-live-feedback ok";
          feedback.textContent =
            "Tu código de asistencia ya fue registrado correctamente.";
          form.hidden = true;
          return;
        }

        const code =
'''

if anchor not in text and 'if (state.attendance?.registered)' not in text:
    raise SystemExit('No se encontró el punto de bloqueo del segundo código')
text = text.replace(anchor, replacement, 1)

path.write_text(text, encoding='utf-8')
