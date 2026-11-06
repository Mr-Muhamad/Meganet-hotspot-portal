# MikroTik Hotspot Portal 2026

> Production-ready captive portal for MikroTik RouterOS v6 and v7

A modern, lightweight captive portal template system designed for MikroTik routers. Features a clean minimalist UI, full bilingual support, and zero external dependencies — engineered to work reliably inside restrictive captive portal browser environments (iOS CNA, macOS CNA, Android, Windows).

---

## Features

- **Modern minimalist UI** with automatic dark/light mode via `prefers-color-scheme`
- **Full RouterOS v6 and v7 compatibility** — uses `$(var)` safe templates
- **CHAP and PAP authentication** — with MD5 challenge-response support
- **Arabic (RTL) and English (LTR) bilingual support** — with `dir="rtl"` and `lang="ar"`
- **Mobile-first responsive design** — optimized for 360px+ viewports
- **Captive portal browser compatible** — iOS CNA, macOS CNA (900×572), Android, Windows
- **XSS-safe MikroTik variable handling** — all `$(var)` injected values are escaped
- **Under 150KB per page** — no external dependencies, no CDN calls
- **WCAG AA accessible** — semantic HTML, proper contrast, focus indicators
- **System font stack** — zero font downloads, instant rendering
- **Inline SVG icons** — no icon font, no external requests

---

## Architecture

### Multi-Page Static Template Model

The portal uses a **multi-page architecture** where each page is a self-contained HTML file with inline CSS and JavaScript. This is a deliberate design constraint imposed by the **iOS Captive Network Assistant (CNA)** — a restricted WebView that:

- Blocks external stylesheet `<link>` tags in many iOS versions
- Blocks external `<script src>` tags inconsistently
- Has a fixed viewport of approximately 900×572px on macOS
- Enforces strict CSP-like restrictions on resource loading

By inlining all CSS and JS, every page renders correctly in any captive portal browser without external resource dependencies.

### Page Flow

```
redirect.html → login.html → alogin.html → $(link-redirect)
                   ↓
              status.html → logout.html
```

- `redirect.html` — MikroTik intercept page (static, from `src/static/`)
- `index.html` — Language router: detects browser language, then forwards to the matching portal
- `login.html` — Main authentication page (voucher / PAP / CHAP)
- `alogin.html` — Auto-login "Connected" page with 3-second redirect target
- `status.html` — Live session stats (quota, time remaining, up/down, smart usage assistant)
- `logout.html` — Session summary + redirect back to login
- `error.html` — Error display — messages localized through RouterOS `errors.txt`
- `expired.html` — Service suspended page
- `plans.html` — Subscription plans rendered from `config.json`

### Why Inline CSS/JS

| Constraint | Impact |
|---|---|
| iOS CNA blocks `<link>` | CSS must be inline |
| iOS CNA blocks `<script src>` | JS must be inline |
| macOS CNA fixed viewport | Layout must adapt to 900×572 |
| No caching in CNA | Each page must be self-sufficient |
| LAN speed is fast | Inline bloat is negligible (~40KB) |

---

## File Structure

```
Meganet-New-hotspot/
├── config.json             # ★ Portal settings: branding, theme, plans, support, features
├── build.js                # Build script: Nunjucks + CSS/JS bundling + minify → dist/
├── md5.js                  # MD5 for CHAP authentication (copied to dist/)
├── src/
│   ├── templates/          # Nunjucks templates (base.html + index, login, status,
│   │                       #   logout, error, expired, plans, alogin)
│   ├── css/                # CSS modules (variables, theme, reset, layout,
│   │                       #   components, utilities, media) — inlined at build
│   ├── js/modules/         # IIFE modules (util, auth, ui, i18n, status,
│   │                       #   rate-limiter) — inlined at build
│   ├── i18n/               # en.json / ar.json translation dictionaries
│   ├── static/             # RouterOS files copied verbatim (never minified):
│   │                       #   redirect.html, errors.txt
│   └── assets/             # logo.svg, prand-title.svg, icon.png, support photos
├── dist/                   # ★ Build output — upload this directory to the router
│   ├── *.html              # English pages
│   ├── ar/                 # Arabic (RTL) pages
│   ├── assets/             # Static assets
│   ├── md5.js              # CHAP hashing
│   ├── errors.txt          # RouterOS localized error messages
│   └── redirect.html       # MikroTik intercept page
└── docs/                   # SVG sources (logo.txt, favicon.txt)
```

