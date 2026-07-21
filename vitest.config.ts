import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// When set (local sandbox), pin the pre-installed Chromium so no download happens.
// When unset (CI, after `npx playwright install chromium`), let Playwright resolve
// its own managed binary.
const executablePath = process.env.VITEST_BROWSER_EXECUTABLE;

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    // Coverage stays at the top level so it can span both projects. The 80/75
    // gate is ENFORCED in CI: the `verify` job runs `npm run test:coverage`.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.stories.{ts,tsx}',
        '**/mockData',
        'dist/',
        '.github/',
        'docs/',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    projects: [
      {
        // (a) The existing jsdom unit/component suite — unchanged behaviour.
        // `npm run test:run` targets this project only, so it stays browser-free.
        plugins: [react()],
        resolve: { alias: { '@': path.resolve(dirname, './src') } },
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
        },
      },
      {
        // (b) The Storybook browser project — every story becomes a render test
        // (and the 9 stories with `play` fns become interaction tests). The test
        // set is derived from .storybook/main.ts's `stories` glob, and
        // storybookTest reuses main.ts's viteFinal (so the useOktaApi mock alias
        // + crx-strip apply); vitest.setup.ts applies the preview decorators.
        plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
        test: {
          name: 'storybook',
          // The browser runner occasionally throws "Failed to fetch dynamically
          // imported module" for a Storybook addon chunk (addon-docs / addon-vitest)
          // — a transient Vite dep-optimizer race, not a broken story (the affected
          // file varies run to run). Retry clears the transient test-level failures;
          // the CI script also passes --no-file-parallelism to serialize file loads
          // so the optimizer settles before the bulk of the suite runs.
          retry: 2,
          // @storybook/addon-vitest (SB 10.3+) auto-applies the preview
          // annotations (provider decorators + the chrome-fake side effect from
          // preview.tsx), so no explicit setProjectAnnotations setup file is needed.
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: executablePath ? { executablePath } : {},
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
