# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Auto-login never sent credentials to the router** (found while verifying mikhmon-format support — a real, years-old bug): both auto-login paths (the `?voucher=` URL handler and the `enableClonePrevention` countdown) called `form.submit()`, which per the HTML spec bypasses **every** submit handler — the voucher→username/password copy in `onFormSubmit`, the rate limiter, the minimum-length guard, and even the CHAP `onsubmit="return doLogin()"` hashing. So an auto-login POSTed `username=<$(username-esc) or empty>&password=&voucher=<code>`, and RouterOS (which only knows `username`/`password`) ignored the bare `voucher` field — failing the very login the auto-login was for. Both paths now go through `auth.submitLoginForm()`, which uses `requestSubmit()` so the submit runs exactly like a real button press (CHAP hashing, copying, guards all fire); a legacy `submit()` fallback covers browsers without `requestSubmit`. Proven by E2E that intercepts the POST and asserts what the router receives
- **mikhmon-format link cards logged in with the wrong password**: mikhmon prints QRs encoding `http://<dnsname>/login?username=<u>&password=<p>` (both fields always, for both its `vc` and `up` card modes). `vc` cards (username = password) worked by coincidence; `up` cards (different password) had the voucher copied over the real password. The login page now honors a carried `?password=` (stashed in `data-scanned-password`, preferred over the configured copy/blank default even under `voucherPasswordMode: "empty"`), and `?username=` fills the username field when the voucher input isn't shown
- **QR scanner: removed the stale "(قريبا)"** from the Arabic button label — the button was live while the label advertised it as "coming soon"
- **First-visit language ignored the browser on the page everyone actually lands on**: `ui.initLang()` hardcoded Arabic for cookie-less visitors, so every English-phone user intercepted by RouterOS (which serves `login.html` directly — `index.html` and its browser detection is never seen) got an Arabic form they had to toggle off. `initLang()` now calls `i18n.detectLang()` — a helper that existed since 2.0 but had zero callers; first visit follows `navigator.language`, falling back to Arabic. Verified with locale-pinned E2E contexts in both directions
- **The rate-limit alert bypassed i18n entirely**: `handleRateLimit()` built bilingual text from an inline `lang === 'ar'` ternary while no dictionary keys existed — the same pattern already fixed in `status.js`. Now `i18n.t('rate_limit_message', { time: auth.formatRetryTime(ms) })` with `time_*` vocabulary in both dictionaries
- **`detectLang` unit test passed for the wrong reason**: `util` is a free global in the concatenated bundle and was undefined under jest, so `detectLang()` always took its catch path — the "returns Arabic by default" assertion was testing the fallback-by-error. The suite now sets `global.util` and covers browser detection, the unsupported-language fallback, cookie precedence, and a throwing navigator
- **`i18n.t()` could not interpolate**: dynamic values (the block duration, the expected voucher length) had no way to reach a dictionary string; `t(key, { n: 10 })` now substitutes `{n}` tokens (unmatched tokens left intact). The i18n-audit key collector was widened accordingly — it previously missed `i18n.t('key', {...})` calls and ternary-chosen keys
- **Particle background ignored `prefers-reduced-motion`** while the README claims WCAG AA; a matching media query now hides the canvas and skips the animation loop
- **Phantom `validator.js` in the docs**: `ARCHITECTURE.md` and `CONTRIBUTING.md` documented an "Input validation" module that never existed (6 modules, not 7); the user-input flow diagram and the example commit/test commands now describe the validation that does exist (HTML `pattern`/`required` + the new pre-submit checks)
- **README Walled Garden section self-contradicted the new deploy runbook**: it claimed "zero external resources, so entries are only needed for custom additions" and used the layer-7 command for HTTPS hosts — the QR scanner and WhatsApp links are pre-login HTTPS navigations and need layer-3 entries. Corrected with a cross-reference

