/**
 * @module sidepanel/hooks/useUsersTabProfileEdit
 * @description Wires profile editing into the Users tab: the draft, the
 * blast-radius prediction, the outcome banner, and the one Undo the panel offers
 * inline.
 *
 * A composition hook, not a new state machine. Everything here already exists —
 * {@link module:sidepanel/hooks/useProfileEdit} owns the draft and the write,
 * {@link module:sidepanel/hooks/useBlastRadius} owns the prediction, and
 * {@link module:sidepanel/hooks/useUndoAction} owns the restore. It lives beside
 * {@link module:sidepanel/hooks/useUsersTabState} rather than inside it because
 * that orchestrator is already past 500 lines, and because these three hooks are
 * only ever needed together.
 *
 * ## The refreshed user must be lifted, or the pane lies
 *
 * There is **no `user` cache key** — check `sidepanel/cache/keys.ts`. The
 * selected user is a plain object in `useUsersTabState`'s React state, so
 * invalidating a cache after a successful write does precisely nothing for it.
 * {@link UseUsersTabProfileEditOptions.onUserUpdated} is what puts Okta's answer
 * back where the pane reads it; without that call a save appears to succeed and
 * the profile keeps showing the old value.
 *
 * The same is true of an undo, which is a *second* forward write. `useUndoAction`
 * does not return the resulting user, so a successful undo re-reads the user once
 * and lifts that. One extra GET on an explicit, deliberate action is cheaper than
 * a pane displaying values that are no longer in the directory.
 *
 * ## A report is retracted the moment the draft moves
 *
 * `useBlastRadius` documents why: a report is true only for the draft it was
 * computed from, and a stale one is indistinguishable on screen from a fresh
 * one — a confident, specific, wrong answer. Every change to `draftPatch` resets
 * it here.
 *
 * ## Three outcomes, and `'unknown'` is never reported as failure
 *
 * A non-GET is never retried (`useOktaApi/core.ts`), so a transport error on a
 * profile write means the write **may have applied**. Saying "failed" would be a
 * false statement about someone's directory, so `'unknown'` becomes a `warning`
 * asking the reader to reload and check — and no Undo is offered, because we do
 * not know there is anything to undo. Only a confirmed `'saved'` gets the Undo
 * affordance.
 *
 * ## Where Undo comes from
 *
 * `confirmSave` records the history entry itself and does not return its id, so
 * the entry is read back from the history immediately afterwards — it is written
 * before `confirmSave` resolves, and `logAction` unshifts, so it is
 * `actions[0]`. The read is guarded on all four things that identify it (type,
 * status, subject, and that it is not itself an undo) rather than trusting
 * position alone, and a miss simply means the banner carries no Undo button.
 *
 * ## Security
 *
 * Attribute names, labels, values and the user's name are tenant data and
 * frequently PII. **Nothing in this module logs** — not a name, not a value, not
 * a count. Drift is reported to the reader by attribute *name* only, never by
 * value, matching `useUndoAction`'s own rule.
 */

import { useCallback, useEffect, useMemo } from 'react';
import type { AlertAction, AlertMessageData } from '../components/shared/AlertMessage';
import type { ProfileSaveModalProps } from '../components/users/ProfileSaveModal';
import type { ProfileEditControls } from '../components/users/UserProfilePaneHeader';
import type { AttributeDescriptor } from '../components/users/profileAttributes';
import {
  attributeEditability,
  type ProfileMastering,
} from '../components/users/profileEditability';
import type { RuleInventoryState } from '../../shared/membership/blastRadiusTypes';
import type { GroupMembership, OktaUser } from '../../shared/types';
import { getUndoHistory } from '../../shared/undoManager';
import type { UndoAction } from '../../shared/undoTypes';
import { userDisplayName } from '../../shared/utils/userDisplay';
import { useBlastRadius } from './useBlastRadius';
import { useOktaApi } from './useOktaApi';
import { useProfileEdit, type AttributeEditCell } from './useProfileEdit';
import { useUndoAction } from './useUndoAction';

/**
 * Everything the Profile pane needs to be editable, as one bundle —
 * {@link module:sidepanel/components/users/UserDetailPanel}'s `profileEdit` prop.
 *
 * One prop rather than fifteen because the three parts are produced together
 * here and are only correct together: the header's `changeCount` describes the
 * same draft the `cells` hold and the `save` confirmation is about to write.
 * Threading them as loose props would let a caller pass two of the three and
 * produce a Save button that confirms a different edit from the one on screen.
 */
