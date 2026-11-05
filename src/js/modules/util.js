/**
 * Utility Module - Common utility functions
 * @module Hotspot.util
 */
var util = {
  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHtml: function(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  formatBytes: function(bytes) {
    var lang = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('lang')) || 'en';
    var isAr = lang === 'ar';
    var sizesEn = ['B', 'KB', 'MB', 'GB', 'TB'];
    var sizesAr = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت', 'تيرابايت'];
    var sizes = isAr ? sizesAr : sizesEn;

    if (bytes === 0) return '0 ' + sizes[0];
    if (!bytes || bytes < 0 || isNaN(bytes)) return 'NaN';
    
    // Read dynamic kbBase from active sessionCountdownSection if available
    var k = 1024;
    if (typeof document !== 'undefined') {
      var quotaEl = document.getElementById('sessionCountdownSection');
      if (quotaEl) {
        var customBase = parseInt(quotaEl.getAttribute('data-kb-base'));
        if (customBase === 1000 || customBase === 1024) {
          k = customBase;
        }
      }
    }
    
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i < 0) i = 0;
    if (i >= sizes.length) i = sizes.length - 1;
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Format time duration
   * @param {number} seconds - Seconds to format
   * @returns {string} Formatted time string
   */
  formatTime: function(seconds) {
    if (!seconds || seconds < 0) return '00:00:00';
    seconds = Math.floor(seconds);
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    return [
      h.toString().padStart(2, '0'),
      m.toString().padStart(2, '0'),
      s.toString().padStart(2, '0')
    ].join(':');
  },

  /**
   * Format uptime to human readable format
   * @param {number} seconds - Uptime in seconds
   * @returns {string} Formatted uptime string
   */
  formatUptime: function(seconds) {
    if (!seconds || seconds < 0) return '0s';
    seconds = Math.floor(seconds);
    var w = Math.floor(seconds / 604800);
    var d = Math.floor((seconds % 604800) / 86400);
    var h = Math.floor((seconds % 86400) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    var parts = [];
    if (w > 0) parts.push(w + 'w');
    if (d > 0) parts.push(d + 'd');
    if (h > 0) parts.push(h + 'h');
    if (m > 0) parts.push(m + 'm');
    if (s > 0 || parts.length === 0) parts.push(s + 's');
    return parts.join(' ');
  },

  /**
   * Parse uptime string to seconds
   * @param {string} str - Uptime string (e.g., "1w2d3h4m5s")
   * @returns {number} Seconds
   */
  parseUptimeToSeconds: function(str) {
    if (!str) return 0;
    var total = 0;
    var matches = str.match(/(\d+)\s*([wdhms])/g);
    if (matches) {
      matches.forEach(function(match) {
        var val = parseInt(match);
        var unit = match.slice(-1);
        switch (unit) {
          case 'w': total += val * 604800; break;
          case 'd': total += val * 86400; break;
          case 'h': total += val * 3600; break;
          case 'm': total += val * 60; break;
          case 's': total += val; break;
        }
      });
    }
    return total;
  },

  /**
   * Get cookie value by name
   * @param {string} name - Cookie name
   * @returns {string|null} Cookie value
   */
  getCookie: function(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  },

  /**
   * Set cookie with expiration
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {number} days - Days until expiration
   */
  setCookie: function(name, value, days) {
    var expires = '';
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
  },

  /**
   * Show toast notification
   * @param {string} message - Message to display
   * @param {string} type - Toast type (success, error, warning)
   * @param {number} duration - Display duration in milliseconds
   */
  showToast: function(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;

    var existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(function() {
      toast.style.animation = 'toast-out 0.3s ease forwards';
      setTimeout(function() {
        toast.remove();
      }, 300);
    }, duration);
  },

  /**
   * Translate a hotspot error message to the page language.
   *
   * RADIUS/User Manager rejects arrive as raw English Reply-Message text via
   * $(error-orig) — errors.txt can only wrap them, not translate dynamic
   * content. This performs the actual translation:
   *   1. documented RouterOS formats with a username (regex, full grammar)
   *   2. configurable substring map (longest key first, replaces fragment only)
   * Unknown messages pass through unchanged (safe fallback).
   *
   * @param {string} text - The raw error message (from $(error-orig)/$(error))
   * @param {Object} map - { englishFragment: arabicTranslation } map
   * @param {string} [lang] - Override language (defaults to <html lang>)
   * @returns {string} Translated message, or original when not matching/English
   */
  translateError: function(text, map, lang) {
    if (!text || typeof text !== 'string') return text;
    if (!lang) {
      lang = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('lang')) || 'en';
    }
    if (lang !== 'ar' || !map || typeof map !== 'object') return text;

    // 1. Documented RouterOS error formats carrying a username
    var patterns = [
      [/user\s+([^\s]+)\s+has reached uptime limit/i, 'المستخدم $1 وصل إلى حد وقت الاستخدام'],
      [/user\s+([^\s]+)\s+has reached traffic limit/i, 'المستخدم $1 وصل إلى حد البيانات'],
      [/no more sessions are allowed for user\s+([^\s]+)/i, 'لا يُسمح بجلسات إضافية للمستخدم $1'],
      [/user\s+([^\s]+)\s+is not allowed to log in from this MAC address/i, 'المستخدم $1 غير مسموح بتسجيل الدخول من عنوان MAC هذا'],
      [/you are not logged in \(ip\s+([^)]+)\)/i, 'أنت غير مسجل الدخول (IP: $1)'],
      [/session limit reached \(([^)]+)\)/i, 'تم الوصول إلى حد الجلسات ($1)'],
      [/internal error \(([^)]+)\)/i, 'خطأ داخلي ($1)'],
      [/configuration error \(([^)]+)\)/i, 'خطأ في الإعدادات ($1)'],
      [/web browser did not send challenge response \(([^)]+)\)/i, 'المتصفح لم يرسل استجابة التشفير ($1)']
    ];
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i][0].test(text)) {
        return text.replace(patterns[i][0], patterns[i][1]);
      }
    }

    // 2. Configurable substring map — longest keys first so specific phrases
    //    win over generic ones; only the matched fragment is replaced, so
    //    dynamic values (usernames, IPs) survive.
    var keys = Object.keys(map)
      .filter(function(k) { return k.charAt(0) !== '_' && map[k]; })
      .sort(function(a, b) { return b.length - a.length; });
    var lower = text.toLowerCase();
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      if (lower.indexOf(key.toLowerCase()) !== -1) {
        var idx = lower.indexOf(key.toLowerCase());
        return text.slice(0, idx) + map[key] + text.slice(idx + key.length);
      }
    }

    return text;
  },

  /**
   * Safe redirect with countdown
   * @param {string} url - URL to redirect to
   * @param {number} seconds - Seconds until redirect
   * @param {string} elementId - Countdown element ID
   */
  safeRedirect: function(url, seconds, elementId) {
    if (!url) return;
    seconds = seconds || 5;
    var remaining = seconds;
    var element = document.getElementById(elementId);

    var interval = setInterval(function() {
      remaining--;
      if (element) {
        element.textContent = remaining;
      }
      if (remaining <= 0) {
        clearInterval(interval);
        window.location.href = url;
      }
    }, 1000);
  }
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = util;
}