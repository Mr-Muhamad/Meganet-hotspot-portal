# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **CHAP login**: `md5.js` was referenced at a non-existent path (`assets/js/md5.js`) — now resolved correctly for both EN and AR pages, so the CHAP hash path works
- **Clone prevention**: auto-login read the form element before it was defined, so `enableClonePrevention: false` was ignored during auto-login
- **i18n**: added missing `redirecting` and `seconds` keys (Arabic logout page showed hardcoded English); added `captive_notice` to the Arabic dictionary; removed a duplicate `expired_alert_text` key
- **Build completeness**: `redirect.html` and `alogin.html` are now copied from `src/static/` on every build (previously lost on a clean rebuild); `alogin.html` is mirrored to `ar/` since it is self-bilingual

### Changed
- Removed dead `enableTrial` config key (never referenced by any code)
- Removed legacy one-off patch scripts and `test-visual.html` (preserved in git history)
- Initialized git repository

### Added
- Build system for eliminating code duplication
- Nunjucks template engine for HTML generation
- CSS modules for better organization
- JavaScript modules with IIFE pattern
- Comprehensive testing infrastructure with Jest
- Input validation and sanitization module
- Rate limiting for brute force protection
- Template validation script
- Development and build scripts
- Contributing guidelines
- This changelog

### Changed
- Refactored CSS into separate modules (variables, theme, reset, layout, components, utilities, media)
- Refactored JavaScript into separate modules (util, auth, ui, i18n, status, validator, rate-limiter)
- Improved error handling with try-catch blocks
- Enhanced accessibility with ARIA attributes
- Updated build process to use Nunjucks templates

### Fixed
- RTL layout issues in Arabic version
- Theme persistence across page loads
- Language detection and switching
- Password visibility toggle
- Caps Lock detection

## [2.0.0] - 2024-01-XX

### Added
- Dark/light theme support with system preference detection
- Arabic language support with RTL layout
- Captive portal detection via RFC 7710
- WCAG AA accessibility compliance
- Keyboard navigation support
- Screen reader support
- Reduced motion support
- High contrast mode support
- Mobile-first responsive design
- CSS custom properties for theming
- Toast notifications
- Loading states
- Error handling
- Progress bars for data usage
- Session countdown timer
- Auto-refresh functionality

### Changed
- Modernized HTML structure
- Improved form validation
- Enhanced security practices
- Better error messages
- Responsive design improvements

## [1.0.0] - 2023-XX-XX

### Added
- Initial release
- Basic login functionality
- CHAP authentication support
- PAP authentication support
- Session status display
- Logout functionality
- Error page
- MikroTik RouterOS integration

---

## Version History

- **2.0.0**: Major update with theme support, i18n, accessibility, and build system
- **1.0.0**: Initial release with basic functionality

## Migration Guide

### From 1.x to 2.0

1. **Backup your customizations**: Save any custom CSS or JavaScript
2. **Update templates**: Replace old HTML files with new generated files
3. **Update RouterOS**: Ensure RouterOS v6.45+ or v7.x
4. **Test thoroughly**: Verify all functionality works

### Breaking Changes in 2.0

- HTML structure has changed significantly
- CSS classes have been renamed
- JavaScript functions have been reorganized
- MikroTik variable usage has been standardized

## Future Plans

- [ ] PWA (Progressive Web App) support
- [ ] Payment gateway integration
- [ ] Voucher system
- [ ] QR code login
- [ ] Analytics dashboard
- [ ] Multi-language support (more languages)
- [ ] Custom themes
- [ ] API for external integrations