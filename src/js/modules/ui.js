/**
 * UI Module - Theme and language management
 * @module Hotspot.ui
 */
var ui = {
  initTheme: function() {
    try {
      // The pre-paint script in <head> already applied the saved cookie or
      // the portal's configured default theme (config.theme.defaultTheme) —
      // this only aligns the toggle icon and meta color with what is on
      // screen. No cookie = keep the pre-paint theme; a manual toggle is the
      // only thing that stores a cookie.
      var savedTheme = util.getCookie('hotspot_theme');
      var theme;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        theme = savedTheme;
        document.documentElement.setAttribute('data-theme', theme);
      } else {
        theme = document.documentElement.getAttribute('data-theme') || 'dark';
      }
      ui.updateThemeIcon(theme);
    } catch (err) {
      console.error('Init theme error:', err);
    }
  },

  toggleTheme: function() {
    try {
      var currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      util.setCookie('hotspot_theme', newTheme, 365);
      ui.updateThemeIcon(newTheme);
      util.showToast(i18n.t(newTheme === 'dark' ? 'theme_enabled_dark' : 'theme_enabled_light'), 'info', 2000);
    } catch (err) {
      console.error('Toggle theme error:', err);
    }
  },

  updateThemeIcon: function(theme) {
    try {
      var themeToggle = document.querySelector('.theme-toggle');
      if (themeToggle) {
        if (theme === 'dark') {
          themeToggle.innerHTML = '<svg class="theme-toggle__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
          themeToggle.setAttribute('aria-label', i18n.t('theme_switch_to_light'));
        } else {
          themeToggle.innerHTML = '<svg class="theme-toggle__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
          themeToggle.setAttribute('aria-label', i18n.t('theme_switch_to_dark'));
        }
      }
      // Mobile browser chrome / PWA title bar follows the theme. Reads the
      // LIVE --color-bg token so a client-branded background flows into the
      // browser chrome too (these used to be two hardcoded hex literals).
      var meta = document.getElementById('metaThemeColor');
      if (meta) {
        var bgToken = '';
        try {
          bgToken = (getComputedStyle(document.documentElement).getPropertyValue('--color-bg') || '').trim();
        } catch (metaErr) { /* keep current content */ }
        meta.setAttribute('content', bgToken || (theme === 'light' ? '#f8fafc' : '#020617'));
      }
    } catch (err) {
      console.error('Update theme icon error:', err);
    }
  },

  initLang: function() {
    try {
      var savedLang = util.getCookie('hotspot_lang');
      if (!savedLang) {
        // First visit: follow the browser's language, defaulting to Arabic.
        // RouterOS serves login.html directly to intercepted clients, so
        // this page — not index.html — is where most visitors land.
        savedLang = i18n.detectLang();
        util.setCookie('hotspot_lang', savedLang, 365);
      }

      var isArabicDir = window.location.pathname.indexOf('/ar/') !== -1;
      var redirectPath = null;

      if (savedLang === 'ar' && !isArabicDir) {
        redirectPath = ui.getRedirectPath('ar');
      } else if (savedLang === 'en' && isArabicDir) {
        redirectPath = ui.getRedirectPath('en');
      }

      // If RouterOS just rendered an error message on this page (e.g. after a failed
      // login attempt), DO NOT redirect via GET, as redirecting would lose $(error-esc).
      // Instead, keep the user on the current page and translate the error in-place.
      var errorEl = document.getElementById('errorMessage');
      var errText = errorEl ? errorEl.textContent.trim() : '';
      var hasError = errText.length > 0 && errText.indexOf('$(') === -1;

      if (redirectPath && !hasError) {
        window.location.replace(redirectPath + window.location.search);
        return;
      }

      i18n.setLang(savedLang);
      ui.translateRouterError();
    } catch (err) {
      console.error('Init lang error:', err);
    }
  },

  toggleLang: function() {
    try {
      var currentLang = document.documentElement.getAttribute('lang') || 'en';
      var newLang = currentLang === 'en' ? 'ar' : 'en';
      util.setCookie('hotspot_lang', newLang, 365);

      var redirectPath = ui.getRedirectPath(newLang);
      if (redirectPath) {
        window.location.replace(redirectPath + window.location.search);
      } else {
        i18n.setLang(newLang);
        util.showToast(newLang === 'ar' ? 'تم تغيير اللغة إلى العربية' : 'Language changed to English', 'info', 2000);
        ui.translateRouterError();
      }
    } catch (err) {
      console.error('Toggle lang error:', err);
    }
  },

  getRedirectPath: function(targetLang) {
    try {
      var path = window.location.pathname;
      var isAr = path.indexOf('/ar/') !== -1;

      if (targetLang === 'ar' && !isAr) {
        var lastSlashIdx = path.lastIndexOf('/');
        if (lastSlashIdx !== -1) {
          return path.substring(0, lastSlashIdx) + '/ar' + path.substring(lastSlashIdx);
        }
        return '/ar' + path;
      } else if (targetLang === 'en' && isAr) {
        return path.replace('/ar/', '/');
      }
    } catch (err) {
      console.error('Get redirect path error:', err);
    }
    return null;
  },

  /**
   * Translate the login error message to the current page language.
   * Thin wrapper around util.translateError(): preserves the raw error text in
   * the data-raw-error attribute so re-toggling the language re-translates
   * from the original (never from an already-translated string).
   * The keyword map is injected by the login template (window.HotspotErrorMap,
   * built from config.json radiusErrorTranslations).
   */
  translateRouterError: function() {
    try {
      var errorEl = document.getElementById('errorMessage') || document.getElementById('error-message');
      if (!errorEl) return;

      var rawError = errorEl.getAttribute('data-raw-error') || errorEl.textContent.trim();
      if (!rawError) return;
      if (!errorEl.getAttribute('data-raw-error')) {
        errorEl.setAttribute('data-raw-error', rawError);
      }

      var currentLang = document.documentElement.getAttribute('lang') || 'en';
      var map = (typeof window !== 'undefined' && window.HotspotErrorMap) || {};
      errorEl.textContent = util.translateError(rawError, map, currentLang);
    } catch (err) {
      console.error('Translate router error error:', err);
    }
  },

  initCountdown: function(seconds, elementId, callback) {
    try {
      var element = document.getElementById(elementId);
      if (!element || !seconds) return null;

      var targetEl = (element.querySelector && element.querySelector('bdi')) || element;
      var endTime = Date.now() + seconds * 1000;
      var completed = false;
      var interval = null;

      var tick = function() {
        var remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        targetEl.textContent = util.formatTime(remaining);

        if (remaining <= 0 && !completed) {
          completed = true;
          clearInterval(interval);
          if (typeof document !== 'undefined' && ui._onCountdownVisibility) {
            document.removeEventListener('visibilitychange', ui._onCountdownVisibility);
            ui._onCountdownVisibility = null;
          }
          if (callback) callback();
        }
      };

      targetEl.textContent = util.formatTime(seconds);
      interval = setInterval(tick, 1000);

      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        if (ui._onCountdownVisibility) {
          document.removeEventListener('visibilitychange', ui._onCountdownVisibility);
        }
        ui._onCountdownVisibility = function() {
          if (!document.hidden && !completed) {
            tick();
          }
        };
        document.addEventListener('visibilitychange', ui._onCountdownVisibility);
      }

      return interval;
    } catch (err) {
      console.error('Init countdown error:', err);
      return null;
    }
  },

  showAlert: function(message, type) {
    try {
      var alertsContainer = document.getElementById('alerts');
      if (!alertsContainer) return;

      var alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-' + type;
      alertDiv.setAttribute('role', 'alert');

      var iconSvg = '';
      if (type === 'error') {
        iconSvg = '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      } else if (type === 'warning') {
        iconSvg = '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      } else {
        iconSvg = '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      }

      alertDiv.innerHTML = iconSvg + '<span class="alert__text">' + util.escapeHtml(message) + '</span>';
      alertsContainer.appendChild(alertDiv);
    } catch (err) {
      console.error('Show alert error:', err);
    }
  },

  _getModalFocusable: function(modal) {
    if (!modal || typeof modal.querySelectorAll !== 'function') return [];
    var raw = modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    var list = [];
    for (var i = 0; i < raw.length; i++) {
      var el = raw[i];
      if (!el) continue;
      if (el.offsetParent === null && typeof window !== 'undefined' && typeof getComputedStyle === 'function') {
        var style = getComputedStyle(el);
        if (style && style.display === 'none') continue;
      }
      list.push(el);
    }
    return list;
  },

  _handleModalKeydown: function(e, modal, closeFn) {
    if (!e) return;
    if (e.key === 'Escape' || e.keyCode === 27) {
      closeFn();
      return;
    }
    if (e.key === 'Tab' || e.keyCode === 9) {
      var focusable = ui._getModalFocusable(modal);
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      var active = typeof document !== 'undefined' ? document.activeElement : null;
      if (e.shiftKey) {
        if (!active || active === first || (modal.contains && !modal.contains(active))) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof last.focus === 'function') last.focus();
        }
      } else if (active === last || (modal.contains && !modal.contains(active))) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof first.focus === 'function') first.focus();
      }
    }
  },

  toggleSupportModal: function() {
    try {
      var modal = document.getElementById('supportModal');
      if (!modal) return;

      var isOpen = modal.classList.contains('support-modal--open');
      if (isOpen) {
        modal.classList.remove('support-modal--open');
        if (ui._onSupportModalEsc) {
          document.removeEventListener('keydown', ui._onSupportModalEsc);
          ui._onSupportModalEsc = null;
        }
        if (ui._supportModalTrigger && typeof ui._supportModalTrigger.focus === 'function') {
          ui._supportModalTrigger.focus();
        }
        ui._supportModalTrigger = null;
      } else {
        ui._supportModalTrigger = typeof document !== 'undefined' ? document.activeElement : null;
        modal.classList.add('support-modal--open');
        ui._onSupportModalEsc = function(e) {
          ui._handleModalKeydown(e, modal, ui.toggleSupportModal);
        };
        document.addEventListener('keydown', ui._onSupportModalEsc);
        var focusable = ui._getModalFocusable(modal);
        if (focusable.length && typeof focusable[0].focus === 'function') {
          focusable[0].focus();
        }
      }
    } catch (err) {
      console.error('Toggle support modal error:', err);
    }
  },

  selectPlan: function(cardEl) {
    try {
      if (!cardEl || typeof document === 'undefined') return;
      var cards = document.querySelectorAll('.plan-card');
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('plan-card--selected');
        var btn = cards[i].querySelector ? cards[i].querySelector('.plan-card__select-btn') : null;
        if (btn) btn.setAttribute('aria-pressed', 'false');
      }

      cardEl.classList.add('plan-card--selected');
      var activeBtn = cardEl.querySelector ? cardEl.querySelector('.plan-card__select-btn') : null;
      if (activeBtn) activeBtn.setAttribute('aria-pressed', 'true');

      var planName = cardEl.getAttribute('data-plan-name') || '';
      var planQuota = cardEl.getAttribute('data-plan-quota') || '';
      var planPrice = cardEl.getAttribute('data-plan-price') || '';

      var summaryEl = document.getElementById('selected-plan-summary');
      var summaryTextEl = document.getElementById('selected-plan-summary-text') || summaryEl;
      if (summaryEl && summaryTextEl && typeof i18n !== 'undefined') {
        summaryTextEl.textContent = i18n.t('selected_plan_banner', {
          name: planName,
          quota: planQuota,
          price: planPrice
        });
        summaryEl.style.display = 'flex';
        if (typeof summaryEl.scrollIntoView === 'function') {
          try { summaryEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (scrollErr) {}
        }
      }

      var prefillMsg = (typeof i18n !== 'undefined')
        ? i18n.t('support_plan_prefill', { name: planName, quota: planQuota, price: planPrice })
        : (planName + ' - ' + planPrice);

      this._selectedPlanText = prefillMsg;
      var copyOrderBtn = document.getElementById('copy-plan-request-btn');
      if (copyOrderBtn) {
        copyOrderBtn.style.display = 'flex';
      }

      var whatsappBtns = document.querySelectorAll('.support-whatsapp-btn');
      for (var j = 0; j < whatsappBtns.length; j++) {
        var waBtn = whatsappBtns[j];
        var baseHref = waBtn.getAttribute('data-base-href') || (waBtn.getAttribute('href') || '').split('?')[0];
        if (baseHref) {
          var sep = baseHref.indexOf('?') !== -1 ? '&' : '?';
          waBtn.setAttribute('href', baseHref + sep + 'text=' + encodeURIComponent(prefillMsg));
        }
      }
    } catch (err) {
      console.error('Select plan error:', err);
    }
  },

  copySelectedPlan: function(btnEl) {
    try {
      var text = this._selectedPlanText;
      if (!text) return;

      var copyOk = function() {
        var toastMsg = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('order_copied_toast') : 'Copied!';
        if (typeof util !== 'undefined' && util.showToast) {
          util.showToast(toastMsg, 'success', 2000);
        }
        if (btnEl) {
          var span = btnEl.querySelector ? btnEl.querySelector('span') : null;
          if (span && toastMsg && toastMsg !== 'order_copied_toast') {
            var orig = span.textContent;
            span.textContent = toastMsg;
            setTimeout(function() { span.textContent = orig; }, 2000);
          }
        }
      };

      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(copyOk).catch(function() {
          if (typeof window !== 'undefined' && typeof window.copyToClipboard === 'function') {
            window.copyToClipboard(text, 'Plan');
          }
        });
      } else if (typeof window !== 'undefined' && typeof window.copyToClipboard === 'function') {
        window.copyToClipboard(text, 'Plan');
      } else {
        copyOk();
      }
    } catch (err) {
      console.error('Copy selected plan error:', err);
    }
  },

  closeSupportModalOnClickOutside: function(event) {
    try {
      var modal = document.getElementById('supportModal');
      if (modal && event.target === modal) {
        ui.toggleSupportModal();
      }
    } catch (err) {
      console.error('Close support modal click outside error:', err);
    }
  },

  destroyBackground: function() {
    try {
      var bg = ui._bgState;
      if (!bg) return;
      bg.destroyed = true;
      if (bg.rafId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(bg.rafId);
      }
      if (bg.resizeTimer) {
        clearTimeout(bg.resizeTimer);
      }
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('resize', bg.onResize);
        window.removeEventListener('mousemove', bg.onMove);
        window.removeEventListener('touchmove', bg.onMove);
        window.removeEventListener('mouseleave', bg.onLeave);
        window.removeEventListener('touchend', bg.onLeave);
      }
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', bg.onVisibilityChange);
      }
      if (bg.reducedMotionQuery && bg.onReducedMotionChange) {
        if (typeof bg.reducedMotionQuery.removeEventListener === 'function') {
          bg.reducedMotionQuery.removeEventListener('change', bg.onReducedMotionChange);
        } else if (typeof bg.reducedMotionQuery.removeListener === 'function') {
          bg.reducedMotionQuery.removeListener(bg.onReducedMotionChange);
        }
      }
      if (bg.themeObserver && typeof bg.themeObserver.disconnect === 'function') {
        bg.themeObserver.disconnect();
      }
      ui._bgState = null;
    } catch (err) {
      console.error('Destroy background error:', err);
    }
  },

  initBackground: function() {
    try {
      ui.destroyBackground();
      var canvas = document.getElementById('network-bg');
      if (!canvas) return;

      var reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
      var isReducedMotion = !!(reducedMotionQuery && reducedMotionQuery.matches);
      var isPaused = isReducedMotion || (typeof document !== 'undefined' && !!document.hidden);

      if (isReducedMotion) {
        if (canvas.style) canvas.style.display = 'none';
      }

      var ctx = null;
      var getCtx = function() {
        if (ctx) return ctx;
        try {
          ctx = canvas.getContext('2d');
        } catch (ctxErr) {
          ctx = null;
        }
        return ctx;
      };

      if (isReducedMotion && !(reducedMotionQuery && (reducedMotionQuery.addEventListener || reducedMotionQuery.addListener))) {
        return;
      }

      if (!isReducedMotion && !getCtx()) return;

      var particles = [];
      var viewportW = window.innerWidth || 360;
      var viewportH = window.innerHeight || 640;
      var isCompact = viewportW <= 768;
      var maxParticles = isCompact ? 45 : 90;
      var connectionDistance = 100;
      var connectionDistanceSq = connectionDistance * connectionDistance;
      var mouse = { x: null, y: null, radius: 130, radiusSq: 130 * 130 };
      var cachedTheme = (typeof document !== 'undefined' && document.documentElement)
        ? (document.documentElement.getAttribute('data-theme') || 'dark')
        : 'dark';

      var brandRgb = '34, 197, 94';
      try {
        var tokenRaw = (getComputedStyle(document.documentElement).getPropertyValue('--color-primary') || '').trim();
        var tokenMatch = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(tokenRaw);
        if (tokenMatch) {
          brandRgb = parseInt(tokenMatch[1], 16) + ', ' + parseInt(tokenMatch[2], 16) + ', ' + parseInt(tokenMatch[3], 16);
        }
      } catch (colorErr) { /* keep the shipped-green fallback */ }

      var applyCanvasSize = function() {
        if (!canvas) return;
        viewportW = window.innerWidth || 360;
        viewportH = window.innerHeight || 640;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewportW * dpr);
        canvas.height = Math.floor(viewportH * dpr);
        if (canvas.style) {
          canvas.style.width = viewportW + 'px';
          canvas.style.height = viewportH + 'px';
        }
        var activeCtx = isReducedMotion ? ctx : getCtx();
        if (activeCtx && typeof activeCtx.setTransform === 'function') {
          activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        isCompact = viewportW <= 768;
        maxParticles = isCompact ? 45 : 90;
      };
      applyCanvasSize();

      var resizeTimer = null;
      var onResize = function() {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applyCanvasSize, 120);
        if (ui._bgState) ui._bgState.resizeTimer = resizeTimer;
      };
      window.addEventListener('resize', onResize);

      var handleMove = function(e) {
        if (!e) return;
        var clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : undefined);
        var clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : undefined);
        if (clientX !== undefined && clientY !== undefined) {
          mouse.x = clientX;
          mouse.y = clientY;
        }
      };
      var handleLeave = function() {
        mouse.x = null;
        mouse.y = null;
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('touchmove', handleMove, { passive: true });
      window.addEventListener('mouseleave', handleLeave);
      window.addEventListener('touchend', handleLeave, { passive: true });

      var Particle = function() {
        this.x = Math.random() * viewportW;
        this.y = Math.random() * viewportH;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.size = Math.random() * 2 + 1;
      };

      Particle.prototype.update = function() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > viewportW) this.vx = -this.vx;
        if (this.y < 0 || this.y > viewportH) this.vy = -this.vy;

        if (mouse.x !== null && mouse.y !== null) {
          var dx = mouse.x - this.x;
          var dy = mouse.y - this.y;
          var distSq = dx * dx + dy * dy;
          if (distSq < mouse.radiusSq) {
            var dist = Math.sqrt(distSq);
            var force = (mouse.radius - dist) / mouse.radius;
            this.x -= dx * force * 0.02;
            this.y -= dy * force * 0.02;
          }
        }
      };

      Particle.prototype.draw = function(isLight) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? 'rgba(79, 70, 229, 0.35)' : 'rgba(59, 130, 246, 0.4)';
        ctx.fill();
      };

      for (var i = 0; i < maxParticles; i++) {
        particles.push(new Particle());
      }

      var fpsInterval = 1000 / 30;
      var lastDrawTime = Date.now();

      var bgState = {
        destroyed: false,
        rafId: null,
        resizeTimer: resizeTimer,
        onResize: onResize,
        onMove: handleMove,
        onLeave: handleLeave,
        onVisibilityChange: null,
        reducedMotionQuery: reducedMotionQuery,
        onReducedMotionChange: null,
        themeObserver: null
      };
      ui._bgState = bgState;

      if (typeof MutationObserver === 'function' && document && document.documentElement) {
        bgState.themeObserver = new MutationObserver(function() {
          cachedTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        });
        bgState.themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme']
        });
      }

      var scheduleNext = function() {
        if (bgState.destroyed || isPaused) {
          bgState.rafId = null;
          return;
        }
        bgState.rafId = requestAnimationFrame(animate);
      };

      var animate = function() {
        var activeCtx = getCtx();
        if (bgState.destroyed || isPaused || !canvas || !activeCtx) {
          bgState.rafId = null;
          return;
        }
        ctx = activeCtx;
        scheduleNext();

        var now = Date.now();
        var elapsed = now - lastDrawTime;
        if (elapsed < fpsInterval) return;
        lastDrawTime = now - (elapsed % fpsInterval);

        ctx.clearRect(0, 0, viewportW, viewportH);

        if (!bgState.themeObserver && document && document.documentElement) {
          cachedTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        }
        var isLight = cachedTheme === 'light';

        while (particles.length < maxParticles) {
          particles.push(new Particle());
        }
        if (particles.length > maxParticles) {
          particles.length = maxParticles;
        }

        for (var i = 0; i < particles.length; i++) {
          var p1 = particles[i];
          p1.update();
          p1.draw(isLight);

          if (!isCompact) {
            for (var j = i + 1; j < particles.length; j++) {
              var p2 = particles[j];
              var dx = p1.x - p2.x;
              var dy = p1.y - p2.y;
              var distSq = dx * dx + dy * dy;

              if (distSq < connectionDistanceSq) {
                var dist = Math.sqrt(distSq);
                var alpha = (1 - dist / connectionDistance) * 0.15;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = isLight
                  ? ('rgba(148, 163, 184, ' + alpha + ')')
                  : ('rgba(' + brandRgb + ', ' + alpha + ')');
                ctx.lineWidth = 0.8;
                ctx.stroke();
              }
            }
          }

          if (mouse.x !== null && mouse.y !== null) {
            var dxPointer = p1.x - mouse.x;
            var dyPointer = p1.y - mouse.y;
            var distPointerSq = dxPointer * dxPointer + dyPointer * dyPointer;
            if (distPointerSq < mouse.radiusSq) {
              var distPointer = Math.sqrt(distPointerSq);
              var alphaPointer = (1 - distPointer / mouse.radius) * 0.25;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(mouse.x, mouse.y);
              ctx.strokeStyle = isLight
                ? ('rgba(79, 70, 229, ' + alphaPointer + ')')
                : ('rgba(' + brandRgb + ', ' + alphaPointer + ')');
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
      };

      var syncPauseState = function() {
        var shouldPause = isReducedMotion || (typeof document !== 'undefined' && !!document.hidden);
        if (canvas && canvas.style) {
          canvas.style.display = isReducedMotion ? 'none' : '';
        }
        if (shouldPause) {
          isPaused = true;
          if (bgState.rafId !== null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(bgState.rafId);
            bgState.rafId = null;
          }
        } else {
          var wasPaused = isPaused;
          isPaused = false;
          if (wasPaused && !bgState.destroyed && bgState.rafId === null) {
            lastDrawTime = Date.now();
            animate();
          }
        }
      };

      bgState.onVisibilityChange = syncPauseState;
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', syncPauseState);
      }

      if (reducedMotionQuery) {
        bgState.onReducedMotionChange = function(event) {
          isReducedMotion = !!(event && event.matches);
          syncPauseState();
        };
        if (typeof reducedMotionQuery.addEventListener === 'function') {
          reducedMotionQuery.addEventListener('change', bgState.onReducedMotionChange);
        } else if (typeof reducedMotionQuery.addListener === 'function') {
          reducedMotionQuery.addListener(bgState.onReducedMotionChange);
        }
      }

      if (isReducedMotion) {
        if (canvas.style) canvas.style.display = 'none';
        return;
      }

      if (!isPaused) {
        animate();
      }
    } catch (err) {
      console.error('Init background animation error:', err);
    }
  },

  loadAnnouncements: function() {
    try {
      var isArabicDir = window.location.pathname.indexOf('/ar/') !== -1;
      var url = isArabicDir ? '../announcements.json' : './announcements.json';

      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            try {
              var data = JSON.parse(xhr.responseText);
              if (!data || !data.active) return;

              var lang = document.documentElement.getAttribute('lang') || 'en';
              var message = lang === 'ar' ? data.message_ar : data.message_en;
              if (!message) return;

              // Support both single string or array of strings
              var messages = [];
              if (Object.prototype.toString.call(message) === '[object Array]') {
                messages = message;
              } else {
                messages = [message];
              }
              if (messages.length === 0) return;

              // The operator dismissed THIS announcement (7-day cookie) — do
              // not re-show it until the message set changes (a different
              // first message means new content).
              var dismissedMsg = util.getCookie('hotspot_dismissed_msg');
              if (dismissedMsg && dismissedMsg === messages[0]) return;

              var banner = document.getElementById('announcement-banner');
              var textEl = document.getElementById('announcement-text');
              var iconEl = document.getElementById('announcement-icon');
              if (!banner || !textEl) return;

              textEl.textContent = messages[0];
              banner.className = 'announcement-banner';
              var type = data.type || 'warning';
              banner.classList.add('announcement-banner--' + type);

              if (iconEl) {
                if (type === 'warning') {
                  iconEl.innerHTML = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>';
                } else {
                  iconEl.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>';
                }
              }

              ui._currentAnnouncementMessage = messages[0];
              banner.style.display = 'flex';

              // Carousel rotation interval setup
              if (messages.length > 1) {
                ui._announcementItems = messages;
                ui._announcementIndex = 0;

                if (ui._announcementInterval) {
                  clearInterval(ui._announcementInterval);
                }

                ui._announcementInterval = setInterval(function() {
                  ui.rotateAnnouncements();
                }, 5000);
              }
            } catch (jsonErr) {
              console.error('Parse announcements JSON error:', jsonErr);
            }
          }
        }
      };
      xhr.send();
    } catch (err) {
      console.error('Load announcements error:', err);
    }
  },

  dismissAnnouncement: function() {
    try {
      var banner = document.getElementById('announcement-banner');
      if (banner) {
        banner.style.display = 'none';
      }
      if (ui._currentAnnouncementMessage) {
        util.setCookie('hotspot_dismissed_msg', ui._currentAnnouncementMessage, 7);
      }
    } catch (err) {
      console.error('Dismiss announcement error:', err);
    }
  },

  rotateAnnouncements: function() {
    try {
      var textEl = document.getElementById('announcement-text');
      if (!textEl || !ui._announcementItems || ui._announcementItems.length <= 1) return;

      textEl.classList.add('announcement-banner__text--hidden');

      setTimeout(function() {
        ui._announcementIndex = (ui._announcementIndex + 1) % ui._announcementItems.length;
        textEl.textContent = ui._announcementItems[ui._announcementIndex];
        textEl.classList.remove('announcement-banner__text--hidden');
      }, 300);
    } catch (err) {
      console.error('Rotate announcements error:', err);
    }
  },

  toggleInstallModal: function() {
    try {
      var modal = document.getElementById('installModal');
      if (!modal) return;

      var isOpen = modal.classList.contains('support-modal--open');
      if (isOpen) {
        modal.classList.remove('support-modal--open');
        if (ui._onInstallModalEsc) {
          document.removeEventListener('keydown', ui._onInstallModalEsc);
          ui._onInstallModalEsc = null;
        }
        if (ui._installModalTrigger && typeof ui._installModalTrigger.focus === 'function') {
          ui._installModalTrigger.focus();
        }
        ui._installModalTrigger = null;
      } else {
        ui._installModalTrigger = typeof document !== 'undefined' ? document.activeElement : null;
        var ua = navigator.userAgent.toLowerCase();
        var isIos = /iphone|ipad|ipod/.test(ua);
        var isAndroid = /android/.test(ua);

        var iosGuide = document.getElementById('ios-guide');
        var androidGuide = document.getElementById('android-guide');
        var genericGuide = document.getElementById('generic-guide');

        if (iosGuide && androidGuide && genericGuide) {
          iosGuide.style.display = 'none';
          androidGuide.style.display = 'none';
          genericGuide.style.display = 'none';

          if (isIos) {
            iosGuide.style.display = 'flex';
          } else if (isAndroid) {
            androidGuide.style.display = 'flex';
          } else {
            genericGuide.style.display = 'flex';
          }
        }

        modal.classList.add('support-modal--open');
        ui._onInstallModalEsc = function(e) {
          ui._handleModalKeydown(e, modal, ui.toggleInstallModal);
        };
        document.addEventListener('keydown', ui._onInstallModalEsc);
        var focusable = ui._getModalFocusable(modal);
        if (focusable.length && typeof focusable[0].focus === 'function') {
          focusable[0].focus();
        }
      }
    } catch (err) {
      console.error('Toggle install modal error:', err);
    }
  },

  closeInstallModalOnClickOutside: function(event) {
    try {
      var modal = document.getElementById('installModal');
      if (modal && event.target === modal) {
        ui.toggleInstallModal();
      }
    } catch (err) {
      console.error('Close install modal click outside error:', err);
    }
  }
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ui;
}