const { test, expect } = require('@playwright/test');
const axeCore = require('axe-core');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT = 'http://127.0.0.1:8790';

const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 780 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 }
];

const PORTAL_PAGES = ['login', 'status', 'plans', 'logout', 'error', 'expired', 'alogin'];

test.describe('axe-core Accessibility Audit across Themes, Languages & Viewports', () => {
  for (const theme of ['light', 'dark']) {
    for (const lang of ['en', 'ar']) {
      for (const vp of VIEWPORTS) {
        test(`zero serious/critical axe-core violations (${theme}, ${lang}, ${vp.name})`, async ({ browser }) => {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            locale: lang === 'ar' ? 'ar-EG' : 'en-US'
          });
          await context.addCookies([
            { name: 'hotspot_theme', value: theme, url: DEFAULT },
            { name: 'hotspot_lang', value: lang, url: DEFAULT }
          ]);
          const page = await context.newPage();

          try {
            const prefix = lang === 'ar' ? '/ar/' : '/';
            for (const pageName of PORTAL_PAGES) {
              await page.goto(`${DEFAULT}${prefix}${pageName}.html`, { waitUntil: 'domcontentloaded' });
              await page.waitForSelector('main#main');
              await page.evaluate(() => Promise.all(
                document.getAnimations()
                  .filter((a) => a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().iterations !== Infinity)
                  .map((a) => {
                    try { a.finish(); } catch { /* ignore */ }
                    return a.finished.catch(() => {});
                  })
              ));
              await page.evaluate(axeCore.source);
              const results = await page.evaluate(async () => {
                return window.axe.run(document, {
                  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
                });
              });

              const severe = results.violations.filter(
                v => v.impact === 'critical' || v.impact === 'serious'
              );
              expect(severe, `${pageName} (${theme}/${lang}/${vp.name}): ${JSON.stringify(severe.map(v => ({ id: v.id, nodes: v.nodes.length })), null, 2)}`).toEqual([]);
            }
          } finally {
            await context.close();
          }
        });
      }
    }
  }
});

