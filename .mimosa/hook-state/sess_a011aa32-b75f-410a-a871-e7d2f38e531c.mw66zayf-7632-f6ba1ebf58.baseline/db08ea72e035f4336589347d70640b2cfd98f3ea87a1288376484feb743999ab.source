const { test, expect } = require('@playwright/test');

/**
 * Cross-page checks: plans rendering, the index language gate, i18n sanity,
 * and the alogin redirect countdown.
 */

const DEFAULT = 'http://127.0.0.1:8790';

test('plans page renders every configured plan with its price', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/plans.html`);
  const cards = page.locator('.plan-card');
  await expect(cards).toHaveCount(7);
  // Arabic prices carry the Egyptian pound suffix
  await expect(page.locator('.plan-card__price').first()).toContainText('ج.م');
});

test('the plans page links back to login', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/plans.html`);
  await expect(page.locator('.plans-back-btn')).toHaveAttribute('href', './login.html');
});

test('index redirects to the Arabic login for an Arabic-browser visitor', async ({ page }) => {
  // default client is ar-EG (see playwright.config.js)
  await page.goto(`${DEFAULT}/index.html`);
  await expect(page).toHaveURL(/\/ar\/login\.html/);
});

test('every translatable string on the page resolves to real text, not a raw key', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  const stray = await page.evaluate(() => {
    const offenders = [];
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (el.textContent.trim() === key) offenders.push(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (el.getAttribute('placeholder') === key) offenders.push(key);
    });
    return offenders;
  });
  expect(stray).toEqual([]);
});

test('the language toggle switches to the English portal', async ({ context, page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  await expect(page).toHaveURL(/\/ar\/login\.html/);

  // toggleLang() sets hotspot_lang=en and redirects to the root page
  await page.evaluate(() => window.ui.toggleLang());
  await expect(page).toHaveURL(`${DEFAULT}/login.html`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  // the cookie survives for the next visit
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === 'hotspot_lang')?.value).toBe('en');
});

test('alogin shows the connected state and a countdown before redirecting', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/alogin.html`);
  await expect(page.locator('#countdown')).toContainText('3');
  await expect(page.locator('[data-i18n="connected"]')).toBeVisible();
  // the manual escape hatch (Continue Now) targets the demo redirect URL —
  // scope to the card so the support modal's buttons don't match.
  await expect(page.locator('.card a.btn-primary')).toHaveAttribute('href', 'http://www.example.com/');
});
