/**
 * Tests for Hotspot.auth module
 */

const auth = require('../../src/js/modules/auth.js');
const util = require('../../src/js/modules/util.js');

describe('Hotspot.auth', () => {
  let mockPasswordInput;
  let mockToggleBtn;
  let mockUsernameInput;
  let mockRememberCheckbox;
  let mockForm;
  let mockVoucher;
  let mockQrScanButton;
  let mockQrScannerModal;

  beforeEach(() => {
    global.util = util;
    // Reset DOM
    document.body.innerHTML = '';
    // Tests below (mikhmon onFormSubmit) write hotspot_last_voucher — never
    // let one test's saved voucher leak into the next.
    localStorage.clear();

    // Create mock elements
    mockPasswordInput = document.createElement('input');
    mockPasswordInput.type = 'password';
    mockPasswordInput.id = 'password';

    mockToggleBtn = document.createElement('button');
    mockToggleBtn.id = 'password-toggle';

    mockUsernameInput = document.createElement('input');
    mockUsernameInput.type = 'text';
    mockUsernameInput.id = 'username';

    mockRememberCheckbox = document.createElement('input');
    mockRememberCheckbox.type = 'checkbox';
    mockRememberCheckbox.id = 'remember-me';

    mockForm = document.createElement('form');
    mockForm.id = 'login-form';

    // Append to body
    document.body.appendChild(mockPasswordInput);
    document.body.appendChild(mockToggleBtn);
    document.body.appendChild(mockUsernameInput);
    document.body.appendChild(mockRememberCheckbox);
    document.body.appendChild(mockForm);

    mockVoucher = document.createElement('input');
    mockVoucher.id = 'voucher';
    mockVoucher.type = 'text';

    mockQrScanButton = document.createElement('button');
    mockQrScanButton.id = 'qrScanButton';
    mockQrScanButton.style.display = 'none';

    mockQrScannerModal = document.createElement('div');
    mockQrScannerModal.id = 'qrScannerModal';
    mockQrScannerModal.className = 'support-modal';

    document.body.appendChild(mockVoucher);
    document.body.appendChild(mockQrScanButton);
    document.body.appendChild(mockQrScannerModal);

    // Reset auth state
    auth.initialized = false;
  });

  afterEach(() => {
    delete global.util;
  });

  describe('togglePassword', () => {
    test('toggles password visibility on', () => {
      auth.togglePassword();
      expect(mockPasswordInput.type).toBe('text');
    });

    test('toggles password visibility off', () => {
      mockPasswordInput.type = 'text';
      auth.togglePassword();
      expect(mockPasswordInput.type).toBe('password');
    });

    test('updates aria-label', () => {
      auth.togglePassword();
      expect(mockToggleBtn.getAttribute('aria-label')).toBe('Hide password');
    });
  });

  describe('detectCapsLock', () => {
    test('shows warning when caps lock is on', () => {
      const capsWarning = document.createElement('div');
      capsWarning.id = 'caps-lock-warning';
      document.body.appendChild(capsWarning);

      const event = {
        getModifierState: jest.fn().mockReturnValue(true)
      };

      auth.detectCapsLock(event);
      expect(capsWarning.classList.contains('visible')).toBe(true);
    });

    test('hides warning when caps lock is off', () => {
      const capsWarning = document.createElement('div');
      capsWarning.id = 'caps-lock-warning';
      capsWarning.classList.add('visible');
      document.body.appendChild(capsWarning);

      const event = {
        getModifierState: jest.fn().mockReturnValue(false)
      };

      auth.detectCapsLock(event);
      expect(capsWarning.classList.contains('visible')).toBe(false);
    });
  });

  describe('rememberUsername', () => {
    test('does not throw when checkbox is checked', () => {
      mockUsernameInput.value = 'testuser';
      mockRememberCheckbox.checked = true;

      expect(() => auth.rememberUsername()).not.toThrow();
    });

    test('does not throw when checkbox is unchecked', () => {
      mockUsernameInput.value = 'testuser';
      mockRememberCheckbox.checked = false;

      expect(() => auth.rememberUsername()).not.toThrow();
    });
  });

  describe('formatRetryTime', () => {
    const i18nModule = require('../../src/js/modules/i18n.js');

    beforeEach(() => {
      global.i18n = i18nModule;
      i18nModule.data = {
        en: {
          time_and: '{a} and {b}',
          time_minute_one: '{n} minute',
          time_minutes: '{n} minutes',
          time_second_one: '{n} second',
          time_seconds: '{n} seconds'
        }
      };
      i18nModule.currentLang = 'en';
    });

    afterEach(() => {
      delete global.i18n;
    });

    test('builds "1 minute and 30 seconds" from 90s', () => {
      expect(auth.formatRetryTime(90000)).toBe('1 minute and 30 seconds');
    });

    test('builds "2 minutes and 5 seconds" from 125s', () => {
      expect(auth.formatRetryTime(125000)).toBe('2 minutes and 5 seconds');
    });

    test('seconds-only durations skip the minute part', () => {
      expect(auth.formatRetryTime(40000)).toBe('40 seconds');
    });

    test('a zero duration falls back to "1 second" rather than an empty string', () => {
      expect(auth.formatRetryTime(0)).toBe('1 second');
    });
  });

  describe('voucher minimum-length validation', () => {
    const i18nModule = require('../../src/js/modules/i18n.js');

    let alertsContainer;

    beforeEach(() => {
      global.i18n = i18nModule;
      i18nModule.data = {
        en: { voucher_min_length_error: 'Voucher codes are at least {n} digits — please check the code and try again.' }
      };
      i18nModule.currentLang = 'en';

      alertsContainer = document.createElement('div');
      alertsContainer.id = 'alerts';
      document.body.appendChild(alertsContainer);
    });

    afterEach(() => {
      delete global.i18n;
    });

    test('blocks submit and shows an inline alert when the code is below the minimum', () => {
      mockForm.setAttribute('data-voucher-min-length', '4');
      mockVoucher.value = '123';
      const loginButton = document.createElement('button');
      loginButton.id = 'loginButton';
      document.body.appendChild(loginButton);

      const event = { preventDefault: jest.fn() };
      auth.onFormSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(document.getElementById('voucher-min-length-alert')).not.toBeNull();
      expect(alertsContainer.textContent).toContain('at least 4 digits');
      // the voucher was not copied into the hidden auth fields
      expect(mockUsernameInput.value).toBe('');
      // a blocked submit must not freeze the button
      expect(loginButton.disabled).toBe(false);
    });

    test('lets a code at the minimum through to the router and freezes the button', () => {
      mockForm.setAttribute('data-voucher-min-length', '4');
      mockVoucher.value = '1234';
      const loginButton = document.createElement('button');
      loginButton.id = 'loginButton';
      document.body.appendChild(loginButton);

      const event = { preventDefault: jest.fn() };
      auth.onFormSubmit(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(document.getElementById('voucher-min-length-alert')).toBeNull();
      expect(mockUsernameInput.value).toBe('1234');
      // happy path freezes the Connect button against double-taps
      expect(loginButton.disabled).toBe(true);
    });

    test('lets a longer code through — voucher lengths are variable, only the floor is enforced', () => {
      mockForm.setAttribute('data-voucher-min-length', '4');
      mockVoucher.value = '0123456789012';

      const event = { preventDefault: jest.fn() };
      auth.onFormSubmit(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockUsernameInput.value).toBe('0123456789012');
    });

    test('a short code is still accepted when no minimum is configured', () => {
      mockVoucher.value = '123';

      const event = { preventDefault: jest.fn() };
      auth.onFormSubmit(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(document.getElementById('voucher-min-length-alert')).toBeNull();
      expect(mockUsernameInput.value).toBe('123');
    });

    test('replaces a previous voucher-length alert instead of stacking them', () => {
      mockForm.setAttribute('data-voucher-min-length', '4');

      auth.onFormSubmit({ preventDefault: jest.fn() });
      auth.onFormSubmit({ preventDefault: jest.fn() });

      expect(document.querySelectorAll('#voucher-min-length-alert')).toHaveLength(1);
    });
  });

  describe('buildQrScannerUrl', () => {
    test('targets the self-hosted scanner by default and encodes the return URL', () => {
      const url = auth.buildQrScannerUrl('qr.html', 'http://10.5.50.1/login.html');
      expect(url).toBe('qr.html?return=' + encodeURIComponent('http://10.5.50.1/login.html'));
    });

    test('honors an external scanner override from config', () => {
      const url = auth.buildQrScannerUrl('https://example.org/myqr', 'http://10.5.50.1/ar/login.html');
      expect(url.startsWith('https://example.org/myqr?return=')).toBe(true);
      expect(decodeURIComponent(url.split('return=')[1])).toBe('http://10.5.50.1/ar/login.html');
    });

    test('appends with & when the target already carries a query', () => {
      const url = auth.buildQrScannerUrl('qr.html?lang=en', 'http://10.5.50.1/login.html');
      expect(url.startsWith('qr.html?lang=en&return=')).toBe(true);
    });

    test('drops the hash so the return URL is clean', () => {
      const url = auth.buildQrScannerUrl('qr.html', 'http://10.5.50.1/login.html#caps');
      expect(decodeURIComponent(url.split('return=')[1])).toBe('http://10.5.50.1/login.html');
    });
  });

  describe('mikhmon-format link cards (?username=X&password=Y)', () => {
    test('a scanned password overrides the voucher-as-password default', () => {
      mockVoucher.value = 'ahmed2015';
      mockForm.setAttribute('data-scanned-password', 'secret99');

      const event = { preventDefault: jest.fn() };
      auth.onFormSubmit(event);

      expect(mockUsernameInput.value).toBe('ahmed2015');
      expect(mockPasswordInput.value).toBe('secret99');
    });

    test('without a scanned password, the voucher is still copied (vc cards)', () => {
      mockVoucher.value = '1234567890';

      auth.onFormSubmit({ preventDefault: jest.fn() });

      expect(mockUsernameInput.value).toBe('1234567890');
      expect(mockPasswordInput.value).toBe('1234567890');
    });

    test('the scanned password wins even under voucherPasswordMode=empty', () => {
      mockVoucher.value = 'ahmed2015';
      mockForm.setAttribute('data-voucher-password-mode', 'empty');
      mockForm.setAttribute('data-scanned-password', 'secret99');

      auth.onFormSubmit({ preventDefault: jest.fn() });

      expect(mockPasswordInput.value).toBe('secret99');
    });
  });

  describe('normalizeVoucherText', () => {
    test('keeps ASCII digits', () => {
      expect(auth.normalizeVoucherText('1234567890')).toBe('1234567890');
    });

    test('converts Eastern Arabic and Persian numerals', () => {
      expect(auth.normalizeVoucherText('١٢٣٤٥')).toBe('12345');
      expect(auth.normalizeVoucherText('۰۱۲۳۴')).toBe('01234');
    });

    test('strips spaces, dashes, letters, and newlines (QR scan artifacts)', () => {
      expect(auth.normalizeVoucherText(' 12-34 ab\n')).toBe('1234');
    });

    test('handles null/undefined without throwing', () => {
      expect(auth.normalizeVoucherText(null)).toBe('');
      expect(auth.normalizeVoucherText(undefined)).toBe('');
    });
  });

  describe('beginAutoLogin', () => {
    const i18nModule = require('../../src/js/modules/i18n.js');

    let alertsContainer;

    beforeEach(() => {
      jest.useFakeTimers();
      global.i18n = i18nModule;
      i18nModule.data = {
        en: {
          auto_login_countdown: 'Auto-connecting in <strong id="auto-login-sec">{n}</strong> seconds…',
          cancel: 'Cancel'
        }
      };
      i18nModule.currentLang = 'en';

      alertsContainer = document.createElement('div');
      alertsContainer.id = 'alerts';
      document.body.appendChild(alertsContainer);
    });

    afterEach(() => {
      delete global.i18n;
      if (auth.autoLoginTimer) {
        clearInterval(auth.autoLoginTimer);
        auth.autoLoginTimer = null;
      }
      jest.useRealTimers();
    });

    test('fills the voucher, shows a cancellable countdown, and submits', () => {
      const submitSpy = jest.fn();
      mockForm.requestSubmit = submitSpy;

      auth.beginAutoLogin('9876543210');

      expect(mockVoucher.value).toBe('9876543210');
      expect(document.getElementById('auto-login-alert')).not.toBeNull();
      expect(document.getElementById('auto-login-sec').textContent).toBe('3');

      jest.advanceTimersByTime(3100);
      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(mockUsernameInput.value).toBe('9876543210');
      expect(mockPasswordInput.value).toBe('9876543210');
      expect(document.getElementById('auto-login-alert')).toBeNull();
    });

    test('the cancel button stops the countdown before submitting', () => {
      const submitSpy = jest.fn();
      mockForm.requestSubmit = submitSpy;

      auth.beginAutoLogin('9876543210');
      document.getElementById('cancel-auto-login-btn').click();

      jest.advanceTimersByTime(5000);
      expect(submitSpy).not.toHaveBeenCalled();
      expect(document.getElementById('auto-login-alert')).toBeNull();
    });

    test('replaces a previous countdown alert instead of stacking them', () => {
      mockForm.requestSubmit = jest.fn();
      auth.beginAutoLogin('1111');
      auth.beginAutoLogin('2222');
      expect(document.querySelectorAll('#auto-login-alert')).toHaveLength(1);
      expect(mockVoucher.value).toBe('2222');
    });
  });

  describe('setLoadingState', () => {
    test('freezes the Connect button with the localized connecting label', () => {
      const loginButton = document.createElement('button');
      loginButton.id = 'loginButton';
      loginButton.innerHTML = 'Sign In';
      document.body.appendChild(loginButton);

      global.i18n = { t: (key) => (key === 'login_loading' ? 'Connecting…' : key) };
      auth.setLoadingState(true);

      expect(loginButton.disabled).toBe(true);
      expect(loginButton.classList.contains('btn--loading')).toBe(true);
      expect(loginButton.innerHTML).toContain('Connecting…');
      // the original label is kept for restore
      expect(loginButton.dataset.originalHtml).toBe('Sign In');

      auth.setLoadingState(false);
      expect(loginButton.disabled).toBe(false);
      expect(loginButton.classList.contains('btn--loading')).toBe(false);
      expect(loginButton.innerHTML).toBe('Sign In');

      delete global.i18n;
    });

    test('does nothing when no Connect button exists', () => {
      expect(() => auth.setLoadingState(true)).not.toThrow();
    });
  });

  describe('chapHashOnSubmit', () => {
    afterEach(() => {
      delete global.hexMD5;
    });

    test('leaves the password untouched on un-substituted template text', () => {
      // the outer beforeEach already provides the #password mock
      const passwordInput = document.getElementById('password');
      passwordInput.value = '1234567890';

      const chapId = document.createElement('input');
      chapId.id = 'chap-id';
      chapId.value = '$(chap-id)';
      document.body.appendChild(chapId);

      const chapChallenge = document.createElement('input');
      chapChallenge.id = 'chap-challenge';
      chapChallenge.value = '$(chap-challenge)';
      document.body.appendChild(chapChallenge);

      global.hexMD5 = jest.fn(() => 'HASH');
      auth.chapHashOnSubmit();

      expect(global.hexMD5).not.toHaveBeenCalled();
      expect(passwordInput.value).toBe('1234567890');
    });

    test('hashes the final password on a genuine 32-hex RouterOS challenge', () => {
      // the outer beforeEach already provides the #password mock
      const passwordInput = document.getElementById('password');
      passwordInput.value = '1234567890';

      const chapId = document.createElement('input');
      chapId.id = 'chap-id';
      chapId.value = 'a'.repeat(32);
      document.body.appendChild(chapId);

      const chapChallenge = document.createElement('input');
      chapChallenge.id = 'chap-challenge';
      chapChallenge.value = 'b'.repeat(32);
      document.body.appendChild(chapChallenge);

      global.hexMD5 = jest.fn(() => 'HASH');
      auth.chapHashOnSubmit();

      expect(global.hexMD5).toHaveBeenCalledWith('a'.repeat(32) + '1234567890' + 'b'.repeat(32));
      expect(passwordInput.value).toBe('HASH');
    });
  });

  describe('QR Scanner & URL Params Auto-login', () => {
    test('debug window.location', () => {
      window.history.pushState({}, '', '/login?voucher=987654');
      expect(window.location.search).toBe('?voucher=987654');
    });



    test('auto-logins when voucher query parameter is present on page load', () => {
      jest.useFakeTimers();
      // Mock window.location using native history API (using relative path to keep same origin in JSDOM)
      window.history.pushState({}, '', '/login?voucher=987654');

      // The auto-login goes through submitLoginForm(), which prefers
      // requestSubmit() in real browsers (it fires the submit handlers — jsdom
      // doesn't implement it, so stub both entry points).
      const mockSubmit = jest.fn();
      mockForm.requestSubmit = mockSubmit;
      mockForm.submit = mockSubmit;

      auth.init();

      expect(mockVoucher.value).toBe('987654');

      // Fast forward timers for form submit
      jest.advanceTimersByTime(600);
      expect(mockSubmit).toHaveBeenCalled();

      // Restore location
      window.history.pushState({}, '', 'http://localhost/');
      jest.useRealTimers();
    });
  });
});