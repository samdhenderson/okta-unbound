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
    return viteConfig;
  },
};

export default config;