### Added
- **In-page voucher QR scanner** (new `qr-scanner.js` module + a modal on the login page): the scan button originally navigated users fully off-portal to `laksa19.github.io/myqr` — a third-party page running `arc.io` analytics, needing a walled-garden entry, and (decisively) navigating to whatever the *QR itself* contains, so bare-code cards died at `window.location = "1234567890"`. An intermediate self-hosted `qr.html` page replaced it, and this iteration removed the navigation entirely: the button now opens an **inline modal on the login page** (same `support-modal` system as the support/install dialogs), and everything happens where the user stands. Supports **both card systems**: a link card (mikhmon's `http://…/login?username=X&password=Y`) scans straight to its URL; a bare code fills the voucher field and starts the cancellable 3-second auto-login countdown. Two scan paths: **photograph the card** (primary — a `capture="environment"` file input hands off to the phone's *native* camera app, so it works on plain-HTTP hotspots and in webviews with no permission prompt) and **live camera** (progressive enhancement — `getUserMedia` is a secure-context-only API, so that section appears on HTTPS hotspots only; on plain HTTP the photo path is the whole feature by design). The modal always offers a "type the code manually" escape hatch for the stripped captive-portal mini-browsers (iOS CNA, Android CaptivePortalLogin) where even file pickers may be blocked. jsqrcode (Apache-2.0) is vendored as `llqrcode.js`, **lazy-loaded on first open** so the login page payload stays lean; `features.qrScannerUrl` remains as an optional external override. Covered by 6 jest checks (`routeScan` dual-mode routing, `normalizeVoucherText`) + 5 E2E tests that decode **real QR PNG fixtures** in Edge, including the full in-place pipeline (photo → decode → countdown → POST the router actually receives)
- **`auth.beginAutoLogin(voucherValue)`** — the cancellable 3-second auto-login countdown extracted from `triggerAutoLogin` and shared with the QR scanner; its hardcoded bilingual strings ("تسجيل دخول تلقائي بآخر كارت…") became `auto_login_countdown`/`cancel` dictionary keys (the same i18n pattern fixed in `status.js` and the rate-limit alert). Also added `auth.normalizeVoucherText()` (Arabic/Persian numeral conversion + digits-only stripping, previously inline in the voucher input handler) — the scanner reuses it so photographed Eastern-Arabic numerals behave like typed ones
- **Voucher minimum-length pre-flight check** (`features.voucherMinLength` in `config.json`, schema-validated): codes shorter than the floor are rejected inline with a localized alert — "كود الشحن لا يقل عن 4 أرقام" — before the form makes a slow round trip to the router. Voucher lengths are variable on this network, so only a **minimum** is enforced (a fixed-length check would falsely reject valid codes); the shipped config sets `4`. `null`/unset disables. Covered by 5 unit tests (below-minimum blocked, at-minimum passes, longer codes pass since only the floor matters, unset disabled, no alert stacking) and documented in a new "Login Settings" table in the README

### Changed
- **Playwright config now runs the default client as an Arabic-browser device** (`locale: 'ar-EG'`) — the portal follows the browser language, so tests that exercise the Arabic portal must look like Arabic clients; tests needing an English browser create their own `en-US` context (two new: ar-redirect + English-stays-and-persists)
- Removed the stale machine-language note from the README Language section ("MikroTik routes clients…") in favor of the actual detection flow

### Fixed
- **Caps Lock warning was incomplete since 2.0**: the CSS (`.caps-lock-warning`), the JS handler (`auth.detectCapsLock`) and the i18n keys all existed, but the HTML element was never added to any template — the feature silently did nothing on every keypress. Added the element to `login.html` (hidden in `voucher_only` mode via the same `data-mode-panel` conditional as the password field); verified end-to-end in a real browser in `both` mode (hidden → visible on CapsLock → hidden again)
- **status.js hardcoded bilingual strings**: the connection-quality card ("Checking…/Excellent/Good/Poor/Offline") and the remaining-quota percentage ("remaining/متبقي") built strings from inline `isAr` ternaries while the matching dictionary keys sat unused. Both now go through `i18n.t()`, and the previously-unused `i18n.t()` helper finally has production callers
- **Consolidated duplicate error-translation code**: `ui.js` carried a hardcoded 29-key Arabic error dictionary (`mapRouterErrorToArabic`) while a newer config-driven implementation was added in parallel — merged into ONE implementation: `util.translateError()` (URL-artifact cleanup for RouterOS GET-passed errors, documented RouterOS formats with usernames by regex, longest-key-first keyword map with whole-message replacement to avoid mixed-language output; unknown messages pass through cleaned but unchanged) driven by a single 47-key `radiusErrorTranslations` map in `config.json`, injected as `window.HotspotErrorMap` by the login template; `ui.translateRouterError()` is now a thin wrapper that caches the raw error in `data-raw-error` for correct re-translation on language toggle
- **Clone prevention**: auto-login read the form element before it was defined, so `enableClonePrevention: false` was ignored during auto-login
- **i18n**: added missing `redirecting` and `seconds` keys (Arabic logout page showed hardcoded English); added `captive_notice` to the Arabic dictionary; removed a duplicate `expired_alert_text` key
- **Build completeness**: `redirect.html`, `alogin.html`, and `errors.txt` (RouterOS localized error messages) are now copied from `src/static/` on every build (previously lost on a clean rebuild)
- **Error message localization**: `errors.txt` was a single bilingual file ("English / عربي" on every line), so RouterOS showed every error in both languages at once; it is now split into `src/static/errors.txt` (English) and `src/static/ar/errors.txt` (Arabic) — RouterOS language routing (`target=ar`) now serves properly localized messages, and subdirectories under `src/static/` are preserved by the build

