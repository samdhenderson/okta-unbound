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
  allGroupNamesMap?: Record<string, string>; // Map of all group IDs (in conditions and targets) to names
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
  /**
   * @deprecated Not available from Okta API - always undefined.
   * Okta does not expose when a user was added to a group.
   * See OKTA_API_LIMITATIONS.md §1 for details.
   */
  addedDate?: string;
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
  /** Note: Requires O(N) API calls to populate - may show 0 for performance */
  groupMemberships: number;
  /** Note: Requires O(N) API calls to populate - may show 0 for performance */
  appAssignments: number;
  orphanReason: 'never_logged_in' | 'inactive_90d' | 'inactive_180d' | 'no_apps' | 'deprovisioned_in_groups';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  /**
   * @deprecated Not available from Okta API - always undefined.
   * Okta does not expose when a user was added to a group.
   * See OKTA_API_LIMITATIONS.md §1 for details.
   */
  addedToGroupDate?: Date;
  /**
   * Heuristic approximation - may not be 100% accurate.
   * See OKTA_API_LIMITATIONS.md §2 for details.
   */
  membershipSource: 'direct' | 'rule-based';
  firstName: string;
  lastName: string;
}

export interface StaleGroupMembership {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  /**
   * User's Okta account creation date (NOT when added to group).
   * Okta API does not provide group membership timestamps.
   * See OKTA_API_LIMITATIONS.md §1 for details.
   */
  userCreatedDate: Date | null;
  /**
   * Days since user was created in Okta (NOT days in group).
   * Used as a proxy for membership age when actual timestamp unavailable.
   */
  daysSinceCreated: number | null;
  /**
   * Heuristic approximation - may not be accurate.
   * See OKTA_API_LIMITATIONS.md §2 for details.
   */
  source: 'direct' | 'rule-based';
  /**
   * @deprecated Not available from Okta API - always null.
   * See OKTA_API_LIMITATIONS.md §6 for details.
   */
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
  // Push group related fields
  sourceAppId?: string; // For APP_GROUP: the source app ID
  sourceAppName?: string; // For APP_GROUP: the source app name
  linkedGroups?: LinkedGroup[]; // For merged display: linked OKTA/APP groups
  isPushGroup?: boolean; // True if this OKTA_GROUP has linked APP_GROUPs
  // Staleness detection fields
  created?: Date;
  lastMembershipUpdated?: Date;
  stalenessScore?: number; // 0-100 (higher = more stale)
  stalenessReasons?: string[]; // Why group is considered stale
  isStale?: boolean; // True if staleness score > threshold
}

// Linked group info for push group merging
export interface LinkedGroup {
  id: string;
  name: string;
  type: GroupType;
  sourceAppId?: string;
  sourceAppName?: string;
  memberCount: number;
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

// ========================================
// App Assignment Types
// ========================================

export interface OktaApp {
  id: string;
  name: string;
  label: string;
  status: 'ACTIVE' | 'INACTIVE';
  created: string;
  lastUpdated: string;
  signOnMode?: string;
  features?: string[];
  settings?: {
    app?: Record<string, any>;
    notifications?: Record<string, any>;
    signOn?: Record<string, any>;
    [key: string]: any;
  };
  credentials?: {
    scheme?: string;
    userNameTemplate?: Record<string, any>;
    [key: string]: any;
  };
  _links?: Record<string, any>;
}

// Base assignment interface with dynamic schema support
export interface AppAssignment {
  id: string;
  appId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DEPROVISIONED';
  created: string;
  lastUpdated: string;
  statusChanged?: string;
  // Scope indicates if this is a user or group assignment
  scope: 'USER' | 'GROUP';
  // Dynamic profile - can contain any app-specific attributes
  profile?: Record<string, any>;
  // Dynamic credentials - can vary by app
  credentials?: {
    scheme?: string;
    userName?: string;
    password?: string;
    [key: string]: any;
  };
  // Embedded app details (when expanded)
  _embedded?: {
    app?: OktaApp;
    user?: OktaUser;
    group?: OktaGroup;
  };
  _links?: Record<string, any>;
}

export interface UserAppAssignment extends AppAssignment {
  scope: 'USER';
  userId?: string;
  externalId?: string;
  syncState?: 'DISABLED' | 'OUT_OF_SYNC' | 'SYNCING' | 'SYNCHRONIZED' | 'ERROR';
  lastSync?: string;
  passwordChanged?: string;
}

export interface GroupAppAssignment extends AppAssignment {
  scope: 'GROUP';
  groupId?: string;
  priority: number; // Priority of the group assignment (lower = higher priority)
  // Profile for group assignment may include default values for all members
  profile?: Record<string, any>;
}

// Extended app info with assignment counts
export interface AppWithAssignments extends OktaApp {
  userAssignments?: number;
  groupAssignments?: number;
  totalAssignments?: number;
}

// App summary for browse list view with enriched metadata
export interface AppSummary extends OktaApp {
  // Assignment counts
  userAssignmentCount: number;
  groupAssignmentCount: number;
  totalAssignmentCount: number;

