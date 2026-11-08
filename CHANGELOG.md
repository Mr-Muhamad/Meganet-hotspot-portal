# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.1] - 2026-11-08

### Fixed
- **The voucher scanner could not read real camera photos of real cards** (reported from the field with a live card): the vendored llqrcode engine (jsqrcode, 2009-era) failed 5/5 simulated phone photos of the card — any JPEG compression or frame noise defeats it, and it only ever worked on clean rendered images or on devices with the native `BarcodeDetector` (absent on iOS and desktop). Replaced with **vendored jsQR 1.4.0 (MIT, 127 KB lazy-loaded)** — it decoded the same card at every framing (5/5), and multi-scale attempts (full + half, both inversions) cover small QRs inside large photos. llqrcode.js removed; the QR pipeline now also resets BOTH hidden file inputs so re-picking the same photo fires again. The card's payload itself (`=<code>` — generators print an `=` prefix) was already handled by the digit normalization; pinned by a unit test. **Verified in the field**: the same card scans on the live network with this build
- **Credential link cards (mikhmon `http://<dnsname>/login?username=X&password=Y`) now log in IN PLACE instead of navigating**: the old flow navigated to the printed URL, which (a) broke whenever the printed `$dnsname` no longer resolved or differed from how the user reached the portal (IP vs name) — a dead card despite valid credentials — and (b) allowed a swapped QR sticker carrying a `username` parameter to navigate users to ANY foreign host (the `hasLoginParam` rule defeated the phishing guard). The scanner now extracts the credentials from the payload and submits them to the portal's own login endpoint: faster (no navigation + 500 ms wait), immune to stale `$dnsname`, and the portal is never left. Usernames are kept raw (letters preserved — the digit normalizer would have corrupted them); mikhmon `up`-cards keep their carried password via `data-scanned-password`, cleared after use so a later passwordless scan cannot inherit it. Non-credential URLs navigate only within the portal (same host / private IP) — foreign ones are rejected
- **alogin trapped Android users with the back button**: the post-login redirect used `location.href`, leaving the alogin entry in history — pressing back re-entered alogin, whose 1 s countdown fired the user forward again, an inescapable bounce. All navigations (countdown, Continue Now, the catch-path last resort) now use `location.replace`; and when RouterOS provides no destination at all (a direct login carrying no `dst` — e.g. a QR login opened straight in the browser), the page no longer reloads itself every second forever: it stays as a terminal "connected" screen with the CNA guidance

## [2.2.0] - 2026-11-07

