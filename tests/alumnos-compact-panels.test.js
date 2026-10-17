const fs = require('fs');
const assert = require('assert');

const htmlPath = 'frontend/alumnos.html';
const cssPath = 'frontend/css/alumnos-compact.css';
const jsPath = 'frontend/js/alumnos-compact-panels.js';

const html = fs.readFileSync(htmlPath, 'utf8');

assert.ok(
  fs.existsSync(cssPath),
  'Debe existir un CSS dedicado para compactar las cards de Alumnos.'
);
assert.ok(
  fs.existsSync(jsPath),
  'Debe existir el controlador visual para colapsar Solicitudes de baja.'
);

const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';

assert.ok(html.includes('css/alumnos-compact.css'), 'alumnos.html debe cargar el CSS compacto.');
assert.ok(html.includes('js/alumnos-compact-panels.js'), 'alumnos.html debe cargar el JS compacto.');
assert.ok(css.includes('grid-template-columns'), 'Las cards superiores deben compartir una grilla compacta.');
assert.ok(css.includes('max-height') && css.includes('overflow-y: auto'), 'La lista expandida de bajas debe tener altura máxima y scroll interno.');
assert.ok(js.includes('adminWithdrawalToggle'), 'Debe existir un botón para mostrar/ocultar solicitudes de baja.');
assert.ok(js.includes('is-collapsed'), 'Solicitudes de baja debe iniciar colapsada y alternar ese estado.');
assert.ok(js.includes('aria-expanded'), 'El toggle debe exponer su estado de accesibilidad.');

console.log('OK: compact alumnos cards');
