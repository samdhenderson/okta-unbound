/**
 * Benign `chrome` extension API fake for Storybook.
 *
 * Mirrors the surface stubbed in `src/test/setup.ts`, but every call resolves
 * quietly so provider effects settle instead of throwing. In particular
 * `runtime.sendMessage` MUST return a resolved promise — `SchedulerContext` polls
 * it once per second on mount, and a thrown/undefined result would spam the
 * console and trip the ErrorBoundary. Storage getters support both the promise and
 * legacy callback calling conventions.
 *
 * Installed for its side effect from `.storybook/preview.tsx`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const noop = () => {};

/** get(keys) -> Promise<{}>, and get(keys, cb) -> cb({}). */
const storageGet = (keys?: any, cb?: (items: Record<string, unknown>) => void) => {
  if (typeof cb === 'function') {
    cb({});
    return undefined as any;
  }
  if (typeof keys === 'function') {
    (keys as (items: Record<string, unknown>) => void)({});
    return undefined as any;
  }
  return Promise.resolve({});
};

const storageArea = {
  get: storageGet,
  set: (_items?: any, cb?: () => void) => (cb ? (cb(), undefined) : Promise.resolve()),
  remove: (_keys?: any, cb?: () => void) => (cb ? (cb(), undefined) : Promise.resolve()),
};

const listenerSlot = { addListener: noop, removeListener: noop, hasListener: () => false };

const chromeFake = {
  runtime: {
    // Scheduler/provider round-trips resolve to a benign, well-formed payload.
    sendMessage: (_message?: any) => Promise.resolve({ ok: true }),
    onMessage: listenerSlot,
    getURL: (path: string) => `chrome-extension://storybook-mock/${path}`,
    lastError: undefined as unknown,
  },
  tabs: {
    query: (_q?: any) => Promise.resolve([]),
    sendMessage: (_tabId?: number, _message?: any) => Promise.resolve({ ok: true }),
    onActivated: listenerSlot,
    onUpdated: listenerSlot,
  },
  storage: {
    local: storageArea,
    sync: storageArea,
  },
};

/** Install the fake onto `globalThis.chrome` (idempotent). */
export function installChromeFake(): void {
  (globalThis as any).chrome = chromeFake;
}
