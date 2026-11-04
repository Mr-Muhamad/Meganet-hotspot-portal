/**
 * Tests for Hotspot.ui module
 */

const ui = require('../../src/js/modules/ui.js');

describe('Hotspot.ui', () => {
  describe('mapRouterErrorToArabic', () => {
    test('translates no more sessions are allowed error correctly', () => {
      const errorMsg = 'no more sessions are allowed for user testuser';
      const translation = ui.mapRouterErrorToArabic(errorMsg);
      expect(translation).toBe('عذراً، لقد تم الوصول للحد الأقصى من الجلسات المفتوحة لهذا المستخدم.');
    });

    test('returns original error if no match found', () => {
      const errorMsg = 'some unknown error message';
      const translation = ui.mapRouterErrorToArabic(errorMsg);
      expect(translation).toBe(errorMsg);
    });
  });
});
