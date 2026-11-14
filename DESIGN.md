# Design Direction: Meganet Hotspot Portal & Admin Studio

This project ships two UI surfaces under one RouterOS-compatible codebase. Every visual decision below answers its purpose and platform constraints.

## Surface 1: Captive Portal (`src/`)

- **Audience & Job:** WiFi subscribers authenticating on phones or laptops inside a restricted Captive Network Assistant (iOS/macOS CNA, Android Captive Portal) or mobile browser.
- **Dial:** `ENERGY 1 / RHYTHM 1 / MOTION 1`
  - **ENERGY 1:** Focused utility screen; one primary action per page (voucher/account login on `login.html`, session status on `status.html`, plan choice on `plans.html`).
  - **RHYTHM 1:** Consistent card shell across all portal pages so users transitioning between `login`, `status`, `plans`, and `error` recognize the same trusted portal immediately.
  - **MOTION 1:** Hover/active state transitions and brief entry cues only; all non-essential motion stops under `prefers-reduced-motion: reduce`.
- **Color Palette (R-01, R-29):**
  - Core dark base: `#020617` (`--color-bg`), `#0f172a` (`--color-surface`), `#f8fafc` (`--color-text`).
  - Core light base: `#f8fafc` (`--color-bg`), `#ffffff` (`--color-surface`), `#0f172a` (`--color-text`).
  - Single deliberate brand accent: `--color-primary` (defaults to `#22c55e` in dark / `#15803d` in light; regenerated per client profile at build time via `scripts/color-utils.js`).
  - Semantic accents (`--color-error`, `--color-warning`, `--color-info`, `--color-online`) are reserved strictly for real validation errors, session/network warnings, and active connection status.
- **Typography (R-06):**
  - System UI stack (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans Arabic", sans-serif`) for instant first paint inside CNA without external font requests and within the 1 MB RouterOS flash budget.
- **Glass, Shadow & Motion Caps (R-10, R-12, R-13, R-19):**
  - `backdrop-filter: blur(8px)` is capped at two overlay/floating surfaces only: `.support-modal` and `.announcement-banner`.
  - Shadows and border highlights mark elevation on the active card, floating support trigger, and modals rather than floating every element.
  - Pulse animations (`support-pulse`, `announcement-pulse-*`) run finitely (`3` iterations) to draw attention on load without endless looping.

## Surface 2: Admin Studio (`admin/public/`)

- **Audience & Job:** Network operators configuring client hotspot profiles, testing voucher QR codes, previewing live mobile/tablet layouts, and deploying `.rsc`/portal files to MikroTik RouterOS.
- **Dial:** `ENERGY 1 / RHYTHM 2 / MOTION 1`
  - **ENERGY 1:** High-signal dark engineering workbench; quiet slate panels so the live simulator phone frame and WCAG/flash-memory meters stay the focal points.
  - **RHYTHM 2:** Two-pane workbench (collapsible profile sidebar + tabbed form workspace + optional split-screen simulator) that adapts at tablet/mobile breakpoints.
  - **MOTION 1:** Subtle hover/active feedback and toast fade only, disabled under `prefers-reduced-motion: reduce`.
- **Color Palette (R-01, R-29):**
  - Core dark surfaces: `#0b0f1a` (`--bg`), `#111827` (`--panel`), `#1a2333` (`--panel2`), `#e5e9f2` (`--text`), `#8b99b3` (`--muted`).
  - Single accent: `#22c55e` (`--acc`) / `#16a34a` (`--acc2`) for primary build/deploy actions, active profile/tab state, and focus rings.
- **Iconography & Copy (R-02, R-04):**
  - Clean inline SVGs (`aria-hidden="true"`) or plain Arabic/technical labels; no decorative emojis in controls or headings, and no em dashes (`—`) in UI copy.
