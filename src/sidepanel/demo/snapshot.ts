/**
 * @module sidepanel/demo/snapshot
 * @description The demo org's groups, rules, apps and app-group assignments.
 *
 * Everything here is authored in the **raw Okta response shape**, not in the
 * app's view models. That is deliberate: the Groups tab reads these rows out of
 * IndexedDB and maps them itself (`groupSummary.toGroupSummary`,
 * `ruleUtils.formatRuleForDisplay`, `groupRuleIndex.annotateGroupsWithRuleCounts`).
 * Authoring raw means the demo exercises the real mappers, so what gets filmed
 * is the actual render path rather than a hand-faked approximation of it.
 *
 * Member counts are **computed from {@link module:sidepanel/demo/memberships}**
 * rather than invented, so a group that says 84 members and the rule that feeds
 * it agree with each other on camera. Since ADR-0052 they are also computed at
 * *read* time rather than at module load, because a profile write re-derives
 * every rule-fed membership and a headcount frozen at import would go quietly
 * wrong the moment one lands. Read groups through {@link currentGroups}.
 */
import type { OktaGroupRule } from '../../shared/types';
import type { OktaAppGroupAssignment, OktaAppListItem } from '../../shared/schemas/okta';
import type { RawOktaGroup } from '../components/groups/groupSummary';
import { fakeId, isoDaysAgo } from './org';
import { GROUP, demoGroupMembers } from './memberships';
import { demoRevision } from './state';

/**
 * Build one raw group, minus its headcount.
 *
 * The member count is **not** a parameter and is deliberately **not stamped
 * here** either. It is derived from {@link module:sidepanel/demo/memberships},
 * which re-derives whenever the org is written to (ADR-0052), so a count baked
 * in at module load would be right exactly until the first profile edit and
 * silently wrong afterwards. {@link currentGroups} stamps it at read time
 * instead, which is why these templates carry no `_embedded` at all: a stale
 * count is invisible, an absent one is not.
 *
 * @param n - Ordinal, which becomes the `00gFAKE…` id.
 * @param name - Display name.
 * @param description - The one-line description the list row shows.
 * @param options - Group type, the sourcing app for `APP_GROUP`s, and
 * `membershipDaysAgo` to move the roster clock independently of the profile one.
 */
function group(
  n: number,
  name: string,
  description: string,
  options: {
    type?: RawOktaGroup['type'];
    source?: { id: string; name: string };
    /**
     * Days since the roster last changed. Defaults to a value near
     * `lastUpdated`, which is the ordinary case — most groups are edited and
     * filled in the same era.
     *
     * Set it explicitly to build the case the two clocks exist to tell apart: a
     * group whose profile was edited last week but whose membership has not moved
     * in years reads as fresh on `lastUpdated` and dormant on this one. Without at
     * least one such fixture the distinction is untestable and invisible in the
     * demo.
     */
    membershipDaysAgo?: number;
  } = {},
): RawOktaGroup {
  return {
    id: fakeId('00g', n),
    type: options.type ?? 'OKTA_GROUP',
    profile: { name, description },
    ...(options.source
      ? { source: options.source, _links: { apps: { href: `/api/v1/apps/${options.source.id}` } } }
      : {}),
    created: isoDaysAgo(600 + n),
    lastUpdated: isoDaysAgo(n * 3 + 2),
    lastMembershipUpdated: isoDaysAgo(options.membershipDaysAgo ?? n * 3 + 5),
  };
}

/**
 * The org's groups.
 *
 * A deliberate mix of shapes so the list has something to say at every row:
 * department groups that a rule feeds, hand-managed privileged groups, an
 * app-sourced group with a `source` (which renders a provenance badge), and a
 * built-in.
 */
