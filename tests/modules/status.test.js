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
      data_limit_almost_reached: 'Data limit almost reached',
      auto_refresh_in: 'Auto-refresh in {n}s',
      auto_refresh_paused: 'Auto-refresh paused',
      auto_refresh_waiting: 'Waiting to refresh…',
      auto_refresh_updating: 'Updating…',
      auto_refresh_pause_btn: 'Pause',
      auto_refresh_resume_btn: 'Resume',
      status_updated_toast: 'Session status updated'
    }
  },
  currentLang: 'en',
  t: function(key, params) {
    var lang = this.data[this.currentLang];
    var text = lang && lang[key] !== undefined ? lang[key] : key;
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(function(k) {
        text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
      });
    }
    return text;
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
    document.documentElement.setAttribute('lang', 'en');
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
    afterEach(() => {
      statusModule.dismissPwaBanner();
    });

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

      // Smart usage tip (85% remaining is >= 50%)
      expect(mockSmartUsageTip.textContent).toBe('Your remaining balance is abundant! Feel free to stream videos and browse.');
      expect(mockSmartUsageActivities.style.display).toBe('block');
      expect(mockBrowsingHours.textContent).toBe('51 min');
    });

    test('shows very low Smart Usage tip when remaining quota is under 20%', () => {
      mockCountdownSection.setAttribute('data-bytes-in', '62914560'); // 60 MB
      mockCountdownSection.setAttribute('data-bytes-out', '31457280'); // 30 MB -> 10% left
      statusModule.calculateRemainingQuota();

      expect(mockCountdownValue.textContent).toBe('10 MB');
      expect(mockQuotaRemainingPercentage.textContent).toBe('10% remaining');
      expect(mockSmartUsageTip.textContent).toBe('Your balance is very low! Stop auto-downloads and avoid videos to save quota.');
    });

    test('sets quota to Unlimited when limit is 0', () => {
      const progressContainer = document.createElement('div');
      progressContainer.id = 'quota-progress-container';
      document.body.appendChild(progressContainer);
      mockCountdownSection.setAttribute('data-limit-bytes-total', '0');
      statusModule.calculateRemainingQuota();

      expect(mockCountdownValue.textContent).toBe('Unlimited');
      expect(progressContainer.style.display).toBe('none');
      expect(mockSmartUsageTip.textContent).toBe('Your balance is unlimited! Enjoy browsing and downloading without limits.');
      expect(mockSmartUsageActivities.style.display).toBe('none');
    });

    test('honors data-remain-bytes-total attribute when valid', () => {
      const progressContainer = document.createElement('div');
      progressContainer.id = 'quota-progress-container';
      document.body.appendChild(progressContainer);
      mockCountdownSection.setAttribute('data-remain-bytes-total', '26214400'); // 25 MB
      statusModule.calculateRemainingQuota();

      expect(mockCountdownValue.textContent).toBe('25 MB');
      expect(mockQuotaRemainingPercentage.textContent).toBe('25% remaining');
      expect(progressContainer.style.display).toBe('');
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

  describe('mac and username address decoding', () => {
    test('decodes URL-escaped MAC address in both #stat-mac and #tech-mac on init', () => {
      mockTimeLeft.setAttribute('data-seconds', '0'); // prevent countdown redirect trigger
      const mockMacElement = document.getElementById('stat-mac');
      mockMacElement.textContent = '1C%3ABF%3ACE%3AB7%3AA4%3AD8';

      const techMac = document.createElement('div');
      techMac.id = 'tech-mac';
      techMac.textContent = 'AA%3ABB%3ACC%3ADD%3AEE%3AFF';
      document.body.appendChild(techMac);

      statusModule.init();

      expect(mockMacElement.textContent).toBe('1C:BF:CE:B7:A4:D8');
      expect(techMac.textContent).toBe('AA:BB:CC:DD:EE:FF');
    });

    test('decodes URL-escaped username in both #stat-username and #tech-username on init', () => {
      mockTimeLeft.setAttribute('data-seconds', '0');
      const statUser = document.createElement('div');
      statUser.id = 'stat-username';
      statUser.textContent = 'user%20name%40wifi';
      document.body.appendChild(statUser);

      const techUser = document.createElement('div');
      techUser.id = 'tech-username';
      techUser.textContent = '1C%3ABF%3ACE%3AB7%3AA4%3AD8';
      document.body.appendChild(techUser);

      statusModule.init();

      expect(statUser.textContent).toBe('user name@wifi');
      expect(techUser.textContent).toBe('1C:BF:CE:B7:A4:D8');
    });

    test('records verified voucher #stat-username into hotspot_voucher_history while ignoring MAC and trial usernames', () => {
      localStorage.clear();
      sessionStorage.clear();
      util.setCookie('hotspot_voucher_history', '', -1);
      util.setCookie('hotspot_mode', '', -1);
      mockTimeLeft.setAttribute('data-seconds', '0');

      const statUser = document.createElement('div');
      statUser.id = 'stat-username';
      document.body.appendChild(statUser);

      statUser.textContent = '1C:BF:CE:B7:A4:D8';
      statusModule.init();
      expect(localStorage.getItem('hotspot_voucher_history')).toBeNull();

      statUser.textContent = 'T-1C:BF:CE:B7:A4:D8';
      statusModule.init();
      expect(localStorage.getItem('hotspot_voucher_history')).toBeNull();

      statUser.textContent = '99887766';
      statusModule.init();
      expect(JSON.parse(localStorage.getItem('hotspot_voucher_history'))).toEqual(['99887766']);
      expect(JSON.parse(util.getCookie('hotspot_voucher_history'))).toEqual(['99887766']);
    });

    test('hides #switchCardLink and #logout-btn for MAC logins (MAC username or login-by=mac) while keeping mac-cookie/voucher visible', () => {
      mockTimeLeft.setAttribute('data-seconds', '0');

      const makeStatusActions = (username, loginBy, withPlans) => {
        document.querySelectorAll('#stat-username, #tech-login-by, #logout-btn, .plans-link-compact').forEach((el) => el.remove());

        const statUser = document.createElement('div');
        statUser.id = 'stat-username';
        statUser.textContent = username;
        document.body.appendChild(statUser);

        if (loginBy !== undefined) {
          const loginByEl = document.createElement('div');
          loginByEl.id = 'tech-login-by';
          loginByEl.textContent = loginBy;
          document.body.appendChild(loginByEl);
        }

        const logoutBtn = document.createElement('a');
        logoutBtn.id = 'logout-btn';
        document.body.appendChild(logoutBtn);

        const compact = document.createElement('div');
        compact.className = 'plans-link-compact';
        const switchLink = document.createElement('a');
        switchLink.id = 'switchCardLink';
        compact.appendChild(switchLink);
        if (withPlans) {
          const plansLink = document.createElement('a');
          plansLink.id = 'viewPlansLink';
          compact.appendChild(plansLink);
        }
        document.body.appendChild(compact);

        statusModule.init();
        return { logoutBtn, switchLink, compact };
      };

      // Case 1: MAC address username without #viewPlansLink
      const macUser = makeStatusActions('1C:BF:CE:B7:A4:D8', 'http-chap', false);
      expect(macUser.logoutBtn.style.display).toBe('none');
      expect(macUser.switchLink.style.display).toBe('none');
      expect(macUser.switchLink.hidden).toBe(true);
      expect(macUser.compact.style.display).toBe('none');

      // Case 2: Non-MAC display name with RouterOS login-by = mac, keeping container visible when #viewPlansLink exists
      const macProto = makeStatusActions('mac-device-1', 'mac', true);
      expect(macProto.logoutBtn.style.display).toBe('none');
      expect(macProto.switchLink.style.display).toBe('none');
      expect(macProto.switchLink.hidden).toBe(true);
      expect(macProto.compact.style.display).toBe('');

      // Case 3: Normal voucher / mac-cookie keeps switch-card visible
      const macCookie = makeStatusActions('12345678', 'mac-cookie', true);
      expect(macCookie.logoutBtn.style.display).toBe('');
      expect(macCookie.switchLink.style.display).toBe('');
      expect(macCookie.switchLink.hidden).toBe(false);
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

  describe('copyDiagnosticInfo and MAC type detection', () => {
    test('labels randomized vs hardware MAC in #status-mac-type on init', () => {
      document.documentElement.setAttribute('lang', 'ar');
      const macBtn = document.createElement('button');
      macBtn.id = 'tech-mac';
      macBtn.innerHTML = '<bdi dir="ltr">3C%3A5A%3AB4%3A0F%3A22%3A91</bdi> <span id="status-mac-type"></span>';
      document.body.appendChild(macBtn);

      statusModule.init();

      expect(macBtn.querySelector('bdi').textContent).toBe('3C:5A:B4:0F:22:91');
      const badge = document.getElementById('status-mac-type');
      expect(badge.textContent).toBe('(الجهاز)');
      expect(badge.classList.contains('mac-type-display--device')).toBe(true);
    });

    test('copyDiagnosticInfo builds summary from DOM fields and writes to clipboard', async () => {
      document.body.innerHTML =
        '<span id="stat-username"><bdi>8118</bdi></span>' +
        '<span id="stat-ip"><bdi>10.5.50.118</bdi></span>' +
        '<button id="tech-mac"><bdi>3C:5A:B4:0F:22:91</bdi> <span id="status-mac-type">(Device)</span></button>' +
        '<span id="device-os-display">Android Mobile</span>' +
        '<div id="tech-login-by">http-chap</div>' +
        '<div id="tech-server">hotspot1</div>' +
        '<div id="tech-idle-timeout">5m</div>' +
        '<div id="uptime"><bdi>00:10:00</bdi></div>' +
        '<button id="copy-diagnostics-btn"><span>Copy</span></button>';

      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true
      });

      statusModule.copyDiagnosticInfo(document.getElementById('copy-diagnostics-btn'));
      await Promise.resolve();

      expect(writeText).toHaveBeenCalledTimes(1);
      const payload = writeText.mock.calls[0][0];
      expect(payload).toContain('User: 8118');
      expect(payload).toContain('IP: 10.5.50.118');
      expect(payload).toContain('MAC: 3C:5A:B4:0F:22:91 (Device)');
      expect(payload).toContain('Login: http-chap');
      expect(payload).toContain('Server: hotspot1');
      expect(payload).toContain('Idle Timeout: 5m');
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
      expect(statusModule.parseTimeValue('1w2d03:04:05')).toBe(604800 + 2 * 86400 + 3 * 3600 + 4 * 60 + 5);
      expect(statusModule.parseTimeValue('1d02:30:15')).toBe(95415);
      expect(statusModule.parseTimeValue('1d')).toBe(86400);
      expect(statusModule.parseTimeValue('2h30m')).toBe(9000);
      expect(statusModule.parseTimeValue('10m5s')).toBe(605);
      
      // Empty/fallback values
      expect(statusModule.parseTimeValue('')).toBe(0);
      expect(statusModule.parseTimeValue(null)).toBe(0);
      expect(statusModule.parseTimeValue('invalid')).toBe(0);
      expect(statusModule.parseTimeValue('abc:def')).toBe(0);
      expect(Number.isNaN(statusModule.parseTimeValue('12:xx:34'))).toBe(false);
    });
  });

  describe('dismissPwaBanner & init', () => {
    beforeEach(() => {
      localStorage.clear();
      jest.useFakeTimers();
    });

    afterEach(() => {
      statusModule.dismissPwaBanner();
      jest.useRealTimers();
    });

    test('shows banner on init and auto-hides after 5 seconds', () => {
      expect(mockPwaBanner.style.display).toBe('none');
      statusModule.init();
      expect(mockPwaBanner.style.display).toBe('block');

      jest.advanceTimersByTime(4999);
      expect(mockPwaBanner.style.display).toBe('block');

      jest.advanceTimersByTime(1);
      expect(mockPwaBanner.style.display).toBe('none');
    });

    test('shows banner on every load even if previously dismissed', () => {
      localStorage.setItem('pwa_banner_dismissed', 'true');
      statusModule.init();
      expect(mockPwaBanner.style.display).toBe('block');

      statusModule.dismissPwaBanner();
      expect(mockPwaBanner.style.display).toBe('none');

      // Subsequent page load re-shows banner for a fresh 5-second window
      statusModule.init();
      expect(mockPwaBanner.style.display).toBe('block');
      jest.advanceTimersByTime(5000);
      expect(mockPwaBanner.style.display).toBe('none');
    });

    test('dismissPwaBanner hides banner immediately and clears pending timer', () => {
      statusModule.init();
      expect(mockPwaBanner.style.display).toBe('block');
      expect(statusModule._pwaHideTimer).not.toBeNull();

      statusModule.dismissPwaBanner();
      expect(mockPwaBanner.style.display).toBe('none');
      expect(statusModule._pwaHideTimer).toBeNull();
    });
  });

  describe('switchCard', () => {
    test('clears stored voucher credentials and navigates to ./login.html', async () => {
      localStorage.setItem('hotspot_last_voucher', '123456');
      localStorage.setItem('hotspot_last_voucher_pw', '123456');
      localStorage.setItem('hotspot_password', 'secret');
      sessionStorage.setItem('hotspot_last_voucher', '123456');

      const link = document.createElement('a');
      link.id = 'switchCardLink';
      link.setAttribute('href', './login.html');
      link.setAttribute('data-logout-url', 'http://10.5.50.1/logout?erase-cookie=on');
      document.body.appendChild(link);

      const prevFetch = global.fetch;
      const mockFetch = jest.fn(() => Promise.resolve());
      global.fetch = mockFetch;

      const origLocation = window.location;
      delete window.location;
      window.location = { href: 'http://localhost/ar/status.html' };

      try {
        const ret = statusModule.switchCard({ preventDefault: jest.fn() });
        expect(ret).toBe(false);
        expect(localStorage.getItem('hotspot_last_voucher')).toBeNull();
        expect(localStorage.getItem('hotspot_last_voucher_pw')).toBeNull();
        expect(localStorage.getItem('hotspot_password')).toBeNull();
        expect(sessionStorage.getItem('hotspot_last_voucher')).toBeNull();
        expect(mockFetch).toHaveBeenCalledWith(
          'http://10.5.50.1/logout?erase-cookie=on',
          expect.objectContaining({ method: 'GET', keepalive: true })
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(window.location.href).toBe('./login.html');
      } finally {
        window.location = origLocation;
        global.fetch = prevFetch;
        link.remove();
      }
    });
  });

  describe('smart status auto-refresh', () => {
    afterEach(() => {
      statusModule._stopAutoRefresh();
      statusModule.setAutoRefreshPaused(false);
      statusModule._isRefreshing = false;
      statusModule._isCheckingConnection = false;
      jest.useRealTimers();
      delete global.fetch;
    });

    test('getRefreshIntervalSeconds honors seconds, shorthand strings, minimum 15s floor, and ignores none/empty', () => {
      mockCountdownSection.removeAttribute('data-refresh-timeout');
      mockCountdownSection.removeAttribute('data-refresh-timeout-raw');
      expect(statusModule.getRefreshIntervalSeconds()).toBe(0);

      mockCountdownSection.setAttribute('data-refresh-timeout', 'none');
      expect(statusModule.getRefreshIntervalSeconds()).toBe(0);

      mockCountdownSection.setAttribute('data-refresh-timeout', '$(refresh-timeout-secs)');
      mockCountdownSection.setAttribute('data-refresh-timeout-raw', '2m');
      expect(statusModule.getRefreshIntervalSeconds()).toBe(120);

      mockCountdownSection.setAttribute('data-refresh-timeout', '5');
      expect(statusModule.getRefreshIntervalSeconds()).toBe(15);

      mockCountdownSection.setAttribute('data-refresh-timeout', '60');
      expect(statusModule.getRefreshIntervalSeconds()).toBe(60);
    });

    test('isAutoRefreshBusy defers when confirm bar or support modal is open', () => {
      expect(statusModule.isAutoRefreshBusy()).toBe(false);

      const confirmBar = document.createElement('div');
      confirmBar.id = 'logout-confirm-bar';
      confirmBar.hidden = false;
      document.body.appendChild(confirmBar);
      expect(statusModule.isAutoRefreshBusy()).toBe(true);

      confirmBar.hidden = true;
      expect(statusModule.isAutoRefreshBusy()).toBe(false);

      const modal = document.createElement('div');
      modal.className = 'support-modal support-modal--open';
      document.body.appendChild(modal);
      expect(statusModule.isAutoRefreshBusy()).toBe(true);
    });

    test('toggleAutoRefresh pauses/resumes countdown and updates UI state', () => {
      jest.useFakeTimers();
      mockCountdownSection.setAttribute('data-refresh-timeout', '60');

      const bar = document.createElement('div');
      bar.id = 'auto-refresh-bar';
      bar.hidden = true;
      const statusEl = document.createElement('span');
      statusEl.id = 'auto-refresh-status';
      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'auto-refresh-toggle';
      bar.appendChild(statusEl);
      bar.appendChild(toggleBtn);
      document.body.appendChild(bar);

      statusModule._startAutoRefresh();
      expect(bar.hidden).toBe(false);
      expect(statusEl.textContent).toBe('Auto-refresh in 60s');
      expect(toggleBtn.textContent).toBe('Pause');

      statusModule.toggleAutoRefresh();
      expect(statusModule.isAutoRefreshPaused()).toBe(true);
      expect(statusEl.textContent).toBe('Auto-refresh paused');
      expect(toggleBtn.textContent).toBe('Resume');

      statusModule.toggleAutoRefresh();
      expect(statusModule.isAutoRefreshPaused()).toBe(false);
      expect(statusEl.textContent).toBe('Auto-refresh in 60s');
      expect(toggleBtn.textContent).toBe('Pause');
    });

    test('refreshStatus updates quota and uptime in place without reloading and redirects if session ended', async () => {
      const bar = document.createElement('div');
      bar.id = 'auto-refresh-bar';
      document.body.appendChild(bar);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        url: 'http://localhost/status.html',
        text: () => Promise.resolve(
          '<html><body>' +
          '<div id="sessionCountdownSection" data-limit-bytes-total="104857600" data-remain-bytes-total="52428800" data-bytes-in="26214400" data-bytes-out="26214400" data-refresh-timeout="60"></div>' +
          '<div id="uptime" data-seconds="200"><bdi>3m 20s</bdi></div>' +
          '<div id="session-time-left" data-seconds="500"><bdi>00:08:20</bdi></div>' +
          '</body></html>'
        )
      });

      const ok = await statusModule.refreshStatus(true);
      expect(ok).toBe(true);
      expect(mockCountdownValue.textContent).toBe('50 MB');
      expect(mockUptime.getAttribute('data-seconds')).toBe('200');
      expect(statusModule._uptimeInterval).not.toBeNull();

      // If router returns fstatus/login HTML without #sessionCountdownSection, navigate there cleanly
      const origLocation = window.location;
      const replaceMock = jest.fn();
      delete window.location;
      window.location = { href: 'http://localhost/status.html', replace: replaceMock, reload: jest.fn() };
      try {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          url: 'http://localhost/login.html',
          text: () => Promise.resolve('<html><body><h1>Login</h1></body></html>')
        });
        const okAfterLogout = await statusModule.refreshStatus(true);
        expect(okAfterLogout).toBe(false);
        expect(replaceMock).toHaveBeenCalledWith('http://localhost/login.html');
      } finally {
        window.location = origLocation;
      }
    });
  });
});
