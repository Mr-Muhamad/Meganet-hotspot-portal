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
      // documented RouterOS format is handled by the built-in regex first
      // (preserves the username), the config map applies to other messages
      expect(el.textContent).toBe('لا يُسمح بجلسات إضافية للمستخدم testuser');
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
      expect(el.textContent).toBe('لا يُسمح بجلسات إضافية للمستخدم testuser');
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
  });
});
