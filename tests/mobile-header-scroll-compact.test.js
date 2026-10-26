const fs = require('fs');
const path = require('path');
const assert = require('assert');

const css = fs.readFileSync('frontend/css/pelusita-v2.css', 'utf8');
const mainJs = fs.readFileSync('frontend/js/main.js', 'utf8');

assert.ok(
  mainJs.includes('mobile-topbar-scrolled') && mainJs.includes('window.scrollY'),
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

const withoutMainJs = topbarPages.filter((name) => {
  const html = fs.readFileSync(path.join(frontendDir, name), 'utf8');
  return !html.includes('js/main.js');
});

assert.deepStrictEqual(
  withoutMainJs,
  [],
  `Toda pagina con topbar debe cargar main.js para el fallback mobile. Faltan: ${withoutMainJs.join(', ')}`
);

console.log(`OK: mobile header scroll compact (${topbarPages.length} topbar pages covered)`);
