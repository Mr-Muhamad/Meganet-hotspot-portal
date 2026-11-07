const { test, expect } = require('@playwright/test');

/**
 * Theme flow: first visit follows the OS preference (pre-paint, no dark
 * flash), a manual toggle is remembered for a year, the toast/aria-labels
 * are localized, meta theme-color follows, and every page applies the
 * cookie. Screenshots of both themes double as the visual audit artifacts.
 */

const DEFAULT = 'http://127.0.0.1:8790';

test('first visit follows the OS color scheme (no cookie)', async ({ browser }) => {
  const lightCtx = await browser.newContext({ colorScheme: 'light' });
  const darkCtx = await browser.newContext({ colorScheme: 'dark' });

  const lightPage = await lightCtx.newPage();
  const darkPage = await darkCtx.newPage();
  await lightPage.goto(`${DEFAULT}/ar/login.html`);
  await darkPage.goto(`${DEFAULT}/ar/login.html`);

  await expect(lightPage.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(darkPage.locator('html')).toHaveAttribute('data-theme', 'dark');

  // OS-following is not a choice: no cookie until the user toggles manually
  const lightCookies = await lightCtx.cookies();
  expect(lightCookies.find((c) => c.name === 'hotspot_theme')).toBeUndefined();

  await lightCtx.close();
  await darkCtx.close();
});

test('manual toggle flips everything and is remembered across pages', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  // the default Playwright context is light-OS → the first visit lands light
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.locator('.theme-toggle').click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // localized confirmation toast
  await expect(page.locator('.toast')).toContainText('الوضع الليلي');
  // the choice is stored
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'hotspot_theme')?.value).toBe('dark');
  // mobile browser chrome follows
  await expect(page.locator('#metaThemeColor')).toHaveAttribute('content', '#020617');
  // screen-reader label is localized
  await expect(page.locator('.theme-toggle')).toHaveAttribute('aria-label', 'التبديل للوضع النهاري');

  // persistence: another page applies the stored choice
  await page.goto(`${DEFAULT}/ar/plans.html`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#metaThemeColor')).toHaveAttribute('content', '#020617');
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
    for (const name of ['login', 'status', 'plans']) {
      await page.goto(`${DEFAULT}/ar/${name}.html`);
      await page.waitForTimeout(250); // canvas/background settle
      await page.screenshot({ path: `test-results/theme-${name}-${theme}.png`, fullPage: true });
    }
  }
});
