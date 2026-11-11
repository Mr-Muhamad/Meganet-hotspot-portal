/**
 * Basic accessibility invariants over the BUILT dist pages (the project
 * ships static HTML, so we assert the output, not the templates).
 *
 * Run with: npm run test:a11y
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');
const PAGES = ['index', 'login', 'status', 'logout', 'error', 'expired', 'plans', 'alogin'];

function readPage(name, lang) {
  const file = lang === 'ar' ? path.join(DIST, 'ar', `${name}.html`) : path.join(DIST, `${name}.html`);
  return fs.readFileSync(file, 'utf8');
}

describe('a11y invariants (built dist)', () => {
  test('every page except index has a skip-link and a main landmark', () => {
    for (const page of PAGES) {
      if (page === 'index') continue; // pure redirect page
      for (const lang of ['en', 'ar']) {
        const html = readPage(page, lang);
        expect(html).toContain('class="skip-link"');
        expect(html).toContain('<main id="main"');
        expect(html).toContain('aria-label="Toggle theme"');
      }
    }
  });

  test('the login form labels its inputs and exposes alerts for errors', () => {
    const en = readPage('login', 'en');
    expect(en).toContain('data-i18n="username_label"');
    expect(en).toContain('data-i18n="password_label"');
    expect(en).toContain('role="alert"');
    expect(en).toContain('aria-label="Show password"');
  });

  test('icon-only buttons carry accessible names', () => {
    const ar = readPage('login', 'ar');
    expect(ar).toContain('aria-label="Toggle language"');
    expect(ar).toContain('aria-label="Install App"');
    expect(ar).toContain('aria-label="Technical Support"');
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
