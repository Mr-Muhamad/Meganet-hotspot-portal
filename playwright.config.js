const { defineConfig, devices } = require('@playwright/test');

/**
 * End-to-end tests for the Meganet hotspot portal.
 *
 * These run the built dist/ through scripts/preview.mjs, which substitutes
 * RouterOS variables with realistic demo data — so the tests exercise the
 * real browser behavior the unit tests can't reach: redirects, language
 * pinning, client-side RADIUS error translation, the connection-quality
 * probe, and so on.
 *
 *   npm run test:e2e
 *
 * Two preview servers come up automatically:
 *   8790 — default scenario (connected user, mid-session)
 *   8791 --scenario error (failed login, $(error) rendered)
 */

const ports = { default: 8790, error: 8791 };

const webServer = (port, extra = '') => ({
  command: `node scripts/preview.mjs --port ${port} --no-pin-lang ${extra}`,
  url: `http://127.0.0.1:${port}/login.html`,
  reuseExistingPort: true,
  timeout: 20_000
});

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // the two servers are shared state; keep it sequential
  reporter: 'list',
  use: {
    // Edge is preinstalled on Windows; avoids a chromium download.
    channel: 'msedge',
    headless: true,
    viewport: { width: 390, height: 844 }, // phone-sized, like real hotspot clients
    actionTimeout: 10_000,
    navigationTimeout: 10_000
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } }
  ],
  webServer: [
    webServer(ports.default),
    webServer(ports.error, '--scenario error')
  ]
});

module.exports.ports = ports;
