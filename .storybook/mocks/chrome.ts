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
      return { success: true, data: null };

    default:
      return { ok: true };
  }
}

const chromeFake = {
  runtime: {
    // Scheduler/provider round-trips resolve to a benign, well-formed payload.
    sendMessage: (_message?: any) => Promise.resolve({ ok: true }),
    onMessage: listenerSlot,
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
