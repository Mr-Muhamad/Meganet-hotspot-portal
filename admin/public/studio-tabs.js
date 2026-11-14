/* global state, $, $$, esc, toast, markDirty, api, studioPrompt, renderProfileList, saveConfig, formMikrotik, scheduleSimulatorAutoRefresh */
'use strict';
// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'general', label: 'عام', group: 'design' },
  { id: 'theme', label: 'الثيم', group: 'design' },
  { id: 'features', label: 'المميزات', group: 'design' },
  { id: 'plans', label: 'الباقات', group: 'design' },
  { id: 'support', label: 'الدعم', group: 'design' },
  { id: 'announcements', label: 'الإعلانات', group: 'content' },
  { id: 'words', label: 'الكلمات والأخطاء', group: 'content' },
  { id: 'qrtest', label: 'مختبر QR الدخول', group: 'content' },
  { id: 'assets', label: 'الملفات والشعارات', group: 'content' },
  { id: 'mikrotik', label: 'مايكروتك (.rsc والرفع)', group: 'router' }
];

function renderTabs() {
  let prevGroup = null;
  $('#tabs').innerHTML = TABS.map(t => {
    const sep = (prevGroup && prevGroup !== t.group) ? '<span class="tab-sep" aria-hidden="true"></span>' : '';
    prevGroup = t.group;
    return sep + '<button class="tab' + (state.tab === t.id ? ' active' : '') + '" onclick="setTab(\'' + t.id + '\')">' + t.label + '</button>';
  }).join('');
}

function setTab(id) {
  // capture the tab we are leaving into drafts BEFORE re-rendering (the DOM
  // of the outgoing tab is about to be destroyed)
  if (state.tab !== id) captureDraft(state.tab);
  state.tab = id;
  renderTabs();
  renderTab();
}

// Snapshot the current tab's field values (its DOM is still present). Used so
// Save always applies EVERY tab's edits, not just the visible one.
function captureDraft(tab) {
  try {
    if (tab === 'general') {
      state.drafts.general = {
        networkName: $('#g-network').value.trim(),
        networkName_ar: $('#g-network-ar').value.trim(),
        poweredByText: $('#g-powered-text').value,
        poweredByText_ar: $('#g-powered-text-ar').value,
        poweredByName: $('#g-powered-name').value,
        poweredByName_ar: $('#g-powered-name-ar').value,
        poweredByUrl: $('#g-powered-url').value
      };
    } else if (tab === 'theme') {
      state.drafts.theme = {
        preset: $('#t-preset').value,
        defaultTheme: $('#t-default').value,
        primaryColor: $('#t-primary').value,
        backgroundColor: $('#t-bg').value,
        cardRadius: $('#t-radius').value.trim(),
        enableNetworkBackground: $('#t-canvas').value // '' = let the preset decide
      };
    } else if (tab === 'features') {
      state.drafts.features = {
        loginMode: $('#f-login').value,
        voucherPasswordMode: $('#f-pass').value,
        voucherFormat: $('#f-vfmt') ? $('#f-vfmt').value : 'numeric',
        enableQRScanner: $('#f-qr').value === 'true',
        qrScannerUrl: $('#f-qrurl').value.trim(),
        voucherMinLength: $('#f-min').value,
        enableLanguageToggle: $('#f-lang').value === 'true',
        enableClonePrevention: $('#f-clone').value === 'true',
        enableSmartAssistant: $('#f-smart').value === 'true',
        quotaDisplayFormat: $('#f-quota').value,
        kbBase: parseInt($('#f-kb').value, 10),
        enableTechDetails: $('#f-tech').value === 'true',
        security: {
          maxAttempts: parseInt($('#f-sec-max').value, 10) || 5,
          blockDurationMinutes: parseInt($('#f-sec-block').value, 10) || 2
        }
      };
    } else if (tab === 'plans') {
      const rows = [];
      $$('tr', $('#content')).forEach(tr => {
        const idx = tr.querySelector('input[data-i]');
        if (!idx) return;
        const i = parseInt(idx.dataset.i, 10);
        const row = { i };
        for (const input of $$('input[data-i]', tr)) row[input.dataset.k] = input.value.trim();
        const icon = tr.querySelector('select[data-k="icon"]');
        if (icon) row.icon = icon.value;
        rows.push(row);
      });
      state.drafts.plans = rows;
    } else if (tab === 'support') {
      const agents = [];
      state.current.config.support = state.current.config.support || { agents: [] };
      state.current.config.support.agents.forEach((agent, i) => {
        agents.push({
          i,
          name: $('#s-name-' + i).value.trim(),
          name_ar: $('#s-name-ar-' + i).value.trim(),
          role: $('#s-role-' + i).value.trim(),
          role_ar: $('#s-role-ar-' + i).value.trim(),
          phone: $('#s-phone-' + i).value.trim(),
          whatsapp: $('#s-wa-' + i).value.trim(),
          image: $('#s-img-' + i).value
        });
      });
      state.drafts.support = agents;
    } else if (tab === 'announcements') {
      const activeEl = $('#a-active');
      const typeEl = $('#a-type');
      const enEl = $('#a-en');
      const arEl = $('#a-ar');
      if (activeEl && typeEl && enEl && arEl) {
        state.drafts.announcements = {
          active: activeEl.value === 'true',
          type: typeEl.value,
          message_en: enEl.value.split('\n').map(s => s.trim()).filter(Boolean),
          message_ar: arEl.value.split('\n').map(s => s.trim()).filter(Boolean)
        };
      }
    } else if (tab === 'words') {
      const overrides = {};
      $$('#words-list .card').forEach(row => {
        const key = row.querySelector('.w-key')?.value;
        const en = row.querySelector('.w-en')?.value?.trim() || '';
        const ar = row.querySelector('.w-ar')?.value?.trim() || '';
        if (key && (en || ar)) {
          overrides[key] = { en, ar };
        }
      });
      state.drafts.words = overrides;

      const radiusErrors = {};
      $$('#radius-errors-list .r-row').forEach(row => {
        const k = row.querySelector('.r-key')?.value?.trim();
        const v = row.querySelector('.r-val')?.value?.trim();
        if (k && !k.startsWith('_') && v) {
          radiusErrors[k] = v;
        }
      });
      state.drafts.radiusErrors = radiusErrors;
    }
  } catch (err) { /* element not present — skip draft for this tab */ }
}