export interface UserProfileEditing {
  /** The pane-level verbs: Edit, or Cancel + Save with a dirty count. */
  controls: ProfileEditControls;
  /** Attribute Okta name → its edit cell. Empty outside edit mode. */
  cells: Readonly<Record<string, AttributeEditCell>>;
  /**
   * The save confirmation's props, less `userName` — the panel already holds the
   * user, and deriving the name there is what stops the dialog naming somebody
   * other than the profile behind it.
   */
  save: Omit<ProfileSaveModalProps, 'userName'>;
}

/** `1 attribute` / `3 attributes`. */
function attributeCountLabel(count: number): string {
  return count === 1 ? '1 attribute' : `${count} attributes`;
}

/**
 * Whether **anything** on this profile can be edited here.
 *
 * Deliberately a re-application of `attributeEditability` rather than a second
 * rule: the flag that decides whether Edit is offered and the cells that appear
 * once it is pressed must come from the same verdicts, or the panel offers a
 * mode with no controls in it.
 *
 * It also mirrors `useProfileEdit`'s own `indexAttributes` tie-break, which
 * matters because a name can legitimately appear twice (a top-level `status`
 * field beside a custom `status` profile attribute): **the locked verdict wins**,
 * so a name only counts as editable when no descriptor of that name is locked.
 *
 * @param attributes - The inventory exactly as the pane renders it.
 * @param user - The user the verdicts are about.
 * @param mastering - The profile sources attached to that user, so an attribute
 *   the org masters externally but this user is not sourced from still counts.
 * @returns `true` when at least one attribute would render a control.
 */
function hasEditableAttribute(
  attributes: readonly AttributeDescriptor[],
  user: OktaUser,
  mastering: ProfileMastering | undefined,
): boolean {
  const verdicts = new Map<string, boolean>();

  for (const attribute of attributes) {
    const editable = attributeEditability(attribute, user, mastering).editable;
    const existing = verdicts.get(attribute.name);
    verdicts.set(attribute.name, existing === undefined ? editable : existing && editable);
  }

  for (const editable of verdicts.values()) {
    if (editable) return true;
  }
  return false;
}

/**
 * Read back the history entry a just-completed save wrote, so the banner can
 * offer to undo it.
 *
 * @param userId - The user the save was about.
 * @returns The entry, or `null` when the newest one is not recognisably it.
 * @remarks Every guard here is a reason *not* to offer Undo rather than a reason
 * to fail: a `partial` entry describes a write whose outcome is unknown, an
 * entry with `undoOfActionId` is itself an undo, and an entry about another user
 * belongs to another surface. Offering Undo on any of those would put the wrong
 * values into someone's profile.
 */
async function recordedSave(userId: string): Promise<UndoAction | null> {
  const history = await getUndoHistory();
  const newest = history.actions[0];

  if (!newest || newest.status !== 'completed') return null;
  if (newest.metadata.type !== 'UPDATE_USER_PROFILE') return null;
  if (newest.metadata.userId !== userId) return null;
  if (newest.metadata.undoOfActionId !== undefined) return null;

  return newest;
}

