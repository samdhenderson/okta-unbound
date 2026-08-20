/**
 * @module sidepanel/hooks/useUndoAction
 * @description The extension's first undo **executor** — for profile writes only.
 *
 * `UndoAction.status` has carried `'undone'` since the history type was written
 * and nothing ever set it: the panel recorded what it did and offered no way
 * back. This hook is the first thing that can put a value back, and it is
 * deliberately narrow — one action type, {@link UpdateUserProfileMetadata}.
 *
 * ## Undo is a forward write, not a rollback
 *
 * Okta has no rollback. "Undoing" a profile edit means issuing a *new* write
 * that sets the prior values, which has three consequences the UI must not hide:
 *
 * - It can fail, exactly like any other write.
 * - It earns **its own history entry**, linked to the original through
 *   `metadata.undoOfActionId` (and back through the original's
 *   `undoneByActionId`). Nothing is erased.
 * - It is only safe if the attribute is *still what we wrote*. Between the
 *   original edit and the undo, an admin, an HR import or a directory sync may
 *   have changed the same attribute; writing the old value over that would
 *   silently revert someone else's change. So every undo re-reads the user first
 *   and refuses on drift.
 *
 * ## Drift asks "is it still what we wrote?"
 *
 * Not "does it still differ from before?". Those come apart in the case that
 * matters: a third party sets the attribute back to its old value. The second
 * question would answer "no difference, nothing to do" and the undo would look
 * like a no-op success; the first correctly reports that the value we wrote is
 * gone and someone else owns the attribute now. The comparison uses
 * {@link toDisplay} — the same stringifier the editor and the capture used, so
 * `5` and `'5'` cannot disagree and refuse a valid undo.
 *
 * ## Logging
 *
 * Attribute names and values are tenant PII. Nothing here logs one: ids, counts
 * and outcomes only. `UndoOutcome`'s `attributeNames` exists to be *rendered*,
 * never to be logged, and no message string is ever built from a value.
 */

import { useCallback, useState } from 'react';
import { useOktaApi } from './useOktaApi';
import {
  logProfileUpdateAction,
  markActionUndone,
  type AttributeChange,
} from '../../shared/undoManager';
import { toDisplay } from '../components/users/profileAttributes';
import { createLogger } from '../../shared/utils/logger';
import type { ActionType, CapturedAttribute, UndoAction } from '../../shared/undoTypes';

const log = createLogger('useUndoAction');

/**
 * Why each non-profile action type cannot be undone, as a sentence the UI shows.
 *
 * **This is a `Record`, not a `switch` with a `default:`, and that is the whole
 * point.** A `default:` arm would silently absorb the ninth `ActionType` someone
 * adds, quietly classifying a brand-new mutating operation as "not undoable"
 * with a generic apology — and no one would find out. Keyed on
 * `Exclude<ActionType, 'UPDATE_USER_PROFILE'>`, adding a member to `ActionType`
 * instead breaks the build here until a human writes down what undoing it would
 * mean. The compile error is the review.
 */
const NOT_UNDOABLE: Record<Exclude<ActionType, 'UPDATE_USER_PROFILE'>, string> = {
  REMOVE_USER_FROM_GROUP:
    'Group removals cannot be undone here. Re-adding the user would record a direct membership, ' +
    'which is not necessarily how they held the group before.',
  ADD_USER_TO_GROUP:
    'Group additions cannot be undone here. Removing the user again could strip access a rule has ' +
    'since granted independently.',
  BULK_REMOVE_USERS_FROM_GROUP:
    'Bulk removals cannot be undone here. Re-adding every user is a new bulk operation with its ' +
    'own cost and confirmation, not a restore.',
  BULK_ADD_USERS_TO_GROUP:
    'Bulk additions cannot be undone here. Removing every user again is a new bulk operation with ' +
    'its own cost and confirmation, not a restore.',
  ACTIVATE_RULE:
    'Rule activations cannot be undone here. Deactivating the rule does not recall the memberships ' +
    'it granted while it was active.',
  DEACTIVATE_RULE:
    'Rule deactivations cannot be undone here. Reactivating the rule re-evaluates it against every ' +
    'user, which is a new operation rather than a restore.',
  CONSOLIDATE_RULE:
    'Consolidations cannot be undone here. It would mean recreating the retired rules and deleting ' +
    'the rule that replaced them, all under new ids.',
};

/** Why an entry whose *own* lifecycle rules it out cannot be undone. */
const STATUS_REASON: Record<Exclude<UndoAction['status'], 'completed'>, string> = {
  undone: 'This action has already been undone.',
  failed: 'This action failed, so there is nothing to put back.',
  partial:
    'This write was never confirmed, so we do not know which values it actually set — and ' +
    'therefore cannot know what to restore.',
};

/** No captured prior state at all: recorded, but not restorable. */
const NOTHING_CAPTURED =
  'No previous values were captured for this edit, so there is nothing to restore.';

