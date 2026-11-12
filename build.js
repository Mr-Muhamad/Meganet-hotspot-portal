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

// Build CSS from separate files
function buildCSS(shouldMinify = false) {
  let combinedCSS = '';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'variables.css'), 'utf8') + '\n';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'theme.css'), 'utf8') + '\n';
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
function emitSharedAssets(distDir, shouldMinify) {
  const modulesDir = path.join(__dirname, 'src', 'js', 'modules');

  const css = buildCSS(shouldMinify);
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

// Read SVG and make it inline-safe (sanitize + SVGO optimize)
function inlineSVG(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return sanitizeSvg(raw);
  } catch {
    return '';
  }
}

// Generate page HTML
function generatePage(page, lang, options = {}) {
  try {
    const config = options.resolvedConfig || loadConfig(options);
    const assetsDir = options.assetsDir || path.join(__dirname, 'src', 'assets');

    const allTranslations = applyI18nOverrides(loadTranslations(lang) || {}, config.i18nOverrides);
    const i18n = allTranslations[lang] || allTranslations.en || {};
    const allTranslationsJson = JSON.stringify(allTranslations).replace(/<\//g, '<\\/');

    const theme = config.theme || {};
    const themeTokens = deriveThemeTokens(theme.primaryColor, theme.backgroundColor);

    const logoInline = inlineSVG(path.join(assetsDir, 'logo.svg'));
    const prandTitleInline = inlineSVG(path.join(assetsDir, 'prand-title.svg'));

    let html = nunjucks.render(`${page}.html`, {
      page: page,
      i18n: i18n,
      allTranslations: allTranslations,
      allTranslationsJson: allTranslationsJson,
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
  const pageOptions = { ...options, resolvedConfig, assetsDir };

  emitSharedAssets(distDir, shouldMinify);

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
    const theme = resolvedConfig.theme || {};
    if (theme.backgroundColor) {
      manifest.background_color = theme.backgroundColor;
      manifest.theme_color = theme.backgroundColor;
    }
    fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2) + '\n');
    console.log('✓ Copied manifest.json' + (theme.backgroundColor ? ' (theme colors from config)' : ''));
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
