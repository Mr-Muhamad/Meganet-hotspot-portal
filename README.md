# MikroTik Hotspot Portal 2026

> Production-ready captive portal for MikroTik RouterOS v6 and v7

A modern, lightweight captive portal template system designed for MikroTik routers. Features a clean minimalist UI, full bilingual support, and zero external dependencies — engineered to work reliably inside restrictive captive portal browser environments (iOS CNA, macOS CNA, Android, Windows).

---

## Features

- **Modern minimalist UI** with automatic dark/light mode via `prefers-color-scheme`
- **Full RouterOS v6 and v7 compatibility** — uses `$(var)` safe templates
- **CHAP and PAP authentication** — with MD5 challenge-response support
- **Trial login support** — configurable trial uptime via hotspot profile
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

## Installation

### RouterOS v6

1. **Build first** (requires Node.js 16+):
   ```
   npm install
   npm run build
   ```

2. **Upload the contents of `dist/`** to router flash storage via WinBox Files panel or FTP:
   ```
   /file print
   # Upload all files from dist/ to flash/hotspot/
   ```

3. **Configure hotspot server profile** to use custom templates:
   ```routeros
   /ip hotspot profile set [find name="hsprof1"] html-override-directory=flash/hotspot
   ```

4. **Set login method** on the hotspot server:
   ```routeros
   # For PAP (simpler, compatible with all browsers):
   /ip hotspot set [find] login-by=http-pap
   
   # For CHAP (more secure, requires md5.js):
   /ip hotspot set [find] login-by=http-chap
   ```

5. **Verify** that MikroTik `$(variable)` injection works by visiting the login page and checking that `$(hostname)`, `$(link-login)`, etc. resolve correctly.

### RouterOS v7

1. **Build first**, then **upload the contents of `dist/`** to router storage (flash or tmpfs):
   ```routeros
   /file print
   # Upload all files from dist/ to flash/hotspot/
   ```

2. **Configure hotspot profile** with HTML override:
   ```routeros
   /ip/hotspot/profile set [find name="hsprof1"] html-override-directory=flash/hotspot
   ```

3. **Same login configuration** as v6:
   ```routeros
   /ip/hotspot set [find] login-by=http-pap
   ```

4. **Optional**: Enable `api.json` endpoint for RFC 7710 captive portal detection:
   ```routeros
   /ip/hotspot set [find] use-radius=yes
   ```

---

## Configuration

### Authentication Methods

| Method | RouterOS Config | Notes |
|---|---|---|
| HTTP-PAP | `login-by=http-pap` | Simplest, widest compatibility |
| HTTP-CHAP | `login-by=http-chap` | Requires `md5.js`, challenge-response |
| MAC Auth | `login-by=mac` | No login page shown, auto-auth |
| Trial | Set `trial-uptime` in profile | Enables trial button on login page |
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

### Content Security Policy

The portal is compatible with strict CSP headers:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

### Additional Security Measures

- **No sensitive data** stored in `localStorage` or `sessionStorage`
- **HTTPS support** via `$(ssl-login)` for encrypted credential transmission
- **No cookies** set by the portal template (RouterOS manages auth cookies)
- **CHAP authentication** prevents plaintext password transmission
- **Form autocomplete** disabled on credential fields

---

## Troubleshooting

### Login Page Not Loading

**Symptom**: User connects to WiFi but sees blank page or connection error.

**Fix**:
1. Verify hotspot server is running: `/ip hotspot print`
2. Check `html-override-directory` path exists and files are present
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
1. This portal uses zero external resources by design
2. If you've added custom external resources, add them to walled garden
3. Better: inline or self-host all resources

### Variables Not Resolving

**Symptom**: Page shows literal `$(variable)` text instead of values.

**Fix**:
1. Verify files are in the correct `html-override-directory`
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
npm install        # install build/test dependencies
npm run build      # production build (minified) → dist/
npm run build:dev  # development build (no minification)
npm run watch      # rebuild on src/ changes
npm test           # Jest unit tests
npm run validate   # check dist/ completeness, MikroTik vars, a11y markers
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