const groupTemplates: readonly RawOktaGroup[] = [
  group(GROUP.everyone, 'Everyone', 'All users in your organization', { type: 'BUILT_IN' }),
  group(GROUP.engineering, 'Engineering - All', 'Every engineer, rule-assigned by department'),
  group(GROUP.sales, 'Sales - All', 'Rule-assigned by department'),
  group(GROUP.customerSuccess, 'Customer Success - All', 'Rule-assigned by department'),
  group(GROUP.marketing, 'Marketing - All', 'Rule-assigned by department'),
  group(GROUP.finance, 'Finance - All', 'Rule-assigned by department'),
  group(GROUP.peopleOps, 'People Ops - All', 'Rule-assigned by department'),
  group(GROUP.it, 'IT - All', 'Rule-assigned by department'),
  group(GROUP.security, 'Security - All', 'Rule-assigned by department'),
  group(GROUP.data, 'Data - All', 'Rule-assigned by department'),
  group(GROUP.legal, 'Legal - All', 'Rule-assigned by department'),
  // The case the two clocks exist to tell apart, and deliberately the org's most
  // privileged group: the quarterly review keeps editing the description, so
  // `lastUpdated` is always days old and the group reads as well-tended — while
  // nobody has actually joined or left it in over three years. On the profile
  // clock alone it is invisible; on the membership clock it is the first thing an
  // access review should look at.
  group(
    GROUP.awsProdAdmin,
    'AWS Prod - Admin',
    'Production AWS console access. Reviewed quarterly.',
    { membershipDaysAgo: 1180 },
  ),
  group(GROUP.awsProdReadOnly, 'AWS Prod - ReadOnly', 'Read-only production AWS access'),
  group(GROUP.vpnUsers, 'VPN Users', 'Rule-assigned to every active employee'),
  group(GROUP.contractorsEmea, 'Contractors - EMEA', 'Rule-assigned: contractors in EMEA offices'),
  group(GROUP.contractorsAmer, 'Contractors - AMER', 'Rule-assigned: contractors in US/CA offices'),
  group(GROUP.oktaAdministrators, 'Okta Administrators', 'Super admin and org admin holders'),
  group(GROUP.onCallEngineering, 'On-Call - Engineering', 'Paged rotation. Managed by hand.'),
  group(GROUP.releaseManagers, 'Release Managers', 'Can promote a build to production'),
  group(GROUP.incidentResponse, 'Security - Incident Response', 'IR pager rotation'),
  // A cohort that should have been emptied at the end of the season and never
  // was — nothing has touched the roster since the intake.
  group(GROUP.interns, 'Interns 2026', 'Summer cohort. Expires at the end of the season.', {
    membershipDaysAgo: 430,
  }),
  group(GROUP.dormant, 'Dormant - 120d', 'No sign-in in 120 days. Review for deactivation.'),
  group(GROUP.executiveStaff, 'Executive Staff', 'Leadership team'),
  group(GROUP.londonOffice, 'London Office', 'Rule-assigned by city'),
  group(GROUP.berlinOffice, 'Berlin Office', 'Rule-assigned by city'),
  group(GROUP.seattleOffice, 'Seattle Office', 'Rule-assigned by city'),
  group(GROUP.austinOffice, 'Austin Office', 'Rule-assigned by city'),
  group(GROUP.sydneyOffice, 'Sydney Office', 'Rule-assigned by city'),
  group(GROUP.salesforceSalesUsers, 'Salesforce - Sales Users', 'Pushed from Salesforce', {
    type: 'APP_GROUP',
    source: { id: fakeId('0oa', 1), name: 'Salesforce' },
  }),
  group(GROUP.salesforceAdmins, 'Salesforce - Admins', 'Pushed from Salesforce', {
    type: 'APP_GROUP',
    source: { id: fakeId('0oa', 1), name: 'Salesforce' },
  }),
  group(GROUP.workdayAllWorkers, 'Workday - All Workers', 'Sourced from Workday HR', {
    type: 'APP_GROUP',
    source: { id: fakeId('0oa', 2), name: 'Workday HR' },
  }),
  group(GROUP.githubEngineering, 'GitHub - Engineering', 'Pushed to GitHub Enterprise', {
    type: 'APP_GROUP',
    source: { id: fakeId('0oa', 3), name: 'GitHub Enterprise' },
  }),
  group(GROUP.zoomLicensed, 'Zoom - Licensed', 'Pushed to Zoom', {
    type: 'APP_GROUP',
    source: { id: fakeId('0oa', 5), name: 'Zoom' },
  }),
  group(GROUP.datadogEngineering, 'Datadog - Engineering', 'Pushed to Datadog', {
    type: 'APP_GROUP',
    source: { id: fakeId('0oa', 7), name: 'Datadog' },
  }),
  group(
    GROUP.migrationAccess,
    'Temp - Migration Access',
    'Cutover access for the IdP migration. Nobody closed it.',
  ),
  group(GROUP.salesEmeaLegacy, 'Sales - EMEA legacy', 'Superseded by Sales - All'),
  group(GROUP.verifyRollout, 'Okta Verify Rollout', 'Pilot cohort for the Okta Verify rollout'),
];

