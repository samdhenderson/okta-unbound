import { useState, useCallback } from 'react';
import { useOktaApi } from './useOktaApi';
import type { OktaUser, OktaGroup } from '../../shared/types';

interface UseGroupCopyOptions {
  targetTabId: number;
  contextUser: OktaUser;
  onGroupsChanged: () => void;
}

interface UseGroupCopyReturn {
  addedGroupIds: Set<string>;
  addingGroupId: string | null;
  addError: string | null;
  setAddError: (v: string | null) => void;
  addGroup: (group: OktaGroup) => Promise<void>;
  /** Full reset (modal close): also clears the in-flight lock. */
  resetCopyState: () => void;
  /** Partial reset (change user): keeps addingGroupId — see below. */
  resetForChangeUser: () => void;
}

/**
 * Owns copying a missing group onto the context user, with optimistic re-bucketing.
 *
 * `addingGroupId` is a GLOBAL single-flight lock (one add at a time across the whole
 * list, not per-row) — callers must gate every Add button on
 * `disabled={addingGroupId !== null}`, not just the row being added.
 */
export function useGroupCopy({
  targetTabId,
  contextUser,
  onGroupsChanged,
}: UseGroupCopyOptions): UseGroupCopyReturn {
  const { addUserToGroup } = useOktaApi({ targetTabId: targetTabId ?? null });

  const [addedGroupIds, setAddedGroupIds] = useState<Set<string>>(new Set());
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const addGroup = useCallback(
    async (group: OktaGroup) => {
      setAddingGroupId(group.id);
      setAddError(null);
      try {
        const result = await addUserToGroup(group.id, group.profile.name, {
          id: contextUser.id,
          profile: {
            login: contextUser.profile.login,
            firstName: contextUser.profile.firstName,
            lastName: contextUser.profile.lastName,
            email: contextUser.profile.email,
          },
        });

        if (result.success) {
          setAddedGroupIds((prev) => new Set(prev).add(group.id));
          onGroupsChanged();
        } else {
          setAddError(result.error || `Failed to add to ${group.profile.name}`);
        }
      } catch (err) {
        setAddError(err instanceof Error ? err.message : 'Failed to add user to group');
      } finally {
        setAddingGroupId(null);
      }
    },
    [addUserToGroup, contextUser, onGroupsChanged],
  );

  const resetCopyState = useCallback(() => {
    setAddedGroupIds(new Set());
    setAddingGroupId(null);
    setAddError(null);
  }, []);

  // Deliberately does NOT clear addingGroupId: if an add is in flight when the user
  // switches, every Add button stays disabled until it settles. This divergence from
  // resetCopyState is characterized behavior — do not "unify" the two resets.
  const resetForChangeUser = useCallback(() => {
    setAddedGroupIds(new Set());
    setAddError(null);
  }, []);

  return {
    addedGroupIds,
    addingGroupId,
    addError,
    setAddError,
    addGroup,
    resetCopyState,
    resetForChangeUser,
  };
}
