/**
 * Message-passing security tests for the background service worker
 * (`src/background/index.ts`).
 *
 * These pin the sender-authentication guards:
 *  - foreign senders (`sender.id !== chrome.runtime.id`) are ignored outright;
 *  - scheduler-control and tab-state actions are rejected when they originate
 *    from a tab / content-script context (`sender.tab` set), and only accepted
 *    from an extension page (the side panel, which has no `sender.tab`).
 *
 * Harness notes:
 * - The worker registers its `chrome.runtime.onMessage` listener at IMPORT time,
 *   so the module is (re-)imported after `vi.resetModules()` and the listener is
 *   captured from the addListener mock.
 * - `ApiScheduler` and `TabStateManager` are mocked so we can assert that a
 *   rejected message never reaches them.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ============================================================================
// Module mocks
// ============================================================================

// Shared scheduler instance methods, inspectable from the tests.
const schedulerMethods = {
  pause: vi.fn(),
  resume: vi.fn(),
  clearQueue: vi.fn(),
  getState: vi.fn(() => ({})),
  getMetrics: vi.fn(() => ({})),
  onStateChange: vi.fn(),
  scheduleRequest: vi.fn(async () => ({ success: true, data: {} })),
  declarePlan: vi.fn(() => true),
  refinePlan: vi.fn(),
  completePlan: vi.fn(),
  cancelPlan: vi.fn(() => 0),
};

vi.mock('../shared/scheduler/apiScheduler', () => ({
  // Regular (non-arrow) function so `new ApiScheduler(...)` is constructable; it
  // returns the shared, inspectable methods object as the instance.
  ApiScheduler: vi.fn(function () {
    return schedulerMethods;
  }),
}));

const tabStateMethods = {
  saveTabState: vi.fn(async () => undefined),
  loadTabState: vi.fn(async () => ({})),
  clearTabState: vi.fn(async () => undefined),
  cleanupExpiredStates: vi.fn(async () => undefined),
};

vi.mock('../shared/tabState/tabStateManager', () => ({
  TabStateManager: tabStateMethods,
}));

vi.mock('../shared/storage/auditStore', () => ({
  auditStore: {
    getSettings: vi.fn(async () => ({ retentionDays: 90 })),
    clearOldLogs: vi.fn(async () => undefined),
  },
}));

// ============================================================================
// Harness
// ============================================================================

type Listener = (
  request: { action: string; [key: string]: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => unknown;

const EXTENSION_ID = 'test-extension';

const addListener = vi.fn();

let listener: Listener;

async function loadBackground(): Promise<void> {
  vi.resetModules();
  addListener.mockClear();
  await import('./index');
  expect(addListener).toHaveBeenCalledTimes(1);
  listener = addListener.mock.calls[0][0] as Listener;
}

/** Dispatch a message the way Chrome does; returns the sync return + sendResponse spy. */
function send(
  request: { action: string; [key: string]: unknown },
  sender: chrome.runtime.MessageSender,
): { returned: unknown; sendResponse: Mock } {
  const sendResponse = vi.fn();
  const returned = listener(request, sender, sendResponse);
  return { returned, sendResponse };
}

const SIDE_PANEL: chrome.runtime.MessageSender = {
  id: EXTENSION_ID,
} as chrome.runtime.MessageSender;

const CONTENT_SCRIPT: chrome.runtime.MessageSender = {
  id: EXTENSION_ID,
  tab: { id: 7 } as chrome.tabs.Tab,
} as chrome.runtime.MessageSender;

