# Theme — Meganet Hotspot Portal (ميجا نت)

Vanilla-CSS design system: 56 custom properties in `variables.css`, three palette blocks in `theme.css` (media-query light / `[data-theme="light"]` / `[data-theme="dark"]`), config-driven brand overrides injected into `base.html`. Dark is the default theme; light follows OS/manual toggle.

## Part 1 — Compact token summary

### Colors (dark default)
| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#020617` | page background (near-black navy) |
| `--color-surface` | `#0f172a` | cards/inputs |
| `--color-surface-hover` | `#1e293b` | hover surfaces |
| `--color-text` | `#f8fafc` | primary text |
| `--color-text-muted` | `#94a3b8` | secondary text |
| `--color-primary` | `#22c55e` | brand neon green |
| `--color-primary-hover` | `#16a34a` | |
| `--color-primary-active` | `#15803d` | |
| `--color-primary-text` | `#052e16` | text on primary (dark green) |
| `--color-primary-bg` | `rgba(34,197,94,0.15)` | primary tint backgrounds |
| `--color-error` | `#ef4444` (+`-bg` 15%) | danger |
| `--color-success` | `#22c55e` (+`-bg` 15%) | success (= primary hue) |
| `--color-warning` | `#f59e0b` (+`-bg` 15%) | warning amber |
| `--color-border` | `#1e293b` | borders |
| `--color-input-bg` | `#0f172a` | input fill |
| `--color-input-border` | `#334155` | input border |
| `--color-input-focus` | `#22c55e` | focus ring color |

### Colors (light override)
bg `#f8fafc`, surface `#ffffff`, surface-hover `#f1f5f9`, text `#0f172a`, muted `#64748b`, border `#e2e8f0`, input-bg `#ffffff`, input-border `#cbd5e1`, primary ramp darker greens `#16a34a`/`#15803d`/`#166534`, `--color-primary-text #ffffff`, status bgs at 0.08 alpha, svg tokens `#15803d`/`#166534`/`#0f172a`.

### Spacing / Radius / Type / Effects
- Spacing: `--space-xs 4px`, `sm 8px`, `md 16px`, `lg 24px`, `xl 32px`, `2xl 48px`
- Radius: `--radius-sm 6px`, `md 10px` (config: `calc(cardRadius - 4px)`), `lg 16px` (config: `cardRadius`), `full 9999px`
- Font: system stack `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans Arabic", sans-serif` — NO webfonts
- Sizes: `xs 12 / sm 14 / md 15 / base 16 / lg 18 / xl 22 / 2xl 28px`; weights 400/500/600/700; line-height 1.25 / 1.5
- Shadows: `--shadow-sm/md/lg` all `none` (flat design — depth comes from borders + translucent glows)
- Transitions: `150ms ease` fast, `250ms ease` normal
- Layout: `--max-width 420px` (login etc.), `--max-width-wide 680px` (status), `--header-height 56px`

### Config-driven overrides (injected in base.html `<style>`)
- `config.theme.cardRadius` → `:root { --radius-lg; --radius-md: calc(cardRadius - 4px) }` (theme-independent)
- `config.theme.primaryColor` → scoped `[data-theme="dark"]`: `--color-primary`, `--color-input-focus`, `--color-primary-hover (hex+e6)`, `--color-primary-active (hex+cc)`, `--svg-accent`, `--color-primary-bg (hex+26)`, `--color-success(+bg)`
- `config.theme.backgroundColor` → `[data-theme="dark"] { --color-bg }`
- `config.theme.enableNetworkBackground` → particle canvas on/off
- Shipped config: primary `#22c55e`, bg `#020617`, cardRadius `16px`, network background ON

### Recurring hardcoded hues OUTSIDE tokens (redesign entanglement)
- Green `rgba(34,197,94,*)` ≈35 occurrences (secondary buttons, glows, focus rings, plan-card glow, support pulse, announcement promo, qr-scan-pulse)
- Emerald `#10b981`/`rgba(16,185,129,*)` ≈8 (status dot badge, pulse)
- Blue `#3b82f6`/`rgba(59,130,246,*)` ≈8 (support phone, webview hint callout, canvas nodes)
- Amber `rgba(245,158,11,*)`/`rgba(234,179,8,*)` ≈10 (announcement warning, activity badges)
- Neon `#48ff00` (progress shimmer midstop), light-mode readable shades `#d97706/#b45309/#15803d`, glass surfaces `rgba(15,23,42,.65-.7)`, `rgba(255,255,255,.85)`, modal overlay `rgba(2,6,17,.7)`

## Part 2 — Raw source dumps

