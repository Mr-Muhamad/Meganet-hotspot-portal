# Extractable components — Meganet Hotspot Portal

This is a **vanilla HTML/CSS/ES5 project** — there are no framework components to convert to Petite-Vue. Components are BEM CSS classes + template markup. Extraction (Step 2.5) is not meaningful here; the shell is inlined per draft. Catalog below serves as the shared-pattern reference instead.

## PortalShell (header + footer + floating widgets)
- Source: `src/templates/base.html` (lines 65-343 markup) + `src/css/layout.css`
- Category: layout
- Description: Sticky glass header (28px logo SVG + network name "ميجا نت" + lang/theme/install icon toggles), flex-centered main, footer "Powered by", floating support FAB (bottom corner, pulse animation), support + install modals, particle canvas background
- Extractable props: `networkName` (string, default "ميجا نت"), `showStatusDot` (boolean — only status/alogin pages), `pageWide` (boolean — status page 680px)
- Hardcoded: logo SVG (`logoInline`), moon/globe/download icons, support chat icon, all CSS

## LoginCard
- Source: `src/templates/login.html` (lines 16-200) + components.css card/buttons/forms + media.css login sections
- Category: layout
- Description: Centered card — brand title SVG ("ميجا نت" wordmark), Sign In title/subtitle, voucher code input (RTL, tel/numeric) with QR scan row (camera button + square gallery button) and typing hint, Connect primary button, footer with plans link + IP/MAC copy chips
- Extractable props: `loginMode` (voucher_only | normal_only | both), `errorText` (string), `voucherHint` (string)
- Hardcoded: prand-title SVG, all icons (QR, gallery, enter-arrow), RouterOS `$(error)` alert slot, all CSS

## PlanCard
- Source: `src/templates/plans.html` + components.css:386-529
- Category: basic
- Description: Row card — circular icon chip, quota (bold lg) + plan name (xs muted), price chip (primary-bg pill)
- Extractable props: `quota`, `name`, `price`, `icon`
- Hardcoded: radial glow ::before, RTL row-reverse, all CSS

## StatCard (status page)
- Source: `src/templates/status.html` + media.css:158-195
- Category: basic
- Description: Grid cell — 24px primary icon, xs muted label, lg semibold value
- Extractable props: `icon`, `label`, `value`, `wide` (boolean), `interactive` (boolean)
- Hardcoded: all CSS

## AnnouncementBanner
- Source: `src/templates/login.html:5-14` + components.css:786-946
- Category: layout
- Description: Glass pill banner with icon circle + rotating text; warning (amber neon pulse) and promo (green neon pulse) variants; light-mode readable overrides
- Extractable props: `variant` (warning | promo), `text`
- Hardcoded: neon palettes, slide-in keyframe, all CSS

## SupportModal
- Source: `src/templates/base.html:240-289` + components.css:531-765
- Category: layout
- Description: Blurred overlay + centered card, 2-column agent cards (avatar ring + name/role + call/whatsapp buttons)
- Extractable props: `agents` (array: name, role, image, phone, whatsapp)
- Hardcoded: WhatsApp green `#22c55e` / phone blue `#3b82f6` accents, all CSS

## Icons
All UI icons are inline stroke SVGs (24×24, stroke-width 2, currentColor): moon (theme), globe (lang), download (install), chat (support), eye/eye-off (password), QR frame, gallery, bag (plans), phone, whatsapp, key/wifi (plan icons), alert triangle, check circle. Reproduce 1:1 from the markup above.
