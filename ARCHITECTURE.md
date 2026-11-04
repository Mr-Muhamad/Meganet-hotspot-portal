# Architecture

This document describes the technical architecture of the MikroTik Hotspot Portal.

## Overview

The MikroTik Hotspot Portal is a captive portal system designed for MikroTik RouterOS environments. It provides a modern, responsive web interface for WiFi authentication while maintaining compatibility with iOS/macOS Captive Network Assistant (CNA) restrictions.

## Design Principles

1. **CNA Compatibility**: All resources must be inline (no external CSS/JS)
2. **Security First**: XSS-safe variable handling, input validation, rate limiting
3. **Accessibility**: WCAG AA compliance with screen reader support
4. **Performance**: Minimal page weight, fast rendering
5. **Internationalization**: RTL/LTR support, multiple languages
6. **Maintainability**: Modular code, build system, automated testing

## Architecture Layers

### 1. Template Layer (Nunjucks)

```
src/templates/
├── base.html          # Base template with shared structure
├── index.html         # Language router (browser-language detection)
├── login.html         # Login page (voucher / PAP / CHAP)
├── status.html        # Status page (live session stats)
├── logout.html        # Logout page
├── error.html         # Error page
├── expired.html       # Service suspended page
├── plans.html         # Subscription plans (from config.json)
└── alogin.html        # Auto-login "Connected" page
```

### 1b. Static Layer (RouterOS-required files)

```
src/static/
├── redirect.html      # MikroTik intercept page
└── errors.txt         # Localized error message strings ($(error) lookup)
```

**Purpose**: Files RouterOS reads **verbatim** from the hotspot directory.

**Why verbatim**: `redirect.html` carries line-sensitive `$(if http-status …)` / `$(if http-header …)` directives, and `errors.txt` is a RouterOS-parsed format. These files are copied as-is on every build — never minified, never templated.

**Purpose**: Generate HTML pages with MikroTik template variables.

**Key Features**:
- Template inheritance via Nunjucks blocks
- MikroTik variable injection: `$(variable)`
- Conditional rendering: `$(if condition) ... $(endif)`
- XSS-safe escaping: `$(var-esc)`

### 2. Style Layer (CSS Modules)

```
src/css/
├── variables.css      # CSS custom properties (design tokens)
├── theme.css          # Dark/light theme definitions
├── reset.css          # Global resets
├── layout.css         # Page structure (header, footer, main)
├── components.css     # UI components (cards, buttons, forms)
├── utilities.css      # Utility classes
└── media.css          # Responsive breakpoints
```

**Purpose**: Provide consistent, maintainable styling.

**Key Features**:
- CSS custom properties for theming
- Mobile-first responsive design
- RTL support via logical properties
- Dark/light mode with system preference detection

### 3. Logic Layer (JavaScript Modules)

```
src/js/modules/
├── util.js            # Utility functions
├── auth.js            # Authentication logic
├── ui.js              # UI management
├── i18n.js            # Internationalization
├── status.js          # Status display
├── validator.js       # Input validation
└── rate-limiter.js    # Rate limiting
```

**Purpose**: Handle client-side logic and interactions.

**Key Features**:
- IIFE pattern for module encapsulation
- Error handling with try-catch
- Event delegation
- State management

### 4. Internationalization Layer

```
src/i18n/
├── en.json            # English translations
└── ar.json            # Arabic translations
```

**Purpose**: Support multiple languages with RTL/LTR layouts.

**Key Features**:
- JSON-based translation files
- Automatic language detection
- Manual language switching
- RTL/LTR layout switching

### 5. Build Layer

```
build.js               # Main build script
scripts/
└── validate-templates.js  # Template validation
```

**Purpose**: Generate production-ready HTML files.

**Key Features**:
- Nunjucks template compilation
- CSS/JS bundling and minification
- i18n file generation
- Asset copying

## Data Flow

### Build Process

