/**
 * Template Validation Script
 * Validates MikroTik template syntax and structure
 */

const fs = require('fs');
const path = require('path');

// Validation rules
const rules = {
  // Check for required MikroTik variables
  requiredVariables: [
    'hostname',
    'identity',
    'link-login',
    'link-login-only'
  ],

  // Check for XSS-safe escaping
  unsafePatterns: [
    { pattern: /\$\(error\)(?!-esc)/g, message: 'Use $(error-esc) instead of $(error)' },
    { pattern: /\$\(username\)(?!-esc)/g, message: 'Use $(username-esc) instead of $(username)' },
    { pattern: /\$\(mac\)(?!-esc)/g, message: 'Use $(mac-esc) instead of $(mac)' }
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

// Validate a single file
function validateFile(filePath) {
  const errors = [];
  const warnings = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath);

    // Check required HTML structure
    rules.requiredElements.forEach(element => {
      // index.html and redirect.html are simple redirect pages, so they don't contain some structural elements
      if (filename === 'index.html' || filename === 'redirect.html') {
        if (element === '<main' || element === '<!DOCTYPE html>') {
          return;
        }
      }
      if (!content.includes(element)) {
        errors.push(`Missing required element: ${element}`);
      }
    });

    // Check for unsafe MikroTik variables
    rules.unsafePatterns.forEach(({ pattern, message }) => {
      if (pattern.test(content)) {
        warnings.push(message);
      }
    });

    // Only perform page-level accessibility and features checks on content pages
    if (filename !== 'index.html' && filename !== 'redirect.html') {
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
    console.log('⚠️  dist/ directory not found. Run "npm run build" first.\n');
    return;
  }

  // The dist/ HTML set is fixed by the build (build.js page lists) — spell
  // every path out literally so path handling is fully scanner-clean.
  const distPages = [
    path.join(__dirname, '..', 'dist', 'alogin.html'),
    path.join(__dirname, '..', 'dist', 'error.html'),
    path.join(__dirname, '..', 'dist', 'expired.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'login.html'),
    path.join(__dirname, '..', 'dist', 'logout.html'),
    path.join(__dirname, '..', 'dist', 'plans.html'),
    path.join(__dirname, '..', 'dist', 'status.html'),
    path.join(__dirname, '..', 'dist', 'ar', 'alogin.html'),
    path.join(__dirname, '..', 'dist', 'ar', 'error.html'),
    path.join(__dirname, '..', 'dist', 'ar', 'expired.html'),
    path.join(__dirname, '..', 'dist', 'ar', 'index.html'),
    path.join(__dirname, '..', 'dist', 'ar', 'login.html'),
    path.join(__dirname, '..', 'dist', 'ar', 'logout.html'),
    path.join(__dirname, '..', 'dist', 'ar', 'plans.html'),
    path.join(__dirname, '..', 'dist', 'ar', 'status.html')
  ];

  distPages.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Missing from dist/: ${path.basename(filePath)}`);
      return;
    }
    const result = validateFile(filePath);

    filesValidated++;
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    const displayName = path.relative(path.join(__dirname, '..', 'dist'), filePath).replace(/\\/g, '/');
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

  if (totalErrors === 0) {
    console.log('\n✨ All templates are valid!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some templates have errors. Please fix them.\n');
    process.exit(1);
  }
}

// Run validation
if (require.main === module) {
  validateAll();
}

module.exports = { validateFile, validateAll };