/**
 * presets.js — ready-made "place personality" bundles for the white-label
 * system (v2.5.0).
 *
 * A preset is a starting point, not a lock: it fills theme defaults and a
 * base i18n dictionary ONLY when the operator has not set those values
 * explicitly in config.json. Explicit config always wins.
 *
 * Schema (validated in validate-config.js):
 *   theme.preset: "meganet" | "cafe" | "hotel" | "clinic" (optional)
 *   theme.defaultTheme: "light" | "dark" (optional, preset or explicit)
 */

'use strict';

const PRESETS = {
  meganet: {
    label: 'Meganet default — dark neon green, network particles',
    theme: {
      defaultTheme: 'dark',
      cardRadius: '16px',
      enableNetworkBackground: true
    },
    i18nOverrides: {}
  },
  cafe: {
    label: 'Café — light-first, warm rounded corners, calm no-canvas',
    theme: {
      defaultTheme: 'light',
      cardRadius: '24px',
      enableNetworkBackground: false
    },
    i18nOverrides: {}
  },
  hotel: {
    label: 'Hotel — premium dark, sharper corners, quiet particles',
    theme: {
      defaultTheme: 'dark',
      cardRadius: '12px',
      enableNetworkBackground: true
    },
    i18nOverrides: {}
  },
  clinic: {
    label: 'Clinic — clean light, medium rounding, minimal motion',
    theme: {
      defaultTheme: 'light',
      cardRadius: '18px',
      enableNetworkBackground: false
    },
    i18nOverrides: {}
  }
};

/**
 * Resolve the EFFECTIVE config = raw config.json + preset defaults where the
 * operator left values unset. Never mutates the caller's object.
 */
function resolveEffectiveConfig(raw) {
  const config = JSON.parse(JSON.stringify(raw || {}));
  const presetName = config.theme && config.theme.preset;
  const preset = presetName ? PRESETS[presetName] : null;
  if (!preset) return config;

  // Theme defaults: fill only unset fields (hints/_hints stay untouched).
  config.theme = config.theme || {};
  for (const [key, value] of Object.entries(preset.theme)) {
    if (config.theme[key] === undefined || config.theme[key] === null) {
      config.theme[key] = value;
    }
  }

  // i18n overrides: preset dictionary is the base; explicit operator keys win.
  const operatorOverrides = config.i18nOverrides || {};
  config.i18nOverrides = Object.assign({}, preset.i18nOverrides, operatorOverrides);

  return config;
}

module.exports = { PRESETS, resolveEffectiveConfig };
