/**
 * Integration test for the admin build pipeline (admin/lib/workspace.js):
 * a profile build must produce a dist zip AND restore the repo workspace
 * byte-identical (config.json + announcements + src/assets).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createWorkspace, REPO_ROOT } = require('../../admin/lib/workspace.js');

const REPO = REPO_ROOT;
const CONFIG_FILE = path.join(REPO, 'config.json');
const ANNOUNCEMENTS_FILE = path.join(REPO, 'src', 'announcements.json');

function fileBytes(p) {
  return fs.existsSync(p) ? fs.readFileSync(p).toString('utf8') : null;
}

describe('admin build pipeline', () => {
  let tmp;
  let workspace;

  // building the portal (~2-4s) plus zip/restore needs more than the 5s default
  jest.setTimeout(60000);

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'meganet-ws-'));
    workspace = createWorkspace({ repoRoot: REPO });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('builds a profile into a zip and restores the workspace byte-identical', async () => {
    const configBefore = fileBytes(CONFIG_FILE);
    const announcementsBefore = fileBytes(ANNOUNCEMENTS_FILE);
    const assetsBefore = {};
    const assetsDir = path.join(REPO, 'src', 'assets');
    for (const f of fs.readdirSync(assetsDir)) {
      assetsBefore[f] = fileBytes(path.join(assetsDir, f));
    }

    // a profile that changes the network name + uploads a brand logo
    const profileConfig = JSON.parse(configBefore);
    profileConfig.general.networkName = 'بوابة اختبار';
    profileConfig.theme.preset = 'cafe';

    const profileDir = path.join(tmp, 'profile');
    fs.mkdirSync(path.join(profileDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(profileDir, 'config.json'), JSON.stringify(profileConfig, null, 2) + '\n');
    fs.writeFileSync(path.join(profileDir, 'assets', 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    fs.writeFileSync(path.join(profileDir, 'announcements.json'), JSON.stringify({ active: true, type: 'promo', message_en: ['t'], message_ar: ['ت'] }));

    const profile = {
      config: profileConfig,
      announcements: { active: true, type: 'promo', message_en: ['t'], message_ar: ['ت'] },
      assets: [{ name: 'logo.svg' }],
      dir: profileDir
    };

    const zipPath = path.join(tmp, 'out.zip');
    const result = await workspace.runBuildCycle(profile, zipPath);

    expect(result.zipPath).toBe(zipPath);
    expect(fs.existsSync(zipPath)).toBe(true);
    expect(fs.statSync(zipPath).size).toBeGreaterThan(1000);
    expect(result.distFiles).toBeGreaterThan(10);

    // --- restoration checks ---
    expect(fileBytes(CONFIG_FILE)).toBe(configBefore);
    expect(fileBytes(ANNOUNCEMENTS_FILE)).toBe(announcementsBefore);
    for (const [f, bytes] of Object.entries(assetsBefore)) {
      expect(fileBytes(path.join(assetsDir, f))).toBe(bytes);
    }
    // the profile's uploaded logo must NOT linger in the repo assets
    expect(fs.existsSync(path.join(assetsDir, 'logo.svg'))).toBe(true); // default logo exists anyway
    const uploaded = fs.readFileSync(path.join(assetsDir, 'logo.svg'), 'utf8');
    expect(uploaded).not.toBe('<svg xmlns="http://www.w3.org/2000/svg"/>'); // restored to the REAL logo
  });

  test('an empty profile without assets leaves assets untouched', async () => {
    const assetsDir = path.join(REPO, 'src', 'assets');
    const before = fs.readdirSync(assetsDir).sort();
    const configBefore = fileBytes(CONFIG_FILE);

    const profile = {
      config: JSON.parse(configBefore),
      announcements: null,
      assets: [],
      dir: path.join(tmp, 'empty')
    };
    fs.mkdirSync(profile.dir, { recursive: true });
    await workspace.runBuildCycle(profile, path.join(tmp, 'e.zip'));

    expect(fs.readdirSync(assetsDir).sort()).toEqual(before);
    expect(fileBytes(CONFIG_FILE)).toBe(configBefore);
  });

  test('preview build mode (skipZip + minify:false) populates previewDistDir without creating a zip', async () => {
    const profileDir = path.join(tmp, 'preview-profile');
    fs.mkdirSync(profileDir, { recursive: true });
    const previewDistDir = path.join(tmp, 'preview-dist');
    const skippedZip = path.join(tmp, 'should-not-exist.zip');
    const cfg = JSON.parse(fileBytes(CONFIG_FILE));

    const result = await workspace.runBuildCycle(
      { config: cfg, announcements: null, assets: [], dir: profileDir },
      skippedZip,
      { previewDistDir, skipZip: true, minify: false }
    );

    expect(result.zipPath).toBeNull();
    expect(result.zipSize).toBe(0);
    expect(fs.existsSync(skippedZip)).toBe(false);
    expect(fs.existsSync(path.join(previewDistDir, 'ar', 'login.html'))).toBe(true);
    expect(fs.existsSync(path.join(previewDistDir, 'login.html'))).toBe(true);
    // Inline-only SVG (prand-title.svg) and unreferenced agent images should not bloat dist/assets
    expect(fs.existsSync(path.join(previewDistDir, 'assets', 'prand-title.svg'))).toBe(false);
    expect(fs.existsSync(path.join(previewDistDir, 'assets', 'logo.svg'))).toBe(true);
    expect(fs.existsSync(path.join(previewDistDir, 'assets', 'icon.png'))).toBe(true);
  });
});
