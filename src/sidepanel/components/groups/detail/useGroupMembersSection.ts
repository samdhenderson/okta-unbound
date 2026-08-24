/**
 * @module sidepanel/components/groups/detail/useGroupMembersSection
 * @description Container state for the Group Detail view's Members section: add/remove.
 *
 * Reads the group's already-analyzed roster straight out of the shared entity
 * cache (`cacheKeys.groupMembers`) instead of issuing a second fetch:
 * {@link sidepanel/hooks/useGroupSource.useGroupSource}'s gated analysis already
 * populates that key with the exact `OktaUser[]` shape this section needs, so this
 * hook only *reads* it, once the analysis has finished (`memberStatus === 'done'`).
 * Nothing here calls `getAllGroupMembers` itself.
 *
 * Owns the two membership writes
 * ({@link module:hooks/useOktaApi/groupMembers.createGroupMemberOperations}):
 * remove (behind a confirm, `skipUndoLog` left at its default so the per-user
 * undo entry is written) and add (via a debounced user search — additive, so no
 * confirm). Both mutate the local roster and re-write the shared cache entry
 * directly rather than invalidating-and-refetching, so every other reader of the
 * same `groupMembers` key (the compact source meter, `GroupOverview`) sees the
 * change with no extra request, and a single-user write never pays for
 * re-walking the whole group.
 *
 * The add mutation and its debounced search are not implemented here — both are
 * owned by {@link sidepanel/hooks/useAddGroupMember.useAddGroupMember}, composed
 * below via its `addMemberDirect` escape hatch (add-on-select, no modal/selection
 * state). That hook also backs the Add-member modal
 * ({@link sidepanel/components/groups/detail/AddGroupMemberModal.AddGroupMemberModal}),
 * so the Okta write and the member-exclusion filter live in exactly one place
 * shared by both this section's inline field and the modal.
 *
 * {@link UseGroupMembersSectionReturn.onMemberAdded} exposes the exact
 * roster/cache write-back this hook wires as its own inline add's `onAdded`, so
 * {@link module:sidepanel/components/groups/detail/GroupActionBar}'s modal — a
 * *second*, independent `useAddGroupMember` instance, owned by
 * {@link module:sidepanel/components/groups/detail/GroupDetailView} — folds a
 * member it adds into this exact cache entry and `cacheTick` rather than the
 * view holding a second copy of the peek/setEntry/bump-tick logic below.
 */
import { useCallback, useMemo, useState } from 'react';
import type { GroupSummary, OktaUser } from '../../../../shared/types';
import { useOktaApi } from '../../../hooks/useOktaApi';
import { useAddGroupMember } from '../../../hooks/useAddGroupMember';
import { peek, setEntry } from '../../../cache/entityCache';
import { cacheKeys } from '../../../cache/keys';
import type { SourceStatus } from '../../../hooks/useGroupSource';
import { createLogger } from '../../../../shared/utils/logger';

const log = createLogger('useGroupMembersSection');

/** Async status of a single-member add/remove write. */
export type MemberWriteStatus = 'idle' | 'loading' | 'error';

/** Return shape of {@link useGroupMembersSection}. */
export interface UseGroupMembersSectionReturn {
  /** The group's roster, once the shared member analysis has populated it; `null` before then. */
  members: OktaUser[] | null;

  /** The member awaiting a remove confirmation, or `null` when none is armed. */
  removeTarget: OktaUser | null;
  /** Arm the confirm modal for this member. */
  requestRemove: (user: OktaUser) => void;
  /** Dismiss the confirm modal without removing. */
  cancelRemove: () => void;
  /** Run the armed removal. */
  confirmRemove: () => void;
  removeStatus: MemberWriteStatus;
  removeError: string | null;

  /** Debounced add-member search (already excludes current members from `addResults`). */
  addQuery: string;
  setAddQuery: (query: string) => void;
  addResults: OktaUser[];
  isSearchingToAdd: boolean;
  addSearchError: string | null;
  /** Add the chosen user immediately — additive, so no confirm step. */
  selectToAdd: (user: OktaUser) => void;
  addStatus: MemberWriteStatus;
  addError: string | null;

  /**
   * Folds a member added through some *other* `useAddGroupMember` instance
   * (the action bar's modal) into this hook's roster/cache state — see the
   * module doc. Wire it as that instance's `onAdded`.
   */
  onMemberAdded: (user: OktaUser) => void;
}

/**
 * Owns the Members section's add/remove state for one group.
 *
 * @param group - The group whose roster is managed.
 * @param targetTabId - Connected Okta tab id; writes and search no-op without one.
 * @param memberStatus - `useGroupSource`'s member-analysis status for this group —
 *   gates when the cached roster is read (see module doc). Passing anything but
 *   `'done'` clears `members` back to `null`.
 * @param onRosterChanged - Called with the post-write roster after a successful
 *   add or remove. Wired to `useGroupSource.resummarize`, because restoring the
 *   cache entry alone does not correct the manual-vs-rule meter rendered directly
 *   above this section: that split is React state, so it would otherwise keep
 *   showing pre-mutation counts for as long as the view stayed mounted.
 * @returns See {@link UseGroupMembersSectionReturn}.
 */
