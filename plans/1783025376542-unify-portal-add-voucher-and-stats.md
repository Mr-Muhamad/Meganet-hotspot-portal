# Plan: Unify Portal + Voucher Mode + Live Status Stats

## Goal
Make the portal buildable from one template system, add Voucher mode where the same code is used as both username and password, and show live session stats on the Status page.

## Decisions
- **Unified build only**: delete legacy root HTML, `css/hotspot.css`, `js/hotspot.js`, `ar/*.html`, `redirect.html`, and orphaned `r*/f*` files. Use only `src/`, `build.js`, and `dist/`.
- **Voucher mode**: a tab on Login that switches to a single "Voucher Code" field; on submit, the same value is sent as both `username` and `password`. Works in both PAP and CHAP.
- **Languages**: keep English and Arabic only.
- **Stats**: live session stats on `Status` only: download, upload, session time, time remaining, uptime, and usage progress bars.

## Implementation Steps

### 1. Unify and Clean
1. Remove legacy files:
   - root `login.html`, `status.html`, `logout.html`, `error.html`
   - `css/hotspot.css`, `js/hotspot.js`
   - `ar/*.html`, `redirect.html`
   - `rlogin.html`, `rstatus.html`, `radvert.html`, `flogin.html`, `flogout.html`, `fstatus.html`
2. Keep `src/`, `build.js`, `dist/`, and test files.
3. Verify `npm run build` produces `dist/login.html`, `dist/status.html`, `dist/logout.html`, `dist/error.html`, and `dist/ar/*`.

### 2. Add Voucher Mode
1. Update `src/templates/login.html`:
   - Add Normal/Voucher tabs
   - Voucher tab shows one input: "Voucher Code"
   - On submit, copy voucher value into both `username` and `password` before POST
   - Keep CHAP flow intact: same hashing path applies after copying
2. Update `src/js/modules/auth.js`:
   - Add `auth.initVoucherMode()`
   - Add `auth.getVoucherValue()` that returns the voucher input value
   - Update login handler to support voucher copy-to-both-fields behavior
3. Update i18n:
   - `src/i18n/en.json`: add `voucher_tab`, `normal_tab`, `voucher_placeholder`
   - `src/i18n/ar.json`: add Arabic equivalents
4. Update `src/css/components.css` and `src/css/layout.css` as needed for tab styling.

### 3. Live Status Stats
1. Update `src/templates/status.html`:
   - Render MikroTik vars: `$(session-time-left)`, `$(uptime)`, `$(bytes-in-nice)`, `$(bytes-out-nice)`, `$(limit-bytes-total)`
   - Use `data-seconds` attributes for countdown-driven elements
   - Keep progress bars gated by `$(if limit-bytes-total)`
2. Update `src/js/modules/status.js`:
   - `status.init()`: read `data-seconds` from `#session-countdown`
   - `startCountdowns()`: countdown `#session-countdown`
   - `updateDisplay()`: fill username, ip, mac, bytes-in, bytes-out, uptime
   - `updateProgressBars()`: apply width and warning/danger classes
   - `startUptimeTicker()`: tick uptime every second
3. Ensure `status.html` includes a hidden/embedded data source if needed, or rely on existing `data-*` attributes.

### 4. Validation
1. Run `npm run build`
2. Open `dist/login.html` and confirm:
   - Normal mode uses username/password
   - Voucher mode copies same code into both fields
   - CHAP login still hashes correctly
   - PAP login submits unchanged
3. Open `dist/status.html` and confirm:
   - Countdown works
   - Uptime ticks
   - Progress bars appear only when `limit-bytes-total` is present
4. Run tests: `npm test`

## Risks
- RouterOS may reload Status when session expires; countdown restarts acceptably.
- Captive-portal browsers may clear cookies; no dependency added for stats persistence.
- Voucher with CHAP is RouterOS-dependent: ensure backend accepts equal username/password pairs under CHAP.

## Out of Scope
- Additional languages
- Admin dashboard
- Voucher batch generation/management UI
