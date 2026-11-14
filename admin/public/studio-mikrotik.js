/* global state, $, esc, toast, markDirty, api, saveConfig, field */
'use strict';
// ---------------------------------------------------------------------------
// MikroTik (.rsc Generator & One-Click REST API Deploy) — Package 2
// ---------------------------------------------------------------------------
function formMikrotik(c) {
  const wrap = document.createElement('div');
  const slug = state.current.id;
  const mk = state.current.mikrotik || {};
  const extraHostsText = Array.isArray(mk.extraHosts) ? mk.extraHosts.join(', ') : (mk.extraHosts || '');
  const mkProtocol = mk.protocol === 'https' ? 'https' : 'http';
  const mkPort = mk.port || (mkProtocol === 'https' ? 443 : 80);

  // Card 1: .rsc Generator
  const rscCard = document.createElement('div');
  rscCard.className = 'card';
  rscCard.innerHTML =
    '<h3>مولّد سكربت إعداد المايكروتك التلقائي (hotspot-setup.rsc)</h3>' +
    '<div class="planshint">يولّد سكربت RouterOS v7 متكامل يشمل DHCP Option 114 (RFC 8910 CAPPORT لملف api.json)، وقواعد Walled Garden IP للنطاقات الخارجية مع <code>comment="meganet-studio"</code>، وإعداد بروفايل الهوتسبوت. يتم تضمين هذا الملف تلقائياً داخل كل ملف ZIP مبني.</div>';

  const rscGrid = document.createElement('div');
  rscGrid.className = 'grid';
  rscGrid.appendChild(field('اسم نطاق البوابة (DNS Name)', '<input id="mk-dns" data-ignore-dirty="1" dir="ltr" value="' + esc(mk.dnsName || 'login.meganet.local') + '">'));
  rscGrid.appendChild(field('مجلد ملفات الهوتسبوت (html-directory)', '<input id="mk-htmldir" data-ignore-dirty="1" dir="ltr" value="' + esc(mk.htmlDir || 'hotspot') + '">'));
  rscGrid.appendChild(field('اسم بروفايل الهوتسبوت بالراوتر', '<input id="mk-profname" data-ignore-dirty="1" dir="ltr" value="' + esc(mk.profileName || (slug + '-hs-profile')) + '">'));
  rscGrid.appendChild(field('سيرفر DHCP (لربط Option 114 اختيارياً)', '<input id="mk-dhcp-server" data-ignore-dirty="1" dir="ltr" placeholder="مثال: defconf" value="' + esc(mk.dhcpServer || '') + '">'));
  rscGrid.appendChild(field('وضع CAPPORT (DHCP Option 114)', '<select id="mk-capport-mode" data-ignore-dirty="1"><option value="https"' + ((mk.capportMode || 'https') === 'https' ? ' selected' : '') + '>HTTPS (موصى به مع شهادة www-ssl)</option><option value="http"' + (mk.capportMode === 'http' ? ' selected' : '') + '>HTTP (للشبكات الداخلية بدون SSL)</option><option value="off"' + (mk.capportMode === 'off' ? ' selected' : '') + '>معطل</option></select>'));
  rscGrid.appendChild(field('نطاقات إضافية لـ Walled Garden (بفواصل)', '<input id="mk-extra-wg" data-ignore-dirty="1" dir="ltr" placeholder="cdn.example.com, pay.example.com" value="' + esc(extraHostsText) + '">'));
  rscCard.appendChild(rscGrid);

  const dryRunSummary = document.createElement('div');
  dryRunSummary.id = 'mk-rsc-summary';
  dryRunSummary.className = 'planshint';
  dryRunSummary.style.marginTop = '12px';
  rscCard.appendChild(dryRunSummary);

  const rscOutField = field('محتوى السكربت (hotspot-setup.rsc)', '<textarea id="mk-rsc-output" class="codearea" readonly></textarea>');
  rscOutField.style.marginTop = '12px';
  rscCard.appendChild(rscOutField);

  const rscBtns = document.createElement('div');
  rscBtns.style.display = 'flex';
  rscBtns.style.gap = '8px';
  rscBtns.style.marginTop = '10px';
  rscBtns.innerHTML =
    '<button type="button" class="btn ghost" onclick="refreshRscPreview()">توليد / معاينة التغييرات</button>' +
    '<button type="button" class="btn ghost" onclick="copyRscScript()">نسخ السكربت</button>' +
    '<button type="button" class="btn primary" onclick="downloadRscScript()">تحميل hotspot-setup.rsc</button>';
  rscCard.appendChild(rscBtns);
  wrap.appendChild(rscCard);

  // Card 2: Direct Deploy to RouterOS v7 REST API
  const depCard = document.createElement('div');
  depCard.className = 'card';
  depCard.innerHTML =
    '<h3>رفع مباشر إلى MikroTik (One-Click Router Upload)</h3>' +
    '<div class="planshint">يرفع الملفات النصية عبر REST API والصور والملفات الثنائية بشكل خام وسليم عبر <code>/tool/fetch</code>، مع فحص مساحة الفلاش وأخذ نسخة احتياطية اختيارية. يتم حفظ إعدادات هذا الراوتر تلقائياً لكل بروفايل (بدون تخزين كلمة المرور).</div>';

  const depGrid = document.createElement('div');
  depGrid.className = 'grid';
  depGrid.appendChild(field('عنوان IP الراوتر أو النطاق', '<input id="mk-host" data-ignore-dirty="1" dir="ltr" placeholder="192.168.88.1" value="' + esc(mk.host || '192.168.88.1') + '">'));
  depGrid.appendChild(field('البروتوكول', '<select id="mk-proto" data-ignore-dirty="1"><option value="http"' + (mkProtocol === 'http' ? ' selected' : '') + '>HTTP (افتراضي 80)</option><option value="https"' + (mkProtocol === 'https' ? ' selected' : '') + '>HTTPS (443)</option></select>'));
  depGrid.appendChild(field('المنفذ (Port)', '<input id="mk-port" type="number" data-ignore-dirty="1" dir="ltr" value="' + esc(String(mkPort)) + '">'));
  depGrid.appendChild(field('اسم مستخدم الراوتر', '<input id="mk-user" data-ignore-dirty="1" dir="ltr" value="' + esc(mk.username || 'admin') + '">'));
  depGrid.appendChild(field('كلمة المرور', '<input id="mk-pass" type="password" data-ignore-dirty="1" dir="ltr" placeholder="لا يتم حفظ كلمة المرور على القرص">'));
  depGrid.appendChild(field('مجلد الهوتسبوت المستهدف بالراوتر', '<input id="mk-target-dir" data-ignore-dirty="1" dir="ltr" value="' + esc(mk.targetDir || 'hotspot') + '">'));
  depCard.appendChild(depGrid);

  const applyWrap = document.createElement('div');
  applyWrap.style.marginTop = '12px';
  applyWrap.style.display = 'flex';
  applyWrap.style.flexDirection = 'column';
  applyWrap.style.gap = '6px';
  applyWrap.innerHTML =
    '<label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">' +
    '<input type="checkbox" id="mk-create-backup" data-ignore-dirty="1" style="width:auto"' + (mk.createBackup ? ' checked' : '') + '> ' +
    'أخذ نسخة احتياطية على الراوتر (<code>meganet-pre-deploy</code>) قبل الرفع' +
    '</label>' +
    '<label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">' +
    '<input type="checkbox" id="mk-apply-rsc" data-ignore-dirty="1" style="width:auto"' + (mk.applyRsc ? ' checked' : '') + '> ' +
    'تنفيذ سكربت <code>hotspot-setup.rsc</code> تلقائياً على الراوتر بعد الرفع (<code>/import</code>)' +
    '</label>';
  depCard.appendChild(applyWrap);

  const tlsFpWrap = field(
    'بصمة شهادة TLS (SHA-256) - مطلوبة لـ HTTPS فقط',
    '<input id="mk-tls-fp" data-ignore-dirty="1" dir="ltr" placeholder="AA:BB:CC:... (/certificate print detail)" value="' + esc(mk.tlsFingerprint || state.lastRouterFingerprint || '') + '">'
  );
  tlsFpWrap.id = 'mk-tls-fp-wrap';
  tlsFpWrap.style.marginTop = '12px';
  tlsFpWrap.style.display = mkProtocol === 'https' ? '' : 'none';
  depCard.appendChild(tlsFpWrap);

  const tlsBadge = document.createElement('div');
  tlsBadge.id = 'mk-tls-badge';
  tlsBadge.className = 'planshint';
  tlsBadge.style.marginTop = '10px';
  tlsBadge.innerHTML = (mk.tlsFingerprint || state.lastRouterFingerprint)
    ? 'بصمة TLS المثبّتة: <code>' + esc(mk.tlsFingerprint || state.lastRouterFingerprint) + '</code>'
    : 'لا توجد بصمة TLS محفوظة بعد (مطلوبة فقط عند استخدام HTTPS).';
  depCard.appendChild(tlsBadge);

  const depBtns = document.createElement('div');
  depBtns.style.display = 'flex';
  depBtns.style.gap = '8px';
  depBtns.style.flexWrap = 'wrap';
  depBtns.style.marginTop = '12px';

  const saveMkBtn = document.createElement('button');
  saveMkBtn.type = 'button';
  saveMkBtn.className = 'btn ghost';
  saveMkBtn.id = 'mk-save-btn';
  saveMkBtn.textContent = 'حفظ إعدادات الراوتر';
  saveMkBtn.onclick = () => saveMikrotikSettings(false);
  depBtns.appendChild(saveMkBtn);

  const testBtn = document.createElement('button');
  testBtn.type = 'button';
  testBtn.className = 'btn ghost';
  testBtn.id = 'mk-test-btn';
  testBtn.textContent = 'فحص الاتصال ومساحة الراوتر';
  testBtn.onclick = testMikrotikConnection;
  depBtns.appendChild(testBtn);

  const depBtn = document.createElement('button');
  depBtn.type = 'button';
  depBtn.className = 'btn primary';
  depBtn.id = 'mk-deploy-btn';
  depBtn.textContent = 'بناء ورفع مباشر إلى الراوتر الآن';
  depBtn.onclick = deployToMikrotik;
  depBtns.appendChild(depBtn);
  depCard.appendChild(depBtns);

  const testInfo = document.createElement('div');
  testInfo.id = 'mk-test-info';
  testInfo.className = 'planshint';
  testInfo.style.marginTop = '10px';
  testInfo.style.display = 'none';
  depCard.appendChild(testInfo);

  const depStatus = document.createElement('div');
  depStatus.id = 'mk-deploy-status';
  depStatus.className = 'hint';
  depStatus.style.marginTop = '10px';
  depCard.appendChild(depStatus);

  wrap.appendChild(depCard);

  setTimeout(() => {
    refreshRscPreview();
    ['mk-dns', 'mk-htmldir', 'mk-profname', 'mk-dhcp-server', 'mk-capport-mode', 'mk-extra-wg'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const syncRsc = () => {
        state.mikrotikDirty = true;
        markDirty(true);
        syncMikrotikDraft();
      };
      el.addEventListener('input', syncRsc);
      el.addEventListener('change', () => {
        syncRsc();
        refreshRscPreview();
      });
    });
    ['mk-host', 'mk-proto', 'mk-port', 'mk-user', 'mk-target-dir', 'mk-tls-fp', 'mk-create-backup', 'mk-apply-rsc'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const onMkEdit = () => {
        if (id === 'mk-proto') {
          if ($('#mk-port')) {
            const curPort = Number($('#mk-port').value);
            if (el.value === 'https' && (!curPort || curPort === 80)) $('#mk-port').value = '443';
            if (el.value === 'http' && (!curPort || curPort === 443)) $('#mk-port').value = '80';
          }
          if ($('#mk-tls-fp-wrap')) {
            $('#mk-tls-fp-wrap').style.display = el.value === 'https' ? '' : 'none';
          }
        }
        if (id === 'mk-tls-fp') {
          state.lastRouterFingerprint = el.value.trim().toUpperCase();
          el.value = state.lastRouterFingerprint;
          updateTlsBadge(state.lastRouterFingerprint);
        }
        state.mikrotikDirty = true;
        markDirty(true);
        syncMikrotikDraft();
      };
      el.addEventListener('input', onMkEdit);
      el.addEventListener('change', onMkEdit);
    });
  }, 0);
  return wrap;
}

