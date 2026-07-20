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
      { action: 'saveTabState', tabName: 'overview', state: { x: 1 } },
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
    ['loadTabState', { tabName: 'overview' }] as const,
    ['clearTabState', { tabName: 'overview' }] as const,
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

describe('accepts side-panel (no sender.tab) calls', () => {
  it('pauseScheduler from the side panel pauses the scheduler', () => {
    const { returned, sendResponse } = send({ action: 'pauseScheduler' }, SIDE_PANEL);

    expect(returned).toBe(true);
    expect(schedulerMethods.pause).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('saveTabState from the side panel persists via TabStateManager', async () => {
    const { returned, sendResponse } = send(
      { action: 'saveTabState', tabName: 'overview', state: { x: 1 } },
      SIDE_PANEL,
    );

    expect(returned).toBe(true);
    expect(tabStateMethods.saveTabState).toHaveBeenCalledTimes(1);
    // Allow the resolved save promise to flush before asserting the response.
    await Promise.resolve();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });
});
