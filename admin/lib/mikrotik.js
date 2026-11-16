/**
 * mikrotik.js — RouterOS v7 .rsc configuration script generator, inspector,
 * & lossless REST API deployer.
 *
 * Follows RouterOS v7 idioms:
 *   - Never uses interactive print row numbers; always uses [find ...] selectors
 *   - Uses comment="meganet-studio" for idempotent cleanup before adding entries
 *   - Configures DHCP Option 114 (RFC 8910 CAPPORT URI) with force=yes
 *   - Uses /ip/hotspot/walled-garden/ip (layer-3 host match) for HTTPS external hosts
 *   - Uses RouterOS v7 REST API (/rest/file for text) and authenticated ephemeral
 *     HTTP pull via /rest/tool/fetch for lossless binary assets (PNG/JPG/WebP/ICO)
 */

'use strict';

const crypto = require('crypto');
const http = require('http');
const https = require('https');
const os = require('os');

const COMMENT_TAG = 'meganet-studio';
const BINARY_EXT_RE = /\.(png|jpe?g|webp|ico|gif|woff2?|ttf|eot)$/i;
const LARGE_FETCH_THRESHOLD_BYTES = 60 * 1024;

function escapeRos(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/[\r\n]/g, ' ');
}

function sanitizeIdentifier(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._/-]/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/^\/+|\/+$/g, '');
  return cleaned || fallback;
}

