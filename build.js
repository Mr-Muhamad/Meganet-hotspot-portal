const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier');
const CleanCSS = require('clean-css');
const UglifyJS = require('uglify-js');
const nunjucks = require('nunjucks');
const { deriveThemeTokens } = require('./scripts/color-utils.js');
const { resolveEffectiveConfig } = require('./scripts/presets.js');
const { sanitizeSvg } = require('./scripts/svg-utils.js');

// Custom (admin-saved) presets live in .admin/custom-presets.json (or ADMIN_DATA_DIR)
function loadCustomPresetsForBuild(customPresetsPath) {
  try {
    const p = customPresetsPath || path.join(__dirname, '.admin', 'custom-presets.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.warn('⚠ Could not read custom-presets.json:', err.message);
  }
  return null;
}

// Unified configuration loader: reads config.json (or config.example.json) and
// resolves effective theme and i18n settings via presets consistently.
function loadConfig(options = {}) {
  const configPath = options.configPath || path.join(__dirname, 'config.json');
  const configExamplePath = path.join(__dirname, 'config.example.json');
  let raw = {};
  try {
    if (fs.existsSync(configPath)) {
      raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else if (fs.existsSync(configExamplePath)) {
      raw = JSON.parse(fs.readFileSync(configExamplePath, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading config:', err.message);
  }
  return resolveEffectiveConfig(raw, loadCustomPresetsForBuild(options.customPresetsPath));
}

// Configure Nunjucks
const templatesDir = path.join(__dirname, 'src', 'templates');
const nunjucksEnv = nunjucks.configure(templatesDir, {
  autoescape: false,
  trimBlocks: true,
  lstripBlocks: true,
  noCache: true
});

nunjucksEnv.addFilter('scriptjson', value => JSON.stringify(value).replace(/</g, '\\u003c'));

// Read translations
function loadTranslations(lang) {
  const enPath = path.join(__dirname, 'src', 'i18n', 'en.json');
  const langPath = path.join(__dirname, 'src', 'i18n', `${lang}.json`);

  let result = {};

  if (fs.existsSync(enPath)) {
    const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    result = { ...result, ...enData };
  }

  if (fs.existsSync(langPath) && lang !== 'en') {
    const langData = JSON.parse(fs.readFileSync(langPath, 'utf8'));
    result = { ...result, ...langData };
  }

  return result;
}

function applyI18nOverrides(allTranslations, overrides) {
  if (!overrides || typeof overrides !== 'object') return allTranslations;
  const merged = JSON.parse(JSON.stringify(allTranslations));
  for (const [key, value] of Object.entries(overrides)) {
    if (key.startsWith('_')) continue;
    const pair = value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : { en: value, ar: value };
    for (const lang of ['en', 'ar']) {
      if (merged[lang] && Object.prototype.hasOwnProperty.call(merged[lang], key) && pair[lang] !== undefined) {
        merged[lang][key] = pair[lang];
      }
    }
  }
  return merged;
}

function buildDynamicThemeCSS(resolvedConfig) {
  if (!resolvedConfig || typeof resolvedConfig !== 'object') return { shared: '', dark: '' };
  const theme = resolvedConfig.theme || {};
  const tokens = deriveThemeTokens(theme.primaryColor, theme.backgroundColor);
  const sharedRules = [];
  const darkRules = [];
  if (theme.cardRadius !== undefined && theme.cardRadius !== null && theme.cardRadius !== '') {
    const r = Number(theme.cardRadius);
    if (Number.isFinite(r) && r >= 0) {
      sharedRules.push(`--radius-md:${r}px`);
      sharedRules.push(`--radius-sm:${Math.max(0, r - 4)}px`);
      sharedRules.push(`--radius-lg:${r + 4}px`);
      sharedRules.push(`--radius-xl:${r + 12}px`);
    }
  }
  if (tokens) {
    if (theme.primaryColor) {
      darkRules.push(`--color-primary:${theme.primaryColor}`);
      darkRules.push(`--color-primary-hover:${tokens.primaryHover}`);
      darkRules.push(`--color-primary-bright:${tokens.primaryBright}`);
      darkRules.push(`--color-primary-bg:${tokens.primaryBg}`);
      darkRules.push(`--color-primary-alpha-03:${tokens.primaryAlpha03}`);
      darkRules.push(`--color-primary-alpha-05:${tokens.primaryAlpha05}`);
      darkRules.push(`--color-primary-alpha-10:${tokens.primaryAlpha10}`);
      darkRules.push(`--color-primary-alpha-15:${tokens.primaryAlpha15}`);
      darkRules.push(`--color-primary-alpha-20:${tokens.primaryAlpha20}`);
      darkRules.push(`--color-primary-alpha-30:${tokens.primaryAlpha30}`);
      darkRules.push(`--color-primary-alpha-40:${tokens.primaryAlpha40}`);
      darkRules.push(`--color-primary-alpha-50:${tokens.primaryAlpha50}`);
      darkRules.push(`--color-primary-alpha-60:${tokens.primaryAlpha60}`);
      darkRules.push(`--shadow-glow:0 0 20px ${tokens.primaryAlpha30}`);
    }
    if (theme.backgroundColor) {
      darkRules.push(`--color-bg:${theme.backgroundColor}`);
      darkRules.push(`--color-bg-deep:${tokens.bgDeep}`);
    }
  }
  const shared = sharedRules.length ? `:root{${sharedRules.join(';')}}\n` : '';
  const dark = darkRules.length
    ? `:root{${darkRules.join(';')}}\n`
    : '';
  const darkAfter = darkRules.length
    ? `[data-theme="dark"]{${darkRules.join(';')}}\n`
    : '';
  return { shared: shared + dark, dark: darkAfter };
}

// Build CSS from separate files
function buildCSS(shouldMinify = false, resolvedConfig = null) {
  const dynamicTheme = buildDynamicThemeCSS(resolvedConfig);
  let combinedCSS = '';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'variables.css'), 'utf8') + '\n';
  combinedCSS += dynamicTheme.shared;
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'theme.css'), 'utf8') + '\n';
  combinedCSS += dynamicTheme.dark;
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'reset.css'), 'utf8') + '\n';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'layout.css'), 'utf8') + '\n';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'components.css'), 'utf8') + '\n';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'utilities.css'), 'utf8') + '\n';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'media.css'), 'utf8') + '\n';

  if (shouldMinify) {
    const res = new CleanCSS({ level: 1 }).minify(combinedCSS);
    if (res && res.styles && (!res.errors || res.errors.length === 0)) {
      return res.styles;
    }
  }
  return combinedCSS;
}