---

## Local Preview

`scripts/preview.mjs` serves `dist/` with **realistic demo data** — every RouterOS
template variable (`$(ip)`, `$(username-esc)`, `$(uptime)`, `$(bytes-in-nice)`
and friends) and every conditional (`$(if error)`, `$(if chap-id)`,
`$(if session-time-left)` …) is substituted so you can review the portal exactly
as a connected user would see it — including the Arabic (RTL) variants.

```
npm run preview                  # connected user (10 GiB quota, mid-session)
npm run preview:open             # same, and open the browser
npm run preview:error            # login page showing a RADIUS error
node scripts/preview.mjs --scenario chap       # CHAP login mode
node scripts/preview.mjs --scenario unlimited  # session without byte quota
node scripts/preview.mjs --scenario captive    # captive-portal detected client
node scripts/preview.mjs --port 9000           # different port (default 8765)
```

The startup output lists every page URL in both languages. Pages under `/ar/`
stay Arabic and pages at the root stay English (the server sets the language
cookie for you; `--no-pin-lang` hands the language decision back to the portal,
which is what the E2E tests use to exercise its Arabic-first redirect).
`index`, `alogin`, and `logout` navigate away by design —
index detects the browser language, alogin redirects after 3 s (iOS CNA path),
logout after 5 s.

---

## Deployment