function applyDrafts(c) {
  const d = state.drafts;

  if (d.general) {
    if (d.general.networkName) c.general.networkName = d.general.networkName;
    if (d.general.networkName_ar) c.general.networkName_ar = d.general.networkName_ar;
    else delete c.general.networkName_ar;
    c.general.poweredByText = d.general.poweredByText;
    if (d.general.poweredByText_ar) c.general.poweredByText_ar = d.general.poweredByText_ar;
    else delete c.general.poweredByText_ar;
    c.general.poweredByName = d.general.poweredByName;
    if (d.general.poweredByName_ar) c.general.poweredByName_ar = d.general.poweredByName_ar;
    else delete c.general.poweredByName_ar;
    c.general.poweredByUrl = d.general.poweredByUrl;
  }

  if (d.theme) {
    if (d.theme.preset) c.theme.preset = d.theme.preset; else delete c.theme.preset;
    if (d.theme.defaultTheme) c.theme.defaultTheme = d.theme.defaultTheme;
    else delete c.theme.defaultTheme;
    c.theme.primaryColor = d.theme.primaryColor;
    c.theme.backgroundColor = d.theme.backgroundColor;
    // an empty radius means "let the preset supply it" (schema: required only
    // without a preset)
    if (d.theme.cardRadius) c.theme.cardRadius = d.theme.cardRadius;
    else delete c.theme.cardRadius;
    if (d.theme.enableNetworkBackground === '') delete c.theme.enableNetworkBackground;
    else c.theme.enableNetworkBackground = d.theme.enableNetworkBackground === 'true';
  }

  if (d.features) {
    c.features.loginMode = d.features.loginMode;
    c.features.voucherPasswordMode = d.features.voucherPasswordMode;
    c.features.voucherFormat = d.features.voucherFormat || 'numeric';
    c.features.enableQRScanner = d.features.enableQRScanner;
    if (d.features.qrScannerUrl) c.features.qrScannerUrl = d.features.qrScannerUrl;
    else delete c.features.qrScannerUrl;
    const min = d.features.voucherMinLength;
    const minParsed = parseInt(min, 10);
    if (min === '' || !Number.isFinite(minParsed)) delete c.features.voucherMinLength;
    else c.features.voucherMinLength = minParsed;
    c.features.enableLanguageToggle = d.features.enableLanguageToggle;
    c.features.enableClonePrevention = d.features.enableClonePrevention;
    c.features.enableSmartAssistant = d.features.enableSmartAssistant;
    c.features.quotaDisplayFormat = d.features.quotaDisplayFormat;
    c.features.kbBase = d.features.kbBase;
    c.features.enableTechDetails = d.features.enableTechDetails;
    c.security = c.security || {};
    c.security.maxAttempts = d.features.security.maxAttempts;
    c.security.blockDurationMinutes = d.features.security.blockDurationMinutes;
  }

  if (d.plans) {
    for (const row of d.plans) {
      const plan = c.plans[row.i];
      if (!plan) continue;
      for (const k of ['name', 'name_ar', 'quota', 'quota_ar', 'price']) {
        if (row[k] !== undefined) plan[k] = row[k];
      }
      if (row.icon) plan.icon = row.icon; else delete plan.icon;
    }
  }

  if (d.support && c.support && c.support.agents) {
    for (const a of d.support) {
      const agent = c.support.agents[a.i];
      if (!agent) continue;
      agent.name = a.name;
      if (a.name_ar) agent.name_ar = a.name_ar; else delete agent.name_ar;
      agent.role = a.role;
      if (a.role_ar) agent.role_ar = a.role_ar; else delete agent.role_ar;
      agent.phone = a.phone;
      agent.whatsapp = a.whatsapp;
      if (a.image) agent.image = a.image; else delete agent.image;
    }
  }

  if (d.words !== undefined) {
    if (Object.keys(d.words).length > 0) {
      c.i18nOverrides = d.words;
    } else {
      delete c.i18nOverrides;
    }
  }

  if (d.radiusErrors !== undefined) {
    c.radiusErrorTranslations = d.radiusErrors;
  }
}

function renderTab() {
  const c = JSON.parse(JSON.stringify(state.current.config));
  applyDrafts(c);
  const el = $('#content');
  el.innerHTML = '';
  switch (state.tab) {
    case 'general': el.appendChild(formGeneral(c)); break;
    case 'theme': el.appendChild(formTheme(c)); break;
    case 'features': el.appendChild(formFeatures(c)); break;
    case 'plans': el.appendChild(formPlans(c)); break;
    case 'support': el.appendChild(formSupport(c)); break;
    case 'announcements': el.appendChild(formAnnouncements()); break;
    case 'words': el.appendChild(formWords(c)); break;
    case 'qrtest': el.appendChild(formQrTester(c)); break;
    case 'assets': el.appendChild(formAssets()); break;
    case 'mikrotik': el.appendChild(formMikrotik(c)); break;
  }
}

function field(label, inputHtml, hint) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  wrap.innerHTML = '<label>' + label + '</label>' + inputHtml + (hint ? '<div class="hint">' + hint + '</div>' : '');
  return wrap;
}

// ---------------------------------------------------------------------------
// WCAG 2.1 Live Contrast Calculator
// ---------------------------------------------------------------------------
function hexLuminance(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return 0;
  const rgb = [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255
  ].map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function computeWcag(hex1, hex2) {
  const l1 = hexLuminance(hex1);
  const l2 = hexLuminance(hex2);
  const ratio = Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
  if (ratio >= 7) return { ratio, level: 'AAA', text: 'تباين ' + ratio + ':1 · AAA ممتاز', cls: 'wcag-pass' };
  if (ratio >= 4.5) return { ratio, level: 'AA', text: 'تباين ' + ratio + ':1 · AA جيد', cls: 'wcag-pass' };
  if (ratio >= 3) return { ratio, level: 'AA-Large', text: 'تباين ' + ratio + ':1 · AA للعناوين فقط', cls: 'wcag-warn' };
  return { ratio, level: 'FAIL', text: '⚠ تباين ضعيف (' + ratio + ':1)', cls: 'wcag-fail' };
}

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------
function formGeneral(c) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = '<h3>معلومات الشبكة والفوتر</h3>';
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.appendChild(field('اسم الشبكة (EN / الافتراضي)', '<input id="g-network" value="' + esc(c.general.networkName) + '">'));
  grid.appendChild(field('اسم الشبكة (AR - اختياري)', '<input id="g-network-ar" value="' + esc(c.general.networkName_ar || '') + '" placeholder="مثال: ميجا نت للحلول التقنية">'));
  grid.appendChild(field('نص الفوتر (EN / الافتراضي)', '<input id="g-powered-text" value="' + esc(c.general.poweredByText) + '">'));
  grid.appendChild(field('نص الفوتر (AR - اختياري)', '<input id="g-powered-text-ar" value="' + esc(c.general.poweredByText_ar || '') + '" placeholder="مثال: تطوير وتشغيل ">'));
  grid.appendChild(field('اسم رابط الفوتر (EN / الافتراضي)', '<input id="g-powered-name" value="' + esc(c.general.poweredByName) + '">'));
  grid.appendChild(field('اسم رابط الفوتر (AR - اختياري)', '<input id="g-powered-name-ar" value="' + esc(c.general.poweredByName_ar || '') + '" placeholder="مثال: ميجا نت للحلول التقنية">'));
  grid.appendChild(field('رابط الفوتر', '<input id="g-powered-url" value="' + esc(c.general.poweredByUrl) + '">'));
  card.appendChild(grid);
  return card;
}

