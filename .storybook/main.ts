import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';
import { fileURLToPath } from 'node:url';
import type { PluginOption } from 'vite';

const configDir =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// Absolute path to the useOktaApi facade mock (Storybook-only).
const useOktaApiMock = path.resolve(configDir, 'mocks/useOktaApi.mock.ts');

/**
 * Redirect the `useOktaApi` FACADE module (src/sidepanel/hooks/useOktaApi.ts) to
 * the Storybook mock, for any import form (`./useOktaApi`, `../hooks/useOktaApi`,
 * `@/sidepanel/hooks/useOktaApi`). Resolving the specifier first means we match the
 * real file and deliberately DO NOT catch the `useOktaApi/` directory barrel
 * (which resolves to `useOktaApi/index.ts`).
 */
const mockUseOktaApiPlugin: PluginOption = {
  name: 'sb-mock-use-okta-api',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!source.includes('useOktaApi') || source.includes('useOktaApi/')) return null;
    const resolved = await this.resolve(source, importer, { skipSelf: true, ...options });
    if (resolved && /[/\\]hooks[/\\]useOktaApi\.tsx?$/.test(resolved.id)) {
      return useOktaApiMock;
    }
    return null;
  },
};

/** Recursively drop plugins whose name is `crx` or starts with `crx:`. */
function stripCrx(plugins: readonly unknown[]): unknown[] {
  return plugins
    .map((p) => {
      if (Array.isArray(p)) return stripCrx(p);
      const name = (p as { name?: string } | null)?.name;
      if (name === 'crx' || (name && name.startsWith('crx:'))) return null;
      return p;
    })
    .filter((p) => p !== null);
}

const config: StorybookConfig = {
  stories: [
    './docs/**/*.mdx',
    './generated/docs/**/*.mdx',
    '../src/**/*.mdx',
    '../src/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
    'storybook-addon-pseudo-states',
  ],
  framework: '@storybook/react-vite',
  docs: { autodocs: 'tag' },
  typescript: {
    // Read prop types + TSDoc from the strict interfaces for autodocs/Controls.
    reactDocgen: 'react-docgen-typescript',
  },
  async viteFinal(viteConfig) {
    // The @crxjs/vite-plugin (which builds the MV3 extension) contributes ~20
    // `crx:*` sub-plugins that require the extension manifest and break a plain
    // web build. Storybook auto-merges the app's vite.config.ts (so we inherit
    // @tailwindcss/vite + the `@` alias for free); we only need to drop crx.
    viteConfig.plugins = stripCrx(viteConfig.plugins ?? []) as typeof viteConfig.plugins;
    viteConfig.plugins = [mockUseOktaApiPlugin, ...(viteConfig.plugins ?? [])];

    viteConfig.resolve = viteConfig.resolve ?? {};
    viteConfig.resolve.alias = {
      ...(viteConfig.resolve.alias as Record<string, string>),
      '@': path.resolve(configDir, '../src'),
    };

    // Pre-bundle the non-storybook runtime dependencies the story graph reaches
    // directly. Under the browser test runner each would otherwise be discovered
    // lazily when the importing module first loads, triggering a mid-run dep
    // re-optimization that invalidates already-served module URLs and fails
    // whichever story file happened to be in flight — with an error that names
    // that innocent file rather than the dependency ("Failed to fetch dynamically
    // imported module", or "Vitest failed to find the current suite" when the
    // reload lands during collection). Including them here settles the optimizer
    // before the suite runs.
    //
    // - `zod` — EntityPicker.stories builds fake descriptor schemas with it.
    // - `react-dom` — shared/Modal imports `createPortal` from it (D-009). The
    //   bare specifier is distinct from the `react-dom/client` main.tsx uses, and
    //   Vite optimizes each subpath separately, so this is not already covered.
    viteConfig.optimizeDeps = viteConfig.optimizeDeps ?? {};
    viteConfig.optimizeDeps.include = [
      ...(viteConfig.optimizeDeps.include ?? []),
      'zod',
      'react-dom',
    ];
    return viteConfig;
  },
};

export default config;
