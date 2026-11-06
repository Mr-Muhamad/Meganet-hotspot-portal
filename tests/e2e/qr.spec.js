const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * The self-hosted voucher scanner: the login-page button targets qr.html with
 * a return URL, the page decodes a photographed card with the vendored
 * jsqrcode, and a bare code is sent back to the login page as ?voucher=.
 *
 * Fixtures were generated with the Python `qrcode` package:
 *   voucher-code.png  → "1234567890"                      (code-only card)
 *   voucher-link.png  → "http://10.5.50.1/login.html?voucher=1234567890"  (link card)
 */

const DEFAULT = 'http://127.0.0.1:8790';
const FIXTURES = path.join(__dirname, 'fixtures');

test('the QR button opens the self-hosted scanner carrying a return URL', async ({ page }) => {
  await page.goto(`${DEFAULT}/login.html`);
  await page.locator('#qrScanButton').click();

  // the default Arabic client lands on /ar/qr.html, an English one on /qr.html
  await expect(page).toHaveURL(/qr\.html\?return=/);
  const returnParam = new URL(page.url()).searchParams.get('return');
  expect(returnParam).toContain('login.html');

  // the vendored decoder is actually reachable from the page (same-origin script)
  expect(await page.evaluate(() => typeof window.qrcode)).toBe('object');
  expect(await page.evaluate(() => typeof window.qrScanner)).toBe('object');
});

test('the dual-mode redirect rule handles both card systems', async ({ page }) => {
  await page.goto(`${DEFAULT}/qr.html?return=${encodeURIComponent(`${DEFAULT}/login.html`)}`);

  // A link card carries its own destination — go straight there.
  const linkTarget = await page.evaluate(
    () => window.qrScanner.buildTarget('http://10.5.50.1/login.html?voucher=1234567890')
  );
  expect(linkTarget).toBe('http://10.5.50.1/login.html?voucher=1234567890');

  // A bare code card comes back to the page that opened the scanner.
  const codeTarget = await page.evaluate(() => window.qrScanner.buildTarget('1234567890'));
  expect(codeTarget).toBe(`${DEFAULT}/login.html?voucher=1234567890`);
});

test('a photographed code card is decoded and handed back to the login page', async ({ page }) => {
  await page.goto(`${DEFAULT}/login.html`);
  await page.locator('#qrScanButton').click();
  await expect(page).toHaveURL(/qr\.html\?return=/);

  // The real decoder path: file → FileReader → jsqrcode → callback → redirect.
  await page.locator('#qr-file-input').setInputFiles(path.join(FIXTURES, 'voucher-code.png'));

  await expect(page).toHaveURL(/login\.html\?.*voucher=1234567890/);
  // The receiver side picked it up (the auto-login submits the form 500 ms later).
  await expect(page.locator('#voucher')).toHaveValue('1234567890');
});

test('a photographed link card is decoded to the URL it carries', async ({ page }) => {
  await page.goto(`${DEFAULT}/qr.html?return=${encodeURIComponent(`${DEFAULT}/login.html`)}`);

  // Feed the fixture through the same decode() entry point the file input uses
  // (decode accepts a data URL; the callback fires once the image is decoded).
  const dataUrl = 'data:image/png;base64,' + fs.readFileSync(path.join(FIXTURES, 'voucher-link.png')).toString('base64');
  const decoded = await page.evaluate((du) => new Promise((resolve) => {
    qrcode.callback = resolve;
    try {
      qrcode.decode(du);
    } catch (err) {
      resolve('decode threw: ' + err);
    }
  }), dataUrl);

  expect(decoded).toBe('http://10.5.50.1/login.html?voucher=1234567890');
});

// These two check what the router actually receives: the auto-login submits
// the form ~500 ms after load, so we intercept the POST rather than racing
// the field values before the page navigates away.
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
