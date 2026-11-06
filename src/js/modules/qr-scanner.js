/**
 * QR Scanner Module - in-page voucher card scanner
 * @module Hotspot.qrScanner
 *
 * Opens an inline modal on the login page instead of navigating away. Two
 * scan paths:
 *  - Photograph the card (primary): a capture="environment" file input hands
 *    off to the phone's NATIVE camera app — no getUserMedia permission, so it
 *    works over plain HTTP, in app webviews, and everywhere file pickers work.
 *  - Live camera (progressive enhancement): browsers grant getUserMedia only
 *    on secure (HTTPS) origins, so that section appears on HTTPS hotspots
 *    only; on plain HTTP the photo path is the whole feature by design.
 *
 * Decoding uses the vendored jsqrcode decoder (llqrcode.js), lazy-loaded on
 * first open so the login page payload stays lean. Two card systems are
 * supported — see routeScan().
 */
var qrScanner = {
  _stream: null,
  _scanning: false,
  _wired: false,

  /** Show the scanner modal and prepare decoding. */
  open: function() {
    try {
      var modal = document.getElementById('qrModal');
      if (!modal) return;
      modal.classList.add('support-modal--open');
      this._wire();
      if (this._isStrippedWebView()) {
        // The system captive-portal mini-browser swallows file-input taps
        // (its WebChromeClient never implements onShowFileChooser) and
        // blocks getUserMedia — scanning cannot work here. Swap the modal
        // for an honest guide: use the phone's own camera app, or escape
        // to the full browser.
        this._showWebViewGuide();
        return;
      }
      var self = this;
      this._loadDecoder(function() {
        self._tryCamera();
      });
    } catch (err) {
      console.error('QR scanner open error:', err);
    }
  },

  /**
   * Detect the stripped Android WebView that cannot open file choosers:
   * the system captive-portal mini-browser ("Sign in to network") is a bare
   * WebView whose WebChromeClient never implements onShowFileChooser(), so
   * <input type="file"> taps are silently swallowed — verified on-device
   * (zero intents fired, no permission asked). In-app browsers (Facebook,
   * WhatsApp) DO implement the chooser, so they are excluded. WebView UA
   * markers: "; wv)" (legacy) and "Version/4.0 Chrome" (current).
   * @returns {boolean} true when the photo path cannot work
   */
  _isStrippedWebView: function() {
    try {
      var ua = navigator.userAgent || '';
      var isAndroidWebView = /;\s*wv\)/i.test(ua) || /Version\/4\.0\s+Chrome/i.test(ua);
      var inAppWithChooser = /FB_IAB|FB4A|Instagram|WhatsApp|FBAV/i.test(ua);
      return isAndroidWebView && !inAppWithChooser;
    } catch (err) {
      return false;
    }
  },

  /**
   * Build an Android intent:// URL that opens the same page in the device's
   * full browser — no package pinning, so the DEFAULT browser resolves
   * (Chrome, Samsung Internet, whatever is set), with an http fallback URL
   * for devices where the intent cannot resolve.
   * @param {string} pageUrl - absolute URL of the current page
   * @returns {string} intent:// URL, or '' when pageUrl is empty
   */
  buildEscapeIntentUrl: function(pageUrl) {
    try {
      var url = String(pageUrl || '').trim();
      if (!url) return '';
      var bare = url.replace(/^https?:\/\//i, '');
      var scheme = /^https:\/\//i.test(url) ? 'https' : 'http';
      var fallback = 'S.browser_fallback_url=' + encodeURIComponent(url);
      return 'intent://' + bare + '#Intent;scheme=' + scheme + ';' + fallback + ';end';
    } catch (err) {
      console.error('Build escape intent error:', err);
      return '';
    }
  },

  _showWebViewGuide: function() {
    try {
      var photoBtn = document.getElementById('qr-photo-btn');
      var cameraSection = document.getElementById('qr-camera-section');
      var guide = document.getElementById('qr-webview-guide');
      if (photoBtn) photoBtn.style.display = 'none';
      if (cameraSection) cameraSection.style.display = 'none';
      if (guide) guide.style.display = 'block';
    } catch (err) {
      console.error('QR webview guide error:', err);
    }
  },

  /** Hide the modal and release the camera, if one was started. */
  close: function() {
    try {
      this._stopCamera();
      var modal = document.getElementById('qrModal');
      if (modal) modal.classList.remove('support-modal--open');
      this._status('', false);
    } catch (err) {
      console.error('QR scanner close error:', err);
    }
  },

  /**
   * Decide what a decoded QR payload means. Pure function (unit-tested).
   *  - A URL payload is a link card (mikhmon format): navigate straight to
   *    it — the login URL it carries performs the login itself.
   *  - Anything else is a bare voucher code: digits only.
   * @param {string} text - decoded QR content
   * @returns {Object} {action:'navigate', url} or {action:'autologin', code}
   */
  routeScan: function(text) {
    var cleaned = String(text || '').trim();
    if (/^https?:\/\//i.test(cleaned)) {
      return { action: 'navigate', url: cleaned };
    }
    return { action: 'autologin', code: auth.normalizeVoucherText(cleaned) };
  },

  _wire: function() {
    if (this._wired) return;
    this._wired = true;
    var self = this;
    var modal = document.getElementById('qrModal');
    var closeBtn = document.getElementById('qrModalClose');
    if (closeBtn) closeBtn.addEventListener('click', function() { self.close(); });
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) self.close();
      });
      document.addEventListener('keydown', function(e) {
        if ((e.key === 'Escape' || e.keyCode === 27) && modal.classList.contains('support-modal--open')) {
          self.close();
        }
      });
    }
    var photoBtn = document.getElementById('qr-photo-btn');
    var fileInput = document.getElementById('qr-file-input');
    if (photoBtn && fileInput) {
      photoBtn.addEventListener('click', function() { fileInput.click(); });
      fileInput.addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        if (file) self._handleFile(file);
      });
    }
    var manualLink = document.getElementById('qr-type-manual');
    if (manualLink) {
      manualLink.addEventListener('click', function(e) {
        e.preventDefault();
        self.close();
        var voucherInput = document.getElementById('voucher');
        if (voucherInput) voucherInput.focus();
      });
    }
    var escapeBtn = document.getElementById('qr-escape-btn');
    if (escapeBtn) {
      escapeBtn.addEventListener('click', function() {
        var intentUrl = self.buildEscapeIntentUrl(window.location.href);
        if (intentUrl) window.location.href = intentUrl;
      });
    }
  },

  _handleFile: function(file) {
    var self = this;
    if (typeof qrcode === 'undefined') {
      this._status(i18n.t('qr_scan_unavailable'), true);
      return;
    }
    this._status(i18n.t('qr_scan_reading'), false);
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        // decode() is async for images — the result arrives via qrcode.callback
        qrcode.decode(ev.target.result);
      } catch (err) {
        console.error('QR decode error:', err);
        self._status(i18n.t('qr_scan_failed'), true);
      }
      var input = document.getElementById('qr-file-input');
      if (input) input.value = '';  // allow re-picking the same photo
    };
    reader.onerror = function() { self._status(i18n.t('qr_scan_failed'), true); };
    reader.readAsDataURL(file);
  },

  _loadDecoder: function(cb) {
    var self = this;
    if (typeof qrcode !== 'undefined') {
      qrcode.callback = function(text) { self._handleResult(text); };
      cb();
      return;
    }
    if (document.getElementById('llqrcode-script')) {
      // A previous open() is still loading it — poll briefly.
      var polls = 0;
      var timer = setInterval(function() {
        polls++;
        if (typeof qrcode !== 'undefined') {
          clearInterval(timer);
          qrcode.callback = function(text) { self._handleResult(text); };
          cb();
        } else if (polls > 50) {
          clearInterval(timer);
          self._status(i18n.t('qr_scan_unavailable'), true);
        }
      }, 100);
      return;
    }
    var script = document.createElement('script');
    script.id = 'llqrcode-script';
    script.src = (this._isArabic() ? '../' : '') + 'llqrcode.js';
    script.onload = function() {
      if (typeof qrcode !== 'undefined') {
        qrcode.callback = function(text) { self._handleResult(text); };
        cb();
      } else {
        self._status(i18n.t('qr_scan_unavailable'), true);
      }
    };
    script.onerror = function() { self._status(i18n.t('qr_scan_unavailable'), true); };
    document.head.appendChild(script);
  },

  _tryCamera: function() {
    var section = document.getElementById('qr-camera-section');
    if (!section) return;
    // getUserMedia is a secure-context-only API — a plain-HTTP hotspot never
    // reaches this, and the stripped captive-portal WebViews (iOS CNA,
    // Android "Sign in to network") never grant a camera at all.
    if (!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return;
    var self = this;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(function(stream) {
        var video = document.getElementById('qr-video');
        if (!video) {
          stream.getTracks().forEach(function(track) { track.stop(); });
          return;
        }
        self._stream = stream;
        video.srcObject = stream;
        section.style.display = 'block';
        self._scanning = true;
        self._captureLoop();
      })
      .catch(function(err) {
        console.error('QR camera error:', err);
        section.style.display = 'none';  // photo path remains
      });
  },

  _captureLoop: function() {
    var self = this;
    if (!this._scanning) return;
    var video = document.getElementById('qr-video');
    var canvas = document.getElementById('qr-canvas-work');
    if (video && canvas && video.readyState >= 2) {
      try {
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        // Feed the frame through the same image branch used for photos — a
        // proven decode path, no reliance on the library's canvas internals.
        qrcode.decode(canvas.toDataURL('image/jpeg', 0.5));
      } catch (err) { /* unreadable frame — keep scanning */ }
    }
    setTimeout(function() { self._captureLoop(); }, 400);
  },

  _stopCamera: function() {
    this._scanning = false;
    if (this._stream) {
      this._stream.getTracks().forEach(function(track) { track.stop(); });
      this._stream = null;
    }
    var video = document.getElementById('qr-video');
    if (video) video.srcObject = null;
  },

  _handleResult: function(text) {
    try {
      var route = this.routeScan(text);
      if (route.action === 'navigate') {
        window.location.href = route.url;
        return;
      }
      if (!route.code) {
        this._status(i18n.t('qr_scan_failed'), true);
        return;
      }
      var alreadyCounting = document.getElementById('auto-login-alert');
      this.close();
      if (!alreadyCounting) auth.beginAutoLogin(route.code);
    } catch (err) {
      console.error('QR result error:', err);
    }
  },

  _status: function(text, isError) {
    var el = document.getElementById('qr-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? 'var(--color-danger, #ef4444)' : 'var(--text-muted, #94a3b8)';
  },

  _isArabic: function() {
    return window.location.pathname.indexOf('/ar/') !== -1;
  }
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = qrScanner;
}