function collectMikrotikSettings() {
  const rscOpts = mikrotikRscParams();
  return {
    host: $('#mk-host')?.value?.trim() || '192.168.88.1',
    protocol: $('#mk-proto')?.value === 'https' ? 'https' : 'http',
    port: Number($('#mk-port')?.value) || ($('#mk-proto')?.value === 'https' ? 443 : 80),
    username: $('#mk-user')?.value?.trim() || 'admin',
    targetDir: $('#mk-target-dir')?.value?.trim() || 'hotspot',
    htmlDir: rscOpts.htmlDir,
    dnsName: rscOpts.dnsName,
    profileName: rscOpts.profileName,
    dhcpServer: rscOpts.dhcpServer,
    capportMode: rscOpts.capportMode,
    extraHosts: rscOpts.extraHosts,
    applyRsc: Boolean($('#mk-apply-rsc')?.checked),
    createBackup: Boolean($('#mk-create-backup')?.checked),
    tlsFingerprint: ($('#mk-tls-fp')?.value?.trim() || state.lastRouterFingerprint || '').toUpperCase()
  };
}

function syncMikrotikDraft() {
  if (!state.current) return;
  state.current.mikrotik = collectMikrotikSettings();
}

function updateTlsBadge(fp) {
  const badge = $('#mk-tls-badge');
  if (!badge) return;
  badge.innerHTML = fp
    ? 'بصمة TLS المثبّتة: <code>' + esc(fp) + '</code>'
    : 'لا توجد بصمة TLS محفوظة بعد (مطلوبة فقط عند استخدام HTTPS).';
}

