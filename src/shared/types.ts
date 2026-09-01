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

import type { SchedulerState, SchedulerMetrics } from './scheduler/types';
import type { PlanEstimate, PlanLegInput } from './scheduler/plan';

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
  /**
   * How the *account* is mastered, as opposed to how one attribute is.
   *
   * `provider.type` is `'OKTA'` when Okta owns the credential, or
   * `'ACTIVE_DIRECTORY'` / `'IMPORT'` / `'FEDERATION'` when an external directory
   * does. This is the signal that decides whether `login` may be edited — a
   * per-attribute `master` block cannot answer it, because `login` is a
   * credential, not a profile attribute.
   *
   * Deliberately narrow: Okta also returns `credentials.password` and
   * `credentials.recovery_question` on this object, and the zod schema strips
   * them at the boundary rather than carrying credential material into state.
   */
  credentials?: {
    provider?: {
      type?: string;
      name?: string;
    };
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
    // Okta custom profile attributes are org-defined and arbitrarily-typed JSON;
    // this index signature is the extension point (validated at the zod boundary).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  /**
   * User ids the rule explicitly excludes (`conditions.people.users.exclude` on
   * the raw rule). Carried through the formatter because the user-path
   * membership classifier only ever sees this shape: without it,
   * `membershipAnalysis.isUserExcludedFromRule` cannot tell that a rule excludes
   * the very user it is being credited for, and the row hedges `Rule?` where the
   * truth is `Direct` (D-048).
   */
  excludedUserIds?: string[];
  /**
   * Target group ids with no group behind them — a rule assigning users into a
   * group the org no longer has (D-061).
   *
   * `undefined` and `[]` mean different things and must not be collapsed:
   * `undefined` is *not asked* (the group walk had not finished, or names were
   * not resolved at all), `[]` is *asked and clean*. Only a producer that
   * verified the group inventory is complete may set it — see
   * `sidepanel/components/groups/ruleOrphans.findRulesWithMissingTargets`.
   */
  missingGroupIds?: string[];
  created: string;
  lastUpdated: string;
  affectsCurrentGroup?: boolean;
  conflicts?: RuleConflict[];
}

/** Generic outcome of an Okta API call made in the content script. */
// Generic default: callers that don't parameterize the payload get an untyped
// `data` (raw Okta JSON, validated at the zod boundary before use).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * Minimal authentication/access-policy identity extracted from the current Okta page.
 *
 * Detection is read-only and identity-only: the id comes from the URL and the name
 * from the page heading (optionally corrected by a single validated
 * `GET /api/v1/policies/{id}` read). Policy *settings* are never scraped out of the
 * page markup.
 */
export interface PolicyInfo {
  policyId: string;
  /** Display name; `null` when neither the DOM nor the API supplied one. */
  policyName: string | null;
  /** Lifecycle status (e.g. `ACTIVE`), present only when API enrichment succeeded. */
  policyStatus?: string;
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
  /**
   * The formatted shape's carrier for `conditions.people.users.exclude` — see
   * {@link FormattedRule.excludedUserIds}. A rule that arrived raw carries its
   * exclusions under `conditions` instead; consumers read whichever is present.
   */
  excludedUserIds?: string[];
}

/**
 * What kind of evidence produced a membership classification — so a guess can be
 * rendered as a guess rather than as one of Okta's own facts.
 *
 * Widening this union is deliberately expensive: every consumer that maps an
 * attribution onto behaviour does so through an exhaustive `Record` keyed by
 * this type (`shared/utils/membershipAnalysis.ATTRIBUTION_SEMANTICS`,
 * `sidepanel/components/groups/memberSourceBuckets.ATTRIBUTION_BUCKET`), so a
 * new member is a compile error at every decision point rather than a silent
 * fall-through into the confident branch.
 *
 * - `exact` — **proven.** Decided from facts: an application-managed group, no
 *   rule targets the group, the user is excluded from every targeting rule,
 *   every targeting rule's condition was fully evaluated client-side and none
 *   matched, or the carried rules' conditions were evaluated and *did* match
 *   this user. Every rule in {@link GroupMembership.rules} provably matches.
 * - `inferred` — **a deduction that still rests on evidence.** At least one
 *   targeting rule's condition is outside the client-side evaluable subset, so
 *   the classifier fell back to the coarse heuristic, and that heuristic had
 *   something to go on: either exactly one candidate rule survived exclusion and
 *   `no-match` elimination (nothing else could have granted the membership), or
 *   the user's own attribute values appear in a candidate's condition text.
 *   Plausible, not proven — a manual add into a rule-fed group can still read as
 *   `RULE_BASED` here.
 * - `ambiguous` — **a guess with no evidence behind it.** Two or more candidate
 *   rules survived and nothing separates them, so no rule can be named as *the*
 *   source; {@link GroupMembership.rules} carries the whole candidate set and any
 *   or none of them may be responsible. Also the honest value for a membership
 *   that was never classified at all (`membershipType: 'UNKNOWN'`). Never render
 *   this with the weight of an answer.
 */
