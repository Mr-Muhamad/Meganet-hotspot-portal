# Layouts — Meganet Hotspot Portal

Every page renders inside one app shell: sticky glass header (brand logo + network name + [lang toggle, theme toggle, install toggle]) → flex-centered main content (card stack, max-width 420px; status page 680px) → footer ("Powered by MikroTik" / custom). Full-viewport particle-network canvas behind everything (`#network-bg`, config-gated). RTL (`dir="rtl"`) is the primary language.

## `src/templates/base.html` (full shell — 343 lines; JS handler stubs at 141-216 omitted below, they are logic not UI)

```html
<!DOCTYPE html>
<html lang="{{ lang }}" dir="{{ dir }}" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="WiFi Portal">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="theme-color" id="metaThemeColor" content="#020617">
  <script>
    // Apply the saved (or OS-preferred) theme BEFORE first paint
    (function() {
      try {
        var m = document.cookie.match(/(?:^| )hotspot_theme=([^;]+)/);
        var t = m ? decodeURIComponent(m[1]) : null;
        if (t !== 'light' && t !== 'dark') {
          t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
        }
        document.documentElement.setAttribute('data-theme', t);
      } catch (err) { /* keep the hardcoded dark default */ }
    })();
  </script>
  <link rel="apple-touch-icon" href="{% if lang == 'ar' %}../{% endif %}assets/icon.png">
  <link rel="manifest" href="{% if lang == 'ar' %}../{% endif %}manifest.json">
  <link rel="icon" type="image/svg+xml" href="{% if lang == 'ar' %}../{% endif %}assets/logo.svg">
  <title>$(hostname) - {{ i18n[page + '_title'] }}</title>
  <style>
{{ css }}
    /* Dynamic Theme Overrides from config.json — scoped to the DARK theme
       (light keeps its own contrast-tuned palette; radius stays on :root). */
    :root {
      {% if config.theme.cardRadius %}
      --radius-md: calc({{ config.theme.cardRadius }} - 4px);
      --radius-lg: {{ config.theme.cardRadius }};
      {% endif %}
    }
    {% if config.theme.primaryColor or config.theme.backgroundColor %}
    [data-theme="dark"] {
      {% if config.theme.primaryColor %}
      --color-primary: {{ config.theme.primaryColor }};
      --color-input-focus: {{ config.theme.primaryColor }};
      --color-primary-hover: {{ config.theme.primaryColor }}e6;
      --color-primary-active: {{ config.theme.primaryColor }}cc;
      --svg-accent: {{ config.theme.primaryColor }};
      --color-primary-bg: {{ config.theme.primaryColor }}26;
      --color-success: {{ config.theme.primaryColor }};
      --color-success-bg: {{ config.theme.primaryColor }}26;
      {% endif %}
      {% if config.theme.backgroundColor %}
      --color-bg: {{ config.theme.backgroundColor }};
      {% endif %}
    }
    {% endif %}
  </style>
</head>
<body>
  <!-- Interactive Network Background -->
  <canvas id="network-bg" class="network-bg"></canvas>

  <!-- Skip to main content link for accessibility -->
  <a href="#main" class="skip-link">Skip to content</a>

  <div class="page-shell{% if page == 'status' %} page-shell--wide{% endif %}">
    <!-- Header -->
    <header class="header">
      <div class="header__brand">
        <span class="header__logo">{{ logoInline | safe }}</span>
        <span class="header__name">{% if config.general.networkName %}{{ config.general.networkName }}{% else %}$(identity){% endif %}</span>
        {% if page == 'status' or page == 'alogin' %}
        <!-- Mini Status Dot Indicator — only where the connection is genuinely active -->
        <div class="status-dot-badge">
          <span class="status-dot-badge__dot"></span>
          <span class="status-dot-badge__label" data-i18n="status_active">Active</span>
        </div>
        {% endif %}
      </div>
      <div class="header__actions">
        {% if config.features.enableLanguageToggle %}
        <button class="lang-toggle" onclick="toggleLang()" aria-label="Toggle language">
          <svg class="lang-toggle__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </button>
        {% endif %}
        <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
          <svg class="theme-toggle__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
        <button class="install-toggle" onclick="toggleInstallModal()" aria-label="Install App" data-i18n-aria="install_app_btn">
          <svg class="install-toggle__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main id="main" class="main-content">
      {% block content %}{% endblock %}
    </main>

    <!-- Footer -->
    <footer class="footer">
      <p class="footer__text">
        {% if config.general.poweredByText %}
          {{ config.general.poweredByText }}
          {% if config.general.poweredByUrl %}
            <a href="{{ config.general.poweredByUrl }}" class="footer__link" target="_blank" rel="noopener noreferrer">
              {% if config.general.poweredByName %}{{ config.general.poweredByName }}{% else %}{{ config.general.poweredByUrl }}{% endif %}
            </a>
          {% endif %}
        {% else %}
          {{ i18n.footer_powered_by }} <a href="https://mikrotik.com" class="footer__link" target="_blank" rel="noopener noreferrer">{{ i18n.footer_mikrotik }}</a>
        {% endif %}
      </p>
    </footer>
  </div>

  <!-- i18n Data -->
  <script type="application/json" id="i18n-data">
{{ allTranslations | dump }}
  </script>

  <!-- Floating Support Button -->
  <button class="support-trigger" onclick="toggleSupportModal()" aria-label="Technical Support">
    <svg class="support-trigger__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  </button>

  <!-- Support Modal -->
  <div class="support-modal" id="supportModal" onclick="closeSupportModalOnClickOutside(event)">
    <div class="support-modal__content">
      <div class="support-modal__header">
        <h2 class="support-modal__title" data-i18n="support_title">Technical Support</h2>
        <button class="support-modal__close" onclick="toggleSupportModal()" aria-label="Close">
          <svg class="support-modal__close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="support-modal__body">
        <p class="support-modal__desc" data-i18n="support_desc">Need help? Choose one of our support options:</p>
        <div class="support-grid-cards">
          {% for agent in config.support.agents %}
          <div class="support-person-card">
            <div class="support-person-card__avatar">
              {% if agent.image %}
              <img src="{% if lang == 'ar' %}../{% endif %}assets/{{ agent.image }}" alt="{{ agent.name }}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
              {% endif %}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="support-person-card__avatar-fallback" style="{% if agent.image %}display: none;{% endif %}">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div class="support-person-card__info">
              <span class="support-person-card__name">{{ agent.name }}</span>
              <span class="support-person-card__role">{{ agent.role }}</span>
            </div>
            <div class="support-person-card__actions">
              {% if agent.phone %}
              <a href="tel:{{ agent.phone }}" class="btn btn-primary btn-sm btn-block support-action-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span data-i18n="support_call_action">Call</span>
              </a>
              {% endif %}
              {% if agent.whatsapp %}
              <a href="https://wa.me/{{ agent.whatsapp }}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm btn-block support-action-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span>واتساب</span>
              </a>
              {% endif %}
            </div>
          </div>
          {% endfor %}
        </div>
      </div>
    </div>
  </div>

  <!-- Install App Modal -->
  <div class="support-modal" id="installModal" onclick="closeInstallModalOnClickOutside(event)">
    <div class="support-modal__content">
      <div class="support-modal__header">
        <h2 class="support-modal__title" data-i18n="install_title">Install Application</h2>
        <button class="support-modal__close" onclick="toggleInstallModal()" aria-label="Close">
          <svg class="support-modal__close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="support-modal__body">
        <p class="support-modal__desc" data-i18n="install_desc">Add this portal to your Home Screen to open it as a fullscreen mobile application.</p>
        <div id="ios-guide" class="install-guide" style="display: none;">
          <div class="install-step">
            <span class="install-step__num">1</span>
            <span class="install-step__text" data-i18n="install_ios_step1">Tap the share icon <strong>📤</strong> in Safari.</span>
          </div>
          <div class="install-step">
            <span class="install-step__num">2</span>
            <span class="install-step__text" data-i18n="install_ios_step2">Scroll down and select <strong>Add to Home Screen ➕</strong>.</span>
          </div>
        </div>
        <div id="android-guide" class="install-guide" style="display: none;">
          <div class="install-step">
            <span class="install-step__num">1</span>
            <span class="install-step__text" data-i18n="install_android_step1">Tap the browser menu icon <strong>⋮</strong>.</span>
          </div>
          <div class="install-step">
            <span class="install-step__num">2</span>
            <span class="install-step__text" data-i18n="install_android_step2">Select <strong>Add to Home Screen ➕</strong> or <strong>Install App</strong>.</span>
          </div>
        </div>
        <div id="generic-guide" class="install-guide" style="display: none;">
          <div class="install-step">
            <span class="install-step__text" data-i18n="install_generic">Open your browser menu settings and select <strong>Add to Home Screen</strong>.</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  {% block scripts %}{% endblock %}
</body>
</html>
```

