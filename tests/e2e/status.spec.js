const { test, expect } = require('@playwright/test');

/**
 * Status-page behavior: demo-data substitution, the connection-quality probe
 * (regression guard for the /ar/ relative-path bug), and the collapsible
 * technical details.
 */

const DEFAULT = 'http://127.0.0.1:8790';

test('renders the RouterOS demo data from the preview server', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/status.html`);
  // #stat-username and #stat-ip render the authenticated demo session in the header.
  await expect(page.locator('#stat-username')).toContainText('ahmed_sayed');
  await expect(page.locator('#stat-ip')).toContainText('10.5.50.118');
  await expect(page.locator('body')).toContainText('02:14:37');
});

test('the connection-quality probe reports latency, not "Offline", on the Arabic page', async ({ page }) => {
  // Regression: the probe fetched a bare relative 'api.json', which 404s one
  // directory deep (/ar/status.html) and wrongly showed "غير متصل".
  await page.goto(`${DEFAULT}/ar/status.html`);
  const value = page.locator('#connection-status-val');

  await page.locator('#connectionStatusCard').click();
  // "Checking..." first, then a real latency reading (Arabic quality word + ms).
  await expect(value).toContainText(/جيد|ممتاز|ضعيف/);
  await expect(value).toContainText(/ms\)/);
  await expect(value).not.toHaveText(/غير متصل|Offline/);
});

test('the connection-quality probe also works on the English page', async ({ page, context }) => {
  await context.addCookies([{ name: 'hotspot_lang', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await page.goto(`${DEFAULT}/status.html`);
  const value = page.locator('#connection-status-val');

  await page.locator('#connectionStatusCard').click();
  await expect(value).toContainText(/Excellent|Good|Poor/);
  await expect(value).toContainText(/ms\)/);
});

test('technical details start collapsed and expand on tap', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/status.html`);
  const trigger = page.locator('.tech-details__trigger');
  const content = page.locator('#techDetailsContent');

  await expect(content).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await trigger.click();
  await expect(content).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  // technical fields render non-duplicate RouterOS details without repeating top header/uptime items
  await expect(page.locator('#tech-mac')).toContainText('3C:5A:B4:0F:22:91');
  await expect(page.locator('#tech-login-by')).toContainText('http-chap');
  await expect(page.locator('#tech-server')).toContainText('hotspot1');
  await expect(page.locator('#tech-idle-timeout')).toContainText('5m');
  await expect(page.locator('#tech-username')).toHaveCount(0);
  await expect(page.locator('#tech-ip')).toHaveCount(0);
  await expect(page.locator('#copy-diagnostics-btn')).toBeVisible();
});

test('no RouterOS template variable leaks onto the rendered page', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/status.html`);
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/\$\([a-z]/i);
});

test('logout button targets link-logout and switch-card navigates directly to login', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/status.html`);
  await expect(page.locator('#logout-btn')).toHaveAttribute('href', 'http://10.5.50.1/logout');
  const switchLink = page.locator('#switchCardLink');
  await expect(switchLink).toHaveAttribute('href', './login.html');
  await expect(switchLink).toHaveAttribute('data-logout-url', 'http://10.5.50.1/logout?erase-cookie=on');
  await switchLink.click();
  await expect(page).toHaveURL(`${DEFAULT}/ar/login.html`);
});
