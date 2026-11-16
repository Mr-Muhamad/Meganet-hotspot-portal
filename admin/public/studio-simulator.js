/* global state, $, toast, api, captureDraft, applyDrafts, boot */
'use strict';
const SIM_DEVICES = {
  mobile: { id: 'mobile', label: 'موبايل ضيق (340px)', width: 340, height: 640 },
  wide: { id: 'wide', label: 'موبايل عريض (412px)', width: 412, height: 732 },
  tablet: { id: 'tablet', label: 'تابلت (768px)', width: 768, height: 900 }
};

const SIM_PAGES = [
  { id: 'login', label: 'الدخول' },
  { id: 'status', label: 'الحالة' },
  { id: 'plans', label: 'الباقات' },
  { id: 'logout', label: 'الخروج' },
  { id: 'expired', label: 'الانتهاء' },
  { id: 'error', label: 'الخطأ' },
  { id: 'alogin', label: 'التحويل' },
  { id: 'index', label: 'الرئيسية' }
];

// ---------------------------------------------------------------------------
// Split-Screen Live Simulator & External Preview (Package 1)
// ---------------------------------------------------------------------------
function renderSimPagesBar() {
  const bar = $('#simPagesBar');
  if (!bar) return;
  bar.innerHTML = SIM_PAGES.map(p =>
    '<button type="button" class="sim-page-btn' + (state.sim.page === p.id ? ' active' : '') + '" aria-pressed="' + (state.sim.page === p.id ? 'true' : 'false') + '" onclick="setSimPage(\'' + p.id + '\')">' + p.label + '</button>'
  ).join('');
}

function setSimPage(pageId) {
  state.sim.page = pageId;
  renderSimPagesBar();
  updateSimulatorFrame();
}

async function toggleSimulator() {
  const panel = $('#simulatorPanel');
  const toggleBtn = $('#simToggleBtn');
  state.sim.open = !state.sim.open;
  panel.classList.toggle('open', state.sim.open);
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', state.sim.open ? 'true' : 'false');
  if (state.sim.open) {
    applySimZoom();
    await refreshSimulator(true);
  }
}

function getSimDevice() {
  return SIM_DEVICES[state.sim.device] || SIM_DEVICES.mobile;
}

function applySimZoom() {
  const dev = getSimDevice();
  const z = (state.sim.zoom || 100) / 100;
  const stage = $('#simStage');
  const wrap = $('#simStageWrap');
  const bezel = $('#simBezel');
  const label = $('#simZoomLabel');
  if (bezel) {
    bezel.style.width = dev.width + 'px';
    bezel.style.height = dev.height + 'px';
    bezel.classList.toggle('tablet', dev.id === 'tablet');
  }
  if (stage) {
    stage.style.width = dev.width + 'px';
    stage.style.height = dev.height + 'px';
    stage.style.transform = `scale(${z})`;
  }
  if (wrap) {
    wrap.style.width = Math.round(dev.width * z) + 'px';
    wrap.style.height = Math.round(dev.height * z) + 'px';
  }
  if (label) label.textContent = (state.sim.zoom || 100) + '%';
}

function setSimDevice(deviceId) {
  state.sim.device = SIM_DEVICES[deviceId] ? deviceId : 'mobile';
  const sel = $('#sim-device');
  if (sel && sel.value !== state.sim.device) sel.value = state.sim.device;
  applySimZoom();
}

function setSimTheme(theme) {
  const next = (theme === 'dark' || theme === 'light') ? theme : 'auto';
  state.sim.theme = next;
  const sel = $('#sim-theme');
  if (sel && sel.value !== next) sel.value = next;
  updateSimulatorFrame();
}

function setSimZoom(pct) {
  state.sim.zoom = Math.max(50, Math.min(150, Number(pct) || 100));
  applySimZoom();
}

function stepSimZoom(delta) {
  setSimZoom((state.sim.zoom || 100) + delta);
}

