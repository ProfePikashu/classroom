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
  'El header mobile debe compactarse progresivamente al hacer scroll.'
);

assert.ok(
  css.includes('.topbar .eyebrow') && css.includes('--classroom-mobile-eyebrow-height: 0px'),
  'El eyebrow del header debe colapsarse durante el scroll para liberar altura.'
);

assert.ok(
  courseHeaderCss.includes('MOBILE COURSE HEADER COMPACT 20261020'),
  'Debe existir el ajuste específico de cabecera compacta para páginas de curso.'
);

assert.ok(
  courseHeaderCss.includes('body.page-curso-ayrpc-2025 .topbar h1') &&
  courseHeaderCss.includes('display: none !important'),
  'Los títulos largos AyRPC 2025/2026 deben ocultarse en mobile para no chocar con los controles.'
);

assert.ok(
  courseHeaderCss.includes('.topbar-actions > button') &&
  courseHeaderCss.includes('flex: 0 0 34px !important'),
  'Los botones de tema/notificaciones/sonido deben compactarse a 34px en mobile.'
);

for (const page of ['curso-ayrpc-2025.html', 'curso-ayrpc-2026.html']) {
  const html = fs.readFileSync(path.join('frontend', page), 'utf8');
  assert.ok(
    html.includes('css/mobile-course-header.css'),
    `${page} debe cargar mobile-course-header.css.`
  );
}

const frontendDir = 'frontend';
const topbarPages = fs.readdirSync(frontendDir)
  .filter((name) => name.endsWith('.html'))
  .filter((name) => {
    const html = fs.readFileSync(path.join(frontendDir, name), 'utf8');
    return html.includes('class="topbar"');
  });

const withoutMobileShellCss = topbarPages.filter((name) => {
  const html = fs.readFileSync(path.join(frontendDir, name), 'utf8');
  return !html.includes('css/pelusita-v2.css');
});

assert.deepStrictEqual(
  withoutMobileShellCss,
  [],
  `Toda página con topbar debe cargar pelusita-v2.css. Faltan: ${withoutMobileShellCss.join(', ')}`
);

console.log(`OK: mobile sidebar and compact header (${topbarPages.length} topbar pages covered)`);
