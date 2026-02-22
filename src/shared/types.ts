// Shared TypeScript types for the Okta Unbound extension

export interface OktaUser {
  id: string;
  status: UserStatus;
  created?: string;
  activated?: string;
  statusChanged?: string;
  lastLogin?: string | null;
  lastUpdated?: string;
  passwordChanged?: string | null;
  managedBy?: {
    rules?: Array<{
      id: string;
      name: string;
    }>;
  };
  profile: {
    login: string;
    email: string;
    firstName: string;
    lastName: string;
    secondEmail?: string;
    mobilePhone?: string;
    primaryPhone?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    countryCode?: string;
    department?: string;
    title?: string;
    manager?: string;
    managerId?: string;
    division?: string;
    organization?: string;
    costCenter?: string;
    employeeNumber?: string;
    userType?: string;
    locale?: string;
    timezone?: string;
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

// Group Rule types
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
  rule1: { id: string; name: string };
  rule2: { id: string; name: string };
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
  allGroupNamesMap?: Record<string, string>;
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

export interface UserInfo {
  userId: string;
  userName: string;
  userEmail?: string;
  userStatus?: UserStatus;
}

export interface AppInfo {
  appId: string;
  appName: string;
  appLabel?: string;
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
}

export interface MessageRequest {
  action: 'getGroupInfo' | 'getUserInfo' | 'getAppInfo' | 'makeApiRequest' | 'exportGroupMembers' | 'fetchGroupRules' | 'searchUsers' | 'searchGroups' | 'getUserGroups' | 'getUserDetails' | 'getUserContext' | 'getOktaOrigin' | 'activateRule' | 'deactivateRule' | 'getAllGroups' | 'exportMultiGroupMembers';
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
  groupIds?: string[];
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

export interface ProgressCallback {
  (current: number, total: number, message?: string): void;
}

export type ResultType = 'info' | 'success' | 'warning' | 'error';

// Re-export undo types for convenience
export type { UndoAction, UndoActionMetadata, UndoHistory } from './undoTypes';

// Audit Trail types
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: 'remove_users' | 'add_users' | 'export' | 'activate_rule' | 'deactivate_rule';
  groupId: string;
  groupName: string;
  performedBy: string;
  affectedUsers: string[];
  result: 'success' | 'partial' | 'failed';
  details: {
    usersSucceeded: number;
    usersFailed: number;
    apiRequestCount: number;
    durationMs: number;
    errorMessages?: string[];
  };
}

export interface AuditFilters {
  groupId?: string;
  action?: AuditLogEntry['action'];
  startDate?: Date;
  endDate?: Date;
  result?: AuditLogEntry['result'];
  performedBy?: string;
}

export interface AuditStats {
  totalOperations: number;
  operationsByType: Record<string, number>;
  successRate: number;
  totalUsersAffected: number;
  totalApiRequests: number;
  lastWeekOperations: number;
}

export interface AuditSettings {
  enabled: boolean;
  retentionDays: number;
}

// Group Browse types
export interface GroupSummary {
  id: string;
  name: string;
  description?: string;
  type: GroupType;
  memberCount: number;
  lastUpdated?: Date;
  lastMembershipUpdated?: Date;
  hasRules: boolean;
  ruleCount: number;
  selected?: boolean;
  sourceAppId?: string;
  sourceAppName?: string;
  created?: Date;
}

export interface BulkOperation {
  id: string;
  type: 'remove_user' | 'add_user' | 'cleanup_inactive' | 'export_all';
  targetGroups: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  results: BulkOperationResult[];
  config?: any;
}

export interface BulkOperationResult {
  groupId: string;
  groupName: string;
  status: 'success' | 'failed';
  itemsProcessed: number;
  errors?: string[];
}

export interface UserGroupMemberships {
  user: OktaUser;
  groups: GroupMembership[];
}

export interface GroupsCache {
  groups: GroupSummary[];
  timestamp: number;
}

// Basic OktaApp type (kept for APP_GROUP source resolution)
export interface OktaApp {
  id: string;
  name: string;
  label: string;
  status: 'ACTIVE' | 'INACTIVE';
  created: string;
  lastUpdated: string;
  signOnMode?: string;
}
