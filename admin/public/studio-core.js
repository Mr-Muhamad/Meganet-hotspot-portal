/* global renderTabs, renderTab, captureDraft, applyDrafts, collectMikrotikSettings, saveMikrotikSettings, refreshSimulator, renderSimPagesBar */
'use strict';
// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  profiles: [],
  current: null,
  meta: null,
  tab: 'general',
  buildBusy: false,
  dirty: false,
  lastRouterFingerprint: '',
  drafts: {},
  sim: {
    open: false,
    baseUrl: null,
    page: 'login',
    scenario: 'normal',
    lang: 'ar',
    theme: 'auto',
    device: 'mobile',
    zoom: 100,
    expanded: false
  }
};


const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function toast(msg, isError) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

function markDirty(isDirty) {
  state.dirty = Boolean(isDirty);
  const badge = $('#dirtyBadge');
  if (badge) badge.className = 'badge dirty' + (state.dirty ? ' show' : '');
}


function openStudioModal({ title, bodyHtml, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء', isDanger = false, focusSelector = 'input, select' }) {
  return new Promise((resolve) => {
    const modal = $('#studioModal');
    const titleEl = $('#studioModalTitle');
    const bodyEl = $('#studioModalBody');
    const okBtn = $('#studioModalConfirm');
    const cancelBtn = $('#studioModalCancel');
    if (!modal || !titleEl || !bodyEl || !okBtn || !cancelBtn) { resolve(null); return; }

    titleEl.textContent = title || '';
    bodyEl.innerHTML = bodyHtml || '';
    okBtn.textContent = confirmLabel;
    okBtn.className = isDanger ? 'btn danger' : 'btn primary';
    cancelBtn.textContent = cancelLabel;
    modal.classList.add('open');

    const prevFocus = document.activeElement;
    const cleanup = (result) => {
      modal.classList.remove('open');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      modal.onclick = null;
      window.removeEventListener('keydown', onKey);
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(null); }
      if (e.key === 'Enter' && e.target && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        okBtn.click();
      }
    };
    window.addEventListener('keydown', onKey);
    modal.onclick = (e) => { if (e.target === modal) cleanup(null); };
    cancelBtn.onclick = () => cleanup(null);
    okBtn.onclick = () => cleanup(bodyEl);

    setTimeout(() => {
      const target = bodyEl.querySelector(focusSelector) || okBtn;
      if (target && typeof target.focus === 'function') target.focus();
    }, 10);
  });
}

async function studioConfirm(message, { title = 'تأكيد الإجراء', confirmLabel = 'متابعة', isDanger = false } = {}) {
  const res = await openStudioModal({
    title,
    bodyHtml: '<p style="margin:0;line-height:1.6">' + esc(message) + '</p>',
    confirmLabel,
    isDanger,
    focusSelector: '#studioModalConfirm'
  });
  return Boolean(res);
}

async function studioPrompt(label, defaultVal = '', { title = 'إدخال بيانات', confirmLabel = 'حفظ' } = {}) {
  const res = await openStudioModal({
    title,
    bodyHtml: '<div class="field"><label for="studio-prompt-input">' + esc(label) + '</label><input id="studio-prompt-input" type="text" value="' + esc(defaultVal) + '"></div>',
    confirmLabel,
    focusSelector: '#studio-prompt-input'
  });
  if (!res) return null;
  const val = res.querySelector('#studio-prompt-input')?.value ?? '';
  return val.trim() ? val : null;
}

function toggleSidebar(force) {
  const sidebar = $('#studioSidebar');
  const toggleBtn = $('#sidebarToggleBtn');
  if (!sidebar) return;
  const next = typeof force === 'boolean' ? force : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', next);
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
  if (next) {
    const closeBtn = $('#sidebarCloseBtn');
    if (closeBtn) closeBtn.focus();
  } else if (toggleBtn && document.activeElement && sidebar.contains(document.activeElement)) {
    toggleBtn.focus();
  }
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const sidebar = $('#studioSidebar');
    if (sidebar && sidebar.classList.contains('open')) {
      toggleSidebar(false);
    }
  }
});

// Track form edits in #content to light up Dirty State indicator (never auto-rebuild while typing)
function onContentEdited(e) {
  if (state.current && $('#content') && $('#content').contains(e.target)) {
    if (!e.target.dataset.ignoreDirty) {
      markDirty(true);
    }
  }
}
document.addEventListener('input', onContentEdited);
document.addEventListener('change', onContentEdited);

// Keyboard shortcut Ctrl+S / Cmd+S to save
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (state.current) saveConfig();
  }
});

