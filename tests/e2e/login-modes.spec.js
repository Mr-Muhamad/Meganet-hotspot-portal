const { test } = require('@playwright/test');

/**
 * Captures the CURRENTLY BUILT login page in both themes. The visible login
 * MODE (voucher / normal / both-tabs) is baked at build time from
 * config.json's `loginMode`, so the full mode set is produced by running this
 * spec once per build while config.json is swapped — the caller copies each
 * run's output to test-results/mode-<mode>-{dark,light}.png. See
 * scripts/compose-screenshots.py, which stitches them into the README hero.
 */

const DEFAULT = 'http://127.0.0.1:8790';

test('captures the served login page in both themes', async ({ page }) => {
  for (const theme of ['dark', 'light']) {
    await page.goto(`${DEFAULT}/ar/login.html`);
    await page.evaluate((t) => {
      document.cookie = 'hotspot_theme=' + t + '; path=/; max-age=31536000; SameSite=Lax';
    }, theme);
    await page.goto(`${DEFAULT}/ar/login.html`); // reload so pre-paint applies it
    await page.waitForTimeout(250); // canvas/background settle
    await page.screenshot({ path: `test-results/loginmode-${theme}.png` });
  }
});
