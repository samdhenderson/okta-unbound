# Tailwind CSS v4 Setup Guide for Okta Unbound

This document provides instructions for setting up Tailwind CSS v4 in the Okta Unbound extension.

## Overview

The new Overview tab and components have been built using Tailwind-compatible className APIs. The styles will be fully functional once Tailwind CSS v4 is installed and configured.

## Installation Steps

### 1. Install Tailwind CSS v4

```bash
npm install -D tailwindcss@next @tailwindcss/vite@next
```

### 2. Create Tailwind Configuration

Create `tailwind.config.ts` in the project root:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx,html}',
    './sidepanel.html',
    './popup.html',
  ],
  theme: {
    extend: {
      colors: {
        // Match existing Okta Unbound color scheme
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#007BBF', // Existing primary color
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      animation: {
        'spin': 'spin 1s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
```

### 3. Create Tailwind Entry CSS

Create `src/styles/tailwind.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom component classes */
@layer components {
  .tab-button {
    @apply px-4 py-2 text-sm font-medium transition-colors;
  }

  .tab-button.active {
    @apply bg-blue-50 text-blue-700 border-b-2 border-blue-600;
  }

  .tab-button:hover:not(.active) {
    @apply bg-gray-50;
  }

  .sidebar-container {
    @apply flex flex-col h-screen bg-gray-50;
  }

  .tab-content {
    @apply flex-1 overflow-y-auto;
  }

  .tab-content.active {
    @apply block;
  }
}
```

### 4. Update Vite Configuration

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Add Tailwind plugin
    crx({ manifest }),
  ],
  // ... rest of config
});
```

### 5. Import Tailwind CSS

Update `src/sidepanel/index.tsx` to import the Tailwind CSS file:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tailwind.css'; // Add this import
import './index.css'; // Existing styles (can be gradually migrated)
import { ProgressProvider } from './contexts/ProgressContext';

// ... rest of file
```

### 6. Build and Test

```bash
npm run build
```

Then load the extension in Chrome and verify the new Overview tab renders correctly.

## Migration Strategy

### Phase 1: Overview Tab (Complete)
✅ All new Overview components use Tailwind classes
✅ StatCard, QuickActionsPanel, ContextBadge components
✅ GroupOverview, UserOverview, AppOverview, AdminOverview

### Phase 2: Existing Components (Gradual)
Gradually migrate existing components from `styles.css` to Tailwind:

1. **TabNavigation** - Already set up for Tailwind with `.tab-button` classes
2. **Header & GroupBanner** - Add Tailwind utility classes
3. **Modal Components** - Replace inline styles with Tailwind
4. **Cards & Panels** - Standardize with Tailwind components
5. **Forms & Inputs** - Use Tailwind form utilities

### Phase 3: Cleanup
- Remove unused CSS from `styles.css`
- Consolidate color variables into Tailwind theme
- Remove inline styles from all components

## Component Class Patterns

Here are the recommended Tailwind patterns used in the new components:

### Cards/Panels
```tsx
<div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
  {/* content */}
</div>
```

### Buttons
```tsx
// Primary
<button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">

// Secondary
<button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">

// Danger
<button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
```

### Grid Layouts
```tsx
// 4-column responsive grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

// 2-column responsive grid
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
```

### Loading Spinners
```tsx
<div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
```

### Badges
```tsx
<span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
  ACTIVE
</span>
```

## Troubleshooting

### Styles Not Applying
- Verify Tailwind CSS is imported in `index.tsx`
- Check that `content` paths in `tailwind.config.ts` match your file structure
- Clear build cache: `rm -rf dist/ node_modules/.vite`

### Classes Not Found
- Ensure you're using Tailwind v4 syntax
- Check for typos in class names
- Verify the class is not purged (check `content` config)

### Build Errors
- Make sure `@tailwindcss/vite@next` is installed
- Check Vite plugin order (Tailwind should come before crx)

## Benefits of Tailwind v4

1. **Faster Build Times** - Native CSS engine
2. **Better DX** - Type-safe with TypeScript
3. **Smaller Bundle** - Optimized CSS output
4. **Modern Syntax** - Cleaner, more intuitive classes
5. **Vite Integration** - First-class Vite support

## References

- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [Tailwind v4 Migration Guide](https://tailwindcss.com/docs/upgrade-guide)
- [@tailwindcss/vite Plugin](https://github.com/tailwindlabs/tailwindcss/tree/next/packages/%40tailwindcss-vite)

---

**Note:** All new components are ready for Tailwind. They use standard className APIs that will work immediately once Tailwind is configured. No component refactoring needed!
