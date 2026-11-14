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

  test('desktop viewport compacts header/card/footer vertical gaps and anchors support trigger near the portal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${DEFAULT}/ar/login.html`);

    const metrics = await page.evaluate(() => {
      const box = (sel) => document.querySelector(sel).getBoundingClientRect();
      const header = box('.header');
      const main = box('.main-content');
      const card = box('.card');
      const footer = box('.footer');
      const support = box('.support-trigger');
      return {
        headerBottom: header.bottom,
        mainTop: main.top,
        cardTop: card.top,
        cardBottom: card.bottom,
        cardLeft: card.left,
        footerTop: footer.top,
        supportRight: support.right
      };
    });

    // Header sits immediately above main content without a large empty void
    expect(metrics.cardTop - metrics.headerBottom).toBeLessThanOrEqual(80);
    // Footer sits tightly below the card instead of pushed to viewport bottom
    expect(metrics.footerTop - metrics.cardBottom).toBeLessThanOrEqual(40);
    // Floating support button stays anchored near the centered portal card (RTL end = left)
    expect(metrics.cardLeft - metrics.supportRight).toBeGreaterThanOrEqual(16);
    expect(metrics.cardLeft - metrics.supportRight).toBeLessThanOrEqual(120);

    // Mobile login page: footer also sits tightly below the card without empty flex void
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${DEFAULT}/ar/login.html`);
    const mobileGap = await page.evaluate(() => {
      const c = document.querySelector('.card').getBoundingClientRect();
      const f = document.querySelector('.footer').getBoundingClientRect();
      return f.top - c.bottom;
    });
    expect(mobileGap).toBeLessThanOrEqual(40);
  });

  test('mobile floating support trigger stays clickable with #voucher autofocus, opens/closes repeatedly, and does not overlap card on 768px status page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${DEFAULT}/ar/login.html`);

    const trigger = page.locator('.support-trigger');
    const modal = page.locator('#supportModal');

    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveCSS('pointer-events', 'auto');

    // First real tap/click even while #voucher is autofocused
    await trigger.click();
    await expect(modal).toHaveClass(/support-modal--open/);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Close via X button — focus returns to trigger, yet trigger stays visible & clickable
    await page.locator('#supportModal .support-modal__close').click();
    await expect(modal).not.toHaveClass(/support-modal--open/);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveCSS('pointer-events', 'auto');
    await expect(trigger).toHaveCSS('opacity', '1');

    // Second real click opens the modal again reliably
    await trigger.click();
    await expect(modal).toHaveClass(/support-modal--open/);
    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/support-modal--open/);

    // Tablet 768x1024 wide status page: floating trigger must clear the card
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${DEFAULT}/ar/status.html`);
    const tabletOverlap = await page.evaluate(() => {
      const btn = document.querySelector('.support-trigger').getBoundingClientRect();
      const card = document.querySelector('.card').getBoundingClientRect();
      return !(btn.right <= card.left || btn.left >= card.right || btn.bottom <= card.top || btn.top >= card.bottom);
    });
    expect(tabletOverlap).toBe(false);
  });

  test('renders primary EN vs optional _ar header, footer, and support agent labels by language', async ({ browser }) => {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config.json'), 'utf8'));
    const agent = cfg.support.agents[0];

    const enContext = await browser.newContext({ locale: 'en-US' });
    await enContext.addCookies([{ name: 'hotspot_lang', value: 'en', url: DEFAULT }]);
    const enPage = await enContext.newPage();
    await enPage.goto(`${DEFAULT}/login.html`);
    await expect(enPage).toHaveURL(/\/login\.html$/);
    await expect(enPage.locator('.header__name')).toHaveText(cfg.general.networkName);
    await expect(enPage.locator('.footer__text')).toContainText(cfg.general.poweredByText.trim());
    await expect(enPage.locator('.footer__link')).toHaveText(cfg.general.poweredByName);
    await expect(enPage.locator('.support-person-card__name').first()).toHaveText(agent.name);
    await expect(enPage.locator('.support-person-card__role').first()).toHaveText(agent.role);
    await enContext.close();

    const arContext = await browser.newContext({ locale: 'ar-EG' });
    await arContext.addCookies([{ name: 'hotspot_lang', value: 'ar', url: DEFAULT }]);
    const arPage = await arContext.newPage();
    await arPage.goto(`${DEFAULT}/ar/login.html`);
    await expect(arPage).toHaveURL(/\/ar\/login\.html$/);
    await expect(arPage.locator('.header__name')).toHaveText(cfg.general.networkName_ar || cfg.general.networkName);
    await expect(arPage.locator('.footer__text')).toContainText((cfg.general.poweredByText_ar || cfg.general.poweredByText).trim());
    await expect(arPage.locator('.footer__link')).toHaveText(cfg.general.poweredByName_ar || cfg.general.poweredByName);
    await expect(arPage.locator('.support-person-card__name').first()).toHaveText(agent.name_ar || agent.name);
    await expect(arPage.locator('.support-person-card__role').first()).toHaveText(agent.role_ar || agent.role);
    await arContext.close();
  });

  test('stat-card--pwa is compact on mobile and .pwa-banner__btn retains painted hover fill and readable text', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${DEFAULT}/ar/status.html`);

    await page.evaluate(() => {
      const banner = document.getElementById('pwaBanner');
      if (banner) banner.style.display = 'block';
    });

    const cardRect = await page.locator('.stat-card--pwa').boundingBox();
    expect(cardRect).not.toBeNull();
    expect(cardRect.height).toBeLessThanOrEqual(145);

    const btn = page.locator('.pwa-banner__btn');
    const normalStyles = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, bgImg: cs.backgroundImage, color: cs.color };
    });
    await btn.hover();
    await page.waitForTimeout(250);
    const hoverStyles = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, bgImg: cs.backgroundImage, color: cs.color };
    });

    expect(normalStyles.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(hoverStyles.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(hoverStyles.bgImg).toContain('linear-gradient');
    expect(hoverStyles.bg).not.toBe(hoverStyles.color);
  });

  test('status page cards stay compact, avoid orphan grid slots, keep mobile actions side-by-side, and use dir="auto" for uptime BIDI', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${DEFAULT}/ar/status.html`);

    const metrics = await page.evaluate(() => {
      const card = document.querySelector('.card').getBoundingClientRect();
      const grid = document.querySelector('.status-grid').getBoundingClientRect();
      const conn = document.getElementById('connectionStatusCard').getBoundingClientRect();
      const logoutBtn = document.getElementById('logout-btn').getBoundingClientRect();
      const refreshBtn = document.querySelector('.status-actions button.btn-primary').getBoundingClientRect();
      const uptimeBdi = document.querySelector('#uptime bdi');
      return {
        cardHeight: Math.round(card.height),
        gridWidth: Math.round(grid.width),
        connWidth: Math.round(conn.width),
        connHeight: Math.round(conn.height),
        logoutTop: Math.round(logoutBtn.top),
        refreshTop: Math.round(refreshBtn.top),
        uptimeDir: uptimeBdi ? uptimeBdi.getAttribute('dir') : null
      };
    });

    expect(metrics.cardHeight).toBeLessThanOrEqual(920);
    expect(Math.abs(metrics.connWidth - metrics.gridWidth)).toBeLessThanOrEqual(2);
    expect(metrics.connHeight).toBeLessThanOrEqual(60);
    expect(Math.abs(metrics.logoutTop - metrics.refreshTop)).toBeLessThanOrEqual(2);
    expect(metrics.uptimeDir).toBe('auto');
  });
});
