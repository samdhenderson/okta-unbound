/**
 * Tests for the post-install/update content-script re-injection
 * (`src/background/reinjectContentScripts.ts`).
 *
 * These pin the contract that keeps the "Disconnected" side panel from surviving an
 * extension update:
 *  - the files and match patterns come from `chrome.runtime.getManifest()` (the BUILT,
 *    crxjs-rewritten paths) — nothing is hardcoded;
 *  - one tab refusing injection never stops the others;
 *  - no matching tabs, or a manifest with no content scripts, is a clean no-op.
 *
 * Harness notes:
 * - Mirrors `src/background/index.test.ts`: `globalThis.chrome` is replaced per test
 *   with inspectable `vi.fn()`s, and the module under test is imported fresh after
 *   `vi.resetModules()`.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ============================================================================
// Harness
// ============================================================================

/** The built path crxjs rewrites `src/content/index.ts` to — never hardcoded in src. */
const BUILT_CONTENT_SCRIPT = 'assets/content.index-abc12345.js';

const OKTA_MATCHES = [
  'https://*.okta.com/*',
  'https://*.oktapreview.com/*',
  'https://*.okta-emea.com/*',
];

const getManifest = vi.fn();
const tabsQuery = vi.fn();
const executeScript = vi.fn();

/** Install the chrome fake; `contentScripts` becomes the manifest's `content_scripts`. */
function setupChrome(contentScripts: unknown): void {
  getManifest.mockReturnValue({
    version: '0.0.0-test',
    content_scripts: contentScripts,
  });

  globalThis.chrome = {
    runtime: { id: 'test-extension', getManifest },
    tabs: { query: tabsQuery },
    scripting: { executeScript },
  } as unknown as typeof chrome;
}

/** Import the module fresh (mirrors the background suite's reset-then-import style). */
async function loadModule(): Promise<() => Promise<void>> {
  vi.resetModules();
  const module = await import('./reinjectContentScripts');
  return module.reinjectContentScripts;
}

/** Tab ids passed to `executeScript`, in call order. */
function injectedTabIds(): number[] {
  return (executeScript as Mock).mock.calls.map(
    (call) => (call[0] as chrome.scripting.ScriptInjection<[], unknown>).target.tabId,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tabsQuery.mockResolvedValue([]);
  executeScript.mockResolvedValue([]);
  setupChrome([{ matches: OKTA_MATCHES, js: [BUILT_CONTENT_SCRIPT] }]);
});

// ============================================================================
// Happy path
// ============================================================================

describe('reinjectContentScripts', () => {
  it('injects the manifest-declared files into every matched tab', async () => {
    tabsQuery.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const reinjectContentScripts = await loadModule();
    await reinjectContentScripts();

    // The query is driven by the manifest's own match patterns.
    expect(tabsQuery).toHaveBeenCalledTimes(1);
    expect(tabsQuery).toHaveBeenCalledWith({ url: OKTA_MATCHES });

    expect(executeScript).toHaveBeenCalledTimes(3);
    expect(injectedTabIds()).toEqual([1, 2, 3]);
    // The BUILT path is read back from the manifest, never hardcoded.
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 1 },
      files: [BUILT_CONTENT_SCRIPT],
    });
  });

  it('iterates every content_scripts entry', async () => {
    setupChrome([
      { matches: ['https://*.okta.com/*'], js: ['assets/one.js'] },
      { matches: ['https://*.okta-emea.com/*'], js: ['assets/two.js'] },
    ]);
    tabsQuery.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([{ id: 2 }]);

    const reinjectContentScripts = await loadModule();
    await reinjectContentScripts();

    expect(tabsQuery).toHaveBeenCalledTimes(2);
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 1 }, files: ['assets/one.js'] });
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 2 }, files: ['assets/two.js'] });
  });

  it('skips tabs with no id', async () => {
    tabsQuery.mockResolvedValue([{ id: undefined }, { id: 5 }]);

    const reinjectContentScripts = await loadModule();
    await reinjectContentScripts();

    expect(injectedTabIds()).toEqual([5]);
  });
});

// ============================================================================
// Per-tab failure isolation
// ============================================================================

describe('per-tab failures', () => {
  it('swallows a rejected executeScript and still injects the remaining tabs', async () => {
    tabsQuery.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    executeScript.mockImplementation(async (injection: { target: { tabId: number } }) => {
      if (injection.target.tabId === 2) {
        throw new Error('Cannot access a chrome:// URL');
      }
      return [];
    });

    const reinjectContentScripts = await loadModule();

    // The failure must not surface to the fire-and-forget caller in onInstalled.
    await expect(reinjectContentScripts()).resolves.toBeUndefined();
    expect(injectedTabIds()).toEqual([1, 2, 3]);
  });

  it('logs the failing tab id and nothing else about the tab', async () => {
    tabsQuery.mockResolvedValue([{ id: 42, url: 'https://acme.okta.com/admin/groups' }]);
    executeScript.mockRejectedValue(new Error('The tab was discarded'));
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const reinjectContentScripts = await loadModule();
    await reinjectContentScripts();

    const logged = [...debug.mock.calls, ...warn.mock.calls, ...error.mock.calls]
      .flat()
      .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ');
    expect(logged).not.toContain('acme.okta.com');
    // A failed tab is a debug-level outcome, never an error the user sees.
    expect(error).not.toHaveBeenCalled();
  });

  it('moves on to the next entry when the tab query itself rejects', async () => {
    setupChrome([
      { matches: ['https://*.okta.com/*'], js: ['assets/one.js'] },
      { matches: ['https://*.okta-emea.com/*'], js: ['assets/two.js'] },
    ]);
    tabsQuery
      .mockRejectedValueOnce(new Error('No tabs permission'))
      .mockResolvedValueOnce([{ id: 9 }]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const reinjectContentScripts = await loadModule();
    await expect(reinjectContentScripts()).resolves.toBeUndefined();

    expect(injectedTabIds()).toEqual([9]);
  });
});

// ============================================================================
// No-op paths
// ============================================================================

describe('no-op paths', () => {
  it('does not call executeScript when no tabs match', async () => {
    tabsQuery.mockResolvedValue([]);

    const reinjectContentScripts = await loadModule();
    await reinjectContentScripts();

    expect(tabsQuery).toHaveBeenCalledTimes(1);
    expect(executeScript).not.toHaveBeenCalled();
  });

  it.each([
    ['content_scripts missing', undefined],
    ['content_scripts empty', []],
  ])('is a clean no-op when %s', async (_name, contentScripts) => {
    setupChrome(contentScripts);

    const reinjectContentScripts = await loadModule();
    await expect(reinjectContentScripts()).resolves.toBeUndefined();

    expect(tabsQuery).not.toHaveBeenCalled();
    expect(executeScript).not.toHaveBeenCalled();
  });

  it.each([
    ['an entry with no js files', { matches: OKTA_MATCHES, js: [] }],
    ['an entry with no match patterns', { matches: [], js: [BUILT_CONTENT_SCRIPT] }],
    ['an entry missing both fields', {}],
  ])('skips %s without querying tabs', async (_name, entry) => {
    setupChrome([entry]);

    const reinjectContentScripts = await loadModule();
    await reinjectContentScripts();

    expect(tabsQuery).not.toHaveBeenCalled();
    expect(executeScript).not.toHaveBeenCalled();
  });
});
