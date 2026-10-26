const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('frontend/clases-ayrpc-2025.html', 'utf8');

assert.ok(
  !html.includes('href="rubricas-ayrpc-2025.html"'),
  'Clases AyRPC 2025 no debe mostrar accesos a la sección de Rúbricas.'
);

assert.ok(
  html.includes('js/clases-ayrpc-2025.js'),
  'El retiro visual de Rúbricas no debe sacar la lógica de recuperación 2025.'
);

console.log('OK: Clases AyRPC 2025 sin sección visible de Rúbricas');