### Added
- **Deploy runbook** (README "Deployment" section, replaces the thin Installation stub): full `dist/` upload layout with the required-by-RouterOS files (`redirect.html`, `md5.js`, `errors.txt`) called out, the correct profile property (`html-directory-override` — the old README's `html-override-directory` is not a real RouterOS property and would be rejected), CHAP/PAP and `use-radius` notes, and a **walled-garden step** documenting the two HTTPS hosts the pre-login pages actually need (`laksa19.github.io` for the QR scanner, `wa.me` for support) — both must live in the layer-3 `walled-garden ip` list, not the HTTP-only layer-7 one, or the features silently fail for unauthenticated clients. Plus RFC 7710/8910 captive-portal discovery (option 114 with `force=yes`), an 8-point post-deploy verification walk-through, and the "never edit on the router" update workflow

### Fixed
- **README honesty pass**: the Security section claimed "no cookies set by the portal template" while the portal sets `hotspot_lang`/`hotspot_theme`/`hotspot_dismissed_msg`; it also never mentioned the client-side throttle at all. Now: the `security` config section is explicitly labeled UX deterrence, not brute-force protection (bypassed by clearing site data; real protection belongs in RADIUS/firewall), and a full device-persistence inventory table replaces the false "no sensitive data" bullet — including the honest caveat that `hotspot_last_voucher` stores a live credential when `voucherPasswordMode: "same"` (opt out with `enableClonePrevention: false`)
- **README claimed trial-login support** — no template renders a trial button (the `enableTrial` config key was already removed as dead); the claim is gone and the auth-methods table now says trial is RouterOS-side only
- **Agent avatar photos loaded eagerly on every page** though they only appear in the support modal — `loading="lazy"` on `base.html` avatar `<img>`s

### Changed
- **`html-override-directory` → `html-directory-override`** everywhere in README (4 occurrences incl. Troubleshooting) — the documented property name was word-scrambled and would have failed on paste

### Added
- **Local preview server** (`scripts/preview.mjs`, `npm run preview`): serves `dist/` with realistic demo data — all RouterOS variables (`$(ip)`, `$(username-esc)`, `$(uptime)`, `$(bytes-in-nice)`, `$(link-*)`, …) and conditionals (`$(if error)`, `$(if chap-id)`, `$(if session-time-left)`, comparison forms in `redirect.html`) substituted, so every page can be reviewed in both languages exactly as a connected user sees it. Scenarios: `default` (connected user, 10 GiB quota), `error` (failed login), `chap` (CHAP challenge), `unlimited` (no byte quota), `captive`. The server pins the language cookie to the URL so `/en` pages don't auto-redirect to Arabic (`--no-pin-lang` hands the decision back to the portal, which is what the E2E tests rely on)
- **RADIUS / User Manager error translation**: error messages arriving via `radius-reply` (raw English Reply-Message text) are now translated to Arabic on the login page. Added `util.translateError()` (documented RouterOS formats with usernames handled by regex; configurable substring map, longest-key-first, fragment-only replacement so dynamic values survive; English pages unaffected; unknown messages pass through unchanged) driven by a new `radiusErrorTranslations` map in `config.json`, and the Arabic `errors.txt` now wraps `radius-reply` with a translated prefix
- **Coverage for real RouterOS v6 / User Manager replies**: verified against messages reported from production — `invalid Calling-Station-Id`, `user <270029> not found` (new regex keeps the account number in the output), `no valid profile found`, `transfer limit reached`, `traffic limit reached`, `your traffic limit is reached`, `simultaneous session limit reached`, `no more sessions are allowed for user`. Added 3 missing map entries (`invalid calling-station-id`, `transfer limit reached`, `traffic limit is reached` — the last so "your traffic limit is reached" matches the full sentence instead of the terse `traffic limit` fragment) and a jest block running all 8 production messages against the shipped `config.json` map
- **config.json schema validation** (`scripts/validate-config.js`, `npm run validate:config`): a declarative schema (types, enums — `loginMode`, `voucherPasswordMode`, `quotaDisplayFormat`, `kbBase`, plan icons — formats for colors/CSS lengths/numeric prices/whatsapp digits, required fields, cross-field rule for `qrScannerUrl`) that reports actionable path-qualified errors instead of letting a typo like `loginMode: "vucher_only"` silently degrade the portal. Runs as a **build gate** (`build.js` aborts on invalid config) and as **jest coverage** (`tests/modules/config-schema.test.js`, 13 checks including per-mistake error classes, no state leakage between calls, and non-fatal warnings for agent images missing from `src/assets/`)
- **End-to-end tests** (`tests/e2e/`, `npm run test:e2e`): 20 Playwright checks running the built `dist/` through `scripts/preview.mjs` on Edge — auto-redirect to the Arabic portal, language switching via the toggle, client-side RADIUS error translation, caps-lock warning toggle, connection-quality probe, collapsible tech details, plans rendering, and a "no raw RouterOS variable leaks" sweep. The servers start automatically (`--no-pin-lang` so the portal's own Arabic-first logic is what's tested)

### Fixed
- **Connection quality showed "Offline" on every Arabic status page**: `checkConnectionQuality()` fetched a bare relative `api.json`, which resolves one directory up short on `/ar/status.html` → 404 → the catch path wrongly reported "غير متصل". Now resolves `../api.json` on `/ar/` pages (matching how the templates handle `md5.js`/`announcements.json`); guarded by a parametrized unit test and the Arabic E2E check

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