export function useGroupMembersSection(
  group: GroupSummary,
  targetTabId: number | null,
  memberStatus: SourceStatus,
  onRosterChanged?: (members: OktaUser[]) => void,
): UseGroupMembersSectionReturn {
  const api = useOktaApi({ targetTabId });
  const { removeUserFromGroup } = api;

  // Bumped by `writeBack` so the `useMemo` below re-reads the cache after a
  // local write. Not a mirror of the cache's own value — just a "read it again"
  // signal — so this never needs an effect: the roster is derived synchronously
  // from the cache on every render that could matter (see the memo's deps).
  const [cacheTick, setCacheTick] = useState(0);

  // The roster, read straight out of the shared cache once the analysis has
  // populated it (`memberStatus === 'done'`) — never fetched here. Deriving this
  // during render rather than mirroring it into state via an effect avoids an
  // extra cascading render on every group-change / analysis-completion.
  const members = useMemo<OktaUser[] | null>(() => {
    // Not read for its value — `cacheTick` in the dependency array below is what
    // forces this memo to re-run after `writeBack`; referencing it here keeps the
    // linter's exhaustive-deps check honest about why it's listed.
    void cacheTick;
    if (memberStatus !== 'done') return null;
    return peek<OktaUser[]>(cacheKeys.groupMembers(group.id)) ?? [];
  }, [group.id, memberStatus, cacheTick]);

  /**
   * Commits a locally-computed roster back into the shared cache and signals the
   * `members` memo to re-read it. `removeUserFromGroup`/`addUserToGroup` already
   * invalidated (dropped) the cache entry as a side effect of the write — see
   * `createGroupMemberOperations`'s `onMembershipChanged` — so this restores it
   * with the true post-write list at zero extra request cost, instead of leaving
   * every other reader of the key to pay for a full re-walk.
   */
  const writeBack = useCallback(
    (next: OktaUser[]) => {
      setEntry(cacheKeys.groupMembers(group.id), next);
      setCacheTick((t) => t + 1);
      onRosterChanged?.(next);
    },
    [group.id, onRosterChanged],
  );

  // --- Remove ---------------------------------------------------------------
  const [removeTarget, setRemoveTarget] = useState<OktaUser | null>(null);
  const [removeStatus, setRemoveStatus] = useState<MemberWriteStatus>('idle');
  const [removeError, setRemoveError] = useState<string | null>(null);

  const requestRemove = useCallback((user: OktaUser) => {
    setRemoveTarget(user);
    setRemoveStatus('idle');
    setRemoveError(null);
  }, []);

  const cancelRemove = useCallback(() => {
    setRemoveTarget(null);
    setRemoveStatus('idle');
    setRemoveError(null);
  }, []);

  const confirmRemove = useCallback(() => {
    if (!removeTarget || !members) return;
    const target = removeTarget;
    setRemoveStatus('loading');
    setRemoveError(null);

    // Default `skipUndoLog` (false): a per-user undo entry is written.
    removeUserFromGroup(group.id, group.name, target)
      .then((result) => {
        if (!result.success) {
          setRemoveStatus('error');
          setRemoveError(result.error || 'Failed to remove member.');
          return;
        }
        writeBack(members.filter((m) => m.id !== target.id));
        setRemoveTarget(null);
        setRemoveStatus('idle');
      })
      .catch((err: unknown) => {
        log.error('Failed to remove member:', err);
        setRemoveStatus('error');
        setRemoveError(err instanceof Error ? err.message : 'Failed to remove member.');
      });
  }, [removeTarget, members, removeUserFromGroup, group.id, group.name, writeBack]);

  // --- Add --------------------------------------------------------------------
  // The mutation and its debounced search live in `useAddGroupMember` (shared
  // with the Add-member modal); this section only supplies the roster it's
  // scoped to and adapts that hook's boolean/callback surface back onto this
  // hook's own tri-state `addStatus`/`addError` shape, which
  // `GroupMembersSection` already consumes.
  const [addError, setAddError] = useState<string | null>(null);

  const handleMemberAdded = useCallback(
    (user: OktaUser) => {
      if (!members) return;
      writeBack([...members, user]);
    },
    [members, writeBack],
  );

  const handleAddResult = useCallback((result: { text: string; type: 'danger' }) => {
    setAddError(result.text);
  }, []);

  const {
    addQuery,
    setAddQuery,
    addResults,
    isSearchingToAdd,
    addSearchError,
    isAddingMember,
    addMemberDirect,
  } = useAddGroupMember({
    targetTabId,
    group,
    members,
    onResult: handleAddResult,
    onAdded: handleMemberAdded,
  });

  const addStatus: MemberWriteStatus = isAddingMember ? 'loading' : addError ? 'error' : 'idle';

  const selectToAdd = useCallback(
    (user: OktaUser) => {
      if (!members) return;
      setAddError(null);
      void addMemberDirect(user);
    },
    [members, addMemberDirect],
  );

  return {
    members,
    removeTarget,
    requestRemove,
    cancelRemove,
    confirmRemove,
    removeStatus,
    removeError,
    addQuery,
    setAddQuery,
    addResults,
    isSearchingToAdd,
    addSearchError,
    selectToAdd,
    addStatus,
    addError,
    onMemberAdded: handleMemberAdded,
  };
}
