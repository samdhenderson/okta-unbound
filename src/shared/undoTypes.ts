// Undo Framework Types
// Defines all action types and their undo metadata

export type ActionType =
  | 'REMOVE_USER_FROM_GROUP'
  | 'ADD_USER_TO_GROUP'
  | 'ACTIVATE_RULE'
  | 'DEACTIVATE_RULE';

export interface UndoAction {
  id: string; // Unique ID for this action
  type: ActionType;
  timestamp: number;
  description: string; // Human-readable description of the action
  metadata: UndoActionMetadata;
  status: 'completed' | 'undone' | 'failed';
}

export type UndoActionMetadata =
  | RemoveUserMetadata
  | AddUserMetadata
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
