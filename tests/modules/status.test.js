/**
 * Tests for Hotspot.status module (statusModule)
 */

const statusModule = require('../../src/js/modules/status.js');
const util = require('../../src/js/modules/util.js');

// Mock ui module
const ui = {
  initCountdown: jest.fn()
};

// Mock i18n module (translates the connection-quality strings)
const i18n = {
  data: {
    en: {
      status_checking: 'Checking...',
      status_offline: 'Offline',
      status_no_internet: 'No internet access',
      status_excellent: 'Excellent',
      status_good: 'Good',
      status_poor: 'Poor',
      session_expiring_soon: 'Session expires soon',
      session_expiring_critical: 'Your session ends in less than a minute',
      data_limit_almost_reached: 'Data limit almost reached'
    }
  },
  currentLang: 'en',
  t: function(key) {
    var lang = this.data[this.currentLang];
    return lang && lang[key] !== undefined ? lang[key] : key;
  }
};

// Expose globals for status.js to access
global.util = util;
global.ui = ui;
global.i18n = i18n;

describe('Hotspot.status', () => {
  let mockUptime;
  let mockCountdownSection;
  let mockCountdownValue;
  let mockTimeLeft;
  let mockConsumption;
  let mockProgressFill;
  let mockWarningBanner;
  let mockWarningText;
  let mockMac;
  let mockQuotaRemainingProgressFill;
  let mockQuotaRemainingPercentage;
  let mockDownload;
  let mockUpload;
  let mockTimeRemainingProgressContainer;
  let mockTimeRemainingProgressFill;
  let mockConnectionStatusVal;
  let mockTrigger;
  let mockContent;
  let mockSmartUsageCard;
  let mockSmartUsageTip;
  let mockSmartUsageActivities;
  let mockBrowsingHours;
  let mockPwaBanner;

  beforeEach(() => {
    document.body.innerHTML = '';

    mockUptime = document.createElement('div');
    mockUptime.id = 'uptime';
    mockUptime.setAttribute('data-seconds', '100');
    mockUptime.textContent = '00:01:40';

    mockCountdownSection = document.createElement('div');
    mockCountdownSection.id = 'sessionCountdownSection';
    mockCountdownSection.setAttribute('data-limit-bytes-total', '104857600'); // 100 MB limit
    mockCountdownSection.setAttribute('data-bytes-in', '10485760'); // 10 MB in
    mockCountdownSection.setAttribute('data-bytes-out', '5242880'); // 5 MB out
    mockCountdownSection.setAttribute('data-kb-base', '1024');

    mockCountdownValue = document.createElement('div');
    mockCountdownValue.id = 'session-countdown';
    mockCountdownSection.appendChild(mockCountdownValue);

    mockQuotaRemainingProgressFill = document.createElement('div');
    mockQuotaRemainingProgressFill.id = 'quota-remaining-progress-fill';
    mockCountdownSection.appendChild(mockQuotaRemainingProgressFill);

    mockQuotaRemainingPercentage = document.createElement('div');
    mockQuotaRemainingPercentage.id = 'quota-remaining-percentage';
    mockCountdownSection.appendChild(mockQuotaRemainingPercentage);

    mockTimeLeft = document.createElement('div');
    mockTimeLeft.id = 'session-time-left';
    mockTimeLeft.setAttribute('data-seconds', '600'); // 10 minutes

    mockConsumption = document.createElement('div');
    mockConsumption.id = 'session-consumption';

    mockProgressFill = document.createElement('div');
    mockProgressFill.id = 'consumption-progress-fill';

    mockWarningBanner = document.createElement('div');
    mockWarningBanner.id = 'session-warning';
    mockWarningBanner.hidden = true;

    mockWarningText = document.createElement('span');
    mockWarningText.className = 'session-warning__text';
    mockWarningBanner.appendChild(mockWarningText);

    mockMac = document.createElement('div');
    mockMac.id = 'stat-mac';
    mockMac.textContent = '00:00:00:00:00:00';

    mockDownload = document.createElement('div');
    mockDownload.id = 'stat-download';

    mockUpload = document.createElement('div');
    mockUpload.id = 'stat-upload';

    mockTimeRemainingProgressContainer = document.createElement('div');
    mockTimeRemainingProgressContainer.id = 'time-remaining-progress-container';
    mockTimeRemainingProgressContainer.style.display = 'none';

    mockTimeRemainingProgressFill = document.createElement('div');
    mockTimeRemainingProgressFill.id = 'time-remaining-progress-fill';
    mockTimeRemainingProgressContainer.appendChild(mockTimeRemainingProgressFill);

    mockConnectionStatusVal = document.createElement('div');
    mockConnectionStatusVal.id = 'connection-status-val';

    mockTrigger = document.createElement('button');
    mockTrigger.className = 'tech-details__trigger';
    mockTrigger.setAttribute('aria-expanded', 'false');

    mockContent = document.createElement('div');
    mockContent.id = 'techDetailsContent';
    mockContent.hidden = true;

    document.body.appendChild(mockDownload);
    document.body.appendChild(mockUpload);
    document.body.appendChild(mockTimeRemainingProgressContainer);
    document.body.appendChild(mockConnectionStatusVal);
    document.body.appendChild(mockTrigger);
    document.body.appendChild(mockContent);

    mockSmartUsageCard = document.createElement('div');
    mockSmartUsageCard.id = 'smartUsageCard';

    mockSmartUsageTip = document.createElement('div');
    mockSmartUsageTip.id = 'smart-usage-tip';
    mockSmartUsageCard.appendChild(mockSmartUsageTip);

    mockSmartUsageActivities = document.createElement('div');
    mockSmartUsageActivities.id = 'smart-usage-activities';
    mockSmartUsageCard.appendChild(mockSmartUsageActivities);

    mockBrowsingHours = document.createElement('span');
    mockBrowsingHours.id = 'browsing-hours';
    mockSmartUsageCard.appendChild(mockBrowsingHours);

    const mockVideoSdHours = document.createElement('span');
    mockVideoSdHours.id = 'video-sd-hours';
    mockSmartUsageCard.appendChild(mockVideoSdHours);
    const mockVideoHdHours = document.createElement('span');
    mockVideoHdHours.id = 'video-hd-hours';
    mockSmartUsageCard.appendChild(mockVideoHdHours);
document.body.appendChild(mockSmartUsageCard);

    mockPwaBanner = document.createElement('div');
    mockPwaBanner.id = 'pwaBanner';
    mockPwaBanner.style.display = 'none';
    document.body.appendChild(mockPwaBanner);

    document.body.appendChild(mockUptime);
    document.body.appendChild(mockCountdownSection);
    document.body.appendChild(mockTimeLeft);
    document.body.appendChild(mockConsumption);
    document.body.appendChild(mockProgressFill);
    document.body.appendChild(mockWarningBanner);
    document.body.appendChild(mockMac);

    jest.clearAllMocks();
  });

  describe('init', () => {
    test('clears auth rate limits on load', () => {
      global.rateLimiter = {
        clearAll: jest.fn()
      };

      statusModule.init();

      expect(global.rateLimiter.clearAll).toHaveBeenCalled();
      delete global.rateLimiter;
    });
  });

  describe('startCountdowns', () => {
    test('initializes ui.initCountdown if seconds > 0', () => {
      statusModule.startCountdowns();
      expect(ui.initCountdown).toHaveBeenCalledWith(600, 'session-time-left', expect.any(Function));
    });

    test('sets content to -- if seconds <= 0', () => {
      mockTimeLeft.setAttribute('data-seconds', '0');
      statusModule.startCountdowns();
      expect(mockTimeLeft.textContent).toBe('--');
    });
  });

  describe('calculateRemainingQuota', () => {
    test('computes and formats remaining quota and total consumption correctly', () => {
      statusModule.calculateRemainingQuota();

      // Download = bytesOut = 5 MB
      expect(mockDownload.textContent).toBe('5 MB');

      // Upload = bytesIn = 10 MB
      expect(mockUpload.textContent).toBe('10 MB');

      // Remaining = 100MB - 15MB = 85MB
      expect(mockCountdownValue.textContent).toBe('85 MB');

      // Remaining Progress bar fill = 85%
      expect(mockQuotaRemainingProgressFill.style.width).toBe('85%');

      // Remaining Percentage text = "85% remaining"
      expect(mockQuotaRemainingPercentage.textContent).toBe('85% remaining');

      // Smart usage tip (85 MB remaining is <= 500 MB)
      expect(mockSmartUsageTip.textContent).toBe('Your balance is very low! Stop auto-downloads and avoid videos to save quota.');
      expect(mockSmartUsageActivities.style.display).toBe('block');
      expect(mockBrowsingHours.textContent).toBe('51 min');
    });

    test('sets quota to Unlimited when limit is 0', () => {
      mockCountdownSection.setAttribute('data-limit-bytes-total', '0');
      statusModule.calculateRemainingQuota();

      expect(mockCountdownValue.textContent).toBe('Unlimited');
      expect(mockSmartUsageTip.textContent).toBe('Your balance is unlimited! Enjoy browsing and downloading without limits.');
      expect(mockSmartUsageActivities.style.display).toBe('none');
    });
  });

  describe('showWarnings', () => {
    test('shows warning if session time left is under 5 minutes', () => {
      mockTimeLeft.setAttribute('data-seconds', '200'); // < 300s
      statusModule.showWarnings();

      expect(mockWarningBanner.hidden).toBe(false);
      expect(mockWarningText.textContent).toBe('Session expires soon');
    });

    test('shows warning if combined data limit is almost reached', () => {
      // 95% used (95 MB of 100 MB)
      mockCountdownSection.setAttribute('data-bytes-in', '52428800'); // 50 MB
      mockCountdownSection.setAttribute('data-bytes-out', '47185920'); // 45 MB

      statusModule.showWarnings();

      expect(mockWarningBanner.hidden).toBe(false);
      expect(mockWarningText.textContent).toBe('Data limit almost reached');
    });
  });

  describe('checkExpiryThresholds', () => {
    beforeEach(() => {
      statusModule._expiryWarned = false;
      statusModule._expiryCritical = false;
      mockWarningBanner.hidden = true;
      mockWarningBanner.className = 'alert alert-warning';
      mockWarningText.textContent = '';
    });

    test('does nothing above the 5-minute threshold', () => {
      statusModule.checkExpiryThresholds(400);

      expect(mockWarningBanner.hidden).toBe(true);
      expect(mockWarningText.textContent).toBe('');
    });

    test('shows the expiring-soon banner when the countdown crosses 5 minutes', () => {
      statusModule.checkExpiryThresholds(299);

      expect(mockWarningBanner.hidden).toBe(false);
      expect(mockWarningText.textContent).toBe('Session expires soon');
      expect(mockWarningBanner.classList.contains('alert-warning')).toBe(true);
    });

    test('escalates to the critical banner under one minute', () => {
      statusModule.checkExpiryThresholds(59);

      expect(mockWarningBanner.hidden).toBe(false);
      expect(mockWarningText.textContent).toBe('Your session ends in less than a minute');
      expect(mockWarningBanner.classList.contains('alert-error')).toBe(true);
      expect(mockWarningBanner.classList.contains('alert-warning')).toBe(false);
    });

    test('fires each threshold once and never regresses from critical', () => {
      statusModule.checkExpiryThresholds(200);
      statusModule.checkExpiryThresholds(200); // same band again — one-shot
      statusModule.checkExpiryThresholds(150);
      expect(mockWarningText.textContent).toBe('Session expires soon');

      statusModule.checkExpiryThresholds(30);
      expect(mockWarningText.textContent).toBe('Your session ends in less than a minute');

      statusModule.checkExpiryThresholds(20); // still critical, no repeat work
      expect(mockWarningText.textContent).toBe('Your session ends in less than a minute');
      expect(mockWarningBanner.classList.contains('alert-error')).toBe(true);
    });

    test('does nothing when the banner is absent', () => {
      mockWarningBanner.remove();

      expect(() => statusModule.checkExpiryThresholds(30)).not.toThrow();
    });
  });

  describe('mac address decoding', () => {
    test('decodes URL-escaped MAC address in HTML on init', () => {
      mockTimeLeft.setAttribute('data-seconds', '0'); // prevent countdown redirect trigger
      const mockMacElement = document.getElementById('stat-mac');
      mockMacElement.textContent = '1C%3ABF%3ACE%3AB7%3AA4%3AD8';

      statusModule.init();

      expect(mockMacElement.textContent).toBe('1C:BF:CE:B7:A4:D8');
    });
  });

  describe('toggleTechDetails', () => {
    test('toggles the hidden state of technical content and trigger expanded attribute', () => {
      expect(mockContent.hidden).toBe(true);
      expect(mockTrigger.getAttribute('aria-expanded')).toBe('false');

      statusModule.toggleTechDetails();

      expect(mockContent.hidden).toBe(false);
      expect(mockTrigger.getAttribute('aria-expanded')).toBe('true');

      statusModule.toggleTechDetails();

      expect(mockContent.hidden).toBe(true);
      expect(mockTrigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('updateTimeProgress', () => {
    test('computes remaining time percentage and updates progress bar correctly', () => {
      // 100s uptime + 900s remaining = 1000s total. Remaining = 90% (900s)
      mockUptime.setAttribute('data-seconds', '100');
      statusModule.updateTimeProgress(900);

      expect(mockTimeRemainingProgressContainer.style.display).toBe('block');
      expect(mockTimeRemainingProgressFill.style.width).toBe('90%');
      expect(mockTimeRemainingProgressFill.className).toBe('progress-bar__fill progress-bar__fill--animated');
    });

    test('sets warning and danger color classes based on remaining percentage thresholds', () => {
      // Warning threshold (<= 25%)
      // 750s uptime + 250s remaining = 1000s total. Remaining = 25% (250s)
      mockUptime.setAttribute('data-seconds', '750');
      statusModule.updateTimeProgress(250);
      expect(mockTimeRemainingProgressFill.classList.contains('progress-bar__fill--warning')).toBe(true);

      // Danger threshold (<= 10%)
      // 900s uptime + 100s remaining = 1000s total. Remaining = 10% (100s)
      mockUptime.setAttribute('data-seconds', '900');
      statusModule.updateTimeProgress(100);
      expect(mockTimeRemainingProgressFill.classList.contains('progress-bar__fill--danger')).toBe(true);
    });
  });

  describe('checkConnectionQuality', () => {
    test('sets offline status in environment where fetch is not defined', () => {
      statusModule.checkConnectionQuality();
      expect(mockConnectionStatusVal.textContent).toBe('Offline');
      expect(mockConnectionStatusVal.classList.contains('color-danger')).toBe(true);
    });

    // Regression: a bare relative 'api.json' 404s on /ar/ pages (one
    // directory deep) and the card wrongly reported "Offline".
    test.each([
      ['/status.html', 'api.json'],
      ['/ar/status.html', '../api.json']
    ])('probes the right path from %s', (pathname, expectedUrl) => {
      const urls = [];
      global.fetch = (url) => {
        urls.push(url);
        return Promise.reject(new Error('mocked network'));
      };
      try {
        window.history.replaceState({}, '', pathname);
        statusModule.checkConnectionQuality();
        expect(urls[0]).toContain(expectedUrl + '?t=');
      } finally {
        delete global.fetch;
      }
    });

    test('downgrades to "No internet access" when the router answers but the upstream is dead', async () => {
      global.fetch = (url) => {
        if (String(url).indexOf('api.json') !== -1) {
          return Promise.resolve({ ok: true });
        }
        return Promise.reject(new Error('dead wan'));
      };
      try {
        statusModule.checkConnectionQuality();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(mockConnectionStatusVal.textContent).toBe('No internet access');
        expect(mockConnectionStatusVal.classList.contains('color-danger')).toBe(true);
      } finally {
        delete global.fetch;
      }
    });

    test('keeps the latency reading when the upstream probe succeeds', async () => {
      global.fetch = () => Promise.resolve({ ok: true });
      try {
        statusModule.checkConnectionQuality();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(mockConnectionStatusVal.textContent).toContain('ms)');
        expect(mockConnectionStatusVal.textContent).not.toBe('No internet access');
      } finally {
        delete global.fetch;
      }
    });

    test('the auto-check (init) skips the upstream probe entirely', async () => {
      // router reachable, internet dead — an auto-check must still show the
      // latency (no external request, no radio wake); only an explicit tap
      // may downgrade the card
      global.fetch = (url) => {
        if (String(url).indexOf('api.json') !== -1) {
          return Promise.resolve({ ok: true });
        }
        return Promise.reject(new Error('dead wan'));
      };
      try {
        statusModule.checkConnectionQuality(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(mockConnectionStatusVal.textContent).toContain('ms)');
        expect(mockConnectionStatusVal.textContent).not.toBe('No internet access');
      } finally {
        delete global.fetch;
      }
    });
  });

  describe('formatEstimate', () => {
    test('formats hours correctly in English and Arabic', () => {
      // Expired case
      expect(statusModule.formatEstimate(0, false)).toBe('Expired');
      expect(statusModule.formatEstimate(0, true)).toBe('منتهي');

      // Less than a minute case
      expect(statusModule.formatEstimate(0.005, false)).toBe('< 1 min');
      expect(statusModule.formatEstimate(0.005, true)).toBe('أقل من دقيقة');

      // Minutes only case
      expect(statusModule.formatEstimate(0.5, false)).toBe('30 min');
      expect(statusModule.formatEstimate(0.5, true)).toBe('30 دقيقة');

      // Hours only case
      expect(statusModule.formatEstimate(2, false)).toBe('2 hrs');
      expect(statusModule.formatEstimate(2, true)).toBe('2 ساعة');

      // Mixed hours and minutes case
      expect(statusModule.formatEstimate(1.5, false)).toBe('1 hrs 30 min');
      expect(statusModule.formatEstimate(1.5, true)).toBe('1 ساعة و 30 دقيقة');
    });
  });

  describe('parseTimeValue', () => {
    test('parses various time formats to total seconds correctly', () => {
      // Raw integer seconds
      expect(statusModule.parseTimeValue('120')).toBe(120);
      expect(statusModule.parseTimeValue(120)).toBe(120);

      // HH:MM:SS format
      expect(statusModule.parseTimeValue('00:02:00')).toBe(120);
      expect(statusModule.parseTimeValue('01:30:15')).toBe(5415);

      // MM:SS format
      expect(statusModule.parseTimeValue('02:30')).toBe(150);

      // RouterOS shorthand formats
      expect(statusModule.parseTimeValue('1d02:30:15')).toBe(95415);
      expect(statusModule.parseTimeValue('1d')).toBe(86400);
      expect(statusModule.parseTimeValue('2h30m')).toBe(9000);
      expect(statusModule.parseTimeValue('10m5s')).toBe(605);
      
      // Empty/fallback values
      expect(statusModule.parseTimeValue('')).toBe(0);
      expect(statusModule.parseTimeValue(null)).toBe(0);
      expect(statusModule.parseTimeValue('invalid')).toBe(0);
    });
  });

  describe('dismissPwaBanner & init', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    test('shows banner on init if not dismissed', () => {
      expect(mockPwaBanner.style.display).toBe('none');
      statusModule.init();
      expect(mockPwaBanner.style.display).toBe('block');
    });

    test('hides banner on init if already dismissed', () => {
      localStorage.setItem('pwa_banner_dismissed', 'true');
      statusModule.init();
      expect(mockPwaBanner.style.display).toBe('none');
    });

    test('dismissPwaBanner hides banner and sets localStorage flag', () => {
      mockPwaBanner.style.display = 'block';
      statusModule.dismissPwaBanner();
      expect(mockPwaBanner.style.display).toBe('none');
      expect(localStorage.getItem('pwa_banner_dismissed')).toBe('true');
    });
  });
});
