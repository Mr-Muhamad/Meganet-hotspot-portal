# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Caps Lock warning was incomplete since 2.0**: the CSS (`.caps-lock-warning`), the JS handler (`auth.detectCapsLock`) and the i18n keys all existed, but the HTML element was never added to any template — the feature silently did nothing on every keypress. Added the element to `login.html` (hidden in `voucher_only` mode via the same `data-mode-panel` conditional as the password field); verified end-to-end in a real browser in `both` mode (hidden → visible on CapsLock → hidden again)
- **status.js hardcoded bilingual strings**: the connection-quality card ("Checking…/Excellent/Good/Poor/Offline") and the remaining-quota percentage ("remaining/متبقي") built strings from inline `isAr` ternaries while the matching dictionary keys sat unused. Both now go through `i18n.t()`, and the previously-unused `i18n.t()` helper finally has production callers
- **Consolidated duplicate error-translation code**: `ui.js` carried a hardcoded 29-key Arabic error dictionary (`mapRouterErrorToArabic`) while a newer config-driven implementation was added in parallel — merged into ONE implementation: `util.translateError()` (URL-artifact cleanup for RouterOS GET-passed errors, documented RouterOS formats with usernames by regex, longest-key-first keyword map with whole-message replacement to avoid mixed-language output; unknown messages pass through cleaned but unchanged) driven by a single 47-key `radiusErrorTranslations` map in `config.json`, injected as `window.HotspotErrorMap` by the login template; `ui.translateRouterError()` is now a thin wrapper that caches the raw error in `data-raw-error` for correct re-translation on language toggle
- **Clone prevention**: auto-login read the form element before it was defined, so `enableClonePrevention: false` was ignored during auto-login
- **i18n**: added missing `redirecting` and `seconds` keys (Arabic logout page showed hardcoded English); added `captive_notice` to the Arabic dictionary; removed a duplicate `expired_alert_text` key
- **Build completeness**: `redirect.html`, `alogin.html`, and `errors.txt` (RouterOS localized error messages) are now copied from `src/static/` on every build (previously lost on a clean rebuild)
- **Error message localization**: `errors.txt` was a single bilingual file ("English / عربي" on every line), so RouterOS showed every error in both languages at once; it is now split into `src/static/errors.txt` (English) and `src/static/ar/errors.txt` (Arabic) — RouterOS language routing (`target=ar`) now serves properly localized messages, and subdirectories under `src/static/` are preserved by the build

### Added
- **Local preview server** (`scripts/preview.mjs`, `npm run preview`): serves `dist/` with realistic demo data — all RouterOS variables (`$(ip)`, `$(username-esc)`, `$(uptime)`, `$(bytes-in-nice)`, `$(link-*)`, …) and conditionals (`$(if error)`, `$(if chap-id)`, `$(if session-time-left)`, comparison forms in `redirect.html`) substituted, so every page can be reviewed in both languages exactly as a connected user sees it. Scenarios: `default` (connected user, 10 GiB quota), `error` (failed login), `chap` (CHAP challenge), `unlimited` (no byte quota), `captive`. The server pins the language cookie to the URL so `/en` pages don't auto-redirect to Arabic
- **RADIUS / User Manager error translation**: error messages arriving via `radius-reply` (raw English Reply-Message text) are now translated to Arabic on the login page. Added `util.translateError()` (documented RouterOS formats with usernames handled by regex; configurable substring map, longest-key-first, fragment-only replacement so dynamic values survive; English pages unaffected; unknown messages pass through unchanged) driven by a new `radiusErrorTranslations` map in `config.json`, and the Arabic `errors.txt` now wraps `radius-reply` with a translated prefix
- **config.json schema validation** (`scripts/validate-config.js`, `npm run validate:config`): a declarative schema (types, enums — `loginMode`, `voucherPasswordMode`, `quotaDisplayFormat`, `kbBase`, plan icons — formats for colors/CSS lengths/numeric prices/whatsapp digits, required fields, cross-field rule for `qrScannerUrl`) that reports actionable path-qualified errors instead of letting a typo like `loginMode: "vucher_only"` silently degrade the portal. Runs as a **build gate** (`build.js` aborts on invalid config) and as **jest coverage** (`tests/modules/config-schema.test.js`, 13 checks including per-mistake error classes, no state leakage between calls, and non-fatal warnings for agent images missing from `src/assets/`)

