/**
 * i18n health audit — guards against dictionary rot.
 *
 * 1. Every key referenced by a template (data-i18n*, {{ i18n.x }}) must exist
 *    in BOTH en.json and ar.json (missing key = user sees a raw key on screen).
 * 2. en.json and ar.json must have identical key sets.
 * 3. Every dictionary key must be referenced somewhere (catches dead keys
 *    left behind after features move to config.json, like the legacy plan_* strings).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TEMPLATES_DIR = path.join(ROOT, 'src', 'templates');
const en = require(path.join(ROOT, 'src', 'i18n', 'en.json')).en;
const ar = require(path.join(ROOT, 'src', 'i18n', 'ar.json')).ar;

function collectTemplateKeys() {
  const keys = new Set();
  fs.readdirSync(TEMPLATES_DIR).forEach(file => {
    const source = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8');
    // data-i18n, data-i18n-placeholder, data-i18n-aria, ...
    const attrRe = /data-i18n[a-z-]*="([^"]+)"/g;
    let match;
    while ((match = attrRe.exec(source)) !== null) keys.add(match[1]);
    // Nunjucks interpolation {{ i18n.key }}
    const interpRe = /\{\{\s*i18n\.([a-zA-Z0-9_]+)\s*\}\}/g;
    while ((match = interpRe.exec(source)) !== null) keys.add(match[1]);
  });
  return keys;
}

// Programmatic lookups: i18n.t('key') called from the JS modules bundled by build.js.
// build.js concatenates util.js + page modules, so all of these resolve at runtime.
function collectProgrammaticKeys() {
  const keys = new Set();
  const modulesDir = path.join(ROOT, 'src', 'js', 'modules');
  fs.readdirSync(modulesDir).forEach(file => {
    const source = fs.readFileSync(path.join(modulesDir, file), 'utf8');
    const callRe = /i18n\.t\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = callRe.exec(source)) !== null) keys.add(match[1]);
  });
  return keys;
}

describe('i18n dictionary health', () => {
  const usedKeys = new Set([...collectTemplateKeys(), ...collectProgrammaticKeys()]);

  test('all template-referenced keys exist in en.json', () => {
    const missing = [...usedKeys].filter(k => !(k in en));
    expect(missing).toEqual([]);
  });

  test('all template-referenced keys exist in ar.json', () => {
    const missing = [...usedKeys].filter(k => !(k in ar));
    expect(missing).toEqual([]);
  });

  test('en.json and ar.json have identical key sets', () => {
    const enKeys = Object.keys(en).sort();
    const arKeys = Object.keys(ar).sort();
    expect(enKeys).toEqual(arKeys);
  });

  test('no dead keys: every dictionary key is referenced by a template', () => {
    const dead = Object.keys(en).filter(k => !usedKeys.has(k));
    expect(dead).toEqual([]);
  });
});