const pageKeyCache = new Map();

function collectPageTranslationKeys(page) {
  if (pageKeyCache.has(page)) {
    return pageKeyCache.get(page);
  }
  const keys = new Set([`${page}_title`]);
  const filesToScan = [
    path.join(templatesDir, 'base.html'),
    path.join(templatesDir, `${page}.html`),
    path.join(__dirname, 'src', 'js', 'modules', 'util.js'),
    path.join(__dirname, 'src', 'js', 'modules', 'i18n.js'),
    path.join(__dirname, 'src', 'js', 'modules', 'rate-limiter.js'),
    path.join(__dirname, 'src', 'js', 'modules', 'ui.js')
  ];
  if (page === 'login') {
    filesToScan.push(
      path.join(__dirname, 'src', 'js', 'modules', 'auth.js'),
      path.join(__dirname, 'src', 'js', 'modules', 'qr-scanner.js')
    );
  }
  if (page === 'status') {
    filesToScan.push(path.join(__dirname, 'src', 'js', 'modules', 'status.js'));
  }

  for (const filePath of filesToScan) {
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, 'utf8');
    let m;
    const attrRe = /data-i18n(?:-[a-z]+)?=["']([^"']+)["']/g;
    while ((m = attrRe.exec(text)) !== null) {
      if (!m[1].includes('{{')) keys.add(m[1]);
    }
    const tplRe = /\{\{\s*i18n\.([a-zA-Z0-9_]+)/g;
    while ((m = tplRe.exec(text)) !== null) {
      keys.add(m[1]);
    }
    const callRe = /i18n\.t\(([^\n;]+)/g;
    while ((m = callRe.exec(text)) !== null) {
      const strRe = /['"]([a-zA-Z0-9_]+)['"]/g;
      let sm;
      while ((sm = strRe.exec(m[1])) !== null) {
        keys.add(sm[1]);
      }
    }
  }
  pageKeyCache.set(page, keys);
  return keys;
}

function filterTranslationsForPage(allTranslations, page) {
  const keys = collectPageTranslationKeys(page);
  const filtered = {};
  for (const langCode of Object.keys(allTranslations || {})) {
    const dict = allTranslations[langCode];
    if (!dict || typeof dict !== 'object') continue;
    const subset = {};
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(dict, k)) {
        subset[k] = dict[k];
      }
    }
    filtered[langCode] = subset;
  }
  return filtered;
}

function readPngDimensions(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length >= 24 && buf.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) return `${width}x${height}`;
    }
  } catch { /* fall through */ }
  return null;
}