async function saveMikrotikSettings(silent = false, overrideMikrotik = null) {
  if (!state.current) return null;
  const btn = $('#mk-save-btn');
  if (!silent && btn) { btn.disabled = true; btn.textContent = 'جاري الحفظ…'; }
  try {
    const mikrotik = overrideMikrotik || ($('#mk-host') ? collectMikrotikSettings() : (state.current.mikrotik || {}));
    const res = await api('/profiles/' + encodeURIComponent(state.current.id) + '/mikrotik', {
      method: 'PUT',
      body: JSON.stringify({ mikrotik })
    });
    state.current.mikrotik = res.mikrotik;
    state.mikrotikDirty = false;
    if (res.mikrotik && res.mikrotik.tlsFingerprint) {
      state.lastRouterFingerprint = res.mikrotik.tlsFingerprint;
      if ($('#mk-tls-fp')) $('#mk-tls-fp').value = state.lastRouterFingerprint;
      updateTlsBadge(state.lastRouterFingerprint);
    }
    if (!silent) {
      if (Object.keys(state.drafts || {}).length === 0) markDirty(false);
      toast('تم حفظ إعدادات الراوتر لهذا البروفايل');
    }
    return res.mikrotik;
  } catch (e) {
    if (!silent) toast('فشل حفظ إعدادات الراوتر: ' + e.message, true);
    return null;
  } finally {
    if (!silent && btn) { btn.disabled = false; btn.textContent = 'حفظ إعدادات الراوتر'; }
  }
}

