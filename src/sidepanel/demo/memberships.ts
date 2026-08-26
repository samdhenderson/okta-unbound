/**
 * @module sidepanel/demo/memberships
 * @description Who is in which demo group — derived, never asserted.
 *
 * Every rule-fed group's membership is computed by **applying the same
 * predicate the group's rule expresses**. So when the Engineering rule says
 * `user.department == "Engineering"` and the group row says 84 members, the
 * group really does hold exactly those 84 people, and a member row that claims
 * a rule-based provenance is telling the truth.
 *
 * That coherence is the point. The drilldown scene expands a member row to show
 * *why* someone is a member; if memberships were hand-listed and counts were
 * hand-typed, the scene would be filming a lie that happens to look right.
 *
 * Import order is `org → users → memberships → snapshot`. This module must not
 * import from `./snapshot`, or the graph gains a cycle (`npm run knip:circular`).
 */
import type { OktaUser } from '../../shared/types';
import { EMEA_COUNTRIES, SeededRandom, fakeId } from './org';
import { demoUsers } from './users';

/**
 * Group ordinals, named.
 *
 * The ordinal is the id: group `n` is `00gFAKE000n`. Kept here rather than in
 * `snapshot.ts` so this module can key memberships without importing it.
 */
export const GROUP = {
  everyone: 1,
  engineering: 2,
  sales: 3,
  customerSuccess: 4,
  marketing: 5,
  finance: 6,
  peopleOps: 7,
  it: 8,
  security: 9,
  data: 10,
  legal: 11,
  awsProdAdmin: 12,
  awsProdReadOnly: 13,
  vpnUsers: 14,
  contractorsEmea: 15,
  contractorsAmer: 16,
  oktaAdministrators: 17,
  onCallEngineering: 18,
  releaseManagers: 19,
  incidentResponse: 20,
  interns: 21,
  dormant: 22,
  executiveStaff: 23,
  londonOffice: 24,
  berlinOffice: 25,
  seattleOffice: 26,
  austinOffice: 27,
  sydneyOffice: 28,
  salesforceSalesUsers: 29,
  salesforceAdmins: 30,
  workdayAllWorkers: 31,
  githubEngineering: 32,
  zoomLicensed: 33,
  datadogEngineering: 34,
} as const;

/** The departments that get a rule-fed `<Department> — All` group. */
const DEPARTMENT_GROUPS: readonly { ordinal: number; department: string }[] = [
  { ordinal: GROUP.engineering, department: 'Engineering' },
  { ordinal: GROUP.sales, department: 'Sales' },
  { ordinal: GROUP.customerSuccess, department: 'Customer Success' },
  { ordinal: GROUP.marketing, department: 'Marketing' },
  { ordinal: GROUP.finance, department: 'Finance' },
  { ordinal: GROUP.peopleOps, department: 'People Ops' },
  { ordinal: GROUP.it, department: 'IT' },
  { ordinal: GROUP.security, department: 'Security' },
  { ordinal: GROUP.data, department: 'Data' },
  { ordinal: GROUP.legal, department: 'Legal' },
];

/** The city-fed office groups. */
const OFFICE_GROUPS: readonly { ordinal: number; city: string }[] = [
  { ordinal: GROUP.londonOffice, city: 'London' },
  { ordinal: GROUP.berlinOffice, city: 'Berlin' },
  { ordinal: GROUP.seattleOffice, city: 'Seattle' },
  { ordinal: GROUP.austinOffice, city: 'Austin' },
  { ordinal: GROUP.sydneyOffice, city: 'Sydney' },
];

const attr = (user: OktaUser, key: string): string => String(user.profile[key] ?? '');

/**
 * Groups whose membership is a genuine predicate over the profile — the ones a
 * group rule feeds. Each entry mirrors the expression in `snapshot.demoRules`.
 */
const RULE_FED: readonly { ordinal: number; predicate: (user: OktaUser) => boolean }[] = [
  ...DEPARTMENT_GROUPS.map(({ ordinal, department }) => ({
    ordinal,
    predicate: (user: OktaUser) => attr(user, 'department') === department,
  })),
  ...OFFICE_GROUPS.map(({ ordinal, city }) => ({
    ordinal,
    predicate: (user: OktaUser) => attr(user, 'city') === city,
  })),
  { ordinal: GROUP.vpnUsers, predicate: (user) => user.status === 'ACTIVE' },
  {
    ordinal: GROUP.contractorsEmea,
    predicate: (user) =>
      attr(user, 'employeeType') === 'CONTRACTOR' &&
      EMEA_COUNTRIES.includes(attr(user, 'countryCode')),
  },
  {
    ordinal: GROUP.contractorsAmer,
    predicate: (user) =>
      attr(user, 'employeeType') === 'CONTRACTOR' &&
      ['US', 'CA'].includes(attr(user, 'countryCode')),
  },
  { ordinal: GROUP.interns, predicate: (user) => attr(user, 'employeeType') === 'INTERN' },
  {
    // The hero rule: engineers, minus contractors. Its overlap with the plain
    // Engineering group is exactly what the impact-preview scene is about.
    ordinal: GROUP.githubEngineering,
    predicate: (user) =>
      attr(user, 'department') === 'Engineering' && attr(user, 'employeeType') !== 'CONTRACTOR',
  },
  { ordinal: GROUP.everyone, predicate: () => true },
  {
    ordinal: GROUP.workdayAllWorkers,
    predicate: (user) => user.status !== 'STAGED' && user.status !== 'DEPROVISIONED',
  },
  {
    ordinal: GROUP.datadogEngineering,
    predicate: (user) => attr(user, 'department') === 'Engineering',
  },
];

