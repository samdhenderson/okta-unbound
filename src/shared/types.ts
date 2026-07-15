/**
 * @module shared/types
 * @description Central shared TypeScript types for the Okta Unbound extension.
 *
 * Covers Okta domain shapes (users, groups, rules, apps, MFA factors), the
 * side-panel↔background↔content message envelopes ({@link MessageRequest} /
 * {@link MessageResponse}), audit-trail records, and various UI view models.
 * These are hand-written interfaces; boundary validation lives in
 * `schemas/okta`, and undo/audit action types in
 * `shared/undoTypes`.
 *
 * @remarks `OktaUser.profile` and some responses use `any` for Okta's
 * org-extensible attributes; new code should prefer the zod-inferred types.
 */

/** An Okta user as returned by the Users API, with a partly-typed profile. */
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

/** Okta account lifecycle status. */
export type UserStatus =
  | 'ACTIVE'
  | 'DEPROVISIONED'
  | 'SUSPENDED'
  | 'STAGED'
  | 'PROVISIONED'
  | 'RECOVERY'
  | 'LOCKED_OUT'
  | 'PASSWORD_EXPIRED';

/** A single enrolled MFA factor (from `GET /api/v1/users/{id}/factors`). */
export interface OktaFactor {
  id: string;
  factorType: string; // e.g. "push", "signed_nonce", "token:software:totp", "sms", "webauthn"
  provider: string; // e.g. "OKTA", "GOOGLE", "FIDO"
  status: string; // "ACTIVE" | "PENDING_ACTIVATION" | "NOT_SETUP" | ...
}

/** State machine for a group-wide MFA enrollment scan. */
export type MfaScanStatus = 'idle' | 'confirming' | 'scanning' | 'complete' | 'error';

/** Per-member summary of enrolled MFA factors. Purely factual — no risk scoring. */
export interface MemberMfaResult {
  userId: string;
  factors: OktaFactor[];
  enrolled: boolean; // has >=1 ACTIVE non-password factor
  factorCount: number; // number of ACTIVE non-password factors
  factorLabels: string[]; // unique friendly labels of ACTIVE factors (e.g. "SMS", "Okta Verify (Fastpass)")
}

/** An Okta group (id, type, and name/description profile). */
export interface OktaGroup {
  id: string;
  type: GroupType;
  profile: {
    name: string;
    description?: string;
  };
}

/** How a group is sourced: native Okta, app-mastered, or built-in. */
export type GroupType = 'OKTA_GROUP' | 'APP_GROUP' | 'BUILT_IN';

/** A group rule as returned by the Okta Group Rules API. */
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

/** A rule's matching conditions: people include/exclude lists and/or an EL expression. */
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

/** A rule's actions — currently only assigning matched users to target groups. */
export interface RuleActions {
  assignUserToGroups?: {
    groupIds: string[];
  };
}

/** A detected conflict between two active rules that overlap on groups + attributes. */
export interface RuleConflict {
  rule1: { id: string; name: string };
  rule2: { id: string; name: string };
  /** Human-readable explanation of the overlap. */
  reason: string;
  /** Severity scaled by the number of shared target groups. */
  severity: 'high' | 'medium' | 'low';
  /** IDs of the groups both rules assign to. */
  affectedGroups: string[];
}

/** A rule shaped for UI display (simplified condition, extracted attrs, conflicts). */
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

/** Generic outcome of an Okta API call made in the content script. */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
}

/** Minimal group identity extracted from the current Okta page. */
export interface GroupInfo {
  groupId: string;
  groupName: string;
}

/** Minimal user identity extracted from the current Okta page. */
export interface UserInfo {
  userId: string;
  userName: string;
  userEmail?: string;
  userStatus?: UserStatus;
}

/** Minimal app identity extracted from the current Okta page. */
export interface AppInfo {
  appId: string;
  appName: string;
  appLabel?: string;
}

/** A user plus every group they belong to, for membership tracing. */
export interface UserMembershipTrace {
  userId: string;
  user: OktaUser;
  groups: GroupMembership[];
  totalGroups: number;
}

/**
 * A group rule as consumed by membership analysis and display. Either a raw
 * Okta rule (conditions/actions) or a formatted rule (groupIds/
 * conditionExpression/userAttributes) may be supplied, so the shape-specific
 * fields are optional.
 */
export interface MembershipRule {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  conditions?: RuleConditions;
  actions?: RuleActions;
  groupIds?: string[];
  conditionExpression?: string;
  userAttributes?: string[];
}

/** A single group membership, annotated with how it was granted. */
export interface GroupMembership {
  group: OktaGroup;
  membershipType: 'DIRECT' | 'RULE_BASED' | 'UNKNOWN';
  rule?: MembershipRule;
}

