# Contributing to MikroTik Hotspot Portal

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

Please be respectful and constructive in all interactions. We are committed to providing a welcoming and inclusive experience for everyone.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/mikrotik-hotspot-portal.git
   cd mikrotik-hotspot-portal
   ```
3. **Create a branch** for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites

- Node.js 16.0.0 or higher
- npm 8.0.0 or higher

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Validate templates
npm run validate
```

### Development Mode

```bash
# Build without minification
npm run build:dev

# Watch for changes
npm run watch
```

## Project Structure

```
mikrotik-hotspot-portal/
├── src/                          # Source files
│   ├── templates/                # Nunjucks templates
│   │   ├── base.html            # Base template with shared structure
│   │   ├── login.html           # Login page template
│   │   ├── status.html          # Status page template
│   │   ├── logout.html          # Logout page template
│   │   └── error.html           # Error page template
│   ├── css/                     # CSS modules
│   │   ├── variables.css        # CSS custom properties
│   │   ├── theme.css            # Dark/light theme
│   │   ├── reset.css            # Global resets
│   │   ├── layout.css           # Page structure
│   │   ├── components.css       # UI components
│   │   ├── utilities.css        # Utility classes
│   │   └── media.css            # Responsive design
│   ├── js/modules/              # JavaScript modules
│   │   ├── util.js              # Utility functions
│   │   ├── auth.js              # Authentication
│   │   ├── ui.js                # UI management
│   │   ├── i18n.js              # Internationalization
│   │   ├── status.js            # Status display
│   │   ├── validator.js         # Input validation
│   │   └── rate-limiter.js      # Rate limiting
│   └── i18n/                    # Translations
│       ├── en.json              # English
│       └── ar.json              # Arabic
├── tests/                       # Test files
│   ├── setup.js                 # Test setup
│   └── modules/                 # Unit tests
├── scripts/                     # Build scripts
│   └── validate-templates.js    # Template validation
├── dist/                        # Built files (generated)
├── build.js                     # Build script
├── package.json                 # Dependencies
└── README.md                    # Documentation
```

## Coding Standards

### CSS

- Use CSS custom properties for theming
- Follow BEM-like naming: `.block__element--modifier`
- Use logical properties for RTL support: `margin-inline-start`
- Mobile-first responsive design

### JavaScript

- Use ES5 syntax for browser compatibility
- Use `var` instead of `const`/`let`
- Use IIFE pattern for modules
- Always use try-catch blocks
- Add JSDoc comments for functions

### HTML

- Use semantic HTML5 elements
- Include ARIA attributes for accessibility
- Use MikroTik escaped variables: `$(var-esc)`
- Support both LTR and RTL

### MikroTik Integration

- Use `$(variable)` for server-side injection
- Use `$(var-esc)` for XSS-safe output
- Use `$(if condition) ... $(endif)` for conditionals
- Test with both CHAP and PAP authentication

## Commit Guidelines

### Commit Messages

Use conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(auth): add rate limiting for login attempts
fix(css): correct RTL layout issues
docs(readme): update installation instructions
test(validator): add input validation tests
```

## Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Run all tests** and ensure they pass:
   ```bash
   npm test
   ```
4. **Validate templates**:
   ```bash
   npm run validate
   ```
5. **Build the project**:
   ```bash
   npm run build
   ```
6. **Create a pull request** with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots (if UI changes)

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/modules/validator.test.js

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

- Place tests in `tests/modules/`
- Name files `*.test.js`
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

Example:
```javascript
describe('Module Name', () => {
  describe('functionName', () => {
    test('should do something', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = module.functionName(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

## Reporting Issues

### Bug Reports

Include:
- Clear description
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/device information
- Screenshots (if applicable)

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternatives considered
- Additional context

## Questions?

Feel free to open an issue for any questions about contributing.

Thank you for contributing! 🎉