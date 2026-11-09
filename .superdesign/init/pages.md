# Page dependency trees — Meganet Hotspot Portal

Templates extend `base.html`; every page = base shell + its template block + the shared CSS stack + its JS modules. There are no component imports — the "dependency tree" is template → CSS stack → JS modules → assets.

## login (the front door — primary design target)
Entry: `src/templates/login.html` (extends `src/templates/base.html`)
Dependencies:
- src/templates/base.html (shell: header/brand/toggles, footer, support FAB + modal, install modal, network canvas, pre-paint theme script, i18n-data, config theme injection)
- src/css/variables.css (tokens)
- src/css/theme.css (3 palette blocks)
- src/css/reset.css (body/RTL/focus)
- src/css/layout.css (page-shell, header, footer)
- src/css/components.css (card, buttons, forms, alerts, divider, link-btn, auth-tabs, plans-link, support modal, announcement banner, install guide, network-bg)
- src/css/utilities.css (utility classes)
- src/css/media.css (skip-link, toggles, caps-lock, toasts, loading overlay, qr-buttons-row/qr-scan-btn, login-card-footer, footer__device-info/device-chip, form-hint/qr-scan-hint/qr-hint-or, qr-scan-pulse, breakpoints, reduced-motion)
- src/js/modules/util.js (i18n.t, showToast, formatTime)
- src/js/modules/i18n.js (init/detect/apply, data-i18n attributes)
- src/js/modules/rate-limiter.js (attempt throttling)
- src/js/modules/auth.js (voucher/normal handling, QR wiring, CHAP hash on submit)
- src/js/modules/qr-scanner.js (lazy jsQR loader, scan/gallery flow)
- src/js/modules/ui.js (theme toggle, particle canvas, support modal, announcements)
- src/assets/logo.svg (inlined into header via `logoInline`)
- src/assets/prand-title.svg (inlined into card header via `prandTitleInline`)
- src/assets/icon.png (apple-touch-icon)
- src/i18n/en.json + ar.json (login keys: login_title, login_subtitle, voucher_label, voucher_placeholder, voucher_hint, qr_scan_btn_text, qr_gallery_btn_aria, login_button, plans_link, …)
- `$(...)` RouterOS tokens: `$(link-login-only)`, `$(link-orig)`, `$(chap-id)`, `$(error-esc)`, `$(username-esc)`, `$(ip)`, `$(mac-esc)`, `$(popup)`, `$(hostname)`

Render branch actually served (voucher_only, shipped config): normal-credential panels are `display:none`, voucher panel visible, QR row + typing hint visible, announcements loaded via XHR.

## status (widest page)
Entry: `src/templates/status.html` (extends base.html)
Dependencies: same CSS stack + `status.js` module (countdowns, quota calc, warnings incl. new expiry watcher, connection quality, smart-usage) + ui.js. Wide shell (680px). `$(session-time-left)`, `$(uptime)`, `$(bytes-in/out)`, `$(limit-bytes-total)`, `$(link-logout)` tokens. Warning banner `#session-warning` with `data-logout-url`.

## plans
Entry: `src/templates/plans.html` — plans-grid of plan-cards from `config.plans` (7 plans: quota/name/price/icon), CTA back to login. Same CSS stack; ui.js only.

## alogin / logout / expired / error
Small centered cards (success icon + countdown / summary / warning + actions / error + retry). Same shell; `i18n, ui` modules only. RouterOS tokens per servlet.

## index
Minimal landing; language/theme redirect logic only.
