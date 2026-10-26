const fs = require('fs');
const path = require('path');
const assert = require('assert');

const css = fs.readFileSync('frontend/css/pelusita-v2.css', 'utf8');
const sidebarJs = fs.readFileSync('frontend/js/sidebar-v2.js', 'utf8');

assert.ok(
  sidebarJs.includes('mobile-topbar-scrolled') && sidebarJs.includes('window.scrollY'),
  'Debe existir un fallback global por JS que compacte el topbar mobile al hacer scroll.'
);

assert.ok(
  css.includes('body.mobile-topbar-scrolled .topbar'),
  'Debe existir el estado CSS global de topbar mobile scrolleado.'
);

assert.ok(
  css.includes('--classroom-mobile-action-size: 32px'),
  'Los controles mobile deben arrancar mas compactos (32px).'
);

assert.ok(
  css.includes('--classroom-mobile-action-size: 28px'),
  'Al scrollear, los controles mobile deben reducirse a 28px.'
);

assert.ok(
  css.includes('.theme-toggle-icon') && css.includes('padding: 0 !important'),
  'El switch de tema mobile debe eliminar padding extra.'
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

console.log(`OK: mobile header scroll compact (${topbarPages.length} topbar pages covered)`);
