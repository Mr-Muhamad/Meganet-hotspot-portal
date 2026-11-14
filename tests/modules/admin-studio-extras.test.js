/**
 * Tests for the 5 Studio Expansion Packages:
 *   1. Split-Screen Live Simulator & Live WCAG Contrast Badge
 *   2. MikroTik .rsc Generator & Direct RouterOS v7 REST API Deploy
 *   3. Voucher & RADIUS Error Translations Toolkit + QR / A4 Print Sheet
 *   4. Smart Asset & Built-in SVG/PNG Logo Studio
 *   5. Studio UX, Batch Build All & Bundle Size / Flash Memory Meter
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const zlib = require('zlib');

const ADMIN_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'meganet-studio-extras-'));
process.env.ADMIN_DATA_DIR = ADMIN_TMP;

const { generateRscScript, previewRscPlan, inspectRouter, deployToRouter, COMMENT_TAG } = require('../../admin/lib/mikrotik.js');
const { encodeQrMatrix, generateQrSvg } = require('../../admin/lib/qr-generator.js');
const { generateLogoSvg, generateBrandTitleSvg, generateIconPngBuffer, generateBrandAssets } = require('../../admin/lib/logo-maker.js');
const { sanitizeSvg } = require('../../scripts/svg-utils.js');
const { startServer, server } = require('../../admin/server.js');

jest.setTimeout(120000);

function httpGetBuffer(urlStr) {
  return new Promise((resolve, reject) => {
    http.get(urlStr, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        const text = raw.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* raw */ }
        resolve({ status: res.statusCode, headers: res.headers, json, text, raw });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('Package 2 — MikroTik .rsc Generator & Direct RouterOS v7 REST Deploy', () => {
  test('generateRscScript produces idempotent RouterOS v7 script with Option 114 and Walled Garden IP rules', () => {
    const config = {
      general: { networkName: 'Cafe Terrace' },
      features: {
        enableQRScanner: true,
        qrScannerUrl: 'https://scanner.example.com/qr/index.html',
        enableClonePrevention: false
      }
    };
    const rsc = generateRscScript(config, {
      profileName: 'cafe-hs',
      htmlDir: 'flash/cafe-portal',
      dnsName: 'wifi.cafe.local',
      dhcpServer: 'dhcp-hs',
      extraHosts: ['pay.vodafone.com.eg']
    });

    // Idempotent comment tag and [find] selectors (no raw row indices)
    expect(rsc).toContain(`comment="${COMMENT_TAG}"`);
    expect(rsc).toContain('/ip/hotspot/profile/find where name="cafe-hs"');
    expect(rsc).toContain('html-directory-override="flash/cafe-portal"');
    expect(rsc).toContain('dns-name="wifi.cafe.local"');
    expect(rsc).toContain('login-by=http-chap,http-pap,cookie,mac-cookie');

    // RFC 8910 DHCP Option 114 with force=yes and outer-double + inner-single quotes
    expect(rsc).toContain('code=114 force=yes value="\'https://wifi.cafe.local/api.json\'"');
    expect(rsc).toContain('dhcp-option-set="meganet-capport-set"');

    // Layer-3 Walled Garden IP entries for external QR scanner and extra hosts
    expect(rsc).toContain(`/ip/hotspot/walled-garden/ip/remove [find comment="${COMMENT_TAG}"]`);
    expect(rsc).toContain('dst-host="scanner.example.com" action=accept');
    expect(rsc).toContain('dst-host="*.scanner.example.com" action=accept');
    expect(rsc).toContain('dst-host="pay.vodafone.com.eg" action=accept');
  });

  test('generateRscScript omits external walled-garden entries when self-hosted QR scanner is used', () => {
    const rsc = generateRscScript({
      general: { networkName: 'LocalNet' },
      features: { enableQRScanner: true }
    });
    expect(rsc).toContain('# No external hosts configured');
    expect(rsc).not.toContain('/ip/hotspot/walled-garden/ip/add');
  });

  test('deployToRouter uploads new and existing files via RouterOS v7 REST API and imports .rsc', async () => {
    const received = { auth: null, puts: [], patches: [], imports: [] };
    const mockRouter = http.createServer((req, res) => {
      received.auth = req.headers.authorization;
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        if (req.method === 'GET' && req.url.startsWith('/rest/file')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([{ '.id': '*A1', name: 'hotspot/login.html' }]));
        }
        if (req.method === 'PATCH' && req.url.startsWith('/rest/file/')) {
          received.patches.push({ url: req.url, body });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ '.id': '*A1' }));
        }
        if (req.method === 'PUT' && req.url === '/rest/file') {
          received.puts.push(body);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ '.id': '*A2', name: body.name }));
        }
        if (req.method === 'POST' && req.url === '/rest/import') {
          received.imports.push(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([]));
        }
        res.writeHead(404);
        res.end();
      });
    });

    await new Promise((resolve) => mockRouter.listen(0, '127.0.0.1', resolve));
    const routerPort = mockRouter.address().port;

    try {
      const result = await deployToRouter(
        [
          { relPath: 'login.html', buffer: Buffer.from('<html>login</html>') },
          { relPath: 'ar/login.html', buffer: Buffer.from('<html>ar</html>') }
        ],
        {
          host: '127.0.0.1',
          port: routerPort,
          username: 'admin',
          password: '', // empty password must still encode "admin:"
          targetDir: 'hotspot',
          applyRsc: true,
          rscContent: '# routeros script'
        }
      );

      expect(result.ok).toBe(true);
      expect(result.uploadedCount).toBe(3); // 2 html + 1 rsc
      expect(result.rscApplied).toBe(true);
      expect(received.auth).toBe('Basic ' + Buffer.from('admin:').toString('base64'));
      expect(received.patches).toHaveLength(1);
      expect(received.patches[0].url).toBe('/rest/file/*A1');
      expect(received.puts.map((p) => p.name)).toEqual(['hotspot/ar/login.html', 'hotspot/hotspot-setup.rsc']);
      expect(received.imports).toEqual([{ 'file-name': 'hotspot/hotspot-setup.rsc' }]);
    } finally {
      mockRouter.close();
    }
  });

  test('deployToRouter and inspectRouter refuse HTTPS without a pinned certificate fingerprint', async () => {
    await expect(deployToRouter([], {
      host: '127.0.0.1',
      protocol: 'https',
      port: 443
    })).rejects.toThrow(/tlsFingerprint/);
    await expect(inspectRouter({
      host: '127.0.0.1',
      protocol: 'https',
      port: 443
    })).rejects.toThrow(/tlsFingerprint/);
  });

  test('Studio UI exposes #mk-tls-fp input for HTTPS connections', () => {
    const mkJs = fs.readFileSync(path.join(__dirname, '..', '..', 'admin', 'public', 'studio-mikrotik.js'), 'utf8');
    expect(mkJs).toContain('id="mk-tls-fp"');
    expect(mkJs).toContain("tlsFpWrap.id = 'mk-tls-fp-wrap'");
  });

  test('deployToRouter rejects invalid host or path traversal in targetDir', async () => {
    await expect(deployToRouter([], { host: '' })).rejects.toThrow(/invalid router host/);
    await expect(deployToRouter([], { host: '127.0.0.1', targetDir: '../etc' })).rejects.toThrow(/invalid target directory/);
  });

  test('deployToRouter transfers binary PNG assets losslessly via /tool/fetch, checks flash space, and runs backup', async () => {
    const pngBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0xff, 0xfe, 0x80, 0x99, 0x00, 0x7f]);
    const pulled = {};
    let backupSaved = null;

    const mockRouter = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        if (req.method === 'GET' && req.url === '/rest/system/resource') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ version: '7.16', 'board-name': 'hEX', 'free-hdd-space': 4 * 1024 * 1024 }));
        }
        if (req.method === 'POST' && req.url === '/rest/system/backup/save') {
          backupSaved = body.name;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({}));
        }
        if (req.method === 'GET' && req.url.startsWith('/rest/file')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([]));
        }
        if (req.method === 'POST' && req.url === '/rest/tool/fetch') {
          pulled[body['dst-path']] = await httpGetBuffer(body.url);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([{ status: 'finished' }]));
        }
        res.writeHead(404);
        res.end();
      });
    });

    await new Promise((resolve) => mockRouter.listen(0, '127.0.0.1', resolve));
    const routerPort = mockRouter.address().port;

    try {
      const res = await deployToRouter(
        [{ relPath: 'assets/icon.png', buffer: pngBytes }],
        { host: '127.0.0.1', port: routerPort, targetDir: 'flash/hotspot', createBackup: true }
      );
      expect(res.ok).toBe(true);
      expect(res.backupCreated).toBe(true);
      expect(backupSaved).toBe('meganet-pre-deploy');
      expect(pulled['flash/hotspot/assets/icon.png']).toEqual(pngBytes);
    } finally {
      mockRouter.close();
    }
  });

  test('deployToRouter aborts when router free flash storage is insufficient', async () => {
    const mockRouter = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/rest/system/resource') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ 'free-hdd-space': 500 }));
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((resolve) => mockRouter.listen(0, '127.0.0.1', resolve));
    try {
      await expect(
        deployToRouter([{ relPath: 'login.html', buffer: Buffer.alloc(2048, 65) }], {
          host: '127.0.0.1',
          port: mockRouter.address().port
        })
      ).rejects.toThrow(/Insufficient router flash storage/);
    } finally {
      mockRouter.close();
    }
  });

  test('inspectRouter & generateRscScript capport modes return accurate metadata', async () => {
    const planHttp = previewRscPlan({ general: { networkName: 'Cafe' } }, { capportMode: 'http', dnsName: 'portal.lan' });
    expect(planHttp.capportMode).toBe('http');
    expect(planHttp.rsc).toContain("value=\"'http://portal.lan/api.json'\"");

    const rscOff = generateRscScript({ general: { networkName: 'Cafe' } }, { capportMode: 'off' });
    expect(rscOff).not.toContain('/ip/dhcp-server/option/add');

    const mockRouter = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url.startsWith('/rest/system/resource')) {
        return res.end(JSON.stringify({ version: '7.17', 'board-name': 'RB5009', 'free-hdd-space': 99000000 }));
      }
      if (req.url.startsWith('/rest/system/identity')) return res.end(JSON.stringify({ name: 'Core-GW' }));
      if (req.url.startsWith('/rest/ip/hotspot/profile')) return res.end(JSON.stringify([{ name: 'hs-main', 'html-directory': 'flash/hotspot' }]));
      if (req.url.startsWith('/rest/ip/dhcp-server')) return res.end(JSON.stringify([{ name: 'defconf' }]));
      if (req.url.startsWith('/rest/ip/service')) return res.end(JSON.stringify([{ name: 'www-ssl', disabled: 'false', certificate: 'cert_0' }]));
      if (req.url.startsWith('/rest/file')) return res.end(JSON.stringify([{ name: 'flash' }]));
      res.end(JSON.stringify([]));
    });
    await new Promise((resolve) => mockRouter.listen(0, '127.0.0.1', resolve));
    try {
      const info = await inspectRouter({ host: '127.0.0.1', port: mockRouter.address().port });
      expect(info.identity).toBe('Core-GW');
      expect(info.version).toBe('7.17');
      expect(info.hasFlashPrefix).toBe(true);
      expect(info.hotspotProfiles[0].name).toBe('hs-main');
      expect(info.dhcpServers[0].name).toBe('defconf');
      expect(info.wwwSslEnabled).toBe(true);
    } finally {
      mockRouter.close();
    }
  });
});

