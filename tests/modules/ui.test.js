/**
 * Tests for Hotspot.ui module
 */

const ui = require('../../src/js/modules/ui.js');
const util = require('../../src/js/modules/util.js');

describe('Hotspot.ui', () => {
  describe('translateRouterError', () => {
    const map = {
      'no more sessions are allowed for user': 'عذراً، لقد تم الوصول للحد الأقصى من الجلسات المفتوحة لهذا المستخدم.'
    };

    beforeEach(() => {
      // ui.js references the util module via the shared global (browser build
      // concatenates both into one scope; Node sees separate module scopes)
      global.util = util;
    });

    afterEach(() => {
      document.documentElement.removeAttribute('lang');
      delete window.HotspotErrorMap;
      delete global.util;
      document.body.innerHTML = '';
    });

    test('delegates to util.translateError with the injected map', () => {
      window.HotspotErrorMap = map;
      document.documentElement.setAttribute('lang', 'ar');
      document.body.innerHTML = '<span id="errorMessage">no more sessions are allowed for user testuser</span>';

      ui.translateRouterError();

      const el = document.getElementById('errorMessage');
      // documented RouterOS format is handled cleanly without exposing the username
      expect(el.textContent).toBe('هذا الكارت متصل حالياً على الحد الأقصى من الأجهزة؛ افصل الجهاز الآخر أولاً.');
      expect(el.textContent).not.toContain('testuser');
    });

    test('caches raw error in data-raw-error for re-translation', () => {
      window.HotspotErrorMap = map;
      document.documentElement.setAttribute('lang', 'ar');
      document.body.innerHTML = '<span id="errorMessage">no more sessions are allowed for user testuser</span>';

      ui.translateRouterError();
      const el = document.getElementById('errorMessage');
      expect(el.getAttribute('data-raw-error')).toBe('no more sessions are allowed for user testuser');
      expect(el.textContent).not.toBe(el.getAttribute('data-raw-error'));

      // Toggle back to English — original (cleaned) message is restored
      document.documentElement.setAttribute('lang', 'en');
      ui.translateRouterError();
      expect(el.textContent).toBe('no more sessions are allowed for user testuser');

      // And back to Arabic again — works from the cached raw, not the translated text
      document.documentElement.setAttribute('lang', 'ar');
      ui.translateRouterError();
      expect(el.textContent).toBe('هذا الكارت متصل حالياً على الحد الأقصى من الأجهزة؛ افصل الجهاز الآخر أولاً.');
    });

    test('leaves unknown messages unchanged', () => {
      window.HotspotErrorMap = map;
      document.documentElement.setAttribute('lang', 'ar');
      document.body.innerHTML = '<span id="errorMessage">some unknown error message</span>';

      ui.translateRouterError();
      expect(document.getElementById('errorMessage').textContent).toBe('some unknown error message');
    });

    test('no-ops when the error element does not exist', () => {
      window.HotspotErrorMap = map;
      expect(() => ui.translateRouterError()).not.toThrow();
    });

    test('passes unknown messages through unchanged when no map is injected', () => {
      document.documentElement.setAttribute('lang', 'ar');
      document.body.innerHTML = '<span id="errorMessage">some unknown error message</span>';

      ui.translateRouterError();
      expect(document.getElementById('errorMessage').textContent)
        .toBe('some unknown error message');
    });

    test('also translates #error-message element fallback', () => {
      window.HotspotErrorMap = map;
      document.documentElement.setAttribute('lang', 'ar');
      document.body.innerHTML = '<span id="error-message">no more sessions are allowed for user testuser</span>';

      ui.translateRouterError();
      expect(document.getElementById('error-message').textContent)
        .toBe('هذا الكارت متصل حالياً على الحد الأقصى من الأجهزة؛ افصل الجهاز الآخر أولاً.');
    });

    test('initLang translates RouterOS error in-place instead of redirecting and losing $(error-esc)', () => {
      window.HotspotErrorMap = map;
      global.i18n = {
        detectLang: () => 'ar',
        setLang: (lang) => document.documentElement.setAttribute('lang', lang)
      };
      util.setCookie('hotspot_lang', 'ar', 365);
      window.history.pushState({}, '', '/login.html');
      document.body.innerHTML = '<span id="errorMessage">no more sessions are allowed for user ahmed</span>';

      ui.initLang();

      expect(document.documentElement.getAttribute('lang')).toBe('ar');
      expect(document.getElementById('errorMessage').textContent)
        .toBe('هذا الكارت متصل حالياً على الحد الأقصى من الأجهزة؛ افصل الجهاز الآخر أولاً.');
      delete global.i18n;
    });

    test('preserves <bdi dir="auto"> child element inside #errorMessage', () => {
      window.HotspotErrorMap = map;
      document.documentElement.setAttribute('lang', 'ar');
      document.body.innerHTML = '<span id="errorMessage"><bdi dir="auto">no more sessions are allowed for user 8118</bdi></span>';

      ui.translateRouterError();

      const bdi = document.querySelector('#errorMessage bdi');
      expect(bdi).not.toBeNull();
      expect(bdi.getAttribute('dir')).toBe('auto');
      expect(bdi.textContent).toBe('هذا الكارت متصل حالياً على الحد الأقصى من الأجهزة؛ افصل الجهاز الآخر أولاً.');
    });

    test('provides readable Arabic fallback when corrupted %FFF input yields empty text or bare card digits', () => {
      window.HotspotErrorMap = map;
      document.documentElement.setAttribute('lang', 'ar');

      document.body.innerHTML = '<span id="errorMessage"><bdi dir="auto">%FFF%FFF%FFF+%FFF%FFF</bdi></span>';
      ui.translateRouterError();
      expect(document.getElementById('errorMessage').textContent.length).toBeGreaterThan(10);
      expect(document.getElementById('errorMessage').textContent).not.toContain('%FFF');

      document.body.innerHTML = '<span id="errorMessage"><bdi dir="auto">%FFF%FFF+%FFF%FFF+8118</bdi></span>';
      ui.translateRouterError();
      const digitFallback = document.getElementById('errorMessage').textContent;
      expect(digitFallback).toContain('8118');
      expect(digitFallback.trim()).not.toBe('8118');
    });
  });

  describe('Theme management', () => {
    beforeEach(() => {
      global.util = util;
      global.i18n = {
        t: (k) => k
      };
      document.body.innerHTML = `
        <button class="theme-toggle" aria-label=""></button>
        <meta id="metaThemeColor" content="#020617">
      `;
    });

    afterEach(() => {
      delete global.util;
      delete global.i18n;
      document.body.innerHTML = '';
      document.documentElement.removeAttribute('data-theme');
    });

    test('initTheme uses hotspot_theme cookie when valid', () => {
      util.setCookie('hotspot_theme', 'light', 365);
      ui.initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.querySelector('.theme-toggle').getAttribute('aria-label')).toBe('theme_switch_to_dark');
    });

    test('initTheme falls back to data-theme attribute or dark when no cookie', () => {
      document.cookie = 'hotspot_theme=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.documentElement.setAttribute('data-theme', 'dark');
      ui.initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.querySelector('.theme-toggle').getAttribute('aria-label')).toBe('theme_switch_to_light');
    });

    test('toggleTheme switches dark to light, sets cookie and updates meta color', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      ui.toggleTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(util.getCookie('hotspot_theme')).toBe('light');
      expect(document.getElementById('metaThemeColor').getAttribute('content')).toBe('#f8fafc');

      // Toggle back to dark
      ui.toggleTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(util.getCookie('hotspot_theme')).toBe('dark');
      expect(document.getElementById('metaThemeColor').getAttribute('content')).toBe('#020617');
    });
  });

  describe('Language routing & toggleLang', () => {
    beforeEach(() => {
      global.util = util;
      global.i18n = {
        t: (k) => k,
        setLang: jest.fn(),
        detectLang: () => 'ar'
      };
    });

    afterEach(() => {
      delete global.util;
      delete global.i18n;
    });

    test('getRedirectPath computes correct paths for Arabic and English', () => {
      window.history.pushState({}, '', '/login.html');
      expect(ui.getRedirectPath('ar')).toBe('/ar/login.html');

      window.history.pushState({}, '', '/ar/login.html');
      expect(ui.getRedirectPath('en')).toBe('/login.html');
    });

    test('toggleLang toggles between en and ar', () => {
      document.documentElement.setAttribute('lang', 'en');
      const origLocation = window.location;
      delete window.location;
      window.location = new URL('http://10.5.50.1/login.html');
      window.location.replace = jest.fn();

      ui.toggleLang();
      expect(util.getCookie('hotspot_lang')).toBe('ar');
      expect(window.location.replace).toHaveBeenCalledWith('/ar/login.html');

      window.location = origLocation;
    });

    test('toggleLang in-place when getRedirectPath is null', () => {
      document.documentElement.setAttribute('lang', 'ar');
      const origGetRedirect = ui.getRedirectPath;
      ui.getRedirectPath = () => null;

      ui.toggleLang();
      expect(global.i18n.setLang).toHaveBeenCalledWith('en');
      ui.getRedirectPath = origGetRedirect;
    });
  });

  describe('Countdown & Alerts', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      global.util = util;
      document.body.innerHTML = `
        <div id="countdown-val"></div>
        <div id="alerts"></div>
      `;
    });

    afterEach(() => {
      jest.useRealTimers();
      delete global.util;
      document.body.innerHTML = '';
    });

    test('initCountdown decrements and calls callback at 0', () => {
      const cb = jest.fn();
      const interval = ui.initCountdown(2, 'countdown-val', cb);
      expect(document.getElementById('countdown-val').textContent).toBe('00:00:02');

      jest.advanceTimersByTime(1000);
      expect(document.getElementById('countdown-val').textContent).toBe('00:00:01');

      jest.advanceTimersByTime(1000);
      expect(cb).toHaveBeenCalled();
      clearInterval(interval);
    });
  });

  describe('Modals: Support and Install App', () => {
    beforeEach(() => {
      document.body.style.overflow = '';
      document.body.innerHTML = `
        <button type="button" class="support-trigger" aria-controls="supportModal" aria-expanded="false">Support</button>
        <div class="support-modal" id="supportModal">
          <div class="support-modal__content">Inner</div>
        </div>
        <div class="support-modal" id="installModal">
          <div class="support-modal__content">
            <div id="ios-guide" style="display:none"></div>
            <div id="android-guide" style="display:none"></div>
            <div id="generic-guide" style="display:none"></div>
          </div>
        </div>
      `;
    });

    afterEach(() => {
      document.body.innerHTML = '';
      document.body.style.overflow = '';
    });

    test('toggleSupportModal opens, updates aria-expanded and body overflow, closes sibling modal, and closes cleanly on Esc', () => {
      const modal = document.getElementById('supportModal');
      const installModal = document.getElementById('installModal');
      const trigger = document.querySelector('.support-trigger');

      ui.toggleInstallModal();
      expect(installModal.classList.contains('support-modal--open')).toBe(true);

      ui.toggleSupportModal();
      expect(modal.classList.contains('support-modal--open')).toBe(true);
      expect(installModal.classList.contains('support-modal--open')).toBe(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(document.body.style.overflow).toBe('hidden');

      // Trigger Escape key
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);
      expect(modal.classList.contains('support-modal--open')).toBe(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.body.style.overflow).toBe('');
    });

    test('closeSupportModalOnClickOutside only closes when clicking backdrop', () => {
      const modal = document.getElementById('supportModal');
      ui.toggleSupportModal();
      expect(modal.classList.contains('support-modal--open')).toBe(true);

      const inner = modal.querySelector('.support-modal__content');
      ui.closeSupportModalOnClickOutside({ target: inner });
      expect(modal.classList.contains('support-modal--open')).toBe(true);

      ui.closeSupportModalOnClickOutside({ target: modal });
      expect(modal.classList.contains('support-modal--open')).toBe(false);
    });

    test('toggleInstallModal shows correct guide for iOS / Android / Generic', () => {
      const modal = document.getElementById('installModal');
      const iosGuide = document.getElementById('ios-guide');
      const androidGuide = document.getElementById('android-guide');
      const genericGuide = document.getElementById('generic-guide');

      // Test Android UA
      Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 Android 11', configurable: true });
      ui.toggleInstallModal();
      expect(modal.classList.contains('support-modal--open')).toBe(true);
      expect(androidGuide.style.display).toBe('flex');
      expect(iosGuide.style.display).toBe('none');

      // Close modal
      ui.toggleInstallModal();
      expect(modal.classList.contains('support-modal--open')).toBe(false);

      // Test iOS UA
      Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)', configurable: true });
      ui.toggleInstallModal();
      expect(iosGuide.style.display).toBe('flex');
      ui.toggleInstallModal();

      // Test Generic UA
      Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', configurable: true });
      ui.toggleInstallModal();
      expect(genericGuide.style.display).toBe('flex');
      ui.toggleInstallModal();
    });

    test('closeInstallModalOnClickOutside closes on backdrop click', () => {
      const modal = document.getElementById('installModal');
      ui.toggleInstallModal();
      expect(modal.classList.contains('support-modal--open')).toBe(true);

      ui.closeInstallModalOnClickOutside({ target: modal });
      expect(modal.classList.contains('support-modal--open')).toBe(false);
    });
  });

  describe('Announcements banner', () => {
    let xhrMock;
    beforeEach(() => {
      jest.useFakeTimers();
      global.util = util;
      document.body.innerHTML = `
        <div id="announcement-banner" style="display:none;">
          <svg id="announcement-icon"></svg>
          <span id="announcement-text"></span>
        </div>
      `;
      xhrMock = {
        open: jest.fn(),
        send: jest.fn(),
        status: 200,
        readyState: 4,
        responseText: ''
      };
      global.XMLHttpRequest = jest.fn(() => xhrMock);
    });

    afterEach(() => {
      jest.useRealTimers();
      delete global.util;
      delete global.XMLHttpRequest;
      document.body.innerHTML = '';
    });

    test('loadAnnouncements loads data, sets banner type and text, rotates items', () => {
      document.documentElement.setAttribute('lang', 'en');
      ui.loadAnnouncements();

      xhrMock.responseText = JSON.stringify({
        active: true,
        type: 'info',
        message_en: ['Notice 1', 'Notice 2'],
        message_ar: ['إعلان 1', 'إعلان 2']
      });
      xhrMock.onreadystatechange();

      const banner = document.getElementById('announcement-banner');
      const text = document.getElementById('announcement-text');
      expect(banner.style.display).toBe('flex');
      expect(banner.classList.contains('announcement-banner--info')).toBe(true);
      expect(text.textContent).toBe('Notice 1');

      // Test rotation
      jest.advanceTimersByTime(5000);
      jest.advanceTimersByTime(300);
      expect(text.textContent).toBe('Notice 2');
    });

    test('loadAnnouncements respects hotspot_dismissed_msg cookie', () => {
      util.setCookie('hotspot_dismissed_msg', 'Notice 1', 7);
      document.documentElement.setAttribute('lang', 'en');
      ui.loadAnnouncements();

      xhrMock.responseText = JSON.stringify({
        active: true,
        type: 'warning',
        message_en: ['Notice 1']
      });
      xhrMock.onreadystatechange();

      const banner = document.getElementById('announcement-banner');
      expect(banner.style.display).toBe('none');
    });

    test('dismissAnnouncement hides banner and records cookie', () => {
      const banner = document.getElementById('announcement-banner');
      banner.style.display = 'flex';
      ui._currentAnnouncementMessage = 'Notice 1';

      ui.dismissAnnouncement();
      expect(banner.style.display).toBe('none');
      expect(util.getCookie('hotspot_dismissed_msg')).toBe('Notice 1');
    });
  });

  describe('Canvas Network Background', () => {
    test('initBackground respects prefers-reduced-motion', () => {
      document.body.innerHTML = '<canvas id="network-bg"></canvas>';
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      ui.initBackground();
      const canvas = document.getElementById('network-bg');
      expect(canvas.style.display).toBe('none');
    });
  });
});