/**
 * Groups nobody's profile implies — the hand-managed ones.
 *
 * Drawn deterministically from an eligible pool so the membership is stable
 * across runs but still looks curated rather than alphabetical. These are the
 * groups whose member rows show a **direct** provenance, which is the contrast
 * the drilldown scene needs against the rule-fed rows.
 */
const HAND_MANAGED: readonly {
  ordinal: number;
  size: number;
  eligible: (user: OktaUser) => boolean;
}[] = [
  {
    ordinal: GROUP.awsProdAdmin,
    size: 8,
    eligible: (u) => ['Engineering', 'IT', 'Security'].includes(attr(u, 'department')),
  },
  {
    ordinal: GROUP.awsProdReadOnly,
    size: 41,
    eligible: (u) => ['Engineering', 'IT', 'Security', 'Data'].includes(attr(u, 'department')),
  },
  {
    ordinal: GROUP.oktaAdministrators,
    size: 6,
    eligible: (u) => ['IT', 'Security'].includes(attr(u, 'department')),
  },
  {
    ordinal: GROUP.onCallEngineering,
    size: 22,
    eligible: (u) => attr(u, 'department') === 'Engineering' && u.status === 'ACTIVE',
  },
  {
    ordinal: GROUP.releaseManagers,
    size: 9,
    eligible: (u) => attr(u, 'department') === 'Engineering',
  },
  {
    ordinal: GROUP.incidentResponse,
    size: 7,
    eligible: (u) => ['Security', 'Engineering'].includes(attr(u, 'department')),
  },
  {
    ordinal: GROUP.executiveStaff,
    size: 11,
    eligible: (u) => /Manager|Director|Controller|Counsel|Principal/.test(attr(u, 'title')),
  },
  {
    ordinal: GROUP.salesforceSalesUsers,
    size: 47,
    eligible: (u) => ['Sales', 'Customer Success', 'Marketing'].includes(attr(u, 'department')),
  },
  {
    ordinal: GROUP.salesforceAdmins,
    size: 5,
    eligible: (u) => attr(u, 'department') === 'Sales',
  },
  {
    ordinal: GROUP.zoomLicensed,
    size: 168,
    eligible: (u) => u.status === 'ACTIVE',
  },
  {
    // Dormancy is a real property of the generated data: nobody is put here who
    // has actually signed in recently.
    ordinal: GROUP.dormant,
    size: 29,
    eligible: (u) => {
      if (!u.lastLogin) return false;
      const days = (Date.parse('2026-08-01T09:00:00.000Z') - Date.parse(u.lastLogin)) / 86_400_000;
      return days > 120;
    },
  },
];

function buildMemberships(): Map<string, string[]> {
  const byGroup = new Map<string, string[]>();

  for (const { ordinal, predicate } of RULE_FED) {
    byGroup.set(
      fakeId('00g', ordinal),
      demoUsers.filter(predicate).map((u) => u.id),
    );
  }

  const rng = new SeededRandom(778899);
  for (const { ordinal, size, eligible } of HAND_MANAGED) {
    const pool = demoUsers.filter(eligible);
    const chosen: string[] = [];
    const taken = new Set<number>();
    // Sample without replacement, capped by the pool — a demo group must never
    // claim more members than the org can supply.
    const target = Math.min(size, pool.length);
    let guard = 0;
    while (chosen.length < target && guard < target * 40) {
      guard += 1;
      const index = rng.int(0, pool.length - 1);
      if (taken.has(index)) continue;
      const candidate = pool[index];
      if (!candidate) continue;
      taken.add(index);
      chosen.push(candidate.id);
    }
    byGroup.set(fakeId('00g', ordinal), chosen);
  }

  return byGroup;
}

/** Group id → the ids of everyone in it. */
export const demoGroupMembers: ReadonlyMap<string, readonly string[]> = buildMemberships();

/** How many members group `ordinal` has. Feeds the raw `_embedded.stats.usersCount`. */
export function demoMemberCount(ordinal: number): number {
  return demoGroupMembers.get(fakeId('00g', ordinal))?.length ?? 0;
}

function buildUserGroups(): Map<string, string[]> {
  const byUser = new Map<string, string[]>();
  for (const [groupId, memberIds] of demoGroupMembers) {
    for (const userId of memberIds) {
      const existing = byUser.get(userId);
      if (existing) existing.push(groupId);
      else byUser.set(userId, [groupId]);
    }
  }
  return byUser;
}

/** User id → the ids of every group they belong to. */
export const demoUserGroups: ReadonlyMap<string, readonly string[]> = buildUserGroups();
