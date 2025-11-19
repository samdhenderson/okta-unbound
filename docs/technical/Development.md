# Development Guide

Guide for developers who want to contribute to or modify Okta Unbound.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Code Style Guide](#code-style-guide)
- [Testing](#testing)
- [Debugging](#debugging)
- [Contributing](#contributing)

## Getting Started

### Prerequisites

- **Node.js** 18 or higher
- **npm** 9 or higher
- **Git**
- **Chrome** 88 or higher

### Initial Setup

1. **Clone the repository**

```bash
git clone https://github.com/samdhenderson/okta-unbound.git
cd okta-unbound
```

2. **Install dependencies**

```bash
npm install
```

3. **Build the extension**

```bash
npm run build
```

4. **Load in Chrome**

- Go to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `dist` folder

### Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run type-check
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/my-new-feature
```

### 2. Make Changes

Edit files in `src/` directory.

### 3. Test Changes

```bash
# Run tests
npm test

# Build extension
npm run build

# Reload in Chrome
# Go to chrome://extensions/ and click refresh icon
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
```

Husky will automatically:
- Run ESLint on changed files
- Run tests related to changed files

### 5. Push and Create PR

```bash
git push origin feature/my-new-feature
```

Then create a pull request on GitHub.

## Project Structure

```
okta-unbound/
├── src/
│   ├── background/          # Background service worker
│   │   ├── service-worker.ts
│   │   └── alarms.ts
│   ├── content/             # Content scripts (inject into Okta pages)
│   │   ├── index.ts
│   │   └── oktaApiClient.ts
│   ├── sidepanel/           # React app (main UI)
│   │   ├── App.tsx          # Root component
│   │   ├── components/      # React components
│   │   │   ├── DashboardTab.tsx
│   │   │   ├── OperationsTab.tsx
│   │   │   ├── GroupsTab.tsx
│   │   │   ├── RulesTab.tsx
│   │   │   ├── SecurityTab.tsx
│   │   │   └── AuditTab.tsx
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── useOktaApi.ts
│   │   │   └── useGroupContext.ts
│   │   └── styles/          # CSS modules
│   ├── shared/              # Shared utilities
│   │   ├── types.ts         # TypeScript interfaces
│   │   ├── constants.ts     # Constants
│   │   ├── ruleUtils.ts     # Rule parsing utilities
│   │   ├── rulesCache.ts    # Global rules cache
│   │   ├── auditLogger.ts   # Audit logging
│   │   └── tabStateManager.ts
│   └── test/                # Test setup and mocks
│       ├── setup.ts
│       └── mocks/
│           └── handlers.ts
├── docs/                    # Documentation (synced to wiki)
│   ├── Home.md
│   ├── Features.md
│   ├── guides/
│   ├── technical/
│   ├── api/
│   └── references/
├── assets/                  # Images and icons
│   ├── icons/
│   └── images/
├── scripts/                 # Build and utility scripts
├── .github/
│   └── workflows/           # CI/CD pipelines
│       └── ci.yml
├── .husky/                  # Git hooks
│   └── pre-commit
├── manifest.json            # Extension manifest
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── eslint.config.js
```

## Code Style Guide

### TypeScript

- **Always use TypeScript** - No plain JavaScript files in `src/`
- **Explicit types** - Avoid `any`, use proper types
- **Interfaces over types** - Use `interface` for object shapes
- **Strict mode** - All strict TypeScript options enabled

### React

- **Functional components** - No class components
- **Hooks** - Use hooks for state and side effects
- **Props interfaces** - Define interfaces for all component props
- **Memoization** - Use `useMemo` and `useCallback` for expensive operations

### Naming Conventions

**Files:**
- Components: `PascalCase.tsx` (e.g., `DashboardTab.tsx`)
- Hooks: `camelCase.ts` (e.g., `useOktaApi.ts`)
- Utilities: `camelCase.ts` (e.g., `ruleUtils.ts`)
- Tests: `*.test.ts` or `*.test.tsx`

**Variables:**
- Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TTL`)
- Variables: `camelCase` (e.g., `groupId`)
- Types/Interfaces: `PascalCase` (e.g., `GroupMember`)
- Private class members: `_camelCase` (e.g., `_cache`)

**Functions:**
- `camelCase` (e.g., `getGroupMembers`)
- Handlers: `handle` prefix (e.g., `handleSubmit`)
- Utilities: descriptive verbs (e.g., `extractUserAttributes`)

### Code Organization

**Component Structure:**

```typescript
// Imports
import React, { useState, useEffect } from 'react';
import { useGroupContext } from '../hooks/useGroupContext';

// Types
interface MyComponentProps {
  groupId: string;
  onSuccess?: () => void;
}

// Component
export const MyComponent: React.FC<MyComponentProps> = ({ groupId, onSuccess }) => {
  // Hooks
  const { groupData } = useGroupContext();
  const [loading, setLoading] = useState(false);

  // Effects
  useEffect(() => {
    // ...
  }, [groupId]);

  // Handlers
  const handleClick = () => {
    // ...
  };

  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

**Hook Structure:**

```typescript
// Imports
import { useState, useCallback } from 'react';

// Types
interface UseMyHookOptions {
  targetTabId?: number;
}

interface UseMyHookReturn {
  data: string | null;
  loading: boolean;
  fetchData: () => Promise<void>;
}

// Hook
export const useMyHook = (options: UseMyHookOptions): UseMyHookReturn => {
  // State
  const [data, setData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Memoized functions
  const fetchData = useCallback(async () => {
    // ...
  }, [options.targetTabId]);

  // Return
  return { data, loading, fetchData };
};
```

### Comments

- **JSDoc** for public functions and complex utilities
- **Inline comments** for complex logic
- **TODO comments** for planned improvements

```typescript
/**
 * Extracts user attributes referenced in a rule expression.
 * @param rule - The group rule to analyze
 * @returns Array of attribute names (e.g., ['department', 'title'])
 */
export function extractUserAttributes(rule: GroupRule): string[] {
  // Implementation
}
```

## Testing

### Writing Tests

See the full [Testing Guide](Testing.md) for comprehensive testing documentation.

**Quick example:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOktaApi } from './useOktaApi';

describe('useOktaApi', () => {
  it('should fetch group members', async () => {
    // Setup
    const mockSendMessage = vi.fn().mockResolvedValue({
      success: true,
      data: [{ id: '123', profile: { email: 'test@example.com' } }],
    });
    chrome.tabs.sendMessage = mockSendMessage;

    // Execute
    const { result } = renderHook(() => useOktaApi({ targetTabId: 123 }));

    let members;
    await act(async () => {
      members = await result.current.getAllGroupMembers('group1');
    });

    // Assert
    expect(members).toHaveLength(1);
    expect(members[0].profile.email).toBe('test@example.com');
  });
});
```

### Running Tests

```bash
# Watch mode (for development)
npm test

# Single run (for CI)
npm run test:run

# With coverage
npm run test:coverage

# Specific file
npm test -- src/shared/ruleUtils.test.ts
```

## Debugging

### Debug React Components

1. **React DevTools**
   - Install React DevTools extension
   - Open DevTools (F12)
   - Go to "Components" tab
   - Inspect component props and state

2. **Console Logging**
   ```typescript
   console.log('Debug:', { groupId, members });
   ```

3. **Debugger Statement**
   ```typescript
   debugger; // Execution will pause here
   ```

### Debug Content Script

1. **Find the content script**
   - Open DevTools (F12) on Okta page
   - Go to "Sources" tab
   - Find content script under "Content scripts"

2. **Add breakpoints**
   - Click line numbers to add breakpoints
   - Refresh page to trigger

3. **Console access**
   ```typescript
   // In content script
   console.log('Content script:', data);
   ```

### Debug Background Worker

1. **Inspect service worker**
   - Go to `chrome://extensions/`
   - Find Okta Unbound
   - Click "service worker" link
   - Opens dedicated DevTools window

2. **Logging**
   ```typescript
   // In background/service-worker.ts
   console.log('Background:', message);
   ```

### Debug Side Panel

1. **Inspect side panel**
   - Open side panel
   - Right-click anywhere in side panel
   - Click "Inspect"
   - Opens DevTools for side panel

2. **React DevTools**
   - Use Components tab to inspect React tree

### Common Issues

**Extension not reloading:**
- Go to `chrome://extensions/`
- Click refresh icon (🔄) on extension card
- Hard refresh Okta page (Ctrl+Shift+R)

**Changes not appearing:**
- Rebuild: `npm run build`
- Reload extension
- Clear cache in extension settings

**Tests failing:**
- Clear test cache: `npx vitest --clearCache`
- Check Node version: `node --version` (should be 18+)
- Reinstall: `rm -rf node_modules && npm install`

## Contributing

### Before Starting

1. **Check existing issues** - Avoid duplicate work
2. **Open an issue** - Discuss large changes first
3. **Read [CONTRIBUTING.md](../../CONTRIBUTING.md)** - Full contribution guidelines

### Pull Request Process

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests** for new functionality
5. **Update documentation** if needed
6. **Ensure tests pass** - `npm run test:run`
7. **Ensure linting passes** - `npm run lint`
8. **Commit with conventional commits**
9. **Push and create PR**

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes

**Examples:**
```
feat(groups): add group comparison feature
fix(operations): handle 429 rate limit errors
docs(readme): update installation instructions
test(hooks): add tests for useOktaApi
```

### Code Review Checklist

Before submitting PR, ensure:

- [ ] Tests added/updated
- [ ] Tests passing
- [ ] Linting passing
- [ ] Type checking passing
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow convention
- [ ] Branch is up to date with main
- [ ] No console.log statements (use proper logging)
- [ ] No commented-out code

## Development Tips

### Hot Reload

The dev server (`npm run dev`) provides hot module replacement, but you still need to reload the extension in Chrome after building.

### Rapid Testing Workflow

```bash
# Terminal 1: Watch mode for tests
npm test

# Terminal 2: Build on file changes
npm run dev

# When satisfied:
npm run build
# Reload extension in Chrome
```

### Mock Okta API Locally

Use MSW to mock Okta API responses during development:

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://example.okta.com/api/v1/groups/:groupId/users', () => {
    return HttpResponse.json([
      { id: '123', profile: { email: 'test@example.com' } },
    ]);
  }),
];
```

### Extension Development Best Practices

1. **Always reload extension** after building
2. **Check all three DevTools** (page, side panel, background)
3. **Test on real Okta** before submitting PR
4. **Use small test groups** (< 100 members) during development
5. **Monitor API requests** in Network tab

## Resources

### Documentation

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [Okta API Reference](https://developer.okta.com/docs/reference/)

### Tools

- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Chrome Extension DevTools](https://developer.chrome.com/docs/extensions/mv3/devtools/)

### Community

- [GitHub Issues](https://github.com/samdhenderson/okta-unbound/issues)
- [GitHub Discussions](https://github.com/samdhenderson/okta-unbound/discussions)

## Getting Help

If you're stuck:

1. Check this documentation
2. Search existing GitHub issues
3. Ask in GitHub Discussions
4. Open a new issue with your question

[← Back to Home](../Home.md) | [Architecture →](Architecture.md)
