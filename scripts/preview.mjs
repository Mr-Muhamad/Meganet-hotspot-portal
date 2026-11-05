#!/usr/bin/env node
/**
 * preview.mjs — local preview server for the Meganet hotspot portal.
 *
 * Serves dist/ and substitutes RouterOS template variables with realistic
 * demo values so every page can be reviewed visually exactly as a connected
 * user would see it — including the Arabic (RTL) variants.
 *
 * Usage:
 *   node scripts/preview.mjs                     # default scenario (connected user)
 *   node scripts/preview.mjs --scenario error    # login page shows a RADIUS error
 *   node scripts/preview.mjs --scenario chap     # CHAP login mode
 *   node scripts/preview.mjs --scenario unlimited# session without byte quota
 *   node scripts/preview.mjs --port 9000         # custom port (default 8765)
 *   node scripts/preview.mjs --no-pin-lang       # don't pin language cookie (E2E)
 *   node scripts/preview.mjs --open              # open the browser after starting
 *
 * Then open any page, e.g. http://127.0.0.1:8765/ar/login.html
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const ROOT = join(process.cwd(), 'dist');

// ---------------------------------------------------------------------------
// Demo scenarios — realistic values for every RouterOS variable the templates use
// ---------------------------------------------------------------------------

const baseVars = {
  username: 'ahmed_sayed',
  ip: '10.5.50.118',
  mac: '3C:5A:B4:0F:22:91',
  hostname: 'Meganet-Hotspot',
  identity: 'MikroTik',
  uptime: '02:14:37',
  'uptime-secs': '8077',
  'session-time-left': '01:45:23',
  'session-time-left-secs': '6323',
  'bytes-in': '4294967296',
  'bytes-out': '1073741824',
  'bytes-in-nice': '4.0 GiB',
  'bytes-out-nice': '1.0 GiB',
  'limit-bytes-total': '10737418240', // 10 GiB quota
  'link-login': 'http://10.5.50.1/login',
  'link-login-only': 'http://10.5.50.1/login',
  'link-orig': 'http://www.example.com/',
  'link-redirect': 'http://www.example.com/',
  'link-status': 'http://10.5.50.1/status',
  'link-logout': 'http://10.5.50.1/logout',
  popup: 'true',
  error: '',
  'chap-id': '',
  'chap-challenge': '',
  // redirect.html RouterOS conditions
  'http-status': '302',
  'http-header': 'Location'
};

const baseConds = {
  error: false,
  'chap-id': false,
  'session-time-left': true,
  'limit-bytes-total': true,
  popup: true,
  captive: false
};

const scenarios = {
  // Connected user with a 10 GiB quota, mid-session.
  default: { vars: baseVars, conds: baseConds },

  // Failed login (RADIUS Reply-Message arrives via $(error)).
  error: {
    vars: { ...baseVars, error: 'invalid username or password' },
    conds: { ...baseConds, error: true }
  },

  // CHAP login (challenge fields rendered, doLogin() path active).
  chap: {
    vars: { ...baseVars, 'chap-id': '4f7b2c91', 'chap-challenge': '1a2b3c4d5e6f7a8b' },
    conds: { ...baseConds, 'chap-id': true }
  },

  // Session with no byte quota (quota progress bar hidden).
  unlimited: {
    vars: { ...baseVars, 'limit-bytes-total': '' },
    conds: { ...baseConds, 'limit-bytes-total': false }
  },

  // Captive-portal detected client (extra notice on the login footer).
  captive: {
    conds: { ...baseConds, captive: true }
  }
};

// ---------------------------------------------------------------------------
// RouterOS mini template engine: $(var), $(var-esc), $(if x)...$(else)...$(endif)
// ---------------------------------------------------------------------------

function htmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function substitute(html, scenario) {
  const { vars, conds } = scenario;

  // Evaluate a RouterOS condition: plain $(if x) uses the flags map,
  // comparison $(if x == "y") checks the demo value.
  const evalCondition = (name, comparison) => {
    if (!comparison) return !!conds[name];
    const expected = comparison.replace(/^\s*==\s*/, '').replace(/^["']|["']$/g, '');
    return String(vars[name] ?? baseVars[name] ?? '') === expected;
  };
  // $(if x == "y") — the operator + literal part of a conditional.
  const compare = '(\\s*==\\s*(?:"[^"]*"|\'[^\']*\'|[^)]+))?';

  // Conditionals with $(else) first, then bare $(if)...$(endif).
  html = html.replace(
    new RegExp(`\\$\\(if ([a-z-]+)${compare}\\)([\\s\\S]*?)\\$\\(else\\)([\\s\\S]*?)\\$\\(endif\\)`, 'g'),
    (m, name, comparison, trueBranch, falseBranch) => (evalCondition(name, comparison) ? trueBranch : falseBranch) || ''
  );
  html = html.replace(
    new RegExp(`\\$\\(if ([a-z-]+)${compare}\\)([\\s\\S]*?)\\$\\(endif\\)`, 'g'),
    (m, name, comparison, trueBranch) => (evalCondition(name, comparison) ? trueBranch : '') || ''
  );

  // Simple variable substitution: $(var) and the URL/HTML-escaped $(var-esc) forms.
  // Lazy name capture so "username-esc" parses as name="username" + "-esc" suffix.
  html = html.replace(/\$\(([a-z][a-z0-9-]*?)(-esc)?\)/gi, (m, name, escaped) => {
    const value = vars[name] ?? baseVars[name];
    if (value === undefined) return m; // unknown variable: leave it visible for debugging
    if (escaped) {
      // RouterOS -esc: URL-encode; error text is HTML-escaped for safe inline display.
      return name === 'error' ? htmlEscape(value) : encodeURIComponent(value);
    }
    return value;
  });

  // Safety net: strip any unmatched RouterOS conditional markers.
  html = html.replace(/\$\(if [a-z-]+\)|\$\(else\)|\$\(endif\)/gi, '');

  return html;
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

function parseArgs() {
  const args = { port: 8765, scenario: 'default', open: false, pinLang: true };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--port') args.port = Number(process.argv[++i]);
    else if (a === '--scenario') args.scenario = process.argv[++i];
    else if (a === '--open') args.open = true;
    else if (a === '--no-pin-lang') args.pinLang = false;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/preview.mjs [--port N] [--scenario default|error|chap|unlimited|captive] [--no-pin-lang] [--open]`);
      process.exit(0);
    }
  }
  return args;
}

const args = parseArgs();
const scenario = scenarios[args.scenario] || scenarios.default;

if (!existsSync(ROOT)) {
  console.log('dist/ not found — building first...');
  const res = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { stdio: 'inherit' });
  if (res.status !== 0) { console.error('Build failed'); process.exit(1); }
}

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.includes('$(')) urlPath = '/alogin.html'; // unsubstituted MikroTik path
    let filePath = join(ROOT, urlPath);
    if (urlPath.endsWith('/')) filePath = join(filePath, 'index.html');

    // Pin the language cookie to the URL so pages don't auto-redirect while
    // reviewing (ui.initLang defaults to 'ar' when the cookie is absent).
    // --no-pin-lang hands the language decision back to the portal (E2E).
    if (args.pinLang) {
      const lang = urlPath.startsWith('/ar/') ? 'ar' : 'en';
      res.setHeader('Set-Cookie', `hotspot_lang=${lang}; Path=/; Max-Age=86400; SameSite=Lax`);
    }

    let data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    if (ext === '.html' || ext === '.txt') {
      data = Buffer.from(substitute(data.toString('utf8'), scenario));
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Preview 404: ${req.url} (${err.code || err.message})\nRun "npm run build" first if dist/ is stale.`);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${args.port} is already in use.\nStop the other server or use --port (e.g. --port ${args.port + 1}).`);
    process.exit(1);
  }
  throw err;
});

server.listen(args.port, '127.0.0.1', () => {
  const pages = [
    ['index (auto language detect)', '/index.html'],
    ['login (EN)', '/login.html'],
    ['login (AR · RTL)', '/ar/login.html'],
    ['status (EN)', '/status.html'],
    ['status (AR · RTL)', '/ar/status.html'],
    ['plans (EN)', '/plans.html'],
    ['plans (AR · RTL)', '/ar/plans.html'],
    ['alogin (EN)', '/alogin.html'],
    ['alogin (AR · RTL)', '/ar/alogin.html'],
    ['expired (EN)', '/expired.html'],
    ['expired (AR · RTL)', '/ar/expired.html'],
    ['logout (EN)', '/logout.html'],
    ['logout (AR · RTL)', '/ar/logout.html'],
    ['error (EN)', '/error.html'],
    ['error (AR · RTL)', '/ar/error.html'],
    ['redirect (RouterOS hop)', '/redirect.html']
  ];

  const base = `http://127.0.0.1:${args.port}`;
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Meganet hotspot preview — scenario: ${args.scenario.padEnd(18)} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  for (const [label, path] of pages) console.log(`  ${label.padEnd(26)} ${base}${path}`);
  console.log('\n  Static assets : /md5.js  /assets/…  /manifest.json  /errors.txt');
  console.log('  Stop with Ctrl+C\n');

  if (args.open) {
    const url = `${base}/index.html`;
    const open =
      process.platform === 'win32' ? ['cmd', '/c', 'start', '', url]
      : process.platform === 'darwin' ? ['open', url]
      : ['xdg-open', url];
    spawnSync(open[0], open.slice(1), { shell: process.platform === 'win32' });
  }
});