beforeEach(async () => {
  vi.clearAllMocks();

  globalThis.chrome = {
    runtime: {
      id: EXTENSION_ID,
      onMessage: { addListener, removeListener: vi.fn() },
      sendMessage: vi.fn(() => ({ catch: vi.fn() })),
      onInstalled: { addListener: vi.fn() },
      getManifest: vi.fn(() => ({ version: '0.0.0-test' })),
    },
    action: { onClicked: { addListener: vi.fn() } },
    contextMenus: { create: vi.fn(), onClicked: { addListener: vi.fn() } },
    alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
    // The org snapshot's trigger policy registers a tab listener at module load
    // (ADR-0040); its behaviour is pinned in `snapshotScheduler.test.ts`.
    tabs: { onUpdated: { addListener: vi.fn() }, query: vi.fn(async () => []) },
    storage: { sync: { set: vi.fn() } },
    notifications: { create: vi.fn() },
    sidePanel: { open: vi.fn() },
  } as unknown as typeof chrome;

  await loadBackground();
});

// ============================================================================
// Foreign sender authentication
// ============================================================================

describe('sender authentication', () => {
  it('ignores a message whose sender.id differs from chrome.runtime.id', () => {
    const { returned, sendResponse } = send({ action: 'getSchedulerState' }, {
      id: 'some-other-extension',
    } as chrome.runtime.MessageSender);

    expect(returned).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
    expect(schedulerMethods.getState).not.toHaveBeenCalled();
  });
});

// ============================================================================
// "Not from tabs" guard — scheduler control + tab state
// ============================================================================

describe('rejects tab-originated privileged actions', () => {
  it('rejects a tab-originated pauseScheduler and never pauses the scheduler', () => {
    const { returned, sendResponse } = send({ action: 'pauseScheduler' }, CONTENT_SCRIPT);

    expect(returned).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'pauseScheduler not allowed from tabs',
    });
    expect(schedulerMethods.pause).not.toHaveBeenCalled();
  });

  it('rejects a tab-originated saveTabState and never touches the store', () => {
    const { returned, sendResponse } = send(
      { action: 'saveTabState', tabName: 'home', state: { x: 1 } },
      CONTENT_SCRIPT,
    );

    expect(returned).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'saveTabState not allowed from tabs',
    });
    expect(tabStateMethods.saveTabState).not.toHaveBeenCalled();
  });

  it.each([
    ['resumeScheduler', {}] as const,
    ['clearSchedulerQueue', {}] as const,
    ['loadTabState', { tabName: 'home' }] as const,
    ['clearTabState', { tabName: 'home' }] as const,
  ])('rejects a tab-originated %s', (action, extra) => {
    const { returned, sendResponse } = send({ action, ...extra }, CONTENT_SCRIPT);

    expect(returned).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: `${action} not allowed from tabs`,
    });
  });
});

// ============================================================================
// Legitimate side-panel calls still work
// ============================================================================

describe('tab state cleanup alarm', () => {
  it('creates the hourly tabStateCleanup alarm at startup', () => {
    expect(chrome.alarms.create).toHaveBeenCalledWith('tabStateCleanup', {
      periodInMinutes: 60,
    });
  });

  it('runs TabStateManager.cleanupExpiredStates when the tabStateCleanup alarm fires', async () => {
    const onAlarm = (chrome.alarms.onAlarm.addListener as unknown as Mock).mock
      .calls[0][0] as (alarm: { name: string }) => Promise<void>;

    await onAlarm({ name: 'tabStateCleanup' });

    expect(tabStateMethods.cleanupExpiredStates).toHaveBeenCalledTimes(1);
  });
});

