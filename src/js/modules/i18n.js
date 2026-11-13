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

  isSupportedLang: function(lang) {
    if (!lang || typeof lang !== 'string') return false;
    if (lang === 'en' || lang === 'ar') return true;
    if (i18n.data && typeof i18n.data === 'object') {
      return Object.prototype.hasOwnProperty.call(i18n.data, lang);
    }
    return false;
  },

  updateTitle: function() {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    var titleEl = document.querySelector('title[data-i18n-title]');
    var key = titleEl ? titleEl.getAttribute('data-i18n-title') : '';
    var networkName = titleEl ? (titleEl.getAttribute('data-network-name') || '') : '';
    if (!key && document.body && typeof document.body.getAttribute === 'function') {
      var page = document.body.getAttribute('data-page');
      if (page) key = page + '_title';
      networkName = document.body.getAttribute('data-network-name') || networkName;
    }
    if (!key) return;
    var translated = i18n.t(key);
    if (translated && translated !== key) {
      document.title = networkName ? (networkName + ' - ' + translated) : translated;
    }
  },

  setLang: function(lang) {
    try {
      if (!i18n.isSupportedLang(lang)) return false;
      i18n.currentLang = lang;
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      i18n.apply();
      i18n.updateTitle();
      return true;
    } catch (err) {
      console.error('i18n setLang error:', err);
      return false;
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

      var titleElements = document.querySelectorAll('[data-i18n-title]');
      titleElements.forEach(function(element) {
        if (element.tagName && element.tagName.toUpperCase() === 'TITLE') return;
        var key = element.getAttribute('data-i18n-title');
        var translation = i18n.t(key);
        if (translation !== key) {
          element.setAttribute('title', translation);
        }
      });
      i18n.updateTitle();
    } catch (err) {
      console.error('i18n apply error:', err);
    }
  },

  detectLang: function() {
    try {
      var savedLang = util.getCookie('hotspot_lang');
      if (savedLang && i18n.isSupportedLang(savedLang)) return savedLang;

      if (
        typeof window !== 'undefined' &&
        window.location &&
        typeof window.location.pathname === 'string' &&
        /(?:^|\/)ar(?:\/|$)/.test(window.location.pathname) &&
        i18n.isSupportedLang('ar')
      ) {
        return 'ar';
      }

      var browserLang = navigator.language.split('-')[0];
      if (i18n.isSupportedLang(browserLang)) {
        return browserLang;
      }

      if (i18n.isSupportedLang('ar')) return 'ar';
      if (i18n.isSupportedLang('en')) return 'en';
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