const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Regresión: la página de Rúbricas 2025 debe permanecer eliminada.
const frontendDir = 'frontend';
const classesHtml = fs.readFileSync(path.join(frontendDir, 'clases-ayrpc-2025.html'), 'utf8');
const rubricsPage = path.join(frontendDir, 'rubricas-ayrpc-2025.html');

assert.ok(
  !classesHtml.includes('href="rubricas-ayrpc-2025.html"'),
  'Clases AyRPC 2025 no debe mostrar accesos a la sección de Rúbricas.'
);

assert.ok(
  classesHtml.includes('js/clases-ayrpc-2025.js'),
  'El retiro de Rúbricas no debe sacar la lógica de recuperación 2025.'
);

assert.ok(
  !fs.existsSync(rubricsPage),
  'La página rubricas-ayrpc-2025.html debe dejar de existir.'
);

const htmlFiles = fs.readdirSync(frontendDir).filter((name) => name.endsWith('.html'));
const references = htmlFiles.filter((name) => {
  const html = fs.readFileSync(path.join(frontendDir, name), 'utf8');
  return html.includes('rubricas-ayrpc-2025.html');
});

assert.deepStrictEqual(
  references,
  [],
  `No deben quedar enlaces a Rúbricas 2025. Referencias: ${references.join(', ')}`
);

console.log('OK: AyRPC 2025 sin página ni enlaces de Rúbricas');
