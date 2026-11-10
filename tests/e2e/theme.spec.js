const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * Theme flow: first visit follows the portal's configured default theme
 * (config.theme.defaultTheme, or dark when unset — pre-paint, no flash), a
 * manual toggle is remembered for a year, the toast/aria-labels are
 * localized, meta theme-color follows, and every page applies the cookie.
 * Screenshots of both themes double as the visual audit artifacts.
 */

const DEFAULT = 'http://127.0.0.1:8790';

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config.json'), 'utf8'));
// The build applies theme presets (scripts/presets.js) — mirror that here so
// the expected default matches what the served pages actually render.
const effective = require('../../scripts/presets.js').resolveEffectiveConfig(cfg);
const DEFAULT_THEME = effective.theme?.defaultTheme || 'dark';
const DARK_META = effective.theme?.backgroundColor || '#020617';
const LIGHT_META = '#f8fafc';

test('first visit follows the portal default theme (no cookie)', async ({ browser }) => {
  // the OS color scheme no longer picks the first theme — the config default does
  const lightCtx = await browser.newContext({ colorScheme: 'light' });
  const darkCtx = await browser.newContext({ colorScheme: 'dark' });

  const lightPage = await lightCtx.newPage();
  const darkPage = await darkCtx.newPage();
  await lightPage.goto(`${DEFAULT}/ar/login.html`);
  await darkPage.goto(`${DEFAULT}/ar/login.html`);

  await expect(lightPage.locator('html')).toHaveAttribute('data-theme', DEFAULT_THEME);
  await expect(darkPage.locator('html')).toHaveAttribute('data-theme', DEFAULT_THEME);

  // a default is not a choice: no cookie until the user toggles manually
  const lightCookies = await lightCtx.cookies();
  expect(lightCookies.find((c) => c.name === 'hotspot_theme')).toBeUndefined();

  await lightCtx.close();
  await darkCtx.close();
});

test('manual toggle flips everything and is remembered across pages', async ({ page }) => {
  const other = DEFAULT_THEME === 'dark' ? 'light' : 'dark';
  const meta = DEFAULT_THEME === 'dark' ? DARK_META : LIGHT_META;
  const otherMeta = other === 'dark' ? DARK_META : LIGHT_META;
  const toastOther = other === 'dark' ? 'الوضع الليلي' : 'الوضع النهاري';
  const ariaAfterToggle = other === 'dark' ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي';

  await page.goto(`${DEFAULT}/ar/login.html`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', DEFAULT_THEME);

  await page.locator('.theme-toggle').click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', other);
  // localized confirmation toast
  await expect(page.locator('.toast')).toContainText(toastOther);
  // the choice is stored
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'hotspot_theme')?.value).toBe(other);
  // mobile browser chrome follows
  await expect(page.locator('#metaThemeColor')).toHaveAttribute('content', otherMeta);
  // screen-reader label is localized
  await expect(page.locator('.theme-toggle')).toHaveAttribute('aria-label', ariaAfterToggle);

  // persistence: another page applies the stored choice
  await page.goto(`${DEFAULT}/ar/plans.html`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', other);
  await expect(page.locator('#metaThemeColor')).toHaveAttribute('content', otherMeta);
});

test('a stored light theme applies before paint and survives navigation', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.cookie = 'hotspot_theme=light; path=/; max-age=31536000; SameSite=Lax';
  });

  await page.goto(`${DEFAULT}/ar/status.html`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  // the light surface really is painted (not just an attribute)
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(248, 250, 252)'); // --color-bg light: #f8fafc
});

test('both themes paint every portal page (visual audit screenshots)', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
      document.cookie = 'hotspot_theme=' + t + '; path=/; max-age=31536000; SameSite=Lax';
    }, theme);
    for (const name of ['login', 'status', 'logout', 'plans', 'alogin', 'expired']) {
      await page.goto(`${DEFAULT}/ar/${name}.html`);
      await page.waitForTimeout(250); // canvas/background settle
      // Viewport-only captures: these double as the README hero set, and
      // fullPage shots had three different heights (status alone was ~2.2x
      // login), making the side-by-side row ragged. Uniform 393x851 frames.
      await page.screenshot({ path: `test-results/theme-${name}-${theme}.png` });
    }
  }
});
