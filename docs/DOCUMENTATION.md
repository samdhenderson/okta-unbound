# Okta Unbound Documentation

This directory contains comprehensive API documentation for the Okta Unbound Chrome extension.

## 📚 Documentation Overview

The documentation is automatically generated from TypeScript source code and JSDoc comments using **TypeDoc**, providing type-safe, searchable, and well-organized API reference.

### What's Included

- **Complete API Reference**: All classes, interfaces, types, and functions
- **Module Organization**: Code organized by functional areas (background, content, hooks, contexts, etc.)
- **Type Information**: Full TypeScript type signatures and descriptions
- **Usage Examples**: Code examples where applicable
- **Cross-References**: Linked documentation for related components

## 🌐 Viewing the Documentation

### Local Development

1. Generate the latest documentation:
   ```bash
   npm run docs
   ```

2. Open the documentation in your browser:
   ```bash
   # macOS
   open docs/api/index.html

   # Linux
   xdg-open docs/api/index.html

   # Windows
   start docs/api/index.html
   ```

3. Clean generated docs:
   ```bash
   npm run docs:clean
   ```

## 📖 Documentation Structure

### Modules

The codebase is organized into the following key modules:

#### **background/index**
Background service worker managing:
- Global API request scheduling and rate limiting
- Tab state persistence
- Audit log retention
- Extension lifecycle events

#### **content/index**
Content script injected into Okta pages:
- Authenticated API request handling
- Page context extraction (group IDs, user info)
- XSRF token management
- Data export functionality

#### **hooks/useOktaApi**
Primary React hook for Okta API interactions:
- User management operations
- Group management operations
- Application assignment management
- Bulk operations with progress tracking
- Audit logging and undo support

#### **contexts/ProgressContext**
React context for progress tracking:
- Centralized progress state management
- Operation naming and percentage tracking
- API call counting
- Cancellation support

#### **shared/scheduler/apiScheduler**
Core API scheduler preventing rate limiting:
- Request queuing with priorities
- Rate limit detection and cooldowns
- Automatic retry with exponential backoff
- Concurrent request management

## 🔍 Key Features

### Module Documentation

Each module includes:
- **Description**: Purpose and responsibilities
- **Architecture**: How it fits in the overall system
- **Examples**: Common usage patterns
- **See Also**: Links to related modules

### Type Documentation

All TypeScript types are fully documented:
- **Interfaces**: Data structures with property descriptions
- **Type Aliases**: Custom types and unions
- **Enums**: Available enum values
- **Generics**: Type parameter explanations

### Function Documentation

Functions include:
- **Parameters**: Type and purpose of each parameter
- **Returns**: Return type and description
- **Throws**: Potential errors
- **Examples**: Usage demonstrations

## 🛠️ Generating Documentation

### Prerequisites

- Node.js 16 or higher
- All project dependencies installed (`npm install`)

### Generation Command

```bash
npm run docs
```

This will:
1. Parse all TypeScript files in the `src/` directory
2. Extract JSDoc comments and type information
3. Generate HTML documentation in `docs/api/`
4. Create indexes and navigation
5. Apply syntax highlighting

### Configuration

Documentation generation is configured in [typedoc.json](../typedoc.json):

```json
{
  "entryPoints": ["src"],
  "out": "docs/api",
  "exclude": ["**/*+(test|spec).+(ts|tsx)"],
  "name": "Okta Unbound API Documentation",
  "theme": "default"
}
```

## 📝 Writing Documentation

### JSDoc Comments

Use JSDoc comments to document your code:

```typescript
/**
 * @module hooks/useMyHook
 * @description Brief description of what this module does.
 *
 * Detailed explanation of the module's purpose, architecture,
 * and how it integrates with other parts of the system.
 *
 * @example
 * ```tsx
 * const { data, loading } = useMyHook({ id: '123' });
 * ```
 */

/**
 * Custom hook for managing widget state
 *
 * @param {MyHookOptions} options - Configuration options
 * @returns {MyHookReturn} Hook state and methods
 *
 * @example
 * ```tsx
 * const { data, refresh } = useMyHook({
 *   autoRefresh: true,
 *   interval: 5000
 * });
 * ```
 */
export function useMyHook(options: MyHookOptions): MyHookReturn {
  // Implementation
}
```

### Best Practices

1. **Module Headers**: Every file should start with a `@module` JSDoc comment
2. **Function Descriptions**: Explain what the function does and why
3. **Parameter Documentation**: Describe each parameter's purpose
4. **Return Values**: Document what's returned and when
5. **Examples**: Include realistic usage examples
6. **Cross-References**: Link to related modules with `@see`

## 🎯 Documentation Goals

### For Developers

- **Onboarding**: New contributors can understand the codebase quickly
- **API Discovery**: Find available hooks, utilities, and components
- **Type Safety**: Leverage TypeScript types for confident development
- **Best Practices**: Learn patterns used throughout the codebase

### For Maintainers

- **Architecture Documentation**: High-level system design is preserved
- **Change Tracking**: Documentation stays in sync with code
- **Code Review**: Well-documented code is easier to review
- **Knowledge Transfer**: Institutional knowledge is captured

## 🔧 Troubleshooting

### Documentation Not Generating

```bash
# Clean and regenerate
npm run docs:clean
npm run docs
```

### TypeScript Errors

TypeDoc uses your TypeScript configuration. Ensure:
- `tsconfig.json` is valid
- All dependencies are installed
- No critical TypeScript errors in source files

### Missing Documentation

If expected documentation is missing:
- Check that the file is in `src/` directory
- Ensure it's not excluded by patterns in `typedoc.json`
- Verify the file has proper JSDoc comments

## 📊 Documentation Statistics

Current documentation coverage:
- **Total Modules**: 20+
- **Total Pages**: 300+
- **Documented Functions**: 100+
- **Documented Interfaces**: 50+
- **Code Examples**: 25+

## 🔄 Updating Documentation

Documentation should be updated:
- ✅ When adding new public APIs
- ✅ When changing function signatures
- ✅ When modifying behavior
- ✅ When fixing bugs that change semantics
- ✅ Before submitting pull requests

Documentation updates are NOT needed for:
- ❌ Internal implementation details
- ❌ Private functions
- ❌ Test files
- ❌ Minor refactoring without API changes

## 📞 Support

For questions about the documentation:
- Check the [API Reference](api/index.html)
- Review the [Architecture Guide](ARCHITECTURE.md)
- Submit an issue on GitHub

---

*Documentation generated with [TypeDoc](https://typedoc.org/)*
