# Design System — Meganet Hotspot Portal (ميجا نت)

## Product context

MikroTik RouterOS **captive portal** for a commercial WiFi voucher network ("ميجا نت" / Meganet) in Egypt. Customers buy printed voucher cards (QR-coded), connect to the WiFi, and the phone auto-opens THIS portal. The portal is the network's face: enter a voucher code (or scan the card's QR), get online, check session/quota, find support, browse plans.

- **Users:** phone-first (Android majority + iOS), Arabic-speaking, non-technical; captive-portal WebViews are common
- **JTBD:** (1) connect with a voucher in under 10 seconds, (2) know how much time/quota remains, (3) reach support fast, (4) see what plans exist
- **Key pages:** login (front door — primary design target), status (session data), plans, alogin/logout/expired/error (small cards)

## Branding & current styling (ground truth for reproduction)

- **Palette (dark default):** near-black navy page `#020617`, navy surfaces `#0f172a`, text `#f8fafc`/muted `#94a3b8`, borders `#1e293b` — brand **neon green `#22c55e`** (gradient buttons `#22c55e→#16a34a`, green glass tints, green glows). Status hues: error `#ef4444`, warning `#f59e0b`, success = primary green; accent emerald `#10b981` (live dot), blue `#3b82f6` (phone/webview-hint)
- **Light theme:** white/slate surfaces `#f8fafc`/`#ffffff`, darker green ramp `#16a34a/#15803d/#166534`
- **Feel:** dark glassmorphism — translucent blurred header/banner/modal surfaces, subtle green glows and pulses, **flat design (all box-shadows `none` — depth via borders + tints)**, neon accents
- **Shape:** cards radius 16px (config `cardRadius: 16px`), controls 10px, chips 6px, FAB/avatar circular
- **Type:** system font stack only (incl. "Noto Sans Arabic"), sizes 12–28px, weights 400–700. NO webfonts
- **Signature elements:** interactive particle-network canvas background (nodes + connecting lines, blue nodes dark theme, ~30fps, reduced-motion aware); pulsing green support FAB; neon announcement banners; animated progress shimmer (`#48ff00` midstop); live status dot badge
- **Real brand assets:** `logo.svg` (roundel mark, used in header + favicon) and `prand-title.svg` ("ميجا نت" wordmark with arrow glyph, used in the login card header) — uploaded as Brand Assets; drafts MUST embed them, never invent substitutes

## Hard constraints (non-negotiable in any redesign)

1. **RTL Arabic is the primary language** (`dir="rtl"`); English secondary. Mirror-safe layouts
2. **Mobile-first**: content column max-width 420px (status 680px); everything must work at 360px
3. **Zero external requests**: no webfonts, no CDN, no analytics — hotspot pages serve offline; total page weight matters (RouterOS serves uncompressed)
4. **All features preserved**: voucher input + QR camera scan + gallery scan + typing hints, plans link, IP/MAC copy chips, support FAB + agent cards (call/whatsapp), theme toggle (dark/light, cookie-persisted), language toggle, install-app modal, announcements, error alerts, caps-lock warning
5. **Contrast**: WCAG AA in BOTH themes (light-mode text on glass needs tuned darker shades — a past bug source)
6. **Class names / DOM structure are a contract** with unit tests and JS — a restyle changes skins, not the component skeleton or flows
7. RouterOS serves static files: CSS must stay plain vanilla (no preprocessor assumptions)

## Motion

Respect `prefers-reduced-motion` (kill animations). Existing patterns: hover translateY(-1px/-2px), pulses (support FAB, QR attention, status dot), banner slide-in, tab fade, progress shimmer, toast in/out. Speeds: 150ms fast / 250ms normal / 0.3–0.5s entrances.

## Notes for variations

The user has approved exploring **three distinct redesign directions** (light minimal / premium glass dark / brand gradient) as branches of a faithful reproduction of the CURRENT login page. Each branch prompt defines its own palette/type treatment; structure, content, RTL, and every feature element above MUST remain present and unchanged. When a branch changes the visual identity, apply it consistently across every visible element on the page (header, card, buttons, inputs, hints, chips, FAB, footer, canvas).
