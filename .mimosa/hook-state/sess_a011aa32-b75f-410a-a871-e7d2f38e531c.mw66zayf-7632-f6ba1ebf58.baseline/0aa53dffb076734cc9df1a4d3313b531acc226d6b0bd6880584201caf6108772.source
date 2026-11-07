/**
 * Tests for Hotspot.i18n module
 */

const i18n = require('../../src/js/modules/i18n.js');
const util = require('../../src/js/modules/util.js');

describe('Hotspot.i18n', () => {
  beforeEach(() => {
    // Reset i18n state
    i18n.data = null;
    i18n.currentLang = 'en';

    // Mock document methods
    document.getElementById = jest.fn().mockReturnValue({
      textContent: JSON.stringify({
        en: {
          welcome: 'Welcome',
          login_title: 'Sign In',
          nested: {
            key: 'Nested Value'
          }
        },
        ar: {
          welcome: 'مرحباً',
          login_title: 'تسجيل الدخول'
        }
      })
    });

    document.querySelectorAll = jest.fn().mockReturnValue([]);
    document.documentElement = {
      setAttribute: jest.fn(),
      getAttribute: jest.fn().mockReturnValue('en')
    };
  });

  describe('init', () => {
    test('initializes with i18n data', () => {
      i18n.init();
      expect(i18n.data).toBeDefined();
      expect(i18n.data.en.welcome).toBe('Welcome');
    });

    test('handles missing i18n data element', () => {
      document.getElementById = jest.fn().mockReturnValue(null);
      i18n.init();
      expect(i18n.data).toBeNull();
    });
  });

  describe('t', () => {
    beforeEach(() => {
      i18n.init();
    });

    test('returns translation for existing key', () => {
      expect(i18n.t('welcome')).toBe('Welcome');
    });

    test('returns translation for nested key', () => {
      expect(i18n.t('nested.key')).toBe('Nested Value');
    });

    test('returns key for non-existing translation', () => {
      expect(i18n.t('non_existing')).toBe('non_existing');
    });

    test('returns key when data is not loaded', () => {
      i18n.data = null;
      expect(i18n.t('welcome')).toBe('welcome');
    });

    test('substitutes {placeholder} tokens from the params object', () => {
      // Re-mock the element with a string carrying placeholders.
      document.getElementById = jest.fn().mockReturnValue({
        textContent: JSON.stringify({ en: { countdown: 'Redirecting in {n} seconds' } })
      });
      i18n.init();
      expect(i18n.t('countdown', { n: 5 })).toBe('Redirecting in 5 seconds');
    });

    test('substitutes multiple tokens', () => {
      document.getElementById = jest.fn().mockReturnValue({
        textContent: JSON.stringify({ en: { pair: '{a} and {b}' } })
      });
      i18n.init();
      expect(i18n.t('pair', { a: '1 minute', b: '30 seconds' })).toBe('1 minute and 30 seconds');
    });

    test('leaves unmatched placeholders alone', () => {
      document.getElementById = jest.fn().mockReturnValue({
        textContent: JSON.stringify({ en: { partial: '{n} codes left in {queue}' } })
      });
      i18n.init();
      expect(i18n.t('partial', { n: 3 })).toBe('3 codes left in {queue}');
    });
  });

  describe('setLang', () => {
    beforeEach(() => {
      i18n.init();
    });

    test('sets language to Arabic', () => {
      i18n.setLang('ar');
      expect(i18n.currentLang).toBe('ar');
    });

    test('sets language to English', () => {
      i18n.setLang('en');
      expect(i18n.currentLang).toBe('en');
    });
  });

  describe('detectLang', () => {
    const withBrowserLanguage = (lang) => {
      Object.defineProperty(window.navigator, 'language', { get: () => lang, configurable: true });
    };

    beforeEach(() => {
      // auth.js / ui.js resolve `util` as a free global at runtime — define it
      // so detectLang reaches the browser-language branch instead of its catch.
      global.util = util;
      i18n.init();
    });

    afterEach(() => {
      delete global.util;
    });

    test('returns a language code', () => {
      const result = i18n.detectLang();
      expect(['en', 'ar']).toContain(result);
    });

    test('follows a supported browser language', () => {
      withBrowserLanguage('en-US');
      expect(i18n.detectLang()).toBe('en');
    });

    test('falls back to Arabic for an unsupported browser language', () => {
      withBrowserLanguage('fr-FR');
      expect(i18n.detectLang()).toBe('ar');
    });

    test('a saved cookie wins over the browser language', () => {
      withBrowserLanguage('en-US');
      document.cookie = 'hotspot_lang=ar; path=/';
      expect(i18n.detectLang()).toBe('ar');
    });

    test('falls back to Arabic when navigator access throws', () => {
      Object.defineProperty(window.navigator, 'language', {
        get() { throw new Error('mocked'); },
        configurable: true
      });
      expect(i18n.detectLang()).toBe('ar');
    });
  });
});