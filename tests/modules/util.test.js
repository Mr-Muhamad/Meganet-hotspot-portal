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

    test('formats bytes correctly in English (default decimal base 1000)', () => {
      document.documentElement.setAttribute('lang', 'en');
      expect(util.formatBytes(1000)).toBe('1 KB');
      expect(util.formatBytes(1000000)).toBe('1 MB');
      expect(util.formatBytes(1000000000)).toBe('1 GB');
    });

    test('formats bytes correctly in Arabic (default decimal base 1000)', () => {
      document.documentElement.setAttribute('lang', 'ar');
      expect(util.formatBytes(1000)).toBe('1 كيلوبايت');
      expect(util.formatBytes(1000000)).toBe('1 ميجابايت');
      expect(util.formatBytes(1000000000)).toBe('1 جيجابايت');
    });

    test('formats with decimals in Arabic', () => {
      document.documentElement.setAttribute('lang', 'ar');
      expect(util.formatBytes(1500)).toBe('1.5 كيلوبايت');
      expect(util.formatBytes(2500000)).toBe('2.5 ميجابايت');
    });

    test('handles negative values', () => {
      expect(util.formatBytes(-1000)).toContain('NaN');
    });

    test('reads explicit data-kb-base="1024" from [data-kb-base] element', () => {
      document.documentElement.setAttribute('lang', 'en');
      document.body.innerHTML = '<div class="status-grid" data-kb-base="1024"></div>';
      expect(util.formatBytes(1024)).toBe('1 KB');
      expect(util.formatBytes(1048576)).toBe('1 MB');
      document.body.innerHTML = '';
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

  describe('translateError', () => {
    const map = {
      'invalid username or password': 'اسم المستخدم أو كلمة المرور غير صحيح',
      'uptime limit': 'حد وقت الاستخدام',
      'no more sessions': 'لا يُسمح بجلسات إضافية'
    };

    afterEach(() => {
      document.documentElement.removeAttribute('lang');
    });

    test('passes through on English pages', () => {
      document.documentElement.setAttribute('lang', 'en');
      expect(util.translateError('uptime limit reached', map, 'en')).toBe('uptime limit reached');
    });

    test('defaults to document lang when no override', () => {
      document.documentElement.setAttribute('lang', 'en');
      expect(util.translateError('uptime limit reached', map)).toBe('uptime limit reached');
      document.documentElement.setAttribute('lang', 'ar');
      expect(util.translateError('uptime limit reached', map)).not.toBe('uptime limit reached');
    });

    test('translates exact match in Arabic (whole-message replacement)', () => {
      expect(util.translateError('invalid username or password', map, 'ar'))
        .toBe('اسم المستخدم أو كلمة المرور غير صحيح');
    });

    test('replaces whole message on partial match (no mixed-language output)', () => {
      expect(util.translateError('server says: uptime limit for now', map, 'ar'))
        .toBe('حد وقت الاستخدام');
    });

    test('translates documented RouterOS uptime-limit format cleanly without exposing username', () => {
      const result = util.translateError('user alice has reached uptime limit', map, 'ar');
      expect(result).toBe('انتهى الوقت المتاح.');
      expect(result).not.toContain('alice');
    });

    test('translates documented RouterOS session-limit format cleanly without exposing username', () => {
      const result = util.translateError('no more sessions are allowed for user bob', map, 'ar');
      expect(result).toBe('لا يمكن استخدام الكارت على أكثر من جهاز في نفس الوقت.');
      expect(result).not.toContain('bob');
    });

    test('translates documented MAC-address format cleanly without exposing username', () => {
      const result = util.translateError('user eve is not allowed to log in from this MAC address', map, 'ar');
      expect(result).toBe('هذا الكارت مرتبط بجهاز آخر، أو أن ميزة العنوان العشوائي (MAC العشوائي) مفعّلة في الواي فاي.');
      expect(result).not.toContain('eve');
    });

    test('translates "you are not logged in" cleanly without exposing IP', () => {
      const result = util.translateError('you are not logged in (ip 10.0.0.5)', map, 'ar');
      expect(result).toBe('يرجى تسجيل الدخول أولاً لفتح هذه الصفحة.');
      expect(result).not.toContain('10.0.0.5');
    });

    test('returns original for unknown messages (safe fallback)', () => {
      expect(util.translateError('some unknown radius reply', map, 'ar'))
        .toBe('some unknown radius reply');
    });

    test('matches case-insensitively', () => {
      expect(util.translateError('Invalid Username or Password', map, 'ar'))
        .toBe('اسم المستخدم أو كلمة المرور غير صحيح');
    });

    test('longest key wins over generic keys', () => {
      const nestedMap = {
        'limit': 'حد',
        'credit limit': 'حد الرصيد',
        'credit limit reached for plan': 'انتهى الرصيد المحدد لهذه الباقة.'
      };
      expect(util.translateError('credit limit reached for plan gold', nestedMap, 'ar'))
        .toBe('انتهى الرصيد المحدد لهذه الباقة.');
    });

    test('ignores _-prefixed comment keys', () => {
      const commentMap = { '_comment': 'should be ignored', 'uptime limit': 'حد وقت الاستخدام' };
      expect(util.translateError('uptime limit', commentMap, 'ar')).toBe('حد وقت الاستخدام');
    });

    test('handles empty map and empty text', () => {
      expect(util.translateError('uptime limit', {}, 'ar')).toBe('uptime limit');
      expect(util.translateError('', map, 'ar')).toBe('');
      expect(util.translateError(null, map, 'ar')).toBeNull();
    });

    test('cleans URL-encoded errors: "+" for spaces', () => {
      expect(util.translateError('invalid+username+or+password', map, 'ar'))
        .toBe('اسم المستخدم أو كلمة المرور غير صحيح');
      expect(util.translateError('invalid+username', map, 'en'))
        .toBe('invalid username');
    });

    test('cleans URL-encoded errors: percent-decoding', () => {
      expect(util.translateError('uptime%20limit%20reached', map, 'ar'))
        .toBe('حد وقت الاستخدام');
    });

    test('cleans malformed percent sequences (%FFF corruption)', () => {
      expect(util.translateError('invalid username or password%FFF', map, 'ar'))
        .toBe('اسم المستخدم أو كلمة المرور غير صحيح');
    });

    test('collapses repeated slashes while preserving single slashes and URL schemes', () => {
      expect(util.translateError('uptime limit///reached', map, 'ar'))
        .toBe('حد وقت الاستخدام');
      expect(util.translateError('quota 5/10 GB or path /login.html', map, 'en'))
        .toBe('quota 5/10 GB or path /login.html');
      expect(util.translateError('see http://portal.local/help///now', map, 'en'))
        .toBe('see http://portal.local/help now');
    });

    // Real RADIUS / User Manager reply messages observed on RouterOS v6 in
    // production. Runs against the shipped config.json translation map so a
    // regression shows up here, not on a customer's login screen.
    describe('production RouterOS v6 / User Manager replies', () => {
      const configMap = require('../../config.json').radiusErrorTranslations;

      test.each([
        ['invalid Calling-Station-Id'],
        ['user <270029> not found'],
        ['no valid profile found'],
        ['transfer limit reached'],
        ['traffic limit reached'],
        ['your traffic limit is reached'],
        ['simultaneous session limit reached'],
        ['no more sessions are allowed for user']
      ])('translates %s', (message) => {
        const result = util.translateError(message, configMap, 'ar');
        expect(result).not.toBe(message);
        expect(result).toMatch(/[\u0600-\u06FF]/); // Arabic output
      });

      test('user <270029> not found hides card/username and strips server prefix', () => {
        expect(util.translateError('user <270029> not found', configMap, 'ar'))
          .toBe('هذا الكارت غير موجود أو تم إيقافه؛ تأكد من الأرقام.');
        expect(util.translateError('رسالة من خادم المصادقة: user <270029> not found', configMap, 'ar'))
          .toBe('هذا الكارت غير موجود أو تم إيقافه؛ تأكد من الأرقام.');
      });

      test('your traffic limit is reached gets the full message, not the short key', () => {
        expect(util.translateError('your traffic limit is reached', configMap, 'ar'))
          .toBe(util.translateError('traffic limit reached', configMap, 'ar'));
      });

      test('covers extended RADIUS phrases cleanly in Arabic', () => {
        expect(util.translateError('voucher expired', configMap, 'ar')).toContain('انتهت مدة صلاحية الكارت');
        expect(util.translateError('quota exceeded', configMap, 'ar')).toContain('انتهى الرصيد');
        expect(util.translateError('unknown user profile', configMap, 'ar')).toContain('الدعم الفني');
      });
    });
  });

  describe('recordVoucherHistory', () => {
    const clearHistoryState = () => {
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      util.setCookie('hotspot_voucher_history', '', -1);
      util.setCookie('hotspot_mode', '', -1);
    };

    beforeEach(clearHistoryState);
    afterEach(clearHistoryState);

    test('deduplicates and caps stored vouchers at 3 across storage and cookie', () => {
      ['1111', '2222', '3333', '4444', '2222'].forEach((c) => {
        expect(util.recordVoucherHistory(c)).toBe(true);
      });

      const expected = ['2222', '4444', '3333'];
      expect(JSON.parse(sessionStorage.getItem('hotspot_voucher_history'))).toEqual(expected);
      expect(JSON.parse(localStorage.getItem('hotspot_voucher_history'))).toEqual(expected);
      expect(JSON.parse(util.getCookie('hotspot_voucher_history'))).toEqual(expected);
    });

    test('ignores empty values, un-substituted tags, MAC addresses, and trial T-<MAC> names', () => {
      ['', '   ', '$(username-esc)', 'AA:BB:CC:DD:EE:FF', 'aa-bb-cc-dd-ee-ff', 'T-AA:BB:CC:DD:EE:FF'].forEach((bad) => {
        expect(util.recordVoucherHistory(bad)).toBe(false);
      });
      expect(localStorage.getItem('hotspot_voucher_history')).toBeNull();
      expect(util.getCookie('hotspot_voucher_history')).toBeNull();
    });

    test('skips recording when hotspot_mode is normal (account login)', () => {
      localStorage.setItem('hotspot_mode', 'normal');
      expect(util.recordVoucherHistory('alice_user')).toBe(false);
      expect(localStorage.getItem('hotspot_voucher_history')).toBeNull();
    });
  });
});