export type MembershipAttribution = 'exact' | 'inferred' | 'ambiguous';

/**
 * One rule exactly as Okta named it when asked which rules manage a membership.
 *
 * Structurally the `EmbeddedGroupRule` of
 * `shared/membership/memberRuleAttribution` — declared here rather than imported
 * so this module stays free of an import cycle back through `shared/membership`,
 * which already depends on these types. Deliberately just the reference: Okta's
 * answer names rules, it does not describe them, and nothing may pass one of
 * these off as a classified {@link MembershipRule} carrying a condition.
 */
export interface OktaAttributedRule {
  /** Rule id (`0pr…`). */
  id: string;
  /** Rule name, exactly as Okta returned it (end-user-controllable text). */
  name: string;
}

/**
 * **Who produced a membership's answer**, carried beside the attribution rather
 * than folded into it.
 *
 * Attribution answers _how strong is the evidence_; provenance answers _who
 * produced it_, and the two compose — which is precisely why provenance is not a
 * fourth {@link MembershipAttribution} value (ADR-0020 §3). This is that ADR's
 * prescribed shape: an **additive** field on {@link GroupMembership}, so every
 * exhaustive table keyed by `MembershipAttribution` is untouched.
 */
export interface MembershipProvenance {
  /**
   * Who asserted it. Only `okta` exists today — a client-evaluated answer is
   * described by `attribution` alone and never fabricates a provenance.
   */
  source: 'okta';
  /**
   * The rules Okta names as managing this membership.
   *
   * **Empty is an answer, not an absence**: Okta positively asserting that no
   * rule feeds the membership, i.e. an authoritative manual add. "Okta said
   * nothing" is the absence of the whole provenance object and must never be
   * encoded as an empty array.
   */
  rules: OktaAttributedRule[];
}

/** A single group membership, annotated with how it was granted. */
export interface GroupMembership {
  group: OktaGroup;
  membershipType: 'DIRECT' | 'RULE_BASED' | 'UNKNOWN';
  /**
   * The rules this membership is attributed to — **plural, because more than one
   * rule can genuinely match the same user**, and because an unevidenced guess
   * has a candidate *set* rather than an answer.
   *
   * How to read the list is entirely determined by `attribution`:
   * `exact` — every entry provably matches (the list may still be incomplete
   * when a sibling rule was unevaluable); `inferred` — every entry is plausible;
   * `ambiguous` — the entries are candidates, not answers. Empty whenever no
   * rule is attributable (a manual add, or an `APP_GROUP` fed by its
   * application rather than by a group rule).
   */
  rules: MembershipRule[];
  /**
   * What kind of evidence produced `membershipType`/`rules`. **Required**: a
   * producer that cannot classify must say so explicitly (`'ambiguous'`) rather
   * than omit the field and have consumers default it to confidence.
   */
  attribution: MembershipAttribution;
  /**
   * Okta's own answer about this membership, when someone explicitly asked for
   * it (ADR-0031). **Absent by default**, and absent is not "no rule": it means
   * nobody asked, or Okta did not answer.
   *
   * Purely additive — it never rewrites `membershipType`, `rules` or
   * `attribution`, which keep describing what the *classifier* concluded. A
   * surface that carries both states which is which; see
   * `shared/membership/sourceLine`.
   */
  provenance?: MembershipProvenance;
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
    | 'getPolicyInfo'
    | 'makeApiRequest'
    | 'getOktaOrigin';
  endpoint?: string;
  method?: string;
  body?: unknown;
}