function mikrotikRscParams() {
  return {
    dnsName: $('#mk-dns')?.value?.trim() || 'login.meganet.local',
    htmlDir: $('#mk-htmldir')?.value?.trim() || 'hotspot',
    profileName: $('#mk-profname')?.value?.trim() || ((state.current ? state.current.id : 'meganet') + '-hs-profile'),
    dhcpServer: $('#mk-dhcp-server')?.value?.trim() || '',
    capportMode: $('#mk-capport-mode')?.value || 'https',
    extraHosts: $('#mk-extra-wg')?.value?.trim() || ''
  };
}

async function refreshRscPreview() {
  if (!state.current) return;
  try {
    const q = new URLSearchParams(mikrotikRscParams());
    const data = await api('/profiles/' + encodeURIComponent(state.current.id) + '/rsc?' + q.toString());
    if ($('#mk-rsc-output')) $('#mk-rsc-output').value = data.rsc;
    if ($('#mk-rsc-summary') && data.plan) {
      const p = data.plan;
      const wgTxt = p.walledGardenHosts && p.walledGardenHosts.length ? p.walledGardenHosts.join('، ') : 'لا يوجد (كل المكونات محلية)';
      $('#mk-rsc-summary').innerHTML =
        `<strong>ملخص التغييرات (Dry-Run):</strong> البروفايل: <code>${esc(p.profileName)}</code> · المسار: <code>${esc(p.htmlDir)}</code> · الدخول: <code>${esc(p.loginBy)}</code> · Option 114: <code>${esc(p.capportMode)}</code> · Walled Garden: <code>${esc(wgTxt)}</code>`;
    }
  } catch (e) { toast(e.message, true); }
}