describe('Package 3 & 4 — QR Generator, Print Sheet & Smart Logo Maker', () => {
  test('encodeQrMatrix and generateQrSvg create valid QR matrices and crisp SVG markup', () => {
    const m1 = encodeQrMatrix('88442299');
    expect(m1.version).toBe(1);
    expect(m1.size).toBe(21);
    // Top-left finder pattern corner modules are dark
    expect(m1.matrix[0][0]).toBe(true);
    expect(m1.matrix[0][6]).toBe(true);
    expect(m1.matrix[6][0]).toBe(true);
    expect(m1.matrix[3][3]).toBe(true);

    const svg = generateQrSvg('http://login.meganet.local/login?username=12345&password=12345');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<path d="M');

    expect(() => encodeQrMatrix('')).toThrow(/empty/);
    expect(() => encodeQrMatrix('x'.repeat(300))).toThrow(/too long/);

    // Long URL payloads up to Version 10 encode cleanly with 8-mask selection
    const v10 = encodeQrMatrix('x'.repeat(250));
    expect(v10.version).toBe(10);
    expect(v10.size).toBe(57);
  });

  test('sanitizeSvg strips active XSS vectors and optimizes SVG markup', () => {
    const dirty = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="alert(1)"><script>alert(2)</script><foreignObject><div>bad</div></foreignObject><a href="javascript:alert(3)"><circle cx="12" cy="12" r="10"/></a></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).toContain('<svg');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onload');
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('foreignObject');
  });

  test('generateBrandAssets produces safe SVG files and a valid binary PNG', () => {
    const brand = generateBrandAssets({
      networkName: 'Mega <Net>',
      tagline: 'Fast & Reliable',
      primaryColor: '#06b6d4',
      backgroundColor: '#0f172a',
      icon: 'shield'
    });
    expect(brand.logoSvg).toContain('<svg');
    expect(brand.logoSvg).toContain('#06b6d4');
    expect(brand.titleSvg).toContain('Mega &lt;Net&gt;');
    expect(brand.titleSvg).toContain('Fast &amp; Reliable');

    // PNG binary signature check (89 50 4E 47 0D 0A 1A 0A) + IHDR + IDAT + IEND
    const png = brand.iconPng;
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.slice(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.toString('ascii')).toContain('IHDR');
    expect(png.toString('ascii')).toContain('IDAT');
    expect(png.toString('ascii')).toContain('IEND');
  });
});

