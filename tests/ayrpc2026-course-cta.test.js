const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('frontend/curso-ayrpc-2026.html', 'utf8');
const css = fs.readFileSync('frontend/css/mobile-course-header.css', 'utf8');

assert.match(
  html,
  /<a\s+href="clases-ayrpc-2026\.html"\s+class="btn btn-primary">[\s\S]*?Ver clases[\s\S]*?<\/a>/,
  'El CTA principal de AyRPC 2026 debe enlazar a clases-ayrpc-2026.html.'
);

assert.ok(
  !html.includes('Inicio estimado · Octubre 2026'),
  'La vista del curso no debe mostrar una fecha estimada de inicio una vez comenzada la cursada.'
);

assert.match(
  css,
  /\.page-curso-ayrpc-2026\s+\.hero-panel::before\s*\{[\s\S]*?pointer-events\s*:\s*none\s*!important\s*;/,
  'La capa decorativa del hero de AyRPC 2026 no debe interceptar taps/clicks.'
);

assert.match(
  css,
  /\.page-curso-ayrpc-2026\s+\.hero-actions\s*\{[\s\S]*?z-index\s*:\s*2\s*;/,
  'Las acciones del hero deben quedar por encima de la decoración.'
);

console.log('OK: CTA de AyRPC 2026 navegable y sin fecha estimada obsoleta');
