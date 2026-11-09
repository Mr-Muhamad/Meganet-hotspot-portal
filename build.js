const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier');
const nunjucks = require('nunjucks');
const { deriveThemeTokens } = require('./scripts/color-utils.js');

// Configure Nunjucks
const templatesDir = path.join(__dirname, 'src', 'templates');
nunjucks.configure(templatesDir, {
  autoescape: false,
  trimBlocks: true,
  lstripBlocks: true
});

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

// Build CSS from separate files
function buildCSS() {
  // One literal read per module — the list is fixed and never user-controlled;
  // fully literal path arguments keep path-traversal scanners quiet.
  let combinedCSS = '';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'variables.css'), 'utf8') + '\n';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'theme.css'), 'utf8') + '\n';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'reset.css'), 'utf8') + '\n';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'layout.css'), 'utf8') + '\n';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'components.css'), 'utf8') + '\n';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'utilities.css'), 'utf8') + '\n';
  combinedCSS += fs.readFileSync(path.join(__dirname, 'src', 'css', 'media.css'), 'utf8') + '\n';

  return combinedCSS;
}

// Build JavaScript from modules
function buildJS(page) {
  const jsDir = path.join(__dirname, 'src', 'js');
  const modulesDir = path.join(jsDir, 'modules');

  // Load config to inject security variables
  let config = {};
  try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading config for JS:', err);
  }

  let js = '';

  const utilPath = path.join(modulesDir, 'util.js');
  if (fs.existsSync(utilPath)) {
    js += fs.readFileSync(utilPath, 'utf8') + '\n';
  }

  const pageModules = {
    'login': ['i18n', 'rate-limiter', 'auth', 'qr-scanner', 'ui'],
    'status': ['i18n', 'rate-limiter', 'status', 'ui'],
    'logout': ['i18n', 'ui'],
    'error': ['i18n', 'ui'],
    'expired': ['i18n', 'ui'],
    'plans': ['i18n', 'ui'],
    'alogin': ['i18n', 'ui']
  };

  if (pageModules[page]) {
    pageModules[page].forEach(module => {
      const modulePath = path.join(modulesDir, `${module}.js`);
      if (fs.existsSync(modulePath)) {
        js += fs.readFileSync(modulePath, 'utf8') + '\n';
      }
    });
  }

  js += "window.Hotspot = { util: util, ui: ui, i18n: i18n };\n";
  if (page === 'status') {
    js += "window.Hotspot.status = statusModule;\n";
  } else if (page === 'login') {
    js += "window.Hotspot.auth = auth;\n";
    js += "window.Hotspot.qrScanner = qrScanner;\n";
    // Inject dynamic config values to rate limiter
    if (config.security) {
      js += `if (rateLimiter) {\n`;
      js += `  rateLimiter.config.maxAttempts = ${config.security.maxAttempts || 5};\n`;
      js += `  rateLimiter.config.blockDurationMs = ${(config.security.blockDurationMinutes || 5) * 60 * 1000};\n`;
      js += `}\n`;
    }
  }

  return js;
}

// Read SVG and make it inline-safe (strip xml tag, keep inner content)
function inlineSVG(filePath) {
  try {
    let svg = fs.readFileSync(filePath, 'utf8');
    svg = svg.replace(/<\?xml[^?]*\?>/g, '');
    svg = svg.replace(/<!--[\s\S]*?-->/g, '');
    svg = svg.trim();
    return svg;
  } catch {
    return '';
  }
}

