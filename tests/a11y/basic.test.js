/**
 * Basic accessibility invariants over the BUILT dist pages (the project
 * ships static HTML, so we assert the output, not the templates).
 *
 * Run with: npm run test:a11y
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');
const PAGES = ['index', 'login', 'status', 'logout', 'fstatus', 'flogout', 'error', 'expired', 'plans', 'alogin'];

const enDict = require('../../src/i18n/en.json').en;
const arDict = require('../../src/i18n/ar.json').ar;

function readPage(name, lang) {
  const file = lang === 'ar' ? path.join(DIST, 'ar', `${name}.html`) : path.join(DIST, `${name}.html`);
  return fs.readFileSync(file, 'utf8');
}

describe('a11y invariants (built dist)', () => {
  test('every page except index has a skip-link, main landmark, aria-hidden canvas, and localized theme aria-label', () => {
    for (const page of PAGES) {
      if (page === 'index') continue; // pure redirect page
      for (const lang of ['en', 'ar']) {
        const dict = lang === 'ar' ? arDict : enDict;
        const html = readPage(page, lang);
        expect(html).toContain('class="skip-link"');
        expect(html).toContain('<main id="main"');
        expect(html).toContain('id="network-bg"');
        expect(html).toContain('aria-hidden="true"');
        expect(html).toContain(`aria-label="${dict.theme_switch_to_light}"`);
      }
    }
  });

  test('the login form labels its inputs and exposes alerts for errors', () => {
    const en = readPage('login', 'en');
    expect(en).toContain('data-i18n="username_label"');
    expect(en).toContain('data-i18n="password_label"');
    expect(en).toContain('role="alert"');
    expect(en).toContain(`aria-label="${enDict.password_show}"`);
  });

  test('icon-only buttons carry localized accessible names in Arabic pages (zero FOUC)', () => {
    const ar = readPage('login', 'ar');
    expect(ar).toContain(`aria-label="${arDict.lang_toggle_aria}"`);
    expect(ar).toContain(`aria-label="${arDict.install_app_btn}"`);
    expect(ar).toContain(`aria-label="${arDict.technical_support}"`);
    expect(ar).toContain(arDict.login_title);
    expect(ar).toContain('<bdi dir="ltr">');
  });

  test('modals declare role="dialog" and aria-modal="true"', () => {
    const en = readPage('login', 'en');
    expect(en).toContain('id="supportModal"');
    expect(en).toContain('role="dialog"');
    expect(en).toContain('aria-modal="true"');
  });

  test('no page ships an empty <title> (catches missing *_title keys)', () => {
    for (const page of PAGES) {
      for (const lang of ['en', 'ar']) {
        const html = readPage(page, lang);
        const title = html.match(/<title>(.*?)<\/title>/s);
        const label = `${page} (${lang})`;
        if (!title) {
          throw new Error(label + ': missing <title>');
        }
        // "$(hostname) - " trailing is a missing i18n key
        const trimmed = title[1].trim();
        expect(trimmed.length).toBeGreaterThan(0);
        expect(trimmed).not.toMatch(/[-\s]+$/);
      }
    }
  });
});