// ---------------------------------------------------------------------------
// Theme (with Live WCAG Contrast Badge & Presets Gallery)
// ---------------------------------------------------------------------------
function formTheme(c) {
  const t = c.theme || {};

  const presets = (state.meta && state.meta.presets) ? state.meta.presets : [];
  const galleryCard = document.createElement('div');
  galleryCard.className = 'card';
  galleryCard.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">' +
      '<h3 style="margin:0;font-size:15px;color:var(--text)">🎨 شخصيات القوالب والبريسيتات الجاهزة (' + presets.length + ' شخصية)</h3>' +
      '<span style="font-size:12px;color:var(--muted)">اضغط على أي شخصية لمعاينتها وتطبيق ألوانها وحوافها فوراً</span>' +
    '</div>';

  const pGrid = document.createElement('div');
  pGrid.className = 'preset-grid';

  for (const p of presets) {
    const isAct = (t.preset === p.id);
    const pEl = document.createElement('div');
    pEl.className = 'preset-card' + (isAct ? ' active' : '');
    pEl.dataset.presetId = p.id;
    pEl.onclick = () => applyPresetToInputs(p.id);

    const colors = p.preview?.colors || ['#22c55e', '#020617'];
    const defTh = p.theme?.defaultTheme === 'light' ? 'نهاري' : 'داكن';
    const rad = p.preview?.radius || p.theme?.cardRadius || '16px';

    pEl.innerHTML =
      '<div class="preset-card-top">' +
        '<span class="preset-card-title">' + (p.custom ? '★ ' : '') + esc(p.id) + '</span>' +
        '<div class="preset-swatches">' +
          '<span class="preset-swatch-dot" style="background:' + esc(colors[0]) + '" title="اللون الأساسي: ' + esc(colors[0]) + '"></span>' +
          '<span class="preset-swatch-dot" style="background:' + esc(colors[1]) + '" title="الخلفية: ' + esc(colors[1]) + '"></span>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--muted);line-height:1.4">' + esc(p.label) + '</div>' +
      '<div class="preset-meta-tags">' +
        '<span class="preset-tag">' + defTh + '</span>' +
        '<span class="preset-tag">حواف ' + esc(rad) + '</span>' +
        (p.custom ? '<span class="preset-tag" style="color:var(--acc)">مخصص</span>' : '') +
      '</div>';
    pGrid.appendChild(pEl);
  }
  galleryCard.appendChild(pGrid);
  $('#content').appendChild(galleryCard);

  // Manual Adjustments Form
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = '<h3>تخصيص الألوان والحواف يدوياً</h3>';
  const grid = document.createElement('div');
  grid.className = 'grid';

  const presetSel = '<div style="display:flex;gap:8px;flex-direction:column">' +
    '<select id="t-preset"><option value="">بدون بريسيت (يدوي)</option>' +
    presets.map(p =>
      '<option value="' + esc(p.id) + '"' + (t.preset === p.id ? ' selected' : '') + '>' +
      (p.custom ? '★ ' : '') + esc(p.label) + '</option>').join('') +
    '</select>' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<button class="rowbtn" type="button" style="color:var(--acc);border-color:var(--acc)" onclick="applyPresetToInputs()">⚡ تطبيق هذا البريسيت</button>' +
      '<button class="rowbtn" type="button" onclick="saveCurrentAsPreset()">💾 احفظ كشخصية مخصصة</button>' +
    '</div>' +
    '<div id="preset-preview" style="margin-top:4px"></div>' +
    '</div>';
  grid.appendChild(field('بريسيت الشخصية النشط', presetSel, 'يحدد الشخصية التجارية للقالب — تملأ الثيم والكلمات'));

  const renderPreview = () => {
    const sel = $('#t-preset');
    const p = state.meta.presets.find(x => x.id === sel.value);
    const box = $('#preset-preview');
    if (!box) return;
    if (!p || !p.preview) { box.innerHTML = ''; return; }
    box.innerHTML = p.preview.colors.map(col =>
      '<span class="swatch" style="display:inline-block;background:' + esc(col) + ';width:22px;height:22px;margin-inline-end:6px;vertical-align:middle"></span>'
    ).join('') + '<span class="badge">حواف ' + esc(p.preview.radius) + '</span>';
  };

  grid.appendChild(field('الثيم الافتراضي',
    '<select id="t-default"><option value=""' + (!t.defaultTheme ? ' selected' : '') + '>(حسب البريسيت — ودارك بدونه)</option>' +
    '<option value="dark"' + (t.defaultTheme === 'dark' ? ' selected' : '') + '>داكن</option>' +
    '<option value="light"' + (t.defaultTheme === 'light' ? ' selected' : '') + '>نهاري</option></select>',
    'أول زيارة للزائر'));

  grid.appendChild(field('اللون الأساسي',
    '<div class="colorrow"><input id="t-primary" type="color" value="' + (t.primaryColor || '#22c55e') + '"><span class="swatch" id="t-primary-swatch"></span><span class="badge" id="wcag-badge" aria-live="polite"></span></div>',
    'كل التوهجات والحدود والزجاج تتبع هذا اللون تلقائياً · مؤشر التباين يفحص وضوح اللون الأساسي مع الخلفية'));

  grid.appendChild(field('لون الخلفية (دارك)',
    '<div class="colorrow"><input id="t-bg" type="color" value="' + (t.backgroundColor || '#020617') + '"><span class="swatch" id="t-bg-swatch"></span></div>'));

  grid.appendChild(field('استدارة الحواف',
    '<input id="t-radius" type="text" value="' + esc(t.cardRadius || '') + '" placeholder="اتركها فارغة ليحددها البريسيت">',
    'مثال: 0px حاد · 16px متوسط · 24px ودود — فارغة = من البريسيت'));

  grid.appendChild(field('الخلفية المتحركة',
    '<select id="t-canvas"><option value=""' + (t.enableNetworkBackground === undefined ? ' selected' : '') + '>(حسب البريسيت)</option>' +
    '<option value="true"' + (t.enableNetworkBackground === true ? ' selected' : '') + '>شغالة</option>' +
    '<option value="false"' + (t.enableNetworkBackground === false ? ' selected' : '') + '>مقفولة</option></select>',
    'الجسيمات المتحركة خلف الصفحة'));

  card.appendChild(grid);
  $('#content').appendChild(card);
  const sync = () => {
    const prim = $('#t-primary').value;
    const bg = $('#t-bg').value;
    $('#t-primary-swatch').style.background = prim;
    $('#t-bg-swatch').style.background = bg;
    const wcag = computeWcag(prim, bg);
    const badge = $('#wcag-badge');
    if (badge) {
      badge.textContent = wcag.text;
      badge.className = 'badge ' + wcag.cls;
      badge.dataset.level = wcag.level;
    }
    renderPreview();
  };
  $('#t-primary').addEventListener('input', sync);
  $('#t-bg').addEventListener('input', sync);
  $('#t-preset').addEventListener('change', () => {
    const val = $('#t-preset').value;
    document.querySelectorAll('.preset-card').forEach(c => {
      c.classList.toggle('active', c.dataset.presetId === val);
    });
    sync();
  });
  sync();
  return card;
}

