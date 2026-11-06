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
      }

      var voucherInput = document.getElementById('voucher');
      if (voucherInput) {
        voucherInput.addEventListener('input', function(e) {
          var val = voucherInput.value;
          
          // 1. Convert Eastern Arabic/Persian numerals to Western Arabic (English) numerals
          var arabicNums = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
          var persianNums = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
          for (var i = 0; i < 10; i++) {
            val = val.replace(arabicNums[i], i).replace(persianNums[i], i);
          }
          
          // 2. Remove all non-numeric characters
          val = val.replace(/[^0-9]/g, '');
          
          // 3. Set the value back
          if (voucherInput.value !== val) {
            voucherInput.value = val;
          }
        });
      }



      auth.initVoucherMode();
      auth.restoreSavedMode();
      auth.triggerAutoLogin();

      // Always show QR button, we have a file fallback if camera is unavailable
      var qrBtn = document.getElementById('qrScanButton');
      if (qrBtn) {
        qrBtn.style.display = 'flex';
        // Open the voucher scanner (self-hosted qr.html by default; the
        // data-qr-scanner-url attribute may point elsewhere via config).
        // The return URL is passed so a scanned bare code can come back here
        // as ?voucher=<code> (link cards carry their own destination).
        qrBtn.addEventListener('click', function() {
          var target = auth.buildQrScannerUrl(
            qrBtn.getAttribute('data-qr-scanner-url'),
            window.location.href
          );
          window.location.href = target;
        });
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
          var form = document.getElementById('login-form');
          if (form) {
            setTimeout(function() {
              if (typeof doLogin === 'function') {
                if (doLogin()) form.submit();
              } else {
                form.submit();
              }
            }, 500);
          }
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
        var voucherValue = voucherInput.value || '';
        usernameInput.value = voucherValue;
        
        // Check password mode: same (username = password) or empty (password = empty)
        var form = document.getElementById('login-form');
        var pwMode = form ? (form.getAttribute('data-voucher-password-mode') || 'same') : 'same';
        
        if (pwMode === 'empty') {
          passwordInput.value = '';
        } else {
          passwordInput.value = voucherValue;
        }

        var preventClone = form ? (form.getAttribute('data-clone-prevention') !== 'false') : true;
        if (preventClone && typeof localStorage !== 'undefined') {
          localStorage.setItem('hotspot_last_voucher', voucherValue);
        } else if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('hotspot_last_voucher');
        }
      } else if (mode === 'normal') {
        auth.rememberUsername();
      }
    } catch (err) {
      console.error('Form submit handler error:', err);
    }
  },

  togglePassword: function() {
    try {
      var passwordInput = document.getElementById('password');
      var toggleBtn = document.getElementById('password-toggle') || document.querySelector('.input-toggle');

      if (passwordInput && toggleBtn) {
        if (passwordInput.type === 'password') {
          passwordInput.type = 'text';
          toggleBtn.setAttribute('aria-label', 'Hide password');
          toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        } else {
          passwordInput.type = 'password';
          toggleBtn.setAttribute('aria-label', 'Show password');
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

  setLoadingState: function(isLoading) {
    try {
      var submitBtn = document.getElementById('submit-btn');
      var spinner = document.getElementById('submit-spinner');
      var btnText = document.getElementById('submit-text');

      if (submitBtn) {
        if (isLoading) {
          submitBtn.classList.add('btn--loading');
          submitBtn.disabled = true;
          if (spinner) spinner.style.display = 'inline-block';
          if (btnText) btnText.textContent = 'Signing in...';
        } else {
          submitBtn.classList.remove('btn--loading');
          submitBtn.disabled = false;
          if (spinner) spinner.style.display = 'none';
          if (btnText) btnText.textContent = 'Sign In';
        }
      }
    } catch (err) {
      console.error('Set loading state error:', err);
    }
  },

  autoLoginTimer: null,

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
      if (!voucherInput || !form) return;

      // Set input value
      voucherInput.value = lastVoucher;

      // Create a nice status container for auto-login countdown
      var alertsContainer = document.getElementById('alerts');
      if (!alertsContainer) return;

      var autoLoginDiv = document.createElement('div');
      autoLoginDiv.className = 'alert alert-info';
      autoLoginDiv.id = 'auto-login-alert';
      autoLoginDiv.style.display = 'flex';
      autoLoginDiv.style.alignItems = 'center';
      autoLoginDiv.style.justifyContent = 'space-between';
      autoLoginDiv.style.gap = 'var(--space-sm)';

      var currentLang = document.documentElement.getAttribute('lang') || 'en';
      var text = currentLang === 'ar' 
        ? 'تسجيل دخول تلقائي بآخر كارت خلال <strong id="auto-login-sec">3</strong> ثوانٍ...' 
        : 'Auto-connecting in <strong id="auto-login-sec">3</strong> seconds...';
      
      var btnText = currentLang === 'ar' ? 'إلغاء' : 'Cancel';

      autoLoginDiv.innerHTML = '<div style="display:flex;align-items:center;gap:var(--space-sm);">' +
        '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
        '<span class="alert__text">' + text + '</span>' +
        '</div>' +
        '<button type="button" id="cancel-auto-login-btn" class="btn btn-secondary" style="padding:4px 8px;font-size:12px;margin:0;width:auto;">' + btnText + '</button>';

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
            usernameInput.value = lastVoucher;
            passwordInput.value = lastVoucher;
          }
          
          // Submit form
          if (typeof doLogin === 'function') {
            if (doLogin()) {
              form.submit();
            }
          } else {
            form.submit();
          }
        }
      }, 1000);

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

// Implement Mikrotik CHAP login
window._doLogin = function() {
  try {
    var chapId = document.getElementById('chap-id');
    var chapChallenge = document.getElementById('chap-challenge');
    var passwordInput = document.getElementById('password'); 
    var plainPasswordHidden = document.getElementById('plain-password');

    if (chapId && chapChallenge && chapId.value && chapChallenge.value && typeof hexMD5 !== 'undefined') {
      var pwd = passwordInput ? passwordInput.value : '';
      var hash = hexMD5(chapId.value + pwd + chapChallenge.value);
      
      if (passwordInput) {
        passwordInput.value = hash;
      }
      
      if (plainPasswordHidden) {
        plainPasswordHidden.removeAttribute('name');
      }
    }
  } catch(e) {
    console.error("CHAP login error:", e);
  }
  return true;
};