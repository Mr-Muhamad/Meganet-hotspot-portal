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
    
    // Read dynamic kbBase from active sessionCountdownSection or any element with data-kb-base
    var k = 1000;
    if (typeof document !== 'undefined') {
      var quotaEl = document.getElementById('sessionCountdownSection') || document.querySelector('[data-kb-base]');
      if (quotaEl) {
        var customBase = parseInt(quotaEl.getAttribute('data-kb-base'), 10);
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
    var lang = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('lang')) || 'en';
    var isAr = lang === 'ar';
    if (!seconds || seconds < 0) return isAr ? '0 ث' : '0s';
    seconds = Math.floor(seconds);
    var w = Math.floor(seconds / 604800);
    var d = Math.floor((seconds % 604800) / 86400);
    var h = Math.floor((seconds % 86400) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    var parts = [];
    if (w > 0) parts.push(w + (isAr ? ' أسبوع' : 'w'));
    if (d > 0) parts.push(d + (isAr ? ' يوم' : 'd'));
    if (h > 0) parts.push(h + (isAr ? ' س' : 'h'));
    if (m > 0) parts.push(m + (isAr ? ' د' : 'm'));
    if (s > 0 || parts.length === 0) parts.push(s + (isAr ? ' ث' : 's'));
    return parts.join(' ');
  },

  /**
   * Get cookie value by name
   * @param {string} name - Cookie name
   * @returns {string|null} Cookie value
   */
  getCookie: function(name) {
    if (!name) return null;
    var escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var match = document.cookie.match(new RegExp('(?:^|;\\s*)' + escaped + '=([^;]*)'));
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch (e) {
      return match[1];
    }
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
   *   0. clean up URL-encoded error strings (RouterOS passes them via GET)
   *   1. documented RouterOS formats with a username (regex, full grammar)
   *   2. configurable keyword map (longest key first, whole-message replace —
   *      avoids mixed-language output for partially-matching messages)
   * Unknown messages pass through cleaned but unchanged (safe fallback).
   *
   * @param {string} text - The raw error message (from $(error-orig)/$(error))
   * @param {Object} map - { englishKeyword: arabicTranslation } map
   * @param {string} [lang] - Override language (defaults to <html lang>)
   * @returns {string} Translated message, or cleaned original when not matching
   */
  translateError: function(text, map, lang) {
    if (!text || typeof text !== 'string') return text;
    if (!lang) {
      lang = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('lang')) || 'en';
    }

    // 0. Clean URL-encoded artifacts (RouterOS passes errors via GET:
    // '+' for spaces, percent-encoding, and occasional '%FFF' corruption)
    var cleaned = text.replace(/\+/g, ' ');
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch (e) {
      cleaned = cleaned.replace(/%2[fF]/g, '/')
                       .replace(/%20/g, ' ')
                       .replace(/%[a-zA-Z0-9]{2,}/g, '');
    }
    cleaned = cleaned.replace(/(?:\s*[/%]*[fF]{3,}[%]*)+/g, '')
                     .replace(/(^|[^:])\s*\/{2,}[\s/]*/g, '$1 ')
                     .replace(/\s+/g, ' ')
                     .trim();

    if (lang !== 'ar' || !map || typeof map !== 'object') return cleaned;

    // 1. Documented RouterOS error formats (generalized without exposing card numbers, usernames, or IPs)
    var patterns = [
      [/user\s+[^\s]+\s+has reached uptime limit/i, 'انتهى الوقت المتاح.'],
      [/user\s+[^\s]+\s+has reached traffic limit/i, 'انتهى الرصيد المتاح.'],
      [/no more sessions are allowed for user\s+[^\s]+/i, 'لا يمكن استخدام الكارت على أكثر من جهاز في نفس الوقت.'],
      [/user\s+[^\s]+\s+is not allowed to log in from this MAC address/i, 'هذا الكارت مرتبط بجهاز آخر، أو أن ميزة العنوان العشوائي (MAC العشوائي) مفعّلة في الواي فاي.'],
      [/user\s+<[^>]+>\s+not found/i, 'هذا الكارت غير موجود أو تم إيقافه؛ تأكد من الأرقام.'],
      [/you are not logged in \(ip\s+[^)]+\)/i, 'يرجى تسجيل الدخول أولاً لفتح هذه الصفحة.'],
      [/session limit reached \([^)]+\)/i, 'لا يمكن استخدام الكارت على أكثر من جهاز في نفس الوقت.'],
      [/internal error \([^)]+\)/i, 'حدث خطأ تقني مؤقت أثناء الاتصال، يرجى المحاولة مرة أخرى.'],
      [/configuration error \([^)]+\)/i, 'تعذر الاتصال بسبب إعدادات الشبكة، يرجى التواصل مع الدعم الفني.'],
      [/web browser did not send challenge response \([^)]+\)/i, 'المتصفح لم يكمل التحقق الأمني؛ فعّل JavaScript أو افتح الصفحة في Chrome.']
    ];
    var patternInput = cleaned.replace(/^رسالة من خادم المصادقة:\s*/i, '');
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i][0].test(patternInput)) {
        return patternInput.replace(patterns[i][0], patterns[i][1]);
      }
    }

    // 2. Configurable keyword map — longest keys first so specific phrases win
    //    over generic ones; the whole message is replaced with the Arabic
    //    translation (keeps output single-language).
    var keys = Object.keys(map)
      .filter(function(k) { return k.charAt(0) !== '_' && map[k]; })
      .sort(function(a, b) { return b.length - a.length; });
    var lower = cleaned.toLowerCase();
    for (var j = 0; j < keys.length; j++) {
      if (lower.indexOf(keys[j].toLowerCase()) !== -1) {
        return map[keys[j]];
      }
    }

    return cleaned;
  },

  /**
   * Safe redirect with countdown
   * @param {string} url - URL to redirect to
   * @param {number} seconds - Seconds until redirect
   * @param {string} elementId - Countdown element ID
   */
  safeRedirect: function(url, seconds, elementId) {
    if (!url || typeof url !== 'string') return null;
    var trimmed = url.trim();
    if (!trimmed || /\$\([^)]*\)/.test(trimmed)) return null;

    var noSpace = trimmed.replace(/\s+/g, '');
    try {
      var parsed = new URL(noSpace, 'http://localhost');
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
    } catch (e) {
      return null;
    }

    var remaining = (typeof seconds === 'number' && !isNaN(seconds) && seconds >= 0)
      ? Math.floor(seconds)
      : 5;
    var element = elementId ? document.getElementById(elementId) : null;
    if (element) {
      element.textContent = remaining;
    }

    if (remaining <= 0) {
      window.location.replace(trimmed);
      return null;
    }

    var cancelled = false;
    var interval = setInterval(function() {
      if (cancelled) return;
      remaining--;
      if (element) {
        element.textContent = Math.max(0, remaining);
      }
      if (remaining <= 0) {
        clearInterval(interval);
        window.location.replace(trimmed);
      }
    }, 1000);

    return function cancelRedirect() {
      cancelled = true;
      clearInterval(interval);
    };
  },

  /**
   * Append a verified voucher code to the recent-cards list (up to 3),
   * skipping un-substituted RouterOS tags, MAC/trial names, and normal accounts.
   * @param {string} code - Authenticated username/voucher from post-login page
   * @returns {boolean} True when saved
   */
  recordVoucherHistory: function(code) {
    try {
      var val = String(code || '').trim();
      if (!val || val.indexOf('$(') !== -1) return false;
      if (/^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(val)) return false;
      if (/^T-(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/i.test(val)) return false;

      var savedMode = null;
      try { if (typeof sessionStorage !== 'undefined') savedMode = sessionStorage.getItem('hotspot_mode'); } catch (eM1) {}
      if (!savedMode) { try { if (typeof localStorage !== 'undefined') savedMode = localStorage.getItem('hotspot_mode'); } catch (eM2) {} }
      if (!savedMode && util.getCookie) {
        try { savedMode = util.getCookie('hotspot_mode'); } catch (eM3) {}
      }
      if (savedMode === 'normal') return false;

      var raw = null;
      try { if (typeof sessionStorage !== 'undefined') raw = sessionStorage.getItem('hotspot_voucher_history'); } catch (e1) {}
      if (!raw) { try { if (typeof localStorage !== 'undefined') raw = localStorage.getItem('hotspot_voucher_history'); } catch (e2) {} }
      if (!raw && util.getCookie) {
        try { raw = util.getCookie('hotspot_voucher_history'); } catch (e3) {}
      }

      var list = [];
      if (raw) {
        try {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            list = parsed.filter(function(item) { return typeof item === 'string' && item.trim().length > 0; });
          }
        } catch (e4) {}
      }

      list = list.filter(function(item) { return item !== val; });
      list.unshift(val);
      var serialized = JSON.stringify(list.slice(0, 3));
      try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('hotspot_voucher_history', serialized); } catch (e5) {}
      try { if (typeof localStorage !== 'undefined') localStorage.setItem('hotspot_voucher_history', serialized); } catch (e6) {}
      if (util.setCookie) {
        try { util.setCookie('hotspot_voucher_history', serialized, 30); } catch (e7) {}
      }
      return true;
    } catch (err) {
      return false;
    }
  }
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = util;
}