test.describe('RTL Geometry, Journey Flows & Studio UX Verification', () => {
  test('RTL status page keeps .pwa-banner__close separate from .pwa-banner__text and preserves natural row direction', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(`${DEFAULT}/ar/status.html`);

    const metrics = await page.evaluate(() => {
      const banner = document.getElementById('pwaBanner');
      if (banner) banner.style.display = 'block';
      const closeBtn = document.querySelector('.pwa-banner__close');
      const textBox = document.querySelector('.pwa-banner__text');
      const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;
      const textRect = textBox ? textBox.getBoundingClientRect() : null;
      const headerStyle = getComputedStyle(document.querySelector('.support-modal__header'));
      return {
        closeRect,
        textRect,
        modalHeaderDir: headerStyle.flexDirection
      };
    });

    expect(metrics.modalHeaderDir).toBe('row');
    if (metrics.closeRect && metrics.textRect) {
      // In RTL, close button is on the inline-end (left side), text starts on the right
      expect(metrics.closeRect.right).toBeLessThanOrEqual(metrics.textRect.left + 2);
    }
  });

  test('plans.html plan selection reveals summary banner and prefills WhatsApp ?text= link', async ({ page }) => {
    await page.goto(`${DEFAULT}/ar/plans.html`);
    const firstSelectBtn = page.locator('.plan-card__select-btn').first();
    await firstSelectBtn.click();

    await expect(page.locator('#selected-plan-summary')).toBeVisible();
    await expect(firstSelectBtn).toHaveAttribute('aria-pressed', 'true');
    const waHref = await page.locator('.support-whatsapp-btn').first().getAttribute('href');
    expect(waHref).toContain('text=');
  });

  test('logout.html cancel button stops 20s auto-redirect', async ({ page }) => {
    await page.goto(`${DEFAULT}/ar/logout.html`);
    await page.locator('#cancel-redirect-btn').click();
    await expect(page.locator('#redirect-cancelled-msg')).toBeVisible();
    await expect(page.locator('#cancel-redirect-btn')).toBeHidden();
  });

  test('Admin Studio preserves unsaved drafts during asset upload/delete and uses non-blocking modal instead of prompt/confirm', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const prevAdminDir = process.env.ADMIN_DATA_DIR;
    const prevWorkDir = process.env.BUILD_WORK_DIR;
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'meganet-studio-rem-'));
    const serverModPath = require.resolve('../../admin/server.js');
    delete require.cache[serverModPath];
    process.env.ADMIN_DATA_DIR = tmpRoot;
    process.env.BUILD_WORK_DIR = path.join(tmpRoot, 'work');
    const studio = require(serverModPath);
    const port = await studio.startServer(0);
    const studioUrl = `http://127.0.0.1:${port}`;

    try {
      await page.goto(studioUrl);
      await expect(page.locator('#profileList .profile-item')).toHaveCount(1);

      // Fail immediately if native alert/confirm/prompt dialog is ever opened
      let nativeDialogOpened = false;
      page.on('dialog', async (d) => {
        nativeDialogOpened = true;
        await d.dismiss();
      });

      // Edit General tab without saving (marks dirty)
      await page.locator('#g-network').fill('UnsavedDraftNet');
      await expect(page.locator('#dirtyBadge')).toHaveClass(/show/);

      // Switch to Features tab and verify voucherFormat selector exists
      await page.locator('.tab', { hasText: 'المميزات' }).click();
      await expect(page.locator('#f-vfmt')).toBeVisible();
      await page.locator('#f-vfmt').selectOption('alphanumeric');

      // Switch to Assets tab, upload a small SVG, verify drafts & dirtyBadge remain intact
      await page.locator('.tab', { hasText: 'الملفات والشعارات' }).click();
      await page.setInputFiles('#asset-file', {
        name: 'extra-badge.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>')
      });
      await page.locator('button[onclick="uploadAsset(event)"]').click();
      await expect(page.locator('#assets-list')).toContainText('extra-badge.svg');
      await expect(page.locator('#dirtyBadge')).toHaveClass(/show/);

      // Switch back to General tab and verify unsaved draft text was NOT wiped!
      await page.locator('.tab', { hasText: 'عام' }).click();
      await expect(page.locator('#g-network')).toHaveValue('UnsavedDraftNet');

      // Test non-blocking Studio modal on "+ بريفايل جديد"
      await page.locator('button[onclick="createProfile()"]').click();
      await expect(page.locator('#studioModal')).toHaveClass(/open/);
      await page.locator('#studioModalCancel').click();
      await expect(page.locator('#studioModal')).not.toHaveClass(/open/);
      expect(nativeDialogOpened).toBe(false);
    } finally {
      if (studio.stopPreview) studio.stopPreview();
      if (studio.server) await new Promise((r) => studio.server.close(r));
      delete require.cache[serverModPath];
      if (prevAdminDir === undefined) delete process.env.ADMIN_DATA_DIR;
      else process.env.ADMIN_DATA_DIR = prevAdminDir;
      if (prevWorkDir === undefined) delete process.env.BUILD_WORK_DIR;
      else process.env.BUILD_WORK_DIR = prevWorkDir;
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test('support modal grid auto-balances cleanly for 1, 2, and 3 support agents', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${DEFAULT}/ar/login.html`);

    await page.evaluate(() => window.toggleSupportModal());
    await expect(page.locator('#supportModal')).toHaveClass(/support-modal--open/);

    const measure = () => page.evaluate(() => {
      const grid = document.querySelector('.support-grid-cards');
      const gridRect = grid.getBoundingClientRect();
      const cards = Array.from(grid.querySelectorAll('.support-person-card'));
      return {
        gridWidth: gridRect.width,
        cards: cards.map((card) => {
          const rect = card.getBoundingClientRect();
          const btns = Array.from(card.querySelectorAll('.support-action-btn')).map((b) => {
            const br = b.getBoundingClientRect();
            return { top: br.top, left: br.left, right: br.right, width: br.width, height: br.height };
          });
          return { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, btns };
        })
      };
    });

    // Case 1: 1 agent spans full grid width and lays out action buttons side-by-side
    const one = await measure();
    expect(one.cards.length).toBe(1);
    expect(Math.abs(one.cards[0].width - one.gridWidth)).toBeLessThanOrEqual(2);
    if (one.cards[0].btns.length >= 2) {
      expect(Math.abs(one.cards[0].btns[0].top - one.cards[0].btns[1].top)).toBeLessThanOrEqual(4);
    }

    // Case 2: 2 agents share row 1 side-by-side at equal width
    await page.evaluate(() => {
      const grid = document.querySelector('.support-grid-cards');
      const tpl = grid.querySelector('.support-person-card');
      grid.appendChild(tpl.cloneNode(true));
    });
    const two = await measure();
    expect(two.cards.length).toBe(2);
    expect(Math.abs(two.cards[0].top - two.cards[1].top)).toBeLessThanOrEqual(4);
    expect(Math.abs(two.cards[0].width - two.cards[1].width)).toBeLessThanOrEqual(4);
    expect(two.cards[0].width).toBeLessThan(two.gridWidth * 0.6);

    // Case 3: 3 agents keep first 2 paired and span the 3rd across full grid width
    await page.evaluate(() => {
      const grid = document.querySelector('.support-grid-cards');
      const tpl = grid.querySelector('.support-person-card');
      grid.appendChild(tpl.cloneNode(true));
    });
    const three = await measure();
    expect(three.cards.length).toBe(3);
    expect(Math.abs(three.cards[0].top - three.cards[1].top)).toBeLessThanOrEqual(4);
    expect(three.cards[2].top).toBeGreaterThan(three.cards[0].bottom - 1);
    expect(Math.abs(three.cards[2].width - three.gridWidth)).toBeLessThanOrEqual(2);
  });
});
