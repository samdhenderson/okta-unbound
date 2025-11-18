// Shared TypeScript types for the Okta Unbound extension

export interface OktaUser {
  id: string;
  status: UserStatus;
  profile: {
    login: string;
    email: string;
    firstName: string;
    lastName: string;
    department?: string;
    title?: string;
    [key: string]: any;
  };
}

export type UserStatus =
  | 'ACTIVE'
  | 'DEPROVISIONED'
  | 'SUSPENDED'
  | 'STAGED'
  | 'PROVISIONED'
  | 'RECOVERY'
  | 'LOCKED_OUT'
  | 'PASSWORD_EXPIRED';

export interface OktaGroup {
  id: string;
  type: GroupType;
  profile: {
    name: string;
    description?: string;
  };
}

export type GroupType = 'OKTA_GROUP' | 'APP_GROUP' | 'BUILT_IN';

// Comprehensive Okta Group Rule types
export interface OktaGroupRule {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  type: string;
  created: string;
  lastUpdated: string;
  conditions?: RuleConditions;
  actions?: RuleActions;
  allGroupsValid?: boolean;
}

export interface RuleConditions {
  people?: {
    users?: {
      exclude?: string[];
    };
    groups?: {
      exclude?: string[];
      include?: string[];
    };
  };
  expression?: {
    value: string;
    type: string;
  };
}

export interface RuleActions {
  assignUserToGroups?: {
    groupIds: string[];
  };
}

export interface RuleConflict {
  rule1: {
    id: string;
    name: string;
  };
  rule2: {
    id: string;
    name: string;
  };
  reason: string;
  severity: 'high' | 'medium' | 'low';
  affectedGroups: string[];
}

export interface FormattedRule {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  condition: string;
  conditionExpression?: string;
  groupIds: string[];
  groupNames?: string[];
  userAttributes: string[];
  created: string;
  lastUpdated: string;
  affectsCurrentGroup?: boolean;
  conflicts?: RuleConflict[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
}

export interface GroupInfo {
  groupId: string;
  groupName: string;
}

// User Membership Tracing types
export interface UserMembershipTrace {
  userId: string;
  user: OktaUser;
  groups: GroupMembership[];
  totalGroups: number;
}

export interface GroupMembership {
  group: OktaGroup;
  membershipType: 'DIRECT' | 'RULE_BASED' | 'UNKNOWN';
  rule?: OktaGroupRule;
  addedDate?: string;
}

export interface MessageRequest {
  action: 'getGroupInfo' | 'makeApiRequest' | 'exportGroupMembers' | 'fetchGroupRules' | 'searchUsers' | 'getUserGroups' | 'getUserDetails' | 'getOktaOrigin' | 'activateRule' | 'deactivateRule';
  endpoint?: string;
  method?: string;
  body?: any;
  groupId?: string;
  groupName?: string;
  format?: 'csv' | 'json';
  statusFilter?: UserStatus | '';
  query?: string;
  userId?: string;
  ruleId?: string;
}

export interface MessageResponse<T = any> extends ApiResponse<T> {
  count?: number;
  rules?: OktaGroupRule[];
  formattedRules?: FormattedRule[];
  stats?: RuleStats;
  conflicts?: RuleConflict[];
}

export interface RuleStats {
  total: number;
  active: number;
  inactive: number;
  conflicts: number;
}

// API Cost Calculation types
export interface ApiCostEstimate {
  description: string;
  totalRequests: number;
  breakdown: {
    fetch: number;
    modify: number;
  };
  isExact: boolean;
}

export interface ProgressCallback {
  (current: number, total: number, message?: string): void;
}

export type ResultType = 'info' | 'success' | 'warning' | 'error';

// Re-export undo types for convenience
export type { UndoAction, UndoActionMetadata, UndoHistory, UndoResult } from './undoTypes';