function extractHostname(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  try {
    const u = new URL(urlStr.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname || u.hostname === '127.0.0.1' || u.hostname === 'localhost') return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeExtraHosts(extraHosts) {
  if (typeof extraHosts === 'string') {
    return extraHosts.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return Array.isArray(extraHosts) ? extraHosts : [];
}

function buildRscPlanData(config = {}, options = {}) {
  const general = config.general || {};
  const features = config.features || {};
  const networkName = general.networkName || 'Meganet Hotspot';

  const profileName = sanitizeIdentifier(options.profileName, 'meganet-hs-profile');
  const htmlDir = sanitizeIdentifier(options.htmlDir, 'hotspot');
  const dnsName = sanitizeIdentifier(options.dnsName, 'login.meganet.local');
  const dhcpServer = options.dhcpServer ? sanitizeIdentifier(options.dhcpServer, '') : '';
  const capportMode = ['https', 'http', 'off'].includes(options.capportMode) ? options.capportMode : 'https';
  const routerOsVersion = options.routerOsVersion === 'v6' ? 'v6' : 'v7';
  const sslCertificate = options.sslCertificate ? sanitizeIdentifier(options.sslCertificate, '') : '';

  const loginModes = ['http-chap', 'http-pap', 'cookie'];
  if (features.enableClonePrevention === false) {
    loginModes.push('mac-cookie');
  }
  if (capportMode === 'https' && sslCertificate) {
    loginModes.push('https');
  }
  const loginBy = loginModes.join(',');
  const requiresSslSetup = capportMode === 'https' && !sslCertificate;
  const protocolNote = capportMode === 'https'
    ? (sslCertificate
        ? 'HTTPS CAPPORT aligned with login-by=https and ssl-certificate.'
        : 'HTTPS CAPPORT requires /ip/service/www-ssl + certificate and login-by=https; otherwise use capportMode=http or off for local HTTP portals.')
    : (capportMode === 'http'
        ? 'HTTP CAPPORT aligned with plain HTTP hotspot login (http-chap/http-pap).'
        : 'CAPPORT Option 114 disabled; clients use standard captive probe detection.');

  const wgHosts = new Set();
  if (features.enableQRScanner !== false && features.qrScannerUrl) {
    const qrHost = extractHostname(features.qrScannerUrl);
    if (qrHost) wgHosts.add(qrHost);
  }
  for (const h of normalizeExtraHosts(options.extraHosts)) {
    const trimmed = String(h || '').trim().toLowerCase();
    if (/^(\*\.)?[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
      wgHosts.add(trimmed);
    }
  }

  return {
    networkName,
    profileName,
    htmlDir,
    dnsName,
    dhcpServer,
    capportMode,
    routerOsVersion,
    sslCertificate,
    requiresSslSetup,
    protocolNote,
    loginBy,
    walledGardenHosts: Array.from(wgHosts)
  };
}

/**
 * Generate an idempotent RouterOS v7 .rsc setup script for a hotspot profile.
 */
function generateRscScript(config = {}, options = {}) {
  const plan = buildRscPlanData(config, options);
  const {
    networkName,
    profileName,
    htmlDir,
    dnsName,
    dhcpServer,
    capportMode,
    routerOsVersion,
    sslCertificate,
    loginBy,
    walledGardenHosts
  } = plan;
  const isV6 = routerOsVersion === 'v6';
  const p = (v7Path) => (isV6 ? v7Path.replace(/\//g, ' ').replace(/^ /, '/') : v7Path);

  const sslProp = (capportMode === 'https' && sslCertificate)
    ? ` ssl-certificate="${escapeRos(sslCertificate)}"`
    : '';

  const lines = [
    '# ============================================================================',
    `# Meganet Hotspot Studio — RouterOS ${isV6 ? 'v6' : 'v7'} Setup Script (${escapeRos(networkName)})`,
    `# Generated automatically · Tag: comment="${COMMENT_TAG}"`,
    '# ============================================================================',
    '',
    '# 1. Hotspot Server Profile (idempotent create or update via [find])',
    `:local profIds [${p('/ip/hotspot/profile/find')} where name="${escapeRos(profileName)}"]`,
    ':if ([:len $profIds] > 0) do={',
    `  ${p('/ip/hotspot/profile/set')} $profIds html-directory-override="${escapeRos(htmlDir)}" dns-name="${escapeRos(dnsName)}" login-by=${loginBy}${sslProp}`,
    '} else={',
    `  ${p('/ip/hotspot/profile/add')} name="${escapeRos(profileName)}" html-directory-override="${escapeRos(htmlDir)}" dns-name="${escapeRos(dnsName)}" login-by=${loginBy}${sslProp}`,
    '}',
    ''
  ];

  if (isV6) {
    lines.push(
      '# 2. DHCP Option 114 (RFC 8910 CAPPORT) — Requires RouterOS v7.1+ (skipped in v6 mode)'
    );
  } else if (capportMode === 'off') {
    lines.push(
      '# 2. DHCP Option 114 (RFC 8910 CAPPORT) — Disabled by Studio configuration',
      `/ip/dhcp-server/option/sets/remove [find comment="${COMMENT_TAG}"]`,
      `/ip/dhcp-server/option/remove [find comment="${COMMENT_TAG}"]`
    );
  } else {
    const capportScheme = capportMode === 'http' ? 'http' : 'https';
    lines.push(
      `# 2. DHCP Option 114 — Captive Portal API (RFC 8910, scheme: ${capportScheme})`,
      capportScheme === 'https'
        ? '# Note: HTTPS CAPPORT + HTTPS login require www-ssl + a valid SSL certificate imported on RouterOS.'
        : '# Note: HTTP CAPPORT matches plain HTTP login-by (http-chap/http-pap) when no TLS certificate is installed.',
      capportScheme === 'https' && !sslCertificate
        ? `# Optional TLS alignment once cert is imported: /ip/service/set www-ssl disabled=no certificate=<cert_0> && /ip/hotspot/profile/set [find name="${escapeRos(profileName)}"] login-by=${loginBy},https ssl-certificate=<cert_0>`
        : (sslCertificate
            ? `/ip/service/set www-ssl disabled=no certificate="${escapeRos(sslCertificate)}"`
            : '# Or switch capportMode to "http" if serving portal solely over HTTP.'),
      '# force=yes is required so clients that omit code 114 in PRL still receive it.',
      '# Outer double quotes + inner single quotes ensure RouterOS sends a string URI.',
      `/ip/dhcp-server/option/sets/remove [find comment="${COMMENT_TAG}"]`,
      `/ip/dhcp-server/option/remove [find comment="${COMMENT_TAG}"]`,
      `/ip/dhcp-server/option/add name="meganet-capport-114" code=114 force=yes value="'${capportScheme}://${escapeRos(dnsName)}/api.json'" comment="${COMMENT_TAG}"`,
      `/ip/dhcp-server/option/sets/add name="meganet-capport-set" options="meganet-capport-114" comment="${COMMENT_TAG}"`
    );

    if (dhcpServer) {
      lines.push(
        `:if ([:len [/ip/dhcp-server/find where name="${escapeRos(dhcpServer)}"]] > 0) do={`,
        `  /ip/dhcp-server/set [find where name="${escapeRos(dhcpServer)}"] dhcp-option-set="meganet-capport-set"`,
        '}'
      );
    } else {
      lines.push(
        '# Optional: attach option set to your hotspot DHCP server:',
        '# /ip/dhcp-server/set [find where name="defconf"] dhcp-option-set="meganet-capport-set"'
      );
    }
  }

  lines.push(
    '',
    '# 3. Relocate api.json if created in default hotspot/ root (handles flash/ layout)',
    ':local srcPath "hotspot/api.json"',
    `:local dstPath "${escapeRos(htmlDir)}/api.json"`,
    `:if ([:len [${p('/file/find')} where name="flash"]] > 0) do={`,
    '  :set srcPath "flash/hotspot/api.json"',
    `  :set dstPath "flash/${escapeRos(String(htmlDir || 'hotspot').replace(/^flash\//i, ''))}/api.json"`,
    '}',
    `:if (($srcPath != $dstPath) && ([:len [${p('/file/find')} where name=$srcPath]] > 0)) do={`,
    `  ${p('/file/set')} [find where name=$srcPath] name=$dstPath`,
    '}',
    '',
    '# 4. Walled Garden IP Rules (Layer-3 HTTPS-compatible, idempotent via comment tag)',
    `${p('/ip/hotspot/walled-garden/ip/remove')} [find comment="${COMMENT_TAG}"]`
  );

  if (walledGardenHosts.length > 0) {
    for (const host of walledGardenHosts) {
      lines.push(
        `${p('/ip/hotspot/walled-garden/ip/add')} dst-host="${escapeRos(host)}" action=accept comment="${COMMENT_TAG}"`
      );
      if (!host.startsWith('*.')) {
        lines.push(
          `${p('/ip/hotspot/walled-garden/ip/add')} dst-host="*.${escapeRos(host)}" action=accept comment="${COMMENT_TAG}"`
        );
      }
    }
  } else {
    lines.push('# No external hosts configured (self-hosted QR scanner active)');
  }

  lines.push(
    '',
    `:log info "Meganet Hotspot Studio setup applied for ${escapeRos(networkName)} (${escapeRos(profileName)})"`,
    ''
  );

  return lines.join('\n');
}

function previewRscPlan(config = {}, options = {}) {
  const plan = buildRscPlanData(config, options);
  return {
    ...plan,
    rsc: generateRscScript(config, options)
  };
}

function validateConnection(connection = {}) {
  const host = String(connection.host || '').trim();
  if (!host || /[\s/?#]/.test(host)) {
    throw new Error('invalid router host/IP');
  }
  const protocol = connection.protocol === 'https' ? 'https' : 'http';
  const pinned = connection.tlsFingerprint ? String(connection.tlsFingerprint).trim() : '';
  if (protocol === 'https' && !pinned) {
    throw new Error('HTTPS to RouterOS requires tlsFingerprint (SHA-256). Refusing an unpinned connection.');
  }
  const port = Number(connection.port) || (protocol === 'https' ? 443 : 80);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('invalid router port');
  }
  const username = String(connection.username || 'admin').trim();
  if (!username) throw new Error('router username is required');
  const password = connection.password != null ? String(connection.password) : '';

  const rawDir = String(connection.targetDir == null ? 'hotspot' : connection.targetDir)
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
  if (rawDir.includes('..')) {
    throw new Error('invalid target directory');
  }
  const targetDir = rawDir || 'hotspot';

  return {
    host,
    port,
    protocol,
    username,
    password,
    targetDir,
    timeoutMs: Number(connection.timeoutMs) || 10000,
    tlsFingerprint: connection.tlsFingerprint ? String(connection.tlsFingerprint).trim().toUpperCase() : ''
  };
}

/**
 * Low-level HTTP/HTTPS JSON request helper for RouterOS v7 REST API.
 * Requires and enforces a pinned TLS SHA-256 certificate fingerprint on HTTPS.
 */
function rosRestRequest(conn, method, restPath, bodyObj) {
  return new Promise((resolve, reject) => {
    const isHttps = conn.protocol === 'https';
    const client = isHttps ? https : http;
    const payload = bodyObj !== undefined ? Buffer.from(JSON.stringify(bodyObj), 'utf8') : null;
    // RouterOS empty-password auth still requires the trailing colon ("admin:")
    const authToken = Buffer.from(`${conn.username}:${conn.password || ''}`, 'utf8').toString('base64');

    let observedFingerprint = '';

    const req = client.request({
      hostname: conn.host,
      port: conn.port,
      path: '/rest' + (restPath.startsWith('/') ? restPath : '/' + restPath),
      method,
      timeout: conn.timeoutMs || 10000,
      rejectUnauthorized: false, // RouterOS certs are commonly self-signed; HTTPS requires a pinned fingerprint below
      headers: Object.assign(
        {
          Authorization: `Basic ${authToken}`,
          Accept: 'application/json'
        },
        payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}
      )
    }, (res) => {
      if (isHttps) {
        const expectedFp = conn.tlsFingerprint ? String(conn.tlsFingerprint).trim().toUpperCase() : '';
        if (!expectedFp) {
          res.resume();
          return reject(new Error('HTTPS to RouterOS requires tlsFingerprint (SHA-256). Refusing an unpinned connection.'));
        }
        try {
          const cert = res.socket && typeof res.socket.getPeerCertificate === 'function'
            ? res.socket.getPeerCertificate(true)
            : null;
          if (cert && cert.fingerprint256) {
            observedFingerprint = String(cert.fingerprint256).trim().toUpperCase();
          }
        } catch { /* compared below */ }
        if (!observedFingerprint || observedFingerprint !== expectedFp) {
          res.resume();
          return reject(new Error(`TLS certificate mismatch (expected ${expectedFp}, got ${observedFingerprint || 'none'})`));
        }
      }

      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const detail = (json && (json.detail || json.message)) || text || `HTTP ${res.statusCode}`;
          const err = new Error(`RouterOS REST error (${res.statusCode}): ${detail}`);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        resolve({ status: res.statusCode, data: json, text, tlsFingerprint: observedFingerprint || undefined });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('RouterOS connection timed out'));
    });
    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function rosOptionalGet(conn, restPath) {
  try {
    return await rosRestRequest(conn, 'GET', restPath);
  } catch (err) {
    if (err && (err.statusCode === 404 || err.statusCode === 400 || err.statusCode === 403)) {
      return null;
    }
    throw err;
  }
}

/**
 * Inspect connected RouterOS v7 device capabilities, storage, profiles, DHCP servers, and SSL status.
 */
async function inspectRouter(connection = {}) {
  const conn = validateConnection(connection);
  const resRes = await rosOptionalGet(conn, '/system/resource');
  const idRes = await rosOptionalGet(conn, '/system/identity');
  const hsRes = await rosOptionalGet(conn, '/ip/hotspot/profile?.proplist=name,html-directory,html-directory-override,dns-name');
  const dhcpRes = await rosOptionalGet(conn, '/ip/dhcp-server?.proplist=name,interface,dhcp-option-set');
  const svcRes = await rosOptionalGet(conn, '/ip/service?.proplist=name,disabled,certificate,port');
  const fileRes = await rosOptionalGet(conn, '/file?.proplist=name&name=flash');

  const resData = (resRes && resRes.data) || {};
  const idData = (idRes && idRes.data) || {};
  const services = Array.isArray(svcRes && svcRes.data) ? svcRes.data : [];
  const wwwSsl = services.find((s) => s && s.name === 'www-ssl') || null;
  const flashEntry = Array.isArray(fileRes && fileRes.data) ? fileRes.data.find((f) => f && f.name === 'flash') : null;

  const tlsFingerprint =
    (resRes && resRes.tlsFingerprint) ||
    (idRes && idRes.tlsFingerprint) ||
    (hsRes && hsRes.tlsFingerprint) ||
    '';

  return {
    ok: true,
    host: conn.host,
    port: conn.port,
    protocol: conn.protocol,
    identity: idData.name || conn.host,
    version: resData.version || '',
    boardName: resData['board-name'] || '',
    architecture: resData['architecture-name'] || '',
    freeHddSpace: Number(resData['free-hdd-space']) || 0,
    totalHddSpace: Number(resData['total-hdd-space']) || 0,
    hasFlashPrefix: Boolean(flashEntry),
    hotspotProfiles: Array.isArray(hsRes && hsRes.data)
      ? hsRes.data.map((p) => ({
          name: p.name,
          htmlDirectory: p['html-directory-override'] || p['html-directory'] || 'hotspot',
          dnsName: p['dns-name'] || ''
        }))
      : [],
    dhcpServers: Array.isArray(dhcpRes && dhcpRes.data)
      ? dhcpRes.data.map((d) => ({
          name: d.name,
          interface: d.interface || '',
          optionSet: d['dhcp-option-set'] || ''
        }))
      : [],
    wwwSslEnabled: Boolean(wwwSsl && wwwSsl.disabled !== 'true' && wwwSsl.disabled !== true),
    wwwSslCertificate: (wwwSsl && wwwSsl.certificate && wwwSsl.certificate !== 'none') ? wwwSsl.certificate : '',
    tlsFingerprint: tlsFingerprint || undefined
  };
}

function ipv4ToInt(ip) {
  const parts = String(ip || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function pickLocalIpForRouter(routerHost) {
  if (/^(127\.|localhost$|::1$)/i.test(routerHost)) {
    return '127.0.0.1';
  }
  const routerInt = ipv4ToInt(routerHost);
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const entries of Object.values(ifaces)) {
    for (const addr of entries || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        candidates.push(addr);
      }
    }
  }
  if (routerInt !== null) {
    for (const c of candidates) {
      const ipInt = ipv4ToInt(c.address);
      const maskInt = ipv4ToInt(c.netmask);
      if (ipInt !== null && maskInt !== null && ((ipInt & maskInt) === (routerInt & maskInt))) {
        return c.address;
      }
    }
  }
  return (candidates[0] && candidates[0].address) || '127.0.0.1';
}

function startBinaryPullServer(fileMap, listenHost) {
  if (!listenHost || listenHost === '0.0.0.0' || listenHost === '::') {
    throw new Error('pull server requires a specific local interface address');
  }
  const token = crypto.randomBytes(24).toString('hex');
  const fetchedSet = new Set();

  const srv = http.createServer((req, res) => {
    let reqUrl;
    let rel;
    try {
      reqUrl = new URL(req.url, 'http://127.0.0.1');
      const prefix = `/${token}/`;
      if (req.method !== 'GET' || !reqUrl.pathname.startsWith(prefix)) {
        res.writeHead(404);
        return res.end();
      }
      rel = decodeURIComponent(reqUrl.pathname.slice(prefix.length));
    } catch {
      res.writeHead(400);
      return res.end();
    }
    const buf = fileMap.get(rel);
    if (!buf) {
      res.writeHead(404);
      return res.end();
    }
    fetchedSet.add(rel);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': buf.length,
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });

  return new Promise((resolve, reject) => {
    srv.on('error', reject);
    srv.listen(0, listenHost, () => {
      const addr = srv.address();
      resolve({
        port: addr.port,
        token,
        fetchedSet,
        close: () => new Promise((done) => srv.close(() => done()))
      });
    });
  });
}

/**
 * Deploy built portal files to a MikroTik RouterOS v7 router via REST API.
 * Text files are uploaded via /rest/file (PUT/PATCH), while binary assets and
 * oversized scripts are pulled losslessly by RouterOS via /rest/tool/fetch.
 */
async function deployToRouter(files, connection = {}) {
  const conn = validateConnection(connection);
  const { host, port, targetDir } = conn;

  // Optional flash storage preflight check (skips silently on minimal mocks returning 404)
  let totalUploadBytes = connection.rscContent ? Buffer.byteLength(connection.rscContent, 'utf8') : 0;
  for (const f of files || []) {
    if (f && f.buffer) totalUploadBytes += f.buffer.length;
  }

  const resCheck = await rosOptionalGet(conn, '/system/resource');
  if (resCheck && resCheck.data && resCheck.data['free-hdd-space'] != null) {
    const freeSpace = Number(resCheck.data['free-hdd-space']);
    if (Number.isFinite(freeSpace) && freeSpace > 0 && freeSpace < Math.ceil(totalUploadBytes * 1.15)) {
      const freeKb = Math.round(freeSpace / 1024);
      const needKb = Math.round(totalUploadBytes / 1024);
      throw new Error(`Insufficient router flash storage: free ${freeKb} KB, needed ~${needKb} KB`);
    }
  }

  // Optional pre-deploy router backup
  let backupCreated = false;
  if (connection.createBackup) {
    await rosRestRequest(conn, 'POST', '/system/backup/save', { name: 'meganet-pre-deploy' });
    backupCreated = true;
  }

  // 1. Fetch existing file list from RouterOS (/rest/file)
  const listRes = await rosRestRequest(conn, 'GET', '/file?.proplist=.id,name');
  const tlsFingerprint = listRes.tlsFingerprint || (resCheck && resCheck.tlsFingerprint) || undefined;
  const existingMap = new Map();
  if (Array.isArray(listRes.data)) {
    for (const item of listRes.data) {
      if (item && item.name && item['.id']) {
        existingMap.set(item.name, item['.id']);
      }
    }
  }

  // Partition files into REST text uploads vs lossless HTTP /tool/fetch transfers
  const textFiles = [];
  const fetchFiles = [];
  const fetchBufferMap = new Map();

  for (const f of files || []) {
    const cleanRel = String(f.relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleanRel || cleanRel.includes('..')) continue;
    const isBinary = BINARY_EXT_RE.test(cleanRel);
    const isOversizedText = f.buffer && f.buffer.length > LARGE_FETCH_THRESHOLD_BYTES;
    if (isBinary || isOversizedText) {
      fetchFiles.push({ cleanRel, buffer: f.buffer });
      fetchBufferMap.set(cleanRel, f.buffer);
    } else {
      textFiles.push({ cleanRel, buffer: f.buffer });
    }
  }

  const uploaded = [];

  // 2. Upload text files via REST /file (PATCH if exists, PUT to create)
  for (const f of textFiles) {
    const remoteName = `${targetDir}/${f.cleanRel}`;
    const contents = f.buffer.toString('utf8');
    const existingId = existingMap.get(remoteName);
    if (existingId) {
      await rosRestRequest(conn, 'PATCH', `/file/${encodeURIComponent(existingId)}`, { contents });
    } else {
      await rosRestRequest(conn, 'PUT', '/file', { name: remoteName, contents });
    }
    uploaded.push(remoteName);
  }

  // 3. Transfer binary / oversized files losslessly via authenticated Studio HTTP + /tool/fetch
  if (fetchFiles.length > 0) {
    const isLoopback = /^(127\.|localhost$|::1$)/i.test(host);
    const studioHost = connection.studioHost || pickLocalIpForRouter(host);
    if (!isLoopback && (!studioHost || /^(0\.0\.0\.0|::)$/.test(studioHost))) {
      throw new Error('Cannot determine a local interface the router can reach. Set studioHost to that interface address, or deploy via ZIP.');
    }
    const pullServer = await startBinaryPullServer(fetchBufferMap, isLoopback ? '127.0.0.1' : studioHost);
    try {
      for (const f of fetchFiles) {
        const remoteName = `${targetDir}/${f.cleanRel}`;
        const encodedRel = f.cleanRel.split('/').map(encodeURIComponent).join('/');
        const pullUrl = `http://${studioHost}:${pullServer.port}/${pullServer.token}/${encodedRel}`;
        try {
          await rosRestRequest(conn, 'POST', '/tool/fetch', {
            url: pullUrl,
            'dst-path': remoteName,
            mode: 'http'
          });
        } catch (err) {
          throw new Error(`Binary/large file transfer failed for ${remoteName} via /tool/fetch (${err.message}). Ensure the router can reach ${studioHost}:${pullServer.port} or deploy via ZIP.`);
        }
        if (!pullServer.fetchedSet.has(f.cleanRel)) {
          throw new Error(`Router did not download ${remoteName} from Studio HTTP server (${studioHost}:${pullServer.port}). Check firewall rules or deploy via ZIP.`);
        }
        uploaded.push(remoteName);
      }
    } finally {
      await pullServer.close();
    }
  }

  // 4. Optionally upload & import hotspot-setup.rsc
  let rscApplied = false;
  if (connection.rscContent) {
    const rscName = `${targetDir}/hotspot-setup.rsc`;
    const existingRscId = existingMap.get(rscName);
    if (existingRscId) {
      await rosRestRequest(conn, 'PATCH', `/file/${encodeURIComponent(existingRscId)}`, { contents: connection.rscContent });
    } else {
      await rosRestRequest(conn, 'PUT', '/file', { name: rscName, contents: connection.rscContent });
    }
    uploaded.push(rscName);

    if (connection.applyRsc) {
      await rosRestRequest(conn, 'POST', '/import', { 'file-name': rscName });
      rscApplied = true;
    }
  }

  return {
    ok: true,
    host,
    port,
    targetDir,
    uploadedCount: uploaded.length,
    rscApplied,
    backupCreated,
    tlsFingerprint,
    files: uploaded
  };
}

module.exports = {
  COMMENT_TAG,
  generateRscScript,
  previewRscPlan,
  inspectRouter,
  deployToRouter,
  extractHostname
};
