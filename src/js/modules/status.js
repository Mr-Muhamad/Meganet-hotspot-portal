/**
 * Status Module - Session status display
 * @module Hotspot.status
 */
var statusModule = {
  init: function() {
    try {
      statusModule.startCountdowns();
      statusModule.startUptimeTicker();
      statusModule.showWarnings();
      statusModule.calculateRemainingQuota();
      statusModule.checkConnectionQuality();
      statusModule.displayDeviceType();

      if (typeof rateLimiter !== 'undefined') {
        rateLimiter.clearAll();
      }

      // Decode MAC address from URL-encoded format on load
      var macEl = document.getElementById('tech-mac') || document.getElementById('stat-mac');
      if (macEl) {
        var rawMac = macEl.textContent.trim();
        try {
          macEl.textContent = decodeURIComponent(rawMac);
        } catch (macErr) {
          macEl.textContent = rawMac.replace(/%3A/gi, ':');
        }
      }

      // Decode username from URL-encoded format (in case username is MAC address)
      var userEl = document.getElementById('tech-username') || document.getElementById('stat-username');
      if (userEl) {
        var rawUser = userEl.textContent.trim();
        try {
          userEl.textContent = decodeURIComponent(rawUser);
        } catch (userErr) {
          userEl.textContent = rawUser.replace(/%3A/gi, ':');
        }

        // Hide logout button if username matches MAC address format (e.g. 1C:BF:CE:B7:A4:D8 or 1c-bf-ce-b7-a4-d8)
        var usernameVal = userEl.textContent.trim();
        var macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (macRegex.test(usernameVal)) {
          var logoutBtn = document.getElementById('logout-btn');
          if (logoutBtn) {
            logoutBtn.style.display = 'none';
          }
        }
      }

      // Check PWA banner status
      var pwaBanner = document.getElementById('pwaBanner');
      if (pwaBanner) {
        var isDismissed = localStorage.getItem('pwa_banner_dismissed') === 'true';
        if (!isDismissed) {
          pwaBanner.style.display = 'block';
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
          downloadEl.textContent = util.formatBytes(bytesOut); // bytesOut = Download
        }
        if (uploadEl) {
          uploadEl.textContent = util.formatBytes(bytesIn);  // bytesIn = Upload
        }

        // Update remaining quota header value
        if (quotaValueEl) {
          if (limit > 0) {
            var remaining = limit - totalUsed;
            if (remaining < 0) remaining = 0;
            var format = quotaSection.getAttribute('data-quota-format') || 'MB';
            // kbBase fallback matches the shipped config default (1000,
            // the commercial convention for voucher cards)
            var kbBase = parseInt(quotaSection.getAttribute('data-kb-base')) || 1000;
            var currentLang = document.documentElement.getAttribute('lang') || 'en';
            
            if (format.toUpperCase() === 'GB') {
              var remainingGB = (remaining / (kbBase * kbBase * kbBase)).toFixed(2);
              var gbText = currentLang === 'ar' ? 'جيجا' : 'GB';
              quotaValueEl.textContent = remainingGB + ' ' + gbText;
            } else {
              var remainingMB = (remaining / (kbBase * kbBase)).toFixed(0);
              var mbText = currentLang === 'ar' ? 'ميجا' : 'MB';
              quotaValueEl.textContent = remainingMB + ' ' + mbText;
            }
          } else {
            var currentLang = document.documentElement.getAttribute('lang') || 'en';
            quotaValueEl.textContent = currentLang === 'ar' ? 'غير محدود' : 'Unlimited';
          }
        }

        // Update remaining progress bar and percentage
        if (limit > 0) {
          var remaining = limit - totalUsed;
          if (remaining < 0) remaining = 0;
          var percentRemaining = (remaining / limit) * 100;
          percentRemaining = Math.min(100, Math.max(0, percentRemaining));

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
        var isAr = (document.documentElement.getAttribute('lang') || 'en') === 'ar';
        if (smartUsageTip) {
          if (limit > 0) {
            var remaining = limit - totalUsed;
            if (remaining < 0) remaining = 0;
            var percentRemaining = (remaining / limit) * 100;
            
            var tipText = '';
            if (remaining > 2147483648) {
              tipText = isAr 
                ? 'باقي رصيدك وفير جداً! يمكنك الاستمتاع بمشاهدة الفيديوهات والتصفح بحرية.' 
                : 'Your remaining balance is abundant! Feel free to stream videos and browse.';
            } else if (remaining > 524288000) {
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
              var kbBase = parseInt(quotaSection.getAttribute('data-kb-base')) || 1000;
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
    
    // Otherwise, check for HH:MM:SS format (which now has days stripped)
    var parts = timeStr.split(':');
    if (parts.length === 3) {
      seconds += (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60) + parseInt(parts[2], 10);
      return seconds;
    } else if (parts.length === 2) {
      seconds += (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
      return seconds;
    }
    
    return seconds || parseInt(timeStr, 10) || 0;
  },

  dismissPwaBanner: function() {
    try {
      var pwaBanner = document.getElementById('pwaBanner');
      if (pwaBanner) {
        pwaBanner.style.display = 'none';
        localStorage.setItem('pwa_banner_dismissed', 'true');
      }
    } catch (err) {
      console.error('Dismiss PWA banner error:', err);
    }
  },

  startCountdowns: function() {
    try {
      var timeLeftElement = document.getElementById('session-time-left');
      if (timeLeftElement) {
        var rawVal = timeLeftElement.getAttribute('data-seconds') || timeLeftElement.textContent;
        var timeLeft = statusModule.parseTimeValue(rawVal);
        if (timeLeft > 0) {
          timeLeftElement.setAttribute('data-seconds', timeLeft);
          ui.initCountdown(timeLeft, 'session-time-left', function() {
            window.location.href = window.location.href;
          });
        } else {
          timeLeftElement.textContent = '--';
        }
      }
    } catch (err) {
      console.error('Start countdowns error:', err);
    }
  },

  startUptimeTicker: function() {
    try {
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

      setInterval(function() {
        var elapsed = Math.floor((Date.now() - startTime) / 1000);
        var currentUptime = startUptime + elapsed;
        if (currentUptime > 0) {
          uptimeElement.textContent = util.formatUptime(currentUptime);
          uptimeElement.setAttribute('data-seconds', currentUptime);
        } else if (initialText) {
          uptimeElement.textContent = initialText;
        }

        if (startTimeLeft > 0) {
          var currentRemaining = startTimeLeft - elapsed;
          if (currentRemaining < 0) currentRemaining = 0;
          statusModule.updateTimeProgress(currentRemaining);
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

  checkConnectionQuality: function() {
    try {
      var valEl = document.getElementById('connection-status-val');
      if (!valEl) return;

      valEl.textContent = i18n.t('status_checking');
      valEl.className = 'stat-card__value';

      if (typeof fetch === 'undefined') {
        valEl.textContent = i18n.t('status_offline');
        valEl.classList.add('color-danger');
        return;
      }

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
          // verify real upstream reachability and downgrade honestly if dead.
          statusModule._verifyInternet(valEl);
        })
        .catch(function(err) {
          valEl.textContent = i18n.t('status_offline');
          valEl.classList.add('color-danger');
        });
    } catch (err) {
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

  _verifyInternet: function(valEl) {
    try {
      if (!window.AbortController) return; // legacy browsers: keep the local reading

      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, 4000);

      // Standard Android connectivity probe — a tiny 204 endpoint fetched in
      // no-cors mode (only reachability matters, not the body). The portal is
      // served over plain http, so an http probe is not mixed content; if the
      // portal ever moves to https, switch this URL to an https endpoint too.
      fetch('http://connectivitycheck.gstatic.com/generate_204', {
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      }).then(function() {
        clearTimeout(timer); // internet confirmed — latency reading stands
      }).catch(function() {
        clearTimeout(timer);
        if (document.getElementById('connection-status-val') !== valEl) return;
        valEl.textContent = i18n.t('status_no_internet');
        valEl.className = 'stat-card__value';
        valEl.classList.add('color-danger');
      });
    } catch (err) {
      console.error('Internet check error:', err);
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

      if (timeLeftElement) {
        var timeLeft = parseInt(timeLeftElement.getAttribute('data-seconds')) || 0;
        if (timeLeft > 0 && timeLeft < 300) {
          showWarning = true;
          warningText = i18n.t('session_expiring_soon');
        }
      }

      if (quotaSection) {
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
        var textElement = warningBanner.querySelector('.session-warning__text');
        if (textElement && warningText) {
          textElement.textContent = warningText;
        }
      }
    } catch (err) {
      console.error('Show warnings error:', err);
    }
  },

  refreshStatus: function() {
    try {
      window.location.href = window.location.href;
    } catch (err) {
      console.error('Refresh status error:', err);
    }
  }
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = statusModule;
}