  // App type classification
  appType: 'SAML_2_0' | 'SAML_1_1' | 'OPENID_CONNECT' | 'WS_FEDERATION' | 'SWA' | 'BROWSER_PLUGIN' | 'BOOKMARK' | 'API_SERVICE' | 'OTHER';

  // Provisioning info
  provisioningStatus: 'ENABLED' | 'DISABLED' | 'NOT_SUPPORTED';
  provisioningType?: 'SCIM' | 'PROFILE_MASTERING' | 'IMPORT';

  // Push groups
  pushGroupsEnabled: boolean;
  pushGroupsCount?: number;
  pushGroupsErrors?: number;

  // SAML certificate (for SAML apps)
  certStatus?: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_APPLICABLE';
  certExpiresAt?: string;
  certDaysRemaining?: number;

  // Additional metadata
  lastUserAssigned?: string;
  lastGroupAssigned?: string;
  hasActiveUsers: boolean;
  hasInactiveUsers: boolean;
}

// For assignment creation/updates
export interface CreateAppAssignmentRequest {
  id?: string; // User ID or Group ID
  scope?: 'USER' | 'GROUP';
  profile?: Record<string, any>;
  credentials?: {
    userName?: string;
    password?: string;
    [key: string]: any;
  };
  priority?: number; // For group assignments
}

// User-to-Group Assignment Converter types
export interface AssignmentConversionRequest {
  userId: string;
  targetGroupId: string;
  appIds: string[]; // Apps to convert
  removeUserAssignment: boolean; // Whether to remove original user assignment
  mergeStrategy: 'preserve_user' | 'prefer_user' | 'prefer_default'; // How to handle profile differences
}

export interface AssignmentConversionResult {
  appId: string;
  appName: string;
  success: boolean;
  userAssignment?: UserAppAssignment;
  groupAssignment?: GroupAppAssignment;
  profileChanges?: ProfileComparison;
  error?: string;
  userAssignmentRemoved?: boolean;
}

export interface ProfileComparison {
  userProfile: Record<string, any>;
  groupProfile: Record<string, any>;
  differences: ProfileDifference[];
  credentialsHandled: boolean;
  /** Indicates if the profile contains array fields (e.g., Salesforce permission sets) */
  hasArrayFields?: boolean;
  /** Indicates if the profile contains nested object fields */
  hasNestedObjects?: boolean;
}

export interface ProfileDifference {
  field: string;
  userValue: any;
  groupValue: any;
  merged?: any; // The value that was actually used
}

// Bulk Group-to-App Assignment types
export interface BulkAppAssignmentRequest {
  groupIds: string[];
  appIds: string[];
  priority?: number;
  profile?: Record<string, any>; // Default profile for all assignments
  perAppProfiles?: Record<string, Record<string, any>>; // App-specific profiles
}

export interface BulkAppAssignmentResult {
  totalOperations: number;
  successful: number;
  failed: number;
  results: AppAssignmentOperationResult[];
}

export interface AppAssignmentOperationResult {
  groupId: string;
  groupName: string;
  appId: string;
  appName: string;
  success: boolean;
  assignment?: GroupAppAssignment;
  error?: string;
}

// App Assignment Viewer types
export interface UserAppAssignmentView {
  userId: string;
  userEmail: string;
  userName: string;
  apps: AppAssignmentDetail[];
  totalApps: number;
  directAssignments: number;
  groupBasedAssignments: number;
}

export interface GroupAppAssignmentView {
  groupId: string;
  groupName: string;
  apps: AppAssignmentDetail[];
  totalApps: number;
  assignmentsByPriority: Map<number, number>;
}

export interface AppAssignmentDetail {
  app: OktaApp;
  assignment: AppAssignment;
  assignmentType: 'direct' | 'group' | 'rule';
  sourceGroups?: GroupInfo[]; // For group-based assignments
  profileSchema?: AppProfileSchema;
  hasCustomProfile: boolean;
  hasCredentials: boolean;
}

// Dynamic profile schema information
export interface AppProfileSchema {
  definitions?: Record<string, any>;
  properties?: Record<string, AppProfileProperty>;
  required?: string[];
  type?: string;
}

export interface AppProfileProperty {
  title?: string;
  type?: string;
  description?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  enum?: any[];
  format?: string;
  permissions?: Array<{
    principal: string;
    action: string;
  }>;
  [key: string]: any;
}

// App Assignment Audit & Security Analysis types
export interface AppAssignmentSecurityAnalysis {
  groupId?: string;
  userId?: string;
  findings: AppSecurityFinding[];
  overProvisionedUsers: OverProvisionedUser[];
  orphanedAppAssignments: OrphanedAppAssignment[];
  redundantAssignments: RedundantAssignment[];
  assignmentTypeDistribution: AssignmentTypeDistribution;
  totalAppsAnalyzed: number;
  riskScore: number; // 0-100
}

export interface AppSecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'over_provisioned' | 'orphaned' | 'redundant' | 'missing_group' | 'stale_credential';
  title: string;
  description: string;
  affectedUsers: string[];
  affectedApps: string[];
  recommendation: string;
}