### `src/css/variables.css` (full)
```css
:root {
  /* Color System - Dark Theme (Default) */
  --color-bg: #020617;
  --color-surface: #0f172a;
  --color-surface-hover: #1e293b;
  --color-text: #f8fafc;
  --color-text-muted: #94a3b8;

  --color-primary: #22c55e;
  --color-primary-hover: #16a34a;
  --color-primary-active: #15803d;
  --color-primary-text: #052e16;
  --color-primary-bg: rgba(34,197,94,0.15);

  --color-error: #ef4444;
  --color-error-bg: rgba(239,68,68,0.15);

  --color-success: #22c55e;
  --color-success-bg: rgba(34,197,94,0.15);

  --color-warning: #f59e0b;
  --color-warning-bg: rgba(245,158,11,0.15);

  --color-border: #1e293b;
  --color-input-bg: #0f172a;
  --color-input-border: #334155;
  --color-input-focus: #22c55e;

  /* Spacing Scale */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* Typography */
  --font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans Arabic", sans-serif;
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 15px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 22px;
  --font-size-2xl: 28px;

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;

  /* Effects */
  --shadow-sm: none;
  --shadow-md: none;
  --shadow-lg: none;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;

  /* SVG Logo Colors - tuned for WCAG AA contrast */
  --svg-accent: #22c55e;
  --svg-accent-hover: #16a34a;
  --svg-text: #f8fafc;

  /* Layout */
  --max-width: 420px;
  --max-width-wide: 680px;
  --header-height: 56px;
}
```

### `src/css/theme.css` (full)
```css
/* Light Theme Override */
@media (prefers-color-scheme: light) {
  :root {
    --color-bg: #f8fafc;
    --color-surface: #ffffff;
    --color-surface-hover: #f1f5f9;
    --color-text: #0f172a;
    --color-text-muted: #64748b;
    --color-border: #e2e8f0;
    --color-input-bg: #ffffff;
    --color-input-border: #cbd5e1;

    --color-primary: #16a34a;
    --color-primary-hover: #15803d;
    --color-primary-active: #166534;
    --color-primary-text: #ffffff;

    --color-error-bg: rgba(239,68,68,0.08);
    --color-success-bg: rgba(34,197,94,0.08);
    --color-warning-bg: rgba(245,158,11,0.08);

    --svg-accent: #15803d;
    --svg-accent-hover: #166534;
    --svg-text: #0f172a;
  }
}

/* Manual Theme Toggle Override */
[data-theme="light"] {
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-surface-hover: #f1f5f9;
  --color-text: #0f172a;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;
  --color-input-bg: #ffffff;
  --color-input-border: #cbd5e1;

  --color-primary: #16a34a;
  --color-primary-hover: #15803d;
  --color-primary-active: #166534;
  --color-primary-text: #ffffff;

  --color-error-bg: rgba(239,68,68,0.08);
  --color-success-bg: rgba(34,197,94,0.08);
  --color-warning-bg: rgba(245,158,11,0.08);

  --svg-accent: #15803d;
  --svg-accent-hover: #166534;
  --svg-text: #0f172a;
}

[data-theme="dark"] {
  --color-bg: #020617;
  --color-surface: #0f172a;
  --color-surface-hover: #1e293b;
  --color-text: #f8fafc;
  --color-text-muted: #94a3b8;
  --color-border: #1e293b;
  --color-input-bg: #0f172a;
  --color-input-border: #334155;
  --color-input-focus: #22c55e;
  --color-primary: #22c55e;
  --color-primary-hover: #16a34a;
  --color-primary-active: #15803d;
  --color-primary-text: #052e16;
  --color-primary-bg: rgba(34,197,94,0.15);
  --color-error: #ef4444;
  --color-error-bg: rgba(239,68,68,0.15);
  --color-success: #22c55e;
  --color-success-bg: rgba(34,197,94,0.15);
  --color-warning: #f59e0b;
  --color-warning-bg: rgba(245,158,11,0.15);
  --svg-accent: #22c55e;
  --svg-accent-hover: #16a34a;
  --svg-text: #f8fafc;
}
```

### config-driven injection block (from `src/templates/base.html:30-63`)
```html
<style>
{{ css }}
  /* Dynamic Theme Overrides from config.json — scoped to the DARK theme. */
  :root {
    {% if config.theme.cardRadius %}
    --radius-md: calc({{ config.theme.cardRadius }} - 4px);
    --radius-lg: {{ config.theme.cardRadius }};
    {% endif %}
  }
  {% if config.theme.primaryColor or config.theme.backgroundColor %}
  [data-theme="dark"] {
    {% if config.theme.primaryColor %}
    --color-primary: {{ config.theme.primaryColor }};
    --color-input-focus: {{ config.theme.primaryColor }};
    --color-primary-hover: {{ config.theme.primaryColor }}e6;
    --color-primary-active: {{ config.theme.primaryColor }}cc;
    --svg-accent: {{ config.theme.primaryColor }};
    --color-primary-bg: {{ config.theme.primaryColor }}26;
    --color-success: {{ config.theme.primaryColor }};
    --color-success-bg: {{ config.theme.primaryColor }}26;
    {% endif %}
    {% if config.theme.backgroundColor %}
    --color-bg: {{ config.theme.backgroundColor }};
    {% endif %}
  }
  {% endif %}
</style>
```

### Pre-paint theme script (`src/templates/base.html:12-25`)
```html
<script>
  (function() {
    try {
      var m = document.cookie.match(/(?:^| )hotspot_theme=([^;]+)/);
      var t = m ? decodeURIComponent(m[1]) : null;
      if (t !== 'light' && t !== 'dark') {
        t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
      }
      document.documentElement.setAttribute('data-theme', t);
    } catch (err) { /* keep the hardcoded dark default */ }
  })();
</script>
```
`<html lang dir data-theme="dark">` default; `<meta name="theme-color" id="metaThemeColor" content="#020617">` updated by JS to `#f8fafc`/`#020617`.
