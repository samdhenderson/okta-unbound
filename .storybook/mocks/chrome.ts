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

/**
 * Backing store for the `chrome.storage.local` fake.
 *
 * Was a hard-coded `{}`, which meant `App` could only ever restore the default
 * Overview tab and the pinned-context path was unreachable. A real map lets a
 * story open the panel directly on the tab its scene is about — the difference
 * between filming a tab click and filming the thing you came to show.
 */
const storageBacking = new Map<string, unknown>();

/** Seed `chrome.storage.local` before a story mounts. */
export function setStorageSeed(items: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(items)) storageBacking.set(key, value);
}

/** Empty the storage fake. */
export function resetStorageSeed(): void {
  storageBacking.clear();
}

/** Resolve the subset of `storageBacking` a `get(keys)` call asked for. */
const readKeys = (keys?: any): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (keys == null) {
    for (const [k, v] of storageBacking) out[k] = v;
    return out;
  }
  const wanted = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
  for (const key of wanted) {
    if (storageBacking.has(key)) out[key] = storageBacking.get(key);
  }
  return out;
};

/** get(keys) -> Promise<items>, and get(keys, cb) -> cb(items). */
const storageGet = (keys?: any, cb?: (items: Record<string, unknown>) => void) => {
  if (typeof cb === 'function') {
    cb(readKeys(keys));
    return undefined as any;
  }
  if (typeof keys === 'function') {
    (keys as (items: Record<string, unknown>) => void)(readKeys());
    return undefined as any;
  }
  return Promise.resolve(readKeys(keys));
};

const storageArea = {
  get: storageGet,
  set: (items?: any, cb?: () => void) => {
    if (items && typeof items === 'object') {
      for (const [k, v] of Object.entries(items)) storageBacking.set(k, v);
    }
    return cb ? (cb(), undefined) : Promise.resolve();
  },
  remove: (keys?: any, cb?: () => void) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) storageBacking.delete(key);
    return cb ? (cb(), undefined) : Promise.resolve();
  },
};

const listenerSlot = { addListener: noop, removeListener: noop, hasListener: () => false };

/**
 * A real listener registry for `chrome.runtime.onMessage`.
 *
 * `useOrgSnapshot` subscribes here for `{ action: 'snapshotUpdated' }` — it is
 * how the panel repaints as a background walk streams rows in. With a no-op
 * slot that repaint could never be triggered, so the most cinematic beat the
 * app has (rows arriving into a list that is already on screen) was unfilmable.
 */
type RuntimeListener = (message: unknown, sender: unknown, sendResponse: () => void) => void;
const runtimeListeners = new Set<RuntimeListener>();

const runtimeOnMessage = {
  addListener: (fn: RuntimeListener) => runtimeListeners.add(fn),
  removeListener: (fn: RuntimeListener) => runtimeListeners.delete(fn),
  hasListener: (fn: RuntimeListener) => runtimeListeners.has(fn),
};

/** Deliver a runtime message to every subscriber, as the background would. */
export function emitRuntimeMessage(message: unknown): void {
  for (const listener of [...runtimeListeners]) listener(message, {}, noop);
}

// --- Inline fixtures for the content-script message contract -----------------
// Defined here (not imported from src/test/mocks) so the preview bundle stays
// free of msw. Enough shape for the overview/context components to render a
// populated state instead of a "failed to load" error.
const sampleUser = {
  id: 'user1',
  status: 'ACTIVE',
  profile: {
    login: 'ada.lovelace@example.com',
    email: 'ada.lovelace@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    title: 'Principal Engineer',
  },
};
const sampleGroups = [
  {
    id: 'g-eng',
    type: 'OKTA_GROUP',
    profile: { name: 'Engineering', description: 'All engineers' },
  },
  {
    id: 'g-admins',
    type: 'APP_GROUP',
    profile: { name: 'Okta Admins', description: 'Admin console' },
  },
];

/**
 * What the "what entity is this Okta page showing?" probes report.
 *
 * Defaults to no entity detected, which is the honest answer in a component
 * explorer with no real page — and which keeps container tabs in their empty
 * state instead of auto-loading a phantom entity. A scene stages a value here
 * to film the panel as it looks when you are actually *on* a group or user page,
 * which is the context the whole extension is built around (ADR-0032).
 */
const pageContext: Record<string, unknown> = {};

/** Stage the entity the connected Okta page is showing. */
export function setPageContext(context: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(context)) pageContext[key] = value;
}

/** Clear any staged page context, restoring "nothing detected". */
export function resetPageContext(): void {
  for (const key of Object.keys(pageContext)) delete pageContext[key];
}

/**
 * Simulate the content script's `{ success, data }` responses for the read
 * actions that components/hooks post directly via `chrome.tabs.sendMessage`
 * (the ones that bypass `useOktaApi`). Unknown actions fall through to the
 * benign `{ ok: true }` default so nothing throws.
 */
