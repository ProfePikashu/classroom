const fs = require('fs');
const path = require('path');
const assert = require('assert');

const cssPath = 'frontend/css/pelusita-v2.css';
const css = fs.readFileSync(cssPath, 'utf8');
const courseHeaderCssPath = 'frontend/css/mobile-course-header.css';
const courseHeaderCss = fs.readFileSync(courseHeaderCssPath, 'utf8');

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
  'El header mobile global debe compactarse progresivamente al hacer scroll.'
);

assert.ok(
  css.includes('.topbar .eyebrow') && css.includes('--classroom-mobile-eyebrow-height: 0px'),
  'El eyebrow del header global debe colapsarse durante el scroll para liberar altura.'
);

assert.ok(
  courseHeaderCss.includes('MOBILE COURSE HEADER') &&
  courseHeaderCss.includes('.page-curso-ayrpc-2026 .hero-panel::before') &&
  courseHeaderCss.includes('pointer-events: none !important'),
  'El CSS específico de curso debe limitarse a evitar que la decoración bloquee el CTA.'
);

assert.ok(
  courseHeaderCss.includes('.page-curso-ayrpc-2026 .hero-actions .btn') &&
  courseHeaderCss.includes('pointer-events: auto'),
  'El botón Ver clases de AyRPC 2026 debe seguir siendo interactivo.'
);

assert.ok(
  !courseHeaderCss.includes('.topbar h1') &&
  !courseHeaderCss.includes('.topbar-actions > button'),
  'Las páginas de curso deben usar el header mobile global sin overrides compactos propios.'
);

for (const page of ['curso-ayrpc-2025.html', 'curso-ayrpc-2026.html']) {
  const html = fs.readFileSync(path.join('frontend', page), 'utf8');
  assert.ok(
    html.includes('css/mobile-course-header.css'),
    `${page} debe cargar mobile-course-header.css.`
  );
  assert.ok(
    html.includes('css/pelusita-v2.css'),
    `${page} debe cargar pelusita-v2.css para usar el shell mobile global.`
  );
}

console.log('OK: mobile sidebar + course header aligned with global mobile shell');
