# Routes / Pages — Meganet Hotspot Portal

Not a SPA — RouterOS hotspot serves static built HTML files from `dist/`. Build (`build.js`, Nunjucks) compiles 8 page templates × 2 languages (EN root `dist/<page>.html`, AR `dist/ar/<page>.html` with `dir="rtl"`). RouterOS substitutes `$(variable)` tokens server-side before serving.

| Page (template) | RouterOS servlet role | Content summary |
|---|---|---|
| `src/templates/login.html` | Captive portal login (the front door; served to every intercepted client) | Announcement banner slot → login card (brand title SVG + login/subtitle, `$(error)` alert slot, voucher OR normal credential form per `config.features.loginMode` = `voucher_only` shipped, QR scan row [camera + gallery] under the voucher input, Connect button) → card footer (plans link + IP/MAC copy chips) |
| `src/templates/status.html` | Authenticated session status | Wide shell; warning banner slot; PWA banner; status grid (IP/uptime/session-time/quota stat-cards + progress bars); session countdown; smart-usage assistant; tech-details accordion; logout + refresh actions |
| `src/templates/alogin.html` | Post-login redirect screen | Success icon, "connected" state, 1s countdown → `$(link-orig)`, CNA guidance |
| `src/templates/logout.html` | After logout | Logged-out summary (username/uptime/bytes), 5s countdown back to login |
| `src/templates/expired.html` | Session expired | Warning icon + expired alert + re-login actions |
| `src/templates/error.html` | Auth error | Error alert + retry |
| `src/templates/plans.html` | Subscription plans (static marketing page) | Plans grid of `plan-card`s (quota/name/price/icon), CTA to login |
| `src/templates/index.html` | Landing (rarely served — login.html is the entry) | Language/theme pre-redirect |

All pages extend `base.html` (shell: header/brand/toggles, main, footer, support FAB + modal, install modal, network canvas).

## Build wiring (`build.js`)

- CSS concatenated in fixed order into one inline `<style>`: `variables.css → theme.css → reset.css → layout.css → components.css → utilities.css → media.css`
- JS modules concatenated per page (`util` always first): login = `i18n, rate-limiter, auth, qr-scanner, ui`; status = `i18n, rate-limiter, status, ui`; others = `i18n, ui` — exposed as `window.Hotspot.*`
- i18n: `src/i18n/en.json` + `ar.json` (flat snake_case keys) merged and injected as `#i18n-data` JSON; `data-i18n*` attributes for static text
- Config: `config.json` is the single source (network "ميجا نت", neon `#22c55e`, `loginMode: "voucher_only"`, 7 plans, 2 support agents, `cardRadius 18px`, network background ON)
- dist is fully self-contained: no external requests (only same-origin `md5.js`, lazily-fetched `jsQR.js`, `assets/`)
