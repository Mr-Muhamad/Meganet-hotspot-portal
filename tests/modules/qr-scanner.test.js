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
    test('a URL payload routes as a link card, untouched', () => {
      expect(qrScanner.routeScan('http://10.5.50.1/login?username=a&password=b')).toEqual({
        action: 'navigate',
        url: 'http://10.5.50.1/login?username=a&password=b'
      });
    });

    test('an HTTPS link card also routes as a link', () => {
      const r = qrScanner.routeScan('https://hotspot.example.net/login?voucher=1');
      expect(r.action).toBe('navigate');
      expect(r.url).toBe('https://hotspot.example.net/login?voucher=1');
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

    test('an empty payload routes as an empty code (handled as a failure)', () => {
      expect(qrScanner.routeScan('')).toEqual({ action: 'autologin', code: '' });
      expect(qrScanner.routeScan(null).code).toBe('');
    });
  });
});
