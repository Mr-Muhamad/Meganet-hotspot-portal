#!/usr/bin/env node
/**
 * build-studio.js — builds Meganet Hotspot Studio (Windows Setup + Portable)
 * with an explicit build number embedded in metadata and installer filenames.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');

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

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  const version = pkg.version || '0.0.0';
  const buildNumber = resolveBuildNumber();

  console.log(`🏗 Building Meganet Hotspot Studio v${version} (Build ${buildNumber})...\n`);

  const args = [
    'electron-builder',
    '--win',
    `-c.extraMetadata.buildNumber=${buildNumber}`,
    `-c.portable.artifactName=\${productName}-Portable-\${version}-build.${buildNumber}.\${ext}`,
    `-c.nsis.artifactName=\${productName}-Setup-\${version}-build.${buildNumber}.\${ext}`
  ];

  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npxCmd, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  console.log(`\n✨ Studio build complete: v${version} (Build ${buildNumber})`);
}

main();
