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
redirect.html → login.html → [status.html | alogin.html]
                                   ↓
                              logout.html
```

- `redirect.html` — MikroTik intercept page, redirects to login
- `login.html` — Main authentication page (PAP/CHAP/trial)
- `status.html` — Connection status after successful login
- `alogin.html` — Auto-login redirect target
- `logout.html` — Session termination page
- `error.html` — Error display (auth failure, quota exceeded, etc.)
- `rlogin.html` — Redirect after login (success handler)
- `radvert.html` — Advertisement page (pre-login splash)

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
hotspot/
├── login.html              # Main login page (PAP/CHAP/trial)
├── status.html             # Connection status display
├── logout.html             # Session logout handler
├── alogin.html             # Auto-login redirect
├── error.html              # Error page (auth fail, quota, etc.)
├── redirect.html           # MikroTik intercept redirect
├── rlogin.html             # Post-login redirect handler
├── radvert.html            # Advertisement/splash page
├── md5.js                  # MD5 hash for CHAP authentication
├── img/                    # Image assets (logo, favicon)
│   ├── logo.svg            # Portal logo (see docs/logo.txt)
│   └── favicon.svg         # Browser tab icon (see docs/favicon.txt)
├── ar/                     # Arabic (RTL) translations
│   ├── login.html
│   ├── status.html
│   ├── logout.html
│   ├── error.html
│   └── ...
└── docs/                   # Documentation and SVG source
    ├── logo.txt            # Logo SVG source code
    └── favicon.txt         # Favicon SVG source code
```

---

## Installation

### RouterOS v6

1. **Upload files** to router flash storage via WinBox Files panel or FTP:
   ```
   /file print
   # Upload all files to flash/hotspot/
   ```

2. **Configure hotspot server profile** to use custom templates:
   ```routeros
   /ip hotspot profile set [find name="hsprof1"] html-override-directory=flash/hotspot
   ```

3. **Set login method** on the hotspot server:
   ```routeros
   # For PAP (simpler, compatible with all browsers):
   /ip hotspot set [find] login-by=http-pap
   
   # For CHAP (more secure, requires md5.js):
   /ip hotspot set [find] login-by=http-chap
   ```

4. **Verify** that MikroTik `$(variable)` injection works by visiting the login page and checking that `$(hostname)`, `$(link-login)`, etc. resolve correctly.

### RouterOS v7

1. **Upload files** to router storage (flash or tmpfs):
   ```routeros
   /file print
   # Upload all files to flash/hotspot/
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

The portal uses **CSS custom properties** for easy branding. Edit the `:root` variables in any HTML file:

```css
:root {
  --color-primary: #3b82f6;       /* Primary brand color */
  --color-primary-hover: #2563eb; /* Hover state */
  --color-bg: #ffffff;            /* Page background */
  --color-surface: #f8fafc;       /* Card surfaces */
  --color-text: #0f172a;          /* Primary text */
  --color-text-muted: #64748b;    /* Secondary text */
  --color-border: #e2e8f0;        /* Borders */
  --radius: 12px;                 /* Border radius */
  --font-sans: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
```

Dark mode is automatic via `@media (prefers-color-scheme: dark)` — override the dark theme variables in the `@media` block to customize.

### Language Configuration

The portal supports **English (LTR)** and **Arabic (RTL)** out of the box.

**How it works**: MikroTik's hotspot system uses a `target=` URL parameter to determine language. The `ar/` subdirectory contains Arabic translations that mirror the root HTML files.

- English pages: `login.html`, `status.html`, etc. (root directory)
- Arabic pages: `ar/login.html`, `ar/status.html`, etc.

MikroTik selects the correct directory based on the hotspot server's language setting or the client's `Accept-Language` header.

**To add a new language** (e.g., French):

1. Create a `fr/` subdirectory
2. Copy all root HTML files into `fr/`
3. Translate all user-visible strings
4. Set `dir="ltr"` and `lang="fr"` on each HTML element
5. MikroTik will auto-route based on browser language

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