function applyPresetToInputs(presetId) {
  const id = presetId || $('#t-preset')?.value;
  if (!id) return;
  const p = state.meta?.presets?.find(x => x.id === id);
  if (!p) return;
  if ($('#t-preset')) $('#t-preset').value = id;
  if (p.preview && p.preview.colors) {
    if ($('#t-primary')) $('#t-primary').value = p.preview.colors[0];
    if ($('#t-bg')) $('#t-bg').value = p.preview.colors[1];
  }
  if (p.preview && p.preview.radius && $('#t-radius')) {
    $('#t-radius').value = p.preview.radius;
  }
  if (p.theme) {
    if (p.theme.defaultTheme && $('#t-default')) {
      $('#t-default').value = p.theme.defaultTheme;
    }
    if (p.theme.enableNetworkBackground !== undefined && $('#t-canvas')) {
      $('#t-canvas').value = String(p.theme.enableNetworkBackground);
    }
  }
  document.querySelectorAll('.preset-card').forEach(c => {
    c.classList.toggle('active', c.dataset.presetId === id);
  });
  const prim = $('#t-primary')?.value;
  const bg = $('#t-bg')?.value;
  if ($('#t-primary-swatch')) $('#t-primary-swatch').style.background = prim;
  if ($('#t-bg-swatch')) $('#t-bg-swatch').style.background = bg;
  const wcag = computeWcag(prim, bg);
  const badge = $('#wcag-badge');
  if (badge) {
    badge.textContent = wcag.text;
    badge.className = 'badge ' + wcag.cls;
    badge.dataset.level = wcag.level;
  }
  const box = $('#preset-preview');
  if (box && p.preview && p.preview.colors) {
    box.innerHTML = p.preview.colors.map(col =>
      '<span class="swatch" style="display:inline-block;background:' + esc(col) + ';width:22px;height:22px;margin-inline-end:6px;vertical-align:middle"></span>'
    ).join('') + '<span class="badge">حواف ' + esc(p.preview.radius) + '</span>';
  }
  markDirty(true);
  scheduleSimulatorAutoRefresh();
  toast('تم تطبيق بريسيت: ' + p.label);
}

async function saveCurrentAsPreset() {
  if (!state.current) return;
  const id = await studioPrompt('معرّف الشخصية (إنجليزي):', state.current.id + '-style', {
    title: 'حفظ كشخصية مخصصة'
  });
  if (!id) return;
  try {
    captureDraft(state.tab);
    const saved = await saveConfig();
    if (!saved) return;
    const data = await api('/presets', {
      method: 'POST',
      body: JSON.stringify({ slug: state.current.id, id, label: state.current.name + ' — شخصية مخصصة' })
    });
    toast('تم حفظ الشخصية: ' + data.id);
    state.meta = await api('/meta'); // refresh the presets list
    renderTab();
  } catch (e) { toast(e.message, true); }
}

// ---------------------------------------------------------------------------
// Features + Security
// ---------------------------------------------------------------------------
function formFeatures(c) {
  const f = c.features || {};
  const sec = c.security || {};
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = '<h3>وظائف البوابة</h3>';
  const grid = document.createElement('div');
  grid.className = 'grid';

  grid.appendChild(field('طريقة الدخول',
    '<select id="f-login">' +
    ['voucher_only', 'normal_only', 'both'].map(m =>
      '<option value="' + m + '"' + (f.loginMode === m ? ' selected' : '') + '>' +
      ({ voucher_only: 'كوبونات فقط', normal_only: 'حسابات فقط', both: 'الاتنين' }[m]) + '</option>').join('') +
    '</select>'));

  grid.appendChild(field('كلمة مرور الكوبونات',
    '<select id="f-pass"><option value="same"' + (f.voucherPasswordMode !== 'empty' ? ' selected' : '') + '>نفس الكود</option>' +
    '<option value="empty"' + (f.voucherPasswordMode === 'empty' ? ' selected' : '') + '>بدون كلمة مرور</option></select>',
    'حسب نظام كروت شبكتك — الخطأ هنا يمنع الدخول'));

  grid.appendChild(field('صيغة كود الكارت',
    '<select id="f-vfmt"><option value="numeric"' + (f.voucherFormat !== 'alphanumeric' ? ' selected' : '') + '>أرقام فقط (لوحة أرقام)</option>' +
    '<option value="alphanumeric"' + (f.voucherFormat === 'alphanumeric' ? ' selected' : '') + '>حروف وأرقام</option></select>',
    'يفضل أرقام فقط للكروت الرقمية لتسهيل الإدخال على الموبايل'));

  grid.appendChild(field('مسح QR',
    '<select id="f-qr"><option value="true"' + (f.enableQRScanner !== false ? ' selected' : '') + '>مفعل</option>' +
    '<option value="false"' + (f.enableQRScanner === false ? ' selected' : '') + '>مقفول</option></select>'));

  grid.appendChild(field('ماسح QR خارجي (اختياري)',
    '<input id="f-qrurl" type="text" value="' + esc(f.qrScannerUrl || '') + '" placeholder="اتركه فارغاً للماسح المدمج">',
    'رابط ماسح خارجي يستبدل الماسح المدمج — يُضاف تلقائياً إلى Walled Garden في ملف .rsc'));

  grid.appendChild(field('أدنى طول لكود الشحن',
    '<input id="f-min" type="number" min="1" value="' + (f.voucherMinLength || '') + '">',
    'فارغ = بدون تحقق'));

  grid.appendChild(field('زر تغيير اللغة',
    '<select id="f-lang"><option value="true"' + (f.enableLanguageToggle !== false ? ' selected' : '') + '>ظاهر</option>' +
    '<option value="false"' + (f.enableLanguageToggle === false ? ' selected' : '') + '>مخفي</option></select>'));

  grid.appendChild(field('حماية الكروت من المشاركة',
    '<select id="f-clone"><option value="true"' + (f.enableClonePrevention !== false ? ' selected' : '') + '>مفعلة</option>' +
    '<option value="false"' + (f.enableClonePrevention === false ? ' selected' : '') + '>مقفولة</option></select>'));

  grid.appendChild(field('المساعد الذكي (صفحة الحالة)',
    '<select id="f-smart"><option value="true"' + (f.enableSmartAssistant !== false ? ' selected' : '') + '>مفعل</option>' +
    '<option value="false"' + (f.enableSmartAssistant === false ? ' selected' : '') + '>مقفول</option></select>'));

  grid.appendChild(field('صيغة الرصيد',
    '<select id="f-quota"><option value="GB"' + (f.quotaDisplayFormat === 'GB' ? ' selected' : '') + '>جيجا بايت</option>' +
    '<option value="MB"' + (f.quotaDisplayFormat === 'MB' ? ' selected' : '') + '>ميجا بايت</option></select>'));

  grid.appendChild(field('القاعدة السابقة للكيلوبايت',
    '<select id="f-kb"><option value="1000"' + (f.kbBase === 1000 ? ' selected' : '') + '>1000 (تجاري)</option>' +
    '<option value="1024"' + (f.kbBase === 1024 ? ' selected' : '') + '>1024 (هندسي)</option></select>'));

  grid.appendChild(field('التفاصيل التقنية (IP/MAC)',
    '<select id="f-tech"><option value="true"' + (f.enableTechDetails !== false ? ' selected' : '') + '>ظاهرة</option>' +
    '<option value="false"' + (f.enableTechDetails === false ? ' selected' : '') + '>مخفية</option></select>'));

  card.appendChild(grid);

  const secCard = document.createElement('div');
  secCard.className = 'card';
  secCard.innerHTML = '<h3>الحماية ومكافحة التخمين</h3>';
  const secGrid = document.createElement('div');
  secGrid.className = 'grid';
  secGrid.appendChild(field('أقصى محاولات دخول خاطئة',
    '<input id="f-sec-max" type="number" min="1" value="' + (sec.maxAttempts || 5) + '">',
    'عدد المحاولات قبل حظر الجهاز'));
  secGrid.appendChild(field('مدة الحظر (دقائق)',
    '<input id="f-sec-block" type="number" min="1" value="' + (sec.blockDurationMinutes || 2) + '">'));
  secCard.appendChild(secGrid);

  const wrap = document.createElement('div');
  wrap.appendChild(card);
  wrap.appendChild(secCard);
  return wrap;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------
function formPlans(c) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = '<h3>باقات الاشتراك</h3><div class="planshint">الحصة هي القيمة المعروضة (مثال: "10 GB"). السعر رقم فقط.</div>';
  const table = document.createElement('table');
  const head = document.createElement('tr');
  head.innerHTML = '<th>الاسم (EN)</th><th>الاسم (AR)</th><th>الحصة</th><th>الحصة (AR)</th><th>السعر</th><th>الأيقونة</th><th></th>';
  table.appendChild(head);

  (c.plans || []).forEach((plan, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input data-i="' + i + '" data-k="name" value="' + esc(plan.name) + '"></td>' +
      '<td><input data-i="' + i + '" data-k="name_ar" value="' + esc(plan.name_ar || '') + '"></td>' +
      '<td><input data-i="' + i + '" data-k="quota" value="' + esc(plan.quota) + '"></td>' +
      '<td><input data-i="' + i + '" data-k="quota_ar" value="' + esc(plan.quota_ar || '') + '"></td>' +
      '<td><input data-i="' + i + '" data-k="price" value="' + esc(plan.price) + '"></td>' +
      '<td><select data-i="' + i + '" data-k="icon">' +
      state.meta.planIcons.map(ic => '<option value="' + ic + '"' + (plan.icon === ic ? ' selected' : '') + '>' + ic + '</option>').join('') +
      '</select></td>' +
      '<td><button class="rowbtn" onclick="removePlan(' + i + ')">حذف</button></td>';
    table.appendChild(tr);
  });

  card.appendChild(table);
  const add = document.createElement('button');
  add.className = 'btn ghost addbtn';
  add.textContent = '＋ إضافة باقة';
  add.onclick = addPlan;
  card.appendChild(add);
  return card;
}

