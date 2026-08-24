/**
 * @module sidepanel/hooks/useAddGroupMember
 * @description Add-member modal state machine for the Group Detail view's Members section.
 *
 * The group-side mirror of {@link useAddToGroup}: here the group is the fixed side
 * and the user is the variable side being searched for, rather than the other way
 * around. Owns the modal's open state, the chosen user, and the add-in-flight flag,
 * layered on top of the existing, already-working search mechanism
 * ({@link useDebouncedUserSearch}, filtered to exclude the group's current roster) —
 * that mechanism is reused as-is, not reimplemented. On a successful add it clears
 * the search and calls `onAdded` so the caller can fold the new member into its
 * roster; failures surface through `onResult` as a `danger` result message. The
 * caller owns the result banner and the roster itself.
 *
 * {@link UseAddGroupMemberReturn.addMemberDirect} runs the same mutation as
 * `confirmAddMember` for an explicit user with no modal/selection state involved,
 * so {@link sidepanel/components/groups/detail/useGroupMembersSection.useGroupMembersSection}'s
 * inline add-on-select flow can compose this hook for the mutation instead of
 * duplicating the Okta write — the write and the search filtering each live in
 * exactly one place, shared by both the modal flow here and the inline flow there.
 */

import { useCallback, useMemo, useState } from 'react';
import type { GroupSummary, OktaUser } from '../../shared/types';
import { useOktaApi } from './useOktaApi';
import { useDebouncedUserSearch } from './useDebouncedUserSearch';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useAddGroupMember');

/** Options for {@link useAddGroupMember}. */
export interface UseAddGroupMemberOptions {
  /** Tab whose scheduler runs the user search + membership add. */
  targetTabId: number | null;
  /** The fixed group members are added to. */
  group: GroupSummary;
  /**
   * The group's current roster, used to exclude existing members from search
   * results. `null` before the roster has loaded — search still runs, just
   * without an exclusion set yet.
   */
  members: OktaUser[] | null;
  /** Reports an add failure as a `danger` result message. */
  onResult: (result: { text: string; type: 'danger' }) => void;
  /** Called with the added user after a successful add, so the caller can fold them into its roster. */
  onAdded: (user: OktaUser) => Promise<void> | void;
  /**
   * Whether the owning view is the visible one. The debounced search is
   * suspended rather than re-running a standing query while hidden. Defaults
   * to `true`.
   */
  enabled?: boolean;
}

/** Return shape of {@link useAddGroupMember}. */
export interface UseAddGroupMemberReturn {
  isOpen: boolean;
  addQuery: string;
  setAddQuery: (query: string) => void;
  /** Debounced search results with the group's current members already excluded. */
  addResults: OktaUser[];
  isSearchingToAdd: boolean;
  addSearchError: string | null;
  /** The chosen user, or `null` when none is selected yet. */
  selectedUser: OktaUser | null;
  /** Choose a user from the dropdown: selects it, clears the query. */
  selectUser: (user: OktaUser) => void;
  /** Clear the chosen user and query (the selected-user "Clear" button). */
  clearSelectedUser: () => void;
  isAddingMember: boolean;
  openModal: () => void;
  closeModal: () => void;
  /** Add the currently selected user; no-ops with no selection. */
  confirmAddMember: () => Promise<void>;
  /**
   * Runs the same add mutation as `confirmAddMember` for an explicit user, with
   * no modal or selection state involved — see the module doc.
   */
  addMemberDirect: (user: OktaUser) => Promise<void>;
}

/**
 * Hook backing the Group Detail view's Add-member modal.
 *
 * @param options - See {@link UseAddGroupMemberOptions}.
 * @returns The modal's open state, the debounced user type-ahead state and
 *   selection controls, `isAddingMember`, and `openModal` / `closeModal` /
 *   `confirmAddMember` / `addMemberDirect`.
 */
export function useAddGroupMember({
  targetTabId,
  group,
  members,
  onResult,
  onAdded,
  enabled = true,
}: UseAddGroupMemberOptions): UseAddGroupMemberReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OktaUser | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const { addUserToGroup } = useOktaApi({ targetTabId });

  const [addSearchError, setAddSearchError] = useState<string | null>(null);
  const {
    searchQuery: addQuery,
    setSearchQuery: setAddQuery,
    searchResults,
    setSearchResults,
    isSearching: isSearchingToAdd,
  } = useDebouncedUserSearch({
    targetTabId: targetTabId ?? undefined,
    onError: setAddSearchError,
    debounceMs: 400,
    minQueryLength: 2,
    log,
    enabled,
  });

  // A member already in the group is never a valid "add" result.
  const memberIds = useMemo(() => new Set((members ?? []).map((m) => m.id)), [members]);
  const addResults = useMemo(
    () => searchResults.filter((u) => !memberIds.has(u.id)),
    [searchResults, memberIds],
  );

  const addMemberDirect = useCallback(
    async (user: OktaUser) => {
      setIsAddingMember(true);
      try {
        const result = await addUserToGroup(group.id, group.name, user);
        if (!result.success) {
          onResult({ text: result.error || 'Failed to add member.', type: 'danger' });
          return;
        }
        setAddQuery('');
        setSearchResults([]);
        await onAdded(user);
      } catch (err: unknown) {
        log.error('Failed to add member:', err);
        const message = err instanceof Error ? err.message : 'Failed to add member.';
        onResult({ text: message, type: 'danger' });
      } finally {
        setIsAddingMember(false);
      }
    },
    [addUserToGroup, group.id, group.name, onAdded, onResult, setAddQuery, setSearchResults],
  );

  const openModal = useCallback(() => {
    setAddQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setIsOpen(true);
  }, [setAddQuery, setSearchResults]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setAddQuery('');
    setSearchResults([]);
    setSelectedUser(null);
  }, [setAddQuery, setSearchResults]);

  const selectUser = useCallback(
    (user: OktaUser) => {
      setSelectedUser(user);
      setAddQuery('');
      setSearchResults([]);
    },
    [setAddQuery, setSearchResults],
  );

  const clearSelectedUser = useCallback(() => {
    setSelectedUser(null);
    setAddQuery('');
  }, [setAddQuery]);

  const confirmAddMember = useCallback(async () => {
    if (!selectedUser) return;
    await addMemberDirect(selectedUser);
    closeModal();
  }, [selectedUser, addMemberDirect, closeModal]);

  return {
    isOpen,
    addQuery,
    setAddQuery,
    addResults,
    isSearchingToAdd,
    addSearchError,
    selectedUser,
    selectUser,
    clearSelectedUser,
    isAddingMember,
    openModal,
    closeModal,
    confirmAddMember,
    addMemberDirect,
  };
}
