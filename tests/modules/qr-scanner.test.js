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
    test('a URL payload with username/password routes as navigate', () => {
      expect(qrScanner.routeScan('http://10.5.50.1/login?username=a&password=b')).toEqual({
        action: 'navigate',
        url: 'http://10.5.50.1/login?username=a&password=b'
      });
    });

    test('a voucher link payload on private hotspot IP routes directly as autologin', () => {
      expect(qrScanner.routeScan('http://10.5.50.1/login?voucher=123456')).toEqual({
        action: 'autologin',
        code: '123456'
      });
    });

    test('an HTTPS link card with login path also routes safely', () => {
      const r = qrScanner.routeScan('https://hotspot.example.net/login?voucher=12345');
      expect(r.action).toBe('navigate');
      expect(r.url).toBe('https://hotspot.example.net/login?voucher=12345');
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

    test('an empty payload routes as an empty code (handled as a failure)', () => {
      expect(qrScanner.routeScan('')).toEqual({ action: 'autologin', code: '' });
      expect(qrScanner.routeScan(null).code).toBe('');
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
});
