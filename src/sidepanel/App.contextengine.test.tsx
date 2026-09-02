/**
 * App-level tests for the single context engine (ADR-0058, `D-062`).
 *
 * `App` used to run two independent `useOktaTabContext` instances — a
 * group-specific one feeding every tab's `targetTabId`/`oktaOrigin`, and a
 * page-classifying one feeding the `ContextBar` masthead. Each registered its own
 * `chrome.tabs.onUpdated` listener and sent its own `getOktaOrigin` plus its own
 * entity probes on every navigation.
 *
 * These cases pin the two things that merge is: **one** listener and **one**
 * origin resolution per navigation (the traffic win), and a pin that no longer
 * works by suspending detection (the correctness one — the surviving engine also
 * carries the connection health a pinned masthead has to keep reporting honestly).
 *
 * Message passing is chrome-based, so MSW does not apply; the chrome surface is
 * mocked the way `App.tabpersistence.test.tsx` does, and `idb` is faked because
 * jsdom has no IndexedDB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { ProgressProvider } from './contexts/ProgressContext';

const ORIGIN = 'https://example.okta.com';

// An empty snapshot: these cases are about the context engine, so every
// collection read the shell makes at boot answers with nothing.
const { fakeDB } = vi.hoisted(() => ({
  fakeDB: {
    get: async () => undefined,
    put: async () => undefined,
    delete: async () => undefined,
    getAllFromIndex: async () => [],
    getAllKeysFromIndex: async () => [],
    transaction: () => ({
      store: { put: async () => undefined, delete: async () => undefined },
      done: Promise.resolve(),
    }),
  },
}));

vi.mock('idb', () => ({ openDB: vi.fn(async () => fakeDB) }));

const ENGINEERING = { groupId: '00g1', groupName: 'Engineering' };
const FINANCE = { groupId: '00g2', groupName: 'Finance' };

const OKTA_TAB = { id: 1, active: true, url: `${ORIGIN}/admin/group/00g1`, windowId: 1 };

const tabsSendMessage = vi.fn();
const runtimeSendMessage = vi.fn();

/** Answer the content-script probes as if the tab were on `group`'s page. */
function onGroupPage(group: { groupId: string; groupName: string }) {
  tabsSendMessage.mockImplementation(async (_tabId: number, msg: { action: string }) => {
    if (msg.action === 'getOktaOrigin') return { success: true, data: ORIGIN };
    if (msg.action === 'getGroupInfo') return { success: true, data: group };
    return { success: false };
  });
}

/** Every `getOktaOrigin` the panel has sent so far — one per probe cycle, per engine. */
const originCalls = () =>
  tabsSendMessage.mock.calls.filter(([, msg]) => msg?.action === 'getOktaOrigin').length;

/** The `chrome.tabs.onUpdated` listeners the panel registered. */
const updateListeners = () =>
  (chrome.tabs.onUpdated.addListener as ReturnType<typeof vi.fn>).mock.calls;

/** Drive a real navigation of the live Okta tab at every registered listener. */
function navigateTo(url: string) {
  const tab = { ...OKTA_TAB, url };
  (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([tab]);
  for (const [listener] of updateListeners()) {
    (listener as (id: number, c: { url?: string }, t: unknown) => void)(1, { url }, tab);
  }
}

beforeEach(() => {
  vi.clearAllMocks();

  globalThis.chrome = {
    runtime: {
      sendMessage: runtimeSendMessage,
      getURL: (p: string) => p,
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      lastError: undefined,
    },
    tabs: {
      query: vi.fn(async () => [OKTA_TAB]),
      get: vi.fn(),
      reload: vi.fn(),
      sendMessage: tabsSendMessage,
      onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    windows: { getCurrent: vi.fn(async () => ({ id: 1 })) },
    storage: {
      // No callback is ever invoked, so nothing is restored from storage — these
      // cases are about live detection, not persistence.
      local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
      sync: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  } as unknown as typeof chrome;

  onGroupPage(ENGINEERING);
  runtimeSendMessage.mockImplementation(async () => ({ success: true, data: [] }));
});

const renderApp = () =>
  render(
    <ProgressProvider>
      <App />
    </ProgressProvider>,
  );

describe('App context engine', () => {
  it('probes the live tab once per navigation, from one listener', async () => {
    renderApp();

    // The masthead naming the group is the proof the probe landed and reached the
    // ContextBar — the same detection the feature tabs' target tab comes from.
    expect(await screen.findByText('Engineering')).toBeInTheDocument();

    // Two engines meant two listeners and two `getOktaOrigin` round trips for this
    // one boot; one engine means one of each.
    expect(updateListeners()).toHaveLength(1);
    expect(originCalls()).toBe(1);

    const before = originCalls();
    navigateTo(`${ORIGIN}/admin/group/00g2`);
    onGroupPage(FINANCE);

    await waitFor(() => expect(screen.getByText('Finance')).toBeInTheDocument());
    expect(originCalls()).toBe(before + 1);
  });

  it('keeps detecting while pinned, and names where the live tab went', async () => {
    // The pin used to be `enabled: false` on the masthead's engine, which was only
    // safe while a *second* engine kept probing for the connection dot. With one
    // engine the pin is a selection in `App`: identity freezes, detection does not.
    const uev = userEvent.setup();
    renderApp();
    expect(await screen.findByText('Engineering')).toBeInTheDocument();

    await uev.click(screen.getByRole('button', { name: 'Pin' }));
    expect(screen.getByRole('button', { name: 'Pinned' })).toBeInTheDocument();

    const before = originCalls();
    navigateTo(`${ORIGIN}/admin/group/00g2`);
    onGroupPage(FINANCE);

    // Still probing: the connection health behind a pinned masthead stays live.
    await waitFor(() => expect(originCalls()).toBeGreaterThan(before));

    // Identity is still the pinned entity, and the hint can now say what the live
    // tab moved *to* — unknowable while the pinned engine was suspended.
    await screen.findByText('Finance', { selector: 'strong' });
    expect(screen.getByText(/Live tab moved to/)).toBeInTheDocument();
    // …while the masthead's own identity is still the frozen one.
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('raises no live-changed hint while the live tab is still on the pinned entity', async () => {
    const uev = userEvent.setup();
    renderApp();
    expect(await screen.findByText('Engineering')).toBeInTheDocument();

    await uev.click(screen.getByRole('button', { name: 'Pin' }));

    // A document reload of the same page re-probes, and must land on the same
    // entity — a hint here would be the false positive the old owed-resync flag
    // could produce.
    navigateTo(`${ORIGIN}/admin/group/00g1`);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(screen.queryByText(/Live tab moved to/)).not.toBeInTheDocument();
    expect(screen.queryByText(/The live Okta tab has changed/)).not.toBeInTheDocument();
  });
});
