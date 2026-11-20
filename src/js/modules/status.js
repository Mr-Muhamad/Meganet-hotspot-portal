/**
 * Status Module - Session status display
 * @module Hotspot.status
 */
var statusModule = {
  _pwaHideTimer: null,
  _uptimeInterval: null,
  _countdownInterval: null,
  _autoRefreshInterval: null,
  _autoRefreshSeconds: 0,
  _autoRefreshRemaining: 0,
  _autoRefreshNextAt: 0,
  _autoRefreshWaiting: false,
  _isRefreshing: false,
  _isCheckingConnection: false,
  _onAutoRefreshVisibility: null,

  init: function() {
    try {
      statusModule._stopAutoRefresh();
      statusModule.startCountdowns();
      statusModule.startUptimeTicker();
      statusModule.showWarnings();
      statusModule.calculateRemainingQuota();
      // Auto-check measures the LOCAL router latency only — the upstream
      // internet probe (a 4 s hanging external request when the WAN is down,
      // waking the phone's radio) runs on explicit tap, not on every visit.
      statusModule.checkConnectionQuality(true);
      statusModule.displayDeviceType();
      statusModule._startAutoRefresh();

      if (typeof rateLimiter !== 'undefined') {
        rateLimiter.clearAll();
      }

      // Decode MAC address from URL-encoded format on load in all matching elements
      var macEls = document.querySelectorAll('#tech-mac, #stat-mac');
      macEls.forEach(function(macEl) {
        var target = (macEl.querySelector && macEl.querySelector('bdi')) || macEl;
        var rawMac = target.textContent.trim();
        try {
          target.textContent = decodeURIComponent(rawMac);
        } catch (macErr) {
          target.textContent = rawMac.replace(/%3A/gi, ':');
        }
      });

      var techMacTarget = document.querySelector('#tech-mac bdi') || document.getElementById('tech-mac');
      var macTypeEl = document.getElementById('status-mac-type');
      if (techMacTarget && macTypeEl) {
        var cleanMac = techMacTarget.textContent.trim().replace(/[:-]/g, '');
        if (cleanMac.length === 12 && /^[0-9A-Fa-f]{12}$/.test(cleanMac)) {
          var secondChar = cleanMac.charAt(1).toUpperCase();
          var isRandom = ['2', '6', 'A', 'E'].indexOf(secondChar) !== -1;
          var macLang = document.documentElement.getAttribute('lang') || 'en';
          macTypeEl.textContent = isRandom
            ? (macLang === 'ar' ? '(عشوائي)' : '(Random)')
            : (macLang === 'ar' ? '(الجهاز)' : '(Device)');
          macTypeEl.classList.add(isRandom ? 'mac-type-display--random' : 'mac-type-display--device');
        }
      }

      // Decode username from URL-encoded format in all matching elements
      var userEls = document.querySelectorAll('#tech-username, #stat-username');
      userEls.forEach(function(userEl) {
        var target = (userEl.querySelector && userEl.querySelector('bdi')) || userEl;
        var rawUser = target.textContent.trim();
        try {
          target.textContent = decodeURIComponent(rawUser);
        } catch (userErr) {
          target.textContent = rawUser.replace(/%3A/gi, ':');
        }
      });

      var userEl = document.getElementById('tech-username') || document.getElementById('stat-username');
      var usernameVal = userEl ? userEl.textContent.trim() : '';
      var macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      var switchCardLink = document.getElementById('switchCardLink');
      var loginByEl = document.getElementById('tech-login-by');
      var rawLoginBy = (loginByEl && loginByEl.textContent)
        ? loginByEl.textContent.trim()
        : (switchCardLink ? String(switchCardLink.getAttribute('data-login-by') || '').trim() : '');
      var loginByVal = (rawLoginBy && rawLoginBy.indexOf('$(') === -1) ? rawLoginBy.toLowerCase() : '';
      var isMacLogin = Boolean((usernameVal && macRegex.test(usernameVal)) || loginByVal === 'mac');

      if (isMacLogin) {
        var logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
          logoutBtn.style.display = 'none';
        }
        if (switchCardLink) {
          switchCardLink.style.display = 'none';
          switchCardLink.hidden = true;
        }
        var plansCompact = document.querySelector ? document.querySelector('.plans-link-compact') : null;
        if (plansCompact && !document.getElementById('viewPlansLink')) {
          plansCompact.style.display = 'none';
        }
      } else if (usernameVal && usernameVal.indexOf('$(') !== 0) {
        statusModule._recordVoucherHistory(usernameVal);
      }

      // Show PWA banner on load for 5s unless already running inside installed PWA
      var isStandalonePwa = false;
      try {
        isStandalonePwa = Boolean(
          (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
          (typeof navigator !== 'undefined' && navigator.standalone === true)
        );
      } catch (pwaErr) {}
      var pwaBanner = document.getElementById('pwaBanner');
      if (pwaBanner && !isStandalonePwa) {
        if (statusModule._pwaHideTimer) {
          clearTimeout(statusModule._pwaHideTimer);
          statusModule._pwaHideTimer = null;
        }
        pwaBanner.style.display = 'block';
        statusModule._pwaHideTimer = setTimeout(function() {
          statusModule._pwaHideTimer = null;
          var activeBanner = document.getElementById('pwaBanner');
          if (activeBanner) {
            activeBanner.style.display = 'none';
          }
        }, 5000);
      }

      // Two-step logout confirmation guard to prevent accidental disconnects
      var logoutBtnEl = document.getElementById('logout-btn');
      var confirmBar = document.getElementById('logout-confirm-bar');
      var confirmYes = document.getElementById('logout-confirm-yes');
      var confirmCancel = document.getElementById('logout-confirm-cancel');
      if (logoutBtnEl && confirmBar) {
        logoutBtnEl.addEventListener('click', function(e) {
          if (confirmBar.hidden) {
            e.preventDefault();
            confirmBar.hidden = false;
            var targetHref = logoutBtnEl.getAttribute('href');
            if (confirmYes && targetHref) {
              confirmYes.setAttribute('href', targetHref);
            }
          }
        });
        if (confirmCancel) {
          confirmCancel.addEventListener('click', function() {
            confirmBar.hidden = true;
          });
        }
      }
    } catch (err) {
      console.error('Status init error:', err);
    }
  },

  calculateRemainingQuota: function() {
    try {
      var quotaSection = document.getElementById('sessionCountdownSection');
      var quotaValueEl = document.getElementById('session-countdown');
      var downloadEl = document.getElementById('stat-download');
      var uploadEl = document.getElementById('stat-upload');
      var quotaRemainingProgressFill = document.getElementById('quota-remaining-progress-fill');
      var quotaRemainingPercentage = document.getElementById('quota-remaining-percentage');
      var smartUsageTip = document.getElementById('smart-usage-tip');
      var smartUsageActivities = document.getElementById('smart-usage-activities');
      var browsingHoursEl = document.getElementById('browsing-hours');

      if (quotaSection) {
        var limit = parseInt(quotaSection.getAttribute('data-limit-bytes-total')) || 0;
        var bytesIn = parseInt(quotaSection.getAttribute('data-bytes-in')) || 0;
        var bytesOut = parseInt(quotaSection.getAttribute('data-bytes-out')) || 0;
        var totalUsed = bytesIn + bytesOut;

        // Update download and upload values
        if (downloadEl) {
          var dlTarget = (downloadEl.querySelector && downloadEl.querySelector('bdi')) || downloadEl;
          dlTarget.textContent = util.formatBytes(bytesOut); // bytesOut = Download
        }
        if (uploadEl) {
          var ulTarget = (uploadEl.querySelector && uploadEl.querySelector('bdi')) || uploadEl;
          ulTarget.textContent = util.formatBytes(bytesIn);  // bytesIn = Upload
        }

        // Update remaining quota header value
        var currentLang = document.documentElement.getAttribute('lang') || 'en';
        var kbBase = parseInt(quotaSection.getAttribute('data-kb-base')) || 1000;
        var rawRemainAttr = quotaSection.getAttribute('data-remain-bytes-total');
        var remainAttrTrimmed = rawRemainAttr ? String(rawRemainAttr).trim() : '';
        var hasRemainAttr = remainAttrTrimmed.length > 0 && remainAttrTrimmed.indexOf('$(') === -1 && /^\d+$/.test(remainAttrTrimmed);
        var parsedRemainAttr = hasRemainAttr ? parseInt(remainAttrTrimmed, 10) : NaN;
        var remaining = 0;
        if (limit > 0) {
          remaining = (!isNaN(parsedRemainAttr) && parsedRemainAttr >= 0)
            ? Math.min(limit, parsedRemainAttr)
            : Math.max(0, limit - totalUsed);
        }
        var percentRemaining = limit > 0 ? Math.min(100, Math.max(0, (remaining / limit) * 100)) : 0;

        if (quotaValueEl) {
          if (limit > 0) {
            var format = quotaSection.getAttribute('data-quota-format') || 'MB';
            var gbThreshold = kbBase * kbBase * kbBase;
            // kbBase fallback matches the shipped config default (1000,
            // the commercial convention for voucher cards). Smart-scale to GB
            // once remaining reaches >= 1 GB so huge MB numbers stay readable.
            if (format.toUpperCase() === 'GB' || remaining >= gbThreshold) {
              var remainingGB = (remaining / gbThreshold).toFixed(2).replace(/\.00$/, '');
              var gbText = currentLang === 'ar' ? 'جيجا' : 'GB';
              quotaValueEl.textContent = remainingGB + ' ' + gbText;
            } else {
              var remainingMB = (remaining / (kbBase * kbBase)).toFixed(0);
              var mbText = currentLang === 'ar' ? 'ميجا' : 'MB';
              quotaValueEl.textContent = remainingMB + ' ' + mbText;
            }
          } else {
            quotaValueEl.textContent = currentLang === 'ar' ? 'غير محدود' : 'Unlimited';
          }
        }

        // Update remaining progress bar and percentage
        var progressContainer = document.getElementById('quota-progress-container');
        if (progressContainer) {
          progressContainer.style.display = limit > 0 ? '' : 'none';
        }
        if (limit > 0) {
          if (quotaRemainingProgressFill) {
            quotaRemainingProgressFill.style.width = percentRemaining + '%';
            quotaRemainingProgressFill.setAttribute('data-progress', percentRemaining);
            
            // Adjust color classes based on remaining thresholds (warning if < 25%, danger if < 10%)
            quotaRemainingProgressFill.className = 'progress-bar__fill progress-bar__fill--animated';
            if (percentRemaining <= 10) {
              quotaRemainingProgressFill.classList.add('progress-bar__fill--danger');
            } else if (percentRemaining <= 25) {
              quotaRemainingProgressFill.classList.add('progress-bar__fill--warning');
            }
          }

          if (quotaRemainingPercentage) {
            var percentFormatted = Math.round(percentRemaining);
            quotaRemainingPercentage.textContent = percentFormatted + '% ' + i18n.t('remaining');
          }

          // Apply warning/danger styles to the value text too
          if (quotaValueEl) {
            quotaValueEl.className = 'session-countdown__value';
            if (percentRemaining <= 10) {
              quotaValueEl.classList.add('session-countdown__value--danger');
            } else if (percentRemaining <= 25) {
              quotaValueEl.classList.add('session-countdown__value--warning');
            }
          }
        }

        // Update smart usage assistant card
        var isAr = currentLang === 'ar';
        if (smartUsageTip) {
          if (limit > 0) {
            var tipText = '';
            if (percentRemaining >= 50) {
              tipText = isAr 
                ? 'باقي رصيدك وفير جداً! يمكنك الاستمتاع بمشاهدة الفيديوهات والتصفح بحرية.' 
                : 'Your remaining balance is abundant! Feel free to stream videos and browse.';
            } else if (percentRemaining >= 20) {
              tipText = isAr 
                ? 'باقي رصيدك متوسط. ننصحك بجودة متوسطة للفيديوهات لتوفير الرصيد.' 
                : 'Your balance is moderate. We suggest medium quality for videos to save data.';
            } else {
              tipText = isAr 
                ? 'رصيدك منخفض جداً! يرجى إيقاف التحميلات التلقائية وتجنب تشغيل الفيديوهات للحفاظ عليه.' 
                : 'Your balance is very low! Stop auto-downloads and avoid videos to save quota.';
            }
            smartUsageTip.textContent = tipText;

            var videoSdEl = document.getElementById('video-sd-hours');
            var videoHdEl = document.getElementById('video-hd-hours');

            if (smartUsageActivities && browsingHoursEl && videoSdEl && videoHdEl) {
              smartUsageActivities.style.display = 'block';
              var socialBytesPerHour = 100 * kbBase * kbBase;
              var videoSdBytesPerHour = 250 * kbBase * kbBase;
              var videoHdBytesPerHour = 900 * kbBase * kbBase;

              var browsingVal = remaining / socialBytesPerHour;
              var videoSdVal = remaining / videoSdBytesPerHour;
              var videoHdVal = remaining / videoHdBytesPerHour;

              browsingHoursEl.textContent = statusModule.formatEstimate(browsingVal, isAr);
              videoSdEl.textContent = statusModule.formatEstimate(videoSdVal, isAr);
              videoHdEl.textContent = statusModule.formatEstimate(videoHdVal, isAr);
            }
          } else {
            smartUsageTip.textContent = isAr 
              ? 'باقي رصيدك غير محدود! استمتع بالتصفح والتحميل بلا قيود.' 
              : 'Your balance is unlimited! Enjoy browsing and downloading without limits.';
            if (smartUsageActivities) {
              smartUsageActivities.style.display = 'none';
            }
          }
        }
      }
    } catch (err) {
      console.error('Calculate remaining quota error:', err);
    }
  },

  formatEstimate: function(hours, isAr) {
    if (hours <= 0) {
      return isAr ? 'منتهي' : 'Expired';
    }
    var totalMinutes = Math.round(hours * 60);
    if (totalMinutes < 1) {
      return isAr ? 'أقل من دقيقة' : '< 1 min';
    }
    
    var hrs = Math.floor(totalMinutes / 60);
    if (hrs > 99) {
      return isAr ? '+99 ساعة' : '99+ hrs';
    }
    var mins = totalMinutes % 60;
    
    if (hrs > 0) {
      if (mins > 0) {
        return isAr 
          ? hrs + ' ساعة و ' + mins + ' دقيقة' 
          : hrs + ' hrs ' + mins + ' min';
      } else {
        return isAr 
          ? hrs + ' ساعة' 
          : hrs + ' hrs';
      }
    } else {
      return isAr 
        ? mins + ' دقيقة' 
        : mins + ' min';
    }
  },

  parseTimeValue: function(timeStr) {
    if (!timeStr) return 0;
    timeStr = timeStr.toString().trim();
    
    // If it's already a clean number of seconds
    if (/^\d+$/.test(timeStr)) {
      return parseInt(timeStr, 10);
    }
    
    var seconds = 0;

    // Check for weeks (e.g. "4w2d12:30:20")
    var weekMatch = timeStr.match(/(\d+)w/);
    if (weekMatch) {
      seconds += parseInt(weekMatch[1], 10) * 604800;
      timeStr = timeStr.replace(/(\d+)w/, '');
    }

    // Check for days (e.g. "1d" or "1d12:30:20")
    var dayMatch = timeStr.match(/(\d+)d/);
    if (dayMatch) {
      seconds += parseInt(dayMatch[1], 10) * 86400;
      // Strip days part to parse the rest
      timeStr = timeStr.replace(/(\d+)d/, '');
    }
    
    // Check for RouterOS shorthand format (e.g. 2h30m or 10m5s)
    var hourMatch = timeStr.match(/(\d+)h/);
    if (hourMatch) seconds += parseInt(hourMatch[1], 10) * 3600;
    var minMatch = timeStr.match(/(\d+)m/);
    if (minMatch) seconds += parseInt(minMatch[1], 10) * 60;
    var secMatch = timeStr.match(/(\d+)s/);
    if (secMatch) seconds += parseInt(secMatch[1], 10);
    
    // If we matched any shorthand (h, m, s) and we processed them
    if (hourMatch || minMatch || secMatch) {
      return seconds;
    }
    
    // Otherwise, check for HH:MM:SS format (which now has weeks/days stripped)
    var parts = timeStr.split(':');
    if (parts.length === 3) {
      var p0 = parseInt(parts[0], 10);
      var p1 = parseInt(parts[1], 10);
      var p2 = parseInt(parts[2], 10);
      if (isNaN(p0) || isNaN(p1) || isNaN(p2)) return seconds;
      seconds += (p0 * 3600) + (p1 * 60) + p2;
      return seconds;
    } else if (parts.length === 2) {
      var m0 = parseInt(parts[0], 10);
      var m1 = parseInt(parts[1], 10);
      if (isNaN(m0) || isNaN(m1)) return seconds;
      seconds += (m0 * 60) + m1;
      return seconds;
    }
    
    return seconds || parseInt(timeStr, 10) || 0;
  },

  dismissPwaBanner: function() {
    try {
      if (statusModule._pwaHideTimer) {
        clearTimeout(statusModule._pwaHideTimer);
        statusModule._pwaHideTimer = null;
      }
      var pwaBanner = document.getElementById('pwaBanner');
      if (pwaBanner) {
        pwaBanner.style.display = 'none';
      }
    } catch (err) {
      console.error('Dismiss PWA banner error:', err);
    }
  },

  startCountdowns: function() {
    try {
      if (statusModule._countdownInterval) {
        clearInterval(statusModule._countdownInterval);
        statusModule._countdownInterval = null;
      }
      var timeLeftElement = document.getElementById('session-time-left');
      if (timeLeftElement) {
        var rawVal = timeLeftElement.getAttribute('data-seconds') || timeLeftElement.textContent;
        var timeLeft = statusModule.parseTimeValue(rawVal);
        if (timeLeft > 0) {
          timeLeftElement.setAttribute('data-seconds', timeLeft);
          statusModule._countdownInterval = ui.initCountdown(timeLeft, 'session-time-left', function() {
            statusModule.logoutOnExpiry();
          });
        } else {
          var timeTarget = (timeLeftElement.querySelector && timeLeftElement.querySelector('bdi')) || timeLeftElement;
          timeTarget.textContent = '--';
        }
      }
    } catch (err) {
      console.error('Start countdowns error:', err);
    }
  },

  startUptimeTicker: function() {
    try {
      if (statusModule._uptimeInterval) {
        clearInterval(statusModule._uptimeInterval);
        statusModule._uptimeInterval = null;
      }
      var uptimeElement = document.getElementById('uptime');
      if (!uptimeElement) return;

      var rawUptime = uptimeElement.getAttribute('data-seconds') || uptimeElement.textContent;
      var startUptime = statusModule.parseTimeValue(rawUptime);
      var startTime = Date.now();
      var initialText = uptimeElement.textContent || '';

      var timeLeftElement = document.getElementById('session-time-left');
      var rawTimeLeft = timeLeftElement ? (timeLeftElement.getAttribute('data-seconds') || timeLeftElement.textContent) : '';
      var startTimeLeft = timeLeftElement ? statusModule.parseTimeValue(rawTimeLeft) : 0;

      // Update time progress on load
      if (startTimeLeft > 0) {
        statusModule.updateTimeProgress(startTimeLeft);
      }

      statusModule._uptimeInterval = setInterval(function() {
        var elapsed = Math.floor((Date.now() - startTime) / 1000);
        var currentUptime = startUptime + elapsed;
        var uptimeTarget = (uptimeElement.querySelector && uptimeElement.querySelector('bdi')) || uptimeElement;
        if (currentUptime > 0) {
          uptimeTarget.textContent = util.formatUptime(currentUptime);
          uptimeElement.setAttribute('data-seconds', currentUptime);
        } else if (initialText) {
          uptimeTarget.textContent = initialText;
        }

        if (startTimeLeft > 0) {
          var currentRemaining = startTimeLeft - elapsed;
          if (currentRemaining < 0) currentRemaining = 0;
          statusModule.updateTimeProgress(currentRemaining);
          statusModule.checkExpiryThresholds(currentRemaining);
        }
      }, 1000);
    } catch (err) {
      console.error('Start uptime ticker error:', err);
    }
  },

  updateTimeProgress: function(timeLeft) {
    try {
      var uptimeEl = document.getElementById('uptime');
      var progressContainer = document.getElementById('time-remaining-progress-container');
      var progressFill = document.getElementById('time-remaining-progress-fill');
      
      if (uptimeEl && progressContainer && progressFill) {
        var uptimeRaw = parseInt(uptimeEl.getAttribute('data-seconds')) || 0;
        // Total allowed = current uptime + remaining time
        var totalAllowed = uptimeRaw + timeLeft;
        if (totalAllowed > 0) {
          var percentRemaining = (timeLeft / totalAllowed) * 100;
          percentRemaining = Math.min(100, Math.max(0, percentRemaining));
          
          progressContainer.style.display = 'block';
          progressFill.style.width = percentRemaining + '%';
          
          // Color coding for time remaining
          progressFill.className = 'progress-bar__fill progress-bar__fill--animated';
          if (percentRemaining <= 10) {
            progressFill.classList.add('progress-bar__fill--danger');
          } else if (percentRemaining <= 25) {
            progressFill.classList.add('progress-bar__fill--warning');
          }
        }
      }
    } catch (err) {
      console.error('Update time progress error:', err);
    }
  },

  toggleTechDetails: function() {
    try {
      var trigger = document.querySelector('.tech-details__trigger');
      var content = document.getElementById('techDetailsContent');
      if (trigger && content) {
        var isExpanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', !isExpanded);
        content.hidden = isExpanded;
      }
    } catch (err) {
      console.error('Toggle tech details error:', err);
    }
  },

  copyDiagnosticInfo: function(btnEl) {
    try {
      var readText = function(selector) {
        var el = document.querySelector(selector);
        return el ? el.textContent.trim() : '';
      };
      var lines = [];
      var user = readText('#stat-username bdi') || readText('#stat-username');
      var ip = readText('#stat-ip bdi') || readText('#stat-ip');
      var mac = readText('#tech-mac bdi') || readText('#tech-mac');
      var macType = readText('#status-mac-type');
      var os = readText('#device-os-display');
      var loginBy = readText('#tech-login-by');
      var server = readText('#tech-server');
      var idleTimeout = readText('#tech-idle-timeout');
      var uptime = readText('#uptime bdi') || readText('#uptime');

      if (user) lines.push('User: ' + user);
      if (ip) lines.push('IP: ' + ip);
      if (mac) lines.push('MAC: ' + mac + (macType ? ' ' + macType : ''));
      if (os && os !== '--') lines.push('Device: ' + os);
      if (loginBy && loginBy !== '--') lines.push('Login: ' + loginBy);
      if (server && server !== '--') lines.push('Server: ' + server);
      if (idleTimeout && idleTimeout !== '--') lines.push('Idle Timeout: ' + idleTimeout);
      if (uptime) lines.push('Uptime: ' + uptime);

      var summary = lines.join('\n');
      if (!summary) return;

      var notifyOk = function() {
        var msg = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('diagnostics_copied') : 'Copied!';
        if (typeof util !== 'undefined' && util.showToast) {
          util.showToast(msg, 'success', 2000);
        }
        if (btnEl) {
          var span = btnEl.querySelector ? btnEl.querySelector('span') : null;
          if (span && msg && msg !== 'diagnostics_copied') {
            var orig = span.textContent;
            span.textContent = msg;
            setTimeout(function() { span.textContent = orig; }, 2000);
          }
        }
      };

      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(summary).then(notifyOk).catch(function() {
          if (typeof window !== 'undefined' && typeof window.copyToClipboard === 'function') {
            window.copyToClipboard(summary, 'Diagnostics');
          }
        });
      } else if (typeof window !== 'undefined' && typeof window.copyToClipboard === 'function') {
        window.copyToClipboard(summary, 'Diagnostics');
      } else {
        notifyOk();
      }
    } catch (err) {
      console.error('Copy diagnostic info error:', err);
    }
  },

  displayDeviceType: function() {
    try {
      var displayEl = document.getElementById('device-os-display');
      if (!displayEl) return;
      
      var ua = navigator.userAgent;
      var device = "Unknown Device";
      var os = "Unknown OS";

      // Detect OS
      if (/windows phone/i.test(ua)) os = "Windows Phone";
      else if (/android/i.test(ua)) os = "Android";
      else if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) os = "iOS";
      else if (/macintosh|mac os x/i.test(ua)) os = "Mac OS";
      else if (/windows/i.test(ua)) os = "Windows";
      else if (/linux/i.test(ua)) os = "Linux";

      // Detect Device Type
      if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) device = "Tablet";
      else if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) device = "Mobile";
      else device = "Desktop";

      // Simple formatting
      var finalName = os;
      if (os === "iOS" && device === "Mobile") finalName = "iPhone";
      else if (os === "iOS" && device === "Tablet") finalName = "iPad";
      else if (os === "Mac OS" && device === "Desktop") finalName = "MacBook / Mac";
      else finalName = os + " " + device;

      displayEl.textContent = finalName;
    } catch (err) {
      console.error('Display device type error:', err);
    }
  },

  /**
   * @param {boolean} isAutoCheck - true when invoked from init: measure the
   *   local router latency only and skip the upstream internet probe (the
   *   card's hint invites an explicit tap for the full check).
   */
  checkConnectionQuality: function(isAutoCheck) {
    try {
      var valEl = document.getElementById('connection-status-val');
      if (!valEl) return;

      valEl.textContent = i18n.t('status_checking');
      valEl.className = 'stat-card__value';

      if (typeof fetch === 'undefined') {
        statusModule._isCheckingConnection = false;
        valEl.textContent = i18n.t('status_offline');
        valEl.classList.add('color-danger');
        return;
      }

      statusModule._isCheckingConnection = true;
      var startTime = Date.now();

      // Fetch a small local resource to measure round-trip time (ping)
      // Arabic pages live one directory deeper (/ar/), so the request path
      // must match — a bare relative 'api.json' 404s there and the card would
      // wrongly report "Offline".
      var apiPath = window.location.pathname.indexOf('/ar/') !== -1 ? '../api.json' : 'api.json';
      fetch(apiPath + '?t=' + startTime)
        .then(function(response) {
          if (!response.ok) throw new Error('status not ok');
          var latency = Date.now() - startTime;

          statusModule._showLatency(valEl, latency);
          // The router answering is NOT proof the internet behind it works —
          // on an explicit tap, verify real upstream reachability and
          // downgrade honestly if it is dead.
          if (!isAutoCheck) {
            statusModule._verifyInternet(valEl);
          } else {
            statusModule._isCheckingConnection = false;
          }
        })
        .catch(function(err) {
          statusModule._isCheckingConnection = false;
          valEl.textContent = i18n.t('status_offline');
          valEl.classList.add('color-danger');
        });
    } catch (err) {
      statusModule._isCheckingConnection = false;
      console.error('Check connection quality error:', err);
    }
  },

  _showLatency: function(valEl, latency) {
    var qualityText = '';
    var colorClass = '';

    if (latency < 50) {
      qualityText = i18n.t('status_excellent') + ' (' + latency + 'ms)';
      colorClass = 'color-success';
    } else if (latency < 150) {
      qualityText = i18n.t('status_good') + ' (' + latency + 'ms)';
      colorClass = 'color-warning';
    } else {
      qualityText = i18n.t('status_poor') + ' (' + latency + 'ms)';
      colorClass = 'color-danger';
    }

    valEl.textContent = qualityText;
    if (colorClass) {
      valEl.classList.add(colorClass);
    }
  },

  _internetController: null,

  _verifyInternet: function(valEl) {
    try {
      if (!window.AbortController) {
        statusModule._isCheckingConnection = false;
        return; // legacy browsers: keep the local reading
      }

      if (statusModule._internetController) {
        try { statusModule._internetController.abort(); } catch (abortErr) {}
      }
      var controller = new AbortController();
      statusModule._internetController = controller;
      var timer = setTimeout(function() { controller.abort(); }, 4000);

      var scheme = (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:')
        ? 'https://'
        : 'http://';
      fetch(scheme + 'connectivitycheck.gstatic.com/generate_204', {
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      }).then(function() {
        clearTimeout(timer);
        if (statusModule._internetController === controller) {
          statusModule._internetController = null;
        }
        statusModule._isCheckingConnection = false;
      }).catch(function() {
        clearTimeout(timer);
        if (statusModule._internetController !== controller) return;
        statusModule._internetController = null;
        statusModule._isCheckingConnection = false;
        if (document.getElementById('connection-status-val') !== valEl) return;
        valEl.textContent = i18n.t('status_no_internet');
        valEl.className = 'stat-card__value';
        valEl.classList.add('color-danger');
      });
    } catch (err) {
      statusModule._isCheckingConnection = false;
      console.error('Internet check error:', err);
    }
  },

  // One-shot expiry flags for the dynamic threshold watcher below.
  _expiryWarned: false,
  _expiryCritical: false,

  // Session hit zero: end it properly through the RouterOS logout servlet
  // ($(link-logout) captured on the warning banner), falling back to a
  // self-reload if the attribute is ever missing OR the token was not
  // substituted (unsubstituted tokens would navigate to a literal
  // '$(link-logout)' → 404 in preview/cached contexts).
  logoutOnExpiry: function() {
    var banner = document.getElementById('session-warning');
    var logoutUrl = banner ? banner.getAttribute('data-logout-url') : null;
    if (logoutUrl && logoutUrl.indexOf('$(') === 0) logoutUrl = null;
    window.location.href = logoutUrl || window.location.href;
  },

  // Dynamic expiry watcher, driven by the 1 s uptime ticker (showWarnings
  // only evaluates the <300 s case once at page load, so a user sitting on
  // this page never sees the banner appear when the countdown crosses the
  // threshold). Expiry takes precedence over the quota warning: it is the
  // imminent event. Unlimited sessions never reach here (guarded by
  // startTimeLeft > 0 in startUptimeTicker).
  checkExpiryThresholds: function(remaining) {
    try {
      var banner = document.getElementById('session-warning');
      if (!banner) return;

      var textElement = banner.querySelector('.session-warning__text');

      if (remaining <= 60 && !statusModule._expiryCritical) {
        statusModule._expiryCritical = true;
        statusModule._expiryWarned = true;
        banner.hidden = false;
        banner.classList.remove('alert-warning');
        banner.classList.add('alert-error');
        if (textElement) textElement.textContent = i18n.t('session_expiring_critical');
      } else if (remaining <= 300 && !statusModule._expiryWarned) {
        statusModule._expiryWarned = true;
        banner.hidden = false;
        if (textElement) textElement.textContent = i18n.t('session_expiring_soon');
      }
    } catch (err) {
      console.error('Expiry threshold check error:', err);
    }
  },

  showWarnings: function() {
    try {
      var warningBanner = document.getElementById('session-warning');
      if (!warningBanner) return;

      var timeLeftElement = document.getElementById('session-time-left');
      var quotaSection = document.getElementById('sessionCountdownSection');
      
      var showWarning = false;
      var warningText = '';
      var isCritical = false;

      if (timeLeftElement) {
        var timeLeft = parseInt(timeLeftElement.getAttribute('data-seconds')) || 0;
        if (timeLeft > 0 && timeLeft <= 60) {
          showWarning = true;
          isCritical = true;
          statusModule._expiryCritical = true;
          statusModule._expiryWarned = true;
          warningText = i18n.t('session_expiring_critical');
        } else if (timeLeft > 0 && timeLeft < 300) {
          showWarning = true;
          statusModule._expiryWarned = true;
          warningText = i18n.t('session_expiring_soon');
        }
      }

      if (!showWarning && quotaSection) {
        var limit = parseInt(quotaSection.getAttribute('data-limit-bytes-total')) || 0;
        if (limit > 0) {
          var bytesIn = parseInt(quotaSection.getAttribute('data-bytes-in')) || 0;
          var bytesOut = parseInt(quotaSection.getAttribute('data-bytes-out')) || 0;
          var totalUsed = bytesIn + bytesOut;
          var percent = (totalUsed / limit) * 100;
          if (percent >= 90) {
            showWarning = true;
            warningText = i18n.t('data_limit_almost_reached');
          }
        }
      }

      if (showWarning && warningBanner) {
        warningBanner.hidden = false;
        if (isCritical) {
          warningBanner.classList.remove('alert-warning');
          warningBanner.classList.add('alert-error');
        }
        var textElement = warningBanner.querySelector('.session-warning__text');
        if (textElement && warningText) {
          textElement.textContent = warningText;
        }
      }
    } catch (err) {
      console.error('Show warnings error:', err);
    }
  },

  getRefreshIntervalSeconds: function() {
    try {
      var quotaSection = document.getElementById('sessionCountdownSection');
      if (!quotaSection) return 0;
      var rawSecs = String(quotaSection.getAttribute('data-refresh-timeout') || '').trim();
      var parsed = 0;
      if (rawSecs && rawSecs.indexOf('$(') === -1 && rawSecs.toLowerCase() !== 'none') {
        parsed = statusModule.parseTimeValue(rawSecs);
      }
      if (!parsed || parsed <= 0) {
        var rawFallback = String(quotaSection.getAttribute('data-refresh-timeout-raw') || '').trim();
        if (rawFallback && rawFallback.indexOf('$(') === -1 && rawFallback.toLowerCase() !== 'none') {
          parsed = statusModule.parseTimeValue(rawFallback);
        }
      }
      if (!parsed || parsed <= 0) return 0;
      return parsed < 15 ? 15 : parsed;
    } catch (err) {
      return 0;
    }
  },

  isAutoRefreshPaused: function() {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('hotspot_auto_refresh_paused') === '1';
    } catch (err) {
      return false;
    }
  },

  setAutoRefreshPaused: function(paused) {
    try {
      if (typeof sessionStorage === 'undefined') return;
      if (paused) sessionStorage.setItem('hotspot_auto_refresh_paused', '1');
      else sessionStorage.removeItem('hotspot_auto_refresh_paused');
    } catch (err) {}
  },

  toggleAutoRefresh: function() {
    try {
      var nextPaused = !statusModule.isAutoRefreshPaused();
      statusModule.setAutoRefreshPaused(nextPaused);
      statusModule._autoRefreshWaiting = false;
      if (!nextPaused) {
        var interval = statusModule.getRefreshIntervalSeconds();
        if (interval > 0) {
          statusModule._autoRefreshSeconds = interval;
          statusModule._autoRefreshNextAt = Date.now() + interval * 1000;
          statusModule._autoRefreshRemaining = interval;
          if (!statusModule._autoRefreshInterval) {
            statusModule._startAutoRefresh();
            return;
          }
        }
      }
      statusModule._renderAutoRefreshUi();
    } catch (err) {
      console.error('Toggle auto refresh error:', err);
    }
  },

  isAutoRefreshBusy: function() {
    if (statusModule._isRefreshing || statusModule._isCheckingConnection || statusModule._internetController) {
      return true;
    }
    var confirmBar = document.getElementById('logout-confirm-bar');
    if (confirmBar && !confirmBar.hidden) {
      return true;
    }
    if (typeof document !== 'undefined' && document.querySelector && document.querySelector('.support-modal--open')) {
      return true;
    }
    return false;
  },

  _renderAutoRefreshUi: function(stateOverride) {
    var bar = document.getElementById('auto-refresh-bar');
    if (!bar) return;
    var interval = statusModule._autoRefreshSeconds || statusModule.getRefreshIntervalSeconds();
    if (interval <= 0) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;

    var paused = statusModule.isAutoRefreshPaused();
    var toggleBtn = document.getElementById('auto-refresh-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = paused
        ? i18n.t('auto_refresh_resume_btn')
        : i18n.t('auto_refresh_pause_btn');
      toggleBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    }

    var statusEl = document.getElementById('auto-refresh-status');
    if (statusEl) {
      if (paused) {
        statusEl.textContent = i18n.t('auto_refresh_paused');
      } else if (stateOverride === 'updating' || statusModule._isRefreshing) {
        statusEl.textContent = i18n.t('auto_refresh_updating');
      } else if (stateOverride === 'waiting' || statusModule._autoRefreshWaiting) {
        statusEl.textContent = i18n.t('auto_refresh_waiting');
      } else {
        statusEl.textContent = i18n.t('auto_refresh_in', { n: Math.max(0, statusModule._autoRefreshRemaining) });
      }
    }
  },

  _stopAutoRefresh: function() {
    if (statusModule._autoRefreshInterval) {
      clearInterval(statusModule._autoRefreshInterval);
      statusModule._autoRefreshInterval = null;
    }
    if (typeof document !== 'undefined' && statusModule._onAutoRefreshVisibility) {
      document.removeEventListener('visibilitychange', statusModule._onAutoRefreshVisibility);
      statusModule._onAutoRefreshVisibility = null;
    }
    statusModule._autoRefreshWaiting = false;
  },

  _startAutoRefresh: function() {
    statusModule._stopAutoRefresh();
    var interval = statusModule.getRefreshIntervalSeconds();
    statusModule._autoRefreshSeconds = interval;
    if (interval <= 0) {
      var bar = document.getElementById('auto-refresh-bar');
      if (bar) bar.hidden = true;
      return;
    }

    statusModule._autoRefreshNextAt = Date.now() + interval * 1000;
    statusModule._autoRefreshRemaining = interval;
    statusModule._renderAutoRefreshUi();

    var stepAutoRefresh = function() {
      if (statusModule.isAutoRefreshPaused()) {
        statusModule._renderAutoRefreshUi();
        return;
      }
      var remaining = Math.max(0, Math.ceil((statusModule._autoRefreshNextAt - Date.now()) / 1000));
      statusModule._autoRefreshRemaining = remaining;
      if (remaining > 0) {
        statusModule._autoRefreshWaiting = false;
        statusModule._renderAutoRefreshUi();
        return;
      }
      if ((typeof document !== 'undefined' && document.hidden) || statusModule.isAutoRefreshBusy()) {
        statusModule._autoRefreshWaiting = true;
        statusModule._renderAutoRefreshUi('waiting');
        return;
      }
      statusModule._autoRefreshWaiting = false;
      statusModule._autoRefreshNextAt = Date.now() + statusModule._autoRefreshSeconds * 1000;
      statusModule._autoRefreshRemaining = statusModule._autoRefreshSeconds;
      statusModule.refreshStatus(true);
    };

    statusModule._autoRefreshInterval = setInterval(stepAutoRefresh, 1000);
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      statusModule._onAutoRefreshVisibility = function() {
        if (!document.hidden && !statusModule.isAutoRefreshPaused()) {
          stepAutoRefresh();
        }
      };
      document.addEventListener('visibilitychange', statusModule._onAutoRefreshVisibility);
    }
  },

  _setRefreshButtonLoading: function(isLoading) {
    var btn = document.getElementById('refresh-status-btn');
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.classList.add('btn--loading');
    } else {
      btn.disabled = false;
      btn.classList.remove('btn--loading');
    }
  },

  _copyAttr: function(src, dst, attr) {
    if (!src || !dst) return;
    if (src.hasAttribute(attr)) {
      dst.setAttribute(attr, src.getAttribute(attr));
    }
  },

  _applyRefreshedDocument: function(doc) {
    var nextQuota = doc.getElementById('sessionCountdownSection');
    var curQuota = document.getElementById('sessionCountdownSection');
    if (!nextQuota || !curQuota) return false;

    var attrs = [
      'data-limit-bytes-total',
      'data-remain-bytes-total',
      'data-bytes-in',
      'data-bytes-out',
      'data-refresh-timeout',
      'data-refresh-timeout-raw'
    ];
    for (var i = 0; i < attrs.length; i++) {
      statusModule._copyAttr(nextQuota, curQuota, attrs[i]);
    }

    var nextWarn = doc.getElementById('session-warning');
    var curWarn = document.getElementById('session-warning');
    if (curWarn) {
      statusModule._copyAttr(nextWarn, curWarn, 'data-logout-url');
      curWarn.hidden = true;
      curWarn.classList.remove('alert-error');
      curWarn.classList.add('alert-warning');
    }

    var nextUptime = doc.getElementById('uptime');
    var curUptime = document.getElementById('uptime');
    if (nextUptime && curUptime) {
      statusModule._copyAttr(nextUptime, curUptime, 'data-seconds');
      var curUptimeBdi = (curUptime.querySelector && curUptime.querySelector('bdi')) || curUptime;
      var nextUptimeBdi = (nextUptime.querySelector && nextUptime.querySelector('bdi')) || nextUptime;
      curUptimeBdi.textContent = nextUptimeBdi.textContent;
    }

    var nextTimeLeft = doc.getElementById('session-time-left');
    var curTimeLeft = document.getElementById('session-time-left');
    if (nextTimeLeft && curTimeLeft) {
      statusModule._copyAttr(nextTimeLeft, curTimeLeft, 'data-seconds');
      var curLeftBdi = (curTimeLeft.querySelector && curTimeLeft.querySelector('bdi')) || curTimeLeft;
      var nextLeftBdi = (nextTimeLeft.querySelector && nextTimeLeft.querySelector('bdi')) || nextTimeLeft;
      curLeftBdi.textContent = nextLeftBdi.textContent;
    }

    var nextTimeCard = doc.getElementById('timeRemainingCard');
    var curTimeCard = document.getElementById('timeRemainingCard');
    if (nextTimeCard && curTimeCard && curTimeCard.style) {
      curTimeCard.style.display = nextTimeCard.style ? nextTimeCard.style.display : '';
    }

    var techIds = ['tech-login-by', 'tech-idle-timeout', 'tech-server'];
    for (var t = 0; t < techIds.length; t++) {
      var nextTech = doc.getElementById(techIds[t]);
      var curTech = document.getElementById(techIds[t]);
      if (nextTech && curTech) {
        var curBdi = (curTech.querySelector && curTech.querySelector('bdi')) || curTech;
        var nextBdi = (nextTech.querySelector && nextTech.querySelector('bdi')) || nextTech;
        curBdi.textContent = nextBdi.textContent;
      }
    }

    statusModule._expiryWarned = false;
    statusModule._expiryCritical = false;
    statusModule.startCountdowns();
    statusModule.startUptimeTicker();
    statusModule.calculateRemainingQuota();
    statusModule.showWarnings();
    return true;
  },

  refreshStatus: function(isAuto) {
    try {
      if (statusModule._isRefreshing) {
        return Promise.resolve(false);
      }

      if (typeof fetch !== 'function' || typeof DOMParser !== 'function') {
        if (!isAuto) {
          window.location.reload();
        }
        return false;
      }

      statusModule._isRefreshing = true;
      if (!isAuto) {
        statusModule._setRefreshButtonLoading(true);
      }
      statusModule._renderAutoRefreshUi('updating');

      var reqUrl = (typeof window !== 'undefined' && window.location && window.location.href)
        ? window.location.href.split('#')[0]
        : 'status.html';

      return fetch(reqUrl, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin'
      })
        .then(function(response) {
          if (!response || !response.ok) {
            throw new Error('status refresh failed');
          }
          return response.text().then(function(html) {
            return { html: html, url: response.url || '' };
          });
        })
        .then(function(payload) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(payload.html, 'text/html');
          if (!statusModule._applyRefreshedDocument(doc)) {
            statusModule._isRefreshing = false;
            statusModule._setRefreshButtonLoading(false);
            if (payload.url && /^https?:\/\//i.test(payload.url) && payload.url.split('#')[0] !== reqUrl) {
              window.location.replace(payload.url);
            } else {
              window.location.reload();
            }
            return false;
          }

          var nextInterval = statusModule.getRefreshIntervalSeconds();
          if (nextInterval > 0) {
            statusModule._autoRefreshSeconds = nextInterval;
            statusModule._autoRefreshNextAt = Date.now() + nextInterval * 1000;
            statusModule._autoRefreshRemaining = nextInterval;
          }
          statusModule._isRefreshing = false;
          if (!isAuto) {
            statusModule._setRefreshButtonLoading(false);
            if (typeof util !== 'undefined' && util.showToast) {
              util.showToast(i18n.t('status_updated_toast'), 'success', 2000);
            }
          }
          statusModule._renderAutoRefreshUi();
          return true;
        })
        .catch(function(err) {
          statusModule._isRefreshing = false;
          if (!isAuto) {
            statusModule._setRefreshButtonLoading(false);
            window.location.reload();
          } else {
            var retryInterval = statusModule._autoRefreshSeconds || 30;
            statusModule._autoRefreshNextAt = Date.now() + retryInterval * 1000;
            statusModule._autoRefreshRemaining = retryInterval;
            statusModule._renderAutoRefreshUi();
          }
          return false;
        });
    } catch (err) {
      statusModule._isRefreshing = false;
      statusModule._setRefreshButtonLoading(false);
      console.error('Refresh status error:', err);
      return false;
    }
  },

  _recordVoucherHistory: function(code) {
    if (typeof util !== 'undefined' && util.recordVoucherHistory) {
      return util.recordVoucherHistory(code);
    }
    return false;
  },

  switchCard: function(event) {
    try {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      try { sessionStorage.removeItem('hotspot_last_voucher'); } catch (e) {}
      try { localStorage.removeItem('hotspot_last_voucher'); } catch (e) {}
      try { if (typeof util !== 'undefined' && util.setCookie) util.setCookie('hotspot_last_voucher', '', -1); } catch (e) {}
      try { sessionStorage.removeItem('hotspot_last_voucher_pw'); } catch (e) {}
      try { localStorage.removeItem('hotspot_last_voucher_pw'); } catch (e) {}
      try { if (typeof util !== 'undefined' && util.setCookie) util.setCookie('hotspot_last_voucher_pw', '', -1); } catch (e) {}
      try { sessionStorage.removeItem('hotspot_password'); } catch (e) {}
      try { localStorage.removeItem('hotspot_password'); } catch (e) {}
      try { if (typeof util !== 'undefined' && util.setCookie) util.setCookie('hotspot_password', '', -1); } catch (e) {}

      var link = document.getElementById('switchCardLink');
      var loginHref = (link && link.getAttribute('href')) || './login.html';
      var logoutUrl = link ? link.getAttribute('data-logout-url') : '';
      var navigated = false;
      var navTimer = null;
      var navigateOnce = function() {
        if (navigated) return;
        navigated = true;
        if (navTimer) {
          clearTimeout(navTimer);
          navTimer = null;
        }
        window.location.href = loginHref;
      };
      if (logoutUrl && logoutUrl.indexOf('$(') !== 0 && typeof fetch === 'function') {
        try {
          navTimer = setTimeout(navigateOnce, 600);
          Promise.resolve(
            fetch(logoutUrl, { method: 'GET', credentials: 'include', mode: 'no-cors', keepalive: true })
          ).then(navigateOnce, navigateOnce);
          return false;
        } catch (fetchErr) {}
      }
      navigateOnce();
      return false;
    } catch (err) {
      window.location.href = './login.html';
      return false;
    }
  }
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = statusModule;
}
