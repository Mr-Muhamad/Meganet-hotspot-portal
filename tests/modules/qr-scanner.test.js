/**
 * Tests for Hotspot.qrScanner — the in-page voucher scanner modal.
 * routeScan is the dual-mode card router: a URL payload is a link card
 * (navigate to it), anything else is a bare voucher code.
 */

const qrScanner = require('../../src/js/modules/qr-scanner.js');
const auth = require('../../src/js/modules/auth.js');

describe('Hotspot.qrScanner', () => {
  beforeEach(() => {
    // routeScan resolves `auth` as a free variable at runtime (same bundle
    // concatenation as the browser) — expose it globally for the module.
    global.auth = auth;
  });

  afterEach(() => {
    delete global.auth;
  });

  describe('routeScan', () => {
    test('a mikhmon credential link logs in in-place on our portal (no navigation)', () => {
      expect(qrScanner.routeScan('http://10.5.50.1/login?username=a&password=b')).toEqual({
        action: 'autologin',
        code: 'a',
        password: 'b'
      });
    });

    test('a mikhmon link with explicit empty password= preserves empty password string', () => {
      expect(qrScanner.routeScan('http://10.5.50.1/login?username=V1234&password=')).toEqual({
        action: 'autologin',
        code: 'V1234',
        password: ''
      });
    });

    test('a credential link on a FOREIGN host still logs in in-place (never navigates)', () => {
      // the printed $dnsname may be stale or differ from how the user reached
      // the portal — and a swapped QR must never navigate off-portal anyway
      const r = qrScanner.routeScan('http://printed-dnsname.example.net/login?username=ahmed2015&password=secret99');
      expect(r.action).toBe('autologin');
      expect(r.code).toBe('ahmed2015');
      expect(r.password).toBe('secret99');
    });

    test('alphanumeric usernames are kept raw (not digit-normalized)', () => {
      const r = qrScanner.routeScan('http://any-host.example/login?username=ahmed2015');
      expect(r.code).toBe('ahmed2015');
    });

    test('a voucher link payload on private hotspot IP routes directly as autologin', () => {
      expect(qrScanner.routeScan('http://10.5.50.1/login?voucher=123456')).toEqual({
        action: 'autologin',
        code: '123456'
      });
    });

    test('a voucher link on a foreign host also extracts the code in-place', () => {
      const r = qrScanner.routeScan('https://hotspot.example.net/login?voucher=12345');
      expect(r).toEqual({
        action: 'autologin',
        code: '12345'
      });
    });

    test('a foreign portal-shaped URL WITHOUT credentials is rejected (phishing guard)', () => {
      const r = qrScanner.routeScan('https://hotspot.example.net/login');
      expect(r.action).toBe('autologin');
      expect(r.code).toBe('');
    });

    test('rejects malicious external URLs that have no login parameters', () => {
      const r = qrScanner.routeScan('https://evil-phishing-site.com/steal-data');
      expect(r.action).toBe('autologin');
      expect(r.code).toBe('');
    });

    test('bare digits route as an auto-login code', () => {
      expect(qrScanner.routeScan('1234567890')).toEqual({
        action: 'autologin',
        code: '1234567890'
      });
    });

    test('Eastern Arabic and Persian numerals normalize to ASCII digits', () => {
      expect(qrScanner.routeScan('١٢٣٤٥').code).toBe('12345');
      expect(qrScanner.routeScan('۱۲۳۴۵').code).toBe('12345');
    });

    test('whitespace and stray characters around a code are stripped', () => {
      expect(qrScanner.routeScan('  12-34 56\n').code).toBe('123456');
    });

    test('the "=" prefix some card generators print before the code is stripped', () => {
      // real card payload observed in the field: the QR encodes "=<code>"
      expect(qrScanner.routeScan('=123456')).toEqual({
        action: 'autologin',
        code: '123456'
      });
    });

    test('the "-" prefix encodes a username with an explicit empty password', () => {
      expect(qrScanner.routeScan('-81354860')).toEqual({
        action: 'autologin',
        code: '81354860',
        password: ''
      });
    });

    test('length-letter prefix [a-z] splits username and separate password', () => {
      // 'g' (7) -> 7-char username + 6-char password
      expect(qrScanner.routeScan('g6256868080377')).toEqual({
        action: 'autologin',
        code: '6256868',
        password: '080377'
      });
      // 'j' (10) -> 10-char username + 6-char password
      expect(qrScanner.routeScan('j8772557194108270')).toEqual({
        action: 'autologin',
        code: '8772557194',
        password: '108270'
      });
    });

    test('bare alphanumeric vouchers like "ahmed2015" are not misread as length-prefixed in alphanumeric mode', () => {
      const origGetFmt = auth.getVoucherFormat;
      auth.getVoucherFormat = () => 'alphanumeric';
      expect(qrScanner.routeScan('ahmed2015')).toEqual({
        action: 'autologin',
        code: 'ahmed2015'
      });
      expect(qrScanner.routeScan('j8772557194108270')).toEqual({
        action: 'autologin',
        code: '8772557194',
        password: '108270'
      });
      auth.getVoucherFormat = origGetFmt;
    });

    test('an empty payload routes as an empty code (handled as a failure)', () => {
      expect(qrScanner.routeScan('')).toEqual({ action: 'autologin', code: '' });
      expect(qrScanner.routeScan(null).code).toBe('');
    });

    test('supports schemeless hotspot links and alternate credential params', () => {
      expect(qrScanner.routeScan('10.5.50.1/login?voucher=987654')).toEqual({
        action: 'autologin',
        code: '987654'
      });
      expect(qrScanner.routeScan('wifi.meganet.local/login?username=u1&password=p1')).toEqual({
        action: 'autologin',
        code: 'u1',
        password: 'p1'
      });
      expect(qrScanner.routeScan('https://portal.example.net/login?user=ahmed&pass=pw123')).toEqual({
        action: 'autologin',
        code: 'ahmed',
        password: 'pw123'
      });
      expect(qrScanner.routeScan('http://192.168.88.1/login#pin=445566')).toEqual({
        action: 'autologin',
        code: '445566'
      });
      expect(qrScanner.routeScan('evil-site.com/phishing')).toEqual({
        action: 'autologin',
        code: ''
      });
    });

    test('_buildDecodeAttempts puts 600px first, 60% brightCard center crop second for all sizes, then 1100px and 1200px tiles', () => {
      const attempts = qrScanner._buildDecodeAttempts(4000, 3000);
      expect(attempts[0]).toEqual({ x: 0, y: 0, w: 1, h: 1, cap: 600, invert: 'attemptBoth' });
      expect(attempts[1]).toEqual({ x: 0.2, y: 0.2, w: 0.6, h: 0.6, cap: 900, enhance: 'brightCard', invert: 'dontInvert' });
      expect(attempts[2]).toEqual({ x: 0, y: 0, w: 1, h: 1, cap: 1100, invert: 'attemptBoth' });
      const nativeTiles = attempts.filter(a => !a.enhance && a.w < 1 && a.h < 1 && a.cap === 1200);
      expect(nativeTiles.length).toBe(5);
      expect(attempts.filter(a => a.enhance).length).toBe(4);
      expect(attempts.slice(3).every(a => a.invert === 'dontInvert')).toBe(true);
      expect(attempts.some(a => a.enhance === true && a.w < 1 && a.h < 1 && a.cap === 1200)).toBe(true);

      const midAttempts = qrScanner._buildDecodeAttempts(768, 1024);
      expect(midAttempts[1]).toEqual({ x: 0.2, y: 0.2, w: 0.6, h: 0.6, cap: 900, enhance: 'brightCard', invert: 'dontInvert' });
    });

    test('_enhanceContrast stretches a low-contrast buffer and skips flat ones', () => {
      const data = new Uint8ClampedArray(400);
      for (let i = 0; i < 100; i++) {
        const v = i % 2 ? 140 : 110;
        data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
        data[i * 4 + 3] = 255;
      }
      expect(qrScanner._enhanceContrast(data)).toBe(true);
      expect(data[0]).toBeLessThan(20);
      expect(data[4]).toBeGreaterThan(235);
      const flat = new Uint8ClampedArray(400).fill(128);
      expect(qrScanner._enhanceContrast(flat)).toBe(false);
    });

    test('_enhanceBrightCard collapses dark background to 0 while boosting gray-on-white contrast and skips flat ones', () => {
      // 70% dark fabric pixels (35), 15% faded gray ink pixels (140), 15% white card pixels (225)
      const data = new Uint8ClampedArray(400);
      for (let i = 0; i < 100; i++) {
        const v = i < 70 ? 35 : (i < 85 ? 140 : 225);
        data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
        data[i * 4 + 3] = 255;
      }
      expect(qrScanner._enhanceBrightCard(data)).toBe(true);
      expect(data[0]).toBe(0); // dark background clamped
      expect(data[70 * 4]).toBeGreaterThan(40);
      expect(data[70 * 4]).toBeLessThan(120); // faded gray stays distinct from dark & white
      expect(data[85 * 4]).toBe(255); // bright white reaches full white
      const flat = new Uint8ClampedArray(400).fill(128);
      expect(qrScanner._enhanceBrightCard(flat)).toBe(false);
    });
  });

  describe('buildEscapeIntentUrl', () => {
    test('builds an intent URL for the default browser (no package pinning)', () => {
      const url = qrScanner.buildEscapeIntentUrl('http://192.168.8.1/ar/login.html');
      expect(url).toBe(
        'intent://192.168.8.1/ar/login.html#Intent;scheme=http;' +
        'S.browser_fallback_url=' + encodeURIComponent('http://192.168.8.1/ar/login.html') + ';end'
      );
    });

    test('keeps https as the inner scheme', () => {
      const url = qrScanner.buildEscapeIntentUrl('https://hotspot.example.net/login?voucher=1');
      expect(url.startsWith('intent://hotspot.example.net/login?voucher=1#Intent;scheme=https;')).toBe(true);
      expect(url.endsWith(';end')).toBe(true);
    });

    test('returns an empty string for an empty URL', () => {
      expect(qrScanner.buildEscapeIntentUrl('')).toBe('');
      expect(qrScanner.buildEscapeIntentUrl(null)).toBe('');
    });
  });

  describe('_isStrippedWebView', () => {
    const withUA = (ua) => {
      Object.defineProperty(window.navigator, 'userAgent', { get: () => ua, configurable: true });
    };

    afterEach(() => {
      Object.defineProperty(window.navigator, 'userAgent', { get: () => 'jsdom', configurable: true });
    });

    const CAPTIVE_PORTAL_UA =
      'Mozilla/5.0 (Linux; Android 11; M2101K6G) AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36';
    const CHROME_UA =
      'Mozilla/5.0 (Linux; Android 11; M2101K6G) AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/119.0.6045.163 Mobile Safari/537.36';
    const FB_IAB_UA =
      'Mozilla/5.0 (Linux; Android 11; M2101K6G) AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0.0.42.129;]';

    test('detects the system captive-portal WebView (Version/4.0 marker)', () => {
      withUA(CAPTIVE_PORTAL_UA);
      expect(qrScanner._isStrippedWebView()).toBe(true);
    });

    test('detects the legacy "; wv)" WebView marker', () => {
      withUA('Mozilla/5.0 (Linux; Android 9; X) AppleWebKit/537.36 (KHTML, like Gecko); wv) Version/4.0 Chrome/90 Mobile Safari/537.36');
      expect(qrScanner._isStrippedWebView()).toBe(true);
    });

    test('real Chrome is not a stripped WebView', () => {
      withUA(CHROME_UA);
      expect(qrScanner._isStrippedWebView()).toBe(false);
    });

    test('Facebook in-app browser implements the chooser — excluded', () => {
      withUA(FB_IAB_UA);
      expect(qrScanner._isStrippedWebView()).toBe(false);
    });

    test('desktop browsers pass through', () => {
      withUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36');
      expect(qrScanner._isStrippedWebView()).toBe(false);
    });
  });

  describe('_isIosCna', () => {
    const withUA = (ua) => {
      Object.defineProperty(window.navigator, 'userAgent', { get: () => ua, configurable: true });
    };
    const origStandaloneDesc = Object.getOwnPropertyDescriptor(window.navigator, 'standalone');

    afterEach(() => {
      Object.defineProperty(window.navigator, 'userAgent', { get: () => 'jsdom', configurable: true });
      if (origStandaloneDesc) {
        Object.defineProperty(window.navigator, 'standalone', origStandaloneDesc);
      } else {
        delete window.navigator.standalone;
      }
    });

    const IOS_CNA_UA =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

    test('detects iOS Captive Network Assistant (WebKit without Safari/ or browser token)', () => {
      withUA(IOS_CNA_UA);
      expect(qrScanner._isIosCna()).toBe(true);
    });

    test('real iOS Safari is not CNA', () => {
      withUA(IOS_CNA_UA + ' Version/17.5 Safari/604.1');
      expect(qrScanner._isIosCna()).toBe(false);
    });

    test('iOS Chrome (CriOS) is not CNA', () => {
      withUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1');
      expect(qrScanner._isIosCna()).toBe(false);
    });

    test('iOS in-app browser (FBAN/FBIOS) is excluded', () => {
      withUA(IOS_CNA_UA + ' [FBAN/FBIOS;FBAV/440.0]');
      expect(qrScanner._isIosCna()).toBe(false);
    });

    test('iOS installed standalone PWA is excluded', () => {
      withUA(IOS_CNA_UA);
      Object.defineProperty(window.navigator, 'standalone', { get: () => true, configurable: true });
      expect(qrScanner._isIosCna()).toBe(false);
    });

    test('Android and desktop UAs return false', () => {
      withUA('Mozilla/5.0 (Linux; Android 11; M2101K6G) AppleWebKit/537.36 Version/4.0 Chrome/119.0 Mobile Safari/537.36');
      expect(qrScanner._isIosCna()).toBe(false);
      withUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36');
      expect(qrScanner._isIosCna()).toBe(false);
    });
  });

  describe('scanDirect & onPageLoad interaction', () => {
    let mockFileInput;
    let mockGalleryInput;
    let mockGalleryBtn;
    let mockScanBtn;
    let mockWebviewHint;
    let mockHintOr;

    beforeEach(() => {
      qrScanner._fileInputWired = false;
      document.body.innerHTML = `
        <button id="qrScanButton" class="qr-scan-btn"><span data-i18n="qr_scan_btn_text">Scan Card QR Code</span></button>
        <button id="qrGalleryButton"></button>
        <input type="file" id="qr-file-input" style="display:none">
        <input type="file" id="qr-gallery-input" style="display:none">
        <div id="qr-webview-hint" style="display:none"></div>
        <div id="qr-hint-or" style="display:none"></div>
        <form id="login-form"></form>
      `;
      mockFileInput = document.getElementById('qr-file-input');
      mockGalleryInput = document.getElementById('qr-gallery-input');
      mockGalleryBtn = document.getElementById('qrGalleryButton');
      mockScanBtn = document.getElementById('qrScanButton');
      mockWebviewHint = document.getElementById('qr-webview-hint');
      mockHintOr = document.getElementById('qr-hint-or');
      global.util = {
        showToast: jest.fn()
      };
      global.i18n = {
        t: (k) => k
      };
    });

    afterEach(() => {
      qrScanner._setScanningState(false);
      const jsqrScript = document.getElementById('jsqr-script');
      if (jsqrScript && jsqrScript.parentNode) jsqrScript.parentNode.removeChild(jsqrScript);
      qrScanner._decoderCallbacks = [];
      delete global.util;
      delete global.i18n;
      document.body.innerHTML = '';
      qrScanner._fileInputWired = false;
    });

    test('scanDirect in stripped webview calls escapeNow with intent URL', () => {
      const origIsStripped = qrScanner._isStrippedWebView;
      const origEscape = qrScanner.escapeNow;
      qrScanner._isStrippedWebView = () => true;
      const escapeSpy = jest.fn();
      qrScanner.escapeNow = escapeSpy;

      qrScanner.scanDirect();
      expect(escapeSpy).toHaveBeenCalled();
      expect(escapeSpy.mock.calls[0][0]).toContain('intent://');

      qrScanner._isStrippedWebView = origIsStripped;
      qrScanner.escapeNow = origEscape;
    });

    test('scanDirect in regular browser triggers file input click', () => {
      const origIsStripped = qrScanner._isStrippedWebView;
      qrScanner._isStrippedWebView = () => false;
      const clickSpy = jest.spyOn(mockFileInput, 'click');

      qrScanner.scanDirect();
      expect(clickSpy).toHaveBeenCalled();

      qrScanner._isStrippedWebView = origIsStripped;
    });

    test('onPageLoad in stripped webview unhides hint and separator', () => {
      const origIsStripped = qrScanner._isStrippedWebView;
      qrScanner._isStrippedWebView = () => true;

      qrScanner.onPageLoad();
      expect(mockWebviewHint.style.display).toBe('block');
      expect(mockHintOr.style.display).toBe('block');

      qrScanner._isStrippedWebView = origIsStripped;
    });

    test('onPageLoad with qrscan=1 pulses button and cleans URL query', () => {
      const origIsStripped = qrScanner._isStrippedWebView;
      qrScanner._isStrippedWebView = () => false;
      window.history.pushState({}, '', '/login.html?qrscan=1');

      qrScanner.onPageLoad();
      expect(mockScanBtn.classList.contains('qr-scan-btn--attn')).toBe(true);
      expect(window.location.search).toBe('');

      qrScanner._isStrippedWebView = origIsStripped;
    });

    test('_handleResult routes bare code to auth.beginAutoLogin', () => {
      const authSpy = jest.spyOn(auth, 'beginAutoLogin').mockImplementation(() => {});
      qrScanner._handleResult('123456');

      expect(authSpy).toHaveBeenCalledWith('123456', true);
      authSpy.mockRestore();
    });

    test('_handleResult with credential link sets data-scanned-password and begins auto-login', () => {
      const authSpy = jest.spyOn(auth, 'beginAutoLogin').mockImplementation(() => {});
      const form = document.getElementById('login-form');

      qrScanner._handleResult('http://10.5.50.1/login?username=myuser&password=mypassword');

      expect(authSpy).toHaveBeenCalledWith('myuser', true);
      // data-scanned-password should be cleaned up after beginAutoLogin
      expect(form.hasAttribute('data-scanned-password')).toBe(false);
      authSpy.mockRestore();
    });

    test('_handleResult shows toast error on invalid result', () => {
      qrScanner._handleResult('https://untrusted-site.com/bad');
      expect(global.util.showToast).toHaveBeenCalledWith('qr_scan_failed', 'error');
    });

    test('_handleResult switches to voucher tab when normal tab is active and uses normal mode if voucher input absent', () => {
      const authSpy = jest.spyOn(auth, 'beginAutoLogin').mockImplementation(() => {});
      document.body.innerHTML += `
        <button class="auth-tab" data-mode="voucher"></button>
        <input id="voucher" type="tel">
      `;
      const voucherTab = document.querySelector('.auth-tab[data-mode="voucher"]');
      const tabClickSpy = jest.spyOn(voucherTab, 'click');

      qrScanner._handleResult('09408628');
      expect(tabClickSpy).toHaveBeenCalled();
      expect(authSpy).toHaveBeenCalledWith('09408628', true);

      document.getElementById('voucher').remove();
      document.body.innerHTML += '<input id="username"><input id="password">';
      qrScanner._handleResult('http://wifi.lan/login?username=54052307&password=secret');
      expect(authSpy).toHaveBeenCalledWith('54052307', true, 'normal', 'secret');
      authSpy.mockRestore();
    });

    test('auth.triggerAutoLogin skips saved-voucher countdown when ?qrscan= is present', () => {
      localStorage.setItem('hotspot_last_voucher', '54052307');
      document.body.innerHTML = '<form id="login-form"><div id="alerts"></div><input id="voucher"></form>';
      window.history.pushState({}, '', '/ar/login?qrscan=camera');
      const beginSpy = jest.spyOn(auth, 'beginAutoLogin').mockImplementation(() => {});

      auth.triggerAutoLogin();
      expect(beginSpy).not.toHaveBeenCalled();

      window.history.pushState({}, '', '/ar/login');
      localStorage.removeItem('hotspot_last_voucher');
      beginSpy.mockRestore();
    });

    test('_handleResult clears stale data-scanned-password and hotspot_last_voucher_pw when scanning a bare voucher without password', () => {
      const form = document.getElementById('login-form');
      form.setAttribute('data-scanned-password', '54052307');
      localStorage.setItem('hotspot_last_voucher_pw', '54052307');

      let seenAttrDuringAutoLogin = 'unset';
      let seenStoredPwDuringAutoLogin = 'unset';
      const authSpy = jest.spyOn(auth, 'beginAutoLogin').mockImplementation(() => {
        seenAttrDuringAutoLogin = form.getAttribute('data-scanned-password');
        seenStoredPwDuringAutoLogin = localStorage.getItem('hotspot_last_voucher_pw');
      });

      qrScanner._handleResult('=09408628');

      expect(authSpy).toHaveBeenCalledWith('09408628', true);
      expect(seenAttrDuringAutoLogin).toBeNull();
      expect(seenStoredPwDuringAutoLogin).toBeNull();
      expect(form.hasAttribute('data-scanned-password')).toBe(false);

      authSpy.mockRestore();
      localStorage.removeItem('hotspot_last_voucher_pw');
    });

    test('_handleResult preserves explicit empty password for "-" cards in both voucher and normal modes', () => {
      const form = document.getElementById('login-form');
      let seenAttrDuringAutoLogin = null;
      const authSpy = jest.spyOn(auth, 'beginAutoLogin').mockImplementation(() => {
        seenAttrDuringAutoLogin = form.getAttribute('data-scanned-password');
      });

      qrScanner._handleResult('-81354860');
      expect(authSpy).toHaveBeenCalledWith('81354860', true);
      expect(seenAttrDuringAutoLogin).toBe('');
      expect(form.hasAttribute('data-scanned-password')).toBe(false);

      document.body.innerHTML += '<input id="username"><input id="password">';
      qrScanner._handleResult('-81354860');
      expect(authSpy).toHaveBeenCalledWith('81354860', true, 'normal', '');

      authSpy.mockRestore();
    });

    test('_setScanningState toggles disabled/loading UI, blocks concurrent scanDirect, and restores state', () => {
      const origIsStripped = qrScanner._isStrippedWebView;
      qrScanner._isStrippedWebView = () => false;
      const label = mockScanBtn.querySelector('[data-i18n="qr_scan_btn_text"]');
      mockScanBtn.classList.add('qr-scan-btn--attn');
      const clickSpy = jest.spyOn(mockFileInput, 'click');

      qrScanner._setScanningState(true);
      expect(qrScanner._isDecoding).toBe(true);
      expect(mockScanBtn.disabled).toBe(true);
      expect(mockGalleryBtn.disabled).toBe(true);
      expect(mockFileInput.disabled).toBe(true);
      expect(mockGalleryInput.disabled).toBe(true);
      expect(mockScanBtn.getAttribute('aria-busy')).toBe('true');
      expect(mockScanBtn.classList.contains('qr-scan-btn--loading')).toBe(true);
      expect(mockScanBtn.classList.contains('qr-scan-btn--disabled')).toBe(true);
      expect(mockScanBtn.classList.contains('qr-scan-btn--attn')).toBe(false);
      expect(label.textContent).toBe('qr_scan_reading');

      qrScanner.scanDirect();
      expect(clickSpy).not.toHaveBeenCalled();

      qrScanner._setScanningState(false);
      expect(qrScanner._isDecoding).toBe(false);
      expect(mockScanBtn.disabled).toBe(false);
      expect(mockGalleryBtn.disabled).toBe(false);
      expect(mockFileInput.disabled).toBe(false);
      expect(mockGalleryInput.disabled).toBe(false);
      expect(mockScanBtn.hasAttribute('aria-busy')).toBe(false);
      expect(mockScanBtn.classList.contains('qr-scan-btn--loading')).toBe(false);
      expect(mockScanBtn.classList.contains('qr-scan-btn--disabled')).toBe(false);
      expect(label.textContent).toBe('Scan Card QR Code');

      qrScanner._isStrippedWebView = origIsStripped;
    });

    test('_decodeFile sets loading state during BarcodeDetector and resets on completion', async () => {
      const origDetector = window.BarcodeDetector;
      const origCreateImageBitmap = window.createImageBitmap;
      const handleSpy = jest.spyOn(qrScanner, '_handleResult').mockImplementation(() => {});

      let resolveDetect;
      const closeMock = jest.fn();
      window.createImageBitmap = jest.fn(() => Promise.resolve({ width: 800, height: 600, close: closeMock }));
      window.BarcodeDetector = jest.fn().mockImplementation(() => ({
        detect: jest.fn(() => new Promise((resolve) => { resolveDetect = resolve; }))
      }));

      try {
        qrScanner._decodeFile(new Blob(['img'], { type: 'image/png' }));
        expect(qrScanner._isDecoding).toBe(true);
        expect(mockScanBtn.disabled).toBe(true);
        expect(mockGalleryBtn.disabled).toBe(true);

        await Promise.resolve();
        resolveDetect([{ rawValue: '123456' }]);
        await new Promise((r) => setTimeout(r, 0));

        expect(qrScanner._isDecoding).toBe(false);
        expect(mockScanBtn.disabled).toBe(false);
        expect(mockGalleryBtn.disabled).toBe(false);
        expect(handleSpy).toHaveBeenCalledWith('123456');
        expect(closeMock).toHaveBeenCalled();
      } finally {
        handleSpy.mockRestore();
        if (origDetector === undefined) delete window.BarcodeDetector;
        else window.BarcodeDetector = origDetector;
        if (origCreateImageBitmap === undefined) delete window.createImageBitmap;
        else window.createImageBitmap = origCreateImageBitmap;
      }
    });

    test('onPageLoad reveals iOS CNA hint without blocking scanDirect file input', () => {
      const origIsStripped = qrScanner._isStrippedWebView;
      const origIsIosCna = qrScanner._isIosCna;
      qrScanner._isStrippedWebView = () => false;
      qrScanner._isIosCna = () => true;
      const clickSpy = jest.spyOn(mockFileInput, 'click');

      qrScanner.onPageLoad();
      expect(mockWebviewHint.style.display).toBe('block');
      expect(mockHintOr.style.display).toBe('block');
      expect(mockWebviewHint.getAttribute('data-i18n')).toBe('qr_scan_ios_cna_hint');
      expect(mockWebviewHint.textContent).toBe('qr_scan_ios_cna_hint');

      qrScanner.scanDirect();
      expect(clickSpy).toHaveBeenCalled();

      qrScanner._isStrippedWebView = origIsStripped;
      qrScanner._isIosCna = origIsIosCna;
    });

    test('_decodeFile decodes image once and reuses ImageBitmap on BarcodeDetector miss', async () => {
      const origDetector = window.BarcodeDetector;
      const origCreateImageBitmap = window.createImageBitmap;
      const mockBitmap = { width: 800, height: 600, close: jest.fn() };
      window.createImageBitmap = jest.fn(() => Promise.resolve(mockBitmap));
      window.BarcodeDetector = jest.fn().mockImplementation(() => ({
        detect: jest.fn(() => Promise.resolve([]))
      }));
      const jsQrSpy = jest.spyOn(qrScanner, '_decodeWithJsQR').mockImplementation((_f, bmp) => {
        if (bmp && bmp.close) bmp.close();
        qrScanner._setScanningState(false);
      });

      try {
        const file = new Blob(['img'], { type: 'image/png' });
        qrScanner._decodeFile(file);
        await new Promise((r) => setTimeout(r, 10));

        expect(window.createImageBitmap).toHaveBeenCalledTimes(1);
        expect(jsQrSpy).toHaveBeenCalledWith(file, mockBitmap);
      } finally {
        jsQrSpy.mockRestore();
        if (origDetector === undefined) delete window.BarcodeDetector;
        else window.BarcodeDetector = origDetector;
        if (origCreateImageBitmap === undefined) delete window.createImageBitmap;
        else window.createImageBitmap = origCreateImageBitmap;
      }
    });

    test('_decodeFile falls back to _decodeWithJsQR when BarcodeDetector stalls past _NATIVE_TIMEOUT_MS', async () => {
      const origDetector = window.BarcodeDetector;
      const origCreateImageBitmap = window.createImageBitmap;
      const origTimeout = qrScanner._NATIVE_TIMEOUT_MS;
      const mockBitmap = { width: 800, height: 600, close: jest.fn() };
      qrScanner._NATIVE_TIMEOUT_MS = 20;
      window.createImageBitmap = jest.fn(() => Promise.resolve(mockBitmap));
      window.BarcodeDetector = jest.fn().mockImplementation(() => ({
        detect: jest.fn(() => new Promise(() => {}))
      }));
      const jsQrSpy = jest.spyOn(qrScanner, '_decodeWithJsQR').mockImplementation((_f, bmp) => {
        if (bmp && bmp.close) bmp.close();
        qrScanner._setScanningState(false);
      });

      try {
        const file = new Blob(['img'], { type: 'image/png' });
        qrScanner._decodeFile(file);
        await new Promise((r) => setTimeout(r, 60));

        expect(jsQrSpy).toHaveBeenCalledWith(file, mockBitmap);
      } finally {
        qrScanner._NATIVE_TIMEOUT_MS = origTimeout;
        jsQrSpy.mockRestore();
        if (origDetector === undefined) delete window.BarcodeDetector;
        else window.BarcodeDetector = origDetector;
        if (origCreateImageBitmap === undefined) delete window.createImageBitmap;
        else window.createImageBitmap = origCreateImageBitmap;
      }
    });

    test('scanDirect triggers file input click without pre-click script injection', () => {
      const origIsStripped = qrScanner._isStrippedWebView;
      const origDetector = window.BarcodeDetector;
      qrScanner._isStrippedWebView = () => false;
      delete window.BarcodeDetector;
      const clickSpy = jest.spyOn(mockFileInput, 'click');

      try {
        qrScanner.scanDirect();
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(document.getElementById('jsqr-script')).toBeNull();
      } finally {
        qrScanner._isStrippedWebView = origIsStripped;
        if (origDetector !== undefined) window.BarcodeDetector = origDetector;
      }
    });

    test('_decodeWithJsQR stops early after _MIN_CORE_PASSES when _DECODE_BUDGET_MS is exceeded', async () => {
      const origBudget = qrScanner._DECODE_BUDGET_MS;
      const origJsQR = global.jsQR;
      qrScanner._DECODE_BUDGET_MS = 0;
      global.jsQR = jest.fn(() => null);
      const ctxSpy = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        drawImage: jest.fn(),
        getImageData: jest.fn((_x, _y, cw, ch) => ({ data: new Uint8ClampedArray(cw * ch * 4) }))
      });
      const mockBitmap = { width: 4000, height: 3000, close: jest.fn() };

      try {
        qrScanner._decodeWithJsQR(new Blob(['img'], { type: 'image/png' }), mockBitmap);
        for (let i = 0; i < 20 && mockBitmap.close.mock.calls.length === 0; i++) {
          await new Promise((r) => setTimeout(r, 5));
        }

        expect(mockBitmap.close).toHaveBeenCalledTimes(1);
        expect(global.jsQR).toHaveBeenCalledTimes(qrScanner._MIN_CORE_PASSES);
        expect(global.util.showToast).toHaveBeenCalledWith('qr_scan_failed', 'error');
      } finally {
        qrScanner._DECODE_BUDGET_MS = origBudget;
        ctxSpy.mockRestore();
        if (origJsQR === undefined) delete global.jsQR;
        else global.jsQR = origJsQR;
      }
    });
  });
});
