/**
 * workspace.js — isolated build pipeline behind the admin portal generator.
 *
 * Each profile build runs inside an isolated staging directory (never mutating
 * the shipped repo's config.json, src/announcements.json, src/assets, or dist/
 * directory). That guarantees concurrency safety, zero leftover pollution on
 * crash, and full compatibility with read-only installation folders such as
 * C:\Program Files\ on Windows.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { ZipFile } = require('yazl');
const { generateRscScript } = require('./mikrotik.js');

const REPO_ROOT = path.join(__dirname, '..', '..');
const FLASH_BUDGET_BYTES = 1024 * 1024; // 1 MB recommended hotspot flash budget

function createWorkspace({ repoRoot = REPO_ROOT, workDir } = {}) {
  const assetsDir = path.join(repoRoot, 'src', 'assets');
  const configFile = path.join(repoRoot, 'config.json');
  const announcementsFile = path.join(repoRoot, 'src', 'announcements.json');
  const resolvedWorkDir = workDir || process.env.BUILD_WORK_DIR || path.join(repoRoot, '.admin');

  function readBuffer(file) {
    return fs.existsSync(file) ? fs.readFileSync(file) : null;
  }

  function inside(base, candidate) {
    const resolved = path.resolve(base, candidate);
    return resolved === base || resolved.startsWith(base + path.sep) ? resolved : null;
  }

  function walkAssets(dir, prefix, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? path.join(prefix, entry.name) : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkAssets(full, rel, out);
      else out.push({ rel, buffer: fs.readFileSync(full) });
    }
  }

  function snapshot() {
    const assets = [];
    if (fs.existsSync(assetsDir)) walkAssets(assetsDir, '', assets);
    return {
      config: readBuffer(configFile),
      announcements: readBuffer(announcementsFile),
      assets
    };
  }

  function checkProfileShape(profile) {
    if (!profile || typeof profile.config !== 'object') {
      throw new Error('profile has no config object');
    }
  }

  function collectReferencedAssets(cfg) {
    const keep = new Set(['logo.svg', 'prand-title.svg', 'icon.png']);
    const agents = cfg && cfg.support && Array.isArray(cfg.support.agents) ? cfg.support.agents : [];
    for (const agent of agents) {
      if (!agent || typeof agent !== 'object') continue;
      for (const raw of [agent.avatar, agent.image]) {
        if (!raw || typeof raw !== 'string') continue;
        const cleaned = raw.replace(/^\.?\/?assets[\\/]/i, '').replace(/\\/g, '/');
        if (cleaned) keep.add(cleaned);
      }
    }
    return keep;
  }

  function applyProfileToDir(profile, targetAssetsDir, targetConfigFile, targetAnnouncementsFile) {
    checkProfileShape(profile);
    const cfgCopy = JSON.parse(JSON.stringify(profile.config));
    if (cfgCopy.theme && cfgCopy.theme.preset === '') {
      delete cfgCopy.theme.preset;
    }
    fs.writeFileSync(targetConfigFile, JSON.stringify(cfgCopy, null, 2) + '\n', 'utf8');

    if (profile.announcements !== null && profile.announcements !== undefined) {
      fs.writeFileSync(targetAnnouncementsFile, JSON.stringify(profile.announcements, null, 2) + '\n', 'utf8');
    } else if (fs.existsSync(announcementsFile)) {
      fs.copyFileSync(announcementsFile, targetAnnouncementsFile);
    }

    const keepAssets = collectReferencedAssets(cfgCopy);
    fs.mkdirSync(targetAssetsDir, { recursive: true });
    if (fs.existsSync(assetsDir)) {
      for (const entry of fs.readdirSync(assetsDir, { withFileTypes: true })) {
        const src = path.join(assetsDir, entry.name);
        const dest = path.join(targetAssetsDir, entry.name);
        if (entry.isDirectory()) {
          fs.cpSync(src, dest, { recursive: true, force: true });
        } else if (keepAssets.has(entry.name)) {
          fs.copyFileSync(src, dest);
        }
      }
    }

    const applied = [];
    if (profile.assets && profile.assets.length) {
      for (const asset of profile.assets) {
        const safe = path.basename(asset.name);
        if (safe !== asset.name || safe.startsWith('.') || !safe) continue;
        if (!keepAssets.has(safe)) continue;
        const src = inside(profile.dir, path.join('assets', safe));
        const dest = inside(targetAssetsDir, safe);
        if (!src || !dest || !fs.existsSync(src)) continue;
        fs.copyFileSync(src, dest);
        applied.push(safe);
      }
    }
    return applied;
  }

  // Legacy in-place helpers kept exported for backwards compatibility
  function applyProfile(profile) {
    return applyProfileToDir(profile, assetsDir, configFile, announcementsFile);
  }

  function categorizeFile(relPath) {
    const norm = relPath.replace(/\\/g, '/').toLowerCase();
    if (norm.endsWith('.rsc')) return 'rsc';
    if (norm.endsWith('.html')) return 'html';
    if (norm.startsWith('assets/') || /\.(svg|png|jpe?g|webp|ico)$/.test(norm)) return 'assets';
    if (norm.endsWith('.js') || norm.endsWith('.css')) return 'scripts';
    return 'other';
  }

  function zipDistDir(sourceDistDir, { outputZip = path.join(resolvedWorkDir, 'tmp', 'dist.zip'), rscContent = null, collectBuffers = false } = {}) {
    if (!fs.existsSync(sourceDistDir)) throw new Error('build did not produce dist/');
    fs.mkdirSync(path.dirname(outputZip), { recursive: true });

    const breakdown = { html: 0, assets: 0, scripts: 0, rsc: 0, other: 0 };
    let totalRawSize = 0;
    const collectedFiles = [];
    let fileCount = 0;

    return new Promise((resolve, reject) => {
      const zipfile = new ZipFile();
      const output = fs.createWriteStream(outputZip);
      output.on('error', reject);
      output.on('close', () => {
        let zipSize = 0;
        try { zipSize = fs.statSync(outputZip).size; } catch { /* ignore */ }
        resolve({
          outputZip,
          zipSize,
          totalRawSize,
          breakdown,
          flashBudgetBytes: FLASH_BUDGET_BYTES,
          flashUsagePercent: Math.round((totalRawSize / FLASH_BUDGET_BYTES) * 100),
          files: collectedFiles,
          fileCount
        });
      });
      zipfile.outputStream.on('error', reject);
      zipfile.outputStream.pipe(output);

      const walk = (dir, prefix) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          const rel = prefix ? path.join(prefix, entry.name) : entry.name;
          if (entry.isDirectory()) {
            walk(full, rel);
          } else {
            fileCount++;
            const stat = fs.statSync(full);
            const cat = categorizeFile(rel);
            breakdown[cat] = (breakdown[cat] || 0) + stat.size;
            totalRawSize += stat.size;
            if (collectBuffers) {
              collectedFiles.push({ relPath: rel.replace(/\\/g, '/'), buffer: fs.readFileSync(full) });
            }
            zipfile.addFile(full, rel);
          }
        }
      };
      walk(sourceDistDir, '');
      if (typeof rscContent === 'string' && rscContent.length > 0) {
        const rscBuf = Buffer.from(rscContent, 'utf8');
        breakdown.rsc += rscBuf.length;
        totalRawSize += rscBuf.length;
        zipfile.addBuffer(rscBuf, 'hotspot-setup.rsc');
      }
      zipfile.end();
    });
  }

  function buildAndZip({ outputZip = path.join(resolvedWorkDir, 'tmp', 'dist.zip'), rscContent = null, collectBuffers = false } = {}) {
    const { build } = require('../../build.js');
    const defaultDistDir = path.join(repoRoot, 'dist');
    build({ distDir: defaultDistDir, throwOnError: true });
    return zipDistDir(defaultDistDir, { outputZip, rscContent, collectBuffers });
  }

  function restore(snap, appliedAssets) {
    if (snap.config === null) fs.rmSync(configFile, { force: true });
    else fs.writeFileSync(configFile, snap.config);
    if (snap.announcements === null) fs.rmSync(announcementsFile, { force: true });
    else fs.writeFileSync(announcementsFile, snap.announcements);
    for (const name of appliedAssets || []) {
      const file = path.join(assetsDir, name);
      if (fs.existsSync(file)) fs.rmSync(file);
    }
    for (const asset of snap.assets) {
      const dest = path.join(assetsDir, asset.rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, asset.buffer);
    }
  }

  let chain = Promise.resolve();

  const SAFE_DIR = path.join(resolvedWorkDir, 'tmp');
  const MARKER = path.join(SAFE_DIR, 'build-in-progress.marker');
  const GOOD_STATE = path.join(SAFE_DIR, 'last-good-state.json');

  function persistGoodState(snap, appliedAssets) {
    fs.mkdirSync(SAFE_DIR, { recursive: true });
    fs.writeFileSync(GOOD_STATE, JSON.stringify({
      config: snap.config ? snap.config.toString('base64') : null,
      announcements: snap.announcements ? snap.announcements.toString('base64') : null,
      assets: snap.assets.map(a => ({ rel: a.rel, b64: a.buffer.toString('base64') })),
      appliedAssets: appliedAssets || []
    }), 'utf8');
    fs.writeFileSync(MARKER, String(Date.now()));
  }

  function clearMarker() {
    try { fs.rmSync(MARKER, { force: true }); } catch { /* best-effort */ }
  }

  function recoverIfInterrupted() {
    if (!fs.existsSync(MARKER)) return false;
    let snap;
    try {
      const saved = JSON.parse(fs.readFileSync(GOOD_STATE, 'utf8'));
      snap = {
        config: saved.config ? Buffer.from(saved.config, 'base64') : null,
        announcements: saved.announcements ? Buffer.from(saved.announcements, 'base64') : null,
        assets: (saved.assets || []).map(a => ({ rel: a.rel, buffer: Buffer.from(a.b64, 'base64') })),
        appliedAssets: saved.appliedAssets || []
      };
    } catch {
      clearMarker();
      throw new Error('interrupted build found but its backup is unreadable — check config.json / src/assets manually');
    }
    restore(snap, snap.appliedAssets);
    clearMarker();
    return true;
  }

  function makeStageDir() {
    const base = path.join(resolvedWorkDir, 'staging');
    try {
      fs.mkdirSync(base, { recursive: true });
      return fs.mkdtempSync(path.join(base, 'job-'));
    } catch {
      return fs.mkdtempSync(path.join(os.tmpdir(), 'meganet-stage-'));
    }
  }

  function runBuildCycle(profile, zipPath, options = {}) {
    const job = chain.then(async () => {
      checkProfileShape(profile);
      const stageDir = makeStageDir();
      const stageConfig = path.join(stageDir, 'config.json');
      const stageAnnouncements = path.join(stageDir, 'announcements.json');
      const stageAssets = path.join(stageDir, 'assets');
      const stageDist = path.join(stageDir, 'dist');

      try {
        try { fs.rmSync(zipPath, { force: true }); } catch { /* best-effort */ }

        applyProfileToDir(profile, stageAssets, stageConfig, stageAnnouncements);

        const rscContent = generateRscScript(profile.config, {
          profileName: options.profileName || (profile.id ? `${profile.id}-hs-profile` : 'meganet-hs-profile'),
          htmlDir: options.htmlDir || 'hotspot',
          dnsName: options.dnsName || 'login.meganet.local',
          dhcpServer: options.dhcpServer || '',
          extraHosts: options.extraHosts || [],
          capportMode: options.capportMode || 'https'
        });

        const { build } = require('../../build.js');
        build({
          configPath: stageConfig,
          customPresetsPath: options.customPresetsPath || path.join(resolvedWorkDir, 'custom-presets.json'),
          announcementsPath: stageAnnouncements,
          assetsDir: stageAssets,
          distDir: stageDist,
          throwOnError: true
        });

        if (options.previewDistDir) {
          fs.rmSync(options.previewDistDir, { recursive: true, force: true });
          fs.cpSync(stageDist, options.previewDistDir, { recursive: true, force: true });
        }

        const built = await zipDistDir(stageDist, {
          outputZip: zipPath,
          rscContent,
          collectBuffers: Boolean(options.collectBuffers)
        });

        return {
          zipPath: built.outputZip,
          distFiles: built.fileCount,
          zipSize: built.zipSize,
          totalRawSize: built.totalRawSize,
          breakdown: built.breakdown,
          flashBudgetBytes: built.flashBudgetBytes,
          flashUsagePercent: built.flashUsagePercent,
          overBudget: built.totalRawSize > FLASH_BUDGET_BYTES,
          rscContent,
          files: built.files
        };
      } finally {
        try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch { /* best-effort */ }
      }
    });
    chain = job.catch(() => {});
    return job;
  }

  return { snapshot, applyProfile, buildAndZip, restore, runBuildCycle, recoverIfInterrupted, persistGoodState, repoRoot };
}

module.exports = { createWorkspace, REPO_ROOT, FLASH_BUDGET_BYTES };
