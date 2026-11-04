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

  describe('setLoadingState', () => {
    test('enables loading state', () => {
      const submitBtn = document.createElement('button');
      submitBtn.id = 'submit-btn';
      document.body.appendChild(submitBtn);

      const spinner = document.createElement('span');
      spinner.id = 'submit-spinner';
      document.body.appendChild(spinner);

      const btnText = document.createElement('span');
      btnText.id = 'submit-text';
      document.body.appendChild(btnText);

      auth.setLoadingState(true);

      expect(submitBtn.classList.contains('btn--loading')).toBe(true);
      expect(submitBtn.disabled).toBe(true);
      expect(spinner.style.display).toBe('inline-block');
    });

    test('disables loading state', () => {
      const submitBtn = document.createElement('button');
      submitBtn.id = 'submit-btn';
      submitBtn.classList.add('btn--loading');
      submitBtn.disabled = true;
      document.body.appendChild(submitBtn);

      const spinner = document.createElement('span');
      spinner.id = 'submit-spinner';
      spinner.style.display = 'inline-block';
      document.body.appendChild(spinner);

      const btnText = document.createElement('span');
      btnText.id = 'submit-text';
      document.body.appendChild(btnText);

      auth.setLoadingState(false);

      expect(submitBtn.classList.contains('btn--loading')).toBe(false);
      expect(submitBtn.disabled).toBe(false);
      expect(spinner.style.display).toBe('none');
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

      // Mock form submit
      const mockSubmit = jest.fn();
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