/** Response envelope extending {@link ApiResponse} with rule/list extras. */
// Generic default mirrors {@link ApiResponse}: unparameterized callers get an
// untyped payload (raw Okta JSON, validated at the zod boundary before use).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MessageResponse<T = any> extends ApiResponse<T> {
  count?: number;
  rules?: OktaGroupRule[];
  formattedRules?: FormattedRule[];
  stats?: RuleStats;
  conflicts?: RuleConflict[];
}

/**
 * Push message broadcast by the background service worker to all extension
 * pages on every scheduler state transition. Carries the metrics snapshot
 * alongside the state so side-panel listeners (e.g. the ActivityBar) stay live
 * without polling `getSchedulerMetrics`.
 */
export interface SchedulerStateChangedMessage {
  action: 'schedulerStateChanged';
  /** The scheduler state after the transition. */
  state: SchedulerState;
  /** Throughput/rate-limit metrics snapshot taken at broadcast time. */
  metrics: SchedulerMetrics;
}

/**
 * Side-panel → background message that opens, refines, or closes an
 * {@link OperationPlan} (`shared/scheduler/plan`).
 *
 * One action with a discriminated `op` rather than four separate actions: they
 * share a validator, a sender check, and a plan id, and splitting them would
 * have meant repeating all three.
 */
export type OperationPlanUpdate = {
  /** Opaque id minted by the caller and echoed on every request the plan covers. */
  planId: string;
} & (
  | {
      op: 'declare';
      /** Human-readable operation name, e.g. `'Export all users'`. */
      name: string;
      tabId: number;
      legs: PlanLegInput[];
    }
  | { op: 'refine'; endpoint: string; estimate: PlanEstimate }
  | { op: 'complete' }
  | { op: 'cancel' }
);

/** The {@link OperationPlanUpdate} payload as it travels over `chrome.runtime`. */
export type UpdateOperationPlanMessage = { action: 'updateOperationPlan' } & OperationPlanUpdate;

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

/**
 * Whether the acting admin could be named when an entry was written.
 *
 * Pairs with {@link AuditLogEntry.performedBy}: `'resolved'` means the string is
 * a real identity, `'unavailable'` means the `/users/me` lookup could not name
 * anyone and `performedBy` is `null`. An audit trail that cannot say who acted
 * must say *that*, not invent a plausible-looking address.
 *
 * Both members are claims a writer made at the time. A row that predates the
 * field made neither claim, and that third state is spelled as the *absence* of
 * the field on {@link PersistedAuditLogEntry} — never as a member of this union,
 * so no writer can record "I did not check" as if it were an answer.
 */
export type ActorResolution = 'resolved' | 'unavailable';

/**
 * The audit-trail record a writer hands to `auditStore.logOperation` — the
 * **write** shape. Every field is required, including {@link
 * AuditLogEntry.actorResolution}.
 *
 * This is not what comes back out of the database: rows written before the
 * attribution fields existed lack them. Read paths return {@link
 * PersistedAuditLogEntry}.
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: 'remove_users' | 'add_users' | 'export' | 'activate_rule' | 'deactivate_rule';
  groupId: string;
  groupName: string;
  /**
   * Email of the admin who performed the operation, or `null` when the actor
   * could not be resolved. Never a placeholder — see {@link ActorResolution}.
   */
  performedBy: string | null;
  /**
   * How {@link performedBy} was arrived at. Required on the write side: every
   * writer in the extension takes its actor from `coreApi.getCurrentUser()` and
   * records which answer it got, so a new entry can never be silent about
   * attribution (`D-013b`).
   *
   * What the code guarantees on the **read** side is weaker, and deliberately
   * so: `auditStore.getHistory` returns {@link PersistedAuditLogEntry}, where
   * this field is optional. Every row written by this extension since `D-013a`
   * carries it; rows persisted before that do not, and `getHistory` returns them
   * as they were stored rather than back-filling a claim nobody made (`D-032`).
   * A reader must therefore handle three cases, not two — see {@link
   * PersistedAuditLogEntry.actorResolution}.
   */
  actorResolution: ActorResolution;
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

