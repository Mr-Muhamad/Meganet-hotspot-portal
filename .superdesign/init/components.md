# Components — Meganet Hotspot Portal

Vanilla CSS BEM classes (no framework). Shared library lives in `src/css/components.css`; page-specific classes in `src/css/media.css`. Below is the ACTUAL source for every family, with the markup pattern each is used with.

## Card (`components.css:1-76`) — used on every page

```css
.card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  border: 1px solid var(--color-border);
}
.card-header { text-align: center; margin-bottom: var(--space-lg); }
.card-header__brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}
.card-header__logo { display: flex; align-items: center; justify-content: center; }
.card-header__logo-svg { height: 48px; width: auto; max-width: 260px; display: block; }
[dir="ltr"] .card-header__logo-svg .text-luxury { opacity: 1; }
[dir="rtl"] .card-header__logo-svg .text-ar { display: block; opacity: 1; }
[dir="rtl"] .card-header__brand { flex-direction: row-reverse; }
.card-header__icon { width: 28px; height: 28px; margin: 0; color: var(--color-primary); display: flex; }
.card-header__title { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-text); margin-bottom: var(--space-xs); }
.card-header__subtitle { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.card-body { margin-bottom: var(--space-lg); }
.card-footer { text-align: center; padding-top: var(--space-md); border-top: 1px solid var(--color-border); }
```

Markup: `<div class="card"><div class="card-header"><div class="card-header__brand"><span class="card-header__logo">{brandTitleSVG}</span><svg class="card-header__icon">…</svg></div><h1 class="card-header__title">…</h1><p class="card-header__subtitle">…</p></div><div class="card-body">…</div><div class="card-footer">…</div></div>`