/**
 * The outcome of an undo attempt.
 *
 * Five outcomes rather than a boolean because they call for five different
 * things from the admin: nothing (`not-undoable`), a look at who else edited the
 * user (`drifted`), a refresh (`already-undone`), a retry (`failed`), or a note
 * that some attributes were left alone (`undone` with `skipped > 0`).
 */
export type UndoOutcome =
  /** The restoring write landed. `skipped` counts attributes whose prior value was never captured. */
  | { kind: 'undone'; restored: number; skipped: number; actionId: string }
  /** This kind of entry has no undo path. `reason` is a sentence for the UI. */
  | { kind: 'not-undoable'; reason: string }
  /**
   * At least one attribute is no longer what the original write set, so undoing
   * would overwrite someone else's change. **Names only** — a value never leaves
   * this hook in a string, because a constructed message eventually reaches a log.
   */
  | { kind: 'drifted'; attributeNames: readonly string[] }
  /** The entry was already undone; nothing was requested from Okta. */
  | { kind: 'already-undone' }
  /** The read or the restoring write did not succeed. */
  | { kind: 'failed'; error: string };

/** Options for {@link useUndoAction}. */
export interface UseUndoActionOptions {
  /**
   * Tab hosting the live Okta session every request is scoped to.
   *
   * Accepts `null` as well as `undefined` so a caller holding the panel's
   * `number | null` context value and one holding an optional prop can both pass
   * it straight through; it is normalised to the facade's `number | null` here
   * rather than at every call site.
   */
  targetTabId: number | null | undefined;
}

/** What {@link useUndoAction} returns. */
export interface UseUndoActionReturn {
  /** Re-read, drift-check, restore, and record — see {@link UndoOutcome}. */
  undo: (action: UndoAction) => Promise<UndoOutcome>;
  /** Id of the action currently being undone, or null. */
  undoingActionId: string | null;
  /** Pure: can this entry be undone at all, and if not, why? */
  undoability: (
    action: UndoAction,
  ) => { undoable: true; restorable: number; total: number } | { undoable: false; reason: string };
}

/**
 * A captured change that still has its prior state, with the optionality gone.
 *
 * `CapturedAttribute` types `beforeDisplay`/`beforeRaw` as optional because they
 * are **absent** — not empty — when the capture policy dropped an over-cap value.
 * Narrowing to this shape once, at the filter, is what lets the rest of the hook
 * use them without a `!` or a `?? ''` that would turn "not captured" into "was
 * empty".
 */
interface RestorableChange {
  name: string;
  label: string;
  beforeDisplay: string;
  beforeRaw: unknown;
  afterDisplay: string;
}

/**
 * Keep only the changes whose prior state was captured faithfully.
 *
 * @param changes - Every attribute the original write touched.
 * @returns The subset that can be restored, in the original order.
 */
function restorableChanges(changes: readonly CapturedAttribute[]): RestorableChange[] {
  const restorable: RestorableChange[] = [];
  for (const change of changes) {
    // `restorable` is the contract; the `undefined` check is what proves it to
    // the type system, and guards a hand-written entry that disagrees with itself.
    if (!change.restorable || change.beforeDisplay === undefined) continue;
    restorable.push({
      name: change.name,
      label: change.label,
      beforeDisplay: change.beforeDisplay,
      beforeRaw: change.beforeRaw,
      afterDisplay: change.afterDisplay,
    });
  }
  return restorable;
}

/**
 * Undo one recorded profile write, as a new, drift-checked forward write.
 *
 * @param options - See {@link UseUndoActionOptions}.
 * @returns {@link UseUndoActionReturn} — the executor, the in-flight id, and the
 * pure eligibility test a row uses to decide whether to offer the action at all.
 *
 * @example
 * ```tsx
 * const { undo, undoingActionId, undoability } = useUndoAction({ targetTabId });
 *
 * if (undoability(action).undoable) {
 *   const outcome = await undo(action);
 *   if (outcome.kind === 'drifted') showDrift(outcome.attributeNames);
 * }
 * ```
 */