describe('accepts side-panel (no sender.tab) calls', () => {
  it('pauseScheduler from the side panel pauses the scheduler', () => {
    const { returned, sendResponse } = send({ action: 'pauseScheduler' }, SIDE_PANEL);

    expect(returned).toBe(true);
    expect(schedulerMethods.pause).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('saveTabState from the side panel persists via TabStateManager', async () => {
    const { returned, sendResponse } = send(
      { action: 'saveTabState', tabName: 'home', state: { x: 1 } },
      SIDE_PANEL,
    );

    expect(returned).toBe(true);
    expect(tabStateMethods.saveTabState).toHaveBeenCalledTimes(1);
    // Allow the resolved save promise to flush before asserting the response.
    await Promise.resolve();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });
});

// ============================================================================
// scheduleApiRequest's optional `reason` (verbose request audit log)
// ============================================================================

describe('scheduleApiRequest reason validation', () => {
  it('forwards a valid reason through to the scheduler', () => {
    send(
      {
        action: 'scheduleApiRequest',
        endpoint: '/api/v1/groups',
        tabId: 1,
        reason: 'Load groups',
      },
      SIDE_PANEL,
    );

    expect(schedulerMethods.scheduleRequest).toHaveBeenCalledWith(
      '/api/v1/groups',
      'GET',
      undefined,
      1,
      'normal',
      'Load groups',
      undefined,
    );
  });

  it('still succeeds when reason is omitted', () => {
    const { sendResponse } = send(
      { action: 'scheduleApiRequest', endpoint: '/api/v1/groups', tabId: 1 },
      SIDE_PANEL,
    );

    expect(schedulerMethods.scheduleRequest).toHaveBeenCalledWith(
      '/api/v1/groups',
      'GET',
      undefined,
      1,
      'normal',
      undefined,
      undefined,
    );
    expect(sendResponse).not.toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid scheduleApiRequest message' }),
    );
  });

  it('rejects a reason longer than the 80-char cap and never schedules', () => {
    const { sendResponse } = send(
      {
        action: 'scheduleApiRequest',
        endpoint: '/api/v1/groups',
        tabId: 1,
        reason: 'x'.repeat(81),
      },
      SIDE_PANEL,
    );

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid scheduleApiRequest message',
    });
    expect(schedulerMethods.scheduleRequest).not.toHaveBeenCalled();
  });

  it('rejects a non-string reason and never schedules', () => {
    const { sendResponse } = send(
      { action: 'scheduleApiRequest', endpoint: '/api/v1/groups', tabId: 1, reason: 12345 },
      SIDE_PANEL,
    );

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid scheduleApiRequest message',
    });
    expect(schedulerMethods.scheduleRequest).not.toHaveBeenCalled();
  });
});

// ============================================================================
// updateOperationPlan (the declared-request ledger)
// ============================================================================