/**
 * Build one raw group rule.
 *
 * @param n - Ordinal, which becomes the `0prFAKE…` id.
 * @param name - Display name.
 * @param expression - Real Okta Expression Language. The panel parses these
 * with `shared/ruleEvaluator` rather than evaluating them, so they must be
 * genuinely well-formed.
 * @param groupIds - The groups this rule assigns into.
 * @param status - `ACTIVE` unless the scene wants a deactivated row.
 */
function rule(
  n: number,
  name: string,
  expression: string,
  groupIds: string[],
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
): OktaGroupRule {
  return {
    id: fakeId('0pr', n),
    name,
    status,
    type: 'group_rule',
    created: isoDaysAgo(400 + n * 7),
    lastUpdated: isoDaysAgo(n * 5 + 1),
    conditions: { expression: { value: expression, type: 'urn:okta:expression:1.0' } },
    actions: { assignUserToGroups: { groupIds } },
    allGroupsValid: true,
  };
}

/**
 * The org's group rules.
 *
 * Written as real Okta Expression Language, including the two-clause and
 * `String.stringContains` forms, so the rule cards render the same structure
 * they would against a live org. Rule 3 deliberately overlaps rule 2's
 * population — that overlap is what the rule-impact scene previews.
 */
export const demoRules: OktaGroupRule[] = [
  rule(1, 'Everyone → VPN', 'user.status == "ACTIVE"', [fakeId('00g', 14)]),
  rule(2, 'Engineering by department', 'user.department == "Engineering"', [fakeId('00g', 2)]),
  rule(
    3,
    'Engineering → GitHub (excludes contractors)',
    'user.department == "Engineering" && user.employeeType != "CONTRACTOR"',
    [fakeId('00g', 32)],
  ),
  rule(4, 'Sales by department', 'user.department == "Sales"', [fakeId('00g', 3)]),
  rule(
    5,
    'EMEA contractors',
    'user.employeeType == "CONTRACTOR" && (user.countryCode == "GB" || user.countryCode == "DE" || user.countryCode == "IE")',
    [fakeId('00g', 15)],
  ),
  rule(
    6,
    'AMER contractors',
    'user.employeeType == "CONTRACTOR" && (user.countryCode == "US" || user.countryCode == "CA")',
    [fakeId('00g', 16)],
  ),
  rule(7, 'London office', 'user.city == "London"', [fakeId('00g', 24)]),
  rule(8, 'Berlin office', 'user.city == "Berlin"', [fakeId('00g', 25)]),
  rule(
    9,
    'Interns → cohort group',
    'user.employeeType == "INTERN" && String.stringContains(user.organization, "Northwind")',
    [fakeId('00g', 21)],
    'INACTIVE',
  ),
];

/**
 * Build one raw app row.
 *
 * @param n - Ordinal, which becomes the `0oaFAKE…` id.
 * @param name - Okta's internal app name.
 * @param label - What an admin sees.
 * @param signOnMode - e.g. `SAML_2_0`.
 * @param status - `ACTIVE` unless the scene wants a deactivated row.
 * @param features - The provisioning features Okta reports for this app
 * instance, e.g. `['GROUP_PUSH', 'IMPORT_NEW_USERS']`. Omitted by default, the
 * way most demo apps carry no `features` field at all; pass it only for the
 * apps the scene needs {@link isGroupPushApp} to recognize.
 */
function app(
  n: number,
  name: string,
  label: string,
  signOnMode: string,
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
  features?: readonly string[],
): OktaAppListItem {
  return {
    id: fakeId('0oa', n),
    name,
    label,
    status,
    signOnMode,
    created: isoDaysAgo(700 + n * 11),
    lastUpdated: isoDaysAgo(n * 4 + 3),
    ...(features ? { features: [...features] } : {}),
  };
}

/** The org's app inventory. */
const GROUP_PUSH_FEATURES = ['GROUP_PUSH', 'IMPORT_NEW_USERS'] as const;

