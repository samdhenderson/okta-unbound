/**
 * @module sidepanel/hooks/useGroupCopy
 * @description Copies a group onto EITHER user in the comparison, one at a time.
 *
 * Backs the "add missing group" actions in the user-comparison view: it can add
 * the context user to a group the compared user has (left ← right), or the
 * compared user to a group the context user has (right ← left). It tracks which
 * adds have succeeded per direction (for optimistic re-bucketing) and enforces a
 * global single-flight lock so only one add runs at a time.
 */

import { useState, useCallback } from 'react';
import { useOktaApi } from './useOktaApi';
import type { OktaUser, OktaGroup } from '../../shared/types';

/** Inputs to {@link useGroupCopy}. */
interface UseGroupCopyOptions {
  /** Tab id of the Okta session to query through. */
  targetTabId: number;
  /** The context (left) user. */
  contextUser: OktaUser;
  /** The compared (right) user, or `null` before one is selected. */
  comparedUser: OktaUser | null;
  /** Invoked after a successful add to the CONTEXT user so the parent can refetch. */
  onContextGroupsChanged: () => void;
  /** Invoked after a successful add to the COMPARED user so its memberships refetch. */
  onComparedGroupsChanged: () => void;
}

/** Value returned by {@link useGroupCopy}. */
interface UseGroupCopyReturn {
  /** Ids of groups successfully added to the CONTEXT user this session. */
  addedToContextIds: Set<string>;
  /** Ids of groups successfully added to the COMPARED user this session. */
  addedToComparedIds: Set<string>;
  /**
   * Id of the group whose add is in flight, or `null`. This is a GLOBAL single-flight
   * lock — gate every Add button on `disabled={addingGroupId !== null}`, not per-row.
   */
  addingGroupId: string | null;
  /** Error message from the last add, or `null`. */
  addError: string | null;
  /** Setter for {@link UseGroupCopyReturn.addError} (lets the parent clear/set it). */
  setAddError: (v: string | null) => void;
  /** Add the CONTEXT user to `group` (from the compared user's unique groups). */
  addToContext: (group: OktaGroup) => Promise<void>;
  /** Add the COMPARED user to `group` (from the context user's unique groups). */
  addToCompared: (group: OktaGroup) => Promise<void>;
  /** Full reset (modal close): also clears the in-flight lock. */
  resetCopyState: () => void;
  /** Partial reset (change user): keeps addingGroupId — see below. */
  resetForChangeUser: () => void;
}

/**
 * Owns copying a group onto either comparison user, with per-direction optimistic
 * re-bucketing.
 *
 * `addingGroupId` is a GLOBAL single-flight lock (one add at a time across the whole
 * list, not per-row) — callers must gate every Add button on
 * `disabled={addingGroupId !== null}`, not just the row being added.
 */
export function useGroupCopy({
  targetTabId,
  contextUser,
  comparedUser,
  onContextGroupsChanged,
  onComparedGroupsChanged,
}: UseGroupCopyOptions): UseGroupCopyReturn {
  const { addUserToGroup } = useOktaApi({ targetTabId: targetTabId ?? null });

  const [addedToContextIds, setAddedToContextIds] = useState<Set<string>>(new Set());
  const [addedToComparedIds, setAddedToComparedIds] = useState<Set<string>>(new Set());
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // Shared add path: adds `user` to `group`, then marks success / notifies. The
  // global lock and error channel are shared across both directions.
  const runAdd = useCallback(
    async (
      group: OktaGroup,
      user: OktaUser,
      markAdded: (id: string) => void,
      onChanged: () => void,
    ) => {
      setAddingGroupId(group.id);
      setAddError(null);
      try {
        const result = await addUserToGroup(group.id, group.profile.name, {
          id: user.id,
          profile: {
            login: user.profile.login,
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            email: user.profile.email,
          },
        });

        if (result.success) {
          markAdded(group.id);
          onChanged();
        } else {
          setAddError(result.error || `Failed to add to ${group.profile.name}`);
        }
      } catch (err) {
        setAddError(err instanceof Error ? err.message : 'Failed to add user to group');
      } finally {
        setAddingGroupId(null);
      }
    },
    [addUserToGroup],
  );

  const addToContext = useCallback(
    (group: OktaGroup) =>
      runAdd(
        group,
        contextUser,
        (id) => setAddedToContextIds((prev) => new Set(prev).add(id)),
        onContextGroupsChanged,
      ),
    [runAdd, contextUser, onContextGroupsChanged],
  );

  const addToCompared = useCallback(
    (group: OktaGroup) => {
      // Guard: nothing to add to before a compared user is selected. The Groups
      // tab only renders these actions once one is, so this is defensive.
      if (!comparedUser) return Promise.resolve();
      return runAdd(
        group,
        comparedUser,
        (id) => setAddedToComparedIds((prev) => new Set(prev).add(id)),
        onComparedGroupsChanged,
      );
    },
    [runAdd, comparedUser, onComparedGroupsChanged],
  );

  const resetCopyState = useCallback(() => {
    setAddedToContextIds(new Set());
    setAddedToComparedIds(new Set());
    setAddingGroupId(null);
    setAddError(null);
  }, []);

  // Deliberately does NOT clear addingGroupId: if an add is in flight when the user
  // switches, every Add button stays disabled until it settles. This divergence from
  // resetCopyState is characterized behavior — do not "unify" the two resets.
  const resetForChangeUser = useCallback(() => {
    setAddedToContextIds(new Set());
    setAddedToComparedIds(new Set());
    setAddError(null);
  }, []);

  return {
    addedToContextIds,
    addedToComparedIds,
    addingGroupId,
    addError,
    setAddError,
    addToContext,
    addToCompared,
    resetCopyState,
    resetForChangeUser,
  };
}
