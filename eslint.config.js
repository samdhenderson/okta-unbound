import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.github/**', 'docs/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        chrome: 'readonly',
        browser: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        global: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
        document: 'readonly',
        Blob: 'readonly',
        crypto: 'readonly',
        window: 'readonly',
        fetch: 'readonly',
        navigator: 'readonly',
        AbortController: 'readonly',
        RequestInit: 'readonly',
        NodeJS: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        IntersectionObserver: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react: react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off', // Using TypeScript for type checking
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // No-`any` policy (ADR-0004/0006): the message/API-layer burndown is done and
      // the §7 god components are decomposed, so every production `any` is now either
      // gone or an intentional, reason-annotated `eslint-disable`. Flipped warn→error.
      // Exceptions: test/setup files (mocks) via the override block below.
      '@typescript-eslint/no-explicit-any': 'error',
      // React Compiler rules - these are performance suggestions, not bugs
      // Setting state in effects is valid React when done intentionally
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn', // Downgrade from error to warning
      // Logging policy (ADR-0004): use the logger util (src/shared/utils/logger.ts),
      // not raw console. Migration complete — logger.ts is the only production
      // console.* holder (allowed via its own override); tests may spy on console.
      'no-console': 'error',
      // Architecture guard (docs/architecture.md): Okta API traffic must go through
      // the ApiScheduler. Raw `chrome.tabs.sendMessage` is the direct side-panel→
      // content path that bypasses rate limiting — forbid new call sites. Existing
      // holders are grandfathered in the override block below.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='sendMessage'][callee.object.property.name='tabs']",
          message:
            'Do not call chrome.tabs.sendMessage directly — it bypasses the ApiScheduler rate limiting. Route API traffic through useOktaApi (makeApiRequest) / coreApi.sendMessage. See docs/architecture.md.',
        },
      ],
      'no-debugger': 'warn',
      'no-undef': 'warn', // Downgrade from error to warning
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'react/no-unescaped-entities': 'warn', // Downgrade from error to warning
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // Grandfathered holders of raw `chrome.tabs.sendMessage` (see the guard above).
  // Sanctioned (keeps raw access): apiScheduler.ts (the rate-limited path's own
  // dispatch to content — the endpoint the guard steers traffic toward),
  // useOktaApi/core.ts, and useOktaTabContext.ts (lightweight page-context probes,
  // not rate-limited API traffic). §8's transport migration is COMPLETE — every
  // legacy read/write bypass (searchUsers, getUserDetails, useRuleLifecycle,
  // useGroupLiveSearch, getUserGroups, and fetchGroupRules) now routes through the
  // scheduler, so only the three sanctioned entries remain.
  {
    files: [
      'src/shared/scheduler/apiScheduler.ts',
      'src/sidepanel/hooks/useOktaApi/core.ts',
      'src/sidepanel/hooks/useOktaTabContext.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  // Tests may spy on / stub console (e.g. suppressing expected warnings) and use
  // `any` in mocks/fixtures where modelling the full Okta shape adds no value.
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Storybook stories: CSF requires a default export (the `meta`) alongside the
  // named story exports, which trips react-refresh/only-export-components. Disable
  // it for stories (mirrors the test-file override). See docs/component-explorer.md.
  {
    files: ['**/*.stories.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Disable ESLint rules that conflict with Prettier (must be last).
  prettier,
];
