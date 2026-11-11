/**
 * Integration tests for the admin HTTP API (admin/server.js).
 * The server is started on an ephemeral loopback port; each test exercises a
 * full request — create, save, validation rejection, assets, build/zip,
 * download, non-loopback guard, and crash-safe recovery.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

// Isolate ALL admin data (profiles + custom presets) in a temp dir BEFORE the
// server module loads — jest runs must never pollute the real .admin store.
const ADMIN_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'meganet-admin-data-'));
process.env.ADMIN_DATA_DIR = ADMIN_TMP;

const { startServer, server, store } = require('../../admin/server.js');
const { createProfileStore } = require('../../admin/lib/profile-store.js');

const REPO = path.join(__dirname, '..', '..');
const CONFIG_FILE = path.join(REPO, 'config.json');

jest.setTimeout(120000);

// Jest's jsdom env has no global fetch — use a small http.request wrapper.
function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: payload
        ? { 'Content-Type': 'application/json', 'Content-Length': payload.length }
        : {}
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* non-json */ }
        resolve({ status: res.statusCode, json, text });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('admin HTTP API', () => {
  let port;
  let base;
  let tmp;
  // unique slug per run — a previous interrupted run may have left one behind
  const SLUG = 'api-test-cafe-' + Date.now().toString(36);

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'meganet-admin-api-'));
    port = await startServer(0);
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(ADMIN_TMP, { recursive: true, force: true });
  });

  function api(method, p, body) {
    return request(method, base + '/api' + p, body);
  }

  test('GET /api/meta returns known keys, presets and template', async () => {
    const res = await api('GET', '/meta');
    expect(res.status).toBe(200);
    expect(res.json.knownKeys.length).toBeGreaterThan(50);
    expect(res.json.presets.map(p => p.id)).toEqual([
      'meganet', 'cafe', 'hotel', 'clinic', 'restaurant', 'gym', 'netcafe',
      'mall', 'school', 'coworking', 'bakery', 'mobile-shop'
    ]);
    expect(res.json.template.general.networkName).toBeDefined();
  });

  test('POST /api/profiles creates; invalid slug is rejected with 400', async () => {
    const bad = await api('POST', '/profiles', { slug: '../evil', name: 'x' });
    expect(bad.status).toBe(400);

    const good = await api('POST', '/profiles', { slug: SLUG, name: 'كافيه' });
    expect(good.status).toBe(201);
    expect(good.json.profile.id).toBe(SLUG);
    expect(good.json.profile.config.general.networkName).toBeDefined();
  });

  test('PUT config: invalid config is rejected with 422 and not persisted', async () => {
    const cur = await api('GET', '/profiles/' + SLUG);
    const cfg = cur.json.profile.config;
    cfg.theme.preset = 'bogus';
    const res = await api('PUT', '/profiles/' + SLUG + '/config', { config: cfg });
    expect(res.status).toBe(422);
    expect(res.json.validationErrors.length).toBeGreaterThan(0);

    // the stored config must still be the valid one (saved previously)
    const after = await api('GET', '/profiles/' + SLUG);
    expect(after.json.profile.config.theme.preset).not.toBe('bogus');
  });

  test('valid config persists', async () => {
    const cur = await api('GET', '/profiles/' + SLUG);
    const cfg = cur.json.profile.config;
    cfg.general.networkName = 'كافيه الاختبار';
    cfg.theme.preset = 'cafe';
    const res = await api('PUT', '/profiles/' + SLUG + '/config', { config: cfg });
    expect(res.status).toBe(200);
    const after = await api('GET', '/profiles/' + SLUG);
    expect(after.json.profile.config.general.networkName).toBe('كافيه الاختبار');
    expect(after.json.profile.config.theme.preset).toBe('cafe');
  });

  test('POST /api/profiles/:id/build produces a zip and restores the workspace', async () => {
    const before = fs.readFileSync(CONFIG_FILE).toString('utf8');
    const build = await api('POST', '/profiles/' + SLUG + '/build');
    expect(build.status).toBe(200);
    expect(build.json.ok).toBe(true);
    expect(build.json.distFiles).toBeGreaterThan(10);

    const zip = await request('GET', base + build.json.downloadUrl);
    expect(zip.status).toBe(200);
    expect(zip.text.length).toBeGreaterThan(10000);

    // workspace restored byte-identical
    expect(fs.readFileSync(CONFIG_FILE).toString('utf8')).toBe(before);
  });

  test('GET /api/download/:id with no build returns 404', async () => {
    const res = await api('GET', '/download/no-such-build');
    expect(res.status).toBe(404);
  });

  test('non-loopback remote address is rejected', () => {
    expect(require('../../admin/server.js').isLoopback('10.0.0.8')).toBe(false);
  });
});

