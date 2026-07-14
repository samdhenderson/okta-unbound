import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGroupContext } from './useGroupContext';
import { useUserContext } from './useUserContext';
import { useOktaPageContext } from './useOktaPageContext';

type SendResponse = { success: boolean; data?: unknown };

/** Wire chrome.* mocks for a single active Okta tab, with a per-action responder. */
function mockOktaTab(responder: (action: string) => SendResponse, tabs?: unknown[]) {
  (chrome as unknown as { windows: unknown }).windows = {
    getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
  };
  chrome.tabs.query = vi
    .fn()
    .mockResolvedValue(
      tabs ?? [{ id: 42, url: 'https://acme.okta.com/admin/groups', active: true }],
    );
  chrome.tabs.sendMessage = vi
    .fn()
    .mockImplementation((_tabId: number, msg: { action: string }) =>
      Promise.resolve(responder(msg.action)),
    ) as unknown as typeof chrome.tabs.sendMessage;
  chrome.tabs.get = vi.fn();
}

const origin = (action: string): SendResponse =>
  action === 'getOktaOrigin'
    ? { success: true, data: 'https://acme.okta.com' }
    : { success: false };

describe('useOktaTabContext (via context hooks)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useGroupContext connects and returns group info on a group page', async () => {
    mockOktaTab((action) => {
      if (action === 'getGroupInfo')
        return { success: true, data: { groupId: '00g1', groupName: 'Engineering' } };
      return origin(action);
    });

    const { result } = renderHook(() => useGroupContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.groupInfo).toEqual({ groupId: '00g1', groupName: 'Engineering' });
    expect(result.current.oktaOrigin).toBe('https://acme.okta.com');
    expect(result.current.targetTabId).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('reports connected-with-null when on Okta admin but not a group page', async () => {
    mockOktaTab(origin); // getGroupInfo → { success: false }

    const { result } = renderHook(() => useGroupContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.groupInfo).toBeNull();
  });

  it('surfaces an error when no Okta tab is open', async () => {
    mockOktaTab(origin, []); // no tabs in the window

    const { result } = renderHook(() => useUserContext());

    await waitFor(() => expect(result.current.connectionStatus).toBe('error'));
    expect(result.current.error).toMatch(/Okta admin page/);
    expect(result.current.userInfo).toBeNull();
  });

  it('useOktaPageContext detects a user page', async () => {
    mockOktaTab((action) => {
      if (action === 'getUserInfo')
        return { success: true, data: { userId: '00u1', userName: 'Jane Doe' } };
      return origin(action);
    });

    const { result } = renderHook(() => useOktaPageContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pageType).toBe('user');
    expect(result.current.userInfo).toEqual({ userId: '00u1', userName: 'Jane Doe' });
    expect(result.current.groupInfo).toBeNull();
    expect(result.current.appInfo).toBeNull();
  });

  it('useOktaPageContext falls back to admin when no entity is detected', async () => {
    mockOktaTab(origin); // all entity probes → { success: false }

    const { result } = renderHook(() => useOktaPageContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pageType).toBe('admin');
    expect(result.current.connectionStatus).toBe('connected');
  });
});