function addPlan() {
  captureDraft(state.tab);
  applyDrafts(state.current.config);
  delete state.drafts.plans;
  state.current.config.plans = state.current.config.plans || [];
  state.current.config.plans.push({ name: 'New Plan', name_ar: 'باقة جديدة', quota: '10 GB', quota_ar: '10 جيجا', price: '60', icon: 'globe' });
  markDirty(true);
  renderTab();
}

function removePlan(i) {
  captureDraft(state.tab);
  applyDrafts(state.current.config);
  delete state.drafts.plans;
  state.current.config.plans.splice(i, 1);
  markDirty(true);
  renderTab();
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------
function formSupport(c) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = '<h3>فريق الدعم</h3>';
  const grid = document.createElement('div');

  const agents = c.support && c.support.agents ? c.support.agents : [];
  const imageAssets = state.current.assets.filter(a => /\.(png|jpe?g|webp)$/i.test(a.name));
  agents.forEach((agent, i) => {
    const box = document.createElement('div');
    box.className = 'card';
    box.style.marginBottom = '10px';
    const agentGrid = document.createElement('div');
    agentGrid.className = 'grid';
    const imgOptions = ['<option value="">بدون صورة</option>']
      .concat(imageAssets.map(a =>
        '<option value="' + esc(a.name) + '"' + (agent.image === a.name ? ' selected' : '') + '>' + esc(a.name) + '</option>'))
      .join('');
    agentGrid.appendChild(field('الاسم (EN / الافتراضي)', '<input id="s-name-' + i + '" value="' + esc(agent.name) + '">'));
    agentGrid.appendChild(field('الاسم (AR - اختياري)', '<input id="s-name-ar-' + i + '" value="' + esc(agent.name_ar || '') + '" placeholder="مثال: الدعم الفني">'));
    agentGrid.appendChild(field('الدور (EN / الافتراضي)', '<input id="s-role-' + i + '" value="' + esc(agent.role) + '">'));
    agentGrid.appendChild(field('الدور (AR - اختياري)', '<input id="s-role-ar-' + i + '" value="' + esc(agent.role_ar || '') + '" placeholder="مثال: خدمة العملاء">'));
    agentGrid.appendChild(field('التليفون', '<input id="s-phone-' + i + '" value="' + esc(agent.phone || '') + '">'));
    agentGrid.appendChild(field('واتساب (بكود الدولة)', '<input id="s-wa-' + i + '" value="' + esc(agent.whatsapp || '') + '">'));
    agentGrid.appendChild(field('صورة (من ملفات الهوية المرفوعة)',
      '<select id="s-img-' + i + '">' + imgOptions + '</select>',
      imageAssets.length ? '' : 'ارفع صور الوكلاء من تبويب الملفات أولاً'));
    box.appendChild(agentGrid);
    const del = document.createElement('button');
    del.className = 'rowbtn';
    del.style.marginTop = '10px';
    del.textContent = 'إزالة';
    del.onclick = () => removeAgent(i);
    box.appendChild(del);
    grid.appendChild(box);
  });

  card.appendChild(grid);
  const add = document.createElement('button');
  add.className = 'btn ghost addbtn';
  add.textContent = '＋ إضافة وكيل دعم';
  add.onclick = () => {
    captureDraft(state.tab);
    applyDrafts(state.current.config);
    delete state.drafts.support;
    state.current.config.support = state.current.config.support || { agents: [] };
    state.current.config.support.agents.push({ name: 'Technical Support', name_ar: 'الدعم الفني', role: 'Customer Service', role_ar: 'خدمة العملاء', phone: '+201000000000', whatsapp: '201000000000' });
    markDirty(true);
    renderTab();
  };
  card.appendChild(add);
  return card;
}