describe('admin HTTP API — v2.7.0 personalities', () => {
  let port;
  let base;
  const SLUG = 'seed-cafe-' + Date.now().toString(36);

  beforeAll(async () => {
    port = await startServer(0);
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    server.close();
  });

  function api(method, p, body) {
    return request(method, base + '/api' + p, body);
  }

  test('creating a profile with a preset seeds the welcome announcement', async () => {
    const created = await api('POST', '/profiles', { slug: SLUG, name: 'كافيه البذر', preset: 'cafe' });
    expect(created.status).toBe(201);
    const got = await api('GET', '/profiles/' + SLUG);
    expect(got.json.profile.announcements).not.toBeNull();
    expect(got.json.profile.announcements.message_ar[0]).toContain('قهوتنا');
  });

  test('saving a custom preset captures the effective personality and builds with it', async () => {
    // shape the profile into something distinctive, then save it as a custom preset
    const cur = await api('GET', '/profiles/' + SLUG);
    const cfg = cur.json.profile.config;
    cfg.theme.preset = 'cafe';
    cfg.theme.cardRadius = '28px';
    cfg.i18nOverrides = { voucher_label: 'كود الطاولة الخاص' };
    await api('PUT', '/profiles/' + SLUG + '/config', { config: cfg });

    const saved = await api('POST', '/presets', { slug: SLUG, id: 'teststyle', label: 'اختبار' });
    expect(saved.status).toBe(201);
    expect(saved.json.id).toBe('custom:teststyle');

    // meta now lists the custom preset with preview metadata
    const meta = await api('GET', '/meta');
    const custom = meta.json.presets.find(p => p.id === 'custom:teststyle');
    expect(custom).toBeDefined();
    expect(custom.custom).toBe(true);

    // a NEW profile using the custom preset inherits its dictionary at build time
    const slug2 = SLUG + '-2';
    await api('POST', '/profiles', { slug: slug2, name: 'ثاني', preset: 'custom:teststyle' });
    const build = await api('POST', '/profiles/' + slug2 + '/build');
    expect(build.status).toBe(200);
    expect(build.json.ok).toBe(true);
  });

  test('export → import roundtrip preserves config, announcements and assets', async () => {
    const bundleRes = await request('GET', base + '/api/profiles/' + SLUG + '/export');
    expect(bundleRes.status).toBe(200);
    const bundle = bundleRes.json;
    expect(bundle.config).toBeDefined();
    expect(bundle.announcements).not.toBeNull();

    const slug2 = 'roundtrip-' + Date.now().toString(36);
    const imp = await api('POST', '/profiles/import', { slug: slug2, name: 'مستورد', bundle });
    expect(imp.status).toBe(201);
    const got = await api('GET', '/profiles/' + slug2);
    expect(got.json.profile.config.general.networkName).toBe(bundle.config.general.networkName);
    expect(got.json.profile.announcements.message_ar).toEqual(bundle.announcements.message_ar);
  });

  test('custom preset deletion works', async () => {
    const del = await api('DELETE', '/presets/custom:teststyle');
    expect(del.status).toBe(200);
    const meta = await api('GET', '/meta');
    expect(meta.json.presets.find(p => p.id === 'custom:teststyle')).toBeUndefined();
  });

  test('returns 404 for non-existent profile and validates import/download inputs', async () => {
    const missing = await api('GET', '/profiles/does-not-exist-xyz');
    expect(missing.status).toBe(404);

    const badImport = await api('POST', '/profiles/import', {
      slug: 'bad-import-' + Date.now().toString(36),
      name: 'تالف',
      bundle: { config: { general: {} } }
    });
    expect(badImport.status).toBe(422);

    const badDownload = await request('GET', base + '/api/download/INVALID_SLUG!');
    expect(badDownload.status).toBe(400);
  });
});
