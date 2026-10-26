const fs = require('fs');
const path = require('path');
const assert = require('assert');

const frontendDir = 'frontend';
const classesHtml = fs.readFileSync(path.join(frontendDir, 'clases-ayrpc-2025.html'), 'utf8');
const sidebarJs = fs.readFileSync(path.join(frontendDir, 'js/sidebar-v2.js'), 'utf8');
const rubricsPage = path.join(frontendDir, 'rubricas-ayrpc-2025.html');

assert.ok(
  !classesHtml.includes('href="rubricas-ayrpc-2025.html"'),
  'Clases AyRPC 2025 no debe mostrar accesos propios a la sección de Rúbricas.'
);

assert.ok(
  classesHtml.includes('js/clases-ayrpc-2025.js'),
  'El retiro de Rúbricas no debe sacar la lógica de recuperación 2025.'
);

assert.ok(
  !fs.existsSync(rubricsPage),
  'La página rubricas-ayrpc-2025.html debe dejar de existir.'
);

assert.ok(
  sidebarJs.includes('removeRetiredRubricsLinks') &&
  sidebarJs.includes('a[href="rubricas-ayrpc-2025.html"]') &&
  sidebarJs.includes('.remove()'),
  'El shell global debe eliminar cualquier enlace heredado a Rúbricas 2025.'
);

assert.ok(
  sidebarJs.includes('removeRetiredRubricsLinks();'),
  'La limpieza global de Rúbricas 2025 debe ejecutarse al inicializar el sidebar.'
);

const htmlFiles = fs.readdirSync(frontendDir).filter((name) => name.endsWith('.html'));
const staleReferences = htmlFiles.filter((name) => {
  const html = fs.readFileSync(path.join(frontendDir, name), 'utf8');
  return html.includes('rubricas-ayrpc-2025.html');
});

const withoutGlobalCleanup = staleReferences.filter((name) => {
  const html = fs.readFileSync(path.join(frontendDir, name), 'utf8');
  return !html.includes('js/sidebar-v2.js');
});

assert.deepStrictEqual(
  withoutGlobalCleanup,
  [],
  `Toda vista con markup heredado de Rúbricas debe cargar la limpieza global. Faltan: ${withoutGlobalCleanup.join(', ')}`
);

console.log(`OK: Rúbricas 2025 eliminadas; ${staleReferences.length} vistas heredadas cubiertas por limpieza global`);
