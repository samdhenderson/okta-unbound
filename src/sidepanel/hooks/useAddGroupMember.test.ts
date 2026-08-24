/**
 * `useAddGroupMember` — the group-side Add-member modal state machine.
 *
 * Mocked at the `useOktaApi` facade (docs/testing.md) for the mutation, and at
 * `useDebouncedUserSearch` for the type-ahead — that hook's own debounce/min-length
 * behavior is already the shared, working mechanism this hook explicitly reuses
 * rather than reimplements, so these tests pin only what `useAddGroupMember` adds
 * on top: the modal's open/select/confirm state machine, the member-exclusion
 * filter, and the `addMemberDirect` escape hatch composed by `useGroupMembersSection`.
 *
 * Fixtures use fake placeholders (`00gFAKE…`, `00uFAKE…`, `example.com`) only.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { GroupSummary, OktaUser } from '../../shared/types';

const api = vi.hoisted(() => ({
  addUserToGroup: vi.fn(),
}));

vi.mock('./useOktaApi', () => ({
  useOktaApi: () => api,
}));

const debounced = vi.hoisted(() => ({
  searchQuery: '',
  setSearchQuery: vi.fn(),
  searchResults: [] as OktaUser[],
  setSearchResults: vi.fn(),
  isSearching: false,
}));

vi.mock('./useDebouncedUserSearch', () => ({
  useDebouncedUserSearch: () => debounced,
}));

import { useAddGroupMember } from './useAddGroupMember';

const group: GroupSummary = {
  id: '00gFAKEGROUP',
  name: 'Fake Engineering',
  type: 'OKTA_GROUP',
  memberCount: 1,
  hasRules: false,
  ruleCount: 0,
};

function makeUser(id: string, firstName: string, lastName: string): OktaUser {
  return {
    id,
    status: 'ACTIVE',
    profile: {
      login: `${firstName.toLowerCase()}@example.com`,
      email: `${firstName.toLowerCase()}@example.com`,
      firstName,
      lastName,
    },
  };
}

const existingMember = makeUser('00uFAKE1', 'Ada', 'Lovelace');
const candidate = makeUser('00uFAKE2', 'Grace', 'Hopper');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  debounced.searchResults = [];
  debounced.searchQuery = '';
  debounced.isSearching = false;
});

describe('useAddGroupMember', () => {
  it('excludes the group’s current members from the search results', () => {
    debounced.searchResults = [existingMember, candidate];
    const { result } = renderHook(() =>
      useAddGroupMember({
        targetTabId: 1,
        group,
        members: [existingMember],
        onResult: vi.fn(),
        onAdded: vi.fn(),
      }),
    );

    expect(result.current.addResults).toEqual([candidate]);
  });

  it('opens closed and resets the selection', () => {
    const { result } = renderHook(() =>
      useAddGroupMember({
        targetTabId: 1,
        group,
        members: [],
        onResult: vi.fn(),
        onAdded: vi.fn(),
      }),
    );

    act(() => result.current.selectUser(candidate));
    expect(result.current.selectedUser).toEqual(candidate);

    act(() => result.current.openModal());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.selectedUser).toBeNull();

    act(() => result.current.closeModal());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.selectedUser).toBeNull();
  });

  it('selectUser sets the selection; clearSelectedUser clears it', () => {
    const { result } = renderHook(() =>
      useAddGroupMember({
        targetTabId: 1,
        group,
        members: [],
        onResult: vi.fn(),
        onAdded: vi.fn(),
      }),
    );

    act(() => result.current.selectUser(candidate));
    expect(result.current.selectedUser).toEqual(candidate);

    act(() => result.current.clearSelectedUser());
    expect(result.current.selectedUser).toBeNull();
  });

  it('confirmAddMember no-ops with no selection', async () => {
    const { result } = renderHook(() =>
      useAddGroupMember({
        targetTabId: 1,
        group,
        members: [],
        onResult: vi.fn(),
        onAdded: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.confirmAddMember();
    });
    expect(api.addUserToGroup).not.toHaveBeenCalled();
  });

  it('confirmAddMember adds the selected user, reports it via onAdded, and closes the modal', async () => {
    api.addUserToGroup.mockResolvedValue({ success: true });
    const onAdded = vi.fn();
    const onResult = vi.fn();
    const { result } = renderHook(() =>
      useAddGroupMember({
        targetTabId: 1,
        group,
        members: [existingMember],
        onResult,
        onAdded,
      }),
    );

    act(() => {
      result.current.openModal();
      result.current.selectUser(candidate);
    });

    await act(async () => {
      await result.current.confirmAddMember();
    });

    expect(api.addUserToGroup).toHaveBeenCalledWith(group.id, group.name, candidate);
    expect(onAdded).toHaveBeenCalledWith(candidate);
    expect(onResult).not.toHaveBeenCalled();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.selectedUser).toBeNull();
  });

  it('confirmAddMember reports a failed add as a danger result and still closes the modal', async () => {
    api.addUserToGroup.mockResolvedValue({ success: false, error: 'Add failed.' });
    const onAdded = vi.fn();
    const onResult = vi.fn();
    const { result } = renderHook(() =>
      useAddGroupMember({
        targetTabId: 1,
        group,
        members: [],
        onResult,
        onAdded,
      }),
    );

    act(() => {
      result.current.openModal();
      result.current.selectUser(candidate);
    });

    await act(async () => {
      await result.current.confirmAddMember();
    });

    expect(onResult).toHaveBeenCalledWith({ text: 'Add failed.', type: 'danger' });
    expect(onAdded).not.toHaveBeenCalled();
    expect(result.current.isOpen).toBe(false);
  });

  it('addMemberDirect adds a user with no selection/modal state involved', async () => {
    api.addUserToGroup.mockResolvedValue({ success: true });
    const onAdded = vi.fn();
    const { result } = renderHook(() =>
      useAddGroupMember({
        targetTabId: 1,
        group,
        members: [],
        onResult: vi.fn(),
        onAdded,
      }),
    );

    await act(async () => {
      await result.current.addMemberDirect(candidate);
    });

    expect(api.addUserToGroup).toHaveBeenCalledWith(group.id, group.name, candidate);
    expect(onAdded).toHaveBeenCalledWith(candidate);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.selectedUser).toBeNull();
  });

  it('surfaces a thrown error from the add request as a danger result', async () => {
    api.addUserToGroup.mockRejectedValue(new Error('Network down'));
    const onResult = vi.fn();
    const { result } = renderHook(() =>
      useAddGroupMember({
        targetTabId: 1,
        group,
        members: [],
        onResult,
        onAdded: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.addMemberDirect(candidate);
    });

    expect(onResult).toHaveBeenCalledWith({ text: 'Network down', type: 'danger' });
  });
});
