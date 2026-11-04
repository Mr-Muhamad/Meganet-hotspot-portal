/**
 * Tests for Hotspot.util module
 */

// Load the module
const util = require('../../src/js/modules/util.js');

describe('Hotspot.util', () => {
  describe('escapeHtml', () => {
    test('escapes HTML special characters', () => {
      expect(util.escapeHtml('<script>alert("xss")</script>'))
        .toContain('&lt;script&gt;');
    });

    test('escapes ampersand', () => {
      expect(util.escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    test('handles null and undefined', () => {
      expect(util.escapeHtml(null)).toBe('');
      expect(util.escapeHtml(undefined)).toBe('');
      expect(util.escapeHtml('')).toBe('');
    });

    test('handles normal text', () => {
      expect(util.escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('formatBytes', () => {
    afterEach(() => {
      document.documentElement.removeAttribute('lang');
    });

    test('formats zero bytes in English', () => {
      document.documentElement.setAttribute('lang', 'en');
      expect(util.formatBytes(0)).toBe('0 B');
    });

    test('formats zero bytes in Arabic', () => {
      document.documentElement.setAttribute('lang', 'ar');
      expect(util.formatBytes(0)).toBe('0 بايت');
    });

    test('formats bytes correctly in English', () => {
      document.documentElement.setAttribute('lang', 'en');
      expect(util.formatBytes(1024)).toBe('1 KB');
      expect(util.formatBytes(1048576)).toBe('1 MB');
      expect(util.formatBytes(1073741824)).toBe('1 GB');
    });

    test('formats bytes correctly in Arabic', () => {
      document.documentElement.setAttribute('lang', 'ar');
      expect(util.formatBytes(1024)).toBe('1 كيلوبايت');
      expect(util.formatBytes(1048576)).toBe('1 ميجابايت');
      expect(util.formatBytes(1073741824)).toBe('1 جيجابايت');
    });

    test('formats with decimals in Arabic', () => {
      document.documentElement.setAttribute('lang', 'ar');
      expect(util.formatBytes(1536)).toBe('1.5 كيلوبايت');
      expect(util.formatBytes(2621440)).toBe('2.5 ميجابايت');
    });

    test('handles negative values', () => {
      expect(util.formatBytes(-1024)).toContain('NaN');
    });
  });

  describe('formatTime', () => {
    test('formats zero seconds', () => {
      expect(util.formatTime(0)).toBe('00:00:00');
    });

    test('formats seconds correctly', () => {
      expect(util.formatTime(61)).toBe('00:01:01');
      expect(util.formatTime(3661)).toBe('01:01:01');
    });

    test('handles negative values', () => {
      expect(util.formatTime(-1)).toBe('00:00:00');
    });

    test('handles undefined', () => {
      expect(util.formatTime(undefined)).toBe('00:00:00');
    });
  });

  describe('formatUptime', () => {
    test('formats zero seconds', () => {
      expect(util.formatUptime(0)).toBe('0s');
    });

    test('formats seconds', () => {
      expect(util.formatUptime(30)).toBe('30s');
    });

    test('formats minutes and seconds', () => {
      expect(util.formatUptime(90)).toBe('1m 30s');
    });

    test('formats hours, minutes and seconds', () => {
      expect(util.formatUptime(3661)).toBe('1h 1m 1s');
    });

    test('formats days', () => {
      expect(util.formatUptime(90000)).toContain('1d');
    });
  });

  describe('parseUptimeToSeconds', () => {
    test('parses empty string', () => {
      expect(util.parseUptimeToSeconds('')).toBe(0);
    });

    test('parses null', () => {
      expect(util.parseUptimeToSeconds(null)).toBe(0);
    });

    test('parses seconds only', () => {
      expect(util.parseUptimeToSeconds('30s')).toBe(30);
    });

    test('parses minutes and seconds', () => {
      expect(util.parseUptimeToSeconds('1m30s')).toBe(90);
    });

    test('parses hours, minutes and seconds', () => {
      expect(util.parseUptimeToSeconds('1h1m1s')).toBe(3661);
    });

    test('parses days', () => {
      expect(util.parseUptimeToSeconds('1d')).toBe(86400);
    });

    test('parses weeks', () => {
      expect(util.parseUptimeToSeconds('1w')).toBe(604800);
    });
  });

  describe('getCookie', () => {
    beforeEach(() => {
      document.cookie = 'test_cookie=test_value; path=/';
    });

    test('gets existing cookie', () => {
      expect(util.getCookie('test_cookie')).toBe('test_value');
    });

    test('returns null for non-existing cookie', () => {
      expect(util.getCookie('non_existing')).toBeNull();
    });
  });

  describe('setCookie', () => {
    test('sets cookie with expiration', () => {
      util.setCookie('new_cookie', 'new_value', 30);
      expect(document.cookie).toContain('new_cookie=new_value');
    });
  });
});