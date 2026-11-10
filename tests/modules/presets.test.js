/**
 * Tests for the white-label "place personality" presets (v2.5.0):
 * scripts/presets.js + build.js applyI18nOverrides.
 */

const { PRESETS, resolveEffectiveConfig } = require('../../scripts/presets.js');
const { applyI18nOverrides } = require('../../build.js');

describe('presets', () => {
  test('ships the twelve documented personalities', () => {
    expect(Object.keys(PRESETS).sort()).toEqual([
      'bakery', 'cafe', 'clinic', 'coworking', 'gym', 'hotel',
      'mall', 'meganet', 'mobile-shop', 'netcafe', 'restaurant', 'school'
    ]);
  });

  test('preset v2: each preset carries theme + dictionary + announcement + preview', () => {
    for (const [id, p] of Object.entries(PRESETS)) {
      expect(p.theme).toHaveProperty('defaultTheme');
      expect(p.theme).toHaveProperty('cardRadius');
      expect(p.theme).toHaveProperty('enableNetworkBackground');
      expect(typeof p.i18nOverrides).toBe('object');
      expect(p.preview).toHaveProperty('colors');
      expect(p.preview).toHaveProperty('radius');
      if (id !== 'meganet') {
        // every non-default preset speaks its place's language
        expect(Object.keys(p.i18nOverrides).length).toBeGreaterThan(0);
        expect(p.announcement).not.toBeNull();
      }
    }
  });

  test('the café preset speaks café from the start', () => {
    expect(PRESETS.cafe.i18nOverrides.voucher_label).toBe('كود القعدة');
    expect(PRESETS.cafe.announcement.message_ar[0]).toContain('قهوتنا');
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
    // but the rest of the preset dictionary still flows in
    expect(effective.i18nOverrides.voucher_label).toBe('كود القعدة');
  });

  test('custom (admin-saved) presets resolve via extraPresets', () => {
    const customs = {
      'custom:mycafe': {
        label: 'My café',
        theme: { defaultTheme: 'light', cardRadius: '28px', enableNetworkBackground: false },
        i18nOverrides: { voucher_label: 'كود الطاولة' },
        announcement: null,
        preview: { colors: ['#123456'], radius: '28px' }
      }
    };
    const raw = { theme: { preset: 'custom:mycafe', primaryColor: '#123456', backgroundColor: '#0b0b1e' } };
    const effective = resolveEffectiveConfig(raw, customs);
    expect(effective.theme.cardRadius).toBe('28px');
    expect(effective.theme.defaultTheme).toBe('light');
    expect(effective.i18nOverrides.voucher_label).toBe('كود الطاولة');
    // built-ins still work alongside
    expect(resolveEffectiveConfig({ theme: { preset: 'gym' } }, customs).theme.cardRadius).toBe('8px');
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