function toggleSimExpand() {
  const panel = $('#simulatorPanel');
  if (!panel) return;
  state.sim.expanded = !state.sim.expanded;
  panel.classList.toggle('expanded', state.sim.expanded);
  const btn = $('#simExpandBtn');
  if (btn) btn.title = state.sim.expanded ? 'إرجاع العرض القياسي' : 'توسيع نافذة المعاينة';
}

(function initSimResizer() {
  const handle = $('#simResizer');
  const panel = $('#simulatorPanel');
  if (!handle || !panel) return;
  let dragging = false;
  let startX = 0;
  let startW = 400;
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    startX = e.clientX;
    startW = panel.getBoundingClientRect().width;
    panel.classList.remove('expanded');
    state.sim.expanded = false;
    handle.classList.add('dragging');
    const frame = $('#simFrame');
    if (frame) frame.style.pointerEvents = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const nextW = Math.max(280, Math.min(860, Math.round(startW + (e.clientX - startX))));
    panel.style.width = nextW + 'px';
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    const frame = $('#simFrame');
    if (frame) frame.style.pointerEvents = '';
  });
})();

async function refreshSimulator(rebuild) {
  try {
    const body = {};
    if (rebuild && state.current) {
      const previewCfg = structuredClone(state.current.config);
      captureDraft(state.tab);
      applyDrafts(previewCfg);
      body.slug = state.current.id;
      body.config = previewCfg;
      body.announcements = state.drafts.announcements !== undefined ? state.drafts.announcements : state.current.announcements;
    }
    if (state.sim.port) body.port = state.sim.port;
    const data = await api('/preview', { method: 'POST', body: JSON.stringify(body) });
    state.sim.baseUrl = data.baseUrl || data.url.replace(/\/login\.html$/, '');
    state.sim.port = data.port;
    updateSimulatorFrame();
  } catch (e) { toast('تعذر تشغيل المحاكي: ' + e.message, true); }
}

function updateSimulatorFrame() {
  if (!state.sim.baseUrl) return;
  const lang = $('#sim-lang')?.value || state.sim.lang || 'ar';
  const scenario = $('#sim-scenario')?.value || state.sim.scenario || 'normal';
  const theme = $('#sim-theme')?.value || state.sim.theme || 'auto';
  state.sim.lang = lang;
  state.sim.scenario = scenario;
  state.sim.theme = theme;
  document.cookie = 'hotspot_lang=' + encodeURIComponent(lang) + '; path=/; max-age=31536000; SameSite=Lax';
  if (theme === 'dark' || theme === 'light') {
    document.cookie = 'hotspot_theme=' + encodeURIComponent(theme) + '; path=/; max-age=31536000; SameSite=Lax';
  } else {
    document.cookie = 'hotspot_theme=; path=/; max-age=0; SameSite=Lax';
  }
  const prefix = (lang === 'ar') ? '/ar/' : '/';
  const url = `${state.sim.baseUrl}${prefix}${state.sim.page}.html?scenario=${encodeURIComponent(scenario)}&_t=${Date.now()}`;
  const frame = $('#simFrame');
  if (frame) frame.src = url;
}

let previewUrl = null;
async function togglePreview() {
  try {
    if (previewUrl) {
      await api('/preview/stop', { method: 'POST' });
      previewUrl = null;
      $('#previewBtn').textContent = 'معاينة خارجية';
      return;
    }
    const body = state.current ? { slug: state.current.id } : {};
    const data = await api('/preview', { method: 'POST', body: JSON.stringify(body) });
    previewUrl = data.url;
    state.sim.baseUrl = data.baseUrl || data.url.replace(/\/login\.html$/, '');
    state.sim.port = data.port;
    $('#previewBtn').textContent = 'إيقاف المعاينة';
    window.open(previewUrl, '_blank');
  } catch (e) { toast(e.message, true); }
}

// ---------------------------------------------------------------------------
boot();

window.Studio = Object.assign(window.Studio || {}, {
  refreshSimulator,
  setSimPage,
  toggleSimulator,
  setSimDevice,
  setSimTheme,
  stepSimZoom,
  toggleSimExpand,
  togglePreview
});