/** Options for {@link useUsersTabProfileEdit}. */
export interface UseUsersTabProfileEditOptions {
  /** The tab's selected user; every verb no-ops without one. */
  user: OktaUser | null;
  /**
   * The attribute inventory as `useUserDetailPanes` resolved it — the same array
   * the pane renders, so the editor cannot offer a control for something the
   * reader cannot see.
   */
  attributes: readonly AttributeDescriptor[];
  /**
   * The user's **complete** membership list, for the blast-radius engine. A
   * partial list turns every omitted group into a confident `false`
   * (`useBlastRadius`).
   */
  memberships: GroupMembership[];
  /** The org's rule inventory, three-state. `unresolved` predicts nothing at all. */
  rules: RuleInventoryState;
  /** Connected org origin, so the blast-radius report can label group ids. */
  oktaOrigin?: string | null;
  /**
   * Which profile sources are attached to the user, as `useUserDetailPanes`
   * resolved them. Decides whether an org-wide `PROFILE_MASTER` attribute is
   * mastered for *this* person; absent, every one of them stays locked.
   */
  mastering?: ProfileMastering;
  /** Tab whose scheduler runs the write. */
  targetTabId: number | undefined;
  /**
   * Whether the Profile pane is actually on screen — `isActive && pane ===
   * 'profile'`. `false` blocks entering edit mode and blocks the write, so a
   * hidden tab never writes to a profile out of view (ADR-0018).
   */
  enabled: boolean;
  /** Lifts a refreshed user into the tab's state. See the module header for why this is mandatory. */
  onUserUpdated: (user: OktaUser) => void;
  /**
   * Re-reads the user's group memberships, because a profile write may have
   * moved them.
   *
   * `useProfileEdit` already **invalidates** the cached analysis on a confirmed
   * save, on exactly these grounds: group rules read profile attributes, so a
   * write to one can add or remove a membership. Invalidating is not enough on
   * its own. The Groups pane stays mounted (ADR-0018) and holds the analysis it
   * last loaded, so dropping the cache behind it left the pane showing the
   * memberships the user had *before* the write until something else happened to
   * reload them.
   *
   * That was worse than a stale number. The save modal's blast-radius report had
   * just predicted, by name, which groups the edit would move - so the panel
   * stated the change was coming and then declined to show it arriving.
   *
   * **Takes the user the write produced, not the one on screen.** Membership
   * analysis classifies each group by evaluating the org's rules against the
   * user's *attributes*, so a reload handed the pre-write user re-fetches the
   * right groups and then decides none of them are rule-fed - the corrected
   * `department` is the very thing the rule reads. The visible result is the
   * group arriving with a `Direct` badge on it, which is a more confident kind
   * of wrong than the stale list was.
   */
  onMembershipsChanged: (user: OktaUser) => void;
  /**
   * Publishes the tab's result banner. The optional second argument is the
   * banner's inline action — there is no toast primitive in this panel, and
   * `AlertMessage`'s action slot is where an inline Undo belongs.
   */
  onResult: (message: AlertMessageData, action?: AlertAction) => void;
}

/**
 * Everything the Users tab needs to make its Profile pane editable.
 *
 * @param options - See {@link UseUsersTabProfileEditOptions}.
 * @returns The bundle {@link sidepanel/components/users/UserDetailPanel} takes as
 *   its `profileEdit` prop — the header controls, the per-attribute cells, and
 *   the save confirmation's props.
 *
 * @example
 * ```tsx
 * const profileEdit = useUsersTabProfileEdit({
 *   user: selectedUser,
 *   attributes: panes.attributes,
 *   memberships,
 *   rules,
 *   targetTabId,
 *   enabled: isActive && panes.pane === 'profile',
 *   onUserUpdated: setSelectedUser,
 *   onResult: setResultMessage,
 * });
 *
 * <UserDetailPanel profileEdit={profileEdit} … />;
 * ```
 */
