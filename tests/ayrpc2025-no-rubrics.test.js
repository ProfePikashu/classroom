const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('frontend/clases-ayrpc-2025.html', 'utf8');
const js = fs.readFileSync('frontend/js/clases-ayrpc-2025.js', 'utf8');

assert.ok(
  !html.includes('href="rubricas-ayrpc-2025.html"'),
  'Clases AyRPC 2025 no debe mostrar accesos a la sección de Rúbricas.'
);

assert.ok(
  !js.includes('this.applyLocalRubrics();'),
  'Clases AyRPC 2025 no debe aplicar rúbricas locales al inicializar.'
);

assert.ok(
  !js.includes('ayrpc-2025-rubrics-v1') && !js.includes('ayrpc-2025-rubrics-v2'),
  'Clases AyRPC 2025 no debe depender de rúbricas guardadas en localStorage.'
);

console.log('OK: Clases AyRPC 2025 sin sección ni overrides de rúbricas');
