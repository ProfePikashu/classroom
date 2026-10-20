const fs = require('fs');
const assert = require('assert');

const cssPath = 'frontend/css/pelusita-v2.css';
const css = fs.readFileSync(cssPath, 'utf8');

assert.ok(
  css.includes('MOBILE SHELL CLEANUP 20261020'),
  'Debe existir el bloque de limpieza visual mobile del shell.'
);

assert.ok(
  css.includes('.sidebar-v2-submenu.open') && css.includes('max-height: none !important'),
  'Cursos abierto en mobile no debe quedar recortado por una altura fija.'
);

assert.ok(
  css.includes('#sidebarPelusitaDock') && css.includes('flex: 0 0 82px !important'),
  'Pelusita debe usar un footer compacto y reservar mucho menos alto en mobile.'
);

assert.ok(
  css.includes('.pelusita-v2-panel.open') && css.includes('z-index: 14050 !important'),
  'El panel de Pelusita debe quedar por encima del drawer mobile.'
);

assert.ok(
  css.includes('@keyframes classroom-mobile-topbar-compact') &&
  css.includes('animation-timeline: scroll(root block)'),
  'El header mobile debe compactarse progresivamente al hacer scroll.'
);

assert.ok(
  css.includes('.topbar .eyebrow') && css.includes('max-height: 0'),
  'El eyebrow del header debe colapsarse durante el scroll para liberar altura.'
);

console.log('OK: mobile sidebar and compact header');