function copyRscScript() {
  const txt = $('#mk-rsc-output')?.value || '';
  if (!txt) return;
  if (navigator.clipboard) navigator.clipboard.writeText(txt);
  toast('تم نسخ سكربت المايكروتك إلى الحافظة');
}

function downloadRscScript() {
  if (!state.current) return;
  const q = new URLSearchParams({ ...mikrotikRscParams(), download: '1' });
  const a = document.createElement('a');
  a.href = '/api/profiles/' + encodeURIComponent(state.current.id) + '/rsc?' + q.toString();
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}


async function testMikrotikConnection() {
  const btn = $('#mk-test-btn');
  const box = $('#mk-test-info');
  if (btn) { btn.disabled = true; btn.textContent = 'جاري الفحص…'; }
  try {
    const proto = $('#mk-proto')?.value === 'https' ? 'https' : 'http';
    const payload = {
      slug: state.current ? state.current.id : '',
      host: $('#mk-host')?.value?.trim(),
      protocol: proto,
      port: Number($('#mk-port')?.value) || (proto === 'https' ? 443 : 80),
      username: $('#mk-user')?.value?.trim() || 'admin',
      password: $('#mk-pass')?.value || '',
      tlsFingerprint: ($('#mk-tls-fp')?.value?.trim() || state.lastRouterFingerprint || '').toUpperCase()
    };
    const info = await api('/mikrotik/test', { method: 'POST', body: JSON.stringify(payload) });
    if (info.tlsFingerprint) {
      state.lastRouterFingerprint = info.tlsFingerprint;
      if ($('#mk-tls-fp')) $('#mk-tls-fp').value = state.lastRouterFingerprint;
      updateTlsBadge(state.lastRouterFingerprint);
    }

    if (info.dhcpServers && info.dhcpServers.length && $('#mk-dhcp-server') && !$('#mk-dhcp-server').value) {
      $('#mk-dhcp-server').value = info.dhcpServers[0].name;
    }
    const slugDefaultProf = (state.current && state.current.id ? state.current.id : 'meganet') + '-hs-profile';
    const isEmptyOrDefault = (el, defaults) => !el.value.trim() || defaults.includes(el.value.trim());
    if (info.hotspotProfiles && info.hotspotProfiles.length && $('#mk-profname')) {
      if (isEmptyOrDefault($('#mk-profname'), [slugDefaultProf, 'hsprof1'])) {
        $('#mk-profname').value = info.hotspotProfiles[0].name;
      }
      if (info.hotspotProfiles[0].dnsName && $('#mk-dns') && isEmptyOrDefault($('#mk-dns'), ['login.meganet.local'])) {
        $('#mk-dns').value = info.hotspotProfiles[0].dnsName;
      }
      if (info.hotspotProfiles[0].htmlDirectory) {
        if ($('#mk-htmldir') && isEmptyOrDefault($('#mk-htmldir'), ['hotspot'])) {
          $('#mk-htmldir').value = info.hotspotProfiles[0].htmlDirectory;
        }
        if ($('#mk-target-dir') && isEmptyOrDefault($('#mk-target-dir'), ['hotspot'])) {
          $('#mk-target-dir').value = info.hotspotProfiles[0].htmlDirectory;
        }
      }
    } else if (info.hasFlashPrefix && $('#mk-target-dir') && $('#mk-target-dir').value === 'hotspot') {
      $('#mk-target-dir').value = 'flash/hotspot';
    }
    await refreshRscPreview();
    await saveMikrotikSettings(true);

    const freeMb = info.freeHddSpace ? (info.freeHddSpace / (1024 * 1024)).toFixed(2) + ' MB' : 'غير متاح';
    const sslNote = info.wwwSslEnabled
      ? (info.wwwSslCertificate ? `مفعل (${info.wwwSslCertificate})` : 'مفعل بدون شهادة!')
      : 'غير مفعل';
    if (box) {
      box.style.display = 'block';
      box.innerHTML =
        `✓ متصل بـ <strong>${esc(info.identity)}</strong> (${esc(info.boardName || 'RouterOS')} v${esc(info.version || '?')})<br>` +
        `الفلاش المتاح: <strong>${esc(freeMb)}</strong> · بادئة <code>flash/</code>: <strong>${info.hasFlashPrefix ? 'نعم' : 'لا'}</strong> · خدمة <code>www-ssl</code>: <strong>${esc(sslNote)}</strong>` +
        (info.tlsFingerprint ? `<br>بصمة TLS: <code>${esc(info.tlsFingerprint)}</code>` : '');
    }
    toast('تم فحص الراوتر بنجاح');
  } catch (e) {
    if (box) {
      box.style.display = 'block';
      box.textContent = '✗ تعذر الاتصال بالراوتر: ' + e.message;
    }
    toast('فشل فحص الراوتر: ' + e.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'فحص الاتصال ومساحة الراوتر'; }
  }
}