### Changed
- **Removed 45 dead i18n keys**: `en.json`/`ar.json` went 122 → 77 keys each — 21 legacy `plan_*` strings made obsolete by the config-driven `plans` array, plus UI leftovers (`site_title`, `welcome`, `forgot_password`, `no_account`, `register`, `or`, `trial_login`, `error_*` fetch-handlers, `theme_dark/light`, `lang_en/ar`, `logout_confirm`, etc.) that no template or module referenced. Rendered pages verified fully translated in both languages after the cleanup
- **New i18n regression guard** (`tests/modules/i18n-audit.test.js`, 4 checks): every template-referenced key (`data-i18n*`, `{{ i18n.x }}`) must exist in BOTH dictionaries; `en`/`ar` key sets must match; and every dictionary key must be referenced by a template or an `i18n.t()` call — so dead keys and missing translations can't silently return
- **alogin.html is now a full template** extending `base.html` — it inherits the config-driven theme, header/footer, and support/install modals like every other page (was a standalone page with its own hardcoded styles); the MikroTik `$(if popup)` status-popup logic and the 3-second iOS CNA redirect path are preserved
- **index.html now detects the browser language** (Arabic browsers → `ar/login.html`, otherwise → `login.html`) instead of the previous hard-coded language swap, with a `<noscript>` fallback and manual links
- Removed dead `enableTrial` config key (never referenced by any code)
- Removed legacy one-off patch scripts and `test-visual.html` (preserved in git history)
- Removed unreferenced root binary artifacts (`icon.png`, `icon1.png`, `iloveimg-compressed.zip`)
- **Inline styles migrated to CSS modules**: 113 inline `style=""` attributes across templates → 13 (all that remain are JS-driven or MikroTik/Nunjucks conditionals, e.g. `$(if session-time-left)` panels); new semantic classes live in `src/css/media.css` (verified via computed-style checks after migration)
- Updated `README.md` and `ARCHITECTURE.md` to document the current build system, `src/static/` layer, `config.json` theming, and `dist/`-based deployment
- Initialized git repository

### Added
- Build system for eliminating code duplication
- Nunjucks template engine for HTML generation
- CSS modules for better organization
- JavaScript modules with IIFE pattern
- Comprehensive testing infrastructure with Jest
- Input validation and sanitization module
- Rate limiting for brute force protection
- Template validation script
- Development and build scripts
- Contributing guidelines
- This changelog

### Changed
- Refactored CSS into separate modules (variables, theme, reset, layout, components, utilities, media)
- Refactored JavaScript into separate modules (util, auth, ui, i18n, status, validator, rate-limiter)
- Improved error handling with try-catch blocks
- Enhanced accessibility with ARIA attributes
- Updated build process to use Nunjucks templates

### Fixed
- RTL layout issues in Arabic version
- Theme persistence across page loads
- Language detection and switching
- Password visibility toggle
- Caps Lock detection

## [2.0.0] - 2024-01-XX

### Added
- Dark/light theme support with system preference detection
- Arabic language support with RTL layout
- Captive portal detection via RFC 7710
- WCAG AA accessibility compliance
- Keyboard navigation support
- Screen reader support
- Reduced motion support
- High contrast mode support
- Mobile-first responsive design
- CSS custom properties for theming
- Toast notifications
- Loading states
- Error handling
- Progress bars for data usage
- Session countdown timer
- Auto-refresh functionality

### Changed
- Modernized HTML structure
- Improved form validation
- Enhanced security practices
- Better error messages
- Responsive design improvements

## [1.0.0] - 2023-XX-XX

### Added
- Initial release
- Basic login functionality
- CHAP authentication support
- PAP authentication support
- Session status display
- Logout functionality
- Error page
- MikroTik RouterOS integration

---

## Version History

- **2.0.0**: Major update with theme support, i18n, accessibility, and build system
- **1.0.0**: Initial release with basic functionality

## Migration Guide

### From 1.x to 2.0

1. **Backup your customizations**: Save any custom CSS or JavaScript
2. **Update templates**: Replace old HTML files with new generated files
3. **Update RouterOS**: Ensure RouterOS v6.45+ or v7.x
4. **Test thoroughly**: Verify all functionality works

### Breaking Changes in 2.0

- HTML structure has changed significantly
- CSS classes have been renamed
- JavaScript functions have been reorganized
- MikroTik variable usage has been standardized

## Future Plans

- [ ] PWA (Progressive Web App) support
- [ ] Payment gateway integration
- [ ] Voucher system
- [ ] QR code login
- [ ] Analytics dashboard
- [ ] Multi-language support (more languages)
- [ ] Custom themes
- [ ] API for external integrations