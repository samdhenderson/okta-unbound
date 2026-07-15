import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetEntityCache } from '../sidepanel/cache/entityCache';

// Cleanup after each test
afterEach(() => {
  cleanup();
  // The entity cache is a module-level singleton; reset it so cached data from
  // one test never suppresses a fetch (or a loading state) asserted by the next.
  resetEntityCache();
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
  },
} as any;

// Mock fetch globally
globalThis.fetch = vi.fn();
