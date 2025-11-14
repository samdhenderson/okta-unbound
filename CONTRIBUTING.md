# Contributing to Okta Unbound

Thank you for your interest in contributing to Okta Unbound! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/okta-unbound.git
   cd okta-unbound
   ```
3. **Load the extension** in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `okta-unbound` folder
4. **Make your changes** and test thoroughly
5. **Submit a pull request**

## Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch (if using)
- `feature/your-feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/what-changed` - Documentation updates

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. Make your changes and test:
   - Test on actual Okta group pages
   - Test with different group sizes (small, medium, large)
   - Test error scenarios (permissions, network failures)

3. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

4. Push to your fork:
   ```bash
   git push origin feature/amazing-feature
   ```

5. Open a Pull Request on GitHub

## Coding Standards

Please follow the guidelines in [claude.md](claude.md), including:

### JavaScript Style

- Use ES6+ features (async/await, arrow functions, const/let)
- 2-space indentation
- Single quotes for strings
- Semicolons required
- camelCase for variables and functions
- UPPER_SNAKE_CASE for constants

### Comments

- Add comments for complex logic
- Document functions with JSDoc style
- Explain "why" not "what"

### Example:

```javascript
/**
 * Fetch all pages from a paginated Okta endpoint
 *
 * @param {string} endpoint - Initial endpoint URL
 * @returns {Promise<Array>} - All items from all pages
 */
async function fetchAllPages(endpoint) {
  // Implementation
}
```

## Pull Request Process

### Before Submitting

- [ ] Code follows the style guide in [claude.md](claude.md)
- [ ] All existing functionality still works
- [ ] New features are tested manually
- [ ] Documentation is updated (README, comments)
- [ ] CHANGELOG.md is updated with your changes
- [ ] Commit messages are clear and descriptive

### PR Template

When opening a PR, please include:

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing Done
- [ ] Tested on small groups (< 200 users)
- [ ] Tested on large groups (1000+ users)
- [ ] Tested error cases
- [ ] No console errors

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Closes #123
```

### Review Process

1. Maintainers will review your PR within a few days
2. Address any feedback or requested changes
3. Once approved, your PR will be merged
4. Your contribution will be credited in the release notes

## Reporting Bugs

### Before Reporting

- Check if the bug has already been reported in [Issues](https://github.com/yourusername/okta-unbound/issues)
- Try to reproduce the bug with the latest version
- Gather information about your environment

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- Browser: [e.g., Chrome 120]
- Extension version: [e.g., 2.0.0]
- Okta domain: [e.g., company.okta.com or oktapreview.com]

**Additional context**
Any other relevant information.
```

## Suggesting Features

We love feature suggestions! Please use the [Feature Request template](https://github.com/yourusername/okta-unbound/issues/new?template=feature_request.md).

### Feature Ideas from Roadmap

Check out the promo poster for planned features:
- Discover Conflicting Group Rules
- Trace User Memberships
- Inventory All Rules
- Attribute-Based Deep Dive
- Export Group Members
- Mirror App Users & Permissions
- Security Posture Improvements

If you want to work on any of these, open an issue first to discuss the approach!

## Development Tips

### Testing with Different Group Sizes

- Small groups (< 50 users): Quick iteration
- Medium groups (200-500 users): Test pagination
- Large groups (1000+ users): Test performance

### Debugging

- Open Chrome DevTools (F12) while using the extension
- Check the Console tab for errors
- Use `console.log()` liberally during development
- Check Background page console: `chrome://extensions/` → "Inspect views: background page"

### Common Issues

**Extension not loading:**
- Check manifest.json for syntax errors
- Ensure all file paths are correct
- Reload the extension after changes

**API requests failing:**
- Verify XSRF token is being extracted
- Check Network tab in DevTools
- Ensure you're on a valid Okta group page

## Questions?

If you have questions:
1. Check the [README.md](README.md)
2. Review [claude.md](claude.md) for technical details
3. Open a [Discussion](https://github.com/yourusername/okta-unbound/discussions)
4. Reach out in Issues

## Recognition

Contributors will be:
- Listed in release notes
- Credited in the README
- Appreciated by the Okta admin community!

Thank you for contributing to Okta Unbound! 🚀
