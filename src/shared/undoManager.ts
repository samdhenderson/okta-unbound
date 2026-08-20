/**
 * @module shared/undoManager
 * @description Persists a rolling history of mutating actions for audit/undo.
 *
 * Records each action (with typed {@link UndoActionMetadata}) in
 * `chrome.storage.local`, newest-first, capped at 50 entries. Provides helpers to
 * log generic, bulk-remove and profile-update actions, mark an entry undone,
 * clear history, and format timestamps for display. Type definitions live in
 * `shared/undoTypes`.
 *
 * Storage here is **plaintext**, so the profile-update capture is bounded on
 * both axes ({@link MAX_CAPTURED_VALUE_CHARS}, {@link MAX_CAPTURED_ATTRIBUTES})
 * and an over-cap prior value is omitted outright rather than truncated — see
 * {@link captureAttribute}.
 *
 * @see {@link logAction}
 * @see {@link getUndoHistory}
 */

import { createLogger } from './utils/logger';
import type {
  UndoAction,
  UndoActionMetadata,
  UndoHistory,
  BulkRemoveUsersMetadata,
  BulkUserInfo,
  CapturedAttribute,
  UpdateUserProfileMetadata,
} from './undoTypes';

const log = createLogger('UndoManager');

const UNDO_STORAGE_KEY = 'undoHistory';
const MAX_UNDO_SIZE = 50;

/**
 * Longest previous value, in characters, captured for a profile undo.
 *
 * History lives in **plaintext** `chrome.storage.local`, so a captured value is
 * tenant PII sitting at rest until the 50-entry cap evicts it. A value longer
 * than this is dropped **entirely** rather than truncated: a prefix is still PII,
 * it carries none of the restore utility, and writing a truncated value back
 * would silently corrupt the attribute. See {@link captureAttribute}.
 */
export const MAX_CAPTURED_VALUE_CHARS = 1024;

/**
 * Most attributes whose previous value is captured for a single profile write.
 *
 * Bounds one history entry's footprint on the same plaintext-storage reasoning
 * as {@link MAX_CAPTURED_VALUE_CHARS}. Changes past the cap are still *recorded*
 * (the entry names every attribute touched) but are marked unrestorable.
 */
export const MAX_CAPTURED_ATTRIBUTES = 25;

/** How many attribute names a profile-update description lists before eliding. */
const DESCRIPTION_NAME_LIMIT = 3;

/**
 * Gets the current action history from chrome.storage
 */
export async function getUndoHistory(): Promise<UndoHistory> {
  try {
    const result = await chrome.storage.local.get([UNDO_STORAGE_KEY]);
    const history = result[UNDO_STORAGE_KEY] as UndoHistory | undefined;

    if (history && Array.isArray(history.actions)) {
      return history;
    }

    return { actions: [], maxSize: MAX_UNDO_SIZE };
  } catch (error) {
    log.error('Failed to get history:', error);
    return { actions: [], maxSize: MAX_UNDO_SIZE };
  }
}

/**
 * Saves the action history to chrome.storage
 */
async function saveUndoHistory(history: UndoHistory): Promise<void> {
  try {
    await chrome.storage.local.set({ [UNDO_STORAGE_KEY]: history });
  } catch (error) {
    log.error('Failed to save history:', error);
  }
}

/**
 * Generates a unique action ID
 */
function generateActionId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Append an action to the history (trimming to the 50-entry cap).
 *
 * @param description - Human-readable summary shown in the history UI.
 * @param metadata - Typed, action-specific payload used for later inspection.
 * @param status - Lifecycle outcome; defaults to `'completed'`.
 * @returns The stored {@link UndoAction}, including its generated id.
 * @remarks `status` exists for the write whose outcome is genuinely
 * *unconfirmed* — a profile update whose transport threw may or may not have
 * applied, and recording it as `'completed'` would assert something we do not
 * know. Such an entry is logged as `'partial'`. This function is the only writer
 * of the history storage key; callers never construct an {@link UndoAction}
 * themselves.
 */
export async function logAction(
  description: string,
  metadata: UndoActionMetadata,
  status: UndoAction['status'] = 'completed',
): Promise<UndoAction> {
  const history = await getUndoHistory();

  const action: UndoAction = {
    id: generateActionId(),
    type: metadata.type,
    timestamp: Date.now(),
    description,
    metadata,
    status,
  };

  history.actions.unshift(action);

  if (history.actions.length > history.maxSize) {
    history.actions = history.actions.slice(0, history.maxSize);
  }

  await saveUndoHistory(history);
  return action;
}

