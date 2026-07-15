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
  | 'CONSOLIDATE_RULE';

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
}

/** Discriminated union of per-action metadata, keyed on `type`. */
export type UndoActionMetadata =
  | RemoveUserMetadata
  | AddUserMetadata
  | BulkRemoveUsersMetadata
  | BulkAddUsersMetadata
  | ActivateRuleMetadata
  | DeactivateRuleMetadata
  | ConsolidateRuleMetadata;

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

/** The persisted history container: recent actions plus its size cap. */
export interface UndoHistory {
  actions: UndoAction[];
  maxSize: number;
}
