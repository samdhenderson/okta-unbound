/**
 * @module shared/undoTypes
 * @description Type definitions for the undo/audit action history.
 *
 * Declares the recorded {@link ActionType}s, the discriminated
 * {@link UndoActionMetadata} union (keyed on `type`) carrying per-action detail,
 * and the {@link UndoHistory} container. Consumed by
 * `shared/undoManager`.
 */

/** The set of mutating operations tracked in the action history. */
export type ActionType =
  | 'REMOVE_USER_FROM_GROUP'
  | 'ADD_USER_TO_GROUP'
  | 'BULK_REMOVE_USERS_FROM_GROUP'
  | 'BULK_ADD_USERS_TO_GROUP'
  | 'ACTIVATE_RULE'
  | 'DEACTIVATE_RULE'
  | 'CONSOLIDATE_RULE'
  | 'UPDATE_USER_PROFILE';

/** A single recorded action in the history. */
export interface UndoAction {
  /** Unique action id. */
  id: string;
  /** Discriminator matching `UndoActionMetadata.type`. */
  type: ActionType;
  /** Epoch millis when the action was recorded. */
  timestamp: number;
  /** Human-readable summary for the history UI. */
  description: string;
  /** Typed, action-specific payload. */
  metadata: UndoActionMetadata;
  /** Lifecycle outcome of the action. */
  status: 'completed' | 'undone' | 'failed' | 'partial';
  /**
   * The entry recording the write that undid this one. Set together with
   * `status: 'undone'`.
   *
   * The pairing is stored in *both* directions — here, and on the undoing
   * entry's `metadata.undoOfActionId` — because either side can be evicted by
   * the 50-entry cap independently, and a row that says "Undone" should be able
   * to point at the write that did it for as long as that write survives.
   */
  undoneByActionId?: string;
}

/** Discriminated union of per-action metadata, keyed on `type`. */
export type UndoActionMetadata =
  | RemoveUserMetadata
  | AddUserMetadata
  | BulkRemoveUsersMetadata
  | BulkAddUsersMetadata
  | ActivateRuleMetadata
  | DeactivateRuleMetadata
  | ConsolidateRuleMetadata
  | UpdateUserProfileMetadata;

/** Metadata for removing a single user from a group. */
export interface RemoveUserMetadata {
  type: 'REMOVE_USER_FROM_GROUP';
  userId: string;
  userEmail: string;
  userName: string;
  groupId: string;
  groupName: string;
}

/** Metadata for adding a single user to a group. */
export interface AddUserMetadata {
  type: 'ADD_USER_TO_GROUP';
  userId: string;
  userEmail: string;
  userName: string;
  groupId: string;
  groupName: string;
}

/** Minimal per-user record captured for bulk operations. */
export interface BulkUserInfo {
  userId: string;
  userEmail: string;
  userName: string;
}

/** Metadata for a bulk user-removal action. */
export interface BulkRemoveUsersMetadata {
  type: 'BULK_REMOVE_USERS_FROM_GROUP';
  users: BulkUserInfo[];
  groupId: string;
  groupName: string;
  /** What drove the removal, used to phrase the action description. */
  operationType: 'deprovisioned' | 'inactive' | 'custom_status' | 'multi_status';
  /** Status filter used, for custom/multi-status removals. */
  targetStatus?: string;
}

/** Metadata for a bulk user-add action. */
export interface BulkAddUsersMetadata {
  type: 'BULK_ADD_USERS_TO_GROUP';
  users: BulkUserInfo[];
  groupId: string;
  groupName: string;
}

/** Metadata for activating a group rule. */
export interface ActivateRuleMetadata {
  type: 'ACTIVATE_RULE';
  ruleId: string;
  ruleName: string;
}

/** Metadata for deactivating a group rule. */
export interface DeactivateRuleMetadata {
  type: 'DEACTIVATE_RULE';
  ruleId: string;
  ruleName: string;
}

/** A retired rule's definition, captured so a consolidation can be restored. */
export interface RetiredRuleSnapshot {
  id: string;
  name: string;
  /** The match expression, for recreating the rule if needed. */
  expression: string;
  /** The rule's target group ids at retirement. */
  groupIds: string[];
}

/**
 * Metadata for a rule consolidation (A4): a new rule was created carrying the
 * union of target groups, and one or more source rules were retired (deleted).
 * The retired rules' definitions are captured so prior state can be restored.
 */
export interface ConsolidateRuleMetadata {
  type: 'CONSOLIDATE_RULE';
  /** Id of the newly created consolidated rule. */
  createdRuleId: string;
  /** Name of the newly created consolidated rule. */
  createdRuleName: string;
  /** Target group ids of the consolidated rule. */
  createdGroupIds: string[];
  /** The source rules that were deleted, with enough to recreate them. */
  retiredRules: RetiredRuleSnapshot[];
}

/**
 * Why a captured attribute cannot be restored.
 *
 * - `too-large` — the previous value exceeded {@link MAX_CAPTURED_VALUE_CHARS}.
 * - `too-many` — the edit changed more than {@link MAX_CAPTURED_ATTRIBUTES}
 *   attributes, and this one fell outside the cap.
 */
export type CaptureOmission = 'too-large' | 'too-many';

/**
 * One attribute changed by a profile write, with enough prior state to put it
 * back.
 *
 * **Values here are tenant PII in plaintext `chrome.storage.local`**, so the
 * capture is bounded on both axes and an over-cap value is dropped *entirely*
 * rather than truncated. A truncated prefix is still PII with none of the
 * utility, and restoring a truncated value would silently corrupt the attribute
 * — so `omitted` marks the change unrestorable instead. Never log these fields.
 */
export interface CapturedAttribute {
  /** The attribute's bare Okta name. */
  name: string;
  /** Its human label at capture time. */
  label: string;
  /**
   * The value before the write, stringified by `toDisplay`. **Absent** whenever
   * `omitted` is set — deliberately not an empty string, which would be
   * indistinguishable from a genuinely empty prior value.
   */
  beforeDisplay?: string;
  /** The untouched prior value, for the restoring write. Absent when `omitted` is set. */
  beforeRaw?: unknown;
  /** The value after the write, stringified. This is what a drift check compares against. */
  afterDisplay: string;
  /** `false` when prior state was not captured faithfully; the row says so and offers no restore. */
  restorable: boolean;
  /** Why prior state was not captured. Present iff `restorable` is `false`. */
  omitted?: CaptureOmission;
}

/**
 * Metadata for a user profile write.
 *
 * Carries prior state so undo can *restore* rather than merely record — the
 * requirement `docs/rockstar-parity-plan.md` places on every new write endpoint.
 */
export interface UpdateUserProfileMetadata {
  type: 'UPDATE_USER_PROFILE';
  userId: string;
  /** The user's login at write time, so the history row names a person. */
  userLogin: string;
  /** The user's display name at write time. */
  userName: string;
  /** Every attribute the write touched, in the order the modal listed them. */
  changes: CapturedAttribute[];
  /**
   * Set when this entry *is* an undo of an earlier one, naming that entry.
   *
   * Undo is a forward write, not a rollback — Okta has no rollback — so it earns
   * its own history entry rather than erasing the original. This is the link
   * between the two.
   */
  undoOfActionId?: string;
}

/** The persisted history container: recent actions plus its size cap. */
export interface UndoHistory {
  actions: UndoAction[];
  maxSize: number;
}