export interface OverProvisionedUser {
  userId: string;
  userEmail: string;
  userName: string;
  directAppAssignments: number;
  groupBasedAppAssignments: number;
  appsWithBothTypes: string[]; // Apps where user has both direct and group assignment
  suggestedRemoval: string[]; // App IDs that should be removed (direct assignment)
}

export interface OrphanedAppAssignment {
  userId: string;
  userEmail: string;
  userName: string;
  userStatus: UserStatus;
  appId: string;
  appName: string;
  assignment: UserAppAssignment;
  reason: 'user_deprovisioned' | 'user_inactive' | 'no_group_membership' | 'never_used';
  daysSinceLastUse?: number;
  recommendRemoval: boolean;
}

export interface RedundantAssignment {
  userId: string;
  userEmail: string;
  userName: string;
  appId: string;
  appName: string;
  directAssignment: UserAppAssignment;
  groupAssignments: Array<{
    group: OktaGroup;
    assignment: GroupAppAssignment;
  }>;
  profileDifferences: boolean;
  credentialsDifferent: boolean;
  recommendation: 'remove_direct' | 'remove_group' | 'keep_both';
}

export interface AssignmentTypeDistribution {
  totalAssignments: number;
  directAssignments: number;
  groupAssignments: number;
  ruleBasedAssignments: number;
  percentageDirect: number;
  percentageGroup: number;
  percentageRule: number;
}

// App-to-Group Assignment Recommender types
export interface AppAssignmentRecommendation {
  appId: string;
  appName: string;
  currentDirectAssignments: number;
  recommendedGroupAssignments: RecommendedGroupAssignment[];
  coverageAnalysis: CoverageAnalysis;
  estimatedReduction: number; // Percentage of direct assignments that could be replaced
  implementationPriority: 'high' | 'medium' | 'low';
}

export interface RecommendedGroupAssignment {
  group: OktaGroup;
  matchingUsers: number;
  percentageOfAppUsers: number;
  confidence: number; // 0-100, based on how many app users are in this group
  suggestedProfile?: Record<string, any>; // Recommended profile based on common user profiles
  suggestedPriority: number;
  rationale: string;
}

export interface CoverageAnalysis {
  totalAppUsers: number;
  usersCoveredByRecommendations: number;
  percentageCovered: number;
  usersStillNeedingDirectAssignment: string[];
  groupOverlaps: Array<{
    groups: string[];
    userCount: number;
  }>;
}

export interface AssignmentRecommenderResult {
  recommendations: AppAssignmentRecommendation[];
  overallStats: {
    totalAppsAnalyzed: number;
    totalDirectAssignments: number;
    potentialGroupAssignments: number;
    estimatedAssignmentReduction: number;
    estimatedMaintenanceReduction: number; // Percentage
  };
  topRecommendations: AppAssignmentRecommendation[]; // Top 10 by priority
}

// Message actions - extend existing MessageRequest
export type AppMessageAction =
  | 'getUserApps'
  | 'getGroupApps'
  | 'getAppUsers'
  | 'getAppGroups'
  | 'getAppDetails'
  | 'assignUserToApp'
  | 'assignGroupToApp'
  | 'removeUserFromApp'
  | 'removeGroupFromApp'
  | 'getUserAppAssignment'
  | 'getGroupAppAssignment'
  | 'updateUserAppAssignment'
  | 'updateGroupAppAssignment'
  | 'convertUserToGroupAssignment'
  | 'bulkAssignGroupsToApps'
  | 'analyzeAppSecurity'
  | 'getAppAssignmentRecommendations'
  | 'getAppSchema';

// Extend MessageRequest to include app-related actions
export interface AppMessageRequest extends Omit<MessageRequest, 'action'> {
  action: MessageRequest['action'] | AppMessageAction;
  appId?: string;
  appIds?: string[];
  assignmentData?: CreateAppAssignmentRequest;
  conversionRequest?: AssignmentConversionRequest;
  bulkAssignmentRequest?: BulkAppAssignmentRequest;
  includeSchema?: boolean;
  expand?: string; // For expanding related resources
}

// Audit log extensions for app operations
export type AppAuditAction =
  | 'assign_user_to_app'
  | 'assign_group_to_app'
  | 'remove_user_from_app'
  | 'remove_group_from_app'
  | 'convert_assignment'
  | 'bulk_app_assignment'
  | 'app_security_scan';

export interface AppAuditLogEntry extends Omit<AuditLogEntry, 'action'> {
  action: AuditLogEntry['action'] | AppAuditAction;
  appId?: string;
  appName?: string;
  affectedApps?: string[]; // For bulk operations
  conversionDetails?: {
    sourceType: 'user' | 'group';
    targetType: 'user' | 'group';
    assignmentsConverted: number;
  };
}
