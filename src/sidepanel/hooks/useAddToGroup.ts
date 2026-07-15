/**
 * @module sidepanel/hooks/useAddToGroup
 * @description Add-to-Group modal state machine for the Users tab.
 *
 * Owns the modal's open state, a 300ms-debounced group type-ahead (via `useOktaApi`
 * → the rate-limited scheduler), the chosen group, and the add-in-flight flag. On a
 * successful add it closes the modal and asks the caller to refresh memberships so
 * the new group appears immediately; failures surface as a `danger` result message.
 * The caller owns the selected user and the result banner.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { OktaUser } from '../../shared/types';
import { useOktaApi } from './useOktaApi';

/** Shape returned by `searchGroups` in `groupDiscovery.ts` for the Add-to-Group flow. */
export interface GroupSearchResult {
  id: string;
  name: string;
  description: string;
  type: string;
}

/** Options for {@link useAddToGroup}. */
interface UseAddToGroupOptions {
  /** Tab whose scheduler runs the group search + membership add. */
  targetTabId: number | undefined;
  /** The user being added to a group; confirm no-ops when null. */
  selectedUser: OktaUser | null;
  /** Reports an add failure as a `danger` result message. */
  onResult: (result: { text: string; type: 'danger' }) => void;
  /** Called with the user after a successful add so the caller can reload memberships. */
  onAdded: (user: OktaUser) => Promise<void> | void;
}

/** Return shape of {@link useAddToGroup}. */
interface UseAddToGroupReturn {
  isOpen: boolean;
  groupSearchQuery: string;
  setGroupSearchQuery: (query: string) => void;
  groupSearchResults: GroupSearchResult[];
  isSearchingGroups: boolean;
  showGroupDropdown: boolean;
  selectedGroup: GroupSearchResult | null;
  /** Choose a group from the dropdown: selects it, hides the dropdown, clears the query. */
  selectGroup: (group: GroupSearchResult) => void;
  /** Clear the chosen group and query (the selected-group "Clear" button). */
  clearSelectedGroup: () => void;
  isAddingToGroup: boolean;
  openModal: () => void;
  closeModal: () => void;
  confirmAddToGroup: () => Promise<void>;
}

/**
 * Hook backing the Users tab's Add-to-Group modal.
 *
 * @param options - See {@link UseAddToGroupOptions}.
 * @returns The modal's open state, the debounced group type-ahead state and
 *   selection controls, `isAddingToGroup`, and `openModal` / `closeModal` /
 *   `confirmAddToGroup`.
 */
export function useAddToGroup({
  targetTabId,
  selectedUser,
  onResult,
  onAdded,
}: UseAddToGroupOptions): UseAddToGroupReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<GroupSearchResult[]>([]);
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupSearchResult | null>(null);
  const [isAddingToGroup, setIsAddingToGroup] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const groupDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { searchGroups, addUserToGroup } = useOktaApi({
    targetTabId: targetTabId ?? null,
  });

  // Debounced group search for the Add to Group modal
  useEffect(() => {
    if (groupDebounceTimerRef.current) {
      clearTimeout(groupDebounceTimerRef.current);
    }

    if (groupSearchQuery.trim().length < 2) {
      setGroupSearchResults([]);
      setShowGroupDropdown(false);
      return;
    }

    groupDebounceTimerRef.current = setTimeout(async () => {
      setIsSearchingGroups(true);
      try {
        const results = await searchGroups(groupSearchQuery.trim());
        setGroupSearchResults(results);
        setShowGroupDropdown(results.length > 0);
      } catch {
        setGroupSearchResults([]);
        setShowGroupDropdown(false);
      } finally {
        setIsSearchingGroups(false);
      }
    }, 300);

    return () => {
      if (groupDebounceTimerRef.current) {
        clearTimeout(groupDebounceTimerRef.current);
      }
    };
  }, [groupSearchQuery, searchGroups]);

  const openModal = useCallback(() => {
    setGroupSearchQuery('');
    setGroupSearchResults([]);
    setSelectedGroup(null);
    setShowGroupDropdown(false);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setGroupSearchQuery('');
    setGroupSearchResults([]);
    setSelectedGroup(null);
    setShowGroupDropdown(false);
  }, []);

  const selectGroup = useCallback((group: GroupSearchResult) => {
    setSelectedGroup(group);
    setShowGroupDropdown(false);
    setGroupSearchQuery('');
  }, []);

  const clearSelectedGroup = useCallback(() => {
    setSelectedGroup(null);
    setGroupSearchQuery('');
  }, []);

  const confirmAddToGroup = useCallback(async () => {
    if (!selectedUser || !selectedGroup) return;

    setIsAddingToGroup(true);
    try {
      const result = await addUserToGroup(selectedGroup.id, selectedGroup.name, {
        id: selectedUser.id,
        profile: {
          login: selectedUser.profile.login,
          firstName: selectedUser.profile.firstName,
          lastName: selectedUser.profile.lastName,
          email: selectedUser.profile.email,
        },
      });

      if (result.success) {
        closeModal();
        // Refresh memberships so the new group appears immediately
        await onAdded(selectedUser);
      } else {
        onResult({
          text: result.error || 'Failed to add user to group. Please try again.',
          type: 'danger',
        });
        closeModal();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      onResult({ text: message, type: 'danger' });
      closeModal();
    } finally {
      setIsAddingToGroup(false);
    }
  }, [selectedUser, selectedGroup, addUserToGroup, closeModal, onAdded, onResult]);

  return {
    isOpen,
    groupSearchQuery,
    setGroupSearchQuery,
    groupSearchResults,
    isSearchingGroups,
    showGroupDropdown,
    selectedGroup,
    selectGroup,
    clearSelectedGroup,
    isAddingToGroup,
    openModal,
    closeModal,
    confirmAddToGroup,
  };
}
