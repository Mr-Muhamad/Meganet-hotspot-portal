const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * End-to-end verification of the Admin Studio UI in a real browser:
 * profile loading, per-profile MikroTik settings persistence (without storing
 * passwords on disk), dry-run .rsc preview, and thermal voucher roll options.
 */

let tmpRoot;
let studioBaseUrl;
let studioServer;

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeAll(async () => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'meganet-studio-e2e-'));
  process.env.ADMIN_DATA_DIR = tmpRoot;
  process.env.BUILD_WORK_DIR = path.join(tmpRoot, 'work');

  const studio = require('../../admin/server.js');
  studioServer = studio;
  const port = await studio.startServer(0);
  studioBaseUrl = `http://127.0.0.1:${port}`;
});

test.afterAll(async () => {
  if (studioServer && studioServer.stopPreview) {
    studioServer.stopPreview();
  }
  if (studioServer && studioServer.server) {
    await new Promise((resolve) => studioServer.server.close(resolve));
  }
  if (tmpRoot && fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('Admin Studio persists per-profile MikroTik router settings across reload without saving passwords', async ({ page }) => {
  await page.goto(studioBaseUrl);
  await expect(page.locator('#profileList .profile-item')).toHaveCount(1);
  await expect(page.locator('#profileTitle')).not.toHaveText('اختر بريفايل');

  // Switch to QR Login Tester tab and confirm live SVG QR renders (print sheet removed)
  await page.getByRole('button', { name: 'مختبر QR الدخول' }).click();
  await expect(page.locator('#v-qr-svg svg')).toBeVisible();
  await expect(page.locator('#v-print-format')).toHaveCount(0);

  // Open simulator and verify zoom + expand controls
  await page.click('#simToggleBtn');
  await expect(page.locator('#simulatorPanel')).toHaveClass(/open/);
  await expect(page.locator('#simZoomLabel')).toHaveText('100%');
  await page.click('#simZoomIn');
  await expect(page.locator('#simZoomLabel')).toHaveText('110%');
  await page.click('#simZoomOut');
  await page.click('#simZoomOut');
  await expect(page.locator('#simZoomLabel')).toHaveText('90%');
  await page.click('#simExpandBtn');
  await expect(page.locator('#simulatorPanel')).toHaveClass(/expanded/);
  await page.click('#simToggleBtn');

  // Switch to MikroTik tab, edit non-secret router settings + secret password, and save
  await page.getByRole('button', { name: 'مايكروتك (.rsc والرفع)' }).click();
  await expect(page.locator('#mk-rsc-output')).not.toHaveValue('');

  await page.fill('#mk-dns', 'portal.studio.local');
  await page.fill('#mk-dhcp-server', 'dhcp-studio');
  await page.selectOption('#mk-capport-mode', 'http');
  await page.fill('#mk-extra-wg', 'pay.studio.local');

  await page.fill('#mk-host', '10.20.30.1');
  await page.selectOption('#mk-proto', 'https');
  await page.fill('#mk-port', '8443');
  await page.fill('#mk-user', 'studioadmin');
  await page.fill('#mk-pass', 'secret-never-persist');
  await page.fill('#mk-target-dir', 'flash/studio-hotspot');
  await page.check('#mk-create-backup');

  await page.click('#mk-save-btn');
  await expect(page.locator('#toast')).toContainText('تم حفظ إعدادات الراوتر');

  // Reload page completely and verify persisted router settings came back without password
  await page.reload();
  await page.getByRole('button', { name: 'مايكروتك (.rsc والرفع)' }).click();

  await expect(page.locator('#mk-dns')).toHaveValue('portal.studio.local');
  await expect(page.locator('#mk-dhcp-server')).toHaveValue('dhcp-studio');
  await expect(page.locator('#mk-capport-mode')).toHaveValue('http');
  await expect(page.locator('#mk-extra-wg')).toHaveValue('pay.studio.local');
  await expect(page.locator('#mk-host')).toHaveValue('10.20.30.1');
  await expect(page.locator('#mk-proto')).toHaveValue('https');
  await expect(page.locator('#mk-port')).toHaveValue('8443');
  await expect(page.locator('#mk-user')).toHaveValue('studioadmin');
  await expect(page.locator('#mk-target-dir')).toHaveValue('flash/studio-hotspot');
  await expect(page.locator('#mk-create-backup')).toBeChecked();
  await expect(page.locator('#mk-pass')).toHaveValue('');
  await expect(page.locator('#mk-rsc-output')).toHaveValue(/dst-host="pay\.studio\.local"/);

  const mkFile = path.join(tmpRoot, 'profiles', 'meganet-official', 'mikrotik.json');
  expect(fs.existsSync(mkFile)).toBe(true);
  const rawMk = fs.readFileSync(mkFile, 'utf8');
  expect(rawMk).not.toContain('secret-never-persist');
  expect(rawMk).not.toContain('"password"');
});
