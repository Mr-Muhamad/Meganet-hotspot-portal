/**
 * QR Scanner Module - in-page voucher card scanner
 * @module Hotspot.qrScanner
 *
 * One tap on the scan button opens the phone's NATIVE camera app via a
 * capture="environment" file input — no getUserMedia permission, works on
 * plain-HTTP hotspots and in webviews. The photo is decoded by the vendored
 * jsqrcode (llqrcode.js, lazy-loaded) and:
 *  - a bare code starts the cancellable auto-login countdown in place,
 *  - a link card (mikhmon format) navigates to the URL the QR carries.
 *
 * Inside the stripped system captive-portal WebView ("Sign in to network")
 * file inputs and the camera are OS-blocked, so the same button jumps
 * straight to the device's full browser (intent:// — Android shows its own
 * one-time confirmation screen there); the landing page carries qrscan=1 to
 * pulse the button so the user knows where to tap next.
 */
var qrScanner = {

  /**
   * Entry point wired to the scan button. Routes by environment:
   *  - stripped WebView → escape to the full browser immediately
   *  - any working browser → open the native camera via the file input
   */
  scanDirect: function() {
    try {
      if (this._isStrippedWebView()) {
        var href = (window.location.href || '').split('#')[0];
        var sep = href.indexOf('?') === -1 ? '?' : '&';
        this.escapeNow(this.buildEscapeIntentUrl(href + sep + 'qrscan=1'));
        return;
      }
      var input = document.getElementById('qr-file-input');
      if (!input) return;
      // Load the decoder in parallel with the camera app — the user needs a
      // second or two to frame the shot anyway.
      this._loadDecoder(null);
      this._wireFileInput();
      input.click();
    } catch (err) {
      console.error('QR scan error:', err);
    }
  },

  /** Attach the photo-picked listener once (the hidden input lives for the
   * whole page — its change event is the scan pipeline's entry point). */
  _wireFileInput: function() {
    if (this._fileInputWired) return;
    var input = document.getElementById('qr-file-input');
    var galleryInput = document.getElementById('qr-gallery-input');
    var self = this;

    if (input) {
      input.addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        if (file) self._handleFile(file);
      });
    }

    if (galleryInput) {
      galleryInput.addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        if (file) self._handleFile(file);
      });
    }

    var galleryBtn = document.getElementById('qrGalleryButton');
    if (galleryBtn) {
      galleryBtn.addEventListener('click', function() {
        if (self._isStrippedWebView()) {
          var href = (window.location.href || '').split('#')[0];
          var sep = href.indexOf('?') === -1 ? '?' : '&';
          self.escapeNow(self.buildEscapeIntentUrl(href + sep + 'qrscan=1'));
          return;
        }
        if (galleryInput) {
          self._loadDecoder(null);
          galleryInput.click();
        }
      });
    }

    this._fileInputWired = true;
  },

  /** Navigate to the escape target (seam for tests). */
  escapeNow: function(target) {
    if (target) window.location.href = target;
  },

  /**
   * Page-load hook: when the user lands here through the captive-portal
   * escape (qrscan=1), pulse the scan button so the next tap is obvious,
   * then strip the marker from the URL so refreshes stay clean.
   */
  onPageLoad: function() {
    try {
      this._wireFileInput();

      // If user is inside stripped captive-portal WebView, reveal the explanatory hint
      if (this._isStrippedWebView()) {
        var hint = document.getElementById('qr-webview-hint');
        if (hint) hint.style.display = 'block';
        // and the "أو" separator — scanning and typing are the two alternatives
        var orSep = document.getElementById('qr-hint-or');
        if (orSep) orSep.style.display = 'block';
      }

      var params = new URLSearchParams(window.location.search);
      var btn = document.getElementById('qrScanButton');
      if (params.get('qrscan') === '1') {
        if (btn) btn.classList.add('qr-scan-btn--attn');
        params.delete('qrscan');
        var qs = params.toString();
        var clean = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
        if (typeof window.history !== 'undefined' && window.history.replaceState) {
          window.history.replaceState({}, '', clean);
        }
      } else if (!this._isStrippedWebView() && btn) {
        // If user navigated into Chrome directly, pulse button briefly to guide eye
        btn.classList.add('qr-scan-btn--attn');
      }
    } catch (err) {
      console.error('QR page load error:', err);
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
   * @returns {boolean} true when the camera path cannot work here
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

  /**
   * Decide what a decoded QR payload means. Pure function (unit-tested).
   *  - A URL payload is a link card (mikhmon format): navigate only if it is
   *    a valid hotspot login URL (same host, private IP, or contains login path/query).
   *    If it carries a voucher query, extract the code for auto-login safely.
   *    Untrusted/malicious external URLs are rejected.
   *  - Anything else is a bare voucher code: digits only.
   * @param {string} text - decoded QR content
   * @returns {Object} {action:'navigate', url} or {action:'autologin', code}
   */
  routeScan: function(text) {
    var cleaned = String(text || '').trim();
    if (/^https?:\/\//i.test(cleaned)) {
      // Security guard: validate link cards against open-redirect phishing attacks
      try {
        var parsed = new URL(cleaned);
        var hostname = parsed.hostname;
        var currentHost = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';

        // Safe domains: same hostname, standard private hotspot IP ranges, or localhost
        var isSameHost = currentHost && (hostname === currentHost);
        var isPrivateIp = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)$/.test(hostname);
        var hasLoginParam = parsed.searchParams.has('voucher') || parsed.searchParams.has('username');
        var isLoginPath = parsed.pathname.indexOf('login') !== -1;

        if (isSameHost || isPrivateIp || hasLoginParam || isLoginPath) {
          // If the link carries username/password on a local IP/host, navigate directly so credentials pass cleanly
          if (parsed.searchParams.has('password')) {
            return { action: 'navigate', url: cleaned };
          }
          // If the link carries a bare voucher parameter on current or local portal, extract code directly
          var codeParam = parsed.searchParams.get('voucher') || parsed.searchParams.get('username');
          if (codeParam && (isSameHost || isPrivateIp)) {
            var norm = auth.normalizeVoucherText(codeParam);
            if (norm) {
              return { action: 'autologin', code: norm };
            }
          }
          return { action: 'navigate', url: cleaned };
        }

        // Suspicious external URL (not hotspot-related) — reject
        return { action: 'autologin', code: '' };
      } catch (urlErr) {
        // If URL parsing fails, reject
        return { action: 'autologin', code: '' };
      }
    }
    return { action: 'autologin', code: auth.normalizeVoucherText(cleaned) };
  },

  _loadDecoder: function(ready) {
    var self = this;
    if (typeof qrcode !== 'undefined') {
      qrcode.callback = function(text) { self._handleResult(text); };
      if (ready) ready();
      return;
    }
    if (document.getElementById('llqrcode-script')) {
      // A previous call is still loading it — poll briefly.
      var polls = 0;
      var timer = setInterval(function() {
        polls++;
        if (typeof qrcode !== 'undefined') {
          clearInterval(timer);
          qrcode.callback = function(text) { self._handleResult(text); };
          if (ready) ready();
        } else if (polls > 50) {
          clearInterval(timer);
        }
      }, 100);
      return;
    }
    var script = document.createElement('script');
    script.id = 'llqrcode-script';
    script.src = (window.location.pathname.indexOf('/ar/') !== -1 ? '../' : '') + 'llqrcode.js';
    script.onload = function() {
      if (typeof qrcode !== 'undefined') {
        qrcode.callback = function(text) { self._handleResult(text); };
      }
      if (ready) ready();
    };
    script.onerror = function() {
      if (ready) ready();
    };
    document.head.appendChild(script);
  },

  _handleFile: function(file) {
    var self = this;
    this._loadDecoder(function() { self._decodeFile(file); });
  },

  _decodeFile: function(file) {
    var self = this;
    util.showToast(i18n.t('qr_scan_reading'), 'info');

    // 1. Fast Native Path: BarcodeDetector API (Android Chrome 83+ & modern WebViews)
    // Uses Google Play services / OS-level Barcode Scanner (fast, robust, supports tilted/curved shots)
    if (typeof window !== 'undefined' && window.BarcodeDetector) {
      try {
        var detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        var imageBitmapPromise = window.createImageBitmap ? window.createImageBitmap(file) : null;
        if (imageBitmapPromise) {
          imageBitmapPromise.then(function(bitmap) {
            return detector.detect(bitmap).then(function(barcodes) {
              if (bitmap && bitmap.close) bitmap.close();
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                var input = document.getElementById('qr-file-input');
                if (input) input.value = '';
                self._handleResult(barcodes[0].rawValue);
                return true;
              }
              return false;
            });
          }).then(function(detected) {
            if (!detected) {
              // Fallback to vendored decoder if native found nothing in full image
              self._decodeFileViaJsQr(file);
            }
          }).catch(function() {
            self._decodeFileViaJsQr(file);
          });
          return;
        }
      } catch (detectorErr) {
        // Fall back to js decoder if BarcodeDetector fails or throws
      }
    }

    self._decodeFileViaJsQr(file);
  },

  _decodeFileViaJsQr: function(file) {
    var self = this;
    if (typeof qrcode === 'undefined') {
      util.showToast(i18n.t('qr_scan_unavailable'), 'error');
      return;
    }

    var cleanup = function(objectUrl) {
      if (objectUrl && typeof window !== 'undefined' && window.URL && window.URL.revokeObjectURL) {
        window.URL.revokeObjectURL(objectUrl);
      }
      var input = document.getElementById('qr-file-input');
      if (input) input.value = '';  // allow re-picking the same photo
    };

    // Use ObjectURL to avoid huge Base64 strings in memory for high-res phone camera photos
    if (typeof window !== 'undefined' && window.URL && window.URL.createObjectURL) {
      try {
        var objUrl = window.URL.createObjectURL(file);
        var origCallback = qrcode.callback;
        qrcode.callback = function(text) {
          cleanup(objUrl);
          qrcode.callback = origCallback;
          self._handleResult(text);
        };

        try {
          qrcode.decode(objUrl);
          return;
        } catch (decErr) {
          cleanup(objUrl);
          qrcode.callback = origCallback;
          console.error('QR decode error (ObjectURL):', decErr);
          util.showToast(i18n.t('qr_scan_failed'), 'error');
          return;
        }
      } catch (err) {
        // Fallback to FileReader if createObjectURL fails
      }
    }

    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        // decode() is async for images — the result arrives via qrcode.callback
        qrcode.decode(ev.target.result);
      } catch (err) {
        console.error('QR decode error:', err);
        util.showToast(i18n.t('qr_scan_failed'), 'error');
      }
      var input = document.getElementById('qr-file-input');
      if (input) input.value = '';  // allow re-picking the same photo
    };
    reader.onerror = function() {
      util.showToast(i18n.t('qr_scan_failed'), 'error');
    };
    reader.readAsDataURL(file);
  },

  _handleResult: function(text) {
    try {
      var route = this.routeScan(text);
      if (route.action === 'navigate') {
        window.location.href = route.url;
        return;
      }
      if (!route.code) {
        util.showToast(i18n.t('qr_scan_failed'), 'error');
        return;
      }
      auth.beginAutoLogin(route.code, true);
    } catch (err) {
      console.error('QR result error:', err);
    }
  }
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = qrScanner;
}
