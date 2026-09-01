import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { resetEntityCache } from '../sidepanel/cache/entityCache';
import { resetCurrentUserCache } from '../sidepanel/hooks/useOktaApi/currentUserCache';

// `StableWidth` (ADR-0044's layout-stability convention) reserves a slot by
// rendering its widest state invisibly in the same grid cell. That twin is
// `aria-hidden` and `invisible`, so no reader ever meets it — but a text query
// walks the DOM and would match it, making every reserved label ambiguous.
// Ignoring it here is the same mechanism Testing Library already uses to skip
// `<script>` and `<style>`: the query sees what the user sees. The subtree is
// named explicitly — `ignore` filters nodes that *match* the selector, so a
// reserved chip's inner spans would otherwise still be found.
configure({ defaultIgnore: 'script, style, [data-reserve-width], [data-reserve-width] *' });

// Cleanup after each test
afterEach(() => {
  cleanup();
  // The entity cache is a module-level singleton; reset it so cached data from
  // one test never suppresses a fetch (or a loading state) asserted by the next.
  resetEntityCache();
  // Same reasoning for the per-tab current-user TTL cache: a cached admin
  // identity from one test must never suppress a /users/me fetch (and shift a
  // mockResolvedValueOnce sequence) in the next.
  resetCurrentUserCache();
});

// Mock Chrome APIs
globalThis.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`),
  },
  tabs: {
    query: vi.fn(),
    onActivated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    // `workingSetStore.subscribe` and `AuditLogViewer` both register here. A
    // spy is enough for the suite: no test asserts a broadcast arrives, and a
    // missing member would make an unrelated component throw on mount.
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
} as any;

// Mock fetch globally
globalThis.fetch = vi.fn();
