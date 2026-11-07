/**
 * QR Scanner Module - in-page voucher card scanner
 * @module Hotspot.qrScanner
 *
 * One tap on the scan button opens the phone's NATIVE camera app via a
 * capture="environment" file input — no getUserMedia permission, works on
 * plain-HTTP hotspots and in webviews. The photo is decoded by the vendored
 * jsQR (jsQR.js, MIT, lazy-loaded) and:
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
    // jsQR (vendored, lazy) replaced the ancient llqrcode engine: on simulated
    // camera photos of a REAL voucher card llqrcode failed 5/5 (any JPEG noise
    // defeats it) while jsQR decoded 5/5 at every framing. jsQR is
    // synchronous — no callback wiring, just call it with ImageData.
    if (typeof jsQR !== 'undefined') {
      if (ready) ready();
      return;
    }
    if (document.getElementById('jsqr-script')) {
      // A previous call is still loading it — poll briefly.
      var polls = 0;
      var timer = setInterval(function() {
        polls++;
        if (typeof jsQR !== 'undefined' || polls > 50) {
          clearInterval(timer);
          if (ready) ready();
        }
      }, 100);
      return;
    }
    var script = document.createElement('script');
    script.id = 'jsqr-script';
    script.src = (window.location.pathname.indexOf('/ar/') !== -1 ? '../' : '') + 'jsQR.js';
    script.onload = function() { if (ready) ready(); };
    script.onerror = function() { if (ready) ready(); };
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
              self._decodeWithJsQR(file);
            }
          }).catch(function() {
            self._decodeWithJsQR(file);
          });
          return;
        }
      } catch (detectorErr) {
        // Fall back to js decoder if BarcodeDetector fails or throws
      }
    }

    self._decodeWithJsQR(file);
  },

  /**
   * jsQR decode on a canvas. Runs multi-scale (full, then half) so a small QR
   * inside a large camera photo is still found, with both inversion attempts
   * for dark-on-light and light-on-dark codes. Both hidden pickers are always
   * reset so re-picking the same photo fires the change event again.
   */
  _decodeWithJsQR: function(file) {
    var self = this;
    this._loadDecoder(function() {
      if (typeof jsQR === 'undefined') {
        util.showToast(i18n.t('qr_scan_unavailable'), 'error');
        return;
      }

      var finish = function(codeText) {
        var inputs = document.querySelectorAll('#qr-file-input, #qr-gallery-input');
        inputs.forEach(function(input) { input.value = ''; });
        if (codeText) {
          self._handleResult(codeText);
        } else {
          util.showToast(i18n.t('qr_scan_failed'), 'error');
        }
      };

      var tryScales = function(source, w, h, release) {
        var scales = [1, 0.5];
        for (var i = 0; i < scales.length; i++) {
          var scale = scales[i] * Math.min(1, 1200 / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(source, 0, 0, cw, ch);
          var imageData = ctx.getImageData(0, 0, cw, ch);
          var code = jsQR(imageData.data, cw, ch, { inversionAttempts: 'attemptBoth' });
          if (code && code.data) {
            if (release) release();
            finish(code.data);
            return;
          }
        }
        if (release) release();
        finish(null);
      };

      if (typeof window !== 'undefined' && window.createImageBitmap) {
        window.createImageBitmap(file).then(function(bitmap) {
          tryScales(bitmap, bitmap.width, bitmap.height, function() {
            if (bitmap.close) bitmap.close();
          });
        }).catch(function() {
          self._decodeViaImageElement(file, tryScales, finish);
        });
      } else {
        self._decodeViaImageElement(file, tryScales, finish);
      }
    });
  },

  /** Image-element decode fallback for environments without createImageBitmap. */
  _decodeViaImageElement: function(file, tryScales, finish) {
    var url = (typeof window !== 'undefined' && window.URL && window.URL.createObjectURL)
      ? window.URL.createObjectURL(file)
      : null;
    var img = new Image();
    img.onload = function() {
      tryScales(img, img.naturalWidth || img.width, img.naturalHeight || img.height, function() {
        if (url && window.URL.revokeObjectURL) window.URL.revokeObjectURL(url);
      });
    };
    img.onerror = function() {
      if (url && window.URL.revokeObjectURL) window.URL.revokeObjectURL(url);
      finish(null);
    };
    if (url) {
      img.src = url;
    } else {
      var reader = new FileReader();
      reader.onload = function(ev) { img.src = ev.target.result; };
      reader.onerror = function() { finish(null); };
      reader.readAsDataURL(file);
    }
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
