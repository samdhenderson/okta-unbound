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
 * ## Derivation is now continuous, not once at module load
 *
 * The reel's Users chapter ends on an admin correcting a mis-typed `department`
 * and the rule that reads it then applying, so the org has to be able to change
 * (ADR-0052). Rule-fed membership is therefore re-derived whenever
 * {@link module:sidepanel/demo/state} reports a write, over
 * {@link currentUsers} rather than over the frozen seed.
 *
 * That strengthens the property this module was built around rather than
 * weakening it. "Membership is computed from the rule's own predicate" used to
 * be true of one snapshot taken at import; it is now true continuously, which is
 * exactly what makes the payoff honest: nobody adds Priya to `Engineering - All`
 * when her department is fixed, the predicate simply starts matching her.
 *
 * ## The hand-managed carve-out, and the line it must not be read across
 *
 * {@link HAND_MANAGED} groups are sampled once and then hold their id list for
 * the life of the page. They have **no predicate** — that is what makes them
 * hand-managed, and it is the contrast the drilldown scene needs against the
 * rule-fed rows. Re-sampling them on every write would reshuffle six unrelated
 * groups on camera because a seeded draw over a changed eligible pool lands
 * somewhere else, which is motion nobody asked for and cannot explain.
 *
 * Freezing the sample of a group that has no predicate is **not** the same thing
 * as hand-listing a membership to make a shot work, and the distinction is
 * load-bearing: the first is the only way to model a group a human curates, the
 * second is banned. If a scene needs a rule-fed outcome, change the predicate or
 * change the user - never write an id into a list.
 *
 * Import order is `org → users → state → memberships → snapshot`. This module
 * must not import from `./snapshot`, or the graph gains a cycle
 * (`npm run knip:circular`).
 */
import type { OktaUser } from '../../shared/types';
import { EMEA_COUNTRIES, SeededRandom, fakeId } from './org';
import { currentUsers, demoRevision } from './state';
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
  migrationAccess: 35,
  salesEmeaLegacy: 36,
  verifyRollout: 37,
} as const;

/** The departments that get a rule-fed `<Department> - All` group. */
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

/**
 * The hand-managed draw, taken once and kept.
 *
 * Sampled from the **seed** rather than from the current users, and never
 * re-sampled. See the module header for why that is not the same act as
 * hand-listing a membership: these groups have no predicate to re-apply, so
 * there is nothing to re-derive, and a seeded draw over a changed eligible pool
 * would simply land somewhere else.
 *
 * It also happens to model the real thing correctly. Correcting somebody's
 * department must not silently put them on the incident-response rota, because
 * in a real org a human decides that.
 */
let handManaged: ReadonlyMap<string, readonly string[]> | null = null;

function sampleHandManaged(): ReadonlyMap<string, readonly string[]> {
  if (handManaged) return handManaged;
  const byGroup = new Map<string, readonly string[]>();
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
  handManaged = byGroup;
  return handManaged;
}

/** Memoised derivation, rebuilt only when {@link demoRevision} moves. */
let memoRevision = -1;
let memoByGroup: ReadonlyMap<string, readonly string[]> = new Map();
let memoByUser: ReadonlyMap<string, readonly string[]> = new Map();

function derive(): void {
  const revision = demoRevision();
  if (memoRevision === revision) return;

  const users = currentUsers();
  const byGroup = new Map<string, readonly string[]>(sampleHandManaged());

  // The only half that re-derives. Every one of these predicates mirrors the
  // expression of the rule that feeds the group, so a profile edit changes
  // membership by the same route Okta would: the predicate starts, or stops,
  // matching.
  for (const { ordinal, predicate } of RULE_FED) {
    byGroup.set(
      fakeId('00g', ordinal),
      users.filter(predicate).map((u) => u.id),
    );
  }

  const byUser = new Map<string, string[]>();
  for (const [groupId, memberIds] of byGroup) {
    for (const userId of memberIds) {
      const existing = byUser.get(userId);
      if (existing) existing.push(groupId);
      else byUser.set(userId, [groupId]);
    }
  }

  memoByGroup = byGroup;
  memoByUser = byUser;
  memoRevision = revision;
}

/**
 * Group id → the ids of everyone in it, as the org stands now.
 *
 * A function rather than the constant it used to be, because the org can be
 * written to (ADR-0052). Callers must not hold the returned map across a write:
 * read it again instead, which costs a revision comparison when nothing changed.
 */
export function demoGroupMembers(): ReadonlyMap<string, readonly string[]> {
  derive();
  return memoByGroup;
}

/** User id → the ids of every group they belong to, as the org stands now. */
export function demoUserGroups(): ReadonlyMap<string, readonly string[]> {
  derive();
  return memoByUser;
}