async function deployToMikrotik() {
  if (!state.current) return;
  const btn = $('#mk-deploy-btn');
  const statusEl = $('#mk-deploy-status');
  if (btn) { btn.disabled = true; btn.textContent = 'جاري البناء والرفع إلى الراوتر…'; }
  try {
    const saved = await saveConfig();
    if (!saved) return;
    const rscOpts = mikrotikRscParams();
    const proto = $('#mk-proto')?.value === 'https' ? 'https' : 'http';
    const payload = {
      host: $('#mk-host')?.value?.trim(),
      protocol: proto,
      port: Number($('#mk-port')?.value) || (proto === 'https' ? 443 : 80),
      username: $('#mk-user')?.value?.trim() || 'admin',
      password: $('#mk-pass')?.value || '',
      targetDir: $('#mk-target-dir')?.value?.trim() || 'hotspot',
      htmlDir: rscOpts.htmlDir,
      dnsName: rscOpts.dnsName,
      profileName: rscOpts.profileName,
      dhcpServer: rscOpts.dhcpServer,
      capportMode: rscOpts.capportMode,
      extraHosts: rscOpts.extraHosts,
      applyRsc: Boolean($('#mk-apply-rsc')?.checked),
      createBackup: Boolean($('#mk-create-backup')?.checked),
      tlsFingerprint: ($('#mk-tls-fp')?.value?.trim() || state.lastRouterFingerprint || '').toUpperCase()
    };
    const res = await api('/profiles/' + encodeURIComponent(state.current.id) + '/deploy', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.tlsFingerprint) {
      state.lastRouterFingerprint = res.tlsFingerprint;
      if ($('#mk-tls-fp')) $('#mk-tls-fp').value = state.lastRouterFingerprint;
      updateTlsBadge(state.lastRouterFingerprint);
    }
    if (res.mikrotik) state.current.mikrotik = res.mikrotik;
    else syncMikrotikDraft();
    const msg = `✓ تم رفع ${res.uploadedCount} ملف بنجاح إلى ${res.host}:${res.port}/${res.targetDir}` +
      (res.backupCreated ? ' · تم حفظ نسخة احتياطية' : '') +
      (res.rscApplied ? ' · تم تطبيق السكربت' : '');
    if (statusEl) { statusEl.textContent = msg; statusEl.className = 'status ok'; }
    toast(msg);
  } catch (e) {
    if (statusEl) { statusEl.textContent = '✗ فشل الرفع: ' + e.message; statusEl.className = 'status'; }
    toast('فشل الرفع إلى الراوتر: ' + e.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'بناء ورفع مباشر إلى الراوتر الآن'; }
  }
}

window.Studio = Object.assign(window.Studio || {}, {
  formMikrotik,
  collectMikrotikSettings,
  saveMikrotikSettings,
  copyRscScript,
  downloadRscScript
});