## Buttons (`components.css:78-159`)

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  transition: transform var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
  white-space: nowrap; user-select: none; min-height: 40px;
}
.btn:hover { transform: translateY(-1px); }
.btn:active { transform: translateY(0); }
.btn-primary {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
  color: var(--color-primary-text);
  box-shadow: 0 4px 12px var(--color-primary-bg);
}
.btn-primary:hover {
  background: linear-gradient(135deg, var(--color-primary-hover) 0%, var(--color-primary-active) 100%);
  box-shadow: 0 6px 16px rgba(34, 197, 94, 0.35);
}
.btn-primary:active { background: var(--color-primary-active); }
.btn-secondary {
  background: rgba(34, 197, 94, 0.05);
  color: var(--color-primary);
  border: 1px solid rgba(34, 197, 94, 0.25);
  backdrop-filter: blur(4px);
}
.btn-secondary:hover {
  background: var(--color-primary-bg);
  border-color: var(--color-primary);
  box-shadow: 0 4px 10px rgba(34, 197, 94, 0.15);
}
.btn-block { width: 100%; }
.btn-sm { padding: var(--space-xs) var(--space-sm); font-size: var(--font-size-xs); min-height: 32px; }
.btn--loading { position: relative; pointer-events: none; opacity: 0.8; }
.btn--loading::after {
  content: ''; position: absolute; width: 16px; height: 16px;
  border: 2px solid transparent; border-top-color: currentColor;
  border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

## Forms (`components.css:161-260`)

```css
.form-group { margin-bottom: var(--space-md); }
.form-label { display: block; font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--color-text); margin-bottom: var(--space-xs); }
.form-input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-input-bg);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  color: var(--color-text);
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal), background-color var(--transition-normal);
}
.form-input:focus {
  border-color: var(--color-input-focus);
  background-color: rgba(34, 197, 94, 0.02);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15), 0 4px 12px rgba(34, 197, 94, 0.05);
}
[data-theme="light"] .form-input:focus { background-color: rgba(22, 163, 74, 0.01); }
.form-input--error { border-color: var(--color-error); }
.form-input--error:focus { box-shadow: 0 0 0 3px var(--color-error-bg); }
[data-mode-panel] { animation: tabFadeIn 0.2s ease-out forwards; }
@keyframes tabFadeIn { from { opacity: 0; } to { opacity: 1; } }
.input-wrapper { position: relative; }
.input-toggle {
  position: absolute; right: var(--space-sm); top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  padding: var(--space-xs);
  display: flex; align-items: center; justify-content: center;
}
[dir="rtl"] .input-toggle { right: auto; left: var(--space-sm); }
.input-toggle__icon { width: 20px; height: 20px; }
.checkbox-group { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-md); }
.checkbox-group input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--color-primary); }
.checkbox-group label { font-size: var(--font-size-sm); color: var(--color-text-muted); }
```

## Alerts (`components.css:262-314`) — incl. the `.alert[hidden]` guard

```css
.alert {
  display: flex; align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
  font-size: var(--font-size-sm);
}
/* `hidden` must beat .alert's display:flex */
.alert[hidden] { display: none; }
.alert-error { background: var(--color-error-bg); color: var(--color-error); border: 1px solid var(--color-error); }
.alert-warning { background: var(--color-warning-bg); color: var(--color-warning); border: 1px solid var(--color-warning); }
.alert-success { background: var(--color-success-bg); color: var(--color-success); border: 1px solid var(--color-success); }
.alert-info { background: var(--color-primary-bg); color: var(--color-primary); border: 1px solid var(--color-primary); }
.alert__icon { width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; }
.alert__text { flex: 1; line-height: 1.4; }
```

## Divider + Link button (`components.css:316-350`)

```css
.divider {
  display: flex; align-items: center;
  gap: var(--space-md);
  margin: var(--space-lg) 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--color-border); }

.link-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}
.link-btn:hover { background: var(--color-primary-bg); }
```

## Auth tabs (`components.css:351-384`) — only when loginMode=both

```css
.auth-tabs {
  display: flex; gap: var(--space-xs);
  margin-bottom: var(--space-md);
  background: var(--color-surface-hover);
  padding: var(--space-xs);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}
.auth-tab {
  flex: 1; padding: var(--space-sm) var(--space-md);
  border-radius: calc(var(--radius-md) - 2px);
  border: none; background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm); font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background-color var(--transition-normal), color var(--transition-normal), box-shadow var(--transition-normal);
}
.auth-tab--active { background: var(--color-surface); color: var(--color-primary); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); }
.auth-tab:hover:not(.auth-tab--active) { color: var(--color-text); background: rgba(255, 255, 255, 0.02); }
```

## Plans / pricing (`components.css:386-529`)

```css
.plans-container { display: flex; flex-direction: column; gap: var(--space-md); width: 100%; margin: 0 auto; }
.plans-grid { display: flex; flex-direction: column; gap: var(--space-sm); margin-top: var(--space-md); }
.plan-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  display: flex; flex-direction: row; align-items: center;
  gap: var(--space-md);
  transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
  position: relative; overflow: hidden; cursor: pointer;
  width: 100%; text-align: left;
}
[dir="rtl"] .plan-card { flex-direction: row-reverse; text-align: right; }
.plan-card:hover { transform: translateY(-2px); border-color: var(--color-primary); box-shadow: 0 4px 15px rgba(34, 197, 94, 0.1); }
.plan-card::before {
  content: ""; position: absolute; top: -50%; left: -50%;
  width: 200%; height: 200%;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.05) 0%, transparent 60%);
  opacity: 0; transition: opacity var(--transition-fast); pointer-events: none;
}
.plan-card:hover::before { opacity: 1; }
.plan-card__icon-wrapper {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--color-primary-bg); color: var(--color-primary);
  display: flex; align-items: center; justify-content: center;
  transition: transform var(--transition-fast); flex-shrink: 0;
}
.plan-card:hover .plan-card__icon-wrapper { transform: scale(1.1); }
.plan-card__icon { width: 22px; height: 22px; }
.plan-card__info { display: flex; flex-direction: column; flex: 1; gap: 2px; }
.plan-card__quota { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--color-text); }
.plan-card__name { font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); color: var(--color-text-muted); }
.plan-card__price {
  font-size: var(--font-size-md); font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-primary-bg);
  border-radius: var(--radius-md);
  display: inline-block; white-space: nowrap;
}
.plans-footer { text-align: center; margin-top: var(--space-lg); color: var(--color-text-muted); font-size: var(--font-size-sm); }
.plans-link {
  display: inline-flex; align-items: center;
  gap: var(--space-xs);
  color: var(--color-primary);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
  transition: color var(--transition-fast);
}
.plans-link:hover { color: var(--color-primary-hover); text-decoration: underline; }
.plans-link-compact { text-align: center; margin-top: var(--space-md); padding-bottom: var(--space-xs); width: 100%; }
```

## Support FAB + modal (`components.css:531-765` + `media.css:828-895`)

```css
.support-trigger {
  position: fixed; bottom: 24px; right: 24px;
  width: 56px; height: 56px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-primary-text, #ffffff);
  border: none;
  box-shadow: 0 4px 16px rgba(34, 197, 94, 0.4);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  z-index: 999;
  transition: transform var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
  animation: support-pulse 2s infinite;
}
[dir="rtl"] .support-trigger { right: auto; left: 24px; }
.support-trigger:hover { transform: scale(1.1); background: var(--color-primary-hover); box-shadow: 0 6px 20px rgba(34, 197, 94, 0.6); }
.support-trigger__icon { width: 26px; height: 26px; color: var(--color-primary-text); }

.support-modal {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(2, 6, 17, 0.7);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  opacity: 0; visibility: hidden;
  transition: opacity var(--transition-fast), visibility var(--transition-fast);
}
.support-modal--open { opacity: 1; visibility: visible; }
.support-modal__content {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  width: 90%; max-width: 420px;
  padding: var(--space-lg);
  box-shadow: var(--shadow-lg);
  transform: scale(0.95);
  transition: transform var(--transition-fast);
  position: relative;
}
.support-modal--open .support-modal__content { transform: scale(1); }
.support-modal__header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-sm);
}
[dir="rtl"] .support-modal__header { flex-direction: row-reverse; }
.support-modal__title { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--color-text); margin: 0; }
.support-modal__close { background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: var(--space-xs); border-radius: var(--radius-md); transition: color var(--transition-fast), background var(--transition-fast); display: flex; align-items: center; justify-content: center; }
.support-modal__close:hover { color: var(--color-text); background: var(--color-primary-bg); }
.support-modal__close-icon { width: 20px; height: 20px; }
.support-modal__desc { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-md); text-align: center; }

.support-grid-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-sm); width: 100%; }
.support-person-card {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  display: flex; flex-direction: column; align-items: center;
  text-align: center; gap: var(--space-sm);
}
.support-person-card__avatar {
  width: 44px; height: 44px;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-primary);
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.3);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; background: var(--color-surface);
}
.support-person-card__avatar img { width: 100%; height: 100%; object-fit: cover; }
.support-person-card__avatar-fallback { color: var(--color-primary); }
.support-person-card__info { display: flex; flex-direction: column; gap: 2px; }
.support-person-card__name { font-size: var(--font-size-md); font-weight: var(--font-weight-bold); color: var(--color-text); }
.support-person-card__role { font-size: 10px; color: var(--color-text-muted); }
.support-person-card__actions { display: flex; flex-direction: column; gap: var(--space-xs); width: 100%; margin-top: var(--space-xs); }
.support-action-btn { text-decoration: none; padding: var(--space-xs); min-height: 28px; font-size: 11px; }
.support-action-btn svg { flex-shrink: 0; }

/* Legacy list variant */
.support-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.support-item { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-border); text-decoration: none; transition: transform var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast); }
[dir="rtl"] .support-item { flex-direction: row-reverse; text-align: right; }
.support-item--whatsapp { border-left: 4px solid #22c55e; }
[dir="rtl"] .support-item--whatsapp { border-left: 1px solid var(--color-border); border-right: 4px solid #22c55e; }
.support-item--whatsapp:hover { background: rgba(34, 197, 94, 0.08); border-color: #22c55e; }
.support-item--whatsapp .support-item__icon-wrapper { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.support-item--phone { border-left: 4px solid #3b82f6; }
[dir="rtl"] .support-item--phone { border-left: 1px solid var(--color-border); border-right: 4px solid #3b82f6; }
.support-item--phone:hover { background: rgba(59, 130, 246, 0.08); border-color: #3b82f6; }
.support-item--phone .support-item__icon-wrapper { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.support-item__icon-wrapper { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.support-item__title { font-weight: var(--font-weight-semibold); font-size: var(--font-size-md); color: var(--color-text); }
.support-item__detail { font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 2px; }

@keyframes support-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
  70%  { box-shadow: 0 0 0 15px rgba(34, 197, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}
```

## Network background canvas (`components.css:767-784`)

```css
[data-theme="light"] { --network-bg-gradient: radial-gradient(circle at 10% 20%, rgba(248, 250, 252, 1) 0%, rgba(226, 232, 240, 1) 90%); }
[data-theme="dark"]  { --network-bg-gradient: radial-gradient(circle at 10% 20%, rgba(2, 6, 17, 1) 0%, rgba(15, 23, 42, 1) 90%); }
.network-bg {
  position: fixed; top: 0; left: 0;
  width: 100vw; height: 100vh;
  z-index: -1; pointer-events: none;
  background: var(--network-bg-gradient);
}
```
JS draws particles in `ui.js initBackground()` (~195 nodes, 30fps cap): dark nodes `rgba(59,130,246,0.4)` (blue), light nodes `rgba(79,70,229,0.35)` (indigo), connections green `rgba(34,197,94,α)` dark / `rgba(148,163,184,α)` light; pointer lines blue/indigo. Respects `prefers-reduced-motion`.

## Announcement banner (`components.css:786-946`)

```css
.announcement-banner {
  display: flex; align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  margin-bottom: var(--space-md);
  width: 100%; box-sizing: border-box;
  border: 1px solid var(--color-border);
  transition: opacity var(--transition-fast), transform var(--transition-fast);
  animation: announcement-slide-in 0.5s ease-out forwards;
}
[data-theme="light"] .announcement-banner { background: rgba(255, 255, 255, 0.85); border-color: #e2e8f0; }
@keyframes announcement-slide-in { 0% { opacity: 0; transform: translateY(-12px); } 100% { opacity: 1; transform: translateY(0); } }
[dir="rtl"] .announcement-banner { flex-direction: row-reverse; }
.announcement-banner__icon-wrapper { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
.announcement-banner__icon { width: 20px; height: 20px; }
.announcement-banner__content { flex: 1; text-align: left; }
[dir="rtl"] .announcement-banner__content { text-align: right; }
.announcement-banner__text { font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); line-height: 1.4; transition: opacity 0.3s ease; opacity: 1; }
.announcement-banner__text--hidden { opacity: 0; }
.announcement-banner__close { background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: var(--space-xs); border-radius: var(--radius-sm); transition: color var(--transition-fast), background var(--transition-fast); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.announcement-banner__close:hover { color: var(--color-text); background: rgba(255, 255, 255, 0.1); }
.announcement-banner__close-icon { width: 16px; height: 16px; }

.announcement-banner--warning {
  border-color: rgba(245, 158, 11, 0.5);
  box-shadow: 0 4px 20px rgba(245, 158, 11, 0.15);
  animation: announcement-pulse-warning 2s infinite alternate ease-in-out;
}
.announcement-banner--warning .announcement-banner__icon-wrapper { background: rgba(245, 158, 11, 0.15); color: rgb(245, 158, 11); }
.announcement-banner--warning .announcement-banner__text { color: rgb(251, 191, 36); }
[data-theme="light"] .announcement-banner--warning .announcement-banner__icon-wrapper { color: #d97706; }
[data-theme="light"] .announcement-banner--warning .announcement-banner__text { color: #b45309; }
[data-theme="light"] .announcement-banner--promo .announcement-banner__text { color: #15803d; }

.announcement-banner--promo {
  border-color: rgba(34, 197, 94, 0.5);
  box-shadow: 0 4px 20px rgba(34, 197, 94, 0.15);
  animation: announcement-pulse-promo 2s infinite alternate ease-in-out;
}
.announcement-banner--promo .announcement-banner__icon-wrapper { background: rgba(34, 197, 94, 0.15); color: rgb(34, 197, 94); }
.announcement-banner--promo .announcement-banner__text { color: rgb(74, 222, 128); }

@keyframes announcement-pulse-warning {
  0%   { box-shadow: 0 4px 15px rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3); }
  100% { box-shadow: 0 4px 25px rgba(245, 158, 11, 0.35); border-color: rgba(245, 158, 11, 0.7); }
}
@keyframes announcement-pulse-promo {
  0%   { box-shadow: 0 4px 15px rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.3); }
  100% { box-shadow: 0 4px 25px rgba(34, 197, 94, 0.35); border-color: rgba(34, 197, 94, 0.7); }
}
```

## Install guide (`components.css:948-1018`)

```css
.install-toggle { background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: var(--space-xs); border-radius: var(--radius-md); transition: color var(--transition-fast), background var(--transition-fast); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; }
.install-toggle:hover { color: var(--color-primary); background: var(--color-primary-bg); }
.install-toggle__icon { width: 20px; height: 20px; }
.install-guide { display: flex; flex-direction: column; gap: var(--space-md); margin-top: var(--space-md); text-align: left; }
[dir="rtl"] .install-guide { text-align: right; }
.install-step { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm) var(--space-md); background: var(--color-primary-bg); border: 1px dashed rgba(34, 197, 94, 0.2); border-radius: var(--radius-md); }
[dir="rtl"] .install-step { flex-direction: row-reverse; }
.install-step__num { background: var(--color-primary); color: var(--color-primary-text); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: var(--font-weight-bold); font-size: var(--font-size-sm); flex-shrink: 0; }
.install-step__text { font-size: var(--font-size-sm); color: var(--color-text); line-height: 1.4; }
```

## Login-page components (`media.css:718-792` + `1021-1066`)

```css
.qr-buttons-row { display: flex; gap: var(--space-xs); width: 100%; margin-top: var(--space-sm); margin-bottom: var(--space-xs); }
.qr-scan-btn { display: flex; align-items: center; justify-content: center; gap: var(--space-xs); margin: 0; }
.qr-scan-btn--camera { flex: 1; }
.qr-scan-btn--gallery { width: 44px; flex-shrink: 0; padding: 0; }
.qr-scan-btn__icon { flex-shrink: 0; }

.login-card-footer { display: flex; flex-direction: column; gap: var(--space-md); align-items: center; justify-content: center; }
.login-card-footer .plans-link { font-size: var(--font-size-sm); text-decoration: none; }
.login-card-footer .plans-link__icon { flex-shrink: 0; }

.footer__device-info {
  font-size: 10px; color: var(--color-text-muted);
  display: flex; align-items: center; justify-content: center;
  gap: var(--space-sm); flex-wrap: wrap; width: 100%;
  border-top: 1px dashed var(--color-border);
  padding-top: var(--space-sm);
}
.device-chip {
  cursor: pointer; padding: 1px 4px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  transition: all var(--transition-fast);
}
.device-chip__value { color: var(--color-text); font-family: monospace; }
.mac-type-display { font-size: 8px; font-weight: bold; margin-left: 2px; }

@keyframes qr-scan-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55); }
  70%  { box-shadow: 0 0 0 14px rgba(34, 197, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}
.qr-scan-btn--attn { animation: qr-scan-pulse 1.6s ease-out 3; }
@media (prefers-reduced-motion: reduce) { .qr-scan-btn--attn { animation: none; } }

.form-hint { display: block; margin-top: var(--space-xs); font-size: var(--font-size-sm); color: var(--color-text-muted); }
.qr-scan-hint {
  display: none; margin-top: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.35);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}
.qr-hint-or { display: none; text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); margin: var(--space-xs) 0; }
```

## Caps-lock warning + toasts + loading overlay (`media.css:53-156`)

```css
.caps-lock-warning { display: none; align-items: center; gap: var(--space-xs); margin-top: var(--space-xs); font-size: var(--font-size-xs); color: var(--color-warning); }
.caps-lock-warning.visible { display: flex; }
.caps-lock-warning__icon { width: 14px; height: 14px; }

.toast {
  position: fixed; bottom: var(--space-lg); left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface); color: var(--color-text);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  z-index: 300;
  animation: toast-in 0.3s ease;
}
.toast--success { border-color: var(--color-success); color: var(--color-success); }
.toast--error { border-color: var(--color-error); color: var(--color-error); }
.toast--warning { border-color: var(--color-warning); color: var(--color-warning); }
@keyframes toast-in { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
@keyframes toast-out { from { opacity: 1; transform: translateX(-50%) translateY(0); } to { opacity: 0; transform: translateX(-50%) translateY(20px); } }

.loading-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 400; }
.loading-overlay__spinner { width: 40px; height: 40px; border: 3px solid transparent; border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
```

## Status-page components (`media.css:158-505`) — stat-cards, progress, countdown, tech accordion

Status page uses a 2-column `.status-grid` of `.stat-card` (surface, border, radius-md, padding-sm, icon 24px primary, label xs muted, value lg semibold), interactive cards (`--interactive` hover translateY(-2px) + surface-hover), a `.progress-bar` (6px, radius-full, fill primary with `--warning`/`--danger` variants and a `--animated` shimmer `linear-gradient(90deg, primary, #48ff00, primary)` background-size 200% animating background-position), a centered `.session-countdown` card (28px bold primary tabular-nums value with warning/danger variants), `.tech-details` accordion (border-top, muted trigger, monospace values), `.color-success/.color-warning/.color-danger` (!important value classes), and a gradient `.stat-card--pwa` banner. JS (status.js) writes these classes directly — class names are a hard contract with tests.

## Accessibility/responsive (`media.css:321-405`)

`prefers-reduced-motion` kills all animation/transition durations; `forced-colors` adds ButtonText borders to buttons/alerts/inputs; breakpoints: ≥360px shell+card padding-lg, ≥480px `--max-width:420px`, ≥768px `--max-width:480px` + status grid 2-col, `.page-shell--wide` 680px.
