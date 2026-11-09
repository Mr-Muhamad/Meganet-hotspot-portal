/**
 * Build-time color derivation for the white-label theme system.
 *
 * config.json carries ONE brand color (theme.primaryColor) and ONE page
 * background (theme.backgroundColor). Every CSS tint/glow/border/glass that
 * used to be a hardcoded rgba(34, 197, 94, ...) literal is now a CSS custom
 * property whose value is derived HERE, at build time, and injected into
 * base.html — so a client with any brand color gets a fully consistent
 * portal with zero runtime color math (works in old captive-portal WebViews
 * that do not support color-mix()).
 *
 * Fidelity rule: when the config carries the SHIPPED default palette
 * (green #22c55e on #020617), the derived keys that would drift from the
 * hand-tuned Tailwind ramp (hover/active/text-on-color/light ramp/surfaces)
 * are OMITTED so the static CSS values win and the shipped build stays
 * pixel-identical. Only non-default client colors trigger full derivation.
 */

'use strict';

var DEFAULT_PRIMARY = '#22c55e';
var DEFAULT_BACKGROUND = '#020617';
var DEFAULT_SURFACE = '#0f172a';

var HEX6_RE = /^#[0-9a-fA-F]{6}$/;

// The alpha ladder (fraction -> 2-digit hex suffix), matching the alphas the
// hardcoded literals actually used across components/media/layout CSS.
var ALPHA_HEX = {
  0.02: '05',
  0.03: '08',
  0.05: '0D',
  0.08: '14',
  0.10: '1A',
  0.15: '26',
  0.20: '33',
  0.25: '40',
  0.30: '4D',
  0.35: '59',
  0.40: '66',
  0.50: '80',
  0.60: '99',
  0.65: 'A6',
  0.70: 'B3'
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  var m = HEX6_RE.exec(hex);
  if (!m) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

function rgbToHex(r, g, b) {
  function part(v) {
    var h = clamp(Math.round(v), 0, 255).toString(16).toUpperCase();
    return h.length === 1 ? '0' + h : h;
  }
  return '#' + part(r) + part(g) + part(b);
}

function hexToHsl(hex) {
  var rgb = hexToRgb(hex);
  if (!rgb) return null;
  var r = rgb.r / 255;
  var g = rgb.g / 255;
  var b = rgb.b / 255;
  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var l = (max + min) / 2;
  var h = 0;
  var s = 0;
  if (max !== min) {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0));
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h: h, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  // h in degrees, s/l in percent
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  var c = (1 - Math.abs(2 * l - 1)) * s;
  var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  var m = l - c / 2;
  var r = 0;
  var g = 0;
  var b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function withAlpha(hex, alpha) {
  if (!HEX6_RE.test(hex || '')) return null;
  var suffix = ALPHA_HEX[alpha];
  if (!suffix) return null;
  return hex.toUpperCase().slice(0, 7) + suffix;
}

function adjustLightness(hex, deltaPercent) {
  var hsl = hexToHsl(hex);
  if (!hsl) return null;
  return hslToHex(hsl.h, hsl.s, hsl.l + deltaPercent);
}

// WCAG relative luminance (0..1), used to pick readable text on a brand color.
function relativeLuminance(hex) {
  var rgb = hexToRgb(hex);
  if (!rgb) return null;
  function channel(v) {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

// Text ON the brand color: light ink on dark/medium colors, dark ink on
// light ones (threshold tuned so the shipped green would take dark ink,
// matching the hand-picked ramp).
function readableTextOn(hex) {
  var lum = relativeLuminance(hex);
  if (lum === null) return null;
  return lum > 0.40 ? '#0f172a' : '#ffffff';
}

function isDefault(value, fallback) {
  return typeof value === 'string' && value.toUpperCase() === fallback.toUpperCase();
}

/**
 * Derive the full brand token set for the template injection.
 * Returns { dark: {...}, light: {...} } where keys are CSS custom-property
 * names WITHOUT the leading `--` (e.g. 'color-primary-alpha-15'), or null
 * when nothing needs overriding.
 */
function deriveThemeTokens(primaryColor, backgroundColor) {
  var dark = {};
  var light = {};

  var primary = typeof primaryColor === 'string' && HEX6_RE.test(primaryColor)
    ? primaryColor.toUpperCase()
    : null;
  var background = typeof backgroundColor === 'string' && HEX6_RE.test(backgroundColor)
    ? backgroundColor.toUpperCase()
    : null;

  var primaryIsDefault = !primary || isDefault(primary, DEFAULT_PRIMARY);
  var backgroundIsDefault = !background || isDefault(background, DEFAULT_BACKGROUND);

  // --- Brand alpha ladder (exact for every client color) ---
  if (primary) {
    [0.02, 0.03, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60, 0.70].forEach(function (a) {
      var v = withAlpha(primary, a);
      if (v) dark['color-primary-alpha-' + String(Math.round(a * 100)).padStart(2, '0')] = v;
    });
    // The long-standing --color-primary-bg alias (0.15) is derived too so a
    // non-green client keeps every primary-bg tint consistent.
    dark['color-primary-bg'] = withAlpha(primary, 0.15);

    if (!primaryIsDefault) {
      dark['color-primary'] = primary;
      dark['color-primary-hover'] = adjustLightness(primary, -9);
      dark['color-primary-active'] = adjustLightness(primary, -18);
      dark['color-primary-text'] = readableTextOn(primary);
      // The promo-banner text was historically the brand's own lighter neon
      // tone (rgb(74,222,128) when the brand WAS green) — so it follows the
      // client brand: a lighter tint on dark, a readable darker tone on light.
      dark['color-primary-bright-text'] = adjustLightness(primary, 22);

      light['color-primary'] = adjustLightness(primary, -12);
      light['color-primary-hover'] = adjustLightness(primary, -20);
      light['color-primary-active'] = adjustLightness(primary, -30);
      light['color-primary-text'] = '#ffffff';
      light['color-primary-bg'] = withAlpha(light['color-primary'], 0.08);
      light['color-primary-bright-text'] = adjustLightness(primary, -18);
      // The light theme needs the FULL alpha ladder derived too — its static
      // fallback in theme.css is the green ramp, and an incomplete derivation
      // left high-alpha tokens (pulse keyframes, banner borders) green on a
      // non-green client.
      [0.02, 0.03, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60, 0.70].forEach(function (a) {
        var v = withAlpha(light['color-primary'], a);
        if (v) light['color-primary-alpha-' + String(Math.round(a * 100)).padStart(2, '0')] = v;
      });
      // Light-theme focus ring follows the client brand too (it used to stay
      // statically green even when the dark theme was recolored).
      light['color-input-focus'] = light['color-primary'];
      [0.05, 0.10, 0.15, 0.25].forEach(function (a) {
        var v = withAlpha(light['color-primary'], a);
        if (v) light['color-primary-alpha-' + String(Math.round(a * 100)).padStart(2, '0')] = v;
      });
    }
  }

  // --- Dark surfaces + glass from the client background ---
  if (background && !backgroundIsDefault) {
    var hsl = hexToHsl(background);
    if (hsl) {
      var surface = hslToHex(hsl.h, Math.min(hsl.s, 60), 12);
      var surfaceHover = hslToHex(hsl.h, Math.min(hsl.s, 55), 19);
      dark['color-surface'] = surface;
      dark['color-surface-hover'] = surfaceHover;
      dark['glass-header'] = withAlpha(surface, 0.65);
      dark['glass-banner'] = withAlpha(surface, 0.70);
      dark['glass-overlay'] = withAlpha(background, 0.70);
    }
  } else if (background) {
    // Default background: keep the hand-picked slate glass exactly.
    dark['glass-header'] = withAlpha(DEFAULT_SURFACE, 0.65);
    dark['glass-banner'] = withAlpha(DEFAULT_SURFACE, 0.70);
    dark['glass-overlay'] = withAlpha(DEFAULT_BACKGROUND, 0.70);
  }

  if (Object.keys(dark).length === 0 && Object.keys(light).length === 0) {
    return null;
  }
  return { dark: dark, light: light };
}

module.exports = {
  DEFAULT_PRIMARY: DEFAULT_PRIMARY,
  DEFAULT_BACKGROUND: DEFAULT_BACKGROUND,
  DEFAULT_SURFACE: DEFAULT_SURFACE,
  hexToRgb: hexToRgb,
  rgbToHex: rgbToHex,
  hexToHsl: hexToHsl,
  hslToHex: hslToHex,
  withAlpha: withAlpha,
  adjustLightness: adjustLightness,
  relativeLuminance: relativeLuminance,
  readableTextOn: readableTextOn,
  deriveThemeTokens: deriveThemeTokens
};
