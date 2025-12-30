// Undo Framework Types
// Defines all action types and their undo metadata

export type ActionType =
  | 'REMOVE_USER_FROM_GROUP'
  | 'ADD_USER_TO_GROUP'
  | 'BULK_REMOVE_USERS_FROM_GROUP'
  | 'BULK_ADD_USERS_TO_GROUP'
  | 'ACTIVATE_RULE'
  | 'DEACTIVATE_RULE'
  | 'BULK_ACTIVATE_RULES'
  | 'BULK_DEACTIVATE_RULES'
  | 'REMOVE_USER_FROM_APP'
  | 'REMOVE_GROUP_FROM_APP'
  | 'BULK_REMOVE_USERS_FROM_APP'
  | 'BULK_REMOVE_GROUPS_FROM_APP'
  | 'CONVERT_USER_TO_GROUP_ASSIGNMENT';

// Sub-item status for bulk operations
export type SubItemStatus = 'completed' | 'undone' | 'failed' | 'skipped';

// Sub-item for bulk actions - tracks individual items within a bulk operation
export interface BulkActionSubItem {
  id: string; // Unique ID for this sub-item
  status: SubItemStatus;
  timestamp?: number; // When this specific item was undone (if applicable)
}

export interface UndoAction {
  id: string; // Unique ID for this action
  type: ActionType;
  timestamp: number;
  description: string; // Human-readable description of the action
  metadata: UndoActionMetadata;
  status: 'completed' | 'undone' | 'failed' | 'partial';
  subItems?: BulkActionSubItem[]; // For bulk operations, tracks individual item states
}

export type UndoActionMetadata =
  | RemoveUserMetadata
  | AddUserMetadata
  | BulkRemoveUsersMetadata
  | BulkAddUsersMetadata
  | ActivateRuleMetadata
  | DeactivateRuleMetadata
  | BulkActivateRulesMetadata
  | BulkDeactivateRulesMetadata
  | RemoveUserFromAppMetadata
  | RemoveGroupFromAppMetadata
  | BulkRemoveUsersFromAppMetadata
  | BulkRemoveGroupsFromAppMetadata
  | ConvertUserToGroupAssignmentMetadata;

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
  operationType: 'deprovisioned' | 'inactive' | 'custom_status' | 'multi_status';
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

// Bulk rule operations
export interface BulkRuleInfo {
  ruleId: string;
  ruleName: string;
}

export interface BulkActivateRulesMetadata {
  type: 'BULK_ACTIVATE_RULES';
  rules: BulkRuleInfo[];
}

export interface BulkDeactivateRulesMetadata {
  type: 'BULK_DEACTIVATE_RULES';
  rules: BulkRuleInfo[];
}

// App assignment operations
export interface RemoveUserFromAppMetadata {
  type: 'REMOVE_USER_FROM_APP';
  userId: string;
  userEmail: string;
  userName: string;
  appId: string;
  appName: string;
}

export interface RemoveGroupFromAppMetadata {
  type: 'REMOVE_GROUP_FROM_APP';
  groupId: string;
  groupName: string;
  appId: string;
  appName: string;
}

export interface BulkAppUserInfo {
  userId: string;
  userEmail: string;
  userName: string;
}

export interface BulkRemoveUsersFromAppMetadata {
  type: 'BULK_REMOVE_USERS_FROM_APP';
  users: BulkAppUserInfo[];
  appId: string;
  appName: string;
}

export interface BulkAppGroupInfo {
  groupId: string;
  groupName: string;
}

export interface BulkRemoveGroupsFromAppMetadata {
  type: 'BULK_REMOVE_GROUPS_FROM_APP';
  groups: BulkAppGroupInfo[];
  appId: string;
  appName: string;
}

// App assignment conversion
export interface ConversionAppInfo {
  appId: string;
  appName: string;
  profileData?: Record<string, any>;
}

export interface ConvertUserToGroupAssignmentMetadata {
  type: 'CONVERT_USER_TO_GROUP_ASSIGNMENT';
  userId: string;
  userEmail: string;
  userName: string;
  targetGroupId: string;
  targetGroupName: string;
  apps: ConversionAppInfo[]; // List of apps that were converted
  userAssignmentsRemoved: boolean; // Whether user assignments were removed
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