/**
 * Log a bulk user-removal action, composing a human-readable description from
 * the operation type and affected-user count.
 *
 * @param groupId - The group users were removed from.
 * @param groupName - The group's display name (used in the description).
 * @param users - The removed users.
 * @param operationType - What drove the removal (e.g. deprovisioned, inactive).
 * @param targetStatus - Status filter used, for custom/multi-status operations.
 * @returns The stored {@link UndoAction}.
 */
export async function logBulkRemoveAction(
  groupId: string,
  groupName: string,
  users: BulkUserInfo[],
  operationType: 'deprovisioned' | 'inactive' | 'custom_status' | 'multi_status',
  targetStatus?: string,
): Promise<UndoAction> {
  let description: string;
  if (operationType === 'deprovisioned') {
    description = `Removed ${users.length} deprovisioned user${users.length !== 1 ? 's' : ''} from ${groupName}`;
  } else if (operationType === 'inactive') {
    description = `Removed ${users.length} inactive user${users.length !== 1 ? 's' : ''} from ${groupName}`;
  } else if (operationType === 'multi_status' && targetStatus) {
    const statusCount = targetStatus.split(',').length;
    description = `Removed ${users.length} user${users.length !== 1 ? 's' : ''} (${statusCount} status types) from ${groupName}`;
  } else {
    description = `Removed ${users.length} ${targetStatus || 'filtered'} user${users.length !== 1 ? 's' : ''} from ${groupName}`;
  }

  const metadata: BulkRemoveUsersMetadata = {
    type: 'BULK_REMOVE_USERS_FROM_GROUP',
    users,
    groupId,
    groupName,
    operationType,
    targetStatus,
  };

  return logAction(description, metadata);
}

/**
 * One attribute the caller changed, before the capture policy is applied.
 *
 * The caller has already stringified both sides with the same `toDisplay` the
 * UI uses, so `beforeDisplay` is always a string — `''` legitimately meaning
 * "the attribute was empty". {@link captureAttribute} is what may turn that into
 * an *absent* field, which is a different fact entirely.
 */
export interface AttributeChange {
  /** The attribute's bare Okta name. */
  name: string;
  /** Its human label at capture time. */
  label: string;
  /** The prior value, stringified. */
  beforeDisplay: string;
  /** The untouched prior value, for a restoring write. */
  beforeRaw: unknown;
  /** The new value, stringified. */
  afterDisplay: string;
}

/**
 * Apply the capture policy to one change, deciding whether its prior state may
 * be persisted.
 *
 * @param change - The change as the caller saw it.
 * @param index - This change's position in the edit (0-based), used against
 * {@link MAX_CAPTURED_ATTRIBUTES}.
 * @returns A {@link CapturedAttribute}: fully restorable, or marked `omitted`
 * with **no** `beforeDisplay`/`beforeRaw` at all.
 * @remarks The absence is the point. Storing `beforeDisplay: ''` for a value we
 * refused to keep would be indistinguishable from a genuinely empty prior value,
 * and a later "restore" would blank an attribute that had content. `undefined`
 * says "not captured"; `''` says "was empty". Renderers must branch on
 * `restorable`/`omitted`, never on truthiness of `beforeDisplay`.
 *
 * `afterDisplay` is kept in every case: the entry still records *what the write
 * set*, which is what a drift check compares against, and it is a value the
 * admin just typed rather than one we went and read.
 */
export function captureAttribute(change: AttributeChange, index: number): CapturedAttribute {
  const { name, label, afterDisplay } = change;

  if (index >= MAX_CAPTURED_ATTRIBUTES) {
    return { name, label, afterDisplay, restorable: false, omitted: 'too-many' };
  }

  if (change.beforeDisplay.length > MAX_CAPTURED_VALUE_CHARS) {
    return { name, label, afterDisplay, restorable: false, omitted: 'too-large' };
  }

  return {
    name,
    label,
    beforeDisplay: change.beforeDisplay,
    beforeRaw: change.beforeRaw,
    afterDisplay,
    restorable: true,
  };
}

/**
 * Apply {@link captureAttribute} across a whole edit, preserving order.
 *
 * @param changes - Every attribute the write touched, in the order the UI listed them.
 * @returns One {@link CapturedAttribute} per change — none are dropped; the ones
 * past the caps are recorded as unrestorable.
 */
export function captureAttributes(changes: AttributeChange[]): CapturedAttribute[] {
  return changes.map((change, index) => captureAttribute(change, index));
}