export const demoApps: OktaAppListItem[] = [
  app(1, 'salesforce', 'Salesforce', 'SAML_2_0', 'ACTIVE', GROUP_PUSH_FEATURES),
  app(2, 'workday', 'Workday HR', 'SAML_2_0'),
  app(3, 'github', 'GitHub Enterprise', 'SAML_2_0', 'ACTIVE', GROUP_PUSH_FEATURES),
  app(4, 'slack', 'Slack', 'SAML_2_0', 'ACTIVE', GROUP_PUSH_FEATURES),
  app(5, 'zoom', 'Zoom', 'SAML_2_0', 'ACTIVE', GROUP_PUSH_FEATURES),
  app(6, 'atlassian', 'Atlassian Cloud', 'SAML_2_0', 'ACTIVE', GROUP_PUSH_FEATURES),
  app(7, 'datadog', 'Datadog', 'SAML_2_0', 'ACTIVE', GROUP_PUSH_FEATURES),
  app(8, 'aws_account_federation', 'AWS Account Federation', 'SAML_2_0'),
  app(9, 'boxnet', 'Box', 'SAML_2_0'),
  app(10, 'docusign', 'DocuSign', 'SAML_2_0'),
  app(11, 'netsuite', 'NetSuite', 'SAML_2_0', 'INACTIVE'),
  app(12, 'pagerduty', 'PagerDuty', 'SAML_2_0'),
];

/**
 * Group assignments per app, stored under the sharded `appId::groupId` key the
 * snapshot uses for `appGroups` (see `shared/snapshot/types.SHARD_KEY_SEPARATOR`).
 *
 * These are what produce the push-mapping badges on a group row, so the set is
 * kept small and pointed rather than exhaustive.
 */
export const demoAppGroups: readonly { appId: string; assignment: OktaAppGroupAssignment }[] = [
  {
    appId: fakeId('0oa', 1),
    assignment: { id: fakeId('00g', 29), priority: 0, profile: { groupName: 'Sales Users' } },
  },
  {
    appId: fakeId('0oa', 1),
    assignment: { id: fakeId('00g', 30), priority: 1, profile: { groupName: 'Admins' } },
  },
  {
    appId: fakeId('0oa', 3),
    assignment: { id: fakeId('00g', 32), priority: 0, profile: { groupName: 'engineering' } },
  },
  {
    appId: fakeId('0oa', 5),
    assignment: { id: fakeId('00g', 33), priority: 0, profile: { groupName: 'Licensed' } },
  },
  {
    appId: fakeId('0oa', 7),
    assignment: { id: fakeId('00g', 34), priority: 0, profile: { groupName: 'engineering' } },
  },
  {
    appId: fakeId('0oa', 8),
    assignment: { id: fakeId('00g', 12), priority: 0, profile: { groupName: 'ProdAdmin' } },
  },
  {
    appId: fakeId('0oa', 8),
    assignment: { id: fakeId('00g', 13), priority: 1, profile: { groupName: 'ProdReadOnly' } },
  },
];

/**
 * How many groups the org has. Constant, and safe to read without deriving.
 *
 * Separate from {@link currentGroups} so `seedDemoSnapshot` can state an
 * `itemCount` without forcing a membership derivation it does not need.
 */
export const DEMO_GROUP_COUNT = groupTemplates.length;

/** Memoised live view, rebuilt only when a write moves the revision. */
let stampedRevision = -1;
let stampedGroups: readonly RawOktaGroup[] = [];
let stampedById: ReadonlyMap<string, RawOktaGroup> = new Map();

function stamp(): void {
  const revision = demoRevision();
  if (stampedRevision === revision && stampedGroups.length > 0) return;
  stampedGroups = groupTemplates.map((template) => ({
    ...template,
    _embedded: { stats: { usersCount: demoGroupMembers().get(template.id)?.length ?? 0 } },
  }));
  stampedById = new Map(stampedGroups.map((g) => [g.id, g]));
  stampedRevision = revision;
}

/**
 * The org's groups as they stand now, each carrying its real current headcount.
 *
 * A function rather than the constant it used to be. The org can be written to
 * (ADR-0052), a write re-derives every rule-fed membership, and a group row is
 * where that change becomes visible to the panel. Callers must not hold the
 * returned array across a write.
 */
export function currentGroups(): readonly RawOktaGroup[] {
  stamp();
  return stampedGroups;
}

/** The same rows, indexed by id. */
export function currentGroupsById(): ReadonlyMap<string, RawOktaGroup> {
  stamp();
  return stampedById;
}

/**
 * The group the drilldown scene opens.
 *
 * Pinned so the scene's header, member count and feeding-rule badge are the
 * same on every take. `Engineering - All` is the right choice: it is large
 * enough to cascade, and it is fed by a rule, so its member rows can show the
 * direct-vs-rule provenance the scene exists to demonstrate.
 */
export const DEMO_HERO_GROUP_ID = fakeId('00g', 2);
