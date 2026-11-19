/**
 * Authentication Module - Login form handling
 * @module Hotspot.auth
 */
var auth = {
  init: function() {
    try {
      var passwordInput = document.getElementById('password');
      var usernameInput = document.getElementById('username');
      var rememberCheckbox = document.getElementById('remember-me');
      var hasInitError = auth._hasRouterError();
      var clearOnPermanentErr = hasInitError && auth._isPermanentCredentialError();
      var routerSubmittedUser = (usernameInput && usernameInput.value && usernameInput.value.indexOf('$(') === -1)
        ? usernameInput.value.trim()
        : '';
      var preClearVoucher = auth._getStoredVoucher();
      auth._fallbackVoucherDisplay = routerSubmittedUser || preClearVoucher || '';

      if (clearOnPermanentErr) {
        auth._clearStoredVoucher();
        auth._clearStoredPassword();
        if (preClearVoucher) {
          auth._removeVoucherFromHistory(preClearVoucher);
        }
      } else if (preClearVoucher) {
        auth._addVoucherToHistory(preClearVoucher);
      }

      if (passwordInput) {
        passwordInput.addEventListener('keyup', function(e) {
          auth.detectCapsLock(e);
        });

        passwordInput.addEventListener('input', function(e) {
          var converted = auth.convertArabicNumerals(passwordInput.value);
          var val = converted.replace(/[^\x20-\x7E]/g, '');

          if (converted.replace(/\s+/g, '') !== val.replace(/\s+/g, '')) {
            auth.showInputSanitizedHint(passwordInput);
          }

          if (passwordInput.value !== val) {
            passwordInput.value = val;
          }
        });
      }

      if (usernameInput) {
        if (usernameInput.value && usernameInput.value.indexOf('$(') !== -1) {
          usernameInput.value = '';
        }
        var savedUsername = auth._getStoredUsername();
        if (savedUsername && !usernameInput.value) {
          usernameInput.value = savedUsername;
          if (rememberCheckbox) {
            rememberCheckbox.checked = true;
          }
        }
        var savedPassword = !clearOnPermanentErr ? auth._getStoredPassword() : null;
        if (savedPassword && passwordInput && !passwordInput.value) {
          passwordInput.value = savedPassword;
        }

        usernameInput.addEventListener('input', function(e) {
          var converted = auth.convertArabicNumerals(usernameInput.value);
          var val = converted.replace(/[^a-zA-Z0-9_@.-]/g, '');

          if (converted.replace(/\s+/g, '') !== val) {
            auth.showInputSanitizedHint(usernameInput);
          }

          if (usernameInput.value !== val) {
            usernameInput.value = val;
          }
        });
      }

      var form = document.getElementById('login-form');
      if (form) {
        form.addEventListener('submit', auth.onFormSubmit);
        // The template carries onsubmit="return doLogin()" for CHAP. Inline
        // attribute handlers run BEFORE addEventListener ones, so the hash
        // would be computed from the still-empty password field — the voucher
        // copy lives in onFormSubmit. Strip it and re-register below it.
        var inlineSubmit = form.getAttribute('onsubmit');
        if (inlineSubmit && inlineSubmit.indexOf('doLogin') !== -1) {
          form.removeAttribute('onsubmit');
          form.addEventListener('submit', auth.chapHashOnSubmit);
        }
      }

      var voucherInput = document.getElementById('voucher');
      if (voucherInput) {
        voucherInput.addEventListener('input', function() {
          var converted = auth.convertArabicNumerals(voucherInput.value);
          var val = auth.normalizeVoucherText(converted, auth.getVoucherFormat());
          if (converted.replace(/\s+/g, '') !== val) {
            auth.showInputSanitizedHint(voucherInput);
          }
          if (voucherInput.value !== val) {
            voucherInput.value = val;
          }
          if (val !== auth._getStoredVoucher()) {
            var voucherForm = document.getElementById('login-form');
            if (voucherForm) voucherForm.removeAttribute('data-scanned-password');
            auth._removeStorageItem('hotspot_last_voucher_pw');
          }
          auth._syncVoucherClearBtn();

          // No auto-submit on typing: codes are VARIABLE length (min is only a
          // floor), so the portal cannot know the code is complete — submitting
          // at the floor sends truncated codes that fail and lose the typed
          // value on the error reload. The user submits with Connect / Enter;
          // paste and QR scans submit themselves.
        });

        // Instant submit on paste event if valid
        voucherInput.addEventListener('paste', function(e) {
          setTimeout(function() {
            var val = auth.normalizeVoucherText(voucherInput.value, auth.getVoucherFormat());
            voucherInput.value = val;
            auth._syncVoucherClearBtn();
            var lenForm = document.getElementById('login-form');
            var minLen = lenForm ? parseInt(lenForm.getAttribute('data-voucher-min-length'), 10) : NaN;
            if (val && (!minLen || val.length >= minLen)) {
              auth.submitLoginForm(lenForm);
            }
          }, 50);
        });
      }

      // Pardon transient system/session errors in rate limiter (stored secrets were already cleared above)
      if (hasInitError) {
        var initErrorEl = document.getElementById('errorMessage') || document.getElementById('error-message');
        var lowerErr = (initErrorEl ? (initErrorEl.getAttribute('data-raw-error') || initErrorEl.textContent.trim()) : '').toLowerCase();
        var isSystemOrSessionErr = lowerErr.indexOf('not responding') !== -1 ||
          lowerErr.indexOf('already logged in') !== -1 ||
          lowerErr.indexOf('simultaneous') !== -1 ||
          lowerErr.indexOf('shutting down') !== -1 ||
          lowerErr.indexOf('no more sessions') !== -1 ||
          lowerErr.indexOf('internal error') !== -1 ||
          lowerErr.indexOf('لا يستجيب') !== -1 ||
          lowerErr.indexOf('بطء الخادم') !== -1 ||
          lowerErr.indexOf('جلسة نشطة بالفعل') !== -1 ||
          lowerErr.indexOf('اتصال نشط بالفعل') !== -1 ||
          lowerErr.indexOf('المصادقة بالفعل') !== -1 ||
          lowerErr.indexOf('التحقق من الكارت بالفعل') !== -1 ||
          lowerErr.indexOf('إيقاف خدمة') !== -1 ||
          lowerErr.indexOf('متوقفة مؤقتاً') !== -1 ||
          lowerErr.indexOf('جلسات إضافية') !== -1 ||
          lowerErr.indexOf('الحد الأقصى من الأجهزة') !== -1 ||
          lowerErr.indexOf('الحد الأقصى من المتصلين') !== -1 ||
          lowerErr.indexOf('مزدحمة') !== -1 ||
          lowerErr.indexOf('خطأ داخلي') !== -1 ||
          lowerErr.indexOf('خطأ تقني مؤقت') !== -1;
        if (isSystemOrSessionErr && typeof rateLimiter !== 'undefined' && rateLimiter.reset) {
          rateLimiter.reset('device');
        }
      }



      auth.initVoucherMode();
      auth.restoreSavedMode();
      auth.renderVoucherHistory();
      auth.triggerAutoLogin();

      // Always show QR button, we have a file fallback if camera is unavailable
      var qrBtn = document.getElementById('qrScanButton');
      if (qrBtn) {
        qrBtn.style.display = 'flex';
        qrBtn.addEventListener('click', function(e) {
          var externalUrl = qrBtn.getAttribute('data-qr-scanner-url');
          if (externalUrl) {
            if (e && e.preventDefault) e.preventDefault();
            // config override: an external scanner page (needs its own walled
            // garden entry); pass the return URL so it can send codes back.
            window.location.href = auth.buildQrScannerUrl(externalUrl, window.location.href);
            return;
          }
          if (typeof qrScanner === 'undefined') return;
          if (qrScanner._isDecoding) {
            if (e && e.preventDefault) e.preventDefault();
            return;
          }
          // Native <label for="qr-file-input"> activates the input directly
          // in normal browsers without JS input.click() or display:none.
          if (qrBtn.tagName && qrBtn.tagName.toUpperCase() === 'LABEL' && !qrScanner._isStrippedWebView()) {
            qrScanner._wireFileInput();
            return;
          }
          // Stripped captive-portal WebView or <button> callers route via scanDirect().
          if (e && e.preventDefault) e.preventDefault();
          qrScanner.scanDirect();
        });
        // Guarded like rateLimiter above — the QR module loads after auth.js
        // in the bundle; a missing module must never kill the voucher-param
        // auto-login below.
        if (typeof qrScanner !== 'undefined' && qrScanner.onPageLoad) {
          qrScanner.onPageLoad();
        }
      }

      // Check query parameters for auto-login from native camera scan
      var urlParams = new URLSearchParams(window.location.search);
      var voucherCode = urlParams.get('voucher');
      var usernameVal = urlParams.get('username');
      var passwordVal = urlParams.get('password');
      var voucherParam = voucherCode || usernameVal;

      if (voucherParam) {
        var targetTab = document.querySelector('.auth-tab[data-mode="voucher"]');
        var memberTab = document.querySelector('.auth-tab[data-mode="member"], .auth-tab[data-mode="normal"]');

        if (usernameVal && memberTab && !voucherCode) {
          memberTab.click();
        } else if (targetTab) {
          targetTab.click();
        }

        voucherInput = document.getElementById('voucher');
        usernameInput = document.getElementById('username');
        passwordInput = document.getElementById('password');

        if (voucherInput) {
          voucherInput.value = voucherParam;
          auth._syncVoucherClearBtn();
        }
        if (usernameInput) {
          usernameInput.value = voucherParam;
        }

        // A scanned link card may carry its own password (mikhmon prints
        // /login?username=X&password=Y). Stash it so onFormSubmit prefers it
        // over copying the voucher into the password field.
        if (passwordVal) {
          var scannedForm = document.getElementById('login-form');
          if (scannedForm) {
            scannedForm.setAttribute('data-scanned-password', passwordVal);
          }
          if (passwordInput) {
            passwordInput.value = passwordVal;
          }
        }

        form = document.getElementById('login-form');
        if (form && (voucherInput || usernameInput)) {
          setTimeout(function() {
            auth.submitLoginForm(form);
          }, 500);
        }
      }

      if (typeof rateLimiter !== 'undefined') {
        var initLimitStatus = rateLimiter.check('device', 15);
        if (initLimitStatus.blocked) {
          auth.handleRateLimit(initLimitStatus);
        }
      }

      if (typeof window !== 'undefined' && window.addEventListener && !auth._pageshowBound) {
        auth._pageshowBound = true;
        window.addEventListener('pageshow', function(ev) {
          if (ev && ev.persisted) {
            auth.setLoadingState(false);
            auth.triggerAutoLogin();
          }
        });
      }
    } catch (err) {
      console.error('Auth init error:', err);
    }
  },

  initVoucherMode: function() {
    try {
      var tabs = document.querySelectorAll('.auth-tab');
      var panels = document.querySelectorAll('[data-mode-panel]');
      var normalPanels = [];
      var voucherPanel = null;

      panels.forEach(function(panel) {
        if (panel.getAttribute('data-mode-panel') === 'normal') {
          normalPanels.push(panel);
        } else if (panel.getAttribute('data-mode-panel') === 'voucher') {
          voucherPanel = panel;
        }
      });

      tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          var mode = tab.getAttribute('data-mode');
          tabs.forEach(function(t) { t.classList.remove('auth-tab--active'); t.setAttribute('aria-selected', 'false'); });
          tab.classList.add('auth-tab--active');
          tab.setAttribute('aria-selected', 'true');

          normalPanels.forEach(function(p) { p.hidden = mode !== 'normal'; });
          if (voucherPanel) { voucherPanel.hidden = mode !== 'voucher'; }

          auth.saveMode(mode);

          if (mode === 'voucher') {
            var voucherInput = document.getElementById('voucher');
            if (voucherInput) {
              setTimeout(function() { voucherInput.focus(); }, 50);
            }
          }
        });
      });
    } catch (err) {
      console.error('Voucher mode init error:', err);
    }
  },

  /**
   * Localize a remaining-block duration ("1 minute and 20 seconds").
   * @param {number} remainingMs - milliseconds left
   * @returns {string} localized duration
   */
  formatRetryTime: function(remainingMs) {
    try {
      var totalSeconds = Math.ceil(remainingMs / 1000);
      var minutes = Math.floor(totalSeconds / 60);
      var seconds = totalSeconds % 60;

      var parts = [];
      if (minutes > 0) {
        parts.push(i18n.t(minutes === 1 ? 'time_minute_one' : 'time_minutes', { n: minutes }));
      }
      if (seconds > 0) {
        parts.push(i18n.t(seconds === 1 ? 'time_second_one' : 'time_seconds', { n: seconds }));
      }
      if (parts.length === 0) {
        parts.push(i18n.t('time_second_one', { n: 1 }));
      }
      if (parts.length === 1) {
        return parts[0];
      }
      return i18n.t('time_and', { a: parts[0], b: parts[1] });
    } catch (err) {
      console.error('Format retry time error:', err);
      return '';
    }
  },

  showNormalCredentialsError: function() {
    try {
      var alertsContainer = document.getElementById('alerts');
      if (alertsContainer) {
        var oldAlert = document.getElementById('normal-credentials-alert');
        if (oldAlert) oldAlert.remove();

        var alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-error';
        alertDiv.id = 'normal-credentials-alert';
        alertDiv.setAttribute('role', 'alert');
        var rawMsg = (typeof i18n !== 'undefined' && i18n.t)
          ? i18n.t('normal_credentials_required')
          : 'Please enter both username and password.';
        var safeMsg = (typeof util !== 'undefined' && util.escapeHtml) ? util.escapeHtml(rawMsg) : rawMsg;
        alertDiv.innerHTML = '<div style="display:flex;align-items:center;gap:var(--space-sm);">' +
          '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
          '<span class="alert__text">' + safeMsg + '</span>' +
          '</div>';
        alertsContainer.appendChild(alertDiv);
      }
      var usernameInput = document.getElementById('username');
      var passwordInput = document.getElementById('password');
      if (usernameInput && !usernameInput.value.trim()) {
        usernameInput.focus();
      } else if (passwordInput) {
        passwordInput.focus();
      }
    } catch (err) {
      console.error('Show normal credentials error:', err);
    }
  },

  showRateLimitWarning: function(attemptsRemaining) {
    try {
      var alertsContainer = document.getElementById('alerts');
      if (!alertsContainer) return;

      var oldWarn = document.getElementById('rate-limit-warning');
      if (oldWarn) oldWarn.remove();

      var warnDiv = document.createElement('div');
      warnDiv.className = 'alert alert-warning';
      warnDiv.id = 'rate-limit-warning';
      warnDiv.setAttribute('role', 'status');
      var rawMsg = (typeof i18n !== 'undefined' && i18n.t)
        ? i18n.t('rate_limit_warning', { n: attemptsRemaining })
        : ('Notice: ' + attemptsRemaining + ' attempts remaining before temporary pause.');
      var safeMsg = (typeof util !== 'undefined' && util.escapeHtml) ? util.escapeHtml(rawMsg) : rawMsg;
      warnDiv.innerHTML = '<div style="display:flex;align-items:center;gap:var(--space-sm);">' +
        '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        '<span class="alert__text">' + safeMsg + '</span>' +
        '</div>';
      alertsContainer.appendChild(warnDiv);
    } catch (err) {
      console.error('Show rate limit warning error:', err);
    }
  },

  /**
   * Show an inline alert when the voucher is shorter than the configured
   * minimum, focusing the field for a quick correction.
   * @param {number} minLength - configured features.voucherMinLength
   */
  showVoucherMinLengthError: function(minLength) {
    try {
      var alertsContainer = document.getElementById('alerts');
      if (!alertsContainer) return;

      var oldAlert = document.getElementById('voucher-min-length-alert');
      if (oldAlert) oldAlert.remove();

      var alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-error';
      alertDiv.id = 'voucher-min-length-alert';
      var rawMsg = i18n.t('voucher_min_length_error', { n: minLength });
      var safeMsg = (typeof util !== 'undefined' && util.escapeHtml) ? util.escapeHtml(rawMsg) : rawMsg;
      alertDiv.innerHTML = '<div style="display:flex;align-items:center;gap:var(--space-sm);">' +
        '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        '<span class="alert__text">' + safeMsg + '</span>' +
        '</div>';

      alertsContainer.appendChild(alertDiv);
      alertsContainer.scrollIntoView({ behavior: 'smooth' });

      var voucherInput = document.getElementById('voucher');
      if (voucherInput) voucherInput.focus();
    } catch (err) {
      console.error('Show voucher min length error:', err);
    }
  },

  /**
   * Submit the login form programmatically in a way that behaves like a real
   * button press. Plain HTMLFormElement.submit() bypasses ALL submit handlers —
   * the voucher→username/password copy in onFormSubmit, the rate limiter, the
   * minimum-length guard, and the CHAP onsubmit="return doLogin()" hashing —
   * so an auto-login used to reach the router with username/password empty
   * and RouterOS ignoring the bare `voucher` field. requestSubmit() fixes that;
   * the submit() fallback preserves the old (CHAP-only) path for legacy
   * browsers.
   * @param {HTMLFormElement} form - the login form
   */
  submitLoginForm: function(form) {
    if (!form) return;
    try {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else if (typeof doLogin === 'function') {
        // Legacy browsers: form.submit() bypasses submit listeners, so run the
        // handler's work by hand before CHAP-hashing.
        var fallbackMode = auth._detectActiveMode();
        if (fallbackMode === 'voucher') {
          var voucherInput = document.getElementById('voucher');
          auth.applyVoucherCredentials(voucherInput ? (voucherInput.value || '') : '');
        } else if (fallbackMode === 'normal') {
          auth.rememberUsername();
        }
        if (doLogin()) form.submit();
      } else {
        form.submit();
      }
    } catch (err) {
      console.error('Submit login form error:', err);
      try { form.submit(); } catch (err2) { /* give up quietly */ }
    }
  },

  /**
   * Build the scanner URL the QR button navigates to. The return URL (the
   * current login page, query preserved minus any hash) is appended so the
   * scanner can send a scanned bare voucher code back as ?voucher=<code>.
   * @param {string} scannerUrl - scanner target from data-qr-scanner-url
   * @param {string} currentUrl - the page the button sits on
   * @returns {string} fully-qualified scanner URL
   */
  buildQrScannerUrl: function(scannerUrl, currentUrl) {
    try {
      var target = scannerUrl || 'qr.html';
      var separator = target.indexOf('?') === -1 ? '?' : '&';
      var here = String(currentUrl || '').split('#')[0];
      return target + separator + 'return=' + encodeURIComponent(here);
    } catch (err) {
      console.error('Build QR scanner URL error:', err);
      return scannerUrl || 'qr.html';
    }
  },

  handleRateLimit: function(limitStatus) {
    try {
      var loginButton = document.getElementById('loginButton');
      var alertsContainer = document.getElementById('alerts');
      if (!loginButton || !alertsContainer) return;

      // Disable login button
      loginButton.disabled = true;

      var oldRateAlert = document.getElementById('rate-limit-alert');
      if (oldRateAlert) oldRateAlert.remove();

      var rateAlertDiv = document.createElement('div');
      rateAlertDiv.className = 'alert alert-error';
      rateAlertDiv.id = 'rate-limit-alert';

      var timeRemainingMs = limitStatus.remainingTime;

      var updateAlertText = function(remainingMs) {
        var msg = i18n.t('rate_limit_message', { time: auth.formatRetryTime(remainingMs) });
        var safeMsg = (typeof util !== 'undefined' && util.escapeHtml) ? util.escapeHtml(msg) : msg;
        rateAlertDiv.innerHTML = '<div style="display:flex;align-items:center;gap:var(--space-sm);">' +
          '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
          '<span class="alert__text">' + safeMsg + '</span>' +
          '</div>';
      };

      updateAlertText(timeRemainingMs);
      alertsContainer.appendChild(rateAlertDiv);
      alertsContainer.scrollIntoView({ behavior: 'smooth' });

      // Clear any previous interval to avoid memory leaks / multiple countdowns
      if (auth._rateLimitInterval) {
        clearInterval(auth._rateLimitInterval);
      }

      // Start countdown
      auth._rateLimitInterval = setInterval(function() {
        timeRemainingMs -= 1000;
        if (timeRemainingMs <= 0) {
          clearInterval(auth._rateLimitInterval);
          auth._rateLimitInterval = null;
          var alertEl = document.getElementById('rate-limit-alert');
          if (alertEl) alertEl.remove();
          loginButton.disabled = false;
        } else {
          updateAlertText(timeRemainingMs);
        }
      }, 1000);

    } catch (err) {
      console.error('Handle rate limit error:', err);
    }
  },

  _getStorageItem: function(key) {
    var val = null;
    try { if (typeof sessionStorage !== 'undefined') val = sessionStorage.getItem(key); } catch (e) {}
    if (!val) {
      try { if (typeof localStorage !== 'undefined') val = localStorage.getItem(key); } catch (e2) {}
    }
    if (!val && typeof util !== 'undefined' && util.getCookie) {
      try { val = util.getCookie(key); } catch (e3) {}
    }
    return val || null;
  },

  _setStorageItem: function(key, value, days) {
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value); } catch (e1) {}
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); } catch (e2) {}
    try { if (typeof util !== 'undefined' && util.setCookie) util.setCookie(key, value, days || 30); } catch (e3) {}
  },

  _removeStorageItem: function(key) {
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key); } catch (e1) {}
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch (e2) {}
    try { if (typeof util !== 'undefined' && util.setCookie) util.setCookie(key, '', -1); } catch (e3) {}
  },

  _hasRouterError: function() {
    var errorMsg = document.getElementById('errorMessage') || document.getElementById('error-message');
    if (!errorMsg) return false;
    var txt = errorMsg.textContent.trim();
    return txt !== '' && txt.indexOf('$(') === -1;
  },

  /**
   * Distinguish permanent credential/quota rejections from transient session or
   * server hiccups so temporary errors do not wipe saved vouchers/passwords.
   * Reads data-raw-error when available so pre-translated Arabic errors still match.
   */
  _isPermanentCredentialError: function() {
    var errorMsg = document.getElementById('errorMessage') || document.getElementById('error-message');
    if (!errorMsg) return false;
    var raw = errorMsg.getAttribute('data-raw-error') || errorMsg.textContent || '';
    var err = String(raw).trim().toLowerCase();
    if (!err || err.indexOf('$(') !== -1) return false;
    var patterns = [
      'invalid username or password',
      'invalid password',
      'invalid username',
      'invalid calling-station-id',
      'mac address is not yours',
      'not found',
      'account expired',
      'user expired',
      'uptime limit',
      'traffic limit',
      'transfer limit',
      'byte limit',
      'credit limit',
      'no valid profile',
      'not allowed to log in from this mac',
      'غير صحيحة',
      'لا يمكن استخدام هذا الحساب',
      'مرتبط بجهاز آخر',
      'غير مسموح باستخدامه',
      'غير مسموح من عنوان',
      'غير مسجل في النظام',
      'موقوف حالياً',
      'غير مفعّل محلياً',
      'رفض الدخول',
      'حد وقت الاستخدام',
      'انتهى الوقت المتاح',
      'حد البيانات',
      'انتهى الرصيد',
      'انتهى حساب المستخدم',
      'انتهت مدة صلاحية',
      'انتهت صلاحية',
      'استهلكت كامل سعة'
    ];
    for (var i = 0; i < patterns.length; i++) {
      if (err.indexOf(patterns[i]) !== -1) return true;
    }
    return false;
  },

  _detectActiveMode: function() {
    var activeTab = document.querySelector('.auth-tab--active');
    if (activeTab) {
      return activeTab.getAttribute('data-mode') || 'voucher';
    }
    var voucherPanel = document.querySelector('[data-mode-panel="voucher"]');
    var normalPanel = document.querySelector('[data-mode-panel="normal"]');
    if (voucherPanel && (voucherPanel.hidden || voucherPanel.style.display === 'none')) {
      if (normalPanel && !normalPanel.hidden && normalPanel.style.display !== 'none') {
        return 'normal';
      }
    }
    var voucherInput = document.getElementById('voucher');
    var usernameInput = document.getElementById('username');
    if (voucherInput && voucherInput.offsetWidth > 0) return 'voucher';
    if (usernameInput && usernameInput.offsetWidth > 0) return 'normal';
    return 'voucher';
  },

  saveMode: function(mode) {
    try {
      auth._setStorageItem('hotspot_mode', mode, 30);
    } catch (err) {
      console.error('Save mode error:', err);
    }
  },

  _getSavedMode: function() {
    return auth._getStorageItem('hotspot_mode');
  },

  _langHintTimer: null,

  convertArabicNumerals: function(text) {
    var val = String(text || '');
    var arabicNums = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
    var persianNums = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
    for (var i = 0; i < 10; i++) {
      val = val.replace(arabicNums[i], i).replace(persianNums[i], i);
    }
    return val;
  },

  _syncVoucherClearBtn: function() {
    var voucherInput = document.getElementById('voucher');
    var clearBtn = document.getElementById('voucher-clear');
    if (clearBtn) {
      clearBtn.hidden = !(voucherInput && voucherInput.value && voucherInput.value.length > 0);
    }
  },

  _getStoredVoucher: function() {
    return auth._getStorageItem('hotspot_last_voucher');
  },

  _saveStoredVoucher: function(voucherValue) {
    auth._setStorageItem('hotspot_last_voucher', voucherValue, 30);
  },

  _getStoredVoucherPassword: function() {
    var pw = auth._getStorageItem('hotspot_last_voucher_pw');
    return pw === '__EMPTY__' ? '' : pw;
  },

  _saveStoredVoucherPassword: function(passwordValue) {
    auth._setStorageItem('hotspot_last_voucher_pw', passwordValue === '' ? '__EMPTY__' : passwordValue, 30);
  },

  _clearStoredVoucher: function() {
    auth._removeStorageItem('hotspot_last_voucher');
    auth._removeStorageItem('hotspot_last_voucher_pw');
  },

  _getVoucherHistory: function() {
    try {
      var raw = auth._getStorageItem('hotspot_voucher_history');
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter(function(item) { return typeof item === 'string' && item.trim().length > 0; }).slice(0, 3)
        : [];
    } catch (e) {
      return [];
    }
  },

  _saveVoucherHistory: function(list) {
    try {
      if (!list || !list.length) {
        auth._removeStorageItem('hotspot_voucher_history');
      } else {
        auth._setStorageItem('hotspot_voucher_history', JSON.stringify(list.slice(0, 3)), 30);
      }
    } catch (e) {}
  },

  _addVoucherToHistory: function(code) {
    var val = String(code || '').trim();
    if (!val) return;
    var list = auth._getVoucherHistory().filter(function(item) { return item !== val; });
    list.unshift(val);
    auth._saveVoucherHistory(list.slice(0, 3));
  },

  _removeVoucherFromHistory: function(code) {
    var val = String(code || '').trim();
    if (!val) return;
    var list = auth._getVoucherHistory().filter(function(item) { return item !== val; });
    auth._saveVoucherHistory(list);
    auth.renderVoucherHistory();
  },

  renderVoucherHistory: function() {
    try {
      var container = document.getElementById('voucher-history');
      var chipsWrap = document.getElementById('voucher-history-chips');
      if (!container || !chipsWrap) return;
      var list = auth._getVoucherHistory();
      chipsWrap.replaceChildren();
      if (!list.length) {
        container.hidden = true;
        return;
      }
      container.hidden = false;
      list.forEach(function(code) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'voucher-history__chip';
        chip.setAttribute('dir', 'ltr');
        chip.textContent = code;
        chip.addEventListener('click', function() {
          var voucherInput = document.getElementById('voucher');
          if (voucherInput) {
            voucherInput.value = code;
            auth._syncVoucherClearBtn();
            voucherInput.focus();
          }
        });
        chipsWrap.appendChild(chip);
      });
    } catch (err) {
      console.error('Render voucher history error:', err);
    }
  },

  _getStoredUsername: function() {
    return auth._getStorageItem('hotspot_username');
  },

  _saveStoredUsername: function(usernameValue) {
    auth._setStorageItem('hotspot_username', usernameValue, 30);
  },

  _clearStoredUsername: function() {
    auth._removeStorageItem('hotspot_username');
  },

  _getStoredPassword: function() {
    return auth._getStorageItem('hotspot_password');
  },

  _saveStoredPassword: function(passwordValue) {
    auth._setStorageItem('hotspot_password', passwordValue, 30);
  },

  _clearStoredPassword: function() {
    auth._removeStorageItem('hotspot_password');
  },

  clearVoucher: function() {
    try {
      var voucherInput = document.getElementById('voucher');
      var clearBtn = document.getElementById('voucher-clear');
      if (voucherInput) {
        voucherInput.value = '';
        voucherInput.focus();
      }
      if (clearBtn) clearBtn.hidden = true;
      var form = document.getElementById('login-form');
      if (form) form.removeAttribute('data-scanned-password');
      auth._fallbackVoucherDisplay = '';
      auth._clearStoredVoucher();
    } catch (err) {
      console.error('Clear voucher error:', err);
    }
  },

  showInputSanitizedHint: function(inputEl) {
    try {
      if (inputEl && inputEl.classList) {
        inputEl.classList.remove('form-input--shake');
        void inputEl.offsetWidth;
        inputEl.classList.add('form-input--shake');
      }
      var hintEl = document.getElementById('input-lang-hint');
      if (hintEl) {
        var msg = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('keyboard_lang_hint') : '';
        if (msg && msg !== 'keyboard_lang_hint') hintEl.textContent = msg;
        hintEl.hidden = false;
        if (auth._langHintTimer) clearTimeout(auth._langHintTimer);
        auth._langHintTimer = setTimeout(function() {
          hintEl.hidden = true;
        }, 4000);
      }
    } catch (err) {
      console.error('Show input hint error:', err);
    }
  },

  restoreSavedMode: function() {
    try {
      var savedMode = auth._getSavedMode();
      var tab = document.querySelector('[data-mode="' + (savedMode || 'voucher') + '"]');
      if (tab) {
        tab.click();
      }

      var mode = auth._detectActiveMode();
      var hasError = auth._hasRouterError();
      var permanentErr = hasError && auth._isPermanentCredentialError();
      if (mode === 'voucher') {
        var lastVoucher = !permanentErr
          ? auth._getStoredVoucher()
          : (auth._fallbackVoucherDisplay || null);
        if (lastVoucher) {
          var voucherInput = document.getElementById('voucher');
          if (voucherInput && !voucherInput.value) {
            voucherInput.value = lastVoucher;
          }
          var lastVoucherPw = !permanentErr ? auth._getStoredVoucherPassword() : null;
          var form = document.getElementById('login-form');
          if (lastVoucherPw !== null && form && form.getAttribute('data-scanned-password') === null) {
            form.setAttribute('data-scanned-password', lastVoucherPw);
          }
        }
        auth._syncVoucherClearBtn();
      } else if (mode === 'normal') {
        var usernameInput = document.getElementById('username');
        var passwordInput = document.getElementById('password');
        var savedUsername = auth._getStoredUsername();
        if (savedUsername && usernameInput && !usernameInput.value) {
          usernameInput.value = savedUsername;
        }
        var savedPassword = !permanentErr ? auth._getStoredPassword() : null;
        if (savedPassword && passwordInput && !passwordInput.value) {
          passwordInput.value = savedPassword;
        }
      }
    } catch (err) {
      console.error('Restore saved mode error:', err);
    }
  },

  onFormSubmit: function(e) {
    try {
      var mode = auth._detectActiveMode();
      var usernameInput = document.getElementById('username');
      var passwordInput = document.getElementById('password');
      var voucherInput = document.getElementById('voucher');

      // Empty normal credentials guard (must run before consuming rate-limit slots)
      if (mode === 'normal') {
        var userVal = usernameInput ? usernameInput.value.trim() : '';
        var passVal = passwordInput ? passwordInput.value.trim() : '';
        if (!userVal || !passVal) {
          e.preventDefault();
          if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
          auth.showNormalCredentialsError();
          return;
        }
      }

      // Minimum-length check (config: features.voucherMinLength) — catches
      // obviously-truncated codes before a slow round trip to the router.
      // Codes are variable length, so only a floor is enforced: anything at
      // or above it is passed through for the router to judge.
      // Empty/unset attribute disables the check. Runs BEFORE the rate-limit
      // attempt is recorded, so typing short fragments cannot burn the
      // legit full code's attempt slots.
      if (mode === 'voucher' && voucherInput) {
        var lenForm = document.getElementById('login-form');
        var voucherMinLength = lenForm ? parseInt(lenForm.getAttribute('data-voucher-min-length'), 10) : NaN;
        if (voucherMinLength && voucherInput.value.trim().length < voucherMinLength) {
          e.preventDefault();
          if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
          auth.showVoucherMinLengthError(voucherMinLength);
          return;
        }
      }

      if (typeof rateLimiter !== 'undefined') {
        var deviceLimit = rateLimiter.check('device', 15);
        var fmt = auth.getVoucherFormat();
        var specificKey = (mode === 'voucher' && voucherInput && voucherInput.value.trim())
          ? ('voucher:' + (auth.normalizeVoucherText(voucherInput.value, fmt) || voucherInput.value.trim()))
          : (usernameInput && usernameInput.value.trim() ? ('user:' + usernameInput.value.trim()) : null);
        var specificLimit = specificKey ? rateLimiter.check(specificKey) : null;
        var limitStatus = (deviceLimit && deviceLimit.blocked)
          ? deviceLimit
          : (specificLimit && specificLimit.blocked ? specificLimit : null);

        if (limitStatus && limitStatus.blocked) {
          e.preventDefault();
          if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
          auth.handleRateLimit(limitStatus);
          return;
        }
        rateLimiter.recordAttempt('device');
        if (specificKey) {
          rateLimiter.recordAttempt(specificKey);
          var afterAttempt = rateLimiter.check(specificKey);
          if (afterAttempt && !afterAttempt.blocked && afterAttempt.attemptsRemaining <= 2) {
            auth.showRateLimitWarning(afterAttempt.attemptsRemaining);
          }
        } else {
          var afterDevice = rateLimiter.check('device', 15);
          if (afterDevice && !afterDevice.blocked && afterDevice.attemptsRemaining <= 2) {
            auth.showRateLimitWarning(afterDevice.attemptsRemaining);
          }
        }
      }

      if (mode === 'voucher' && voucherInput && usernameInput && passwordInput) {
        auth.applyVoucherCredentials(voucherInput.value || '');
      } else if (mode === 'normal') {
        auth.rememberUsername();
      }

      // One submit in flight at a time: the router round trip is slow and a
      // double-tap would double-POST (each attempt burns a rate-limiter slot).
      // If navigation never happens, setLoadingState's watchdog unfreezes it.
      auth.setLoadingState(true);
    } catch (err) {
      console.error('Form submit handler error:', err);
    }
  },

  /**
   * Copy the voucher into the RouterOS credential fields. The password follows
   * data-voucher-password-mode ('same' → the code, 'empty' → blank), while a
   * scanned mikhmon link (?username=X&password=Y) overrides both via
   * data-scanned-password. Runs before chapHashOnSubmit so CHAP hashes the
   * final password.
   * @param {string} voucherValue - the voucher code
   */
  applyVoucherCredentials: function(voucherValue) {
    try {
      var usernameInput = document.getElementById('username');
      var passwordInput = document.getElementById('password');
      var form = document.getElementById('login-form');
      if (!usernameInput || !passwordInput) return;

      usernameInput.value = voucherValue;

      // Check password mode: same (username = password) or empty (password = empty)
      var pwMode = form ? (form.getAttribute('data-voucher-password-mode') || 'same') : 'same';
      // A scanned card (mikhmon link or compact prefix) carries its own password
      // (including explicit "" for empty-password cards) — prefer it over defaults.
      var scannedPassword = form ? form.getAttribute('data-scanned-password') : null;

      if (scannedPassword !== null) {
        passwordInput.value = scannedPassword;
      } else if (pwMode === 'empty') {
        passwordInput.value = '';
      } else {
        passwordInput.value = voucherValue;
      }

      var preventClone = form ? (form.getAttribute('data-clone-prevention') !== 'false') : true;
      auth._addVoucherToHistory(voucherValue);
      if (preventClone) {
        auth._saveStoredVoucher(voucherValue);
        if (scannedPassword !== null) {
          auth._saveStoredVoucherPassword(scannedPassword);
        } else {
          auth._removeStorageItem('hotspot_last_voucher_pw');
        }
      } else {
        auth._clearStoredVoucher();
      }
    } catch (err) {
      console.error('Voucher credential copy error:', err);
    }
  },

  /**
   * CHAP hashing as a regular submit listener, replacing the template's inline
   * onsubmit="return doLogin()" (stripped in init) so it runs AFTER the voucher
   * copy and hashes the final password. Fires only on a genuine RouterOS
   * challenge — $(chap-id) is a hex octet (typically 2 chars, up to 32 for
   * some builds); un-substituted template text (test environments, cached
   * pages) must leave the password untouched.
   */
  chapHashOnSubmit: function() {
    try {
      var chapId = document.getElementById('chap-id');
      var chapChallenge = document.getElementById('chap-challenge');
      var passwordInput = document.getElementById('password');
      var plainPasswordHidden = document.getElementById('plain-password');

      if (!chapId || !chapChallenge || !passwordInput) return;

      var rawId = String(chapId.value || '').trim();
      var rawChallenge = String(chapChallenge.value || '').trim();

      // Guard against un-substituted RouterOS template variables
      if (!rawId || !rawChallenge || rawId.indexOf('$(') !== -1 || rawChallenge.indexOf('$(') !== -1) {
        return;
      }

      // Must match hex or octal escapes (\371) or non-empty challenge
      var isHexOrOctalId = /^(?:[0-9a-f]{1,32}|(?:\\[0-7]{1,3})+)$/i.test(rawId);
      if (!isHexOrOctalId) {
        return;
      }

      var md5Fn = typeof hexMD5 === 'function' ? hexMD5 : (typeof hex_md5 === 'function' ? hex_md5 : null);
      if (!md5Fn) return;

      // Decode octal escapes (\371 -> byte 0xF9) and escaped characters
      var decodeOctal = function(s) {
        return s.replace(/\\(?:([0-7]{1,3})|(.))/g, function(_, oct, char) {
          if (oct) return String.fromCharCode(parseInt(oct, 8));
          return char;
        });
      };

      var idVal = decodeOctal(rawId);
      var challengeVal = decodeOctal(rawChallenge);

      passwordInput.value = md5Fn(idVal + passwordInput.value + challengeVal);
      if (plainPasswordHidden) {
        plainPasswordHidden.removeAttribute('name');
      }
    } catch (err) {
      console.error('CHAP login error:', err);
    }
  },

  togglePassword: function() {
    try {
      var passwordInput = document.getElementById('password');
      var toggleBtn = document.getElementById('password-toggle') || document.querySelector('.input-toggle');

      if (passwordInput && toggleBtn) {
        if (passwordInput.type === 'password') {
          passwordInput.type = 'text';
          var hideLabel = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('password_hide') : 'Hide password';
          toggleBtn.setAttribute('aria-label', hideLabel);
          toggleBtn.setAttribute('title', hideLabel);
          toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        } else {
          passwordInput.type = 'password';
          var showLabel = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('password_show') : 'Show password';
          toggleBtn.setAttribute('aria-label', showLabel);
          toggleBtn.setAttribute('title', showLabel);
          toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        }
      }
    } catch (err) {
      console.error('Toggle password error:', err);
    }
  },

  detectCapsLock: function(event) {
    try {
      var capsLockWarning = document.getElementById('caps-lock-warning');
      if (capsLockWarning) {
        var capsLockOn = event.getModifierState && event.getModifierState('CapsLock');
        if (capsLockOn) {
          capsLockWarning.classList.add('visible');
        } else {
          capsLockWarning.classList.remove('visible');
        }
      }
    } catch (err) {
      console.error('Caps lock detection error:', err);
    }
  },

  rememberUsername: function() {
    try {
      var usernameInput = document.getElementById('username');
      var passwordInput = document.getElementById('password');
      var rememberCheckbox = document.getElementById('remember-me');
      var form = document.getElementById('login-form');
      var preventClone = form ? (form.getAttribute('data-clone-prevention') !== 'false') : true;

      if (usernameInput && rememberCheckbox) {
        if (rememberCheckbox.checked && usernameInput.value.trim()) {
          auth._saveStoredUsername(usernameInput.value.trim());
          if (preventClone && passwordInput && passwordInput.value) {
            auth._saveStoredPassword(passwordInput.value);
          } else {
            auth._clearStoredPassword();
          }
        } else {
          auth._clearStoredUsername();
          auth._clearStoredPassword();
        }
      }
    } catch (err) {
      console.error('Remember username error:', err);
    }
  },

  _loadWatchdog: null,

  /**
   * Freeze/unfreeze the Connect button while the router round trip is in
   * flight. Targets the template's loginButton; the frozen button blocks
   * re-taps (disabled + .btn--loading's pointer-events) and shows the
   * localized connecting label with the shared spinner. A 15 s watchdog
   * unfreezes the page if navigation never happens (hung request) — RouterOS
   * otherwise always answers with a fresh page, which resets everything.
   */
  setLoadingState: function(isLoading) {
    try {
      var btn = document.getElementById('loginButton');
      if (!btn) return;

      if (isLoading) {
        if (btn.disabled) return; // already frozen — keep the first label
        btn.disabled = true;
        btn.classList.add('btn--loading');
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = (typeof i18n !== 'undefined' && i18n.t)
          ? i18n.t('login_loading')
          : 'Connecting…';
        if (auth._loadWatchdog) clearTimeout(auth._loadWatchdog);
        auth._loadWatchdog = setTimeout(function() {
          auth._loadWatchdog = null;
          auth.setLoadingState(false);
        }, 15000);
      } else {
        if (auth._loadWatchdog) { clearTimeout(auth._loadWatchdog); auth._loadWatchdog = null; }
        btn.disabled = false;
        btn.classList.remove('btn--loading');
        if (btn.dataset.originalHtml) {
          btn.innerHTML = btn.dataset.originalHtml;
          delete btn.dataset.originalHtml;
        }
      }
    } catch (err) {
      console.error('Set loading state error:', err);
    }
  },

  autoLoginTimer: null,

  getVoucherFormat: function() {
    var form = document.getElementById('login-form');
    var fmt = form ? form.getAttribute('data-voucher-format') : '';
    return fmt === 'alphanumeric' ? 'alphanumeric' : 'numeric';
  },

  /**
   * Normalize voucher text: convert Eastern Arabic/Persian numerals to ASCII
   * digits and strip stray characters (honoring numeric vs alphanumeric format).
   * @param {string} text - raw voucher text
   * @param {string} [format='numeric'] - 'numeric' or 'alphanumeric'
   * @returns {string} normalized voucher code
   */
  normalizeVoucherText: function(text, format) {
    try {
      var val = auth.convertArabicNumerals(text);
      if (format === 'alphanumeric') {
        return val.replace(/[^a-zA-Z0-9_-]/g, '');
      }
      return val.replace(/[^0-9]/g, '');
    } catch (err) {
      console.error('Normalize voucher text error:', err);
      return format === 'alphanumeric'
        ? String(text || '').replace(/[^a-zA-Z0-9_-]/g, '')
        : String(text || '').replace(/[^0-9]/g, '');
    }
  },

  /**
   * Fill the credential fields and start auto-login.
   * If instant=true (e.g. from newly scanned QR), submit immediately in 0 seconds.
   * Otherwise (from saved cookie/localStorage), show a 3-second cancellable countdown.
   * @param {string} credentialValue - voucher code or username
   * @param {boolean} [instant=false] - whether to skip countdown and submit immediately
   * @param {string} [mode='voucher'] - 'voucher' or 'normal'
   * @param {string} [normalPassword=''] - password for 'normal' mode auto-login
   */
  beginAutoLogin: function(credentialValue, instant, mode, normalPassword) {
    try {
      var activeMode = mode === 'normal' ? 'normal' : 'voucher';
      var form = document.getElementById('login-form');
      if (!form) return;

      var voucherInput = document.getElementById('voucher');
      var usernameInput = document.getElementById('username');
      var passwordInput = document.getElementById('password');

      if (activeMode === 'voucher') {
        if (!voucherInput) return;
        voucherInput.value = credentialValue;
        auth._syncVoucherClearBtn();
      } else {
        if (!usernameInput || !passwordInput) return;
        usernameInput.value = credentialValue;
        passwordInput.value = normalPassword || '';
      }

      var applyCredentialsForSubmit = function() {
        if (activeMode === 'normal') {
          usernameInput.value = credentialValue;
          passwordInput.value = normalPassword || '';
        } else {
          auth.applyVoucherCredentials(credentialValue);
        }
      };

      // Clear any running auto-login interval before starting a fresh one
      if (auth.autoLoginTimer) {
        clearInterval(auth.autoLoginTimer);
        auth.autoLoginTimer = null;
      }

      var alertsContainer = document.getElementById('alerts');
      if (!alertsContainer) return;

      var oldAlert = document.getElementById('auto-login-alert');
      if (oldAlert) oldAlert.remove();

      // Instant path: from real-time QR scan — skip wait time completely!
      if (instant) {
        applyCredentialsForSubmit();
        util.showToast(i18n.t('connecting') || 'Connecting...', 'info', 1500);
        auth.submitLoginForm(form);
        return;
      }

      var autoLoginDiv = document.createElement('div');
      autoLoginDiv.className = 'alert alert-info';
      autoLoginDiv.id = 'auto-login-alert';
      autoLoginDiv.style.display = 'flex';
      autoLoginDiv.style.alignItems = 'center';
      autoLoginDiv.style.justifyContent = 'space-between';
      autoLoginDiv.style.gap = 'var(--space-sm)';

      var rawCountdown = i18n.t('auto_login_countdown') || '';
      var text;
      if (rawCountdown.indexOf('id="auto-login-sec"') !== -1 || rawCountdown.indexOf("id='auto-login-sec'") !== -1) {
        text = rawCountdown.replace('{n}', '3');
      } else {
        text = rawCountdown.replace('{n}', '<strong id="auto-login-sec">3</strong>');
      }

      var cancelLabel = (typeof util !== 'undefined' && util.escapeHtml) ? util.escapeHtml(i18n.t('cancel')) : i18n.t('cancel');

      autoLoginDiv.innerHTML = '<div style="display:flex;align-items:center;gap:var(--space-sm);">' +
        '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
        '<span class="alert__text">' + text + '</span>' +
        '</div>' +
        '<button type="button" id="cancel-auto-login-btn" class="btn btn-secondary" style="padding:4px 8px;font-size:12px;margin:0;width:auto;">' + cancelLabel + '</button>';

      alertsContainer.appendChild(autoLoginDiv);

      var seconds = 3;
      var secElement = document.getElementById('auto-login-sec');

      var cancelBtn = document.getElementById('cancel-auto-login-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
          if (auth.autoLoginTimer) {
            clearInterval(auth.autoLoginTimer);
            auth.autoLoginTimer = null;
          }
          var alertEl = document.getElementById('auto-login-alert');
          if (alertEl) alertEl.remove();
        });
      }

      auth.autoLoginTimer = setInterval(function() {
        seconds--;
        if (secElement) secElement.textContent = seconds;
        if (seconds <= 0) {
          clearInterval(auth.autoLoginTimer);
          auth.autoLoginTimer = null;

          var alertEl = document.getElementById('auto-login-alert');
          if (alertEl) alertEl.remove();

          // Set form inputs and submit
          applyCredentialsForSubmit();

          // Submit form
          auth.submitLoginForm(form);
        }
      }, 1000);
    } catch (err) {
      console.error('Auto login error:', err);
    }
  },

  triggerAutoLogin: function() {
    try {
      // Don't auto-login if there is a real router error message showing (ignore un-substituted $(error-esc))
      if (auth._hasRouterError()) {
        return;
      }

      // Skip saved-credential auto-login when an explicit QR/URL login param
      // or a WebView-to-browser QR scan escape marker is present
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        var qs = new URLSearchParams(window.location.search);
        if (qs.get('voucher') || qs.get('username') || qs.get('qrscan')) {
          return;
        }
      }

      var form = document.getElementById('login-form');
      if (!form) return;

      var preventClone = form.getAttribute('data-clone-prevention') !== 'false';
      if (!preventClone) {
        auth._clearStoredVoucher();
        auth._clearStoredPassword();
        return;
      }

      var mode = auth._detectActiveMode();

      if (mode === 'voucher') {
        var lastVoucher = auth._getStoredVoucher();
        if (!lastVoucher) return;

        var lastVoucherPw = auth._getStoredVoucherPassword();
        if (lastVoucherPw !== null && form.getAttribute('data-scanned-password') === null) {
          form.setAttribute('data-scanned-password', lastVoucherPw);
        }

        var voucherInput = document.getElementById('voucher');
        if (!voucherInput) return;

        auth.beginAutoLogin(lastVoucher, false, 'voucher');
      } else if (mode === 'normal') {
        var savedUser = auth._getStoredUsername();
        var savedPass = auth._getStoredPassword();
        if (!savedUser || !savedPass) return;

        var usernameInput = document.getElementById('username');
        var passwordInput = document.getElementById('password');
        if (!usernameInput || !passwordInput) return;

        auth.beginAutoLogin(savedUser, false, 'normal', savedPass);
      }
    } catch (err) {
      console.error('Auto login error:', err);
    }
  },

  _qrScanner: null
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = auth;
}

// Legacy CHAP entry point — base.html's doLogin() and submitLoginForm's
// non-requestSubmit fallback both call this. The real hashing now lives in
// auth.chapHashOnSubmit, which runs as a submit listener AFTER the voucher
// copy; this delegate keeps the old call sites working.
window._doLogin = function() {
  auth.chapHashOnSubmit();
  return true;
};