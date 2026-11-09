/**
 * Tests for the build-time white-label color derivation
 * (scripts/color-utils.js — consumed by build.js → base.html injection).
 */

const {
  withAlpha,
  hexToHsl,
  hslToHex,
  adjustLightness,
  relativeLuminance,
  readableTextOn,
  deriveThemeTokens,
  DEFAULT_PRIMARY,
  DEFAULT_BACKGROUND
} = require('../../scripts/color-utils.js');

describe('color-utils', () => {
  describe('withAlpha', () => {
    test('appends the exact 2-digit alpha suffix used by the old literals', () => {
      expect(withAlpha('#22c55e', 0.15)).toBe('#22C55E26');
      expect(withAlpha('#22c55e', 0.25)).toBe('#22C55E40');
      expect(withAlpha('#22c55e', 0.02)).toBe('#22C55E05');
      expect(withAlpha('#3b82f6', 0.35)).toBe('#3B82F659');
    });

    test('rejects invalid hex and unknown alphas', () => {
      expect(withAlpha('not-a-color', 0.15)).toBeNull();
      expect(withAlpha('#22c55e', 0.17)).toBeNull();
    });
  });

  describe('hexToHsl / hslToHex / adjustLightness', () => {
    test('round-trips a hex color through its exact HSL', () => {
      const hsl = hexToHsl('#22c55e');
      expect(hslToHex(hsl.h, hsl.s, hsl.l)).toBe('#22C55E');
    });

    test('darkens by a lightness delta (hex quantization tolerance)', () => {
      const darker = adjustLightness('#3b82f6', -9);
      expect(darker).toMatch(/^#[0-9A-F]{6}$/);
      expect(darker).not.toBe('#3b82f6');
      const hslBefore = hexToHsl('#3b82f6');
      const hslAfter = hexToHsl(darker);
      // an 8-bit hex step is worth ~0.2 points of lightness percent
      expect(hslAfter.l).toBeCloseTo(hslBefore.l - 9, 1);
    });
  });

  describe('readableTextOn', () => {
    test('picks dark ink on light brand colors and white ink on dark ones', () => {
      expect(readableTextOn('#22ff88')).toBe('#0f172a'); // very light green
      expect(readableTextOn('#3b82f6')).toBe('#ffffff'); // medium blue
      expect(readableTextOn('#6d5efc')).toBe('#ffffff'); // violet
    });
  });

  describe('deriveThemeTokens — shipped default palette', () => {
    const tokens = deriveThemeTokens(DEFAULT_PRIMARY, DEFAULT_BACKGROUND);

    test('derives the exact alpha ladder values the old literals used', () => {
      expect(tokens.dark['color-primary-alpha-15']).toBe('#22C55E26');
      expect(tokens.dark['color-primary-alpha-40']).toBe('#22C55E66');
      expect(tokens.dark['color-primary-alpha-70']).toBe('#22C55EB3');
      expect(tokens.dark['color-primary-bg']).toBe('#22C55E26');
    });

    test('derives the exact glass values from the default surfaces', () => {
      expect(tokens.dark['glass-header']).toBe('#0F172AA6'); // was rgba(15,23,42,.65)
      expect(tokens.dark['glass-banner']).toBe('#0F172AB3'); // was rgba(15,23,42,.7)
      expect(tokens.dark['glass-overlay']).toBe('#020617B3'); // was rgba(2,6,17,.7)
    });

    test('omits hover/active/text/light ramp for the default green (static Tailwind values win)', () => {
      expect(tokens.dark['color-primary-hover']).toBeUndefined();
      expect(tokens.dark['color-primary-active']).toBeUndefined();
      expect(tokens.dark['color-primary-text']).toBeUndefined();
      expect(tokens.dark['color-surface']).toBeUndefined();
      expect(tokens.light).toEqual({});
    });
  });

  describe('deriveThemeTokens — a non-default client brand (blue)', () => {
    const tokens = deriveThemeTokens('#3b82f6', '#0b0b1e');

    test('recolors the whole alpha ladder to the client brand', () => {
      expect(tokens.dark['color-primary-alpha-15']).toBe('#3B82F626');
      expect(tokens.dark['color-primary-bg']).toBe('#3B82F626');
    });

    test('derives hover/active/text-on-color', () => {
      expect(tokens.dark['color-primary']).toBe('#3B82F6');
      expect(tokens.dark['color-primary-text']).toBe('#ffffff');
      expect(tokens.dark['color-primary-hover']).toMatch(/^#[0-9A-F]{6}$/);
      expect(tokens.dark['color-primary-active']).toMatch(/^#[0-9A-F]{6}$/);
    });

    test('derives a light-theme ramp + light focus ring', () => {
      expect(tokens.light['color-primary']).toMatch(/^#[0-9A-F]{6}$/);
      expect(tokens.light['color-primary-text']).toBe('#ffffff');
      expect(tokens.light['color-input-focus']).toBe(tokens.light['color-primary']);
      expect(tokens.light['color-primary-alpha-15']).toMatch(/^#[0-9A-F]{8}$/);
    });

    test('derives dark surfaces + glass from the client background hue', () => {
      expect(tokens.dark['color-surface']).toMatch(/^#[0-9A-F]{6}$/);
      expect(tokens.dark['color-surface-hover']).toMatch(/^#[0-9A-F]{6}$/);
      expect(tokens.dark['glass-overlay']).toBe('#0B0B1EB3');
    });
  });

  describe('deriveThemeTokens — degenerate inputs', () => {
    test('returns null when no config colors are set', () => {
      expect(deriveThemeTokens(undefined, undefined)).toBeNull();
      expect(deriveThemeTokens('not-a-color', '')).toBeNull();
    });

    test('still derives glass when only a non-default background is set', () => {
      const tokens = deriveThemeTokens(undefined, '#0b0b1e');
      expect(tokens.dark['glass-overlay']).toBe('#0B0B1EB3');
      expect(tokens.dark['color-primary-alpha-15']).toBeUndefined();
    });

    test('skips surface derivation for the default background', () => {
      const tokens = deriveThemeTokens('#3b82f6', DEFAULT_BACKGROUND);
      expect(tokens.dark['color-surface']).toBeUndefined();
      expect(tokens.dark['glass-header']).toBe('#0F172AA6');
    });
  });
});