## `src/css/layout.css` (full)

```css
/* Page Shell */
.page-shell {
  width: 100%;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--space-md);
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Header */
.header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-md);
  background: rgba(15, 23, 42, 0.65); /* Glassmorphism translucent backdrop */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(34, 197, 94, 0.15); /* Light primary glow border */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 1px 0 rgba(34, 197, 94, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

[data-theme="light"] .header {
  background: rgba(248, 250, 252, 0.75);
  border-bottom: 1px solid rgba(22, 163, 74, 0.15);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

@keyframes status-pulse-dot {
  0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70%  { transform: scale(1);    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.header__brand {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.header__logo {
  width: 28px;
  height: 28px;
  color: var(--color-text);
  flex-shrink: 0;
}

.header__logo-svg {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.header__name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
  margin-right: var(--space-xs);
}

.header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--space-lg) 0;
}

/* Footer */
.footer {
  padding: var(--space-md);
  text-align: center;
  border-top: 1px solid var(--color-border);
}

.footer__text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.footer__link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
  transition: color var(--transition-fast);
}

.footer__link:hover {
  color: var(--color-primary-hover);
}
```

## `src/css/reset.css` (full — body/RTL/focus foundations)

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  color: var(--color-text);
  background: var(--color-bg);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
[dir="rtl"] body { direction: rtl; }
a { color: var(--color-primary); text-decoration: none; transition: color var(--transition-fast); }
a:hover { color: var(--color-primary-hover); }
img { max-width: 100%; height: auto; display: block; }
button { cursor: pointer; border: none; background: none; font: inherit; color: inherit; }
input, textarea, select { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
:focus:not(:focus-visible) { outline: none; }
```

## `src/css/utilities.css` (full — token-driven utility classes)

Text utilities (`text-center/left/right/muted/sm/xs/lg/primary/error/success/warning`, `font-medium/semibold/bold`), display (`flex`, `flex-col`, `items-center`, `justify-between`, `gap-xs…xl`), spacing (`mt-xs…lg`, `mb-xs…lg`, `p-xs…lg`), widths (`w-full`, `max-w-sm/md/lg`), radius (`rounded-sm/md/lg/full`), visibility (`sr-only`, `hidden`, `invisible`), cursor/overflow/transition utilities, and a `.spinner` (20px, `border-top-color: currentColor`, `spin 0.6s linear infinite`). All values come from `var(--*)` tokens — zero hardcoded colors.

## Skip-link + header toggles CSS (`src/css/media.css:1-51`)

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-primary);
  color: var(--color-primary-text);
  padding: var(--space-sm) var(--space-md);
  z-index: 200;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  border-radius: 0 0 var(--radius-sm) 0;
  transition: top var(--transition-fast);
}
[dir="rtl"] .skip-link { left: auto; right: 0; border-radius: 0 0 0 var(--radius-sm); }
.skip-link:focus { top: 0; outline: 2px solid var(--color-primary-text); outline-offset: 2px; }

.theme-toggle, .lang-toggle {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}
.theme-toggle:hover, .lang-toggle:hover { background: var(--color-surface-hover); color: var(--color-text); }
.theme-toggle__icon, .lang-toggle__icon { width: 20px; height: 20px; }
```

## Active status dot badge (`src/css/media.css:801-826` — status/alogin header only)

```css
.status-dot-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  margin-left: 4px;
}
.status-dot-badge__dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
  animation: status-pulse-dot 1.5s infinite ease-in-out;
}
.status-dot-badge__label { font-size: 9px; color: #10b981; font-weight: bold; line-height: 1; }
```
