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

      if (passwordInput) {
        passwordInput.addEventListener('keyup', function(e) {
          auth.detectCapsLock(e);
        });

        passwordInput.addEventListener('input', function(e) {
          var val = passwordInput.value;
          
          // Convert Eastern Arabic/Persian numerals to Western Arabic (English) numerals
          var arabicNums = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
          var persianNums = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
          for (var i = 0; i < 10; i++) {
            val = val.replace(arabicNums[i], i).replace(persianNums[i], i);
          }
          
          // Remove all non-ASCII/non-standard printable characters (allows all standard keyboard characters, blocks Arabic/Persian)
          val = val.replace(/[^\x20-\x7E]/g, '');
          
          if (passwordInput.value !== val) {
            passwordInput.value = val;
          }
        });
      }

      if (usernameInput) {
        var savedUsername = util.getCookie('hotspot_username');
        if (savedUsername && usernameInput) {
          usernameInput.value = savedUsername;
          if (rememberCheckbox) {
            rememberCheckbox.checked = true;
          }
        }

        usernameInput.addEventListener('input', function(e) {
          var val = usernameInput.value;
          
          // Convert Eastern Arabic/Persian numerals to Western Arabic (English) numerals
          var arabicNums = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
          var persianNums = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
          for (var i = 0; i < 10; i++) {
            val = val.replace(arabicNums[i], i).replace(persianNums[i], i);
          }
          
          // Allow only English alphanumeric characters and _ @ . -
          val = val.replace(/[^a-zA-Z0-9_@.-]/g, '');
          
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
          var val = auth.normalizeVoucherText(voucherInput.value);
          if (voucherInput.value !== val) {
            voucherInput.value = val;
          }

          // No auto-submit on typing: codes are VARIABLE length (min is only a
          // floor), so the portal cannot know the code is complete — submitting
          // at the floor sends truncated codes that fail and lose the typed
          // value on the error reload. The user submits with Connect / Enter;
          // paste and QR scans submit themselves.
        });

        // Instant submit on paste event if valid
        voucherInput.addEventListener('paste', function(e) {
          setTimeout(function() {
            var val = auth.normalizeVoucherText(voucherInput.value);
            voucherInput.value = val;
            var lenForm = document.getElementById('login-form');
            var minLen = lenForm ? parseInt(lenForm.getAttribute('data-voucher-min-length'), 10) : NaN;
            if (val && (!minLen || val.length >= minLen)) {
              auth.submitLoginForm(lenForm);
            }
          }, 50);
        });
      }



      auth.initVoucherMode();
      auth.restoreSavedMode();
      auth.triggerAutoLogin();

      // Always show QR button, we have a file fallback if camera is unavailable
      var qrBtn = document.getElementById('qrScanButton');
      if (qrBtn) {
        qrBtn.style.display = 'flex';
        qrBtn.addEventListener('click', function() {
          var externalUrl = qrBtn.getAttribute('data-qr-scanner-url');
          if (externalUrl) {
            // config override: an external scanner page (needs its own walled
            // garden entry); pass the return URL so it can send codes back.
            window.location.href = auth.buildQrScannerUrl(externalUrl, window.location.href);
            return;
          }
          // default: minimum-click flow — working browsers open the native
          // camera app in one tap; the stripped captive-portal WebView jumps
          // straight to the full browser (Hotspot.qrScanner.scanDirect).
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
      var voucherParam = urlParams.get('voucher') || urlParams.get('username');
      if (voucherParam) {
        var targetTab = document.querySelector('.auth-tab[data-mode="voucher"]');
        if (targetTab) {
          targetTab.click();
        }
        var voucherInput = document.getElementById('voucher');
        if (voucherInput) {
          voucherInput.value = voucherParam;
        }
        var usernameInput = document.getElementById('username');
        if (usernameInput && !voucherInput) {
          usernameInput.value = voucherParam;
        }

        // A scanned link card may carry its own password (mikhmon prints
        // /login?username=X&password=Y). Stash it so onFormSubmit prefers it
        // over copying the voucher into the password field.
        var passwordParam = urlParams.get('password');
        if (passwordParam) {
          var scannedForm = document.getElementById('login-form');
          if (scannedForm) {
            scannedForm.setAttribute('data-scanned-password', passwordParam);
          }
        }

        var form = document.getElementById('login-form');
        if (form && (voucherInput || usernameInput)) {
          setTimeout(function() {
            auth.submitLoginForm(form);
          }, 500);
        }
      }

      if (typeof rateLimiter !== 'undefined') {
        var initLimitStatus = rateLimiter.check('device');
        if (initLimitStatus.blocked) {
          auth.handleRateLimit(initLimitStatus);
        }
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
      alertDiv.innerHTML = '<div style="display:flex;align-items:center;gap:var(--space-sm);">' +
        '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        '<span class="alert__text">' + i18n.t('voucher_min_length_error', { n: minLength }) + '</span>' +
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
        // handler's work by hand — copy the voucher, then CHAP-hash — first.
        var voucherInput = document.getElementById('voucher');
        auth.applyVoucherCredentials(voucherInput ? (voucherInput.value || '') : '');
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
        rateAlertDiv.innerHTML = '<div style="display:flex;align-items:center;gap:var(--space-sm);">' +
          '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
          '<span class="alert__text">' + msg + '</span>' +
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

  saveMode: function(mode) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('hotspot_mode', mode);
      }
    } catch (err) {
      console.error('Save mode error:', err);
    }
  },

  restoreSavedMode: function() {
    try {
      var savedMode = null;
      if (typeof localStorage !== 'undefined') {
        savedMode = localStorage.getItem('hotspot_mode');
      }

      var mode = savedMode || 'voucher';
      var tab = document.querySelector('[data-mode="' + mode + '"]');
      if (tab) {
        tab.click();
      }

      if (mode === 'voucher') {
        var lastVoucher = null;
        if (typeof localStorage !== 'undefined') {
          lastVoucher = localStorage.getItem('hotspot_last_voucher');
        }
        if (lastVoucher) {
          var voucherInput = document.getElementById('voucher');
          if (voucherInput) {
            voucherInput.value = lastVoucher;
          }
        }
      }
    } catch (err) {
      console.error('Restore saved mode error:', err);
    }
  },

  onFormSubmit: function(e) {
    try {
      var activeTab = document.querySelector('.auth-tab--active');
      var mode = 'voucher'; // default fallback
      
      if (activeTab) {
        mode = activeTab.getAttribute('data-mode');
      } else {
        // If tabs are hidden, detect mode by checking if voucher field is visible or username is hidden
        var voucherInput = document.getElementById('voucher');
        var usernameInput = document.getElementById('username');
        if (voucherInput && voucherInput.offsetWidth > 0) {
          mode = 'voucher';
        } else if (usernameInput && usernameInput.offsetWidth > 0) {
          mode = 'normal';
        }
      }
      
      var usernameInput = document.getElementById('username');
      var passwordInput = document.getElementById('password');
      var voucherInput = document.getElementById('voucher');

      var loginKey = '';
      if (mode === 'voucher' && voucherInput) {
        loginKey = voucherInput.value.trim();
      } else if (mode === 'normal' && usernameInput) {
        loginKey = usernameInput.value.trim();
      }

      if (typeof rateLimiter !== 'undefined') {
        var limitStatus = rateLimiter.check('device');
        if (limitStatus.blocked) {
          e.preventDefault();
          auth.handleRateLimit(limitStatus);
          return;
        }
        rateLimiter.recordAttempt('device');
      }

      // Minimum-length check (config: features.voucherMinLength) — catches
      // obviously-truncated codes before a slow round trip to the router.
      // Codes are variable length, so only a floor is enforced: anything at
      // or above it is passed through for the router to judge.
      // Empty/unset attribute disables the check.
      if (mode === 'voucher' && voucherInput) {
        var lenForm = document.getElementById('login-form');
        var voucherMinLength = lenForm ? parseInt(lenForm.getAttribute('data-voucher-min-length'), 10) : NaN;
        if (voucherMinLength && voucherInput.value.trim().length < voucherMinLength) {
          e.preventDefault();
          auth.showVoucherMinLengthError(voucherMinLength);
          return;
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
      // A scanned link card (mikhmon format: ?username=X&password=Y) carries
      // its own password — prefer it over the configured copy/blank default.
      var scannedPassword = form ? form.getAttribute('data-scanned-password') : null;

      if (pwMode === 'empty' && !scannedPassword) {
        passwordInput.value = '';
      } else if (scannedPassword) {
        passwordInput.value = scannedPassword;
      } else {
        passwordInput.value = voucherValue;
      }

      var preventClone = form ? (form.getAttribute('data-clone-prevention') !== 'false') : true;
      if (preventClone && typeof localStorage !== 'undefined') {
        localStorage.setItem('hotspot_last_voucher', voucherValue);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('hotspot_last_voucher');
      }
    } catch (err) {
      console.error('Voucher credential copy error:', err);
    }
  },

  /**
   * CHAP hashing as a regular submit listener, replacing the template's inline
   * onsubmit="return doLogin()" (stripped in init) so it runs AFTER the voucher
   * copy and hashes the final password. Fires only on a genuine RouterOS
   * challenge — $(chap-id) is 32 hex chars; un-substituted template text (test
   * environments, cached pages) must leave the password untouched.
   */
  chapHashOnSubmit: function() {
    try {
      var chapId = document.getElementById('chap-id');
      var chapChallenge = document.getElementById('chap-challenge');
      var passwordInput = document.getElementById('password');
      var plainPasswordHidden = document.getElementById('plain-password');

      if (chapId && chapChallenge && passwordInput &&
          /^[0-9a-f]{32}$/i.test(String(chapId.value || '')) &&
          String(chapChallenge.value || '') !== '' &&
          typeof hexMD5 !== 'undefined') {
        passwordInput.value = hexMD5(chapId.value + passwordInput.value + chapChallenge.value);
        if (plainPasswordHidden) {
          plainPasswordHidden.removeAttribute('name');
        }
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
      var rememberCheckbox = document.getElementById('remember-me');

      if (usernameInput && rememberCheckbox) {
        if (rememberCheckbox.checked) {
          util.setCookie('hotspot_username', usernameInput.value, 30);
        } else {
          util.setCookie('hotspot_username', '', -1);
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

  /**
   * Normalize voucher text: convert Eastern Arabic/Persian numerals to ASCII
   * digits and strip everything else (spaces, dashes, newlines from QR scans).
   * @param {string} text - raw voucher text
   * @returns {string} digits-only voucher code
   */
  normalizeVoucherText: function(text) {
    try {
      var val = String(text || '');
      var arabicNums = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
      var persianNums = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
      for (var i = 0; i < 10; i++) {
        val = val.replace(arabicNums[i], i).replace(persianNums[i], i);
      }
      return val.replace(/[^0-9]/g, '');
    } catch (err) {
      console.error('Normalize voucher text error:', err);
      return String(text || '').replace(/[^0-9]/g, '');
    }
  },

  /**
   * Fill the voucher field and start auto-login.
   * If instant=true (e.g. from newly scanned QR), submit immediately in 0 seconds.
   * Otherwise (from saved cookie/localStorage), show a 3-second cancellable countdown.
   * @param {string} voucherValue - the code to log in with
   * @param {boolean} [instant=false] - whether to skip countdown and submit immediately
   */
  beginAutoLogin: function(voucherValue, instant) {
    try {
      var voucherInput = document.getElementById('voucher');
      var form = document.getElementById('login-form');
      if (!voucherInput || !form) return;

      voucherInput.value = voucherValue;

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
        var usernameInput = document.getElementById('username');
        var passwordInput = document.getElementById('password');
        if (usernameInput && passwordInput) {
          usernameInput.value = voucherValue;
          passwordInput.value = voucherValue;
        }
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

      var text = i18n.t('auto_login_countdown').split('{n}').join('<strong id="auto-login-sec">3</strong>');

      autoLoginDiv.innerHTML = '<div style="display:flex;align-items:center;gap:var(--space-sm);">' +
        '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
        '<span class="alert__text">' + text + '</span>' +
        '</div>' +
        '<button type="button" id="cancel-auto-login-btn" class="btn btn-secondary" style="padding:4px 8px;font-size:12px;margin:0;width:auto;">' + i18n.t('cancel') + '</button>';

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
          var usernameInput = document.getElementById('username');
          var passwordInput = document.getElementById('password');
          if (usernameInput && passwordInput) {
            usernameInput.value = voucherValue;
            passwordInput.value = voucherValue;
          }

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
      // Don't auto-login if there is an error message showing (to prevent infinite loops)
      var errorMsg = document.getElementById('errorMessage') || document.getElementById('error-message');
      if (errorMsg && errorMsg.textContent.trim() !== '') {
        return;
      }

      // Check if the current tab mode is voucher
      var activeTab = document.querySelector('.auth-tab--active');
      var mode = activeTab ? activeTab.getAttribute('data-mode') : 'voucher';
      if (mode !== 'voucher') return;

      // Check if the current page has the form
      var form = document.getElementById('login-form');

      // Check if clone prevention is disabled via data-clone-prevention
      var preventClone = form ? (form.getAttribute('data-clone-prevention') !== 'false') : true;

      // Check if we have a saved voucher
      var lastVoucher = null;
      if (preventClone && typeof localStorage !== 'undefined') {
        lastVoucher = localStorage.getItem('hotspot_last_voucher');
      } else if (!preventClone && typeof localStorage !== 'undefined') {
        localStorage.removeItem('hotspot_last_voucher');
      }

      if (!lastVoucher) return;

      // Check if the current page has the voucher input and form
      var voucherInput = document.getElementById('voucher');
      var form = document.getElementById('login-form');
      if (!voucherInput || !form) return;

      auth.beginAutoLogin(lastVoucher);
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