function removeAgent(i) {
  captureDraft(state.tab);
  applyDrafts(state.current.config);
  delete state.drafts.support;
  state.current.config.support.agents.splice(i, 1);
  markDirty(true);
  renderTab();
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
function formAnnouncements() {
  const a = state.drafts.announcements || state.current.announcements || { active: false, type: 'promo', message_en: [], message_ar: [] };
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = '<h3>بانر الإعلان</h3>';

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.appendChild(field('مفعل',
    '<select id="a-active"><option value="true"' + (a.active ? ' selected' : '') + '>نعم</option>' +
    '<option value="false"' + (!a.active ? ' selected' : '') + '>لا</option></select>'));
  grid.appendChild(field('النوع',
    '<select id="a-type">' +
    '<option value="info"' + (a.type === 'info' ? ' selected' : '') + '>معلومات</option>' +
    '<option value="promo"' + (a.type === 'promo' ? ' selected' : '') + '>ترويجي</option>' +
    '<option value="warning"' + (a.type === 'warning' ? ' selected' : '') + '>تحذير</option></select>'));
  card.appendChild(grid);

  const msgCard = document.createElement('div');
  msgCard.className = 'card';
  msgCard.innerHTML = '<h3>الرسائل (سطر لكل رسالة)</h3>' +
    '<div class="grid"><div class="field"><label>إنجليزية</label><textarea id="a-en">' + esc((a.message_en || []).join('\n')) + '</textarea></div>' +
    '<div class="field"><label>عربية</label><textarea id="a-ar">' + esc((a.message_ar || []).join('\n')) + '</textarea></div></div>';
  card.appendChild(msgCard);
  return card;
}

// ---------------------------------------------------------------------------
// Words (i18n overrides) + RADIUS Error Translations UI
// ---------------------------------------------------------------------------
function formWords(c) {
  const wrap = document.createElement('div');
  const cfg = c || JSON.parse(JSON.stringify(state.current.config));

  cfg.i18nOverrides = cfg.i18nOverrides || {};
  const ov = cfg.i18nOverrides;
  const syncWordsDraft = () => {
    const clean = {};
    for (const [k, v] of Object.entries(ov)) {
      if (k.startsWith('_')) continue;
      if (typeof v === 'object') {
        if ((v.en && v.en.trim()) || (v.ar && v.ar.trim())) clean[k] = { en: v.en || '', ar: v.ar || '' };
      } else if (String(v || '').trim()) {
        clean[k] = v;
      }
    }
    state.drafts.words = clean;
  };
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = '<h3>قاموس العميل — استبدال كلمات البوابة (i18nOverrides)</h3>' +
    '<div class="planshint">اختر مفتاحاً من القائمة الرسمية، واترك النصوص فارغة لحذف التخصيص.</div>';
  const output = document.createElement('div');
  output.id = 'words-list';

  const renderWords = () => {
    output.innerHTML = '';
    const entries = Object.entries(ov).filter(([k]) => !k.startsWith('_'));
    for (const [key, val] of entries) {
      const en = typeof val === 'object' ? (val.en || '') : val;
      const ar = typeof val === 'object' ? (val.ar || '') : val;
      const row = document.createElement('div');
      row.className = 'card';
      row.style.marginBottom = '10px';
      row.innerHTML =
        '<div class="grid">' +
        '<div class="field"><label>المفتاح</label><select class="w-key">' +
        state.meta.knownKeys.map(k => '<option value="' + esc(k) + '"' + (k === key ? ' selected' : '') + '>' + esc(k) + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>إنجليزية</label><input class="w-en" value="' + esc(en) + '"></div>' +
        '<div class="field"><label>عربية</label><input class="w-ar" value="' + esc(ar) + '"></div>' +
        '</div><button class="rowbtn" style="margin-top:8px">إزالة</button>';
      const del = row.querySelector('.rowbtn');
      del.onclick = () => { delete ov[key]; syncWordsDraft(); markDirty(true); renderWords(); scheduleSimulatorAutoRefresh(); };
      row.querySelector('.w-key').onchange = (e) => {
        const nk = e.target.value;
        if (nk === key) return;
        ov[nk] = ov[key]; delete ov[key]; syncWordsDraft(); markDirty(true); renderWords();
      };
      row.querySelector('.w-en').oninput = (e) => {
        const currentPair = typeof ov[key] === 'object' ? ov[key] : { en: ov[key] || '', ar: ov[key] || '' };
        currentPair.en = e.target.value;
        ov[key] = currentPair;
        syncWordsDraft();
      };
      row.querySelector('.w-ar').oninput = (e) => {
        const currentPair = typeof ov[key] === 'object' ? ov[key] : { en: ov[key] || '', ar: ov[key] || '' };
        currentPair.ar = e.target.value;
        ov[key] = currentPair;
        syncWordsDraft();
      };
      output.appendChild(row);
    }
  };
  renderWords();
  card.appendChild(output);

  const add = document.createElement('button');
  add.className = 'btn ghost addbtn';
  add.textContent = '＋ إضافة كلمة مخصصة';
  add.onclick = () => {
    const firstFree = state.meta.knownKeys.find(k => !(k in ov));
    ov[firstFree || 'login_button'] = { en: '', ar: '' };
    syncWordsDraft();
    markDirty(true);
    renderWords();
  };
  card.appendChild(add);
  wrap.appendChild(card);

  // --- RADIUS & MikroTik Server Error Translations Card ---
  cfg.radiusErrorTranslations = cfg.radiusErrorTranslations || {};
  const radMap = cfg.radiusErrorTranslations;
  const syncRadiusDraft = () => {
    const clean = {};
    for (const [k, v] of Object.entries(radMap)) {
      if (!k.startsWith('_') && String(v || '').trim()) clean[k] = String(v).trim();
    }
    state.drafts.radiusErrors = clean;
  };
  const radCard = document.createElement('div');
  radCard.className = 'card';
  radCard.innerHTML =
    '<h3>ترجمة رسائل أخطاء المايكروتك والـ RADIUS (radiusErrorTranslations)</h3>' +
    '<div class="planshint">تُطابق رسائل الخطأ الإنجليزية القادمة من السيرفر (Reply-Message) وتستبدلها بالرسالة العربية المخصصة للمشترك.</div>' +
    '<datalist id="radius-common-keys">' +
    ['invalid username or password', 'uptime limit reached', 'traffic limit reached', 'simultaneous session limit reached', 'no more sessions are allowed', 'mac address is not yours', 'account expired', 'credit limit reached', 'trial time limit reached', 'radius server is not responding']
      .map(k => '<option value="' + esc(k) + '">').join('') +
    '</datalist>';

  const radList = document.createElement('div');
  radList.id = 'radius-errors-list';

  const renderRadiusErrors = () => {
    radList.innerHTML = '';
    const entries = Object.entries(radMap).filter(([k]) => !k.startsWith('_'));
    entries.forEach(([errKey, arText]) => {
      const row = document.createElement('div');
      row.className = 'card r-row';
      row.style.marginBottom = '8px';
      row.style.padding = '12px';
      row.innerHTML =
        '<div class="grid">' +
        '<div class="field"><label>نص خطأ السيرفر (EN)</label><input class="r-key" list="radius-common-keys" dir="ltr" value="' + esc(errKey) + '"></div>' +
        '<div class="field"><label>الترجمة العربية للمشترك</label><input class="r-val" value="' + esc(arText) + '"></div>' +
        '</div>' +
        '<button class="rowbtn" style="margin-top:8px">حذف الترجمة</button>';
      row.querySelector('.rowbtn').onclick = () => {
        delete radMap[errKey];
        syncRadiusDraft();
        markDirty(true);
        renderRadiusErrors();
        scheduleSimulatorAutoRefresh();
      };
      row.querySelector('.r-key').onchange = (e) => {
        const nk = e.target.value.trim();
        if (!nk || nk === errKey) return;
        radMap[nk] = radMap[errKey];
        delete radMap[errKey];
        syncRadiusDraft();
        markDirty(true);
        renderRadiusErrors();
      };
      row.querySelector('.r-val').oninput = (e) => {
        radMap[errKey] = e.target.value;
        syncRadiusDraft();
      };
      radList.appendChild(row);
    });
  };
  renderRadiusErrors();
  radCard.appendChild(radList);

  const radBtnRow = document.createElement('div');
  radBtnRow.style.display = 'flex';
  radBtnRow.style.gap = '8px';
  radBtnRow.style.marginTop = '8px';

  const addRadBtn = document.createElement('button');
  addRadBtn.className = 'btn ghost';
  addRadBtn.textContent = '＋ إضافة ترجمة خطأ RADIUS';
  addRadBtn.onclick = () => {
    let idx = Object.keys(radMap).filter(k => !k.startsWith('_')).length + 1;
    let newKey = 'custom error ' + idx;
    while (newKey in radMap) {
      idx += 1;
      newKey = 'custom error ' + idx;
    }
    radMap[newKey] = 'رسالة خطأ مخصصة للمشترك.';
    syncRadiusDraft();
    markDirty(true);
    renderRadiusErrors();
  };

  const resetRadBtn = document.createElement('button');
  resetRadBtn.className = 'btn ghost';
  resetRadBtn.textContent = '↺ استعادة الترجمات الافتراضية';
  resetRadBtn.onclick = () => {
    if (state.meta && state.meta.template && state.meta.template.radiusErrorTranslations) {
      state.drafts.radiusErrors = JSON.parse(JSON.stringify(state.meta.template.radiusErrorTranslations));
      markDirty(true);
      renderTab();
      scheduleSimulatorAutoRefresh();
    }
  };

  radBtnRow.appendChild(addRadBtn);
  radBtnRow.appendChild(resetRadBtn);
  radCard.appendChild(radBtnRow);
  wrap.appendChild(radCard);

  return wrap;
}

// ---------------------------------------------------------------------------
// Portal QR Login Tester (dedicated to testing hotspot login QR scanning)
// ---------------------------------------------------------------------------
function formQrTester(c) {
  const wrap = document.createElement('div');

  const testerCard = document.createElement('div');
  testerCard.className = 'card';
  testerCard.innerHTML =
    '<h3>🔍 مختبر رمز QR لتسجيل الدخول (Portal QR Login Tester)</h3>' +
    '<div class="planshint">اختبر مسح رمز الـ QR بكاميرا الهاتف للتأكد من توافق رابط الدخول أو كود الكرت مع ماسح القالب (<code>jsQR</code>) وإعدادات كلمة المرور الحالية.</div>';

  const defaultDns = (state.current.mikrotik && state.current.mikrotik.dnsName) ? state.current.mikrotik.dnsName : 'login.meganet.local';
  const testerGrid = document.createElement('div');
  testerGrid.className = 'grid';
  testerGrid.appendChild(field('كود الكرت التجريبي', '<input id="v-test-code" data-ignore-dirty="1" value="88442299">'));
  testerGrid.appendChild(field('رابط صفحة الدخول بالراوتر', '<input id="v-test-dns" data-ignore-dirty="1" dir="ltr" value="http://' + esc(defaultDns) + '/login">'));
  testerGrid.appendChild(field('صيغة رمز الـ QR',
    '<select id="v-test-mode" data-ignore-dirty="1">' +
    '<option value="url">رابط دخول تلقائي (كود + كلمة مرور)</option>' +
    '<option value="code">كود الكرت فقط</option>' +
    '</select>'));
  testerCard.appendChild(testerGrid);

  const previewBox = document.createElement('div');
  previewBox.className = 'qr-preview-box';
  previewBox.innerHTML =
    '<div class="qr-svg-wrap" id="v-qr-svg"></div>' +
    '<div style="flex:1;min-width:200px">' +
    '<div style="font-weight:700;font-size:15px;margin-bottom:4px" id="v-card-title">' + esc(c.general.networkName) + '</div>' +
    '<div style="font-family:monospace;font-size:20px;font-weight:700;color:var(--acc);margin-bottom:6px" id="v-card-code">88442299</div>' +
    '<div style="font-family:monospace;font-size:13px;color:var(--text);opacity:.88;word-break:break-all;direction:ltr;text-align:left" id="v-card-payload"></div>' +
    '</div>';
  testerCard.appendChild(previewBox);
  wrap.appendChild(testerCard);

  setTimeout(() => {
    const updateLiveQr = async () => {
      const code = ($('#v-test-code')?.value || '').trim() || '884422';
      const dns = ($('#v-test-dns')?.value || '').trim();
      const mode = $('#v-test-mode')?.value || 'url';
      const passMode = state.current.config.features?.voucherPasswordMode || 'same';
      const payload = (mode === 'url' && dns)
        ? dns + '?username=' + encodeURIComponent(code) + (passMode === 'empty' ? '' : '&password=' + encodeURIComponent(code))
        : code;
      if ($('#v-card-code')) $('#v-card-code').textContent = code;
      if ($('#v-card-payload')) $('#v-card-payload').textContent = payload;
      try {
        const res = await api('/qr?text=' + encodeURIComponent(payload));
        if ($('#v-qr-svg')) $('#v-qr-svg').innerHTML = res.svg;
      } catch {}
    };
    $('#v-test-code')?.addEventListener('input', updateLiveQr);
    $('#v-test-dns')?.addEventListener('input', updateLiveQr);
    $('#v-test-mode')?.addEventListener('change', updateLiveQr);
    updateLiveQr();
  }, 0);

  return wrap;
}

// ---------------------------------------------------------------------------
// Assets + Smart SVG Logo Maker + Auto-Crop & Compress (Package 4)
// ---------------------------------------------------------------------------
function formAssets() {
  const wrap = document.createElement('div');
  const c = state.current.config;

  // Card 1: Smart SVG Logo & Brand Identity Maker
  const makerCard = document.createElement('div');
  makerCard.className = 'card';
  makerCard.innerHTML =
    '<h3>✨ مولّد الشعارات والهوية البصرية الذكي (Built-in SVG Logo Maker)</h3>' +
    '<div class="planshint">يولّد تلقائياً <code>logo.svg</code> و <code>prand-title.svg</code> و <code>icon.png</code> من اسم الشبكة ولون الثيم والأيقونة المختارة ويحفظها في أصول البروفايل بضغطة واحدة.</div>';

  const makerGrid = document.createElement('div');
  makerGrid.className = 'grid';
  makerGrid.appendChild(field('الاسم النصي للشعار', '<input id="lm-name" data-ignore-dirty="1" value="' + esc(c.general.networkName) + '">'));
  makerGrid.appendChild(field('وصف فرعي (اختياري)', '<input id="lm-tagline" data-ignore-dirty="1" placeholder="مثال: HIGH SPEED WIFI">'));
  const logoIcons = (state.meta && state.meta.logoIcons) || ['wifi', 'shield', 'bolt', 'globe', 'coffee', 'crown', 'rocket', 'star'];
  makerGrid.appendChild(field('أيقونة الشعار',
    '<select id="lm-icon" data-ignore-dirty="1">' +
    logoIcons.map(ic => '<option value="' + esc(ic) + '">' + esc(ic) + '</option>').join('') +
    '</select>'));
  makerGrid.appendChild(field('لون الشعار', '<input id="lm-color" type="color" data-ignore-dirty="1" value="' + esc(c.theme.primaryColor || '#22c55e') + '">'));
  makerCard.appendChild(makerGrid);

  const genBtn = document.createElement('button');
  genBtn.className = 'btn primary addbtn';
  genBtn.textContent = '✨ توليد وحفظ الشعارات (logo.svg + prand-title.svg + icon.png)';
  genBtn.onclick = generateBrandIdentity;
  makerCard.appendChild(genBtn);

  const previewRow = document.createElement('div');
  previewRow.className = 'brand-preview-row';
  previewRow.id = 'lm-preview';
  previewRow.style.display = 'none';
  makerCard.appendChild(previewRow);
  wrap.appendChild(makerCard);

  // Card 2: Profile Assets + Auto-Crop & Compress
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = '<h3>ملفات الهوية وصور الوكلاء</h3>' +
    '<div class="planshint">ارفع لوجو الشبكة (logo.svg)، الشعار النصي (prand-title.svg)، الأيقونة (icon.png) وصور وكلاء الدعم. نفس أسماء الملفات الأساسية تُستبدل عند البناء.</div>';

  const list = document.createElement('div');
  list.id = 'assets-list';
  renderAssetsList(list);

  const up = document.createElement('div');
  up.className = 'field';
  up.innerHTML =
    '<label>رفع ملف</label>' +
    '<div class="file-picker-row">' +
    '<input type="file" id="asset-file" data-ignore-dirty="1" accept=".svg,.png,.jpg,.jpeg,.webp" style="display:none">' +
    '<label for="asset-file" class="btn ghost" style="margin:0;cursor:pointer;display:inline-flex;align-items:center;gap:6px">📁 اختيار صورة أو شعار</label>' +
    '<span id="asset-file-name" class="file-picker-name">لم يتم اختيار ملف بعد</span>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap">' +
    '<label style="display:inline-flex;align-items:center;gap:6px;margin:0;cursor:pointer">' +
    '<input type="checkbox" id="asset-autocrop" data-ignore-dirty="1" checked style="width:auto"> ' +
    'قص مربع وضغط تلقائي للصور النقطية عبر &lt;canvas&gt; (لحماية ذاكرة الفلاش بالراوتر)' +
    '</label>' +
    '<select id="asset-cropsize" data-ignore-dirty="1" style="width:auto;padding:4px 8px;font-size:12px">' +
    '<option value="128">128×128 px (موصى به للوكلاء)</option>' +
    '<option value="256">256×256 px</option>' +
    '</select>' +
    '</div>' +
    '<button class="btn ghost" style="margin-top:8px" onclick="uploadAsset(event)">رفع</button>';
  card.appendChild(list);
  card.appendChild(up);
  wrap.appendChild(card);
  setTimeout(() => {
    const fileInput = $('#asset-file');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const f = fileInput.files && fileInput.files[0];
        if ($('#asset-file-name')) $('#asset-file-name').textContent = f ? f.name : 'لم يتم اختيار ملف بعد';
      });
    }
  }, 0);
  return wrap;
}