function readJsModules(modulesDir, names) {
  let code = '';
  for (const name of names) {
    const modulePath = path.join(modulesDir, `${name}.js`);
    if (fs.existsSync(modulePath)) {
      code += fs.readFileSync(modulePath, 'utf8') + '\n';
    }
  }
  return code;
}

function minifyJsSafe(code, shouldMinify) {
  if (!shouldMinify) return code;
  const res = UglifyJS.minify(code);
  if (res && !res.error && typeof res.code === 'string') {
    return res.code;
  }
  return code;
}

// Build external shared JS bundles so CSS/JS are not duplicated across all 14 HTML files
function emitSharedAssets(distDir, shouldMinify, resolvedConfig = null) {
  const modulesDir = path.join(__dirname, 'src', 'js', 'modules');

  const css = buildCSS(shouldMinify, resolvedConfig);
  fs.writeFileSync(path.join(distDir, 'portal.css'), css, 'utf8');

  const coreJsRaw =
    readJsModules(modulesDir, ['util', 'i18n', 'rate-limiter', 'ui']) +
    '\nwindow.Hotspot = { util: util, ui: ui, i18n: i18n };\n';
  fs.writeFileSync(path.join(distDir, 'portal-core.js'), minifyJsSafe(coreJsRaw, shouldMinify), 'utf8');

  const loginJsRaw =
    readJsModules(modulesDir, ['auth', 'qr-scanner']) +
    '\nwindow.Hotspot = window.Hotspot || {};\nwindow.Hotspot.auth = auth;\nwindow.Hotspot.qrScanner = qrScanner;\n';
  fs.writeFileSync(path.join(distDir, 'portal-login.js'), minifyJsSafe(loginJsRaw, shouldMinify), 'utf8');

  const statusJsRaw =
    readJsModules(modulesDir, ['status']) +
    '\nwindow.Hotspot = window.Hotspot || {};\nwindow.Hotspot.status = statusModule;\n';
  fs.writeFileSync(path.join(distDir, 'portal-status.js'), minifyJsSafe(statusJsRaw, shouldMinify), 'utf8');
}

// Read SVG and make it inline-safe (sanitize + SVGO optimize, cached per build)
function inlineSVG(filePath, cache = null) {
  try {
    const stat = fs.statSync(filePath);
    const cacheKey = `${filePath}:${stat.mtimeMs}:${stat.size}`;
    if (cache && cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const idPrefix = path.basename(filePath, '.svg').replace(/[^a-zA-Z0-9_-]/g, '') || 'svg';
    const sanitized = sanitizeSvg(raw, { idPrefix });
    if (cache) cache.set(cacheKey, sanitized);
    return sanitized;
  } catch {
    return '';
  }
}

// Generate page HTML
function generatePage(page, lang, options = {}) {
  try {
    const config = options.resolvedConfig || loadConfig(options);
    const assetsDir = options.assetsDir || path.join(__dirname, 'src', 'assets');
    const svgCache = options.svgCache || null;

    const allTranslations = applyI18nOverrides(loadTranslations(lang) || {}, config.i18nOverrides);
    const i18n = allTranslations[lang] || allTranslations.en || {};
    const pageTranslations = filterTranslationsForPage(allTranslations, page);
    const pageTranslationsJson = JSON.stringify(pageTranslations).replace(/<\//g, '<\\/');

    const theme = config.theme || {};
    const themeTokens = deriveThemeTokens(theme.primaryColor, theme.backgroundColor);

    const logoInline = inlineSVG(path.join(assetsDir, 'logo.svg'), svgCache);
    const prandTitleInline = inlineSVG(path.join(assetsDir, 'prand-title.svg'), svgCache);

    let html = nunjucks.render(`${page}.html`, {
      page: page,
      i18n: i18n,
      allTranslations: allTranslations,
      pageTranslationsJson: pageTranslationsJson,
      lang: lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      minify: options.minify !== false,
      logoInline: logoInline,
      prandTitleInline: prandTitleInline,
      config: config,
      themeTokens: themeTokens
    });

    if (options.minify !== false) {
      html = minify(html, {
        removeAttributeQuotes: false,
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
        keepClosingSlash: true,
        caseSensitive: true
      });
    }

    return html;
  } catch (error) {
    console.error(`Error generating ${page} page (${lang}):`, error);
    throw error;
  }
}

function copyStaticPages(distDir, config) {
  const staticDir = path.join(__dirname, 'src', 'static');
  if (!fs.existsSync(staticDir)) return;
  const skipQr = config && config.features && config.features.enableQRScanner === false;

  const walk = (dir, relPath) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const srcPath = path.join(dir, entry.name);
      const rel = relPath ? path.join(relPath, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(srcPath, rel);
      } else {
        if (skipQr && rel.replace(/\\/g, '/') === 'jsQR.js') {
          return;
        }
        const destPath = path.join(distDir, rel);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        console.log(`✓ Copied static ${rel}`);
      }
    });
  };
  walk(staticDir, '');
}