export function useUndoAction({ targetTabId }: UseUndoActionOptions): UseUndoActionReturn {
  const api = useOktaApi({ targetTabId: targetTabId ?? null });
  const [undoingActionId, setUndoingActionId] = useState<string | null>(null);

  const undoability = useCallback<UseUndoActionReturn['undoability']>((action) => {
    if (action.status !== 'completed') {
      return { undoable: false, reason: STATUS_REASON[action.status] };
    }

    const metadata = action.metadata;
    if (metadata.type !== 'UPDATE_USER_PROFILE') {
      return { undoable: false, reason: NOT_UNDOABLE[metadata.type] };
    }

    const total = metadata.changes.length;
    const restorable = restorableChanges(metadata.changes).length;
    if (restorable === 0) {
      return { undoable: false, reason: NOTHING_CAPTURED };
    }

    return { undoable: true, restorable, total };
  }, []);

  const undo = useCallback<UseUndoActionReturn['undo']>(
    async (action) => {
      // Short-circuits before anything is requested from Okta: an entry the
      // history already shows as undone must not cost a rate-limit slot.
      if (action.status === 'undone') return { kind: 'already-undone' };

      const verdict = undoability(action);
      if (!verdict.undoable) return { kind: 'not-undoable', reason: verdict.reason };

      const metadata = action.metadata;
      // `undoability` already established this, but the narrowing does not travel
      // across the call — and the `Record` lookup keeps the exhaustiveness guarantee.
      if (metadata.type !== 'UPDATE_USER_PROFILE') {
        return { kind: 'not-undoable', reason: NOT_UNDOABLE[metadata.type] };
      }

      const restorable = restorableChanges(metadata.changes);
      const skipped = metadata.changes.length - restorable.length;

      setUndoingActionId(action.id);
      try {
        // 1. Re-read. Undo without a fresh read is a write against a profile we
        //    last saw at an unknown point in the past.
        const live = await api.getUserRaw(metadata.userId);
        if (!live) {
          return {
            kind: 'failed',
            error: 'Could not read the user, so the previous values were not written back.',
          };
        }

        // 2. Drift check — "is it still what we wrote?", not "does it still
        //    differ from before?". The second question would wave through an
        //    attribute a third party had already set back to the old value.
        const drifted = restorable
          .filter((change) => toDisplay(live.profile[change.name]) !== change.afterDisplay)
          .map((change) => change.name);

        if (drifted.length > 0) {
          // Count only: the names are for the dialog, never for the log.
          log.info('Undo refused: attributes changed since', {
            actionId: action.id,
            driftedCount: drifted.length,
          });
          return { kind: 'drifted', attributeNames: drifted };
        }

        // 3. The restoring write. Only the restorable keys — a partial restore
        //    beats stranding the attributes whose prior value we do hold.
        const patch: Record<string, unknown> = {};
        for (const change of restorable) patch[change.name] = change.beforeRaw;

        const result = await api.updateUserProfile(metadata.userId, patch);

        // The undo entry describes *this* write: what was there before it (the
        // value the original set) and what it put back. Capturing the live raw
        // value as `beforeRaw` is what makes an undo itself undoable.
        const undoChanges: AttributeChange[] = restorable.map((change) => ({
          name: change.name,
          label: change.label,
          beforeDisplay: change.afterDisplay,
          beforeRaw: live.profile[change.name] as unknown,
          afterDisplay: change.beforeDisplay,
        }));

        if (result.kind !== 'saved') {
          // `'unknown'` means the write may well have applied — so it is
          // recorded, as `'partial'`, exactly as an unconfirmed original write
          // is. What we must *not* do is mark the original undone: we cannot
          // state that. `'failed'` is recorded nowhere, because Okta answered
          // and nothing changed.
          if (result.kind === 'unknown') {
            await logProfileUpdateAction(
              metadata.userId,
              metadata.userLogin,
              metadata.userName,
              undoChanges,
              {
                undoOfActionId: action.id,
                originalAttributeCount: metadata.changes.length,
                status: 'partial',
              },
            );
          }
          log.error('Undo write did not succeed', { actionId: action.id, outcome: result.kind });
          return { kind: 'failed', error: result.error };
        }

        // 4 THEN 5, AND THE ORDER IS LOAD-BEARING.
        //
        // `logProfileUpdateAction` and `markActionUndone` are both
        // read-modify-write cycles over the same `chrome.storage.local` key.
        // Reversed, `markActionUndone` would write the flag, and then
        // `logProfileUpdateAction` — whose `getUndoHistory()` read happened
        // before that write — would save its stale copy of the history back over
        // the top, silently clobbering the `'undone'` status it had just set.
        // Awaiting the log first means the mark reads a history that already
        // contains the new entry. There is a test pinning this order.
        const entry = await logProfileUpdateAction(
          metadata.userId,
          metadata.userLogin,
          metadata.userName,
          undoChanges,
          { undoOfActionId: action.id, originalAttributeCount: metadata.changes.length },
        );

        // `false` here is not a failure: the 50-entry cap evicted the original
        // between the write and the undo. The restore still happened and still
        // has its own entry; only the back-link had nowhere to land.
        const marked = await markActionUndone(action.id, entry.id);

        log.info('Undo completed', {
          actionId: action.id,
          undoneByActionId: entry.id,
          restored: restorable.length,
          skipped,
          originalStillInHistory: marked,
        });

        return { kind: 'undone', restored: restorable.length, skipped, actionId: entry.id };
      } catch {
        // Identifier + outcome only: a transport error's message can carry the
        // request body, and this one's body is profile values.
        log.error('Undo failed', { actionId: action.id });
        return { kind: 'failed', error: 'The previous values could not be written back.' };
      } finally {
        setUndoingActionId(null);
      }
    },
    [api, undoability],
  );

  return { undo, undoingActionId, undoability };
}