async function generateBrandIdentity() {
  if (!state.current) return;
  try {
    const drafted = JSON.parse(JSON.stringify(state.current.config));
    applyDrafts(drafted);
    const networkName = $('#lm-name')?.value || drafted.general.networkName;
    const tagline = $('#lm-tagline')?.value || '';
    const icon = $('#lm-icon')?.value || 'wifi';
    const primaryColor = $('#lm-color')?.value || drafted.theme.primaryColor;
    const backgroundColor = drafted.theme.backgroundColor || '#020617';
    const data = await api('/profiles/' + encodeURIComponent(state.current.id) + '/generate-brand', {
      method: 'POST',
      body: JSON.stringify({ networkName, tagline, icon, primaryColor, backgroundColor })
    });
    state.current.assets = data.assets;
    toast('تم توليد وحفظ logo.svg و prand-title.svg و icon.png');
    renderTab();
    await refreshAssetsInPlace();
    const prev = $('#lm-preview');
    if (prev) {
      prev.style.display = 'flex';
      prev.innerHTML = '<div>' + data.logoSvg + '</div><div style="color:#fff">' + data.titleSvg + '</div>';
    }
  } catch (e) { toast(e.message, true); }
}

// Auto-crop center square and compress raster image via <canvas>
function autoCropAndCompressImage(file, targetDim) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        URL.revokeObjectURL(url);
        const side = Math.min(img.width, img.height);
        const sx = Math.floor((img.width - side) / 2);
        const sy = Math.floor((img.height - side) / 2);
        const dim = Math.min(side, targetDim || 128);
        const canvas = document.createElement('canvas');
        canvas.width = dim;
        canvas.height = dim;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, side, side, 0, 0, dim, dim);
        const isPng = /\.png$/i.test(file.name);
        const mime = isPng ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mime, 0.82);
        const b64 = dataUrl.split(',')[1];
        resolve(b64);
      } catch (err) { reject(err); }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('تعذر قراءة الصورة'));
    };
    img.src = url;
  });
}

