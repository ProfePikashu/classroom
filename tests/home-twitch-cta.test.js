const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const homeHtml = fs.readFileSync(path.join(repoRoot, 'frontend', 'index.html'), 'utf8');
const twitchCssPath = path.join(repoRoot, 'frontend', 'css', 'home-twitch.css');

test('Inicio prioriza el canal oficial de Twitch', () => {
  assert.match(homeHtml, /class="home-twitch-hero"/);
  assert.match(homeHtml, /href="https:\/\/www\.twitch\.tv\/profe_pikashu"/);
  assert.match(homeHtml, /target="_blank"/);
  assert.match(homeHtml, /rel="noopener noreferrer"/);
  assert.match(homeHtml, /Ir a Twitch/i);
});

test('El hero de Twitch conserva al Pikachu del Classroom', () => {
  assert.match(homeHtml, /class="home-twitch-pikachu-orb"/);
  assert.match(homeHtml, /src="media\/icons\/classroomico\.png"/);
  assert.match(homeHtml, /src="media\/icons\/classroomicoclaro\.png"/);
});

test('Inicio carga estilos responsive dedicados al CTA de Twitch', () => {
  assert.match(homeHtml, /css\/home-twitch\.css/);
  assert.equal(fs.existsSync(twitchCssPath), true);

  const css = fs.readFileSync(twitchCssPath, 'utf8');
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(css, /\.home-twitch-primary/);
  assert.match(css, /\.home-twitch-pikachu-orb/);
  assert.match(css, /width:\s*100%/);
});
