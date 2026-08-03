/**
 * @module sidepanel/pinContext.test
 * @description Unit tests for the pin-aware tab-context resolver.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  deriveTabContext,
  revalidatePinnedContext,
  type PinnedContext,
  type LiveTabContext,
} from './pinContext';

const live: LiveTabContext = {
  targetTabId: 7,
  groupInfo: { groupId: '00gLIVE', groupName: 'Live Group' },
  oktaOrigin: 'https://live.okta.com',
};

describe('deriveTabContext', () => {
  it('follows the live context when nothing is pinned', () => {
    expect(deriveTabContext(null, live)).toEqual({
      targetTabId: 7,
      currentGroupId: '00gLIVE',
      oktaOrigin: 'https://live.okta.com',
    });
  });

  it('follows a pinned group snapshot instead of the live tab', () => {
    const pinned: PinnedContext = {
      pageType: 'group',
      groupInfo: { groupId: '00gPINNED', groupName: 'Pinned Group' },
      userInfo: null,
      targetTabId: 3,
      oktaOrigin: 'https://pinned.okta.com',
    };
    expect(deriveTabContext(pinned, live)).toEqual({
      targetTabId: 3,
      currentGroupId: '00gPINNED',
      oktaOrigin: 'https://pinned.okta.com',
    });
  });

  it('yields no current group for a pinned user (only the tab + origin carry over)', () => {
    const pinned: PinnedContext = {
      pageType: 'user',
      groupInfo: null,
      userInfo: { userId: '00uPINNED', userName: 'Pat' },
      targetTabId: 4,
      oktaOrigin: 'https://pinned.okta.com',
    };
    expect(deriveTabContext(pinned, live)).toEqual({
      targetTabId: 4,
      currentGroupId: undefined,
      oktaOrigin: 'https://pinned.okta.com',
    });
  });

  it('passes through a null live tab id when unpinned and disconnected', () => {
    expect(
      deriveTabContext(null, { targetTabId: null, groupInfo: null, oktaOrigin: null }),
    ).toEqual({ targetTabId: null, currentGroupId: undefined, oktaOrigin: null });
  });
});

/** A persisted pin snapshot targeting tab 3. */
const savedPin: PinnedContext = {
  pageType: 'group',
  groupInfo: { groupId: '00gPINNED', groupName: 'Pinned Group' },
  userInfo: null,
  targetTabId: 3,
  oktaOrigin: 'https://acme.okta.com',
};

/**
 * Wire the chrome tab mocks: how `tabs.get(savedTabId)` resolves (or rejects, for a
 * closed tab) and which tabs the current window reports.
 */
function mockTabs(
  savedTab: { url?: string } | 'gone',
  windowTabs: Array<{ id?: number; url?: string; active?: boolean }> = [],
) {
  (chrome as unknown as { windows: unknown }).windows = {
    getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
  };
  chrome.tabs.get = vi
    .fn()
    .mockImplementation(() =>
      savedTab === 'gone'
        ? Promise.reject(new Error('No tab with id: 3.'))
        : Promise.resolve(savedTab),
    ) as unknown as typeof chrome.tabs.get;
  chrome.tabs.query = vi.fn().mockResolvedValue(windowTabs) as unknown as typeof chrome.tabs.query;
}

describe('revalidatePinnedContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the snapshot when the pinned tab is alive and still on Okta', async () => {
    mockTabs({ url: 'https://acme.okta.com/admin/group/00gPINNED' });

    await expect(revalidatePinnedContext(savedPin)).resolves.toBe(savedPin);
    expect(chrome.tabs.query).not.toHaveBeenCalled();
  });

  it('re-targets a dead tab at the active Okta tab in the current window', async () => {
    mockTabs('gone', [
      { id: 9, url: 'https://example.com/', active: false },
      { id: 11, url: 'https://acme.okta.com/admin/groups', active: false },
      { id: 12, url: 'https://acme.okta.com/admin/users', active: true },
    ]);

    await expect(revalidatePinnedContext(savedPin)).resolves.toEqual({
      ...savedPin,
      targetTabId: 12,
    });
  });

  it('falls back to the first Okta tab when none in the window is active', async () => {
    mockTabs('gone', [
      { id: 11, url: 'https://acme.okta.com/admin/groups', active: false },
      { id: 12, url: 'https://acme.okta.com/admin/users', active: false },
    ]);

    await expect(revalidatePinnedContext(savedPin)).resolves.toEqual({
      ...savedPin,
      targetTabId: 11,
    });
  });

  it('returns null when the pinned tab is dead and no Okta tab is open', async () => {
    mockTabs('gone', [{ id: 9, url: 'https://example.com/', active: true }]);

    await expect(revalidatePinnedContext(savedPin)).resolves.toBeNull();
  });

  it('re-targets when the pinned tab still exists but navigated off Okta', async () => {
    mockTabs({ url: 'https://example.com/some-page' }, [
      { id: 21, url: 'https://acme.okta.com/admin/groups', active: true },
    ]);

    await expect(revalidatePinnedContext(savedPin)).resolves.toEqual({
      ...savedPin,
      targetTabId: 21,
    });
  });
});
