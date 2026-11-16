#!/usr/bin/env node
/**
 * package-portal.js — builds the hotspot portal into dist/ and packages it
 * as a versioned + build-numbered zip in dist-release/ ready for MikroTik.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yazl = require('yazl');
const { build } = require('../build.js');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const RELEASE_DIR = path.join(ROOT_DIR, 'dist-release');

function resolveBuildNumber() {
  const fromEnv = process.env.BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim();
  }
  try {
    return execSync('git rev-list --count HEAD', { cwd: ROOT_DIR, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '1';
  }
}

function addDirectoryToZip(zipfile, dirPath, baseDir) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      addDirectoryToZip(zipfile, fullPath, baseDir);
    } else if (entry.isFile()) {
      zipfile.addFile(fullPath, relPath);
    }
  }
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  const version = pkg.version || '0.0.0';
  const buildNumber = resolveBuildNumber();

  build({ minify: true });
  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  const zipName = `Meganet-Hotspot-Portal-v${version}-build.${buildNumber}.zip`;
  const zipPath = path.join(RELEASE_DIR, zipName);
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  await new Promise((resolve, reject) => {
    const zipfile = new yazl.ZipFile();
    addDirectoryToZip(zipfile, DIST_DIR, DIST_DIR);
    const outStream = fs.createWriteStream(zipPath);
    zipfile.outputStream.pipe(outStream);
    outStream.on('close', resolve);
    outStream.on('error', reject);
    zipfile.end();
  });

  const stats = fs.statSync(zipPath);
  console.log(`\n📦 Portal package ready: ${zipName} (${stats.size} bytes)`);
  console.log(`   Version: v${version} | Build: ${buildNumber}`);
}

main().catch(err => {
  console.error('✖ Failed to package portal:', err);
  process.exit(1);
});
