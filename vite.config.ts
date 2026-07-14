import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import manifest from './manifest.json' with { type: 'json' };
import pkg from './package.json' with { type: 'json' };

// package.json is the single source of truth for version (ADR-0007). The Chrome
// manifest requires a dotted-numeric version, so strip any prerelease suffix
// (e.g. "0.4.0-beta.1" -> "0.4.0").
const manifestVersion = pkg.version.split('-')[0];

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest: { ...manifest, version: manifestVersion } })],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