Everything below assumes you have built `dist/` first (see [Local Preview](#local-preview)):

```
npm install
npm run validate:config   # aborts the build on a broken config.json
npm run build
```

`dist/` is the **only** thing that goes on the router — `src/`, `config.json`, and `node_modules/` never leave your machine. Editing files directly on the router means your next rebuild silently overwrites them.

### 1. Upload `dist/` to the router

Drag the **contents** of `dist/` (not the folder itself) into a new folder on the router, e.g. `hotspot-portal/`, via the WinBox **Files** panel, or FTP:

```
ftp> mkdir hotspot-portal
ftp> cd hotspot-portal
ftp> mput dist/*        # preserve the ar/ subdirectory and md5.js
```

The resulting layout must be:

```
hotspot-portal/
├── login.html  status.html  alogin.html  logout.html  …   (English, root)
├── redirect.html  error.html  errors.txt  md5.js  api.json
├── ar/                                                   (Arabic mirror)
│   ├── login.html  status.html  …  errors.txt
├── assets/  (icon, logo, agent photos)
└── announcements.json  manifest.json
```

`redirect.html`, `md5.js`, and `errors.txt` are required by RouterOS itself — a clean rebuild always emits them, but partial uploads commonly miss them.

### 2. Point the hotspot profile at the folder

> The property is `html-directory-override`. (`html-override-directory` is not a real RouterOS property and will be rejected.)

```routeros
# v6
/ip hotspot profile set [find name="hsprof1"] html-directory-override=hotspot-portal

# v7 — same property, REST-style path
/ip/hotspot/profile set [find name="hsprof1"] html-directory-override=hotspot-portal
```

On flash-backed devices the folder lives under `flash/` but the property still takes the folder name as the router sees it — verify with `/file print` and keep the two in sync.

### 3. Set the login method

```routeros
# CHAP (recommended — password never sent in the clear; needs md5.js, which ships in dist/)
/ip hotspot set [find] login-by=http-chap

# PAP (fallback for locked-down browsers)
/ip hotspot set [find] login-by=http-pap
```

If you authenticate against User Manager or another RADIUS server, also set `use-radius=yes` — and note that with `use-radius=yes`, local `/ip hotspot user` entries are bypassed entirely.

### 4. Walled garden — the step that silently breaks features

Unauthenticated clients can only reach hosts you allow. This portal has **no external CSS/JS/font/CDN dependencies**, but two features on the pre-login pages do call out:

| Feature | Host | Where |
|---|---|---|
| QR card scanner (`enableQRScanner`) | `laksa19.github.io` | button on `login.html` |
| WhatsApp support (`config.support.agents`) | `wa.me` | support modal, all pages |

Both are HTTPS, so they must go into the **layer-3** walled garden (`walled-garden/ip`) — the layer-7 `/ip/hotspot/walled-garden` only matches plain HTTP:

```routeros
/ip hotspot walled-garden ip add dst-host=laksa19.github.io action=accept comment="meganet-portal"
/ip hotspot walled-garden ip add dst-host=wa.me action=accept comment="meganet-portal"
```

Skip either and the QR button and support chat simply fail for a not-yet-logged-in user. Tag entries with a `comment=` so future re-runs can be cleaned up idempotently:

```routeros
/ip hotspot walled-garden ip remove [find comment="meganet-portal"]
```

### 5. Captive-portal discovery (optional)

`dist/api.json` is a RouterOS-templated [RFC 7710](https://datatracker.ietf.org/doc/html/rfc7710) API document — RouterOS substitutes `$(...)` inside it like any other file in the override directory, so no extra setup is needed for clients that probe for it. To also advertise the portal proactively, add DHCP option 114 ([RFC 8910](https://datatracker.ietf.org/doc/html/rfc8910)):

```routeros
/ip dhcp-server option add name=captive-portal code=114 force=yes value="'http://$(hotspot-address)/api.json'"
/ip dhcp-server option sets add name=captive-portal-set options=captive-portal
/ip dhcp-server set [find] dhcp-option-set=captive-portal-set
```

`force=yes` is required — without it, clients whose DHCP Parameter Request List omits code 114 (iOS, Android) silently never see the option. Note that the hotspot subsystem is IPv4-only; IPv6 clients are not intercepted.

### 6. Post-deploy verification

Walk through this once with a real device that has never connected before:

1. **Intercept**: connect → the login page appears (in Arabic for Arabic browsers, English otherwise)
2. **Variables**: view page source — no raw `$(...)` tokens anywhere; `$(username)`, `$(mac)` etc. are substituted server-side
3. **Failed login**: the error appears in the user's language. If a RADIUS Reply-Message comes through in English, `util.translateError()` swaps it to Arabic client-side — verify with a bad voucher
4. **QR scanner** (if enabled): the button actually opens the scanner page (walled garden from step 4)
5. **Successful login**: `alogin.html` → status page shows real session data (uptime, bytes in/out)
6. **Connection quality**: the quality card reports a latency (`… ms`) — if it says "Offline" on the Arabic status page, the `ar/` subdirectory upload from step 1 was incomplete
7. **Logout**: status → logout → the logout page renders, and the session is gone on reconnect
8. **Language toggle**: switching once persists across pages for that device

### Updating the portal later

1. Edit `config.json` / templates on your machine
2. `npm run build`
3. Re-upload `dist/` contents over the same folder (WinBox drag-drop replaces files)
4. No router config changes are needed unless `config.json` changed feature flags that need walled-garden entries (new support agent hosts, a different `qrScannerUrl`)

> Never keep a second copy of the templates in the router's default `hotspot/` directory — a profile without `html-directory-override` serves the old built-in files and the two copies will drift.

---

## Configuration

### Authentication Methods

| Method | RouterOS Config | Notes |
|---|---|---|
| HTTP-PAP | `login-by=http-pap` | Simplest, widest compatibility |
| HTTP-CHAP | `login-by=http-chap` | Requires `md5.js`, challenge-response |
| MAC Auth | `login-by=mac` | No login page shown, auto-auth |
| Trial | Set `trial-uptime` in profile | RouterOS-side only — these templates render no trial button |
| Cookie | `login-by=cookie` | Returning user auto-login |
| RADIUS | `use-radius=yes` | External auth server required |

Multiple methods can be combined:
```routeros
/ip hotspot set [find] login-by=http-pap,http-chap,cookie,mac
```

### Theme Customization

All visual branding is driven by **`config.json`** — edit it, run `npm run build`, and the values are injected into every page as CSS custom property overrides. No HTML editing required:

| Key | Purpose |
|---|---|
| `theme.primaryColor` | Primary brand color (Hex) — buttons, links, focus rings, SVG accents |
| `theme.backgroundColor` | Dark background tone |
| `theme.cardRadius` | Card/button corner radius |
| `theme.enableNetworkBackground` | Interactive animated canvas background |
| `general.networkName` | Network name shown in the header |
| `general.poweredByText` / `poweredByUrl` / `poweredByName` | Footer branding |
| `radiusErrorTranslations` | English→Arabic map for RADIUS/User Manager error messages on the Arabic login page (longest-key-first substring match; unknown messages pass through unchanged) |

Base design tokens live in `src/css/variables.css` and `src/css/theme.css`.

Dark mode is automatic via `@media (prefers-color-scheme: dark)`.

### Language Configuration

The portal ships with **English (LTR)** and **Arabic (RTL)**.

The build produces every page twice: English at the root of `dist/` and Arabic under `dist/ar/` (with `dir="rtl"` and `lang="ar"`). MikroTik routes clients to the matching directory based on the hotspot server's language handling.

- `index.html` detects the browser language and forwards Arabic browsers to `ar/login.html`, everyone else to `login.html` (with a `<noscript>` fallback and manual links).
- The header language toggle (`features.enableLanguageToggle`) switches languages at runtime and remembers the choice via cookie.
- Translation strings live in `src/i18n/en.json` (contains both `en` and `ar` sections) and `src/i18n/ar.json` (overrides the Arabic section at build time).

**To add a new language** (e.g., French):

1. Add the strings to `src/i18n/` (a `fr` section or `fr.json`)
2. Add `'fr'` to the two build loops and the `loadTranslations()` merge in `build.js`
3. Set the correct `dir` mapping in `generatePage()` (`lang === 'ar' ? 'rtl' : 'ltr'` logic extended for the new language)

### Walled Garden

To allow external resources (if needed), configure the walled garden:

```routeros
/ip hotspot walled-garden add dst-host=*.google.com
/ip hotspot walled-garden add dst-host=*.gstatic.com
/ip hotspot walled-garden add dst-host=*.apple.com
/ip hotspot walled-garden add dst-host=captive.apple.com
```

**Note**: This portal requires **zero external resources**, so walled garden entries are only needed if you add custom external fonts, analytics, or CDN resources.

Common walled garden entries for captive portal detection:
- `captive.apple.com` — iOS/macOS detection
- `connectivitycheck.gstatic.com` — Android detection
- `msftconnecttest.com` — Windows detection

---

## MikroTik Variables Reference

These `$(variable)` placeholders are injected by RouterOS at runtime:

| Variable | Description | Used On |
|---|---|---|
| `$(hostname)` | Router/Hotspot name | login, status, logout |
| `$(link-login)` | Login form action URL | login |
| `$(link-logout)` | Logout URL | status, logout |
| `$(link-status)` | Status page URL | login, logout |
| `$(link-redirect)` | Post-login redirect | login, alogin |
| `$(link-login-only)` | Login URL without redirect | login |
| `$(link-orig)` | Original URL user requested | login |
| `$(username)` | Authenticated username | status, logout |
| `$(ip)` | Client IP address | status, logout |
| `$(mac)` | Client MAC address | status |
| `$(uptime)` | Session duration | status, logout |
| `$(session-time-left)` | Remaining session time | status |
| `$(bytes-in-nice)` | Downloaded data (formatted) | status |
| `$(bytes-out-nice)` | Uploaded data (formatted) | status |
| `$(limit-bytes-in)` | Download quota | status |
| `$(limit-bytes-out)` | Upload quota | status |
| `$(error)` | Error message | error |
| `$(error-orig)` | Raw error code | error |
| `$(ssl-login)` | HTTPS login URL | login |
| `$(chap-id)` | CHAP challenge ID | login |
| `$(chap-challenge)` | CHAP challenge string | login |
| `$(trial)` | Trial available flag | login |
| `$(link-trial)` | Trial login URL | login |

**Security**: All variables are XSS-escaped before injection into HTML context. Never use `$(var)` inside `<script>` tags without additional sanitization.

---

## Browser Compatibility

| Platform | Browser | Status | Notes |
|---|---|---|---|
| iOS | Captive Network Assistant | **Full** | Inline CSS/JS required |
| macOS | Captive Network Assistant | **Full** | 900×572px viewport |
| Android | Chrome Custom Tab | **Full** | Standard behavior |
| Android | Samsung Internet | **Full** | Standard behavior |
| Windows | Edge / Default Browser | **Full** | Redirect via browser |
| Linux | Firefox / Chrome | **Full** | Manual redirect |

### Known CNA Limitations

- **iOS CNA**: No `localStorage`, no `<link>` stylesheets, no file downloads
- **macOS CNA**: Fixed 900×572 viewport, no window resize, limited JS APIs
- **Android CNA**: Generally full browser, but some OEMs use restricted WebViews

**Features that silently degrade without `localStorage`** (all guarded with try/catch, so the page never breaks):

| Feature | Behavior in CNA |
|---|---|
| Auto-login with last voucher | Never activates — user enters the code each time |
| Login attempt rate limiting | Counter resets on every page load |
| PWA banner dismissal | Banner reappears on each visit |
| Voucher/normal mode memory | Always defaults to voucher |

The rate limiter is a UX guard only — real brute-force protection must be server-side (RouterOS firewall rules or RADIUS policy).

---

## Performance

| Metric | Value |
|---|---|
| First Paint | < 1s on LAN |
| Page Weight (login.html) | ~40KB worst case |
| Page Weight (status.html) | ~25KB |
| External Dependencies | Zero |
| Font Downloads | Zero (system font stack) |
| Icon Requests | Zero (inline SVG) |
| CSS Requests | Zero (inline `<style>`) |
| JS Requests | 1 (`md5.js` for CHAP only) |
| Total Render Blocking | None |

All pages are designed to render instantly on low-power devices over WiFi LAN connections. The inline architecture eliminates all network round-trips for assets.

---

## Security

### XSS Prevention

All MikroTik `$(variable)` values are injected into HTML attribute or text contexts with proper escaping. The template system avoids:

- Injecting variables into `<script>` blocks
- Using `innerHTML` with MikroTik values
- Unescaped URL parameters in redirects

Note that RouterOS has **no HTML-escape variant** for its variables (only `-esc` URL-encoding), so any new template work must keep `$(username)`-style values out of raw HTML attribute interpolation.

### Content Security Policy

The portal is compatible with strict CSP headers:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

### Client-Side Login Throttling — What It Is and Is Not

The `security` section in `config.json` (`maxAttempts`, `blockDurationMinutes`) drives a login-attempt throttle that runs entirely in the browser (`src/js/modules/rate-limiter.js`, persisted in the device's `localStorage`):

- ✅ It **does**: stop a casual user from hammering the login form with guessed voucher codes — after `maxAttempts` failures the button is disabled for `blockDurationMinutes`
- ❌ It **does not**: provide real brute-force protection. Anything client-side is trivially bypassed (private browsing, clearing site data, a scripted client that skips the JS entirely)

Genuine brute-force protection belongs server-side — RADIUS/User Manager policy, or a firewall rule rate-limiting POSTs to the login servlet. Treat the `security` section as UX/abuse-deterrence config, not a security control, and don't let its name lead you to skip the real thing.

### Additional Security Measures

- **No sensitive data** stored in `localStorage` or `sessionStorage` — the only persistence is the language preference, the throttle counter above, the last voucher (for auto-login), the PWA-banner dismissal, and the chosen theme
- **HTTPS support** via `$(ssl-login)` for encrypted credential transmission
- **CHAP authentication** prevents plaintext password transmission over PAP
- **Form autocomplete** disabled on credential fields

### Data the portal stores on the device

Nothing leaves the browser. All persistence is preferences and counters:

| Storage | Key | Purpose |
|---|---|---|
| cookie (365 d) | `hotspot_lang` | chosen language |
| cookie (365 d) | `hotspot_theme` | chosen theme |
| cookie (7 d) | `hotspot_dismissed_msg` | which announcement was dismissed |
| `localStorage` | `hotspot_rate_attempts` | login-throttle counter |
| `localStorage` | `hotspot_last_voucher` | last voucher, for auto-login (see caveat below) |
| `localStorage` | `hotspot_mode` / `pwa_banner_dismissed` | login tab + install-banner state |

**One honest caveat**: with `voucherPasswordMode: "same"` (the default), the voucher code *is* the account password — so `hotspot_last_voucher` stores a live credential. This is a deliberate trade-off for the auto-login convenience: it is scoped to the origin (the router's own HTTP server, not a shared web host), anyone with physical access to an unlocked device can read it anyway, and vouchers are typically single-device. If that trade-off is wrong for your network, set `enableClonePrevention: false` in `config.json` and the code is never stored.

---

## Troubleshooting

### Login Page Not Loading

**Symptom**: User connects to WiFi but sees blank page or connection error.

**Fix**:
1. Verify hotspot server is running: `/ip hotspot print`
2. Check `html-directory-override` folder exists and contains `login.html`/`redirect.html`
3. Ensure `redirect.html` is present — MikroTik requires it for initial intercept

### CHAP Authentication Fails

**Symptom**: Login page loads but authentication fails with CHAP enabled.

**Fix**:
1. Ensure `md5.js` is uploaded to the hotspot directory
2. Verify `md5.js` is accessible: browse to `http://router-ip/md5.js`
3. Check that login page references `md5.js` correctly
4. Fallback: switch to `http-pap` if CHAP is not required

### iOS Stuck on "Cancel"

**Symptom**: iOS CNA shows the portal but tapping "Cancel" doesn't dismiss it, or the page reloads.

**Fix**:
1. Ensure all CSS and JS is inline (no external `<link>` or `<script src>`)
2. Verify `redirect.html` returns a proper HTTP redirect
3. Check that `$(link-redirect)` resolves to a reachable URL
4. Test with `captive.apple.com` in walled garden

### External Resources Blocked

**Symptom**: Fonts, images, or scripts from external domains don't load.

**Fix**:
1. The portal itself has zero external CSS/JS/font dependencies by design
2. The QR scanner (`laksa19.github.io`) and WhatsApp support (`wa.me`) links are the exception — add them to the layer-3 walled garden as described in [Deployment step 4](#4-walled-garden--the-step-that-silently-breaks-features)
3. For any custom external host you add: use `/ip hotspot walled-garden ip` (layer 3) for HTTPS destinations — the layer-7 `/ip hotspot walled-garden` only matches plain HTTP

### Variables Not Resolving

**Symptom**: Page shows literal `$(variable)` text instead of values.

**Fix**:
1. Verify files are in the correct `html-directory-override` folder
2. Check that MikroTik is processing the files (not serving from cache)
3. Ensure variable names match RouterOS version (v6 vs v7 syntax)
4. Restart hotspot service: `/ip hotspot reset [find]`

### Arabic Pages Show LTR Layout

**Symptom**: Arabic text appears but layout is left-to-right.

**Fix**:
1. Check that `ar/` pages have `dir="rtl"` on the `<html>` element
2. Verify `lang="ar"` is set
3. Ensure CSS includes RTL-specific styles (margin/padding mirroring)

---

## Tested Versions

| RouterOS Version | Status | Notes |
|---|---|---|
| v6.49.x (LTS) | **Full** | Long-term stable, recommended |
| v7.15.x | **Full** | Stable release |
| v7.18.x | **Partial** | Known DHCP regressions in some builds |

### Version-Specific Notes

- **v6.49.x**: Most stable for production hotspots. Use `$(var)` syntax.
- **v7.15.x**: Full feature parity with v6 templates. Recommended for new deployments.
- **v7.18.x**: Some users report DHCP lease issues with hotspot. Monitor for patches.

---

## Future Expansion

Potential integrations and features for extended deployments:

- **FreeRADIUS / RadiusDesk** — External RADIUS server integration for advanced user management
- **Payment Gateway** — Stripe, PayPal, or local payment processor for paid access tiers
- **SMS/OTP Authentication** — One-time password via SMS gateway (Twilio, local providers)
- **QR Code Login** — Generate QR codes for easy device-to-device credential sharing
- **PWA Support** — Progressive Web App manifest for installable portal experience
- **Customer Portal** — Self-service dashboard for users to manage sessions, view usage, purchase top-ups
- **Voucher System** — Pre-generated access codes for resale or distribution
- **Multi-site Management** — Centralized configuration for chains or MSP deployments

---

## Development

```
npm install             # install build/test dependencies
npm run build           # production build (minified) → dist/ (aborts on invalid config.json)
npm run build:dev       # development build (no minification)
npm run watch           # rebuild on src/ changes
npm test                # Jest unit tests (incl. config schema + i18n health)
npm run validate        # check dist/ completeness, MikroTik vars, a11y markers
npm run validate:config # check config.json against its schema
npm run preview         # serve dist/ with realistic demo data (see Local Preview)
```

Key invariants:

- All CSS/JS is inlined per page (iOS CNA compatibility) — pages make **zero** external requests
- Files in `src/static/` are copied **verbatim** — keep MikroTik `$(if …)` blocks out of `<script>` content there; minifiers would break them
- MikroTik `$(variables)` must survive minification — verified by `npm run validate` plus the build
- Every page inherits `base.html`: config-driven theme, header/footer, support and install modals, i18n data

---

## Documentation

SVG source code for assets is stored as text files in the `docs/` directory:

- `docs/logo.txt` — Primary logo SVG source (shield + WiFi arcs, currentColor)
- `docs/favicon.txt` — Favicon SVG source (minimal WiFi icon, #3b82f6 blue)

To create image assets, copy the SVG code from these files and save as `.svg` files in the `img/` directory.

---

## License

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
