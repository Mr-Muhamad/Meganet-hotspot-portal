#!/usr/bin/env node
/**
 * validate-config.js — schema validation for config.json.
 *
 * A typo like loginMode: "vucher_only" silently degrades the portal (wrong
 * panels show, voucher behavior changes), so this validator runs:
 *   - directly:            npm run validate:config
 *   - as a build gate:     build.js refuses to emit dist/ on invalid config
 *   - in CI / jest:        tests/modules/config-schema.test.js
 *
 * Reports actionable errors (path → value → what's expected) plus non-fatal
 * warnings for things like missing agent images.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets');

// Icons the plans template actually knows how to render (plans.html).
const PLAN_ICONS = ['globe', 'briefcase', 'graduation-cap', 'ghost', 'star', 'shield', 'crown', 'package'];

const SCHEMA = {
  general: {
    type: 'object',
    fields: {
      networkName: { type: 'string', required: true },
      poweredByText: { type: 'string', required: true },
      poweredByName: { type: 'string', required: true },
      poweredByUrl: { type: 'string', required: true, pattern: /^https?:\/\/.+/ , hint: 'absolute http(s) URL' }
    }
  },
  theme: {
    type: 'object',
    fields: {
      primaryColor: { type: 'string', required: true, pattern: /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, hint: 'CSS hex color like #22c55e' },
      backgroundColor: { type: 'string', required: true, pattern: /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, hint: 'CSS hex color like #020617' },
      cardRadius: { type: 'string', required: true, pattern: /^\d+(\.\d+)?(px|rem|em|%)$/, hint: 'CSS length like 16px' },
      enableNetworkBackground: { type: 'boolean' }
    }
  },
  features: {
    type: 'object',
    fields: {
      loginMode: { type: 'string', required: true, enum: ['normal_only', 'voucher_only', 'both'], hint: 'which login panels the login page shows' },
      voucherPasswordMode: { type: 'string', enum: ['same', 'empty'], hint: 'same = username is reused as password, empty = blank password' },
      quotaDisplayFormat: { type: 'string', enum: ['MB', 'GB'], hint: 'unit shown for remaining quota on the status page' },
      kbBase: { type: 'number', enum: [1000, 1024], hint: 'decimal (1000) or binary (1024) kilobyte base' },
      enableQRScanner: { type: 'boolean' },
      qrScannerUrl: { type: 'string', pattern: /^https?:\/\/.+/, hint: 'absolute URL of the QR scanner page' },
      enableSmartAssistant: { type: 'boolean' },
      enableTechDetails: { type: 'boolean' },
      enableClonePrevention: { type: 'boolean' },
      enableLanguageToggle: { type: 'boolean' }
    }
  },
  plans: {
    type: 'array',
    required: true,
    itemFields: {
      name: { type: 'string', required: true },
      name_ar: { type: 'string' },
      quota: { type: 'string', required: true, hint: 'displayed on the English plans page, e.g. "10 GB"' },
      quota_ar: { type: 'string' },
      price: { type: 'string', required: true, pattern: /^\d+(\.\d+)?$/, hint: 'numeric value as a string, e.g. "60"' },
      icon: { type: 'string', enum: PLAN_ICONS, hint: 'icon rendered on the plan card' }
    }
  },
  security: {
    type: 'object',
    fields: {
      maxAttempts: { type: 'number', min: 1 },
      blockDurationMinutes: { type: 'number', min: 1 }
    }
  },
  radiusErrorTranslations: {
    type: 'object',
    freeValues: 'string' // RouterOS Reply-Message substring → Arabic translation
  },
  support: {
    type: 'object',
    fields: {
      agents: {
        type: 'array',
        required: true,
        itemFields: {
          name: { type: 'string', required: true },
          role: { type: 'string', required: true },
          phone: { type: 'string', required: true, pattern: /^\+?[\d\s-]+$/, hint: 'phone number, digits with optional +/spaces' },
          whatsapp: { type: 'string', required: true, pattern: /^\d{6,}$/, hint: 'digits only, country code without + (e.g. 201212208788)' },
          image: { type: 'string' } // cross-checked against src/assets below
        }
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

const errors = [];
const warnings = [];

function describe(value) {
  const s = JSON.stringify(value);
  return s === undefined ? String(value) : s;
}

function checkField(pathStr, value, rule) {
  if (value === undefined || value === null) {
    if (rule.required) errors.push(`${pathStr}: missing, expected ${rule.hint || rule.type}`);
    return;
  }
  const actual = Array.isArray(value) ? 'array' : typeof value;
  if (rule.type && actual !== rule.type) {
    errors.push(`${pathStr}: ${describe(value)} is ${actual}, expected ${rule.type}${rule.hint ? ' (' + rule.hint + ')' : ''}`);
    return;
  }

  if (rule.enum && !rule.enum.includes(value)) {
    errors.push(`${pathStr}: ${describe(value)} is not one of [${rule.enum.join(', ')}]${rule.hint ? ' — ' + rule.hint : ''}`);
    return;
  }

  if (rule.pattern && !rule.pattern.test(String(value))) {
    errors.push(`${pathStr}: ${describe(value)} has an invalid format, expected ${rule.hint || rule.pattern}`);
  }

  if (rule.min !== undefined && value < rule.min) {
    errors.push(`${pathStr}: ${describe(value)} is below the minimum ${rule.min}`);
  }

  // Nested arrays (support.agents) recurse here — top-level arrays (plans)
  // use the same rule shape.
  if (rule.type === 'array' && rule.itemFields) {
    value.forEach((item, i) => {
      for (const [field, itemRule] of Object.entries(rule.itemFields)) {
        checkField(`${pathStr}[${i}].${field}`, item[field], itemRule);
      }
    });
  }
}

function validate(config) {
  // Fresh state per call — validate() may run repeatedly (CLI, build, tests).
  errors.length = 0;
  warnings.length = 0;

  for (const [section, sectionRule] of Object.entries(SCHEMA)) {
    const value = config[section];
    if (value === undefined || value === null) {
      if (sectionRule.required) errors.push(`${section}: missing section`);
      continue;
    }

    const actual = Array.isArray(value) ? 'array' : typeof value;
    if (actual !== sectionRule.type) {
      errors.push(`${section}: ${describe(value)} is ${actual}, expected ${sectionRule.type}`);
      continue;
    }

    if (sectionRule.type === 'object' && sectionRule.fields) {
      for (const [field, rule] of Object.entries(sectionRule.fields)) {
        checkField(`${section}.${field}`, value[field], rule);
      }
      // Sections with declared fields shouldn't carry unknown top-level keys
      // (typos like "feautres" live one level up, not here).
    }

    if (sectionRule.type === 'array' && sectionRule.itemFields) {
      value.forEach((item, i) => {
        for (const [field, rule] of Object.entries(sectionRule.itemFields)) {
          checkField(`${section}[${i}].${field}`, item[field], rule);
        }
      });
    }

    if (sectionRule.freeValues) {
      for (const [k, v] of Object.entries(value)) {
        if (k.startsWith('_')) continue; // comments/hints
        if (typeof v !== sectionRule.freeValues) {
          errors.push(`${section}.${k}: ${describe(v)} is ${typeof v}, expected ${sectionRule.freeValues}`);
        }
      }
    }
  }

  // --- cross-field rules --------------------------------------------------

  if (config.features?.enableQRScanner && !config.features?.qrScannerUrl) {
    errors.push('features: enableQRScanner is true but qrScannerUrl is not set (the QR button needs a target URL)');
  }

  // --- asset cross-check (non-fatal) --------------------------------------

  if (Array.isArray(config.support?.agents)) {
    config.support.agents.forEach((agent, i) => {
      if (agent.image && !fs.existsSync(path.join(ASSETS_DIR, agent.image))) {
        warnings.push(`support.agents[${i}].image: "${agent.image}" not found in src/assets/ (avatar falls back to the icon)`);
      }
    });
  }

  return { errors, warnings };
}

function validateConfigFile(configPath = CONFIG_PATH) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    return { errors: [`config.json: ${err.message}`], warnings: [], config: null };
  }
  return { ...validate(config), config };
}

// CLI entry point
if (require.main === module) {
  const { errors, warnings } = validateConfigFile();
  for (const w of warnings) console.log(`  ⚠  ${w}`);
  if (errors.length) {
    console.error(`\n✖ config.json failed validation: ${errors.length} error${errors.length === 1 ? '' : 's'}\n`);
    errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
    console.error('\nFix config.json, or run "npm run validate:config" again after editing.');
    process.exit(1);
  }
  if (warnings.length) console.log(`\n⚠ ${warnings.length} warning${warnings.length === 1 ? '' : 's'} (non-fatal)`);
  console.log('\n✓ config.json is valid');
  process.exit(0);
}

module.exports = { validate, validateConfigFile, SCHEMA };