window.addEventListener('beforeunload', (e) => {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

async function api(path, options) {
  const res = await fetch('/api' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error((data && data.error) || ('HTTP ' + res.status));
    // the server's 422 carries the per-field validation errors — carry them
    // on the thrown error so the UI can render the inline error box
    if (data && data.validationErrors) err.validationErrors = data.validationErrors;
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Load meta + profiles
// ---------------------------------------------------------------------------
async function boot() {
  try {
    renderSimPagesBar();
    state.meta = await api('/meta');
    await loadProfiles();
  } catch (e) { toast('فشل التحميل: ' + e.message, true); }
}

async function loadProfiles(selectId) {
  const data = await api('/profiles');
  state.profiles = data.profiles;
  renderProfileList(selectId);
}

function renderProfileList(selectId) {
  const list = $('#profileList');
  const query = ($('#profileSearch')?.value || '').trim().toLowerCase();
  list.innerHTML = '';
  const filtered = state.profiles.filter(p =>
    !query || p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query)
  );
  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = query
      ? 'لا توجد بروفايلات تطابق البحث. امسح عبارة البحث أو أنشئ بريفايل جديد.'
      : 'لا توجد بروفايلات بعد. اضغط على "+ بريفايل جديد" للبدء.';
    list.appendChild(empty);
  }
  for (const p of filtered) {
    const isActive = Boolean(state.current && state.current.id === p.id);
    const row = document.createElement('div');
    row.className = 'profile-item' + (isActive ? ' active' : '');

    const selBtn = document.createElement('button');
    selBtn.type = 'button';
    selBtn.className = 'profile-item__select';
    if (isActive) selBtn.setAttribute('aria-current', 'true');
    selBtn.innerHTML = '<span class="pname" title="' + esc(p.name) + ' (' + esc(p.id) + ')">' + esc(p.name) + '</span>';
    selBtn.onclick = () => {
      toggleSidebar(false);
      selectProfile(p.id);
    };

    const act = document.createElement('span');
    act.className = 'pact';
    act.innerHTML =
      '<button type="button" class="iconbtn" title="نسخ" aria-label="نسخ ' + esc(p.name) + '" onclick="duplicateProfile(\'' + p.id + '\')">⧉</button>' +
      '<button type="button" class="iconbtn" title="إعادة تسمية" aria-label="إعادة تسمية ' + esc(p.name) + '" onclick="renameProfile(\'' + p.id + '\')">✎</button>' +
      '<button type="button" class="iconbtn danger" title="حذف" aria-label="حذف ' + esc(p.name) + '" onclick="deleteProfile(\'' + p.id + '\')">🗑</button>';

    row.appendChild(selBtn);
    row.appendChild(act);
    list.appendChild(row);
  }
  const targetId = selectId || (!state.current && state.profiles.length > 0 ? state.profiles[0].id : null);
  if (targetId) selectProfile(targetId);
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

async function selectProfile(id, skipDirtyCheck) {
  if (!skipDirtyCheck && state.dirty && state.current && state.current.id !== id) {
    const ok = await studioConfirm('لديك تعديلات غير محفوظة في البروفايل الحالي. هل تريد المتابعة وتجاهلها؟', {
      title: 'تعديلات غير محفوظة',
      confirmLabel: 'تجاهل والمتابعة',
      isDanger: true
    });
    if (!ok) return;
  }
  try {
    state.drafts = {};
    state.mikrotikDirty = false;
    markDirty(false);
    const data = await api('/profiles/' + encodeURIComponent(id));
    state.current = data.profile;
    state.lastRouterFingerprint = (state.current && state.current.mikrotik && state.current.mikrotik.tlsFingerprint) || '';
    $('#profileTitle').textContent = state.current.name;
    $('#profileMeta').textContent =
      state.current.assets.length + ' أصول · آخر تحديث ' + (state.current.updatedAt || '').slice(0, 10);
    renderProfileList();
    renderTabs();
    renderTab();
    if (state.sim.open) refreshSimulator(true);
  } catch (e) { toast(e.message, true); }
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------
function collectConfig() {
  captureDraft(state.tab);
  const c = state.current.config;
  applyDrafts(c);
  return c;
}

async function saveConfig() {
  if (!state.current) { toast('اختر بريفايل أولاً', true); return false; }
  try {
    const pendingMikrotik = state.mikrotikDirty
      ? ($('#mk-host') ? collectMikrotikSettings() : (state.current.mikrotik || null))
      : null;
    const config = collectConfig();
    const data = await api('/profiles/' + encodeURIComponent(state.current.id) + '/config', {
      method: 'PUT',
      body: JSON.stringify({ config })
    });
    state.current = data.profile;

    if (state.drafts.announcements) {
      await api('/profiles/' + encodeURIComponent(state.current.id) + '/announcements', {
        method: 'PUT',
        body: JSON.stringify({ announcements: state.drafts.announcements })
      });
      state.current.announcements = state.drafts.announcements;
    }

    if (pendingMikrotik) {
      await saveMikrotikSettings(true, pendingMikrotik);
    }

    state.drafts = {};
    state.mikrotikDirty = false;
    markDirty(false);
    toast('تم الحفظ: الإعدادات سليمة');
    $('#profileMeta').textContent = state.current.assets.length + ' أصول · آخر تحديث ' + (state.current.updatedAt || '').slice(0, 10);
    if (state.sim.open) refreshSimulator(true);
    return true;
  } catch (e) {
    toast(e.message, true);
    if (e.validationErrors) {
      const box = document.createElement('div');
      box.className = 'errorbox';
      box.textContent = 'أخطاء التحقق:\n' + e.validationErrors.join('\n');
      $('#content').prepend(box);
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Bundle Size & Flash Memory Meter
// ---------------------------------------------------------------------------
function renderBundleMeter(buildResult, labelPrefix) {
  const meter = $('#bundleMeter');
  if (!meter || !buildResult || !buildResult.zipSize) return;
  meter.className = 'show';
  const zipKb = Math.max(1, Math.round(buildResult.zipSize / 1024));
  const rawKb = Math.max(1, Math.round((buildResult.totalRawSize || buildResult.zipSize) / 1024));
  const pct = Math.min(100, buildResult.flashUsagePercent || Math.round((rawKb / 1024) * 100));
  $('#bm-title').textContent = (labelPrefix || 'حجم الحزمة') + ':';
  $('#bm-zip').textContent = 'ZIP: ' + zipKb + ' KB';
  $('#bm-raw').textContent = 'الذاكرة: ' + rawKb + ' KB (' + pct + '% من 1MB)';
  const bar = $('#bm-bar');
  if (bar) {
    bar.style.width = pct + '%';
    bar.style.background = pct > 85 ? 'var(--danger)' : (pct > 60 ? 'var(--warn)' : 'var(--acc)');
  }
  const b = buildResult.breakdown || {};
  $('#bm-breakdown').textContent =
    `HTML: ${Math.round((b.html || 0) / 1024)}KB · أصول: ${Math.round((b.assets || 0) / 1024)}KB · سكربت: ${Math.round((b.scripts || 0) / 1024)}KB · .rsc: ${Math.max(1, Math.round((b.rsc || 0) / 1024))}KB`;
}

// ---------------------------------------------------------------------------
// Build & Batch Build All
// ---------------------------------------------------------------------------
async function buildAndDownload() {
  if (!state.current) return toast('اختر بريفايل أولاً', true);
  if (state.buildBusy) return;
  state.buildBusy = true;
  const btn = $('#buildZipBtn') || $('.btn.primary');
  btn.disabled = true; btn.textContent = 'جاري البناء…';
  try {
    const saved = await saveConfig();
    if (!saved) return;
    const data = await api('/profiles/' + encodeURIComponent(state.current.id) + '/build', { method: 'POST' });
    renderBundleMeter(data, 'حجم حزمة ' + state.current.name);
    const a = document.createElement('a');
    a.href = data.downloadUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('تم البناء والتحميل (' + data.distFiles + ' ملف · ' + Math.round((data.zipSize || 0) / 1024) + ' KB)');
  } catch (e) {
    toast('فشل البناء: ' + e.message, true);
  } finally {
    state.buildBusy = false;
    btn.disabled = false; btn.textContent = 'بناء وتحميل zip';
  }
}

async function batchBuildAll() {
  if (state.buildBusy) return;
  state.buildBusy = true;
  const btn = $('#batchBuildBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'جاري بناء الكل…'; }
  try {
    if (state.current && state.dirty) await saveConfig();
    const res = await api('/profiles/build-all', { method: 'POST', body: '{}' });
    if (res.built && res.built.length) {
      const last = res.built[res.built.length - 1];
      renderBundleMeter(last, `تم بناء ${res.count} بروفايلات (آخرها ${last.name})`);
    }
    toast(`تم بناء جميع البروفايلات بنجاح (${res.count} بروفايل)`);
  } catch (e) {
    toast('فشل البناء الجماعي: ' + e.message, true);
  } finally {
    state.buildBusy = false;
    if (btn) { btn.disabled = false; btn.textContent = 'بناء جميع البروفايلات'; }
  }
}


// ---------------------------------------------------------------------------
// Profile CRUD
// ---------------------------------------------------------------------------
async function createProfile() {
  const defaultSlug = 'client-' + Date.now().toString(36);
  const presets = (state.meta && state.meta.presets) ? state.meta.presets : [
    { id: 'meganet', label: 'MegaNet Dark Neon' },
    { id: 'cafe', label: 'Cafe' },
    { id: 'hotel', label: 'Hotel' },
    { id: 'clinic', label: 'Clinic' }
  ];
  const presetOpts = presets.map(p => '<option value="' + esc(p.id) + '">' + esc(p.id + ' - ' + p.label) + '</option>').join('');
  const res = await openStudioModal({
    title: 'إنشاء بريفايل جديد',
    confirmLabel: 'إنشاء',
    focusSelector: '#studio-new-name',
    bodyHtml:
      '<div class="field"><label for="studio-new-slug">معرّف البريفايل (إنجليزي بدون مسافات)</label><input id="studio-new-slug" type="text" value="' + esc(defaultSlug) + '"></div>' +
      '<div class="field"><label for="studio-new-name">الاسم الظاهر (مثال: كافيه التراس)</label><input id="studio-new-name" type="text" value="' + esc(defaultSlug) + '"></div>' +
      '<div class="field"><label for="studio-new-preset">شخصية القالب (Preset)</label><select id="studio-new-preset">' + presetOpts + '</select></div>'
  });
  if (!res) return;
  const slug = res.querySelector('#studio-new-slug')?.value.trim();
  const name = res.querySelector('#studio-new-name')?.value.trim() || slug;
  const preset = res.querySelector('#studio-new-preset')?.value.trim() || 'meganet';
  if (!slug) return;
  try {
    const data = await api('/profiles', { method: 'POST', body: JSON.stringify({ slug, name, preset }) });
    await loadProfiles(data.profile.id);
    toast('تم إنشاء البريفايل بنجاح');
  } catch (e) { toast(e.message, true); }
}

async function duplicateProfile(id) {
  const newSlug = await studioPrompt('معرّف النسخة الجديدة:', id + '-copy', { title: 'نسخ البريفايل', confirmLabel: 'نسخ' });
  if (!newSlug) return;
  try {
    const data = await api('/profiles/' + encodeURIComponent(id) + '/duplicate', {
      method: 'POST',
      body: JSON.stringify({ newSlug, newName: newSlug })
    });
    await loadProfiles(data.profile.id);
  } catch (e) { toast(e.message, true); }
}

async function renameProfile(id) {
  const curName = state.profiles.find(p => p.id === id)?.name || id;
  const name = await studioPrompt('الاسم الجديد:', curName, { title: 'إعادة تسمية البريفايل', confirmLabel: 'تحديث' });
  if (!name) return;
  try {
    await api('/profiles/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ name }) });
    await loadProfiles(id);
  } catch (e) { toast(e.message, true); }
}

async function deleteProfile(id) {
  const ok = await studioConfirm('حذف البريفايل نهائياً؟ لا يمكن التراجع عن هذه الخطوة.', {
    title: 'حذف البريفايل',
    confirmLabel: 'حذف نهائي',
    isDanger: true
  });
  if (!ok) return;
  try {
    await api('/profiles/' + encodeURIComponent(id), { method: 'DELETE' });
    state.current = null;
    state.drafts = {};
    state.mikrotikDirty = false;
    markDirty(false);
    $('#profileTitle').textContent = 'اختر بريفايل';
    $('#profileMeta').textContent = '';
    $('#tabs').innerHTML = '';
    if ($('#bundleMeter')) $('#bundleMeter').className = '';
    $('#content').innerHTML = '';
    await loadProfiles();
  } catch (e) { toast(e.message, true); }
}

// ---------------------------------------------------------------------------
// Export / Import (transfer a profile between machines, or back it up)
// ---------------------------------------------------------------------------
function exportProfile() {
  if (!state.current) return toast('اختر بريفايل أولاً', true);
  const a = document.createElement('a');
  a.href = '/api/profiles/' + encodeURIComponent(state.current.id) + '/export';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function importProfile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    try {
      const bundle = JSON.parse(await f.text());
      const asciiSlug = (bundle.name || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
      const defaultSlug = /^[a-z0-9]/.test(asciiSlug) ? asciiSlug : ('imported-' + Date.now().toString(36));
      const slug = await studioPrompt('معرّف البروفايل المستورد:', defaultSlug, { title: 'استيراد بروفايل', confirmLabel: 'استيراد' });
      if (!slug) return;
      const data = await api('/profiles/import', {
        method: 'POST',
        body: JSON.stringify({ slug, name: bundle.name, bundle })
      });
      await loadProfiles(data.profile.id);
      toast('تم الاستيراد');
    } catch (e) { toast(e.message, true); }
  };
  input.click();
}

window.Studio = Object.assign(window.Studio || {}, {
  $$,
  boot,
  saveConfig,
  buildAndDownload,
  batchBuildAll,
  createProfile,
  duplicateProfile,
  renameProfile,
  deleteProfile,
  exportProfile,
  importProfile
});