function renderAssetsList(targetList) {
  const list = targetList || $('#assets-list');
  if (!list || !state.current) return;
  list.innerHTML = '';
  for (const a of (state.current.assets || [])) {
    const row = document.createElement('div');
    row.className = 'card';
    row.style.marginBottom = '8px';
    row.style.padding = '12px';

    const meta = document.createElement('span');
    meta.appendChild(document.createTextNode(a.name + ' '));
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = Math.max(1, Math.round(a.size / 1024)) + ' KB';
    meta.appendChild(badge);

    const del = document.createElement('button');
    del.className = 'rowbtn';
    del.textContent = 'حذف';
    del.dataset.asset = a.name;
    del.addEventListener('click', () => deleteAsset(del.dataset.asset));

    row.appendChild(meta);
    row.appendChild(document.createTextNode(' '));
    row.appendChild(del);
    list.appendChild(row);
  }
}

async function refreshAssetsInPlace() {
  if (!state.current) return;
  const data = await api('/profiles/' + encodeURIComponent(state.current.id));
  state.current.assets = data.profile.assets || [];
  if (data.profile.updatedAt) state.current.updatedAt = data.profile.updatedAt;
  $('#profileMeta').textContent =
    state.current.assets.length + ' أصول · آخر تحديث ' + (state.current.updatedAt || '').slice(0, 10);
  renderAssetsList();
  renderProfileList();
  if (state.sim.open) scheduleSimulatorAutoRefresh();
}

async function uploadAsset() {
  const file = $('#asset-file').files[0];
  if (!file) return toast('اختر ملفاً أولاً', true);
  const autoCrop = $('#asset-autocrop')?.checked;
  const cropDim = parseInt($('#asset-cropsize')?.value || '128', 10);
  const isRaster = /\.(png|jpe?g|webp)$/i.test(file.name);

  let dataBase64 = '';
  const origKb = Math.max(1, Math.round(file.size / 1024));
  if (autoCrop && isRaster && file.name.toLowerCase() !== 'icon.png') {
    try {
      dataBase64 = await autoCropAndCompressImage(file, cropDim);
    } catch {
      // Fallback to raw bytes if canvas fails in headless environments
    }
  }
  if (!dataBase64) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    dataBase64 = btoa(binary);
  }
  const finalKb = Math.max(1, Math.round((dataBase64.length * 3) / 4 / 1024));
  try {
    await api('/profiles/' + encodeURIComponent(state.current.id) + '/assets', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, dataBase64 })
    });
    toast(autoCrop && isRaster ? `تم رفع وضغط الصورة (${origKb} KB ← ${finalKb} KB)` : 'تم رفع الملف');
    if ($('#asset-file')) $('#asset-file').value = '';
    if ($('#asset-file-name')) $('#asset-file-name').textContent = 'لم يتم اختيار ملف بعد';
    await refreshAssetsInPlace();
  } catch (e) { toast(e.message, true); }
}

async function deleteAsset(name) {
  try {
    await api('/profiles/' + encodeURIComponent(state.current.id) + '/assets/' + encodeURIComponent(name), { method: 'DELETE' });
    toast('تم حذف الملف: ' + name);
    await refreshAssetsInPlace();
  } catch (e) { toast(e.message, true); }
}

window.Studio = Object.assign(window.Studio || {}, {
  renderTabs,
  setTab,
  captureDraft,
  applyDrafts,
  renderTab,
  field,
  saveCurrentAsPreset,
  removePlan,
  uploadAsset
});
