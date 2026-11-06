/**
 * Internationalization Module - Translation support
 * @module Hotspot.i18n
 */
var i18n = {
  data: null,
  currentLang: 'en',

  init: function() {
    try {
      var dataElement = document.getElementById('i18n-data');
      if (dataElement) {
        i18n.data = JSON.parse(dataElement.textContent);
      }
    } catch (err) {
      console.error('i18n init error:', err);
    }
  },

  /**
   * Translate a key, optionally substituting {placeholder} tokens.
   * @param {string} key - dot path into the dictionary (e.g. 'rate_limit_message')
   * @param {object} [params] - values to interpolate, e.g. { n: 10 }
   * @returns {string} translation, or the key itself when missing
   */
  t: function(key, params) {
    try {
      if (!i18n.data || !i18n.data[i18n.currentLang]) {
        return key;
      }

      var keys = key.split('.');
      var result = i18n.data[i18n.currentLang];

      for (var i = 0; i < keys.length; i++) {
        if (result && result[keys[i]] !== undefined) {
          result = result[keys[i]];
        } else {
          return key;
        }
      }

      if (typeof result === 'string' && params) {
        Object.keys(params).forEach(function(name) {
          result = result.split('{' + name + '}').join(String(params[name]));
        });
      }

      return result;
    } catch (err) {
      console.error('i18n translation error:', err);
      return key;
    }
  },

  setLang: function(lang) {
    try {
      i18n.currentLang = lang;
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      i18n.apply();
    } catch (err) {
      console.error('i18n setLang error:', err);
    }
  },

  apply: function() {
    try {
      var elements = document.querySelectorAll('[data-i18n]');
      elements.forEach(function(element) {
        var key = element.getAttribute('data-i18n');
        var translation = i18n.t(key);
        if (translation !== key) {
          element.textContent = translation;
        }
      });

      var placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
      placeholderElements.forEach(function(element) {
        var key = element.getAttribute('data-i18n-placeholder');
        var translation = i18n.t(key);
        if (translation !== key) {
          element.placeholder = translation;
        }
      });

      var ariaElements = document.querySelectorAll('[data-i18n-aria]');
      ariaElements.forEach(function(element) {
        var key = element.getAttribute('data-i18n-aria');
        var translation = i18n.t(key);
        if (translation !== key) {
          element.setAttribute('aria-label', translation);
        }
      });
    } catch (err) {
      console.error('i18n apply error:', err);
    }
  },

  detectLang: function() {
    try {
      var savedLang = util.getCookie('hotspot_lang');
      if (savedLang) return savedLang;

      var browserLang = navigator.language.split('-')[0];
      if (i18n.data && i18n.data[browserLang]) {
        return browserLang;
      }

      return 'ar';
    } catch (err) {
      console.error('i18n detectLang error:', err);
      return 'ar';
    }
  }
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = i18n;
}