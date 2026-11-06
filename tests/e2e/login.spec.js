const { test, expect } = require('@playwright/test');

/**
 * Login-page behavior that only a real browser can verify: the Arabic-first
 * redirect, voucher/normal panel control via config, and client-side RADIUS
 * error translation.
 */

const DEFAULT = 'http://127.0.0.1:8790';
const ERROR = 'http://127.0.0.1:8791';

test('a first-time visitor with an Arabic browser is redirected to the Arabic portal', async ({ browser }) => {
  // Locale decides the redirect: on the first visit (no cookie) the portal
  // follows the browser language, defaulting to Arabic for unsupported ones.
  const context = await browser.newContext({ locale: 'ar-EG' });
  const page = await context.newPage();
  try {
    await page.goto(`${DEFAULT}/login.html`);
    await expect(page).toHaveURL(/\/ar\/login\.html/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  } finally {
    await context.close();
  }
});

test('a first-time visitor with an English browser stays on the English login', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  try {
    await page.goto(`${DEFAULT}/login.html`);
    await expect(page).toHaveURL(`${DEFAULT}/login.html`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // the choice is remembered for the next visit
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'hotspot_lang')?.value).toBe('en');
  } finally {
    await context.close();
  }
});

test('an English-pinned visitor stays on the English login', async ({ context, page }) => {
  await context.addCookies([{ name: 'hotspot_lang', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await page.goto(`${DEFAULT}/login.html`);
  await expect(page).toHaveURL(`${DEFAULT}/login.html`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('renders the voucher panel in voucher_only mode', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  // voucher input is the single visible credential field
  await expect(page.locator('#voucher')).toBeVisible();
  await expect(page.locator('#username')).toBeHidden();
});

test('the plans link points at the plans page', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  const link = page.locator('.plans-link');
  await expect(link).toHaveAttribute('href', './plans.html');
});

test('a raw RADIUS error is translated client-side on the Arabic login', async ({ page }) => {
  // The error-scenario server injects $(error); initLang() leaves the page
  // in Arabic, so translateRouterError() must swap in the Arabic text.
  await page.goto(`${ERROR}/ar/login.html`);
  const alert = page.locator('#errorMessage');
  await expect(alert).toBeVisible();
  await expect(alert).not.toHaveText(/invalid username or password/i);
  await expect(alert).toContainText(/اسم المستخدم|كلمة المرور/);
});

test('the error element caches the raw message for re-translation on toggle', async ({ page }) => {
  await page.goto(`${ERROR}/ar/login.html`);
  const alert = page.locator('#errorMessage');
  await expect(alert).toHaveAttribute('data-raw-error', 'invalid username or password');
});

test('caps-lock warning toggles when detectCapsLock fires', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  const warning = page.locator('#caps-lock-warning');

  await page.evaluate(() => window.auth.detectCapsLock({ getModifierState: () => true }));
  await expect(warning).toHaveClass(/visible/);

  await page.evaluate(() => window.auth.detectCapsLock({ getModifierState: () => false }));
  await expect(warning).not.toHaveClass(/visible/);
});

test('unknown reply text is left untouched (no over-eager rewriting)', async ({ page }) => {
  await page.goto(`${ERROR}/ar/login.html`);
  const shown = await page.evaluate(() => {
    const el = document.getElementById('errorMessage');
    // Drop the cached raw error so the wrapper picks up the new text below.
    el.removeAttribute('data-raw-error');
    el.textContent = 'something the map does not know';
    window.ui.translateRouterError();
    return el.textContent;
  });
  expect(shown).toBe('something the map does not know');
});