/**
 * Request envelope sent to the content script (and, for a subset, the
 * background scheduler). `action` selects the handler; the remaining fields are
 * per-action optional arguments.
 */
export interface MessageRequest {
  action:
    | 'getGroupInfo'
    | 'getUserInfo'
    | 'getAppInfo'
    | 'makeApiRequest'
    | 'exportGroupMembers'
    | 'fetchGroupRules'
    | 'searchUsers'
    | 'searchGroups'
    | 'getUserGroups'
    | 'getUserDetails'
    | 'getUserContext'
    | 'getOktaOrigin'
    | 'activateRule'
    | 'deactivateRule'
    | 'getAllGroups'
    | 'exportMultiGroupMembers';
  endpoint?: string;
  method?: string;
  body?: unknown;
  groupId?: string;
  groupName?: string;
  format?: 'csv' | 'json';
  statusFilter?: UserStatus | '';
  query?: string;
  userId?: string;
  ruleId?: string;
  groupIds?: string[];
}

/** Response envelope extending {@link ApiResponse} with rule/list extras. */
export interface MessageResponse<T = any> extends ApiResponse<T> {
  count?: number;
  rules?: OktaGroupRule[];
  formattedRules?: FormattedRule[];
  stats?: RuleStats;
  conflicts?: RuleConflict[];
}

/** Aggregate counts across a set of rules. */
export interface RuleStats {
  total: number;
  active: number;
  inactive: number;
  conflicts: number;
}

/** Callback invoked during long-running bulk operations to report progress. */
export interface ProgressCallback {
  (current: number, total: number, message?: string): void;
}

/** Severity/kind of a user-facing result message. */
export type ResultType = 'info' | 'success' | 'warning' | 'error';

// Re-export undo types for convenience
export type { UndoAction, UndoActionMetadata, UndoHistory } from './undoTypes';

/** A persisted audit-trail record of one completed operation. */
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

/** Optional filters for querying the audit trail. */
export interface AuditFilters {
  groupId?: string;
  action?: AuditLogEntry['action'];
  startDate?: Date;
  endDate?: Date;
  result?: AuditLogEntry['result'];
  performedBy?: string;
}

/** Aggregate statistics computed over the audit trail. */
export interface AuditStats {
  totalOperations: number;
  operationsByType: Record<string, number>;
  successRate: number;
  totalUsersAffected: number;
  totalApiRequests: number;
  lastWeekOperations: number;
}

/** User-configurable audit logging settings. */
export interface AuditSettings {
  enabled: boolean;
  retentionDays: number;
}

/** A push-group mapping linking a source Okta group to an app's target group. */
export interface PushGroupMapping {
  mappingId: string;
  sourceUserGroupId: string;
  targetGroupName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'UNLINKED';
  appId: string;
  appName?: string;
}

/** Heuristic staleness score for a group and the factors that contributed. */
export interface StalenessInfo {
  score: number; // 0-100 (100 = most stale)
  factors: string[];
}

/** Result of comparing membership across multiple groups. */
export interface GroupComparisonResult {
  groups: Array<{ id: string; name: string; memberCount: number }>;
  intersection: string[]; // user IDs in ALL groups
  uniqueMembers: Record<string, string[]>; // groupId -> user IDs only in that group
  totalUniqueUsers: number;
}

/** A user-saved, named collection of groups. */
export interface GroupCollection {
  id: string;
  name: string;
  description?: string;
  groupIds: string[];
  createdAt: number;
  updatedAt: number;
}

/** Enriched group row for the group-browse UI (counts, rules, staleness, source app). */
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
  pushMappings?: PushGroupMapping[];
  staleness?: StalenessInfo;
}

/** A queued/running multi-group bulk operation and its per-group results. */
export interface BulkOperation {
  id: string;
  type: 'remove_user' | 'add_user' | 'cleanup_inactive' | 'export_all';
  targetGroups: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  results: BulkOperationResult[];
  config?: { userId?: string };
}

/** Outcome of a bulk operation against a single group. */
export interface BulkOperationResult {
  groupId: string;
  groupName: string;
  status: 'success' | 'failed';
  itemsProcessed: number;
  errors?: string[];
}

/** A user paired with their annotated group memberships. */
export interface UserGroupMemberships {
  user: OktaUser;
  groups: GroupMembership[];
}

/** Cached group-browse list with its capture timestamp. */
export interface GroupsCache {
  groups: GroupSummary[];
  timestamp: number;
}

/** Minimal Okta application, kept for resolving APP_GROUP sources. */
export interface OktaApp {
  id: string;
  name: string;
  label: string;
  status: 'ACTIVE' | 'INACTIVE';
  created: string;
  lastUpdated: string;
  signOnMode?: string;
}
