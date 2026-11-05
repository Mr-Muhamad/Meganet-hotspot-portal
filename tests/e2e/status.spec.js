const { test, expect } = require('@playwright/test');

/**
 * Status-page behavior: demo-data substitution, the connection-quality probe
 * (regression guard for the /ar/ relative-path bug), and the collapsible
 * technical details.
 */

const DEFAULT = 'http://127.0.0.1:8790';

test('renders the RouterOS demo data from the preview server', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/status.html`);
  // #device-os-display is repurposed by JS for the device name, so the
  // username is asserted in the technical details instead.
  await expect(page.locator('#tech-username')).toContainText('ahmed_sayed');
  await expect(page.locator('body')).toContainText('10.5.50.118');
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

  // technical fields render the demo values too
  await expect(page.locator('#tech-ip')).toContainText('10.5.50.118');
});

test('no RouterOS template variable leaks onto the rendered page', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/status.html`);
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/\$\([a-z]/i);
});

test('logout button targets the demo link-logout', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/status.html`);
  await expect(page.locator('#logout-btn')).toHaveAttribute('href', 'http://10.5.50.1/logout');
});