describe('Admin Server Endpoints for All 5 Studio Packages', () => {
  let port;
  let base;
  const SLUG = 'studio-pkg-' + Date.now().toString(36);

  beforeAll(async () => {
    port = await startServer(0);
    base = `http://127.0.0.1:${port}`;
    await request('POST', `${base}/api/profiles`, { slug: SLUG, name: 'فرع المهندسين', preset: 'cafe' });
  });

  afterAll(() => {
    server.close();
    fs.rmSync(ADMIN_TMP, { recursive: true, force: true });
  });

  test('GET /api/qr returns SVG QR code and rejects missing text', async () => {
    const bad = await request('GET', `${base}/api/qr`);
    expect(bad.status).toBe(400);

    const good = await request('GET', `${base}/api/qr?text=VOUCHER123`);
    expect(good.status).toBe(200);
    expect(good.json.svg).toContain('<svg');
  });

  test('GET /api/profiles/:id/rsc returns RouterOS setup script JSON and downloadable attachment', async () => {
    const res = await request('GET', `${base}/api/profiles/${SLUG}/rsc?dnsName=hotspot.local&htmlDir=hs-cafe`);
    expect(res.status).toBe(200);
    expect(res.json.filename).toBe(`${SLUG}-hotspot-setup.rsc`);
    expect(res.json.rsc).toContain('dns-name="hotspot.local"');
    expect(res.json.rsc).toContain('html-directory-override="hs-cafe"');

    const dl = await request('GET', `${base}/api/profiles/${SLUG}/rsc?download=1`);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toContain(`${SLUG}-hotspot-setup.rsc`);
  });

  test('POST /api/profiles/:id/generate-brand writes logo.svg, prand-title.svg and icon.png to profile assets', async () => {
    const res = await request('POST', `${base}/api/profiles/${SLUG}/generate-brand`, {
      networkName: 'كافيه المهندسين',
      tagline: 'FREE WIFI',
      icon: 'coffee',
      primaryColor: '#d97706'
    });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    const assetNames = res.json.assets.map((a) => a.name).sort();
    expect(assetNames).toEqual(['icon.png', 'logo.svg', 'prand-title.svg']);
  });

  test('POST /api/profiles/:id/build and POST /api/profiles/build-all return bundle size and flash memory breakdown', async () => {
    const single = await request('POST', `${base}/api/profiles/${SLUG}/build`);
    expect(single.status).toBe(200);
    expect(single.json.zipSize).toBeGreaterThan(5000);
    expect(single.json.totalRawSize).toBeGreaterThan(10000);
    expect(single.json.totalRawSize).toBeLessThan(1024 * 1024); // fits inside 1 MB router flash budget!
    expect(single.json.breakdown).toEqual(
      expect.objectContaining({
        html: expect.any(Number),
        assets: expect.any(Number),
        rsc: expect.any(Number)
      })
    );
    expect(single.json.breakdown.rsc).toBeGreaterThan(100);

    const batch = await request('POST', `${base}/api/profiles/build-all`, {});
    expect(batch.status).toBe(200);
    expect(batch.json.ok).toBe(true);
    expect(batch.json.count).toBeGreaterThanOrEqual(1);
    expect(batch.json.built[0].zipSize).toBeGreaterThan(5000);
  });

  test('admin/public Studio UI and split modules expose all 5 Studio feature packages', async () => {
    const htmlRes = await request('GET', `${base}/index.html`);
    expect(htmlRes.status).toBe(200);
    const html = htmlRes.text;
    const [cssRes, coreRes, tabsRes, mkRes, simRes] = await Promise.all([
      request('GET', `${base}/studio.css`),
      request('GET', `${base}/studio-core.js`),
      request('GET', `${base}/studio-tabs.js`),
      request('GET', `${base}/studio-mikrotik.js`),
      request('GET', `${base}/studio-simulator.js`)
    ]);
    expect([cssRes.status, coreRes.status, tabsRes.status, mkRes.status, simRes.status]).toEqual([200, 200, 200, 200, 200]);
    const bundle = html + '\n' + coreRes.text + '\n' + tabsRes.text + '\n' + mkRes.text + '\n' + simRes.text;

    // Package 1: Simulator, Zoom/Resize, Theme Switcher, Device Presets & WCAG Contrast Badge
    expect(html).toContain('id="simulatorPanel"');
    expect(html).toContain('id="simFrame"');
    expect(html).toContain('id="simZoomIn"');
    expect(html).toContain('id="simZoomOut"');
    expect(html).toContain('id="simResizer"');
    expect(html).toContain('id="sim-theme"');
    expect(html).toContain('id="sim-device"');
    expect(html).toContain('id="simBezel"');
    expect(bundle).toContain('setSimTheme');
    expect(bundle).toContain('setSimDevice');
    expect(bundle).toContain('SIM_DEVICES');
    expect(bundle).toContain('id="wcag-badge"');
    expect(bundle).toContain('computeWcag');

    // Package 2: MikroTik .rsc & Direct Deploy
    expect(bundle).toContain('id="mk-rsc-output"');
    expect(bundle).toContain('id="mk-dhcp-server"');
    expect(bundle).toContain('testMikrotikConnection');
    expect(bundle).toContain('deployToMikrotik');

    // Package 3: RADIUS Error Translations & Portal QR Login Tester
    expect(bundle).toContain('radius-errors-list');
    expect(bundle).toContain('formQrTester');
    expect(bundle).not.toContain('generateAndPrintVouchers');

    // Package 4: Smart SVG Logo Maker & Auto-Crop/Compress
    expect(bundle).toContain('generateBrandIdentity');
    expect(bundle).toContain('autoCropAndCompressImage');

    // Package 5: Dirty State, Ctrl+S, Profile Search, Batch Build, Flash Meter
    expect(html).toContain('id="dirtyBadge"');
    expect(html).toContain('id="profileSearch"');
    expect(bundle).toContain('batchBuildAll');
    expect(html).toContain('id="bundleMeter"');
  });

  test('POST /api/mikrotik/test, /deploy parameter forwarding, and /preview ephemeral port', async () => {
    const mockRouter = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        if (req.method === 'GET' && req.url.startsWith('/rest/system/resource')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ version: '7.16', 'board-name': 'hAP ax2', 'free-hdd-space': 32 * 1024 * 1024 }));
        }
        if (req.method === 'GET' && req.url.startsWith('/rest/system/identity')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ name: 'Studio-Mock' }));
        }
        if (req.method === 'GET' && req.url.startsWith('/rest/file')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([]));
        }
        if (req.method === 'PUT' && req.url === '/rest/file') {
          if (body.name && body.name.endsWith('hotspot-setup.rsc')) {
            mockRouter._lastRsc = body.contents;
          }
          res.writeHead(201, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ '.id': '*1' }));
        }
        if (req.method === 'POST' && req.url === '/rest/tool/fetch') {
          await httpGetBuffer(body.url);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([{ status: 'finished' }]));
        }
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([]));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
      });
    });

    await new Promise((resolve) => mockRouter.listen(0, '127.0.0.1', resolve));
    const routerPort = mockRouter.address().port;

    try {
      const inspectRes = await request('POST', `${base}/api/mikrotik/test`, {
        host: '127.0.0.1',
        port: routerPort,
        username: 'admin',
        password: ''
      });
      expect(inspectRes.status).toBe(200);
      expect(inspectRes.json.identity).toBe('Studio-Mock');

      const deployRes = await request('POST', `${base}/api/profiles/${SLUG}/deploy`, {
        host: '127.0.0.1',
        port: routerPort,
        targetDir: 'flash/cafe-portal',
        htmlDir: 'flash/cafe-portal',
        profileName: 'custom-cafe-prof',
        dhcpServer: 'dhcp-cafe',
        capportMode: 'http',
        extraHosts: 'pay.example.com'
      });
      expect(deployRes.status).toBe(200);
      expect(deployRes.json.ok).toBe(true);
      expect(deployRes.json.mikrotik).toBeDefined();
      expect(deployRes.json.mikrotik.password).toBeUndefined();
      expect(deployRes.json.mikrotik.dhcpServer).toBe('dhcp-cafe');
      expect(deployRes.json.mikrotik.capportMode).toBe('http');
      expect(mockRouter._lastRsc).toContain('name="custom-cafe-prof"');
      expect(mockRouter._lastRsc).toContain('name="dhcp-cafe"');
      expect(mockRouter._lastRsc).toContain("value=\"'http://login.meganet.local/api.json'\"");
      expect(mockRouter._lastRsc).toContain('dst-host="pay.example.com"');

      const putMk = await request('PUT', `${base}/api/profiles/${SLUG}/mikrotik`, {
        mikrotik: {
          host: '192.168.50.1',
          protocol: 'https',
          tlsFingerprint: 'aa:bb:cc:dd:ee:ff',
          port: 443,
          username: 'admin2',
          password: 'never-saved-password',
          targetDir: 'flash/hotspot',
          htmlDir: 'flash/hotspot',
          dnsName: 'portal.cafe.local',
          profileName: 'cafe-prof-2',
          dhcpServer: 'dhcp-cafe-2',
          capportMode: 'https',
          extraHosts: ['a.example.com', 'b.example.com'],
          applyRsc: true,
          createBackup: false
        }
      });
      expect(putMk.status).toBe(200);
      expect(putMk.json.mikrotik.host).toBe('192.168.50.1');
      expect(putMk.json.mikrotik.tlsFingerprint).toBe('AA:BB:CC:DD:EE:FF');
      expect(putMk.json.mikrotik.password).toBeUndefined();

      const getProf = await request('GET', `${base}/api/profiles/${SLUG}`);
      expect(getProf.status).toBe(200);
      expect(getProf.json.profile.mikrotik.dnsName).toBe('portal.cafe.local');
      expect(getProf.json.profile.mikrotik.password).toBeUndefined();
      expect(fs.readFileSync(path.join(ADMIN_TMP, 'profiles', SLUG, 'mikrotik.json'), 'utf8')).not.toContain('never-saved-password');

      const prevRes = await request('POST', `${base}/api/preview`, { slug: SLUG });
      expect(prevRes.status).toBe(200);
      expect(prevRes.json.port).toBeGreaterThanOrEqual(1024);
      const cssCheck = await request('GET', `${prevRes.json.baseUrl}/portal.css`);
      expect(cssCheck.status).toBe(200);
      await request('POST', `${base}/api/preview/stop`, {});
    } finally {
      mockRouter.close();
    }
  });

  test('Studio regression guards: flash/ deduplication, NaN QR margin, saved mikrotik ZIP inheritance, encoded asset delete & import rollback', async () => {
    function readZipTextEntry(zipBuf, filename) {
      let off = zipBuf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
      expect(off).toBeGreaterThanOrEqual(0);
      const cdOffset = zipBuf.readUInt32LE(off + 16);
      const total = zipBuf.readUInt16LE(off + 10);
      let cur = cdOffset;
      for (let i = 0; i < total; i++) {
        expect(zipBuf.readUInt32LE(cur)).toBe(0x02014b50);
        const method = zipBuf.readUInt16LE(cur + 10);
        const compSize = zipBuf.readUInt32LE(cur + 20);
        const nameLen = zipBuf.readUInt16LE(cur + 28);
        const extraLen = zipBuf.readUInt16LE(cur + 30);
        const commentLen = zipBuf.readUInt16LE(cur + 32);
        const lfhOffset = zipBuf.readUInt32LE(cur + 42);
        const name = zipBuf.slice(cur + 46, cur + 46 + nameLen).toString('utf8');
        if (name === filename || name.endsWith('/' + filename) || name.endsWith('-' + filename)) {
          const lfhNameLen = zipBuf.readUInt16LE(lfhOffset + 26);
          const lfhExtraLen = zipBuf.readUInt16LE(lfhOffset + 28);
          const dataStart = lfhOffset + 30 + lfhNameLen + lfhExtraLen;
          const raw = zipBuf.slice(dataStart, dataStart + compSize);
          return (method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8');
        }
        cur += 46 + nameLen + extraLen + commentLen;
      }
      return null;
    }

    const rscNoDoubleFlash = generateRscScript({}, {
      slug: SLUG,
      dnsName: 'cafe.local',
      htmlDir: 'flash/cafe-portal',
      profileName: 'cafe-prof',
      dhcpServer: 'dhcp-cafe',
      capportMode: 'http'
    });
    expect(rscNoDoubleFlash).not.toContain('flash/flash/');
    expect(rscNoDoubleFlash).toContain('flash/cafe-portal/api.json');

    const safeMarginSvg = generateQrSvg('WIFI:T:nopass;S:Cafe;;', { margin: Number.NaN });
    expect(safeMarginSvg).not.toContain('NaN');
    const negMarginSvg = generateQrSvg('WIFI:T:nopass;S:Cafe;;', { margin: -3 });
    expect(negMarginSvg).toContain('viewBox="0 0 ');

    await request('PUT', `${base}/api/profiles/${SLUG}/mikrotik`, {
      mikrotik: {
        dnsName: 'saved-cafe.local',
        htmlDir: 'flash/saved-cafe',
        targetDir: 'flash/saved-cafe',
        profileName: 'saved-cafe-prof',
        dhcpServer: 'dhcp-saved',
        capportMode: 'http',
        extraHosts: ['cdn.cafe.test']
      }
    });

    const inheritedRsc = await request('GET', `${base}/api/profiles/${SLUG}/rsc`);
    expect(inheritedRsc.status).toBe(200);
    expect(inheritedRsc.json.rsc).toContain("value=\"'http://saved-cafe.local/api.json'\"");
    expect(inheritedRsc.json.rsc).toContain('name="saved-cafe-prof"');
    expect(inheritedRsc.json.rsc).toContain('name="dhcp-saved"');
    expect(inheritedRsc.json.rsc).not.toContain('flash/flash/');

    const buildOne = await request('POST', `${base}/api/profiles/${SLUG}/build`, {});
    expect(buildOne.status).toBe(200);
    const singleZip = await httpGetBuffer(`${base}${buildOne.json.downloadUrl}`);
    const singleRsc = readZipTextEntry(singleZip, 'hotspot-setup.rsc');
    expect(singleRsc).toContain("value=\"'http://saved-cafe.local/api.json'\"");
    expect(singleRsc).toContain('name="dhcp-saved"');

    const buildAll = await request('POST', `${base}/api/profiles/build-all`, {});
    expect(buildAll.status).toBe(200);
    const builtEntry = buildAll.json.built.find((b) => b.id === SLUG);
    expect(builtEntry).toBeDefined();
    const allZip = await httpGetBuffer(`${base}${builtEntry.downloadUrl}`);
    const allRsc = readZipTextEntry(allZip, 'hotspot-setup.rsc');
    expect(allRsc).toContain("value=\"'http://saved-cafe.local/api.json'\"");

    const upSpaced = await request('POST', `${base}/api/profiles/${SLUG}/assets`, {
      filename: 'my badge.svg',
      dataBase64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>').toString('base64')
    });
    expect(upSpaced.status).toBe(200);

    const delSpaced = await request('DELETE', `${base}/api/profiles/${SLUG}/assets/my%20badge.svg`);
    expect(delSpaced.status).toBe(200);
    const delMalformed = await request('DELETE', `${base}/api/profiles/${SLUG}/assets/%E0%A4%A`);
    expect(delMalformed.status).toBe(400);

    const rollbackSlug = 'rollback-broken-import';
    const exportRes = await request('GET', `${base}/api/profiles/${SLUG}/export`);
    expect(exportRes.status).toBe(200);
    const brokenBundle = {
      ...exportRes.json,
      assets: [{ name: '../evil.txt', dataBase64: Buffer.from('bad').toString('base64') }]
    };
    const importFail = await request('POST', `${base}/api/profiles/import`, {
      slug: rollbackSlug,
      bundle: brokenBundle
    });
    expect(importFail.status).toBe(400);
    expect(fs.existsSync(path.join(ADMIN_TMP, 'profiles', rollbackSlug))).toBe(false);
  });
});