describe('updateOperationPlan', () => {
  const declare = (overrides: Record<string, unknown> = {}) => ({
    action: 'updateOperationPlan',
    op: 'declare',
    planId: 'plan-1',
    name: 'Export all users',
    tabId: 1,
    legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: 8 } }],
    ...overrides,
  });

  it('forwards a valid declaration to the scheduler', () => {
    const { sendResponse } = send(declare(), SIDE_PANEL);

    expect(schedulerMethods.declarePlan).toHaveBeenCalledWith({
      id: 'plan-1',
      name: 'Export all users',
      tabId: 1,
      legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: 8 } }],
    });
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('rejects a tab-originated plan update and never touches the scheduler', () => {
    // Same posture as scheduleApiRequest: a content script must never be able to
    // author what the side panel's own activity bar reports.
    const { sendResponse } = send(declare(), CONTENT_SCRIPT);

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'updateOperationPlan not allowed from tabs',
    });
    expect(schedulerMethods.declarePlan).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown op', { op: 'obliterate' }],
    ['a missing planId', { planId: undefined }],
    ['an over-long planId', { planId: 'x'.repeat(65) }],
    ['an over-long name', { name: 'x'.repeat(81) }],
    ['an empty name', { name: '' }],
    ['a non-integer tabId', { tabId: 1.5 }],
    ['no legs at all', { legs: [] }],
    [
      'more legs than the cap',
      {
        legs: Array.from({ length: 17 }, () => ({
          endpoint: '/api/v1/users',
          estimate: { kind: 'exact', requests: 1 },
        })),
      },
    ],
    [
      'an absolute leg endpoint',
      {
        legs: [{ endpoint: 'https://evil.example/api', estimate: { kind: 'unknown' } }],
      },
    ],
    [
      'a protocol-relative leg endpoint',
      {
        legs: [{ endpoint: '//evil.example/api', estimate: { kind: 'unknown' } }],
      },
    ],
    [
      'a disallowed leg method',
      {
        legs: [{ endpoint: '/api/v1/users', method: 'TRACE', estimate: { kind: 'unknown' } }],
      },
    ],
    [
      'an unknown estimate kind',
      {
        legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'roughly', requests: 3 } }],
      },
    ],
    [
      'a negative request count',
      {
        legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: -1 } }],
      },
    ],
    [
      'a non-numeric request count',
      {
        legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: 'lots' } }],
      },
    ],
  ])('rejects %s and never declares', (_label, overrides) => {
    const { sendResponse } = send(declare(overrides), SIDE_PANEL);

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid updateOperationPlan message',
    });
    expect(schedulerMethods.declarePlan).not.toHaveBeenCalled();
  });

  it('forwards a refinement', () => {
    send(
      {
        action: 'updateOperationPlan',
        op: 'refine',
        planId: 'plan-1',
        endpoint: '/api/v1/users?after=cursor',
        estimate: { kind: 'atLeast', requests: 12 },
      },
      SIDE_PANEL,
    );

    expect(schedulerMethods.refinePlan).toHaveBeenCalledWith(
      'plan-1',
      '/api/v1/users?after=cursor',
      { kind: 'atLeast', requests: 12 },
    );
  });

  it('rejects a refinement with an absolute endpoint', () => {
    const { sendResponse } = send(
      {
        action: 'updateOperationPlan',
        op: 'refine',
        planId: 'plan-1',
        endpoint: 'https://evil.example/api',
        estimate: { kind: 'atLeast', requests: 12 },
      },
      SIDE_PANEL,
    );

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid updateOperationPlan message',
    });
    expect(schedulerMethods.refinePlan).not.toHaveBeenCalled();
  });

  it('forwards a completion, which needs nothing but a plan id', () => {
    const { sendResponse } = send(
      { action: 'updateOperationPlan', op: 'complete', planId: 'plan-1' },
      SIDE_PANEL,
    );

    expect(schedulerMethods.completePlan).toHaveBeenCalledWith('plan-1');
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('reports how many queued requests a cancel dropped', () => {
    schedulerMethods.cancelPlan.mockReturnValueOnce(4);

    const { sendResponse } = send(
      { action: 'updateOperationPlan', op: 'cancel', planId: 'plan-1' },
      SIDE_PANEL,
    );

    expect(schedulerMethods.cancelPlan).toHaveBeenCalledWith('plan-1');
    expect(sendResponse).toHaveBeenCalledWith({ success: true, dropped: 4 });
  });
});

// ============================================================================
// scheduleApiRequest's optional planId
// ============================================================================

describe('scheduleApiRequest planId', () => {
  it('forwards a planId through to the scheduler', () => {
    send(
      {
        action: 'scheduleApiRequest',
        endpoint: '/api/v1/users',
        tabId: 1,
        reason: 'Export all users',
        planId: 'plan-1',
      },
      SIDE_PANEL,
    );

    expect(schedulerMethods.scheduleRequest).toHaveBeenCalledWith(
      '/api/v1/users',
      'GET',
      undefined,
      1,
      'normal',
      'Export all users',
      'plan-1',
    );
  });

  it('drops a non-string planId rather than failing the request', () => {
    // The ledger is advisory: a malformed planId must degrade to an unattributed
    // request, never to a request that does not happen.
    send(
      { action: 'scheduleApiRequest', endpoint: '/api/v1/users', tabId: 1, planId: 42 },
      SIDE_PANEL,
    );

    expect(schedulerMethods.scheduleRequest).toHaveBeenCalledWith(
      '/api/v1/users',
      'GET',
      undefined,
      1,
      'normal',
      undefined,
      undefined,
    );
  });
});
