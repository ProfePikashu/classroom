const fs = require('fs');
const path = require('path');
const assert = require('assert');

const cssPath = 'frontend/css/mobile-header-scroll.css';
const courseCssPath = 'frontend/css/mobile-course-header.css';
const sidebarJs = fs.readFileSync('frontend/js/sidebar-v2.js', 'utf8');

assert.ok(
  sidebarJs.includes('mobile-topbar-scrolled') && sidebarJs.includes('window.scrollY'),
  'Debe existir un fallback global por JS que compacte el topbar mobile al hacer scroll.'
);

assert.ok(
  sidebarJs.includes('window.scrollY > 2'),
  'El header mobile debe compactarse practicamente con el primer gesto de scroll.'
);

assert.ok(
  sidebarJs.includes('mobile-header-scroll.css'),
  'El shell global debe inyectar los estilos compactos del header mobile.'
);

assert.ok(
  fs.existsSync(cssPath),
  'Debe existir el stylesheet global mobile-header-scroll.css.'
);

const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
const courseCss = fs.existsSync(courseCssPath) ? fs.readFileSync(courseCssPath, 'utf8') : '';

assert.ok(
  css.includes('body.mobile-topbar-scrolled .topbar'),
  'Debe existir el estado CSS global de topbar mobile scrolleado.'
);

assert.ok(
  css.includes('height: 38px !important') && css.includes('min-height: 38px !important'),
  'Al scrollear el header mobile debe quedar aproximadamente a la mitad del alto original de 76px.'
);

assert.ok(
  css.includes('body.mobile-topbar-scrolled .mobile-menu-toggle') &&
  css.includes('width: 30px !important') &&
  css.includes('height: 30px !important'),
  'El boton hamburguesa tambien debe reducirse para no volver a inflar el header compacto.'
);

assert.ok(
  css.includes('--classroom-mobile-action-size: 24px'),
  'Los controles del header scrolleado deben ser realmente compactos.'
);

assert.ok(
  css.includes('body.mobile-topbar-scrolled .topbar > div:first-child') &&
  css.includes('display: none !important'),
  'Al scrollear debe ocultarse por completo el bloque de titulo para liberar espacio.'
);

assert.ok(
  css.includes('body.mobile-topbar-scrolled .topbar-actions') &&
  css.includes('margin-left: auto !important') &&
  css.includes('flex: 0 0 auto !important'),
  'Los botones deben quedar anclados a la derecha sin comprimirse ni desplazarse.'
);

assert.ok(
  !courseCss.includes('body.page-curso-ayrpc-2025 .topbar h1') &&
  !courseCss.includes('body.page-curso-ayrpc-2025 .topbar-actions > button'),
  'Las paginas de curso no deben tener reglas especiales que cambien el header mobile global.'
);

assert.ok(
  css.includes('.theme-toggle.theme-toggle-icon.theme-switch') && css.includes('padding: 0 !important'),
  'El switch animado de tema mobile debe forzarse a un tamaño chico sin padding extra.'
);

const frontendDir = 'frontend';
const topbarPages = fs.readdirSync(frontendDir)
  .filter((name) => name.endsWith('.html'))
  .filter((name) => fs.readFileSync(path.join(frontendDir, name), 'utf8').includes('class="topbar"'));

const withoutSidebarJs = topbarPages.filter((name) => {
  const html = fs.readFileSync(path.join(frontendDir, name), 'utf8');
  return !html.includes('js/sidebar-v2.js');
});

assert.deepStrictEqual(
  withoutSidebarJs,
  [],
  `Toda pagina con topbar debe cargar sidebar-v2.js para el fallback mobile. Faltan: ${withoutSidebarJs.join(', ')}`
);

console.log(`OK: mobile header standardized + hidden title on scroll (${topbarPages.length} topbar pages covered)`);