export function useUsersTabProfileEdit({
  user,
  attributes,
  memberships,
  rules,
  mastering,
  targetTabId,
  enabled,
  onUserUpdated,
  onMembershipsChanged,
  onResult,
  oktaOrigin,
}: UseUsersTabProfileEditOptions): UserProfileEditing {
  const edit = useProfileEdit({ user, attributes, targetTabId, onUserUpdated, enabled, mastering });
  const blast = useBlastRadius({ user, memberships, rules, oktaOrigin });
  const { undo } = useUndoAction({ targetTabId });
  const { getUserRaw } = useOktaApi({ targetTabId: targetTabId ?? null });

  const { draftPatch, pendingSave, confirmSave } = edit;
  const { reset: resetReport, analyze, report, isAnalyzing } = blast;

  // A report belongs to exactly one draft. The moment the draft moves the
  // previous answer stops being about anything on screen, and a stale prediction
  // is indistinguishable from a fresh one. `draftPatch` is a frozen constant
  // outside edit mode, so this settles rather than looping.
  useEffect(() => {
    resetReport();
  }, [draftPatch, resetReport]);

  const canEdit = useMemo(
    () => (user === null ? false : hasEditableAttribute(attributes, user, mastering)),
    [attributes, user, mastering],
  );

  const runUndo = useCallback(
    async (action: UndoAction, userId: string): Promise<void> => {
      // Replacing the banner immediately is also what withdraws the Undo button:
      // `AlertAction` has no pending state, and a second press would re-read,
      // find the values already restored, and report drift.
      onResult({ type: 'info', text: 'Putting the previous values back…' });

      const outcome = await undo(action);

      switch (outcome.kind) {
        case 'undone': {
          // `useUndoAction` does not hand back the user its write produced, so
          // the pane would otherwise keep showing the values that were just
          // replaced.
          const restored = await getUserRaw(userId);
          if (restored) onUserUpdated(restored);
          // An undo is a write like any other and moves membership back. Only
          // when the re-read gave us the restored profile to classify against.
          if (restored) onMembershipsChanged(restored);

          const text =
            outcome.skipped > 0
              ? `Put back ${attributeCountLabel(outcome.restored)}. ` +
                `${attributeCountLabel(outcome.skipped)} had no previous value recorded, so ${
                  outcome.skipped === 1 ? 'it was' : 'they were'
                } left alone.`
              : `Put back ${attributeCountLabel(outcome.restored)}.`;
          onResult({ type: 'success', text });
          return;
        }
        case 'drifted':
          // Names only. A value never goes into a message, because a message
          // eventually reaches a log.
          onResult({
            type: 'warning',
            text:
              'Nothing was put back: these attributes have changed since that edit, so restoring ' +
              `them would overwrite someone else's change — ${outcome.attributeNames.join(', ')}.`,
          });
          return;
        case 'already-undone':
          onResult({ type: 'info', text: 'That change has already been undone.' });
          return;
        case 'not-undoable':
          onResult({ type: 'warning', text: outcome.reason });
          return;
        case 'failed':
          onResult({ type: 'danger', text: outcome.error });
          return;
      }
    },
    [undo, onResult, getUserRaw, onUserUpdated, onMembershipsChanged],
  );

  const handleConfirmSave = useCallback(async (): Promise<void> => {
    // Captured before the write: `confirmSave` clears `pendingSave` on its way
    // to Okta, so by the time it resolves there is nothing left to count.
    const count = pendingSave?.length ?? 0;
    const outcome = await confirmSave();

    if (outcome.kind === 'failed') {
      // The pane stays in edit mode with the draft intact (`useProfileEdit`), so
      // this is a message about a retryable attempt, not a lost edit.
      onResult({ type: 'danger', text: outcome.error });
      return;
    }

    if (outcome.kind === 'unknown') {
      // Never "failed": a non-GET is not retried, so the write may well have
      // applied. No Undo — we do not know there is anything to undo.
      onResult({
        type: 'warning',
        text: 'The result of this change is unknown. Reload to check.',
      });
      return;
    }

    const saved = outcome.user;
    // The write landed, so the memberships the pane is holding are the ones from
    // before it. Passed `saved`, never the user in scope. See
    // `onMembershipsChanged`.
    onMembershipsChanged(saved);
    const message: AlertMessageData = {
      type: 'success',
      text: `Saved ${attributeCountLabel(count)} on ${userDisplayName(saved)}.`,
    };

    const recorded = await recordedSave(saved.id);
    if (!recorded) {
      // The history did not take the entry (storage full, or capped away). The
      // save still happened; only the way back is missing, so say the true thing
      // and offer nothing rather than an Undo that cannot work.
      onResult(message);
      return;
    }

    onResult(message, {
      label: 'Undo',
      onClick: () => {
        void runUndo(recorded, saved.id);
      },
    });
  }, [pendingSave, confirmSave, onResult, onMembershipsChanged, runUndo]);

  return useMemo(
    () => ({
      controls: {
        canEdit,
        isEditing: edit.isEditing,
        changeCount: edit.changes.length,
        hasInvalid: edit.hasInvalid,
        onBeginEdit: edit.begin,
        onCancelEdit: edit.cancel,
        onSave: edit.requestSave,
      },
      cells: edit.cells,
      save: {
        changes: pendingSave,
        onCancel: edit.dismissSave,
        onConfirm: () => {
          void handleConfirmSave();
        },
        isSaving: edit.isSaving,
        report,
        onAnalyze: () => analyze(draftPatch),
        isAnalyzing,
      },
    }),
    [
      canEdit,
      edit.isEditing,
      edit.changes.length,
      edit.hasInvalid,
      edit.begin,
      edit.cancel,
      edit.requestSave,
      edit.cells,
      edit.dismissSave,
      edit.isSaving,
      pendingSave,
      handleConfirmSave,
      report,
      analyze,
      draftPatch,
      isAnalyzing,
    ],
  );
}
