/**
 * profile-store.js — client profiles for the local admin/portal generator.
 *
 * Each profile is one isolated folder under `.admin/profiles/<slug>/`:
 *   - metadata.json  → { name, createdAt, updatedAt }
 *   - config.json    → the client's portal config (validated before save)
 *   - announcements.json → optional client announcements
 *   - assets/        → client-only brand files (logo.svg, prand-title.svg,
 *                      icon.png, agent images, …)
 *
 * A profile never touches the repo workspace directly — the build pipeline
 * (workspace.js) applies a snapshot of it temporarily and restores the
 * workspace byte-identical afterwards.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { sanitizeSvg } = require('../../scripts/svg-utils.js');

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
const ASSET_EXT = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp']);
const MAX_ASSET_BYTES = 3 * 1024 * 1024; // 3 MB

function assertSlug(slug) {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    throw new Error(`invalid profile slug: ${slug}`);
  }
  return slug;
}

function createProfileStore(baseDir) {
  const profilesDir = path.join(baseDir, 'profiles');
  const tmpDir = path.join(baseDir, 'tmp');

  function ensureDirs() {
    fs.mkdirSync(profilesDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  function profileDir(slug) {
    assertSlug(slug);
    return path.join(profilesDir, slug);
  }

  function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function writeJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  function list() {
    ensureDirs();
    return fs.readdirSync(profilesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && SLUG_RE.test(e.name))
      .map((e) => {
        const meta = readJson(path.join(profileDir(e.name), 'metadata.json'));
        return { id: e.name, name: meta.name, createdAt: meta.createdAt, updatedAt: meta.updatedAt };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function exists(slug) {
    return fs.existsSync(profileDir(slug));
  }

  function create(slug, name, templateConfig) {
    const id = assertSlug(slug);
    if (exists(id)) throw new Error(`profile already exists: ${id}`);
    ensureDirs();
    const dir = profileDir(id);
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    const now = new Date().toISOString();
    writeJson(path.join(dir, 'metadata.json'), { name: name || id, createdAt: now, updatedAt: now });
    if (templateConfig) writeJson(path.join(dir, 'config.json'), templateConfig);
    return get(id);
  }

  function duplicate(slug, newSlug, newName) {
    const id = assertSlug(slug);
    const newId = assertSlug(newSlug);
    if (!exists(id)) throw new Error(`profile not found: ${id}`);
    if (exists(newId)) throw new Error(`profile already exists: ${newId}`);
    ensureDirs();
    const src = profileDir(id);
    const dst = profileDir(newId);
    fs.mkdirSync(path.join(dst, 'assets'), { recursive: true });
    fs.cpSync(path.join(src, 'config.json'), path.join(dst, 'config.json'), { force: true });
    if (fs.existsSync(path.join(src, 'announcements.json'))) {
      fs.cpSync(path.join(src, 'announcements.json'), path.join(dst, 'announcements.json'), { force: true });
    }
    if (fs.existsSync(path.join(src, 'mikrotik.json'))) {
      fs.cpSync(path.join(src, 'mikrotik.json'), path.join(dst, 'mikrotik.json'), { force: true });
    }
    for (const f of fs.readdirSync(path.join(src, 'assets'))) {
      fs.copyFileSync(path.join(src, 'assets', f), path.join(dst, 'assets', f));
    }
    const now = new Date().toISOString();
    writeJson(path.join(dst, 'metadata.json'), { name: newName || newId, createdAt: now, updatedAt: now });
    return get(newId);
  }

  function rename(slug, name) {
    const id = assertSlug(slug);
    if (!exists(id)) throw new Error(`profile not found: ${id}`);
    const metaFile = path.join(profileDir(id), 'metadata.json');
    const meta = readJson(metaFile);
    meta.name = name || id;
    meta.updatedAt = new Date().toISOString();
    writeJson(metaFile, meta);
  }

  function remove(slug) {
    const id = assertSlug(slug);
    if (!exists(id)) throw new Error(`profile not found: ${id}`);
    fs.rmSync(profileDir(id), { recursive: true, force: true });
  }

  function sanitizeMikrotikSettings(input = {}, id = '') {
    const src = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
    const protocol = src.protocol === 'https' ? 'https' : 'http';
    const tlsFingerprint = String(src.tlsFingerprint || '').trim().toUpperCase();
    const rawPort = Number(src.port);
    const port = Number.isInteger(rawPort) && rawPort >= 1 && rawPort <= 65535
      ? rawPort
      : (protocol === 'https' ? 443 : 80);
    const capportMode = ['https', 'http', 'off'].includes(src.capportMode) ? src.capportMode : 'https';
    let extraHosts = [];
    if (Array.isArray(src.extraHosts)) {
      extraHosts = src.extraHosts.map((s) => String(s || '').trim()).filter(Boolean);
    } else if (typeof src.extraHosts === 'string') {
      extraHosts = src.extraHosts.split(',').map((s) => s.trim()).filter(Boolean);
    }
    const targetDir = String(src.targetDir || 'hotspot').trim() || 'hotspot';
    const htmlDir = String(src.htmlDir || targetDir || 'hotspot').trim() || 'hotspot';
    return {
      host: String(src.host ?? '192.168.88.1').trim(),
      protocol,
      port,
      username: String(src.username || 'admin').trim() || 'admin',
      targetDir,
      htmlDir,
      dnsName: String(src.dnsName || 'login.meganet.local').trim() || 'login.meganet.local',
      profileName: String(src.profileName || (id ? `${id}-hs-profile` : '')).trim(),
      dhcpServer: String(src.dhcpServer || '').trim(),
      capportMode,
      extraHosts,
      applyRsc: Boolean(src.applyRsc),
      createBackup: Boolean(src.createBackup),
      tlsFingerprint,
      updatedAt: String(src.updatedAt || new Date().toISOString())
    };
  }

  function readMikrotikSettings(slug) {
    const id = assertSlug(slug);
    const file = path.join(profileDir(id), 'mikrotik.json');
    if (!fs.existsSync(file)) return null;
    try {
      const raw = readJson(file);
      return sanitizeMikrotikSettings(raw, id);
    } catch {
      return null;
    }
  }

  function saveMikrotikSettings(slug, settings) {
    const id = assertSlug(slug);
    if (!exists(id)) throw new Error(`profile not found: ${id}`);
    const existing = readMikrotikSettings(id) || {};
    const patch = (settings && typeof settings === 'object' && !Array.isArray(settings)) ? { ...settings } : {};
    delete patch.password;
    const sanitized = sanitizeMikrotikSettings(
      { ...existing, ...patch, updatedAt: new Date().toISOString() },
      id
    );
    writeJson(path.join(profileDir(id), 'mikrotik.json'), sanitized);
    return sanitized;
  }

  function get(slug) {
    const id = assertSlug(slug);
    if (!exists(id)) throw new Error(`profile not found: ${id}`);
    const meta = readJson(path.join(profileDir(id), 'metadata.json'));
    const config = fs.existsSync(path.join(profileDir(id), 'config.json'))
      ? readJson(path.join(profileDir(id), 'config.json'))
      : {};
    const announcements = fs.existsSync(path.join(profileDir(id), 'announcements.json'))
      ? readJson(path.join(profileDir(id), 'announcements.json'))
      : null;
    const mikrotik = readMikrotikSettings(id);
    const assets = fs.readdirSync(path.join(profileDir(id), 'assets'))
      .filter((f) => !f.startsWith('.'))
      .map((f) => {
        const stat = fs.statSync(path.join(profileDir(id), 'assets', f));
        return { name: f, size: stat.size };
      });
    return { id, name: meta.name, createdAt: meta.createdAt, updatedAt: meta.updatedAt, config, announcements, mikrotik, assets };
  }

  /**
   * Save the profile config after VALIDATION. The validator must throw or
   * return { errors } — a config that fails validation is NEVER persisted.
   */
  function saveConfig(slug, config, validateFn) {
    const id = assertSlug(slug);
    if (!exists(id)) throw new Error(`profile not found: ${id}`);
    if (config && config.theme && config.theme.preset === '') {
      delete config.theme.preset;
    }
    const result = validateFn ? validateFn(config) : { errors: [] };
    if (result.errors && result.errors.length) {
      const err = new Error('config validation failed');
      err.validationErrors = result.errors;
      throw err;
    }
    writeJson(path.join(profileDir(id), 'config.json'), config);
    const metaFile = path.join(profileDir(id), 'metadata.json');
    const meta = readJson(metaFile);
    meta.updatedAt = new Date().toISOString();
    writeJson(metaFile, meta);
    return get(id);
  }

  function saveAnnouncements(slug, announcements) {
    const id = assertSlug(slug);
    if (!exists(id)) throw new Error(`profile not found: ${id}`);
    writeJson(path.join(profileDir(id), 'announcements.json'), announcements);
  }

  /** Sanitize an uploaded filename; returns the safe basename. */
  function sanitizeAssetName(filename) {
    const base = path.basename(String(filename || ''));
    if (!base || base.startsWith('.') || !ASSET_EXT.has(path.extname(base).toLowerCase())) {
      throw new Error(`unsupported asset file: ${filename}`);
    }
    return base;
  }

  function writeAsset(slug, filename, buffer) {
    const id = assertSlug(slug);
    if (!exists(id)) throw new Error(`profile not found: ${id}`);
    if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_ASSET_BYTES) {
      throw new Error('asset must be a non-empty buffer ≤ 3 MB');
    }
    const safe = sanitizeAssetName(filename);
    let outBuffer = buffer;
    if (path.extname(safe).toLowerCase() === '.svg') {
      outBuffer = Buffer.from(sanitizeSvg(buffer.toString('utf8')), 'utf8');
    }
    fs.writeFileSync(path.join(profileDir(id), 'assets', safe), outBuffer);
    return safe;
  }

  function deleteAsset(slug, filename) {
    const id = assertSlug(slug);
    const safe = sanitizeAssetName(filename);
    const file = path.join(profileDir(id), 'assets', safe);
    if (fs.existsSync(file)) fs.rmSync(file);
  }

  return {
    baseDir,
    profilesDir,
    ensureDirs,
    list,
    exists,
    create,
    duplicate,
    rename,
    remove,
    get,
    getMikrotikSettings: readMikrotikSettings,
    saveConfig,
    saveAnnouncements,
    saveMikrotikSettings,
    writeAsset,
    deleteAsset,
    sanitizeAssetName,
    ASSET_EXT,
    MAX_ASSET_BYTES
  };
}

module.exports = { createProfileStore, SLUG_RE };
