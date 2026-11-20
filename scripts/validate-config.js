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
const { BUILTIN_PRESET_IDS, CUSTOM_PRESET_RE } = require('./presets.js');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets');

// Icons the plans template actually knows how to render (plans.html).
const PLAN_ICONS = ['globe', 'briefcase', 'graduation-cap', 'ghost', 'star', 'shield', 'crown', 'package'];

// Known translation keys (from src/i18n/en.json) — i18nOverrides may only
// override real keys, so a typo like "voucher_lable" fails at build time.
const I18N_KEY_SOURCE = path.join(__dirname, '..', 'src', 'i18n', 'en.json');
let KNOWN_I18N_KEYS = new Set();
try {
  const enData = JSON.parse(fs.readFileSync(I18N_KEY_SOURCE, 'utf8'));
  KNOWN_I18N_KEYS = new Set(Object.keys(enData.en || {}));
} catch (err) {
  /* dictionary unreadable — unknown-key errors are skipped, schema stays usable */
}

const SCHEMA = {
  general: {
    type: 'object',
    required: true,
    fields: {
      networkName: { type: 'string', required: true },
      networkName_ar: { type: 'string' },
      brandTagline: { type: 'string' },
      brandTagline_ar: { type: 'string' },
      poweredByText: { type: 'string', required: true },
      poweredByText_ar: { type: 'string' },
      poweredByName: { type: 'string', required: true },
      poweredByName_ar: { type: 'string' },
      poweredByUrl: { type: 'string', required: true, pattern: /^https?:\/\/[^\s"'<>]+$/ , hint: 'absolute http(s) URL' }
    }
  },
  theme: {
    type: 'object',
    required: true,
    fields: {
      primaryColor: { type: 'string', required: true, pattern: /^#[0-9a-fA-F]{6}$/, hint: 'CSS hex color, 6 digits, like #22c55e' },
      backgroundColor: { type: 'string', required: true, pattern: /^#[0-9a-fA-F]{6}$/, hint: 'CSS hex color, 6 digits, like #020617' },
      cardRadius: { type: 'string', pattern: /^\d+(\.\d+)?(px|rem|em|%)$/, hint: 'CSS length like 16px' }, // required unless theme.preset is set (see cross-field rules)
      enableNetworkBackground: { type: 'boolean' },
      preset: { type: 'string', hint: 'built-in preset id (meganet/cafe/hotel/clinic/...) or custom:<id> saved in the admin tool' },
      defaultTheme: { type: 'string', enum: ['light', 'dark'], hint: 'theme a first-time visitor sees before any toggle' }
    }
  },
  features: {
    type: 'object',
    required: true,
    fields: {
      loginMode: { type: 'string', required: true, enum: ['normal_only', 'voucher_only', 'both'], hint: 'which login panels the login page shows' },
      voucherPasswordMode: { type: 'string', enum: ['same', 'empty'], hint: 'same = username is reused as password, empty = blank password' },
      quotaDisplayFormat: { type: 'string', enum: ['MB', 'GB'], hint: 'unit shown for remaining quota on the status page' },
      kbBase: { type: 'number', enum: [1000, 1024], hint: 'decimal (1000) or binary (1024) kilobyte base' },
      enableQRScanner: { type: 'boolean' },
      qrScannerUrl: { type: 'string', pattern: /^https?:\/\/[^\s"'<>]+$/, hint: 'absolute URL of the QR scanner page' },
      enableSmartAssistant: { type: 'boolean' },
      enableTechDetails: { type: 'boolean' },
      enableClonePrevention: { type: 'boolean' },
      enableLanguageToggle: { type: 'boolean' },
      enablePlansPage: { type: 'boolean' },
      voucherMinLength: { type: 'number', min: 1, hint: 'minimum voucher code length checked client-side before submit — omit/null to disable' },
      voucherFormat: { type: 'string', enum: ['numeric', 'alphanumeric'], hint: 'numeric (digits only) or alphanumeric (letters + digits) voucher input format' }
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
  i18nOverrides: {
    type: 'object',
    i18nKeys: true // every key must be real; value = string or { en, ar }
  },
  support: {
    type: 'object',
    required: true,
    fields: {
      plansWhatsapp: { type: 'string', pattern: /^\d{6,}$/, hint: 'digits only, country code without + (e.g. 201212208788)' },
      outlets: {
        type: 'array',
        itemFields: {
          name: { type: 'string', required: true },
          name_ar: { type: 'string' },
          address: { type: 'string' },
          address_ar: { type: 'string' },
          phone: { type: 'string', pattern: /^\+?[\d\s-]+$/, hint: 'phone number, digits with optional +/spaces' }
        }
      },
      agents: {
        type: 'array',
        required: true,
        itemFields: {
          name: { type: 'string', required: true },
          name_ar: { type: 'string' },
          role: { type: 'string', required: true },
          role_ar: { type: 'string' },
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

function describe(value) {
  const s = JSON.stringify(value);
  return s === undefined ? String(value) : s;
}

function checkField(pathStr, value, rule, errors) {
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

  // Nested arrays (support.agents / support.outlets) recurse here — top-level arrays (plans)
  // use the same rule shape.
  if (rule.type === 'array' && rule.itemFields) {
    value.forEach((item, i) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(`${pathStr}[${i}]: expected an object`);
        return;
      }
      for (const [field, itemRule] of Object.entries(rule.itemFields)) {
        checkField(`${pathStr}[${i}].${field}`, item[field], itemRule, errors);
      }
    });
  }
}

function validate(config, assetsDir = ASSETS_DIR) {
  // Fresh state per call — validate() may run repeatedly without aliasing arrays.
  const errors = [];
  const warnings = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { errors: ['config: expected a JSON object'], warnings };
  }

  const hasPreset = Boolean(
    config.theme &&
    typeof config.theme.preset === 'string' &&
    config.theme.preset.trim().length > 0
  );

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
        checkField(`${section}.${field}`, value[field], rule, errors);
      }
      // Sections with declared fields shouldn't carry unknown top-level keys
      // (typos like "feautres" live one level up, not here).
    }

    if (sectionRule.type === 'array' && sectionRule.itemFields) {
      value.forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`${section}[${i}]: expected an object`);
          return;
        }
        for (const [field, rule] of Object.entries(sectionRule.itemFields)) {
          checkField(`${section}[${i}].${field}`, item[field], rule, errors);
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

    if (sectionRule.i18nKeys) {
      for (const [k, v] of Object.entries(value)) {
        if (k.startsWith('_')) continue; // comments/hints
        if (KNOWN_I18N_KEYS.size > 0 && !KNOWN_I18N_KEYS.has(k)) {
          errors.push(`${section}.${k}: unknown i18n key — it must be one of the portal's translation keys (e.g. voucher_label)`);
          continue;
        }
        const isPair = v && typeof v === 'object' && !Array.isArray(v);
        if (isPair) {
          for (const lang of ['en', 'ar']) {
            if (v[lang] !== undefined && typeof v[lang] !== 'string') {
              errors.push(`${section}.${k}.${lang}: expected a string translation`);
            }
          }
        } else if (typeof v !== 'string') {
          errors.push(`${section}.${k}: ${describe(v)} is ${typeof v}, expected a string or { en, ar } object`);
        }
      }
    }
  }

  // --- unknown-key checks --------------------------------------------------
  // A typo at section level ("securty") or field level ("maxAtempts") would
  // otherwise pass silently and the portal would run with defaults. Hints
  // and comments (`_*` / `*_hints`) are allowed everywhere.

  const KNOWN_SECTIONS = new Set(Object.keys(SCHEMA));
  for (const key of Object.keys(config)) {
    if (key.startsWith('_')) continue;
    if (!KNOWN_SECTIONS.has(key)) {
      errors.push(`config: unknown top-level key "${key}" — did you mean a section from the schema?`);
    }
  }

  for (const [section, sectionRule] of Object.entries(SCHEMA)) {
    const value = config[section];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    if (sectionRule.freeValues || sectionRule.i18nKeys) {
      // free-form sections (radiusErrorTranslations, i18nOverrides) — their
      // keys are dynamic, not schema fields; skip field-level key checks
      continue;
    }
    const knownFields = new Set(Object.keys(sectionRule.fields || {}));
    for (const key of Object.keys(value)) {
      if (key.startsWith('_')) continue;
      if (key.endsWith('_hints')) continue;
      if (!knownFields.has(key)) {
        errors.push(`${section}: unknown key "${key}" — did you mean a field from the schema?`);
      }
    }
  }

  // --- cross-field rules --------------------------------------------------

  // cardRadius may be omitted only when a theme preset provides it.
  if (config.theme && typeof config.theme === 'object' && !hasPreset && (config.theme.cardRadius === undefined || config.theme.cardRadius === null)) {
    errors.push('theme.cardRadius: missing — required unless theme.preset is set');
  }

  // theme.preset must be a built-in id or a custom:<id> saved in the admin tool
  if (hasPreset) {
    const p = String(config.theme.preset).trim();
    if (p && !BUILTIN_PRESET_IDS.includes(p) && !CUSTOM_PRESET_RE.test(p)) {
      errors.push(`theme.preset: "${p}" is not a built-in preset [${BUILTIN_PRESET_IDS.join(', ')}] nor a custom:<id> preset`);
    }
  }

  // --- asset cross-check (non-fatal) --------------------------------------

  if (Array.isArray(config.support?.agents)) {
    config.support.agents.forEach((agent, i) => {
      if (!agent || typeof agent !== 'object' || !agent.image) return;
      const cleanedRel = String(agent.image).replace(/^\.?\/?assets[\\/]/i, '').replace(/\\/g, '/').trim();
      if (cleanedRel && !fs.existsSync(path.join(assetsDir, cleanedRel))) {
        warnings.push(`support.agents[${i}].image: "${agent.image}" not found in src/assets/ (avatar falls back to the icon)`);
      }
    });
  }

  return { errors, warnings };
}

function validateConfigFile(configPath = CONFIG_PATH, assetsDir = ASSETS_DIR) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    return { errors: [`config.json: ${err.message}`], warnings: [], config: null };
  }
  return { ...validate(config, assetsDir), config };
}

// CLI entry point
if (require.main === module) {
  const cliTarget = process.argv[2]
    ? path.resolve(process.argv[2])
    : (fs.existsSync(CONFIG_PATH) ? CONFIG_PATH : path.join(__dirname, '..', 'config.example.json'));
  const { errors, warnings } = validateConfigFile(cliTarget);
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