// Generate page HTML
function generatePage(page, lang, options = {}) {
  try {
    // Load config.json or fallback to config.example.json
    let config = {};
    const configPath = path.join(__dirname, 'config.json');
    const configExamplePath = path.join(__dirname, 'config.example.json');
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else if (fs.existsSync(configExamplePath)) {
      config = JSON.parse(fs.readFileSync(configExamplePath, 'utf8'));
    }

    const css = buildCSS();
    const js = buildJS(page);
    const allTranslations = loadTranslations(lang) || {};
    const i18n = allTranslations[lang] || allTranslations.en || {};

    // White-label brand tokens: derive every tint/glow/glass from the
    // client's primaryColor/backgroundColor at BUILD time (see
    // scripts/color-utils.js) — base.html injects them after the static CSS.
    const theme = config.theme || {};
    const themeTokens = deriveThemeTokens(theme.primaryColor, theme.backgroundColor);

    const logoInline = inlineSVG(path.join(__dirname, 'src', 'assets', 'logo.svg'));
    let prandTitleInline = inlineSVG(path.join(__dirname, 'src', 'assets', 'prand-title.svg'));

    let html = nunjucks.render(`${page}.html`, {
      page: page,
      css: css,
      js: js,
      i18n: i18n,
      allTranslations: allTranslations,
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

// Copy static RouterOS-required pages verbatim (NEVER minified — they contain
// line-sensitive $(if ...) directives and a RouterOS-parsed format).
// Subdirectories are preserved (e.g. src/static/ar/errors.txt → dist/ar/errors.txt)
// so RouterOS language routing (target=ar) finds the localized variants.
function copyStaticPages(distDir) {
  const staticDir = path.join(__dirname, 'src', 'static');
  if (!fs.existsSync(staticDir)) return;

  const walk = (dir, relPath) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const srcPath = path.join(dir, entry.name);
      const rel = relPath ? path.join(relPath, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(srcPath, rel);
      } else {
        const destPath = path.join(distDir, rel);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        console.log(`✓ Copied static ${rel}`);
      }
    });
  };
  walk(staticDir, '');
}

// Copy static assets
function copyAssets() {
  const assetsSource = path.join(__dirname, 'src', 'assets');
  const assetsDest = path.join(__dirname, 'dist', 'assets');

  if (fs.existsSync(assetsSource)) {
    fs.rmSync(assetsDest, { recursive: true, force: true });
    fs.mkdirSync(assetsDest, { recursive: true });
    const entries = fs.readdirSync(assetsSource, { withFileTypes: true });
    entries.forEach(entry => {
      const srcPath = path.join(assetsSource, entry.name);
      const destPath = path.join(assetsDest, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        const nested = fs.readdirSync(srcPath, { withFileTypes: true });
        nested.forEach(nestedEntry => {
          const nestedSrc = path.join(srcPath, nestedEntry.name);
          const nestedDest = path.join(destPath, nestedEntry.name);
          fs.copyFileSync(nestedSrc, nestedDest);
        });
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
    console.log('✓ Copied assets');
  }

  const md5Source = path.join(__dirname, 'md5.js');
  const md5Dest = path.join(__dirname, 'dist', 'md5.js');
  if (fs.existsSync(md5Source)) {
    fs.mkdirSync(path.dirname(md5Dest), { recursive: true });
    fs.copyFileSync(md5Source, md5Dest);
    console.log('✓ Copied md5.js');
  }
}

// Main build function
function build(options = {}) {
  console.log('🔨 Building MikroTik Hotspot Portal...\n');

  // Gate: refuse to emit dist/ on an invalid config.json (typos like a wrong
  // loginMode silently degrade the portal).
  const { validateConfigFile } = require('./scripts/validate-config.js');
  const { errors: configErrors } = validateConfigFile();
  if (configErrors.length) {
    console.error(`✖ config.json failed validation (${configErrors.length} error${configErrors.length === 1 ? '' : 's'}):`);
    configErrors.forEach(e => console.error(`  - ${e}`));
    console.error('Run "npm run validate:config" for details. Aborting build.');
    process.exitCode = 1;
    return;
  }

  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  console.log('📄 Building English pages...');
  ['index', 'login', 'status', 'logout', 'error', 'expired', 'plans', 'alogin'].forEach(page => {
    try {
      const html = generatePage(page, 'en', options);
      const outputPath = path.join(distDir, `${page}.html`);
      fs.writeFileSync(outputPath, html);
      console.log(`  ✓ ${page}.html`);
    } catch (error) {
      console.error(`  ✗ Error building ${page}.html:`, error);
    }
  });

  console.log('\n📄 Building Arabic pages...');
  const arDir = path.join(distDir, 'ar');
  fs.mkdirSync(arDir, { recursive: true });

  ['index', 'login', 'status', 'logout', 'error', 'expired', 'plans', 'alogin'].forEach(page => {
    try {
      const html = generatePage(page, 'ar', options);
      const outputPath = path.join(arDir, `${page}.html`);
      fs.writeFileSync(outputPath, html);
      console.log(`  ✓ ar/${page}.html`);
    } catch (error) {
      console.error(`  ✗ Error building ar/${page}.html:`, error);
    }
  });

  const apiSource = path.join(__dirname, 'api.json');
  const apiDest = path.join(distDir, 'api.json');
  if (fs.existsSync(apiSource)) {
    fs.copyFileSync(apiSource, apiDest);
    console.log('\n✓ Copied api.json');
  }

  const announcementsSource = path.join(__dirname, 'src', 'announcements.json');
  const announcementsDest = path.join(distDir, 'announcements.json');
  if (fs.existsSync(announcementsSource)) {
    fs.copyFileSync(announcementsSource, announcementsDest);
    console.log('✓ Copied announcements.json');
  }

  const manifestSource = path.join(__dirname, 'src', 'manifest.json');
  const manifestDest = path.join(__dirname, 'dist', 'manifest.json');
  if (fs.existsSync(manifestSource)) {
    // The PWA install splash/title bar must follow the client brand instead
    // of the template's slate defaults.
    let manifest = JSON.parse(fs.readFileSync(manifestSource, 'utf8'));
    let theme = {};
    try {
      const configPath = path.join(__dirname, 'config.json');
      if (fs.existsSync(configPath)) {
        theme = (JSON.parse(fs.readFileSync(configPath, 'utf8')).theme) || {};
      }
    } catch (err) {
      console.error('Error loading config for manifest:', err);
    }
    if (theme.backgroundColor) {
      manifest.background_color = theme.backgroundColor;
      manifest.theme_color = theme.backgroundColor;
    }
    fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2) + '\n');
    console.log('✓ Copied manifest.json' + (theme.backgroundColor ? ' (theme colors from config)' : ''));
  }

  copyAssets();
  copyStaticPages(distDir);

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

module.exports = { build, generatePage };
