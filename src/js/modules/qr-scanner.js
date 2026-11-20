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
  _isDecoding: false,
  _scanWatchdog: null,
  _NATIVE_TIMEOUT_MS: 1500,
  _DECODE_BUDGET_MS: 2800,
  _MIN_CORE_PASSES: 4,
  _decoderCallbacks: null,

  /**
   * Toggle button loading/disabled state during QR decoding so users get
   * immediate feedback and double-taps cannot race in-flight decodes.
   * @param {boolean} isLoading
   */
  _setScanningState: function(isLoading) {
    try {
      this._isDecoding = !!isLoading;
      if (this._scanWatchdog) {
        clearTimeout(this._scanWatchdog);
        this._scanWatchdog = null;
      }
      if (typeof document === 'undefined') return;
      var btn = document.getElementById('qrScanButton');
      var galleryBtn = document.getElementById('qrGalleryButton');
      var fileInput = document.getElementById('qr-file-input');
      var galleryInput = document.getElementById('qr-gallery-input');
      var label = btn ? btn.querySelector('[data-i18n="qr_scan_btn_text"]') : null;

      if (isLoading) {
        if (btn) {
          btn.disabled = true;
          btn.setAttribute('aria-busy', 'true');
          btn.classList.add('qr-scan-btn--loading', 'qr-scan-btn--disabled');
          btn.classList.remove('qr-scan-btn--attn');
        }
        if (galleryBtn) {
          galleryBtn.disabled = true;
          galleryBtn.classList.add('qr-scan-btn--disabled');
        }
        if (fileInput) fileInput.disabled = true;
        if (galleryInput) galleryInput.disabled = true;
        if (label) {
          if (!label.dataset.origText) {
            label.dataset.origText = label.textContent;
          }
          label.textContent = (typeof i18n !== 'undefined' && i18n.t)
            ? i18n.t('qr_scan_reading')
            : 'Reading…';
        }
        var self = this;
        this._scanWatchdog = setTimeout(function() {
          self._scanWatchdog = null;
          self._setScanningState(false);
        }, 10000);
      } else {
        if (btn) {
          btn.disabled = false;
          btn.removeAttribute('aria-busy');
          btn.classList.remove('qr-scan-btn--loading', 'qr-scan-btn--disabled');
        }
        if (galleryBtn) {
          galleryBtn.disabled = false;
          galleryBtn.classList.remove('qr-scan-btn--disabled');
        }
        if (fileInput) fileInput.disabled = false;
        if (galleryInput) galleryInput.disabled = false;
        if (label) {
          var restored = (typeof i18n !== 'undefined' && i18n.t)
            ? i18n.t('qr_scan_btn_text')
            : '';
          if (restored && restored !== 'qr_scan_btn_text') {
            label.textContent = restored;
          } else if (label.dataset.origText) {
            label.textContent = label.dataset.origText;
          }
          delete label.dataset.origText;
        }
      }
    } catch (err) {
      console.error('QR scanning state error:', err);
    }
  },

  /**
   * Entry point wired to the scan button. Routes by environment:
   *  - stripped WebView → escape to the full browser immediately
   *  - any working browser → open the native camera via the file input
   */
  scanDirect: function() {
    try {
      if (this._isDecoding) return;
      if (this._isStrippedWebView()) {
        var href = (window.location.href || '').split('#')[0];
        var sep = href.indexOf('?') === -1 ? '?' : '&';
        this.escapeNow(this.buildEscapeIntentUrl(href + sep + 'qrscan=camera'));
        return;
      }
      var input = document.getElementById('qr-file-input');
      if (!input) return;
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
      galleryBtn.addEventListener('click', function(e) {
        if (self._isDecoding) {
          if (e && e.preventDefault) e.preventDefault();
          return;
        }
        if (self._isStrippedWebView()) {
          if (e && e.preventDefault) e.preventDefault();
          var href = (window.location.href || '').split('#')[0];
          var sep = href.indexOf('?') === -1 ? '?' : '&';
          self.escapeNow(self.buildEscapeIntentUrl(href + sep + 'qrscan=gallery'));
          return;
        }
        if (galleryBtn.tagName && galleryBtn.tagName.toUpperCase() === 'LABEL') {
          return;
        }
        if (galleryInput) {
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
      var hint = document.getElementById('qr-webview-hint');
      var orSep = document.getElementById('qr-hint-or');
      if (this._isStrippedWebView()) {
        if (hint) hint.style.display = 'block';
        // and the "أو" separator — scanning and typing are the two alternatives
        if (orSep) orSep.style.display = 'block';
      } else if (this._isIosCna()) {
        if (hint) {
          hint.setAttribute('data-i18n', 'qr_scan_ios_cna_hint');
          if (typeof i18n !== 'undefined' && i18n.t) {
            hint.textContent = i18n.t('qr_scan_ios_cna_hint');
          }
          hint.style.display = 'block';
        }
        if (orSep) orSep.style.display = 'block';
      }

      var params = new URLSearchParams(window.location.search);
      var scanMode = params.get('qrscan');
      var btn = document.getElementById('qrScanButton');
      var galleryBtn = document.getElementById('qrGalleryButton');
      if (scanMode === 'camera' || scanMode === '1' || scanMode === 'gallery') {
        var targetBtn = scanMode === 'gallery' ? galleryBtn : btn;
        if (targetBtn) targetBtn.classList.add('qr-scan-btn--attn');
        params.delete('qrscan');
        var qs = params.toString();
        var clean = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
        if (typeof window.history !== 'undefined' && window.history.replaceState) {
          window.history.replaceState({}, '', clean);
        }
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
   * Detect iOS Captive Network Assistant (CNA): iOS WebKit sheet that omits
   * Safari/ and third-party browser tokens and is not an installed PWA
   * (navigator.standalone !== true). Unlike Android WebView, iOS has no
   * intent:// escape, so the scanner still lets the user try the file input
   * while revealing a hint on how to switch to Safari if the camera is blocked.
   * @returns {boolean}
   */
  _isIosCna: function() {
    try {
      var ua = navigator.userAgent || '';
      var isIos = /iPhone|iPad|iPod/i.test(ua);
      var isWebKit = /AppleWebKit/i.test(ua);
      var hasFullBrowser = /Safari\/|CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|FB_IAB|Instagram|WhatsApp/i.test(ua);
      var isStandalonePwa = !!(typeof navigator !== 'undefined' && navigator.standalone === true);
      return isIos && isWebKit && !hasFullBrowser && !isStandalonePwa;
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

  _getLinkHashParams: function(parsed) {
    if (parsed.hash && parsed.hash.indexOf('=') !== -1) {
      try {
        return new URLSearchParams(parsed.hash.replace(/^#/, ''));
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  _hasLinkParam: function(parsed, names) {
    var hashParams = this._getLinkHashParams(parsed);
    for (var i = 0; i < names.length; i++) {
      if (parsed.searchParams.has(names[i])) return true;
      if (hashParams && hashParams.has(names[i])) return true;
    }
    return false;
  },

  _getLinkParam: function(parsed, names) {
    var hashParams = this._getLinkHashParams(parsed);
    for (var i = 0; i < names.length; i++) {
      var val = parsed.searchParams.get(names[i]);
      if (val) return val;
      if (hashParams) {
        val = hashParams.get(names[i]);
        if (val) return val;
      }
    }
    return '';
  },

  /**
   * Decide what a decoded QR payload means. Pure function (unit-tested).
   * Supports BOTH card formats:
   *  - Bare code cards: digits / alphanumeric codes (with optional "=" prefix or Arabic numerals).
   *  - Link cards (with or without http(s):// scheme): Mikhmon/RouterOS links carrying
   *    ?voucher= / ?code= / ?pin= or ?username= / ?user= (with optional &password= / &pass=),
   *    or plain same-host / private-IP portal URLs. Untrusted external URLs without credentials
   *    are rejected.
   * @param {string} text - decoded QR content
   * @returns {Object} {action:'navigate', url} or {action:'autologin', code[, password]}
   */
  routeScan: function(text) {
    var cleaned = String(text || '').trim();
    var hasScheme = /^https?:\/\//i.test(cleaned);
    var isProtocolRelative = /^\/\/[^\s/]+/.test(cleaned);
    var isSchemelessUrl = !hasScheme && !isProtocolRelative &&
      /^(?:localhost|\d{1,3}(?:\.\d{1,3}){3}|[a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d+)?(?:\/[^\s]*|\?[^\s]*|#[^\s]*=[^\s]*)/i.test(cleaned);

    if (hasScheme || isProtocolRelative || isSchemelessUrl) {
      // Security guard: the portal never navigates to a foreign host because
      // of a scanned payload — a swapped QR sticker pointing at a phishing
      // page must not leave the portal. Credential links (mikhmon prints
      // http://<dnsname>/login?username=X&password=Y) are handled IN PLACE:
      // the credentials belong to this network, so extract them and submit
      // on the current portal — which also keeps working when the printed
      // $dnsname no longer resolves or does not match how the user reached
      // the portal (IP vs name).
      try {
        var urlToParse = hasScheme ? cleaned : (isProtocolRelative ? ('http:' + cleaned) : ('http://' + cleaned));
        var parsed = new URL(urlToParse);
        var hostname = parsed.hostname;
        var currentHost = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';

        // 1. Credential links: extract and log in in-place. The username is
        //    kept RAW (usernames may contain letters — normalizing to digits
        //    would corrupt it); voucher/code/pin parameters are normalized.
        var voucherParam = this._getLinkParam(parsed, ['voucher', 'code', 'pin']);
        var usernameParam = this._getLinkParam(parsed, ['username', 'user']);
        var voucherFmt = (typeof auth !== 'undefined' && auth.getVoucherFormat) ? auth.getVoucherFormat() : 'numeric';
        if (voucherParam || usernameParam) {
          var code = voucherParam
            ? auth.normalizeVoucherText(voucherParam, voucherFmt)
            : String(usernameParam).trim();
          var route = { action: 'autologin', code: code };
          if (this._hasLinkParam(parsed, ['password', 'pass'])) {
            route.password = this._getLinkParam(parsed, ['password', 'pass']);
          }
          return route;
        }

        // 2. Non-credential URLs navigate only within the portal itself
        //    (same hostname or a private hotspot address) — anything else is
        //    rejected rather than navigated to.
        var isSameHost = currentHost && (hostname === currentHost);
        var isPrivateIp = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)$/.test(hostname);
        if (isSameHost || isPrivateIp) {
          return { action: 'navigate', url: hasScheme ? cleaned : parsed.href };
        }

        // Foreign URL without credentials — reject
        return { action: 'autologin', code: '' };
      } catch (urlErr) {
        // If URL parsing fails, reject
        return { action: 'autologin', code: '' };
      }
    }
    var bareFmt = (typeof auth !== 'undefined' && auth.getVoucherFormat) ? auth.getVoucherFormat() : 'numeric';

    // Compact credential-card formats (e.g. MikroTik voucher generators):
    //  1. "-<username>" -> username with an explicit empty password
    //  2. "<lenLetter><username><password>" where <lenLetter> ('a'..'z') encodes
    //     username length (1..26), e.g. "g6256868080377" -> user "6256868", pw "080377"
    var emptyPwMatch = /^-([^\s-]+)$/.exec(cleaned);
    if (emptyPwMatch) {
      var emptyPwCode = auth.normalizeVoucherText(emptyPwMatch[1], bareFmt);
      if (emptyPwCode) {
        return { action: 'autologin', code: emptyPwCode, password: '' };
      }
    }

    var lenPrefixMatch = /^([a-z])([^\s]+)$/.exec(cleaned);
    if (lenPrefixMatch) {
      var userLen = lenPrefixMatch[1].charCodeAt(0) - 96;
      var rest = lenPrefixMatch[2];
      var isNumericRest = /^[0-9]+$/.test(rest);
      if (userLen > 0 && userLen < rest.length && (bareFmt !== 'alphanumeric' || (isNumericRest && userLen >= 3))) {
        var rawUser = rest.slice(0, userLen);
        var rawPass = rest.slice(userLen);
        var parsedUser = auth.normalizeVoucherText(rawUser, 'alphanumeric');
        if (parsedUser) {
          return { action: 'autologin', code: parsedUser, password: rawPass };
        }
      }
    }

    return { action: 'autologin', code: auth.normalizeVoucherText(cleaned, bareFmt) };
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
    if (!this._decoderCallbacks) this._decoderCallbacks = [];
    if (ready) this._decoderCallbacks.push(ready);
    if (document.getElementById('jsqr-script')) {
      return;
    }
    var self = this;
    var flushCallbacks = function() {
      var queue = self._decoderCallbacks ? self._decoderCallbacks.slice() : [];
      self._decoderCallbacks = [];
      for (var i = 0; i < queue.length; i++) {
        try { queue[i](); } catch (err) {}
      }
    };
    var script = document.createElement('script');
    script.id = 'jsqr-script';
    script.src = (window.location.pathname.indexOf('/ar/') !== -1 ? '../' : '') + 'jsQR.js';
    script.onload = flushCallbacks;
    script.onerror = function() {
      // Drop the failed tag so the next scan retries the download instead of
      // waiting on a script that will never define jsQR.
      if (script.parentNode) script.parentNode.removeChild(script);
      flushCallbacks();
    };
    document.head.appendChild(script);
  },

  _handleFile: function(file) {
    if (this._isDecoding) return;
    // Try native BarcodeDetector first; lazy-load jsQR.js ONLY as fallback.
    this._decodeFile(file);
  },

  _withTimeout: function(promise, ms) {
    return new Promise(function(resolve, reject) {
      var settled = false;
      var timer = setTimeout(function() {
        if (settled) return;
        settled = true;
        resolve(null);
      }, ms);
      promise.then(function(val) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(val);
      }).catch(function(err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  },

  _detectFullWithNative: function(detector, bitmap) {
    if (!bitmap || Math.max(bitmap.width, bitmap.height) <= 2048) {
      return detector.detect(bitmap);
    }
    try {
      var scale = 2048 / Math.max(bitmap.width, bitmap.height);
      var cw = Math.max(1, Math.round(bitmap.width * scale));
      var ch = Math.max(1, Math.round(bitmap.height * scale));
      var canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, cw, ch);
      return detector.detect(canvas).then(function(barcodes) {
        canvas.width = 0;
        canvas.height = 0;
        return barcodes;
      }).catch(function(err) {
        canvas.width = 0;
        canvas.height = 0;
        throw err;
      });
    } catch (e) {
      return detector.detect(bitmap);
    }
  },

  _detectCenterWithNative: function(detector, bitmap) {
    if (!bitmap || bitmap.width <= 1200 || bitmap.height <= 1200) {
      return Promise.resolve(null);
    }
    try {
      var cw = Math.min(bitmap.width, 1200);
      var ch = Math.min(bitmap.height, 1200);
      var sx = Math.round((bitmap.width - cw) / 2);
      var sy = Math.round((bitmap.height - ch) / 2);
      var canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, sx, sy, cw, ch, 0, 0, cw, ch);
      return detector.detect(canvas).then(function(barcodes) {
        canvas.width = 0;
        canvas.height = 0;
        return (barcodes && barcodes.length > 0 && barcodes[0].rawValue)
          ? barcodes[0].rawValue
          : null;
      }).catch(function() {
        canvas.width = 0;
        canvas.height = 0;
        return null;
      });
    } catch (e) {
      return Promise.resolve(null);
    }
  },

  _decodeFile: function(file) {
    var self = this;
    this._setScanningState(true);
    util.showToast(i18n.t('qr_scan_reading'), 'info');

    // 1. Fast Native Path: BarcodeDetector API (Android Chrome 83+ & modern WebViews)
    // Uses Google Play services / OS-level Barcode Scanner (fast, robust, supports tilted/curved shots).
    // Caps giant photos to 2048px, retries on a 1:1 native center crop, enforces a 1.5s
    // timeout, and reuses the decoded ImageBitmap if falling back to jsQR.
    if (typeof window !== 'undefined' && window.BarcodeDetector) {
      try {
        var detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        var imageBitmapPromise = window.createImageBitmap ? window.createImageBitmap(file) : null;
        if (imageBitmapPromise) {
          imageBitmapPromise.then(function(bitmap) {
            var nativeChain = self._detectFullWithNative(detector, bitmap).then(function(barcodes) {
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                return barcodes[0].rawValue;
              }
              return self._detectCenterWithNative(detector, bitmap);
            });
            return self._withTimeout(nativeChain, self._NATIVE_TIMEOUT_MS).then(function(rawValue) {
              if (rawValue) {
                if (bitmap && bitmap.close) bitmap.close();
                var inputs = document.querySelectorAll('#qr-file-input, #qr-gallery-input');
                inputs.forEach(function(inp) { inp.value = ''; });
                self._setScanningState(false);
                self._handleResult(rawValue);
                return;
              }
              self._decodeWithJsQR(file, bitmap);
            }).catch(function() {
              self._decodeWithJsQR(file, bitmap);
            });
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
   * Build lightweight scale and native 1:1 tile passes for jsQR.
   * Starts with the fastest full-frame pass (600px), then 1100px, native 1:1
   * center crop, contrast-stretched passes, and corner tiles. Uses attemptBoth
   * only on the first two fast passes and dontInvert on heavier ones.
   * @param {number} w
   * @param {number} h
   * @returns {Array<Object>}
   */
  _buildDecodeAttempts: function(w, h) {
    var maxDim = Math.max(w, h);
    var cfW, cfH;
    var attempts = [
      { x: 0, y: 0, w: 1, h: 1, cap: 600, invert: 'attemptBoth' },
      { x: 0, y: 0, w: 1, h: 1, cap: 1100, invert: 'attemptBoth' },
      { x: 0.2, y: 0.2, w: 0.6, h: 0.6, cap: 900, enhance: 'brightCard', invert: 'dontInvert' }
    ];
    if (maxDim > 1100) {
      // Native 1:1 center slice (no downscaling) catches dense link QRs cleanly
      cfW = Math.min(1, 1200 / w);
      cfH = Math.min(1, 1200 / h);
      attempts.push({ x: (1 - cfW) / 2, y: (1 - cfH) / 2, w: cfW, h: cfH, cap: 1200, invert: 'dontInvert' });
    }
    // Bright-card and standard contrast stretch on medium frame and center crop for glared/dim/faded-ink photos
    attempts.push({ x: 0, y: 0, w: 1, h: 1, cap: 900, enhance: 'brightCard', invert: 'dontInvert' });
    attempts.push({ x: 0, y: 0, w: 1, h: 1, cap: 900, enhance: true, invert: 'dontInvert' });
    if (maxDim > 1100) {
      attempts.push({ x: (1 - cfW) / 2, y: (1 - cfH) / 2, w: cfW, h: cfH, cap: 1200, enhance: true, invert: 'dontInvert' });
      attempts.push({ x: 0, y: 0, w: 1, h: 1, cap: 1800, invert: 'dontInvert' });
    }
    if (w > 1800 || h > 1800) {
      // Native 1:1 quadrant slices catch small corner QRs on large 12MP card shots
      var qW = Math.min(1, 1200 / w);
      var qH = Math.min(1, 1200 / h);
      attempts.push({ x: 0, y: 0, w: qW, h: qH, cap: 1200, invert: 'dontInvert' });
      attempts.push({ x: 1 - qW, y: 0, w: qW, h: qH, cap: 1200, invert: 'dontInvert' });
      attempts.push({ x: 0, y: 1 - qH, w: qW, h: qH, cap: 1200, invert: 'dontInvert' });
      attempts.push({ x: 1 - qW, y: 1 - qH, w: qW, h: qH, cap: 1200, invert: 'dontInvert' });
    }
    return attempts;
  },

  /**
   * Stretch luminance in place (RGBA) between a lower cutoff and 98th percentile.
   * When hiFloorRatio > 0 (brightCard), clamps dark backgrounds below hi * ratio
   * to 0 so faded thermal gray ink on white paper keeps full contrast.
   * @param {Uint8ClampedArray} data - RGBA pixel buffer
   * @param {number} hiFloorRatio - minimum fraction of 98th percentile for lo (0..1)
   * @returns {boolean} true when the buffer was modified
   */
  _stretchLuminance: function(data, hiFloorRatio) {
    var hist = new Array(256);
    var i;
    for (i = 0; i < 256; i++) hist[i] = 0;
    var total = data.length / 4;
    for (i = 0; i < data.length; i += 4) {
      hist[(data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8]++;
    }
    var rawLo = 0, hi = 255, acc = 0, cut = total * 0.02;
    for (rawLo = 0; rawLo < 255; rawLo++) { acc += hist[rawLo]; if (acc >= cut) break; }
    acc = 0;
    for (hi = 255; hi > 0; hi--) { acc += hist[hi]; if (acc >= cut) break; }
    if (hi - rawLo < 16) return false;
    var lo = hiFloorRatio > 0 ? Math.max(rawLo, Math.round(hi * hiFloorRatio)) : rawLo;
    if (hi - lo < 16) return false;
    var scale = 255 / (hi - lo);
    for (i = 0; i < data.length; i += 4) {
      for (var c = 0; c < 3; c++) {
        var v = (data[i + c] - lo) * scale;
        data[i + c] = v < 0 ? 0 : (v > 255 ? 255 : v);
      }
    }
    return true;
  },

  /**
   * Stretch luminance between the 2nd and 98th percentile in place (RGBA).
   * Restores module contrast on low-contrast photos so jsQR's binarizer can
   * separate dark and light modules.
   * @param {Uint8ClampedArray} data - RGBA pixel buffer
   * @returns {boolean} true when the buffer was modified
   */
  _enhanceContrast: function(data) {
    return this._stretchLuminance(data, 0);
  },

  /**
   * Focus contrast on the upper dynamic range for white/bright paper cards
   * printed with faded thermal/gray ink over dark backgrounds.
   * @param {Uint8ClampedArray} data - RGBA pixel buffer
   * @returns {boolean} true when the buffer was modified
   */
  _enhanceBrightCard: function(data) {
    return this._stretchLuminance(data, 0.45);
  },

  /**
   * jsQR decode on a canvas. Runs progressive full-frame scales and native 1:1
   * center/quadrant tiles so both close-up codes and dense link cards shot at
   * comfortable distances decode reliably, with both inversion attempts.
   */
  _decodeWithJsQR: function(file, existingBitmap) {
    var self = this;
    this._loadDecoder(function() {
      if (typeof jsQR === 'undefined') {
        if (existingBitmap && existingBitmap.close) existingBitmap.close();
        document.querySelectorAll('#qr-file-input, #qr-gallery-input').forEach(function(input) {
          input.value = '';
        });
        self._setScanningState(false);
        util.showToast(i18n.t('qr_scan_unavailable'), 'error');
        return;
      }

      var finish = function(codeText) {
        var inputs = document.querySelectorAll('#qr-file-input, #qr-gallery-input');
        inputs.forEach(function(input) { input.value = ''; });
        self._setScanningState(false);
        if (codeText) {
          self._handleResult(codeText);
        } else {
          util.showToast(i18n.t('qr_scan_failed'), 'error');
        }
      };

      var tryScales = function(source, w, h, release) {
        var attempts = self._buildDecodeAttempts(w, h);
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        var startTime = Date.now();
        var idx = 0;
        var finished = false;
        var stepTimer = null;

        var done = function(codeText) {
          if (finished) return;
          finished = true;
          if (stepTimer) {
            clearTimeout(stepTimer);
            stepTimer = null;
          }
          canvas.width = 0;
          canvas.height = 0;
          if (release) release();
          finish(codeText);
        };

        var runNext = function() {
          if (finished) return;
          if (idx >= attempts.length ||
              (idx >= self._MIN_CORE_PASSES && (Date.now() - startTime) >= self._DECODE_BUDGET_MS)) {
            done(null);
            return;
          }
          try {
            var cfg = attempts[idx++];
            var sx = Math.round(w * cfg.x);
            var sy = Math.round(h * cfg.y);
            var sw = Math.max(1, Math.round(w * cfg.w));
            var sh = Math.max(1, Math.round(h * cfg.h));
            var scale = Math.min(1, cfg.cap / Math.max(sw, sh));
            var cw = Math.max(1, Math.round(sw * scale));
            var ch = Math.max(1, Math.round(sh * scale));
            canvas.width = cw;
            canvas.height = ch;
            ctx.drawImage(source, sx, sy, sw, sh, 0, 0, cw, ch);
            var imageData = ctx.getImageData(0, 0, cw, ch);
            if (cfg.enhance === 'brightCard') {
              self._enhanceBrightCard(imageData.data);
            } else if (cfg.enhance) {
              self._enhanceContrast(imageData.data);
            }
            var code = jsQR(imageData.data, cw, ch, { inversionAttempts: cfg.invert || 'dontInvert' });
            if (code && code.data) {
              done(code.data);
              return;
            }
            if (idx >= attempts.length) {
              done(null);
              return;
            }
            stepTimer = setTimeout(runNext, 0);
          } catch (err) {
            console.error('QR decode error:', err);
            done(null);
          }
        };

        runNext();
      };

      if (existingBitmap) {
        tryScales(existingBitmap, existingBitmap.width, existingBitmap.height, function() {
          if (existingBitmap.close) existingBitmap.close();
        });
      } else if (typeof window !== 'undefined' && window.createImageBitmap) {
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
      // A credential link (mikhmon format) carries its own password — stash
      // it for onFormSubmit (which prefers it over copying the code) and
      // clear it right after: beginAutoLogin's instant path submits
      // synchronously, so the attribute is consumed within this call, and a
      // later scan without a password must clear any previously stashed one.
      var form = document.getElementById('login-form');
      if (form) {
        if (route.password !== undefined) {
          form.setAttribute('data-scanned-password', route.password);
        } else {
          form.removeAttribute('data-scanned-password');
        }
      }
      if (route.password === undefined && typeof auth !== 'undefined' && auth._removeStorageItem) {
        auth._removeStorageItem('hotspot_last_voucher_pw');
      }
      var hasVoucherInput = !!document.getElementById('voucher');
      var hasNormalInputs = !!(document.getElementById('username') && document.getElementById('password'));
      if (!hasVoucherInput && hasNormalInputs) {
        var normalPw = route.password !== undefined ? route.password : route.code;
        auth.beginAutoLogin(route.code, true, 'normal', normalPw);
      } else {
        var voucherTab = document.querySelector('.auth-tab[data-mode="voucher"]');
        if (voucherTab && !voucherTab.classList.contains('auth-tab--active')) {
          voucherTab.click();
        }
        auth.beginAutoLogin(route.code, true);
      }
      if (form) {
        form.removeAttribute('data-scanned-password');
      }
    } catch (err) {
      console.error('QR result error:', err);
    }
  }
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = qrScanner;
}
