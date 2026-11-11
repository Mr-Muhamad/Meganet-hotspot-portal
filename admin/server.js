#!/usr/bin/env node
/**
 * server.js — LOCAL admin portal generator (v2.6.0).
 *
 * Binds to 127.0.0.1 only; every request is rejected unless it comes from
 * loopback. Run with:  npm run admin  → http://127.0.0.1:8899
 *
 * Endpoints:
 *   GET    /api/profiles                     list profiles
 *   GET    /api/profiles/:id                 profile (config/announcements/assets)
 *   POST   /api/profiles                     create { slug, name }
 *   POST   /api/profiles/:id/duplicate       { newSlug, newName }
 *   PATCH  /api/profiles/:id                 { name }
 *   DELETE /api/profiles/:id                 remove profile
 *   PUT    /api/profiles/:id/config           { config } — validated, never persisted on error
 *   PUT    /api/profiles/:id/announcements   { announcements }
 *   POST   /api/profiles/:id/assets           { filename, dataBase64 }
 *   DELETE /api/profiles/:id/assets/:file
 *   POST   /api/profiles/:id/build           build -> zip (serialized)
 *   GET    /api/download/:id                 download the last built zip
 *   POST   /api/preview                      start preview server { port? }
 *   POST   /api/preview/stop
 *   GET    /api/meta                         known i18n keys, presets, icons
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
// Test isolation: tests set ADMIN_DATA_DIR to a temp dir BEFORE requiring
// this module, so jest runs never pollute the real .admin/profiles data.
const ADMIN_DIR = process.env.ADMIN_DATA_DIR
  ? path.resolve(process.env.ADMIN_DATA_DIR)
  : path.join(REPO_ROOT, '.admin');

const { createProfileStore } = require('./lib/profile-store.js');
const { createWorkspace } = require('./lib/workspace.js');
const { validate } = require(path.join(REPO_ROOT, 'scripts', 'validate-config.js'));
const { PRESETS, resolveEffectiveConfig, CUSTOM_PRESET_RE } = require(path.join(REPO_ROOT, 'scripts', 'presets.js'));
const { deriveThemeTokens } = require(path.join(REPO_ROOT, 'scripts', 'color-utils.js'));

const store = createProfileStore(ADMIN_DIR);
const workspace = createWorkspace({ repoRoot: REPO_ROOT });
const CUSTOM_PRESETS_FILE = path.join(ADMIN_DIR, 'custom-presets.json');

function loadCustomPresets() {
  try {
    return JSON.parse(fs.readFileSync(CUSTOM_PRESETS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCustomPresets(map) {
  fs.mkdirSync(ADMIN_DIR, { recursive: true });
  fs.writeFileSync(CUSTOM_PRESETS_FILE, JSON.stringify(map, null, 2) + '\n', 'utf8');
}

function allPresets() {
  return Object.assign({}, PRESETS, loadCustomPresets());
}

// Crash-safe recovery: if a previous build was killed mid-apply (power loss,
// kill -9), restore the factory workspace from the backup before serving.
try {
  if (workspace.recoverIfInterrupted()) {
    console.log('♻ Recovery: restored the factory workspace from an interrupted build backup');
  }
} catch (err) {
  console.error('⚠ Recovery warning:', err.message);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function isLoopback(addr) {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

function readBody(req, limitMb = 10) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limitMb * 1024 * 1024) {
        // destroy() makes any later write throw — reject FIRST, then reset
        const err = httpError(413, 'payload too large');
        req.removeAllListeners('data');
        req.destroy();
        reject(err);
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(httpError(400, 'request aborted')));
  });
}

function readJsonBody(req) {
  return readBody(req).then((buf) => {
    if (!buf.length) return {};
    try {
      return JSON.parse(buf.toString('utf8'));
    } catch (err) {
      throw httpError(400, 'invalid JSON body: ' + err.message);
    }
  });
}

// ---------------------------------------------------------------------------
// Template config for new profiles (shipped example minus comments/hints)
// ---------------------------------------------------------------------------

function buildTemplateConfig() {
  const example = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'config.example.json'), 'utf8'));
  const strip = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_') || k.endsWith('_hints')) continue;
      out[k] = v && typeof v === 'object' && !Array.isArray(v) ? strip(v) : v;
    }
    return out;
  };
  const clean = strip(example);
  // The EXAMPLE's own i18n overrides and explicit theme values must not
  // become the template's — new profiles start neutral so the chosen PRESET's
  // wording AND theme defaults flow in (operator keys still win when added).
  delete clean.i18nOverrides;
  if (clean.theme) {
    delete clean.theme.preset;
    delete clean.theme.cardRadius;
    delete clean.theme.enableNetworkBackground;
    delete clean.theme.defaultTheme;
  }
  return clean;
}

const TEMPLATE_CONFIG = buildTemplateConfig();

// ---------------------------------------------------------------------------
// Preview server child management
// ---------------------------------------------------------------------------

let previewChild = null;

function startPreview(port) {
  stopPreview();
  // spawn with an explicit argv array (no shell) — nothing here is ever
  // concatenated into a command string. The port is validated as a bounded
  // integer by the caller before it reaches this point.
  const child = spawn(process.execPath, [path.join(REPO_ROOT, 'scripts', 'preview.mjs'), '--port', String(port)], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
    detached: false
  });
  previewChild = child;
  child.on('exit', () => { if (previewChild === child) previewChild = null; });
  return port;
}

function stopPreview() {
  if (previewChild) {
    previewChild.kill('SIGTERM');
    previewChild = null;
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleApi(req, res, url, method) {
  const parts = url.pathname.split('/').filter(Boolean); // e.g. ['api','profiles','slug','config']

  // GET /api/profiles
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'profiles' && parts.length === 2) {
    return sendJson(res, 200, { profiles: store.list() });
  }

  // GET /api/meta
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'meta') {
    let knownKeys = [];
    try {
      const en = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src', 'i18n', 'en.json'), 'utf8'));
      knownKeys = Object.keys(en.en || {});
    } catch { /* empty */ }
    const presets = Object.entries(allPresets()).map(([id, p]) => ({
      id,
      label: p.label,
      theme: p.theme,
      preview: p.preview || null,
      custom: id.startsWith('custom:')
    }));
    return sendJson(res, 200, {
      knownKeys,
      presets,
      planIcons: ['globe', 'briefcase', 'graduation-cap', 'ghost', 'star', 'shield', 'crown', 'package'],
      template: TEMPLATE_CONFIG
    });
  }

  // POST /api/presets — save the CURRENT profile's effective personality as a
  // custom preset { slug (source profile), id }
  if (method === 'POST' && parts[0] === 'api' && parts[1] === 'presets' && parts.length === 2) {
    const body = await readJsonBody(req);
    const customId = 'custom:' + String(body.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);
    if (!CUSTOM_PRESET_RE.test(customId)) {
      return sendJson(res, 400, { error: 'invalid preset id' });
    }
    const source = store.get(body.slug);
    const effective = resolveEffectiveConfig(source.config, loadCustomPresets());
    const map = loadCustomPresets();
    map[customId] = {
      label: body.label || customId,
      theme: {
        defaultTheme: effective.theme.defaultTheme || 'dark',
        cardRadius: effective.theme.cardRadius || '16px',
        enableNetworkBackground: effective.theme.enableNetworkBackground !== false
      },
      i18nOverrides: effective.i18nOverrides || {},
      announcement: source.announcements || null,
      preview: {
        colors: [effective.theme.primaryColor || '#22c55e', effective.theme.backgroundColor || '#020617'],
        radius: effective.theme.cardRadius || '16px'
      }
    };
    saveCustomPresets(map);
    return sendJson(res, 201, { id: customId, presets: Object.keys(map) });
  }

  // DELETE /api/presets/:id — remove a custom preset
  if (method === 'DELETE' && parts[0] === 'api' && parts[1] === 'presets' && parts.length === 3) {
    const id = decodeURIComponent(parts[2]);
    const map = loadCustomPresets();
    if (!map[id]) return sendJson(res, 404, { error: 'custom preset not found' });
    delete map[id];
    saveCustomPresets(map);
    return sendJson(res, 200, { ok: true });
  }

  // GET /api/profiles/:id/export — full bundle (config + announcements + assets b64)
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'profiles' && parts[3] === 'export' && parts.length === 4) {
    const profile = store.get(parts[2]);
    const assets = profile.assets.map(a => ({
      name: a.name,
      dataBase64: fs.readFileSync(path.join(store.profilesDir, profile.id, 'assets', a.name)).toString('base64')
    }));
    const bundle = { name: profile.name, config: profile.config, announcements: profile.announcements, assets };
    const payload = JSON.stringify(bundle, null, 2);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${profile.id}-profile.json"`,
      'Content-Length': Buffer.byteLength(payload)
    });
    return res.end(payload);
  }

  // POST /api/profiles/import — restore a bundle { slug, bundle }
  if (method === 'POST' && parts[0] === 'api' && parts[1] === 'profiles' && parts[2] === 'import' && parts.length === 3) {
    const body = await readJsonBody(req, 20);
    const bundle = body.bundle || {};
    if (!bundle.config) return sendJson(res, 400, { error: 'bundle has no config' });
    const profile = store.create(body.slug, body.name || bundle.name, bundle.config);
    if (bundle.announcements) store.saveAnnouncements(profile.id, bundle.announcements);
    for (const asset of bundle.assets || []) {
      store.writeAsset(profile.id, asset.name, Buffer.from(asset.dataBase64 || '', 'base64'));
    }
    return sendJson(res, 201, { profile: store.get(profile.id) });
  }

  // GET /api/download/:id
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'download' && parts.length === 3) {
    const id = parts[2];
    const zip = path.join(ADMIN_DIR, 'tmp', `${id}-dist.zip`);
    if (!fs.existsSync(zip)) return sendJson(res, 404, { error: 'build not found — run build first' });
    const data = fs.readFileSync(zip);
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${id}-portal-dist.zip"`,
      'Content-Length': data.length
    });
    return res.end(data);
  }

  // POST /api/preview
  if (method === 'POST' && parts[0] === 'api' && parts[1] === 'preview' && parts.length === 2) {
    const body = await readJsonBody(req);
    // strict port validation: positive integer in the private/ephemeral range
    const requested = Number(body.port);
    const port = Number.isInteger(requested) && requested >= 1024 && requested <= 65535
      ? requested
      : 8000 + Math.floor(Math.random() * 2000);
    startPreview(port);
    return sendJson(res, 200, { url: `http://127.0.0.1:${port}/login.html` });
  }

  // POST /api/preview/stop
  if (method === 'POST' && parts[0] === 'api' && parts[1] === 'preview' && parts[2] === 'stop') {
    stopPreview();
    return sendJson(res, 200, { ok: true });
  }

  if (parts[0] !== 'api' || parts[1] !== 'profiles' || parts.length < 2) {
    return sendJson(res, 404, { error: 'not found' });
  }

  const id = parts[2];
  const action = parts[3]; // config | announcements | assets | duplicate | build | undefined

  try {
    // POST /api/profiles  (create)
    if (method === 'POST' && parts.length === 2) {
      const body = await readJsonBody(req);
      const profile = store.create(body.slug, body.name, TEMPLATE_CONFIG);
      // The chosen preset is written INTO the config so build-time resolution
      // flows its theme defaults + base dictionary (and the welcome
      // announcement is seeded — the operator can edit it afterwards).
      const presetId = body.preset && allPresets()[body.preset] ? body.preset : null;
      if (presetId) {
        profile.config.theme.preset = presetId;
        store.saveConfig(body.slug, profile.config, validate);
      }
      const preset = presetId ? allPresets()[presetId] : null;
      if (preset && preset.announcement && !store.get(body.slug).announcements) {
        store.saveAnnouncements(body.slug, preset.announcement);
      }
      return sendJson(res, 201, { profile: store.get(body.slug) });
    }

    // GET /api/profiles/:id
    if (method === 'GET' && parts.length === 3) {
      return sendJson(res, 200, { profile: store.get(id) });
    }

    // DELETE /api/profiles/:id
    if (method === 'DELETE' && parts.length === 3) {
      store.remove(id);
      return sendJson(res, 200, { ok: true });
    }

    // PATCH /api/profiles/:id  (rename)
    if (method === 'PATCH' && parts.length === 3) {
      const body = await readJsonBody(req);
      store.rename(id, body.name);
      return sendJson(res, 200, { profile: store.get(id) });
    }

    // POST /api/profiles/:id/duplicate
    if (method === 'POST' && action === 'duplicate') {
      const body = await readJsonBody(req);
      const profile = store.duplicate(id, body.newSlug, body.newName);
      return sendJson(res, 201, { profile });
    }

    // PUT /api/profiles/:id/config
    if (method === 'PUT' && action === 'config') {
      const body = await readJsonBody(req);
      const profile = store.saveConfig(id, body.config, validate);
      return sendJson(res, 200, { profile });
    }

    // PUT /api/profiles/:id/announcements
    if (method === 'PUT' && action === 'announcements') {
      const body = await readJsonBody(req);
      store.saveAnnouncements(id, body.announcements);
      return sendJson(res, 200, { ok: true });
    }

    // POST /api/profiles/:id/assets
    if (method === 'POST' && action === 'assets') {
      const body = await readJsonBody(req);
      const buffer = Buffer.from(body.dataBase64 || '', 'base64');
      const name = store.writeAsset(id, body.filename, buffer);
      return sendJson(res, 200, { name });
    }

    // DELETE /api/profiles/:id/assets/:file
    if (method === 'DELETE' && action === 'assets' && parts.length === 5) {
      store.deleteAsset(id, parts[4]);
      return sendJson(res, 200, { ok: true });
    }

    // POST /api/profiles/:id/build
    if (method === 'POST' && action === 'build') {
      const profile = store.get(id);
      // Custom presets live outside the repo, so resolve them HERE before the
      // build (built-in presets are resolved inside build.js itself; explicit
      // config values already present simply win).
      const effective = resolveEffectiveConfig(profile.config, loadCustomPresets());
      const zipPath = path.join(ADMIN_DIR, 'tmp', `${id}-dist.zip`);
      const result = await workspace.runBuildCycle(
        { ...profile, config: effective, dir: path.join(store.profilesDir, id) },
        zipPath
      );
      return sendJson(res, 200, { ok: true, distFiles: result.distFiles, downloadUrl: `/api/download/${id}` });
    }

    return sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    if (err.validationErrors) return sendJson(res, 422, { error: err.message, validationErrors: err.validationErrors });
    // store.get/rename/remove/... throw "profile not found" → 404 (not 400)
    if (err.message === 'profile not found') return sendJson(res, 404, { error: err.message });
    return sendJson(res, err.statusCode || 400, { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Static files + server
// ---------------------------------------------------------------------------

function serveStatic(res, url) {
  let rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return sendJson(res, 404, { error: 'not found' });
  }
  const data = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': data.length });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!isLoopback(req.socket.remoteAddress)) {
      return sendJson(res, 403, { error: 'local only' });
    }

    // CSRF guard for mutating requests: any browser page on the operator's
    // machine (malicious website) can POST to 127.0.0.1 — require the Origin
    // (if present) to be the loopback admin origin. `no-cors` fetches still
    // send Origin, so this closes the cross-site local-API tampering.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.headers.origin;
      if (origin) {
        try {
          const o = new URL(origin);
          const host = o.hostname;
          const isLocalOrigin = host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1';
          if (!isLocalOrigin) {
            return sendJson(res, 403, { error: 'cross-origin request rejected' });
          }
        } catch {
          return sendJson(res, 403, { error: 'cross-origin request rejected' });
        }
      }
    }

    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url, req.method);
    } else {
      serveStatic(res, url);
    }
  } catch (err) {
    const status = err.statusCode || 500;
    try { sendJson(res, status, { error: err.message }); } catch { res.end(); }
  }
});

function startServer(port = 0) {
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server.address().port));
  });
}

if (require.main === module) {
  const PORT = Number(process.env.ADMIN_PORT) || 8899;
  startServer(PORT).then(() => {
    console.log('┌──────────────────────────────────────────────────────────┐');
    console.log('│  Meganet Portal Generator (admin) — local only          │');
    console.log('└──────────────────────────────────────────────────────────┘');
    console.log(`  http://127.0.0.1:${PORT}`);
    console.log('  (bound to loopback — not reachable from the network)');
  });
}

module.exports = { server, store, workspace, startPreview, stopPreview, TEMPLATE_CONFIG, isLoopback, startServer };
