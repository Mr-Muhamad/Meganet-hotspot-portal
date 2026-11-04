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
    beforeEach(() => {
      i18n.init();
    });

    test('returns a language code', () => {
      const result = i18n.detectLang();
      expect(['en', 'ar']).toContain(result);
    });

    test('returns Arabic by default', () => {
      const result = i18n.detectLang();
      expect(result).toBe('ar');
    });
  });
});