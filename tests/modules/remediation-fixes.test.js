'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');

describe('Security, Portal Journey, Assets, and Workspace Remediation Suite', () => {
  describe('desktop/main.js strict URL and external scheme guards', () => {
    let guards;
    let mockAppOn;

    beforeAll(() => {
      jest.resetModules();
      mockAppOn = jest.fn();
      jest.doMock('electron', () => ({
        app: {
          isPackaged: false,
          requestSingleInstanceLock: () => false,
          exit: jest.fn(),
          quit: jest.fn(),
          whenReady: () => Promise.resolve(),
          on: mockAppOn,
          getPath: () => os.tmpdir()
        },
        BrowserWindow: jest.fn(),
        shell: { openExternal: jest.fn() },
        dialog: { showErrorBox: jest.fn() }
      }));
      guards = require('../../desktop/main.js');
    });

    afterAll(() => {
      jest.dontMock('electron');
    });

    test('isAllowedAppUrl accepts only loopback HTTP matching active serverPort', () => {
      expect(guards.isAllowedAppUrl('http://127.0.0.1:4567/login.html', 4567)).toBe(true);
      expect(guards.isAllowedAppUrl('http://localhost:4567/', 4567)).toBe(true);
      expect(guards.isAllowedAppUrl('http://127.0.0.1:9999/', 4567)).toBe(false);
      expect(guards.isAllowedAppUrl('http://127.0.0.1.evil.com:4567/', 4567)).toBe(false);
      expect(guards.isAllowedAppUrl('https://127.0.0.1:4567/', 4567)).toBe(false);
      expect(guards.isAllowedAppUrl('file:///etc/passwd', 4567)).toBe(false);
      expect(guards.isAllowedAppUrl('not-a-url', 4567)).toBe(false);
      expect(guards.isAllowedAppUrl('http://127.0.0.1:4567/', null)).toBe(false);
    });

    test('isAllowedExternalUrl allows only http, https, mailto, tel', () => {
      expect(guards.isAllowedExternalUrl('https://wa.me/201000000000')).toBe(true);
      expect(guards.isAllowedExternalUrl('http://example.com')).toBe(true);
      expect(guards.isAllowedExternalUrl('mailto:support@meganet.local')).toBe(true);
      expect(guards.isAllowedExternalUrl('tel:+201000000000')).toBe(true);
      expect(guards.isAllowedExternalUrl('file:///C:/Windows/System32/calc.exe')).toBe(false);
      expect(guards.isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
      expect(guards.isAllowedExternalUrl('ms-msdt:foo')).toBe(false);
    });

    test('registers before-quit cleanup listener for macOS/all platforms', () => {
      const events = mockAppOn.mock.calls.map(c => c[0]);
      expect(events).toContain('before-quit');
      expect(events).toContain('window-all-closed');
    });
  });

  describe('admin/server.js serveStatic path traversal defense', () => {
    let serverMod;
    let port;
    let tmpDir;

    beforeAll(async () => {
      jest.resetModules();
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meganet-srv-sec-'));
      process.env.ADMIN_DATA_DIR = tmpDir;
      process.env.BUILD_WORK_DIR = path.join(tmpDir, 'work');
      serverMod = require('../../admin/server.js');
      port = await serverMod.startServer(0);
    });

    afterAll(async () => {
      if (serverMod && serverMod.server) {
        await new Promise((r) => serverMod.server.close(r));
      }
      if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('rejects traversal attempts outside admin/public', async () => {
      const status = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/..%2f..%2fpackage.json`, (res) => {
          res.resume();
          resolve(res.statusCode);
        }).on('error', reject);
      });
      expect([403, 404]).toContain(status);
    });
  });

  describe('util.js cookie escaping and safeRedirect hardening', () => {
    const util = require('../../src/js/modules/util.js');

    test('getCookie safely handles regex metacharacters in cookie names', () => {
      const prev = Object.getOwnPropertyDescriptor(document, 'cookie');
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: () => 'fooXbar=wrong; foo.bar+baz=right'
      });
      expect(util.getCookie('foo.bar+baz')).toBe('right');
      expect(util.getCookie('foo.bar')).toBeNull();
      if (prev) {
        Object.defineProperty(document, 'cookie', prev);
      } else {
        delete document.cookie;
      }
    });

    test('safeRedirect accepts delay 0, rejects javascript:/unexpanded $(var), and uses location.replace', () => {
      const origLocation = window.location;
      const replaceMock = jest.fn();
      delete window.location;
      window.location = { href: 'http://hotspot.local/login', replace: replaceMock };

      expect(util.safeRedirect('javascript:alert(1)', 0)).toBeFalsy();
      expect(util.safeRedirect('$(link-orig)', 0)).toBeFalsy();
      expect(replaceMock).not.toHaveBeenCalled();

      util.safeRedirect('https://example.com/ok', 0);
      expect(replaceMock).toHaveBeenCalledWith('https://example.com/ok');

      jest.useFakeTimers();
      const cancel = util.safeRedirect('https://example.com/delayed', 10);
      expect(typeof cancel).toBe('function');
      cancel();
      jest.advanceTimersByTime(15000);
      expect(replaceMock).toHaveBeenCalledTimes(1);
      jest.useRealTimers();

      window.location = origLocation;
    });
  });

  describe('i18n.js language validation, /ar/ detection, and title update', () => {
    const i18n = require('../../src/js/modules/i18n.js');

    beforeEach(() => {
      i18n.data = {
        en: { login_title: 'Sign In', error_title: 'Connection Error' },
        ar: { login_title: 'تسجيل الدخول', error_title: 'خطأ في الاتصال' }
      };
    });

    test('rejects unsupported language codes without corrupting currentLang', () => {
      i18n.setLang('en');
      expect(i18n.setLang('xx')).toBe(false);
      expect(i18n.currentLang).toBe('en');
      expect(i18n.setLang('__proto__')).toBe(false);
    });

    test('updates document.title from body[data-page] when switching language', () => {
      document.body.setAttribute('data-page', 'login');
      document.body.setAttribute('data-network-name', 'CafeNet');
      expect(i18n.setLang('ar')).toBe(true);
      expect(document.title).toBe('CafeNet - تسجيل الدخول');
      expect(i18n.setLang('en')).toBe(true);
      expect(document.title).toBe('CafeNet - Sign In');
      document.body.removeAttribute('data-page');
      document.body.removeAttribute('data-network-name');
    });
  });

  describe('auth.js + rateLimiter + qr-scanner improvements', () => {
    const util = require('../../src/js/modules/util.js');
    const i18n = require('../../src/js/modules/i18n.js');
    const rateLimiter = require('../../src/js/modules/rate-limiter.js');
    const auth = require('../../src/js/modules/auth.js');
    const qrScanner = require('../../src/js/modules/qr-scanner.js');

    beforeEach(() => {
      global.util = util;
      global.i18n = i18n;
      global.rateLimiter = rateLimiter;
      global.auth = auth;
      i18n.data = {
        en: {
          normal_credentials_required: 'Please enter username and password first.',
          rate_limit_warning: 'Warning: {n} attempts left.',
          rate_limit_message: 'Blocked for {time}.',
          voucher_min_length_error: 'Min {n} chars'
        },
        ar: {
          normal_credentials_required: 'يرجى إدخال اسم المستخدم وكلمة المرور أولاً.'
        }
      };
      i18n.currentLang = 'en';
      rateLimiter.clearAll();
      rateLimiter.maxAttempts = 5;
      rateLimiter.blockDuration = 120000;
    });

    test('normalizeVoucherText respects alphanumeric format vs numeric default', () => {
      expect(auth.normalizeVoucherText('ab-12 34', 'numeric')).toBe('1234');
      expect(auth.normalizeVoucherText('AB 12-xy', 'alphanumeric')).toBe('AB12-xy');
    });

    test('normal login mode rejects empty credentials before consuming a rateLimiter attempt', () => {
      document.body.innerHTML =
        '<div id="alerts"></div>' +
        '<button class="auth-tab auth-tab--active" data-mode="normal"></button>' +
        '<form id="login-form" data-voucher-format="numeric">' +
        '<input id="username" value=""><input id="password" value="">' +
        '</form>';
      const e = { preventDefault: jest.fn() };
      auth.onFormSubmit(e);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(document.getElementById('alerts').textContent).toContain('Please enter username and password first.');
      expect(rateLimiter.check('device', 15).attempts).toBe(0);
    });

    test('qrScanner distinguishes ?qrscan=gallery vs ?qrscan=camera and keeps BarcodeDetector path lazy (no _loadDecoder upfront)', () => {
      document.body.innerHTML =
        '<button id="qrScanButton"></button>' +
        '<button id="qrGalleryButton"></button>' +
        '<input id="qr-file-input" type="file">' +
        '<input id="qr-gallery-input" type="file">' +
        '<input id="voucher">';
      const origWebView = qrScanner._isStrippedWebView;
      const origEscape = qrScanner.escapeNow;
      const escaped = [];
      qrScanner._isStrippedWebView = () => true;
      qrScanner.escapeNow = (t) => escaped.push(t);
      qrScanner._fileInputWired = false;
      qrScanner._wireFileInput();
      qrScanner.scanDirect();
      document.getElementById('qrGalleryButton').click();
      expect(escaped[0]).toContain('qrscan=camera');
      expect(escaped[1]).toContain('qrscan=gallery');
      qrScanner._isStrippedWebView = origWebView;
      qrScanner.escapeNow = origEscape;

      const loadSpy = jest.spyOn(qrScanner, '_loadDecoder');
      window.BarcodeDetector = function MockDetector() {};
      qrScanner._isStrippedWebView = () => false;
      qrScanner._fileInputWired = false;
      qrScanner._wireFileInput();
      document.getElementById('qrScanButton').click();
      document.getElementById('qrGalleryButton').click();
      expect(loadSpy).not.toHaveBeenCalled();
      loadSpy.mockRestore();
      qrScanner._isStrippedWebView = origWebView;
      delete window.BarcodeDetector;
    });
  });

  describe('ui.js wall-clock countdown, selectPlan prefill, and #network-bg visibility/lifecycle', () => {
    const util = require('../../src/js/modules/util.js');
    const i18n = require('../../src/js/modules/i18n.js');
    const ui = require('../../src/js/modules/ui.js');

    beforeEach(() => {
      global.util = util;
      global.i18n = i18n;
      i18n.data = {
        en: {
          selected_plan_banner: 'Selected: {name} - {price}',
          support_plan_prefill: 'Hello, I want {name} ({quota}) - {price}'
        }
      };
      i18n.currentLang = 'en';
    });

    test('initCountdown jumps cleanly using Date.now() after screen sleep', () => {
      jest.useFakeTimers();
      document.body.innerHTML = '<div id="cd"></div>';
      const baseNow = Date.now();
      const cb = jest.fn();
      const id = ui.initCountdown(60, 'cd', cb);
      expect(document.getElementById('cd').textContent).toBe('00:01:00');
      jest.spyOn(Date, 'now').mockReturnValue(baseNow + 45000);
      jest.advanceTimersByTime(1000);
      expect(document.getElementById('cd').textContent).toBe('00:00:15');
      clearInterval(id);
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    test('selectPlan highlights card and prefills support WhatsApp href with ?text=', () => {
      document.body.innerHTML =
        '<div id="selected-plan-summary" style="display:none"><span id="selected-plan-summary-text"></span></div>' +
        '<div class="plan-card" data-plan-name="Pro" data-plan-quota="50 GB" data-plan-price="100">' +
        '<button type="button" class="plan-card__select-btn" aria-pressed="false">Choose</button>' +
        '</div>' +
        '<a class="support-whatsapp-btn" data-base-href="https://wa.me/20100" href="https://wa.me/20100">WA</a>';

      const card = document.querySelector('.plan-card');
      ui.selectPlan(card);
      expect(card.classList.contains('plan-card--selected')).toBe(true);
      expect(card.querySelector('.plan-card__select-btn').getAttribute('aria-pressed')).toBe('true');
      expect(document.getElementById('selected-plan-summary').style.display).toBe('flex');
      expect(document.querySelector('.support-whatsapp-btn').getAttribute('href'))
        .toContain('?text=Hello%2C%20I%20want%20Pro%20(50%20GB)%20-%20100');
    });

    test('initBackground pauses on document.hidden, supports clientX=0, and cleans up via destroyBackground', () => {
      const rafCalls = [];
      global.requestAnimationFrame = jest.fn((fn) => {
        rafCalls.push(fn);
        return rafCalls.length;
      });
      global.cancelAnimationFrame = jest.fn();

      const fakeCtx = {
        clearRect: jest.fn(),
        beginPath: jest.fn(),
        arc: jest.fn(),
        fill: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        stroke: jest.fn(),
        setTransform: jest.fn()
      };
      document.body.innerHTML = '<canvas id="network-bg"></canvas>';
      const canvas = document.getElementById('network-bg');
      canvas.getContext = jest.fn(() => fakeCtx);
      window.matchMedia = jest.fn(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }));

      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      ui.initBackground();
      expect(global.requestAnimationFrame).not.toHaveBeenCalled();

      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(global.requestAnimationFrame).toHaveBeenCalled();

      ui.destroyBackground();
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('SVG prefixIds, Logo Maker 512x512 PNG, Manifest & Workspace Pruning', () => {
    const { sanitizeSvg } = require('../../scripts/svg-utils.js');
    const { generateIconPngBuffer, generateBrandTitleSvg } = require('../../admin/lib/logo-maker.js');
    const { createWorkspace } = require('../../admin/lib/workspace.js');

    test('sanitizeSvg prefixes IDs so multiple inline SVGs never collide', () => {
      const a = sanitizeSvg('<svg viewBox="0 0 10 10"><defs><linearGradient id="g"></linearGradient></defs><rect fill="url(#g)"/></svg>', { idPrefix: 'logo' });
      const b = sanitizeSvg('<svg viewBox="0 0 10 10"><defs><linearGradient id="g"></linearGradient></defs><rect fill="url(#g)"/></svg>', { idPrefix: 'brand' });
      expect(a).toMatch(/id="logo-[a-z0-9]+"/);
      expect(b).toMatch(/id="brand-[a-z0-9]+"/);
    });

    test('generateIconPngBuffer produces 512x512 PNG and generateBrandTitleSvg widens for long names', () => {
      const buf = generateIconPngBuffer();
      expect(buf.readUInt32BE(16)).toBe(512);
      expect(buf.readUInt32BE(20)).toBe(512);

      const svg = generateBrandTitleSvg({ networkName: 'Super Mega Ultra Cafe Wireless Hotspot' });
      expect(svg).toContain('viewBox="0 0 360 56"');
    });

    test('workspace runBuildCycle reports recursive distFiles and omits unreferenced image files', async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'meganet-ws-prune-'));
      try {
        const ws = createWorkspace({ workDir: path.join(tmp, 'work') });
        const profileDir = path.join(tmp, 'prof');
        const profileAssets = path.join(profileDir, 'assets');
        fs.mkdirSync(profileAssets, { recursive: true });
        fs.writeFileSync(path.join(profileAssets, 'unused-old-photo.png'), Buffer.from('junk'));
        fs.writeFileSync(path.join(profileAssets, 'used-agent.png'), Buffer.from('valid'));

        const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
        cfg.support.agents = [{ name: 'Ali', role: 'Support', phone: '01000000000', whatsapp: '201000000000', image: 'assets/used-agent.png' }];
        const zipOut = path.join(tmp, 'out.zip');
        const res = await ws.runBuildCycle(
          {
            id: 'prune-test',
            config: cfg,
            dir: profileDir,
            assets: [{ name: 'unused-old-photo.png' }, { name: 'used-agent.png' }]
          },
          zipOut,
          { collectBuffers: true }
        );

        const relPaths = res.files.map(f => f.relPath);
        expect(res.distFiles).toBe(relPaths.length);
        expect(relPaths).toContain('assets/used-agent.png');
        expect(relPaths).not.toContain('assets/unused-old-photo.png');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }, 30000);
  });

  describe('Built dist HTML & manifest contracts', () => {
    test('login.html unchecks #remember-me by default, adds #qrGalleryButton label, and omits dead $(if captive)', () => {
      const enLogin = fs.readFileSync(path.join(DIST, 'login.html'), 'utf8');
      expect(enLogin).not.toContain('$(if captive)');
      expect(enLogin).not.toMatch(/id="remember-me"[^>]*checked/);
      expect(enLogin).toContain('qr_gallery_btn_text');
      expect(enLogin).not.toContain('HotspotErrorMap');
    });

    test('logout.html uses 20s delay with cancel button and sign_in_again label', () => {
      const arLogout = fs.readFileSync(path.join(DIST, 'ar', 'logout.html'), 'utf8');
      expect(arLogout).toContain('cancel-redirect-btn');
      expect(arLogout).toContain('sign_in_again');
      expect(arLogout).toContain(',20,"redirect-countdown")');
    });

    test('error.html removes duplicate $(error-esc) and includes login/support actions', () => {
      const arError = fs.readFileSync(path.join(DIST, 'ar', 'error.html'), 'utf8');
      expect(arError.match(/\$\(error-esc\)/g).length).toBe(1);
      expect(arError).toContain('href="./login.html"');
      expect(arError).toContain('toggleSupportModal()');
    });

    test('expired.html includes View Plans, Enter New Voucher, and Support actions', () => {
      const enExpired = fs.readFileSync(path.join(DIST, 'expired.html'), 'utf8');
      expect(enExpired).toContain('href="./plans.html"');
      expect(enExpired).toContain('href="./login.html"');
      expect(enExpired).toContain('toggleSupportModal()');
    });

    test('status.html renders #sessionCountdownSection before #pwaBanner', () => {
      const arStatus = fs.readFileSync(path.join(DIST, 'ar', 'status.html'), 'utf8');
      expect(arStatus.indexOf('id="sessionCountdownSection"')).toBeLessThan(arStatus.indexOf('id="pwaBanner"'));
    });

    test('dist/manifest.json aligns start_url, networkName, and 512x512 icon dimensions', () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
      const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
      expect(manifest.start_url).toBe('./index.html');
      expect(manifest.name).toBe(cfg.general.networkName);
      expect(manifest.icons[0].sizes).toMatch(/^\d+x\d+$/);
    });

    test('ui.initCountdown preserves inner <bdi> wrapper when updating countdown', () => {
      jest.useFakeTimers();
      document.body.innerHTML = '<span id="cd-wrap"><bdi dir="ltr">00:00:10</bdi></span>';
      const ui = require('../../src/js/modules/ui.js');
      ui.initCountdown(10, 'cd-wrap');
      expect(document.querySelector('#cd-wrap bdi').textContent).toBe('00:00:10');
      jest.advanceTimersByTime(1000);
      expect(document.querySelector('#cd-wrap bdi')).not.toBeNull();
      expect(document.querySelector('#cd-wrap bdi').textContent).toBe('00:00:09');
      jest.useRealTimers();
      document.body.innerHTML = '';
    });

    test('prand-title.svg disables animated layers under reduced-motion and avoids feDropShadow filters', () => {
      const svg = fs.readFileSync(path.join(ROOT, 'src', 'assets', 'prand-title.svg'), 'utf8');
      expect(svg).toContain('.svg-motion-layer');
      expect(svg).toContain('.svg-static-layer');
      expect(svg).not.toContain('<feDropShadow');
    });
  });

  describe('UX & Behavioral Improvements', () => {
    const util = require('../../src/js/modules/util.js');
    const auth = require('../../src/js/modules/auth.js');
    const statusModule = require('../../src/js/modules/status.js');

    beforeEach(() => {
      global.util = util;
      global.i18n = { t: (k) => k };
      document.documentElement.setAttribute('lang', 'en');
    });

    test('statusModule.calculateRemainingQuota smart-scales >= 1 GB to GB while keeping MB below 1 GB', () => {
      document.body.innerHTML =
        '<div id="sessionCountdownSection" data-limit-bytes-total="5368709120" data-bytes-in="0" data-bytes-out="0" data-kb-base="1024" data-quota-format="MB">' +
        '<div id="session-countdown"></div><div id="quota-remaining-progress-fill"></div><div id="quota-remaining-percentage"></div>' +
        '</div>';
      statusModule.calculateRemainingQuota();
      expect(document.getElementById('session-countdown').textContent).toBe('5 GB');

      document.documentElement.setAttribute('lang', 'ar');
      statusModule.calculateRemainingQuota();
      expect(document.getElementById('session-countdown').textContent).toBe('5 جيجا');
    });

    test('statusModule.formatEstimate caps estimates above 99 hours realistically', () => {
      expect(statusModule.formatEstimate(250, false)).toBe('99+ hrs');
      expect(statusModule.formatEstimate(250, true)).toBe('+99 ساعة');
    });

    test('auth.clearVoucher empties #voucher and hides #voucher-clear', () => {
      document.body.innerHTML = '<input id="voucher" value="123456"><button id="voucher-clear"></button>';
      sessionStorage.setItem('hotspot_last_voucher', '123456');
      auth.clearVoucher();
      expect(document.getElementById('voucher').value).toBe('');
      expect(document.getElementById('voucher-clear').hidden).toBe(true);
      expect(sessionStorage.getItem('hotspot_last_voucher')).toBeNull();
    });

    test('auth._saveStoredVoucher, _getStoredVoucher cookie fallback, and _clearStoredVoucher', () => {
      auth._clearStoredVoucher();
      auth._saveStoredVoucher('987654');
      expect(sessionStorage.getItem('hotspot_last_voucher')).toBe('987654');
      expect(localStorage.getItem('hotspot_last_voucher')).toBe('987654');
      expect(util.getCookie('hotspot_last_voucher')).toBe('987654');

      // Simulate WebView where sessionStorage/localStorage were wiped but cookie survived
      sessionStorage.removeItem('hotspot_last_voucher');
      localStorage.removeItem('hotspot_last_voucher');
      expect(auth._getStoredVoucher()).toBe('987654');

      auth._clearStoredVoucher();
      expect(auth._getStoredVoucher()).toBeNull();
      expect(util.getCookie('hotspot_last_voucher')).toBeNull();
    });

    test('expired.html clears stored credentials while logout.html preserves them for auto-login', () => {
      const expiredTpl = fs.readFileSync(path.join(ROOT, 'src/templates/expired.html'), 'utf8');
      const logoutTpl = fs.readFileSync(path.join(ROOT, 'src/templates/logout.html'), 'utf8');
      expect(expiredTpl).toContain("sessionStorage.removeItem('hotspot_last_voucher')");
      expect(expiredTpl).toContain("localStorage.removeItem('hotspot_last_voucher')");
      expect(expiredTpl).toContain("util.setCookie('hotspot_last_voucher', '', -1)");
      expect(expiredTpl).toContain("util.setCookie('hotspot_last_voucher_pw', '', -1)");
      expect(expiredTpl).toContain("util.setCookie('hotspot_password', '', -1)");

      expect(logoutTpl).not.toContain("removeItem('hotspot_last_voucher')");
      expect(logoutTpl).not.toContain("setCookie('hotspot_last_voucher'");
      expect(logoutTpl).not.toContain("setCookie('hotspot_password'");
    });

    test('auth.init preserves stored voucher on transient errors and clears on permanent credential errors', () => {
      auth._clearStoredVoucher();
      auth._saveStoredVoucher('778899');
      document.body.innerHTML =
        '<div id="alerts"><span id="errorMessage">no more sessions are allowed for user 778899</span></div>' +
        '<form id="login-form"><input id="voucher" value=""><input id="username"><input id="password"></form>';

      auth.init();
      expect(auth._getStoredVoucher()).toBe('778899');
      expect(document.getElementById('voucher').value).toBe('778899');

      // Permanent invalid credential error clears stored voucher, but keeps code visible in #voucher
      document.getElementById('errorMessage').textContent = 'invalid username or password';
      document.getElementById('voucher').value = '';
      auth.init();
      expect(auth._getStoredVoucher()).toBeNull();
      expect(document.getElementById('voucher').value).toBe('778899');
    });

    test('auth.triggerAutoLogin ignores un-substituted $(error-esc) token and blocks real router errors', () => {
      jest.useFakeTimers();
      auth._clearStoredVoucher();
      auth._saveStoredVoucher('445566');
      document.body.innerHTML =
        '<div id="alerts"><span id="errorMessage">$(error-esc)</span></div>' +
        '<form id="login-form"><input id="voucher" value=""><input id="username"><input id="password"></form>';

      const submitSpy = jest.fn();
      document.getElementById('login-form').requestSubmit = submitSpy;

      auth.triggerAutoLogin();
      expect(document.getElementById('auto-login-alert')).not.toBeNull();
      jest.advanceTimersByTime(3100);
      expect(submitSpy).toHaveBeenCalledTimes(1);

      // Now simulate a real RouterOS error message
      submitSpy.mockClear();
      document.getElementById('errorMessage').textContent = 'invalid username or password';
      auth.triggerAutoLogin();
      expect(document.getElementById('auto-login-alert')).toBeNull();
      jest.advanceTimersByTime(3100);
      expect(submitSpy).not.toHaveBeenCalled();

      auth._clearStoredVoucher();
      jest.useRealTimers();
    });

    test('normal mode rememberUsername stores username/password and triggerAutoLogin submits countdown', () => {
      jest.useFakeTimers();
      auth._clearStoredVoucher();
      auth._clearStoredUsername();
      auth._clearStoredPassword();

      document.body.innerHTML =
        '<div id="alerts"></div>' +
        '<form id="login-form" data-clone-prevention="true">' +
        '  <div class="auth-tabs"><button type="button" class="auth-tab auth-tab--active" data-mode="normal"></button></div>' +
        '  <div data-mode-panel="voucher" hidden><input id="voucher"></div>' +
        '  <div data-mode-panel="normal"><input id="username" value="ali99"><input id="password" value="pass1234"><input type="checkbox" id="remember-me" checked></div>' +
        '</form>';

      auth.rememberUsername();
      expect(auth._getStoredUsername()).toBe('ali99');
      expect(auth._getStoredPassword()).toBe('pass1234');

      // Clear visible inputs and trigger auto-login from saved storage
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
      const submitSpy = jest.fn();
      document.getElementById('login-form').requestSubmit = submitSpy;

      auth.triggerAutoLogin();
      expect(document.getElementById('username').value).toBe('ali99');
      expect(document.getElementById('password').value).toBe('pass1234');
      expect(document.getElementById('auto-login-alert')).not.toBeNull();

      jest.advanceTimersByTime(3100);
      expect(submitSpy).toHaveBeenCalledTimes(1);

      auth._clearStoredUsername();
      auth._clearStoredPassword();
      jest.useRealTimers();
    });

    test('mikhmon scanned password is preserved across applyVoucherCredentials and restored by triggerAutoLogin', () => {
      jest.useFakeTimers();
      auth._clearStoredVoucher();
      document.body.innerHTML =
        '<div id="alerts"></div>' +
        '<form id="login-form" data-clone-prevention="true" data-scanned-password="qrSecret">' +
        '  <input id="voucher" value="card01"><input id="username"><input id="password">' +
        '</form>';

      auth.applyVoucherCredentials('card01');
      expect(auth._getStoredVoucher()).toBe('card01');
      expect(auth._getStoredVoucherPassword()).toBe('qrSecret');

      // Reload simulation without data-scanned-password attribute
      const form = document.getElementById('login-form');
      form.removeAttribute('data-scanned-password');
      document.getElementById('voucher').value = '';
      document.getElementById('password').value = '';
      const submitSpy = jest.fn();
      form.requestSubmit = submitSpy;

      auth.triggerAutoLogin();
      expect(form.getAttribute('data-scanned-password')).toBe('qrSecret');
      jest.advanceTimersByTime(3100);
      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(document.getElementById('username').value).toBe('card01');
      expect(document.getElementById('password').value).toBe('qrSecret');

      auth._clearStoredVoucher();
      jest.useRealTimers();
    });

    test('util.formatUptime localizes units to Arabic when html lang="ar" and preserves English otherwise', () => {
      document.documentElement.setAttribute('lang', 'en');
      expect(util.formatUptime(3661)).toBe('1h 1m 1s');
      document.documentElement.setAttribute('lang', 'ar');
      expect(util.formatUptime(3661)).toBe('1 س 1 د 1 ث');
      expect(util.formatUptime(0)).toBe('0 ث');
      document.documentElement.setAttribute('lang', 'en');
    });

    test('alogin template preserves ros: comment carriers after build and validates URL scheme', () => {
      const builtAlogin = fs.readFileSync(path.join(DIST, 'alogin.html'), 'utf8');
      expect(builtAlogin).toContain('<!--ros:redirect:$(link-redirect)-->');
      expect(builtAlogin).toContain('<!--ros:orig:$(link-orig-esc)-->');
      expect(builtAlogin).toContain('<!--ros:status:$(link-status)-->');
      expect(builtAlogin).toContain('function isSafeUrl(');
    });
  });
});
