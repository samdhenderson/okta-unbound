// Undo Framework Types
// Defines all action types and their undo metadata

export type ActionType =
  | 'REMOVE_USER_FROM_GROUP'
  | 'ADD_USER_TO_GROUP'
  | 'BULK_REMOVE_USERS_FROM_GROUP'
  | 'BULK_ADD_USERS_TO_GROUP'
  | 'ACTIVATE_RULE'
  | 'DEACTIVATE_RULE';

export interface UndoAction {
  id: string; // Unique ID for this action
  type: ActionType;
  timestamp: number;
  description: string; // Human-readable description of the action
  metadata: UndoActionMetadata;
  status: 'completed' | 'undone' | 'failed' | 'partial';
}

export type UndoActionMetadata =
  | RemoveUserMetadata
  | AddUserMetadata
  | BulkRemoveUsersMetadata
  | BulkAddUsersMetadata
  | ActivateRuleMetadata
  | DeactivateRuleMetadata;

export interface RemoveUserMetadata {
  type: 'REMOVE_USER_FROM_GROUP';
  userId: string;
  userEmail: string;
  userName: string;
  groupId: string;
  groupName: string;
}

export interface AddUserMetadata {
  type: 'ADD_USER_TO_GROUP';
  userId: string;
  userEmail: string;
  userName: string;
  groupId: string;
  groupName: string;
}

// Bulk action metadata - stores info about multiple users
export interface BulkUserInfo {
  userId: string;
  userEmail: string;
  userName: string;
}

export interface BulkRemoveUsersMetadata {
  type: 'BULK_REMOVE_USERS_FROM_GROUP';
  users: BulkUserInfo[];
  groupId: string;
  groupName: string;
  operationType: 'deprovisioned' | 'inactive' | 'custom_status';
  targetStatus?: string; // For custom status operations
}

export interface BulkAddUsersMetadata {
  type: 'BULK_ADD_USERS_TO_GROUP';
  users: BulkUserInfo[];
  groupId: string;
  groupName: string;
}

export interface ActivateRuleMetadata {
  type: 'ACTIVATE_RULE';
  ruleId: string;
  ruleName: string;
}

export interface DeactivateRuleMetadata {
  type: 'DEACTIVATE_RULE';
  ruleId: string;
  ruleName: string;
}

export interface UndoHistory {
  actions: UndoAction[];
  maxSize: number;
}

export interface UndoResult {
  success: boolean;
  error?: string;
  actionUndone?: UndoAction;
}
