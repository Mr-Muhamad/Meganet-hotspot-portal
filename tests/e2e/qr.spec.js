const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * The in-page voucher scanner: the login-page button opens a modal right
 * where the user stands (no navigation). A photographed card is decoded by
 * the vendored jsqrcode and a bare code starts the cancellable auto-login
 * countdown; a link-card URL navigates to the URL the QR itself carries.
 *
 * Fixtures were generated with the Python `qrcode` package:
 *   voucher-code.png  → "1234567890"                      (code-only card)
 *   voucher-link.png  → "http://10.5.50.1/login.html?voucher=1234567890"  (link card)
 */

const DEFAULT = 'http://127.0.0.1:8790';
const FIXTURES = path.join(__dirname, 'fixtures');

test('the QR button opens the scanner in-place, without any navigation', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  await page.locator('#qrScanButton').click();

  // the modal opens right here — the URL must not change
  await expect(page.locator('#qrModal')).toHaveClass(/support-modal--open/);
  expect(page.url()).toContain('/ar/login.html');

  // the vendored decoder is lazy-loaded on open, same-origin
  await page.waitForFunction(() => typeof window.qrcode === 'object');
  // the window.Hotspot assembly exposes the module
  expect(await page.evaluate(() => typeof window.Hotspot.qrScanner)).toBe('object');
});

test('a photographed code card fills the voucher and auto-logs-in in-place', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  await page.locator('#qrScanButton').click();
  await page.waitForFunction(() => typeof window.qrcode === 'object');

  // the full pipeline: photo → FileReader → jsqrcode → fill → 3s countdown
  // → submitLoginForm → the POST the router actually receives
  const request = await Promise.all([
    page.waitForRequest((req) => req.method() === 'POST'),
    page.locator('#qr-file-input').setInputFiles(path.join(FIXTURES, 'voucher-code.png'))
  ]).then(([req]) => req);

  const body = request.postData();
  expect(body).toContain('username=1234567890');
  expect(body).toContain('password=1234567890');
  // the user never left the login page
  expect(page.url()).toContain('/ar/login.html');
});

test('a link-card QR payload navigates to the URL it carries', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  // Abort the router POST the destination page auto-fires — we only assert
  // that scanning a URL payload takes the browser there.
  await page.route('http://10.5.50.1/**', (route) => route.abort());

  await page.evaluate(() => {
    window.Hotspot.qrScanner._handleResult('http://127.0.0.1:8790/login.html?voucher=55555');
  });

  await expect(page).toHaveURL(/voucher=55555/);
});

// These two check what the router actually receives for credential links:
// the auto-login submits the form ~500 ms after load, so we intercept the
// POST rather than racing the field values before the page navigates away.
test('a mikhmon-format link (?username=X&password=Y) logs in with the carried password', async ({ page }) => {
  // mikhmon prints cards whose QR encodes
  // http://<dnsname>/login?username=<u>&password=<p> — the portal must honor
  // the carried password instead of copying the voucher into it.
  const request = await Promise.all([
    page.waitForRequest((req) => req.method() === 'POST'),
    page.goto(`${DEFAULT}/login.html?username=ahmed2015&password=secret99`)
  ]).then(([req]) => req);

  const body = request.postData();
  expect(body).toContain('username=ahmed2015');
  expect(body).toContain('password=secret99');
});

test('a plain voucher link (?voucher=X) keeps copying the code as the password', async ({ page }) => {
  const request = await Promise.all([
    page.waitForRequest((req) => req.method() === 'POST'),
    page.goto(`${DEFAULT}/ar/login.html?voucher=1234567890`)
  ]).then(([req]) => req);

  const body = request.postData();
  expect(body).toContain('username=1234567890');
  expect(body).toContain('password=1234567890');
});