function respondToTabAction(message?: { action?: string }): unknown {
  switch (message?.action) {
    case 'getOktaOrigin':
      return { success: true, data: 'https://example.okta.com' };

    // Explicit fetches by id (a component was handed an id and asks for it) →
    // return fixture data so those components render a populated state.
    case 'getUserDetails':
      return { success: true, data: sampleUser };
    case 'getUserGroups':
      return {
        success: true,
        data: sampleGroups.map((group) => ({
          group,
          membershipType: 'DIRECT',
          addedDate: '2024-01-01',
        })),
      };
    case 'fetchGroupRules':
      return { success: true, data: [], conflicts: [] };

    // Page-context DETECTION ("what entity is the current Okta page showing?") →
    // there is no real page in the explorer, so report no entity detected. This
    // keeps container tabs (e.g. UsersTab) in their default empty/search state
    // rather than auto-loading a phantom detected user in a re-entrant loop.
    case 'getUserInfo':
    case 'getUserContext':
    case 'getGroupInfo':
    case 'getAppInfo':
    case 'getPolicyInfo':
      return { success: true, data: pageContext[message.action] ?? null };

    default:
      return { ok: true };
  }
}

/**
 * How the fake answers `syncSnapshot` (ADR-0040).
 *
 * Snapshot-backed tabs read their rows from IndexedDB — which a story seeds
 * directly through `orgSnapshotStore` — but they still *ask* the background to
 * sync, and the answer decides whether the tab shows its content, its spinner or
 * its error banner. A story overrides this to stage the latter two; everything
 * else gets a plain success.
 */
let syncSnapshotResponder: () => Promise<unknown> = async () => ({ success: true });

/**
 * Stage the background's answer to the next `syncSnapshot` requests.
 *
 * @param responder - Returns the response; a never-settling promise stages the
 * loading state, and `{ success: false, error }` stages the banner.
 */
export function setSyncSnapshotResponder(responder: () => Promise<unknown>): void {
  syncSnapshotResponder = responder;
}

/** Restore the default "the walk succeeded" answer. */
export function resetSyncSnapshotResponder(): void {
  syncSnapshotResponder = async () => ({ success: true });
}

/**
 * What the fake reports for `getSchedulerState` / `getSchedulerMetrics`.
 *
 * `SchedulerContext` reads these once on mount. Unanswered, the ActivityBar's
 * scheduler half (queue depth, rate-limit headroom, cooldown) stays blank
 * forever — fine for a component story, wrong for a demo whose whole point is
 * that the panel is doing real work.
 */
let schedulerState: unknown = null;

/** Stage the scheduler state the ActivityBar renders. */
export function setSchedulerState(state: unknown): void {
  schedulerState = state;
}

/** Restore the default "no scheduler state" answer. */
export function resetSchedulerState(): void {
  schedulerState = null;
}

const chromeFake = {
  runtime: {
    // Scheduler/provider round-trips resolve to a benign, well-formed payload.
    // (Reads that route through the scheduler are answered by the mocked
    // `useOktaApi` facade — see mocks/useOktaApi.mock.ts — not this fake, because
    // Storybook aliases the facade module.)
    sendMessage: (message?: any) => {
      if (message?.action === 'syncSnapshot') return syncSnapshotResponder();
      if (
        schedulerState &&
        (message?.action === 'getSchedulerState' || message?.action === 'getSchedulerMetrics')
      ) {
        return Promise.resolve({ success: true, data: schedulerState });
      }
      return Promise.resolve({ ok: true });
    },
    onMessage: runtimeOnMessage,
    getURL: (path: string) => `chrome-extension://storybook-mock/${path}`,
    lastError: undefined as unknown,
  },
  tabs: {
    // Return one active Okta admin tab so useOktaTabContext resolves to a
    // connected context (instead of the "please open an Okta page" state).
    query: (_q?: any) =>
      Promise.resolve([
        {
          id: 1,
          active: true,
          windowId: 1,
          url: 'https://example.okta.com/admin/getting-started',
        },
      ]),
    getCurrent: () => Promise.resolve({ id: 1 }),
    // `App` calls this when a reader presses Reconnect; without it the click
    // throws rather than reloading. Callback form, matching the call site.
    reload: (_tabId?: number, _opts?: any, cb?: () => void) => (cb ? cb() : undefined),
    // `pinContext` and `useOktaTabContext` reach for this. Both already fall
    // back when it is missing, so this only removes a needless degradation.
    get: (_tabId?: number, cb?: (tab: unknown) => void) => {
      const tab = {
        id: 1,
        active: true,
        windowId: 1,
        url: 'https://example.okta.com/admin/getting-started',
      };
      if (typeof cb === 'function') {
        cb(tab);
        return undefined as any;
      }
      return Promise.resolve(tab);
    },
    sendMessage: (_tabId?: number, message?: any) => Promise.resolve(respondToTabAction(message)),
    onActivated: listenerSlot,
    onUpdated: listenerSlot,
  },
  // useOktaTabContext resolves the active tab via the current window.
  windows: {
    getCurrent: () => Promise.resolve({ id: 1, focused: true, tabs: [] }),
  },
  storage: {
    local: storageArea,
    sync: storageArea,
    // AuditLogViewer live-refreshes on storage changes.
    onChanged: listenerSlot,
  },
};

/** Install the fake onto `globalThis.chrome` (idempotent). */
export function installChromeFake(): void {
  (globalThis as any).chrome = chromeFake;
}