// Copy static assets (optimizing & sanitizing SVGs)
function copyAssets(options = {}) {
  const assetsSource = options.assetsDir || path.join(__dirname, 'src', 'assets');
  const distDir = options.distDir || path.join(__dirname, 'dist');
  const assetsDest = path.join(distDir, 'assets');

  if (fs.existsSync(assetsSource)) {
    fs.rmSync(assetsDest, { recursive: true, force: true });
    fs.mkdirSync(assetsDest, { recursive: true });

    const copyDir = (srcDir, dstDir) => {
      fs.mkdirSync(dstDir, { recursive: true });
      for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(dstDir, entry.name);
        if (entry.isDirectory()) {
          copyDir(srcPath, destPath);
        } else if (path.extname(entry.name).toLowerCase() === '.svg') {
          try {
            const safeSvg = sanitizeSvg(fs.readFileSync(srcPath, 'utf8'));
            fs.writeFileSync(destPath, safeSvg, 'utf8');
          } catch {
            fs.copyFileSync(srcPath, destPath);
          }
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };

    copyDir(assetsSource, assetsDest);
    console.log('✓ Copied assets');
  }

  const md5Source = path.join(__dirname, 'md5.js');
  const md5Dest = path.join(distDir, 'md5.js');
  if (fs.existsSync(md5Source)) {
    fs.mkdirSync(path.dirname(md5Dest), { recursive: true });
    fs.copyFileSync(md5Source, md5Dest);
    console.log('✓ Copied md5.js');
  }
}

// Main build function
function build(options = {}) {
  console.log('🔨 Building MikroTik Hotspot Portal...\n');
  pageKeyCache.clear();

  const configPath = options.configPath || path.join(__dirname, 'config.json');
  const assetsDir = options.assetsDir || path.join(__dirname, 'src', 'assets');
  const announcementsSource = options.announcementsPath || path.join(__dirname, 'src', 'announcements.json');
  const distDir = options.distDir || path.join(__dirname, 'dist');
  const shouldMinify = options.minify !== false;

  const { validateConfigFile } = require('./scripts/validate-config.js');
  const { errors: configErrors } = validateConfigFile(configPath, assetsDir);
  if (configErrors.length) {
    console.error(`✖ config.json failed validation (${configErrors.length} error${configErrors.length === 1 ? '' : 's'}):`);
    configErrors.forEach(e => console.error(`  - ${e}`));
    console.error('Run "npm run validate:config" for details. Aborting build.');
    process.exitCode = 1;
    if (options.throwOnError) {
      throw new Error(`config validation failed: ${configErrors.join('; ')}`);
    }
    return;
  }

  if (options.clean !== false && fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  const resolvedConfig = loadConfig(options);
  const svgCache = new Map();
  const pageOptions = { ...options, resolvedConfig, assetsDir, svgCache };

  emitSharedAssets(distDir, shouldMinify, resolvedConfig);

  console.log('📄 Building English pages...');
  const buildErrors = [];
  ['index', 'login', 'status', 'logout', 'error', 'expired', 'plans', 'alogin'].forEach(page => {
    try {
      const html = generatePage(page, 'en', pageOptions);
      const outputPath = path.join(distDir, `${page}.html`);
      fs.writeFileSync(outputPath, html);
      console.log(`  ✓ ${page}.html`);
    } catch (error) {
      console.error(`  ✗ Error building ${page}.html:`, error);
      buildErrors.push(`${page}.html (en)`);
    }
  });

  console.log('\n📄 Building Arabic pages...');
  const arDir = path.join(distDir, 'ar');
  fs.mkdirSync(arDir, { recursive: true });

  ['index', 'login', 'status', 'logout', 'error', 'expired', 'plans', 'alogin'].forEach(page => {
    try {
      const html = generatePage(page, 'ar', pageOptions);
      const outputPath = path.join(arDir, `${page}.html`);
      fs.writeFileSync(outputPath, html);
      console.log(`  ✓ ar/${page}.html`);
    } catch (error) {
      console.error(`  ✗ Error building ar/${page}.html:`, error);
      buildErrors.push(`${page}.html (ar)`);
    }
  });

  if (buildErrors.length) {
    const msg = 'build failed for pages: ' + buildErrors.join(', ');
    console.error('✖ ' + msg);
    throw new Error(msg);
  }

  const apiSource = path.join(__dirname, 'api.json');
  const apiDest = path.join(distDir, 'api.json');
  if (fs.existsSync(apiSource)) {
    let apiContent = fs.readFileSync(apiSource, 'utf8');
    if (resolvedConfig.general && resolvedConfig.general.poweredByUrl) {
      apiContent = apiContent.replace(
        /"venue-info-url":\s*""/,
        `"venue-info-url": ${JSON.stringify(resolvedConfig.general.poweredByUrl)}`
      );
    }
    fs.writeFileSync(apiDest, apiContent, 'utf8');
    console.log('\n✓ Copied api.json');
  }

  const announcementsDest = path.join(distDir, 'announcements.json');
  if (fs.existsSync(announcementsSource)) {
    fs.copyFileSync(announcementsSource, announcementsDest);
    console.log('✓ Copied announcements.json');
  }

  const manifestSource = path.join(__dirname, 'src', 'manifest.json');
  const manifestDest = path.join(distDir, 'manifest.json');
  if (fs.existsSync(manifestSource)) {
    const manifest = JSON.parse(fs.readFileSync(manifestSource, 'utf8'));
    const general = resolvedConfig.general || {};
    const theme = resolvedConfig.theme || {};
    if (general.networkName) {
      manifest.name = general.networkName;
      manifest.short_name = String(general.networkName).slice(0, 20);
    }
    manifest.start_url = './index.html';
    if (theme.backgroundColor) {
      manifest.background_color = theme.backgroundColor;
      manifest.theme_color = theme.backgroundColor;
    }
    const iconDims = readPngDimensions(path.join(assetsDir, 'icon.png'));
    if (iconDims && Array.isArray(manifest.icons) && manifest.icons[0]) {
      manifest.icons[0].sizes = iconDims;
    }
    fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2) + '\n');
    console.log('✓ Copied manifest.json (profile name, icon dimensions, and theme colors from config)');
  }

  copyAssets({ assetsDir, distDir });
  copyStaticPages(distDir, resolvedConfig);

  console.log('\n✨ Build complete!\n');
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    dev: args.includes('--dev'),
    minify: !args.includes('--dev'),
    watch: args.includes('--watch')
  };

  if (options.dev) {
    console.log('🔧 Development mode (no minification)\n');
  }

  build(options);

  if (options.watch) {
    console.log('👀 Watching for changes...\n');
    const chokidar = require('chokidar');
    const watcher = chokidar.watch('src/**/*', {
      ignored: /node_modules/,
      persistent: true
    });

    watcher.on('change', () => {
      console.log('\n📝 Files changed, rebuilding...\n');
      build(options);
    });
  }
}

module.exports = { build, generatePage, applyI18nOverrides, buildCSS };
