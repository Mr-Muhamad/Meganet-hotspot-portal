/**
 * workspace.js — the build pipeline behind the admin portal generator.
 *
 * A profile lives isolated in `.admin/profiles/<slug>/`. To build it, the
 * workspace (repo root) is temporarily switched to that profile:
 *
 *   1. stash()   — snapshot config.json, announcements.json and src/assets
 *   2. applyProfile(profile) — write the profile's config/announcements and
 *                  copy its client-only assets into src/assets
 *   3. buildAndZip() — run the REAL build (build.js) and zip dist/
 *   4. restore(snapshot) — put every stashed byte back EXACTLY and remove
 *                  the assets the profile introduced
 *
 * The shipped (green) workspace is therefore always restored byte-identical
 * after a build — same pattern as the demo rounds.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ZipFile } = require('yazl'); // CommonJS zip writer

const REPO_ROOT = path.join(__dirname, '..', '..');

function createWorkspace({ repoRoot = REPO_ROOT } = {}) {
  const assetsDir = path.join(repoRoot, 'src', 'assets');
  const configFile = path.join(repoRoot, 'config.json');
  const announcementsFile = path.join(repoRoot, 'src', 'announcements.json');
  const distDir = path.join(repoRoot, 'dist');

  function readBuffer(file) {
    return fs.existsSync(file) ? fs.readFileSync(file) : null;
  }

  // Containment guard: resolve a repo-relative path and require the result to
  // stay inside the base directory (defense-in-depth even for internal paths).
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

  function applyProfile(profile) {
    checkProfileShape(profile);
    // config.json
    fs.writeFileSync(configFile, JSON.stringify(profile.config, null, 2) + '\n', 'utf8');
    // announcements.json (optional)
    if (profile.announcements !== null && profile.announcements !== undefined) {
      fs.writeFileSync(announcementsFile, JSON.stringify(profile.announcements, null, 2) + '\n', 'utf8');
    }
    // client assets (only the ones the profile provides)
    const applied = [];
    if (profile.assets && profile.assets.length) {
      fs.mkdirSync(assetsDir, { recursive: true });
      const profileAssetsDir = path.join(profile.dir, 'assets');
      for (const asset of profile.assets) {
        // basename whitelist: only a plain filename (no separators, no dot
        // prefix) may land in src/assets
        const safe = path.basename(asset.name);
        if (safe !== asset.name || safe.startsWith('.') || !safe) continue;
        const src = inside(profile.dir, path.join('assets', safe));
        const dest = inside(repoRoot, path.join('src', 'assets', safe));
        if (!src || !dest) continue; // containment guard
        fs.copyFileSync(src, dest);
        applied.push(safe);
      }
    }
    return applied;
  }

  function buildAndZip({ outputZip = path.join(repoRoot, '.admin', 'tmp', 'dist.zip') } = {}) {
    // Literal require — the build module is a fixed part of the repo, never
    // derived from input (and no shell is ever invoked anywhere in this file).
    const { build } = require('../../build.js');
    build(); // writes dist/
    if (!fs.existsSync(distDir)) throw new Error('build did not produce dist/');
    fs.mkdirSync(path.dirname(outputZip), { recursive: true });
    return new Promise((resolve, reject) => {
      const zipfile = new ZipFile();
      const output = fs.createWriteStream(outputZip);
      output.on('close', () => resolve(outputZip));
      zipfile.outputStream.on('error', reject);
      zipfile.outputStream.pipe(output);
      // recursive add of dist/ contents (preserves subdirectories like ar/)
      const walk = (dir, prefix) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          const rel = prefix ? path.join(prefix, entry.name) : entry.name;
          if (entry.isDirectory()) walk(full, rel);
          else zipfile.addFile(full, rel);
        }
      };
      walk(distDir, '');
      zipfile.end();
    });
  }

  function restore(snap, appliedAssets) {
    if (snap.config === null) fs.rmSync(configFile, { force: true });
    else fs.writeFileSync(configFile, snap.config);
    if (snap.announcements === null) fs.rmSync(announcementsFile, { force: true });
    else fs.writeFileSync(announcementsFile, snap.announcements);
    // remove any assets the profile introduced
    for (const name of appliedAssets || []) {
      const file = path.join(assetsDir, name);
      if (fs.existsSync(file)) fs.rmSync(file);
    }
    // restore every original asset byte
    for (const asset of snap.assets) {
      const dest = path.join(assetsDir, asset.rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, asset.buffer);
    }
  }

  // Serialize build runs — only one profile build at a time.
  let chain = Promise.resolve();

  // ---- crash-safe cycle --------------------------------------------------
  // Before touching the workspace we persist an "in-progress" marker plus a
  // full backup of the factory state. If the process dies between applyProfile
  // and restore (power loss, kill -9), the next server boot restores the
  // factory automatically. Without this, a crash mid-build would leave the
  // shipped Meganet workspace swapped for a client profile.
  const SAFE_DIR = path.join(repoRoot, '.admin', 'tmp');
  const MARKER = path.join(SAFE_DIR, 'build-in-progress.marker');
  const GOOD_STATE = path.join(SAFE_DIR, 'last-good-state.json');

  // The profile's applied-assets list is saved with the factory backup so a
  // crash recovery can remove exactly what the interrupted build introduced
  // (previously restore(snap, []) could leave foreign assets in src/assets).
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
    } catch (err) {
      // backup unreadable: cannot auto-restore, but still clear the marker,
      // so future builds are not blocked forever.
      clearMarker();
      throw new Error('interrupted build found but its backup is unreadable — check config.json / src/assets manually');
    }
    restore(snap, snap.appliedAssets);
    clearMarker();
    return true;
  }

  function runBuildCycle(profile, zipPath) {
    const job = chain.then(async () => {
      const snap = snapshot();
      let applied = [];
      try {
        // apply INSIDE the guarded cycle: if it throws, we can already restore
        // the factory + clear the marker (no dirty workspace till restart)
        applied = applyProfile(profile);
        persistGoodState(snap, applied); // crash-safe marker + factory backup
        // delete any previous zip first — a failed build must never serve a
        // STALE artifact as a success
        try { fs.rmSync(zipPath, { force: true }); } catch { /* best-effort */ }
        const built = await buildAndZip({ outputZip: zipPath });
        return { zipPath: built, distFiles: fs.readdirSync(distDir).length };
      } finally {
        restore(snap, applied);
        clearMarker();
      }
    });
    chain = job.catch(() => {});
    return job;
  }

  return { snapshot, applyProfile, buildAndZip, restore, runBuildCycle, recoverIfInterrupted, repoRoot };
}

module.exports = { createWorkspace, REPO_ROOT };
