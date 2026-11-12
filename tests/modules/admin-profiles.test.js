/**
 * Tests for the admin portal generator profile store (admin/lib/profile-store.js)
 * and the loopback-only server guard (admin/server.js isLoopback).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createProfileStore, SLUG_RE } = require('../../admin/lib/profile-store.js');
const { isLoopback } = require('../../admin/server.js');

function tempBase() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'meganet-admin-'));
}

const SHIPPED = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config.json'), 'utf8'));
const SHIPPED_HASH = fs.readFileSync(path.join(__dirname, '..', '..', 'config.json')).toString('utf8');

describe('admin profile-store', () => {
  let base;
  let store;

  beforeEach(() => {
    base = tempBase();
    store = createProfileStore(base);
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  test('creates a profile from an empty dir, lists it, and reads it back', () => {
    const created = store.create('cafe-test', 'كافيه تجريبي', SHIPPED);
    expect(created.id).toBe('cafe-test');
    expect(created.name).toBe('كافيه تجريبي');
    expect(created.assets).toEqual([]);
    expect(store.list().map(p => p.id)).toContain('cafe-test');
    const got = store.get('cafe-test');
    expect(got.config.general.networkName).toBe(SHIPPED.general.networkName);
  });

  test('rejects unsafe slugs and dot-prefixed paths', () => {
    expect(SLUG_RE.test('cafe_test')).toBe(false);
    expect(SLUG_RE.test('..')).toBe(false);
    expect(SLUG_RE.test('a/b')).toBe(false);
    expect(() => store.create('../escape', 'x', SHIPPED)).toThrow(/invalid profile slug/);
    expect(() => store.get('../escape')).toThrow(/invalid profile slug/);
  });

  test('duplicate copies config and assets into a new slug', () => {
    store.create('src', 'Src', SHIPPED);
    store.writeAsset('src', 'logo.svg', Buffer.from('<svg/>'));

    const dup = store.duplicate('src', 'src2', 'Src 2');

    expect(dup.assets.map(a => a.name)).toEqual(['logo.svg']);
    expect(fs.readFileSync(path.join(base, 'profiles', 'src2', 'assets', 'logo.svg'), 'utf8')).toBe('<svg/>');
  });

  test('saveConfig rejects invalid config and never persists it', () => {
    store.create('p', 'P', SHIPPED);
    const bad = JSON.parse(JSON.stringify(SHIPPED));
    bad.features.loginMode = 'vucher_only';

    expect(() => store.saveConfig('p', bad, (c) => {
      const errors = c.features.loginMode === 'vucher_only' ? ['features.loginMode: invalid'] : [];
      return { errors };
    })).toThrow(/validation failed/);

    expect(store.get('p').config.features.loginMode).toBe(SHIPPED.features.loginMode);
  });

  test('writeAsset sanitizes filenames and rejects oversize uploads', () => {
    store.create('p', 'P', SHIPPED);
    // traversal attempts are stripped to a plain basename — never a path
    const safe = store.writeAsset('p', '../../evil.svg', Buffer.from('x'));
    expect(safe).toBe('evil.svg');
    expect(fs.existsSync(path.join(base, 'profiles', 'p', 'assets', 'evil.svg'))).toBe(true);
    expect(fs.existsSync(path.join(base, 'profiles', 'p', 'assets', '..', 'evil.svg'))).toBe(false);
    expect(store.writeAsset('p', 'logo.svg', Buffer.from('x'))).toBe('logo.svg');
    expect(() => store.writeAsset('p', 'big.png', Buffer.alloc(store.MAX_ASSET_BYTES + 1))).toThrow(/≤ 3 MB/);
    expect(() => store.writeAsset('p', 'script.exe', Buffer.from('x'))).toThrow(/unsupported asset file/);
  });

  test('saveMikrotikSettings persists non-secret router fields, strips password, and copies on duplicate', () => {
    store.create('cafe', 'Cafe', SHIPPED);
    expect(store.get('cafe').mikrotik).toBeNull();

    const saved = store.saveMikrotikSettings('cafe', {
      host: '10.10.0.1',
      protocol: 'https',
      port: 8443,
      username: 'netops',
      password: 'super-secret-password',
      targetDir: 'flash/cafe',
      htmlDir: 'flash/cafe',
      dnsName: 'wifi.cafe.local',
      profileName: 'cafe-hs',
      dhcpServer: 'dhcp-cafe',
      capportMode: 'http',
      extraHosts: 'pay.cafe.local, cdn.cafe.local',
      applyRsc: true,
      createBackup: true,
      tlsFingerprint: 'AA:BB:CC:DD'
    });

    expect(saved.password).toBeUndefined();
    expect(saved.host).toBe('10.10.0.1');
    expect(saved.protocol).toBe('https');
    expect(saved.port).toBe(8443);
    expect(saved.extraHosts).toEqual(['pay.cafe.local', 'cdn.cafe.local']);
    expect(saved.tlsFingerprint).toBe('AA:BB:CC:DD');

    const rawFile = fs.readFileSync(path.join(base, 'profiles', 'cafe', 'mikrotik.json'), 'utf8');
    expect(rawFile).not.toContain('super-secret-password');
    expect(store.get('cafe').mikrotik.dnsName).toBe('wifi.cafe.local');

    store.duplicate('cafe', 'cafe-copy', 'Cafe Copy');
    expect(store.get('cafe-copy').mikrotik.host).toBe('10.10.0.1');
    expect(store.get('cafe-copy').mikrotik.tlsFingerprint).toBe('AA:BB:CC:DD');
  });

  test('remove deletes the profile folder', () => {
    store.create('gone', 'Gone', SHIPPED);
    store.remove('gone');
    expect(store.exists('gone')).toBe(false);
  });
});

describe('admin server guard', () => {
  test('accepts loopback addresses and rejects everything else', () => {
    expect(isLoopback('127.0.0.1')).toBe(true);
    expect(isLoopback('::1')).toBe(true);
    expect(isLoopback('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopback('192.168.1.5')).toBe(false);
    expect(isLoopback('10.0.0.1')).toBe(false);
  });

  test('the shipped config hash is untouched by merely loading the modules', () => {
    expect(fs.readFileSync(path.join(__dirname, '..', '..', 'config.json')).toString('utf8')).toBe(SHIPPED_HASH);
  });
});