/**
 * An audit-trail record as it comes *back out of* IndexedDB — the **row** shape.
 *
 * Identical to {@link AuditLogEntry} except that {@link
 * PersistedAuditLogEntry.actorResolution} is optional, because the database
 * predates that field: rows written before `D-013a` have no value for it and
 * there is no migration that could honestly supply one (`D-032`). Splitting the
 * type is what makes that gap visible to the compiler instead of leaving readers
 * to discover it as a stray `undefined`.
 */
export interface PersistedAuditLogEntry extends Omit<AuditLogEntry, 'actorResolution'> {
  /**
   * How {@link PersistedAuditLogEntry.performedBy} was arrived at, or
   * `undefined` when the row predates the field.
   *
   * `undefined` is **not** a synonym for `'unavailable'`. `'unavailable'` is a
   * positive record that a lookup ran and could not name anyone (and then
   * `performedBy` is `null`); `undefined` means attribution was never recorded
   * either way, so the row's `performedBy` string — whatever it is — carries no
   * statement about how it was obtained. A UI that distinguishes actors must
   * treat the absent case as its own third branch; collapsing it into either
   * member of {@link ActorResolution} relabels a legacy row with a claim the
   * writer never made, which is the thing `D-013` exists to prevent.
   */
  actorResolution?: ActorResolution;
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

/**
 * A push-group mapping linking a source Okta group to an app's target group.
 *
 * Deliberately carries **no status**. `GET /api/v1/apps/{appId}/groups` returns
 * no status for an app-group assignment, so any ACTIVE/INACTIVE label here would
 * be an inference dressed up as an Okta fact. `priority` is the real field the
 * assignment does return.
 */
export interface PushGroupMapping {
  mappingId: string;
  sourceUserGroupId: string;
  targetGroupName: string;
  /**
   * The assignment's priority as returned by Okta, when present. This is a real
   * API field — it is NOT an activation state and must not be rendered as one.
   */
  priority?: number;
  appId: string;
  appName?: string;
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

/** Enriched group row for the group-browse UI (counts, rules, source app). */
export interface GroupSummary {
  id: string;
  name: string;
  description?: string;
  type: GroupType;
  memberCount: number;
  lastUpdated?: Date;
  /**
   * When this group's *membership* last changed, per Okta's
   * `lastMembershipUpdated`.
   *
   * Distinct from {@link GroupSummary.lastUpdated}, which moves only when the
   * group's **profile** is edited. A group renamed yesterday whose roster has not
   * moved in three years has a fresh `lastUpdated` and a three-year-old
   * `lastMembershipUpdated`, and it is the latter that answers "is anyone still
   * using this".
   *
   * It is also the only signal in the app that sees the maintainers nothing else
   * does: Workflows, SCIM, HR provisioning, direct API writes and IdP sync all
   * bump it, none of them leave a group rule behind (see `ruleOrphans`'
   * `INVISIBLE_MAINTAINERS`).
   *
   * What it does NOT carry: no actor, no direction (add vs remove), no magnitude.
   * It is one timestamp. Attribution needs the System Log, whose retention is 90
   * days.
   *
   * Optional because Okta does not document it as required and a never-modified
   * group may omit it — and because a snapshot synced before the field was parsed
   * has no value stored for it until the next walk.
   */
  lastMembershipUpdated?: Date;
  /** Whether at least one rule assigns users to this group (a feeding/target rule). */
  hasRules: boolean;
  /** Number of rules that assign users to this group (its feeding/target set). */
  ruleCount: number;
  /**
   * Number of rules that reference this group in their condition expression
   * (e.g. `isMemberOfAnyGroup("<id>")`) — the group is used to *decide* the rule,
   * not assigned by it. Undefined until the rules payload is known.
   */
  usedInRuleCount?: number;
  selected?: boolean;
  sourceAppId?: string;
  sourceAppName?: string;
  created?: Date;
  pushMappings?: PushGroupMapping[];
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