```
Source Files (src/)
    ↓
Build Script (build.js)
    ↓
Template Compilation (Nunjucks)  ← config.json + i18n injected
    ↓
CSS/JS Bundling (inlined per page)
    ↓
Minification
    ↓
Output Files (dist/)
    ├── index / login / status / logout / error / expired / plans / alogin .html
    ├── ar/  (same 8 pages, RTL)
    ├── redirect.html + errors.txt   ← copied verbatim from src/static/
    ├── api.json / announcements.json / manifest.json
    ├── assets/
    └── md5.js
```

### Runtime Flow

```
User Request
    ↓
MikroTik Router
    ↓
Captive Portal Detection (RFC 7710)
    ↓
HTML Page (inline CSS/JS)
    ↓
Browser Rendering
    ↓
User Interaction
    ↓
Form Submission
    ↓
MikroTik Authentication (CHAP/PAP)
    ↓
Redirect (success/error)
```

## Security Architecture

### Input Validation

```
User Input
    ↓
Client-Side Validation (validator.js)
    ↓
XSS Sanitization
    ↓
Server-Side Processing (MikroTik)
    ↓
Escaped Output ($(var-esc))
```

### Rate Limiting

```
Login Attempt
    ↓
Rate Limiter Check (rate-limiter.js)
    ↓
[If blocked] → Error message with wait time
[If allowed] → Continue with authentication
    ↓
Record Attempt
    ↓
Authentication
```

### CHAP Authentication

```
1. MikroTik generates challenge
2. Client receives chap-id and chap-challenge
3. User enters password
4. Client calculates: hash = MD5(chap-id + password + chap-challenge)
5. Client sends hash (not password)
6. MikroTik verifies hash
```

## Component Architecture

### Base Template

```html
<!DOCTYPE html>
<html lang="{{ lang }}" dir="{{ dir }}">
<head>
  <style>{{ css }}</style>
</head>
<body>
  <header class="header">...</header>
  <main id="main">{% block content %}{% endblock %}</main>
  <footer class="footer">...</footer>
  
  <script>{{ js }}</script>
  {% block scripts %}{% endblock %}
</body>
</html>
```

### JavaScript Module Pattern

```javascript
var moduleName = {
  // Public methods
  publicMethod: function() {
    try {
      // Implementation
    } catch (err) {
      console.error('Error:', err);
    }
  },
  
  // Private methods (closure)
  _privateMethod: function() {
    // Implementation
  }
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = moduleName;
}
```

## Performance Considerations

### Page Weight

- Average page size: ~40KB (inline CSS/JS)
- No external requests
- System fonts only
- Inline SVG icons

### Rendering

- Critical CSS inlined
- No render-blocking resources
- Progressive enhancement
- Reduced motion support

## Browser Support

- iOS Safari (CNA)
- macOS Safari (CNA)
- Chrome/Edge
- Firefox
- Samsung Internet

## MikroTik Integration

### Template Variables

| Variable | Description | Usage |
|----------|-------------|-------|
| `$(hostname)` | Router name | Page title |
| `$(identity)` | Network name | Header |
| `$(link-login)` | Login URL | Forms |
| `$(link-login-only)` | Login-only URL | Form action |
| `$(link-logout)` | Logout URL | Logout button |
| `$(username-esc)` | Escaped username | Display |
| `$(error-esc)` | Escaped error | Error display |
| `$(chap-id)` | CHAP ID | Authentication |
| `$(chap-challenge)` | CHAP challenge | Authentication |

### Conditional Blocks

```html
$(if condition)
  <!-- Shown when condition is true -->
$(endif)

$(if condition)
  <!-- Shown when true -->
$(else)
  <!-- Shown when false -->
$(endif)
```

## Testing Strategy

### Unit Tests

- JavaScript module functions
- Input validation
- Rate limiting logic
- i18n translations

### Integration Tests

- Form submission
- Authentication flow
- Theme switching
- Language switching

### Accessibility Tests

- ARIA attributes
- Keyboard navigation
- Screen reader compatibility

## Deployment

### RouterOS v6

1. Upload files to router
2. Configure hotspot
3. Set login page

### RouterOS v7

1. Upload files to router
2. Configure hotspot
3. Set login page
4. Enable HTTPS (recommended)

## Future Considerations

- PWA support for offline capability
- WebSocket for real-time updates
- Service Worker for caching
- Web Components for reusability