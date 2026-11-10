/**
 * Tests for the white-label "place personality" presets (v2.5.0):
 * scripts/presets.js + build.js applyI18nOverrides.
 */

const { PRESETS, resolveEffectiveConfig } = require('../../scripts/presets.js');
const { applyI18nOverrides } = require('../../build.js');

describe('presets', () => {
  test('ships the four documented personalities', () => {
    expect(Object.keys(PRESETS).sort()).toEqual(['cafe', 'clinic', 'hotel', 'meganet']);
  });

  test('fills unset theme fields from the preset', () => {
    const raw = { theme: { primaryColor: '#A9713C', backgroundColor: '#1C1208', preset: 'cafe' } };
    const effective = resolveEffectiveConfig(raw);
    expect(effective.theme.defaultTheme).toBe('light');
    expect(effective.theme.cardRadius).toBe('24px');
    expect(effective.theme.enableNetworkBackground).toBe(false);
    // explicit values are never touched
    expect(effective.theme.primaryColor).toBe('#A9713C');
  });

  test('explicit config values win over the preset', () => {
    const raw = { theme: { preset: 'cafe', defaultTheme: 'dark', cardRadius: '10px' } };
    const effective = resolveEffectiveConfig(raw);
    expect(effective.theme.defaultTheme).toBe('dark');
    expect(effective.theme.cardRadius).toBe('10px');
    expect(effective.theme.enableNetworkBackground).toBe(false); // still filled
  });

  test('comment/hint keys survive and are ignored', () => {
    const raw = {
      theme: {
        preset: 'hotel',
        cardRadius_hints: 'keep me'
      }
    };
    const effective = resolveEffectiveConfig(raw);
    expect(effective.theme.cardRadius_hints).toBe('keep me');
    expect(effective.theme.cardRadius).toBe('12px');
  });

  test('no preset leaves the config untouched', () => {
    const raw = { theme: { defaultTheme: 'light' } };
    expect(resolveEffectiveConfig(raw)).toEqual(raw);
  });

  test('operator i18n overrides win over the preset base', () => {
    const raw = {
      theme: { preset: 'cafe' },
      i18nOverrides: { login_button: { en: 'Go' } }
    };
    const effective = resolveEffectiveConfig(raw);
    expect(effective.i18nOverrides.login_button).toEqual({ en: 'Go' });
  });
});

describe('applyI18nOverrides', () => {
  const base = {
    en: { voucher_label: 'Voucher code', login_button: 'Connect' },
    ar: { voucher_label: 'كود الشحن', login_button: 'تسجيل الدخول' }
  };

  test('a plain string replaces the key in both languages', () => {
    const merged = applyI18nOverrides(base, { voucher_label: 'Table code' });
    expect(merged.en.voucher_label).toBe('Table code');
    expect(merged.ar.voucher_label).toBe('Table code');
  });

  test('an { en, ar } pair replaces per language', () => {
    const merged = applyI18nOverrides(base, { login_button: { en: 'Get Online', ar: 'افتح النت' } });
    expect(merged.en.login_button).toBe('Get Online');
    expect(merged.ar.login_button).toBe('افتح النت');
  });

  test('unknown/comment keys are skipped', () => {
    const merged = applyI18nOverrides(base, { _comment: 'x', not_a_key: 'y' });
    expect(merged).toEqual(base);
  });

  test('no overrides returns the original dictionaries untouched', () => {
    expect(applyI18nOverrides(base, null)).toEqual(base);
  });
});
