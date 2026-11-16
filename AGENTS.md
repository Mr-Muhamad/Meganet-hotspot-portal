# AGENTS.md

Guidance for AI agents and human contributors working in this repository. Coding
standards live in [CONTRIBUTING.md](CONTRIBUTING.md); this file records the
runtime support decisions that supplement them.

## Browser Support

The project ships two distinct browser targets. Do not blur their floors:

- **Portal (`src/` → `dist/`)** — runs inside captive-portal browsers (iOS CNA,
  Android CaptivePortalLogin WebView, desktop CNA; see the "Browser
  Compatibility" section in README.md).
  - **JS syntax stays ES5** (`var`, `function`, no arrow functions) per
    CONTRIBUTING.md §JavaScript.
  - **DOM APIs** may use anything as new as `replaceChildren()`
    (Chrome/Edge 86+, Firefox 83+, Safari 14+) without polyfills or feature
    detection.
  - **CSS floor is `:has()`** (`src/css/media.css`) — Chrome/Edge 105+,
    Safari 15.4+, Firefox 121+. This is the strictest requirement in the
    portal and is already shipped; older OEM WebViews are visually unsupported
    by `portal.css` regardless of JS.
- **Studio (`admin/public/`, Electron 45 / bundled Chromium)** — any API the
  bundled Chromium supports is allowed without fallbacks (e.g.
  `structuredClone()`).

## Rules

1. **No polyfills** and no custom fallback code for captive-portal WebViews
   older than the `:has()` floor — they fail on existing CSS before any JS
   matters.
2. **Raising a floor is a deliberate decision**: if a change needs a newer API
   than recorded here, update this file **and** the README "Browser
   Compatibility" table in the same commit.
3. **Vendored libraries** (`src/js/md5.js`, `src/static/jsQR.js`) are excluded
   from all of the above — never refactor them for style.