### Fixed
- **The session-warning banner rendered EMPTY on every status page**: the new `#session-warning` element carried the `hidden` attribute, but `.alert`'s `display: flex` beats the UA stylesheet's `[hidden]` rule — guarded with `.alert[hidden] { display: none; }` (found by visually inspecting the README screenshots, not by any test)
- **The particle background leaked callbacks without bound**: `animate()` scheduled `requestAnimationFrame` twice per drawn frame (top + bottom), so the pending-callback chain grew ~15/s for as long as the page stayed open — progressive jank and battery drain that got worse by the minute. The top call alone sustains the loop
- **Scroll jank from non-passive touch listeners**: the canvas pointer-link handlers only read coordinates and never `preventDefault` — `touchmove`/`touchend` are now `{ passive: true }`
- **Performance round (measured audit — raw sizes matter, RouterOS serves uncompressed)**: the app icon was 1022×1020 / 185.7 KB while the manifest declares 512×512 — resized to a true 512 and quantized to **41.9 KB (−77%)**; the status auto-check now measures the LOCAL router latency only, and the upstream internet probe (a 4 s hanging external request when the WAN is down, waking the phone's radio) runs on explicit tap

### Changed
- **README hero rebuilt as composites**: all six pages (login, status, logout, plans, alogin, expired) × both themes in a 2×3 grid, plus the three login modes (voucher / normal / both) — four captioned images stitched by `scripts/compose-screenshots.py`; the visual-audit E2E covers all six pages and a new `login-modes.spec.js` captures the served login per `loginMode` build

## [2.1.0] - 2026-11-07

### Fixed
- **The light theme was silently broken since config-driven theming** (theme audit): the config color injection sat on `:root` AFTER the `[data-theme]` blocks — same specificity, later position — so light mode switched surfaces while the page background and brand colors stayed dark forever, and the `prefers-color-scheme` media block was dead code. Found by the first E2E test that ever measured the real painted background. Now: config injection scoped to `[data-theme="dark"]`, the first visit follows the OS color scheme (it used to force dark), a pre-paint `<head>` script applies the stored/OS theme before first paint (no more dark flash on every navigation), the toggle toast and aria-label are localized, `meta theme-color` is set and updated per theme, and the announcement banner gets a white glass pill in light mode
- **CHAP hashed the still-empty password in voucher mode**: the template's inline `onsubmit="return doLogin()"` runs BEFORE any `addEventListener` handler, and the voucher→password copy lives in `onFormSubmit` — on CHAP-enabled profiles voucher logins hashed nothing and then sent the plain code over the hash. `init()` now strips the inline attribute and registers `chapHashOnSubmit` AFTER the copy, guarded to genuine RouterOS challenges (32-hex `chap-id` — un-substituted template text in test environments never hashes); `window._doLogin` remains as a delegating alias, and the legacy `submitLoginForm` fallback runs the copy by hand
- **Nothing indicated a login in flight**: the Connect button stayed tappable during the slow router round trip, so double-taps double-POSTed and burned rate-limiter slots — while the `setLoadingState` helper written for exactly this was dead code targeting a nonexistent `submit-btn` ID. It now targets `loginButton`: disabled + spinner + localized «جارٍ الاتصال…», with a 15 s watchdog that unfreezes if navigation never happens. Blocked paths (rate-limit, minimum length) return before the freeze and leave the button live
- **logout.html showed Download and Upload swapped**: RouterOS hotspot counters are named from the router's perspective — `bytes-in` = received FROM the user = upload, `bytes-out` = sent TO the user = download. status.js had it right; logout had it backwards. Swapped, with a comment documenting the convention
- **The session/quota warnings never appeared**: `showWarnings()` targeted a `#session-warning` element that did not exist in `status.html` — "session expires soon" (<5 min left) and "data limit almost reached" (≥90% quota) were dead on arrival, with hardcoded English strings. The banner now exists (shared `alert-warning` styling) and both texts are localized
- **Connection Quality confused a working router link with working internet**: the card measured latency to the router's own `api.json`, so a logged-in user with a dead WAN saw "ممتاز (5ms)". The local latency reading stays, then an upstream probe (`connectivitycheck.gstatic.com/generate_204`, no-cors, 4 s abort) downgrades the card to «لا يوجد اتصال بالإنترنت» when the internet behind the router is dead
- **The OTP auto-submit sent truncated codes** (removed by decision): voucher codes are variable length, and firing the submit when the typed length hit exactly `voucherMinLength` (4) pushed incomplete codes that failed on the router and lost the typed value on the error reload — with the outcome depending on typing speed. Typing submits via Connect/Enter only; the paste handler stays (a paste is a complete code by definition, gated at ≥ min); QR scans and mikhmon link cards are untouched
- logout.html's h1 and subtitle both bound to `logout_success` (identical text twice — new `logout_title`); alogin said "Redirecting in 1 seconds" (`second_one` picks the singular); plans.html's empty state was hardcoded English (`plans_empty`)
- **README screenshots were stale**: the committed `theme-*.png` set predated the two-button scanner row, the hint separation/«أو» separator, and the banner color fixes — all six refreshed from the current build (the links themselves were never broken); alt texts normalized. `npm audit fix` bumped svgo past three high advisories (dev-only dependency)

### Changed
- The gallery button returned to **icon-only** per user preference (the visible label was a regression on the intended design; the localized tooltip/aria remain)

### Fixed
- **Auto-login never sent credentials to the router** (found while verifying mikhmon-format support — a real, years-old bug): both auto-login paths (the `?voucher=` URL handler and the `enableClonePrevention` countdown) called `form.submit()`, which per the HTML spec bypasses **every** submit handler — the voucher→username/password copy in `onFormSubmit`, the rate limiter, the minimum-length guard, and even the CHAP `onsubmit="return doLogin()"` hashing. So an auto-login POSTed `username=<$(username-esc) or empty>&password=&voucher=<code>`, and RouterOS (which only knows `username`/`password`) ignored the bare `voucher` field — failing the very login the auto-login was for. Both paths now go through `auth.submitLoginForm()`, which uses `requestSubmit()` so the submit runs exactly like a real button press (CHAP hashing, copying, guards all fire); a legacy `submit()` fallback covers browsers without `requestSubmit`. Proven by E2E that intercepts the POST and asserts what the router receives
- **mikhmon-format link cards logged in with the wrong password**: mikhmon prints QRs encoding `http://<dnsname>/login?username=<u>&password=<p>` (both fields always, for both its `vc` and `up` card modes). `vc` cards (username = password) worked by coincidence; `up` cards (different password) had the voucher copied over the real password. The login page now honors a carried `?password=` (stashed in `data-scanned-password`, preferred over the configured copy/blank default even under `voucherPasswordMode: "empty"`), and `?username=` fills the username field when the voucher input isn't shown
- **In the system captive-portal mini-browser the scanner was a dead button** — verified on a real device (Redmi Note 10 Pro, Android's `CaptivePortalLogin` app) via adb: tapping "تصوير الكارت" fired **zero intents** — no file chooser, no camera, no permission prompt. That app's WebView never implements `WebChromeClient.onShowFileChooser()`, so every `<input type="file">` is silently swallowed, and its stripped WebView also has no `getUserMedia`. Chrome on the same phone handles the same page fine — this is OS code, unfixable from the page. The fix is honesty + an escape hatch: the scanner now **detects this WebView** (`; wv)` / `Version/4.0 Chrome` UA markers, excluding in-app browsers like Facebook/WhatsApp which do implement the chooser) and swaps the modal for a guide — the dead photo button is hidden, a message explains scanning isn't available in the sign-in window, the user is pointed at the **phone's own Camera app** (scanning the printed card's QR there logs in automatically — works from the lock screen), and an **"افتح في المتصفح الكامل" escape button** (unpinned `intent://` URL + `S.browser_fallback_url`, so the device's default browser resolves) jumps out to a real browser where everything works. Covered by 5 unit tests; an E2E test pins the CaptivePortalLogin UA and asserts the guide replaces the dead scanner
- **On-device verification round (adb-driven, Redmi Note 10 Pro / Android 13, live hotspot at 192.168.8.1)**: (1) the WebView-detection guide works in production — the dead photo button is hidden and the guide shows inside the real CaptivePortalLogin; (2) the **intent:// escape works end-to-end**: our button → Android's own one-time security screen ("The network you are trying to join is requesting to open another application" → **CONTINUE ANYWAY VIA BROWSER**) → **Chrome opens on the Arabic login page** (`dumpsys` confirmed `com.android.chrome/ChromeTabbedActivity` focused); (3) **DHCP option 114 reached the client and Android 13 queried `api.json`** — then rejected it with `Invalid captive portal API protocol: http`: the RFC 8908 path **requires an HTTPS API URL**, so on a plain-HTTP hotspot it stays inert and the escape button is the working answer; the runbook (§5) now documents this hard requirement with the v6/v7 command split (v6 has no `force` parameter — and needs none, it always sends configured options)
- **QR scanner: removed the stale "(قريبا)"** from the Arabic button label — the button was live while the label advertised it as "coming soon"
- **First-visit language ignored the browser on the page everyone actually lands on**: `ui.initLang()` hardcoded Arabic for cookie-less visitors, so every English-phone user intercepted by RouterOS (which serves `login.html` directly — `index.html` and its browser detection is never seen) got an Arabic form they had to toggle off. `initLang()` now calls `i18n.detectLang()` — a helper that existed since 2.0 but had zero callers; first visit follows `navigator.language`, falling back to Arabic. Verified with locale-pinned E2E contexts in both directions
- **The rate-limit alert bypassed i18n entirely**: `handleRateLimit()` built bilingual text from an inline `lang === 'ar'` ternary while no dictionary keys existed — the same pattern already fixed in `status.js`. Now `i18n.t('rate_limit_message', { time: auth.formatRetryTime(ms) })` with `time_*` vocabulary in both dictionaries
- **`detectLang` unit test passed for the wrong reason**: `util` is a free global in the concatenated bundle and was undefined under jest, so `detectLang()` always took its catch path — the "returns Arabic by default" assertion was testing the fallback-by-error. The suite now sets `global.util` and covers browser detection, the unsupported-language fallback, cookie precedence, and a throwing navigator
- **`i18n.t()` could not interpolate**: dynamic values (the block duration, the expected voucher length) had no way to reach a dictionary string; `t(key, { n: 10 })` now substitutes `{n}` tokens (unmatched tokens left intact). The i18n-audit key collector was widened accordingly — it previously missed `i18n.t('key', {...})` calls and ternary-chosen keys
- **Particle background ignored `prefers-reduced-motion`** while the README claims WCAG AA; a matching media query now hides the canvas and skips the animation loop
- **Phantom `validator.js` in the docs**: `ARCHITECTURE.md` and `CONTRIBUTING.md` documented an "Input validation" module that never existed (6 modules, not 7); the user-input flow diagram and the example commit/test commands now describe the validation that does exist (HTML `pattern`/`required` + the new pre-submit checks)
- **README Walled Garden section self-contradicted the new deploy runbook**: it claimed "zero external resources, so entries are only needed for custom additions" and used the layer-7 command for HTTPS hosts — the QR scanner and WhatsApp links are pre-login HTTPS navigations and need layer-3 entries. Corrected with a cross-reference

### Added
- **Minimum-click scanner: one tap opens the camera, the modal is gone** (follow-up to the on-device round, answering "can the camera open without so many taps?"): the scan button previously cost 2 taps to reach the camera in a real browser (button → modal → photograph) and 5+ in the captive-portal WebView (button → guide → escape → system confirm → button again → photograph). Now: **in any working browser the scan button fires the camera directly** — one tap, native camera app, photo, decode, auto-login countdown; feedback moved to toasts. **In the stripped captive-portal WebView the same tap fires the intent:// escape immediately** (no guide modal — Android's own confirmation screen explains itself), the landing URL carries `qrscan=1` which **pulses the scan button** once so the next tap is obvious (marker stripped from the URL afterwards; animation respects `prefers-reduced-motion`). Net: camera in 1 tap in browsers, browser in 2 taps inside the portal WebView (the second being Android's unavoidable security screen), 1 tap total with printed link cards + the native camera app. The `qrModal` markup, the guide variant, and the HTTPS-only live-camera path were removed — one lean flow instead of three; if HTTPS ever returns, the live-camera code is in git history. Also fixed en route: the file-input `change` listener lost its attachment point when the modal was removed (caught by the new one-tap E2E), `qrScanner.onPageLoad()` is guarded like `rateLimiter` (its absence must never kill the `?voucher=` auto-login), stale `hotspot_last_voucher` no longer leaks across auth unit tests, and "reading the code…" became a toast
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

- **2.2.1**: Field-proven scanning (jsQR replaces llqrcode — real cards now read from camera photos), credential link cards log in in-place (stale-$dnsname-immune, phishing route closed), alogin back-button trap fixed
- **2.2.0**: Performance round (rAF leak, passive touch, 77% smaller icon, tap-only upstream probe), empty-warning-box fix, composite README visuals for all pages and login modes
- **2.1.0**: Real-device-hardened login (in-page QR scanner, captive-portal escape), theme system fixed end-to-end, login submit hardening (CHAP ordering, frozen Connect button), honest status pages (live warnings, upstream internet check), page audit fixes across status/plans/alogin/logout
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
- [x] QR code login
- [ ] Analytics dashboard
- [ ] Multi-language support (more languages)
- [ ] Custom themes
- [ ] API for external integrations