/**
 * Compose the history description for a profile write.
 *
 * @param userName - Display name of the edited user.
 * @param changes - The captured attributes.
 * @param undoOfActionId - Set when this write undoes an earlier entry.
 * @param originalAttributeCount - For an undo, how many attributes the original
 * entry touched (a partial restore says "3 of 5"); defaults to `changes.length`.
 * @returns e.g. `Updated department, title on Jane Doe`, or
 * `Restored 3 of 5 attributes on Jane Doe`.
 */
function describeProfileUpdate(
  userName: string,
  changes: CapturedAttribute[],
  undoOfActionId: string | undefined,
  originalAttributeCount: number | undefined,
): string {
  if (undoOfActionId) {
    const total = originalAttributeCount ?? changes.length;
    return `Restored ${changes.length} of ${total} attribute${total !== 1 ? 's' : ''} on ${userName}`;
  }

  const names = changes.slice(0, DESCRIPTION_NAME_LIMIT).map((change) => change.name);
  const remaining = changes.length - names.length;
  const list = remaining > 0 ? `${names.join(', ')} and ${remaining} more` : names.join(', ');
  return `Updated ${list} on ${userName}`;
}

/** Options for {@link logProfileUpdateAction}. */
export interface ProfileUpdateLogOptions {
  /**
   * Id of the entry this write undoes, when it is an undo.
   *
   * Undo is a forward write, not a rollback — so it earns its own entry and this
   * is the link back to the original.
   */
  undoOfActionId?: string;
  /**
   * Outcome to record. Defaults to `'completed'`; pass `'partial'` when the
   * write's transport threw and the outcome is genuinely unknown, and `'failed'`
   * when Okta rejected it.
   */
  status?: UndoAction['status'];
  /**
   * For an undo, how many attributes the original entry touched, so a partial
   * restore can say "3 of 5". Defaults to the number of changes given.
   */
  originalAttributeCount?: number;
}

/**
 * Log a user-profile write, capturing prior state so it can later be restored.
 *
 * @param userId - The edited user.
 * @param userLogin - Their login at write time, so the row names a person.
 * @param userName - Their display name at write time.
 * @param changes - Every attribute the write touched, uncapped: the
 * {@link captureAttribute} policy is applied here so no caller can persist an
 * unbounded value by forgetting to.
 * @param options - See {@link ProfileUpdateLogOptions}.
 * @returns The stored {@link UndoAction}.
 * @remarks Nothing here is logged through the logger — attribute names and
 * values are tenant PII. They are *persisted* (that is the feature), but only
 * within the caps above, and never emitted to the console.
 */
export async function logProfileUpdateAction(
  userId: string,
  userLogin: string,
  userName: string,
  changes: AttributeChange[],
  options: ProfileUpdateLogOptions = {},
): Promise<UndoAction> {
  const captured = captureAttributes(changes);

  const metadata: UpdateUserProfileMetadata = {
    type: 'UPDATE_USER_PROFILE',
    userId,
    userLogin,
    userName,
    changes: captured,
    undoOfActionId: options.undoOfActionId,
  };

  const description = describeProfileUpdate(
    userName,
    captured,
    options.undoOfActionId,
    options.originalAttributeCount,
  );

  return logAction(description, metadata, options.status ?? 'completed');
}

/**
 * Mark an earlier action as undone.
 *
 * @param actionId - The entry that was undone.
 * @param undoneByActionId - The entry recording the undoing write.
 * @returns `true` when the entry was found and updated, `false` when it is no
 * longer in the history.
 * @remarks **`false` is not a failure.** The history is capped at
 * {@link MAX_UNDO_SIZE} entries, so the action being undone may have been
 * evicted between the original write and the undo. The undoing write still
 * succeeded and still has its own entry; only the bookkeeping target is gone.
 * Callers must not surface `false` as a failed undo.
 *
 * The pairing is recorded in both directions — `undoneByActionId` here and
 * `metadata.undoOfActionId` on the undoing entry — because the cap can evict
 * either side independently, and a row reading "Undone" should still be able to
 * point at the write that did it for as long as that write survives.
 */
export async function markActionUndone(
  actionId: string,
  undoneByActionId: string,
): Promise<boolean> {
  const history = await getUndoHistory();
  const action = history.actions.find((entry) => entry.id === actionId);

  if (!action) {
    // Identifiers and outcomes only.
    log.debug('Undone action no longer in history', { actionId, undoneByActionId });
    return false;
  }

  action.status = 'undone';
  action.undoneByActionId = undoneByActionId;
  await saveUndoHistory(history);
  return true;
}

/**
 * Clears the entire action history
 */
export async function clearUndoHistory(): Promise<void> {
  await saveUndoHistory({ actions: [], maxSize: MAX_UNDO_SIZE });
}

/**
 * Formats a timestamp as a relative time string
 */
export function formatActionTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}
