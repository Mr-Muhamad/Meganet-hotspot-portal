const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * The minimum-click voucher scanner: one tap on the scan button opens the
 * phone's NATIVE camera app (capture=environment file input), the photo is
 * decoded by the vendored jsQR, and a bare code auto-logs-in in place.
 * Inside the stripped captive-portal WebView the same tap jumps to the full
 * browser (intent://) — Android shows its own confirmation screen there.
 *
 * Fixtures were generated with the Python `qrcode` package:
 *   voucher-code.png  → "1234567890"                      (code-only card)
 *   voucher-link.png  → "http://10.5.50.1/login.html?voucher=1234567890"  (link card)
 */

const DEFAULT = 'http://127.0.0.1:8790';
const FIXTURES = path.join(__dirname, 'fixtures');

test('one tap on the scan button opens the native camera picker and auto-logs-in', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);

  // tap #1 (and the only one): the button fires the hidden file input —
  // on a phone this is the rear camera app, no permission prompt.
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#qrScanButton').click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path.join(FIXTURES, 'voucher-code.png'));

  // photo → decode → cancellable 3s countdown → the POST the router receives
  const request = await page.waitForRequest((req) => req.method() === 'POST');
  const body = request.postData();
  expect(body).toContain('username=1234567890');
  expect(body).toContain('password=1234567890');
  // the user never left the login page
  expect(page.url()).toContain('/ar/login.html');
});

test('a small QR inside a simulated camera photo still decodes (jsQR upgrade)', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);

  // Regression for the real-world failure: photographing a WHOLE card leaves
  // the QR occupying a fraction of a compressed JPEG frame, and the previous
  // llqrcode engine failed that 5/5 on a real card while jsQR read every
  // framing. Here the code fixture is drawn at 45% of a gray 1400x1050
  // "photo" and re-compressed as JPEG, then fed through the REAL pipeline
  // (input.files → change → decode → auto-login).
  const fixtureB64 = fs.readFileSync(path.join(FIXTURES, 'voucher-code.png')).toString('base64');
  const photoB64 = await page.evaluate(async (b64) => {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = 'data:image/png;base64,' + b64;
    });
    const photo = document.createElement('canvas');
    photo.width = 1400;
    photo.height = 1050;
    const px = photo.getContext('2d');
    px.fillStyle = '#d8d8d8';
    px.fillRect(0, 0, photo.width, photo.height);
    const w = Math.round(photo.width * 0.45);
    const h = Math.round(img.height * w / img.width);
    px.drawImage(img, Math.round((photo.width - w) / 2), Math.round((photo.height - h) / 2), w, h);
    return photo.toDataURL('image/jpeg', 0.7);
  }, fixtureB64);

  await page.evaluate((b64) => {
    const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const file = new File([buf], 'camera-photo.jpg', { type: 'image/jpeg' });
    const input = document.getElementById('qr-file-input');
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, photoB64.split(',')[1]);

  const request = await page.waitForRequest((req) => req.method() === 'POST');
  expect(request.postData()).toContain('username=1234567890');
});

test('a scanned mikhmon credential link logs in IN PLACE even on a foreign host', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  // The card's printed $dnsname may be stale or differ from how the user
  // reached the portal, and a swapped QR must never navigate off-portal:
  // the credentials are extracted and submitted to OUR login endpoint.
  const request = await Promise.all([
    page.waitForRequest((req) => req.method() === 'POST'),
    page.evaluate(() => window.Hotspot.qrScanner._handleResult(
      'http://printed-dnsname.example.net/login?username=ahmed2015&password=secret99'
    ))
  ]).then(([req]) => req);

  expect(request.url()).toContain('10.5.50.1'); // OUR portal login endpoint
  expect(request.postData()).toContain('username=ahmed2015');
  expect(request.postData()).toContain('password=secret99');
  // the user never left the login page
  expect(page.url()).toContain('/ar/login.html');
});

test('a link-card QR payload with a voucher param auto-logs-in in place', async ({ page }) => {
  await page.goto(`${DEFAULT}/ar/login.html`);
  // The destination page auto-POSTs its voucher to the (demo) router endpoint
  // ~500ms after load — intercept that POST: its URL and body prove the whole
  // link-card round trip (navigate → auto-fill → submit).
  const request = await Promise.all([
    page.waitForRequest((req) => req.method() === 'POST'),
    page.evaluate(() => window.Hotspot.qrScanner._handleResult('http://127.0.0.1:8790/login.html?voucher=55555'))
  ]).then(([req]) => req);

  expect(request.url()).toContain('10.5.50.1'); // the demo router login endpoint
  expect(request.postData()).toContain('username=55555');
});

test('inside the stripped captive-portal WebView the scan tap escapes to the full browser', async ({ browser }) => {
  // The system "Sign in to network" WebView swallows file inputs (no
  // onShowFileChooser) — the scan tap must fire the intent:// escape
  // immediately (verified on-device: Android then shows its own
  // "CONTINUE ANYWAY VIA BROWSER" confirmation and Chrome opens).
  const captivePortalUA =
    'Mozilla/5.0 (Linux; Android 11; M2101K6G) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36';
  const context = await browser.newContext({ userAgent: captivePortalUA });
  const page = await context.newPage();
  try {
    await page.goto(`${DEFAULT}/ar/login.html`);
    await page.evaluate(() => {
      window.__escapeTarget = null;
      window.Hotspot.qrScanner.escapeNow = (target) => { window.__escapeTarget = target; };
    });

    let chooserOpened = false;
    page.on('filechooser', () => { chooserOpened = true; });
    await page.locator('#qrScanButton').click();
    await page.waitForTimeout(400);

    const target = await page.evaluate(() => window.__escapeTarget);
    expect(target).toMatch(/^intent:\/\//);
    expect(target).toContain('qrscan=1');
    expect(target).toContain('S.browser_fallback_url=');
    // the camera path must NOT have been attempted — it is dead in there
    expect(chooserOpened).toBe(false);
  } finally {
    await context.close();
  }
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
