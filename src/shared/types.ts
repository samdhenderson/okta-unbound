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
  action: 'getGroupInfo' | 'makeApiRequest' | 'exportGroupMembers' | 'fetchGroupRules' | 'searchUsers' | 'getUserGroups' | 'getUserDetails' | 'getOktaOrigin' | 'activateRule' | 'deactivateRule' | 'getAllGroups' | 'exportMultiGroupMembers';
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
  groupIds?: string[]; // For multi-group operations
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

// Dashboard types
export interface GroupHealthMetrics {
  totalUsers: number;
  statusBreakdown: Record<UserStatus, number>;
  membershipSources: { direct: number; ruleBased: number };
  riskScore: number; // 0-100
  riskFactors: string[];
  lastCleanup: Date | null;
  daysSinceCleanup: number | null;
  trends: { membershipChange30d: number; newUsersThisWeek: number };
}

export interface DashboardCache {
  metrics: GroupHealthMetrics;
  timestamp: number;
  groupId: string;
}

// Audit Trail types for SOC2 compliance
export interface AuditLogEntry {
  id: string; // UUID
  timestamp: Date;
  action: 'remove_users' | 'add_users' | 'export' | 'activate_rule' | 'deactivate_rule';
  groupId: string;
  groupName: string;
  performedBy: string; // Okta user email from session
  affectedUsers: string[]; // User IDs (not emails for privacy)
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
  retentionDays: number; // 30, 60, 90, 180, 365
}

// Security Posture Analysis types
export interface OrphanedAccount {
  userId: string;
  email: string;
  status: UserStatus;
  lastLogin: Date | null;
  daysSinceLogin: number | null;
  neverLoggedIn: boolean;
  groupMemberships: number;
  appAssignments: number;
  orphanReason: 'never_logged_in' | 'inactive_90d' | 'inactive_180d' | 'no_apps' | 'deprovisioned_in_groups';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  addedToGroupDate?: Date;
  membershipSource: 'direct' | 'rule-based';
  firstName: string;
  lastName: string;
}

export interface StaleGroupMembership {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  addedDate: Date | null;
  daysInGroup: number | null;
  source: 'direct' | 'rule-based';
  lastAppUsage: Date | null;
  shouldReview: boolean;
  matchesRules: boolean; // Whether user still matches current group rules
}

export interface SecurityPosture {
  overallScore: number; // 0-100
  findings: SecurityFinding[];
  recommendations: SecurityRecommendation[];
  lastScanDate: Date;
  groupId: string;
  groupName: string;
}

export interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'orphaned_accounts' | 'stale_memberships' | 'rule_conflicts' | 'permission_anomalies';
  count: number;
  description: string;
  affectedUsers?: string[];
}

export interface SecurityRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  relatedFinding?: string;
}

export interface SecurityScanCache {
  posture: SecurityPosture;
  orphanedAccounts: OrphanedAccount[];
  staleMemberships: StaleGroupMembership[];
  timestamp: number;
  groupId: string;
}

export interface OktaUserWithLastLogin extends OktaUser {
  lastLogin?: string | null;
  created?: string;
}

// Multi-Group Operations types
export interface GroupSummary {
  id: string;
  name: string;
  description?: string;
  type: GroupType;
  memberCount: number;
  lastUpdated?: Date;
  hasRules: boolean;
  ruleCount: number;
  healthScore?: number;
  selected?: boolean; // for multi-select UI
}

export interface GroupCollection {
  id: string;
  name: string;
  description: string;
  groupIds: string[];
  createdAt: Date;
  lastUsed: Date;
}

export interface CrossGroupAnalysis {
  totalGroups: number;
  totalUniqueUsers: number;
  usersInMultipleGroups: number;
  groupOverlaps: GroupOverlap[];
  userDistribution: Map<string, string[]>; // userId -> groupIds
}

export interface GroupOverlap {
  group1: GroupSummary;
  group2: GroupSummary;
  sharedUsers: number;
  uniqueToGroup1: number;
  uniqueToGroup2: number;
}

export interface BulkOperation {
  id: string;
  type: 'remove_user' | 'add_user' | 'cleanup_inactive' | 'export_all' | 'security_scan';
  targetGroups: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  results: BulkOperationResult[];
  config?: any; // Operation-specific configuration
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

export interface CollectionsCache {
  collections: GroupCollection[];
}
