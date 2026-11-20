/**
 * Template Validation Script
 * Validates MikroTik template syntax and structure
 */

const fs = require('fs');
const path = require('path');

// Validation rules
const rules = {
  // Check for required MikroTik variables mapped by template filename
  requiredVariables: {
    'login.html': ['hostname', 'link-login-only'],
    'logout.html': ['link-login']
  },

  // Check for XSS-safe escaping — NOTE: no `g` flag. A global regex keeps
  // lastIndex across .test() calls, silently skipping matches in later
  // files (stateful regex bug). $(error) is HTML-escaped by RouterOS in HTML
  // text bodies and keeps UTF-8 Arabic intact without $(error-esc) %FFF
  // corruption, so warn only when $(error) is placed inside attributes/scripts.
  unsafePatterns: [
    { pattern: /\b(?:href|src|action|on\w+)\s*=\s*(?:"[^"]*\$\(error\)(?!-esc)|'[^']*\$\(error\)(?!-esc))/i, message: 'Use $(error-esc) instead of $(error) inside HTML attributes' },
    { pattern: /<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?\$\(error\)(?!-esc)/i, message: 'Use $(error-esc) instead of $(error) inside inline <script>' },
    { pattern: /\$\(username\)(?!-esc)/, message: 'Use $(username-esc) instead of $(username)' },
    { pattern: /\$\(mac\)(?!-esc)/, message: 'Use $(mac-esc) instead of $(mac)' }
  ],

  // Required HTML structure
  requiredElements: [
    '<!DOCTYPE html>',
    '<html',
    '<head>',
    '<body',
    '<main'
  ],

  // Accessibility requirements
  accessibilityChecks: [
    { pattern: /<a[^>]*class="skip-link"/, message: 'Missing skip link for accessibility' },
    { pattern: /aria-label/, message: 'Missing ARIA labels' },
    { pattern: /role="/, message: 'Missing ARIA roles' }
  ]
};

const REDIRECTOR_FILES = new Set(['index.html', 'redirect.html', 'rlogin.html', 'rstatus.html']);

function getDistPages(rootDir = path.join(__dirname, '..')) {
  const d = path.join(rootDir, 'dist');
  return [
    path.join(d, 'alogin.html'),
    path.join(d, 'error.html'),
    path.join(d, 'expired.html'),
    path.join(d, 'flogout.html'),
    path.join(d, 'fstatus.html'),
    path.join(d, 'index.html'),
    path.join(d, 'login.html'),
    path.join(d, 'logout.html'),
    path.join(d, 'plans.html'),
    path.join(d, 'redirect.html'),
    path.join(d, 'rlogin.html'),
    path.join(d, 'rstatus.html'),
    path.join(d, 'status.html'),
    path.join(d, 'ar', 'alogin.html'),
    path.join(d, 'ar', 'error.html'),
    path.join(d, 'ar', 'expired.html'),
    path.join(d, 'ar', 'flogout.html'),
    path.join(d, 'ar', 'fstatus.html'),
    path.join(d, 'ar', 'index.html'),
    path.join(d, 'ar', 'login.html'),
    path.join(d, 'ar', 'logout.html'),
    path.join(d, 'ar', 'plans.html'),
    path.join(d, 'ar', 'status.html')
  ];
}

// Validate a single file
function validateFile(filePath) {
  const errors = [];
  const warnings = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath);
    const normalizedPath = filePath.replace(/\\/g, '/');
    const isArabic = normalizedPath.includes('/ar/');
    const isRedirector = REDIRECTOR_FILES.has(filename);

    // Validate RTL direction on Arabic templates
    if (isArabic && !content.includes('dir="rtl"')) {
      warnings.push('Arabic page missing dir="rtl" attribute');
    }

    // Check required HTML structure
    rules.requiredElements.forEach(element => {
      // Redirector stubs do not contain <main> or full document shells
      if (isRedirector && (element === '<main' || element === '<!DOCTYPE html>')) {
        return;
      }
      if (!content.includes(element)) {
        errors.push(`Missing required element: ${element}`);
      }
    });

    // Check for required MikroTik variables on applicable templates via rules.requiredVariables
    if (rules.requiredVariables[filename]) {
      rules.requiredVariables[filename].forEach(v => {
        if (!content.includes(`$(${v})`)) {
          warnings.push(`Missing recommended RouterOS variable: $(${v})`);
        }
      });
    }

    // Check for unsafe MikroTik variables
    rules.unsafePatterns.forEach(({ pattern, message }) => {
      if (pattern.test(content)) {
        warnings.push(message);
      }
    });

    // Only perform page-level accessibility and features checks on content pages
    if (!isRedirector) {
      // Check for accessibility
      rules.accessibilityChecks.forEach(({ pattern, message }) => {
        if (!pattern.test(content)) {
          warnings.push(message);
        }
      });

      // Check for proper i18n attributes
      if (!content.includes('data-i18n')) {
        warnings.push('Missing i18n translation attributes');
      }

      // Check for theme toggle
      if (!content.includes('toggleTheme')) {
        warnings.push('Missing theme toggle functionality');
      }

      // Check for language toggle
      if (!content.includes('toggleLang')) {
        warnings.push('Missing language toggle functionality');
      }
    }

    return {
      file: filename,
      errors,
      warnings,
      valid: errors.length === 0
    };
  } catch (error) {
    return {
      file: path.basename(filePath),
      errors: [`Failed to read file: ${error.message}`],
      warnings: [],
      valid: false
    };
  }
}

// Validate all template files
function validateAll() {
  const projectRoot = path.join(__dirname, '..');
  const distDir = path.join(projectRoot, 'dist');

  console.log('🔍 Validating MikroTik Hotspot Templates...\n');

  let totalErrors = 0;
  let totalWarnings = 0;
  let filesValidated = 0;

  // Check if dist directory exists
  if (!fs.existsSync(distDir)) {
    console.error('❌ dist/ directory not found. Run "npm run build" first.\n');
    return { valid: false, filesValidated: 0, totalErrors: 1, totalWarnings: 0 };
  }

  const distPages = getDistPages(projectRoot);

  distPages.forEach(filePath => {
    const displayName = path.relative(path.join(__dirname, '..', 'dist'), filePath).replace(/\\/g, '/');
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Missing from dist/: ${displayName}`);
      totalErrors++;
      return;
    }
    const result = validateFile(filePath);

    filesValidated++;
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    if (result.valid && result.warnings.length === 0) {
      console.log(`✅ ${displayName}`);
    } else if (result.valid) {
      console.log(`⚠️  ${displayName}`);
      result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
    } else {
      console.log(`❌ ${displayName}`);
      result.errors.forEach(e => console.log(`   ❌ ${e}`));
      result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
    }
  });

  // Summary
  console.log('\n' + '─'.repeat(50));
  console.log(`📊 Validation Summary:`);
  console.log(`   Files validated: ${filesValidated}`);
  console.log(`   Errors: ${totalErrors}`);
  console.log(`   Warnings: ${totalWarnings}`);

  const valid = totalErrors === 0;
  if (valid) {
    console.log('\n✨ All templates are valid!\n');
  } else {
    console.log('\n❌ Some templates have errors. Please fix them.\n');
  }
  return { valid, filesValidated, totalErrors, totalWarnings };
}

// Run validation
if (require.main === module) {
  const summary = validateAll();
  process.exit(summary && summary.valid ? 0 : 1);
}

module.exports = { validateFile, validateAll, getDistPages };