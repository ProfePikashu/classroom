const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('frontend/curso-ayrpc-2026.html', 'utf8');
const css = fs.readFileSync('frontend/css/styles.css', 'utf8');

assert.match(
  html,
  /<a\s+href="clases-ayrpc-2026\.html"\s+class="btn btn-primary">[\s\S]*?Ver clases[\s\S]*?<\/a>/,
  'El CTA principal de AyRPC 2026 debe enlazar a clases-ayrpc-2026.html.'
);

assert.ok(
  !html.includes('Inicio estimado · Octubre 2026'),
  'La vista del curso no debe mostrar una fecha estimada de inicio una vez comenzada la cursada.'
);

const heroBefore = css.match(/\.hero-panel::before\s*\{([\s\S]*?)\}/);
assert.ok(heroBefore, 'Debe existir la capa decorativa .hero-panel::before.');
assert.ok(
  /pointer-events\s*:\s*none\s*;/.test(heroBefore[1]),
  'La capa decorativa del hero no debe interceptar taps/clicks de los CTA.'
);

console.log('OK: CTA de AyRPC 2026 navegable y sin fecha estimada obsoleta');
