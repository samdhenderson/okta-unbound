/**
 * @module sidepanel/demo/users
 * @description The demo org's people — ~250 deterministic {@link OktaUser}s.
 *
 * Generated from the pools in {@link module:sidepanel/demo/org} through a seeded
 * PRNG, so the same 250 people appear in the same order on every run. Two of
 * them are pinned as named "hero" users, because the comparison scene needs a
 * pair whose differences are worth looking at rather than two arbitrary rows.
 */
import type { OktaUser, UserStatus } from '../../shared/types';
import {
  DEMO_ORG_NAME,
  FIRST_NAMES,
  LAST_NAMES,
  LOCATIONS,
  SeededRandom,
  fakeId,
  isoDaysAgo,
  pickDepartment,
} from './org';

/** How many people the demo org has. */
export const DEMO_USER_COUNT = 250;

/**
 * The status mix.
 *
 * Weighted so the org reads as healthy but not sterile: a demo with 250 ACTIVE
 * users shows none of the status treatments the UI actually has, and one with
 * an even split looks like a test fixture.
 */
const STATUS_WEIGHTS: readonly { status: UserStatus; weight: number }[] = [
  { status: 'ACTIVE', weight: 82 },
  { status: 'SUSPENDED', weight: 5 },
  { status: 'DEPROVISIONED', weight: 6 },
  { status: 'STAGED', weight: 3 },
  { status: 'PROVISIONED', weight: 2 },
  { status: 'LOCKED_OUT', weight: 1 },
  { status: 'PASSWORD_EXPIRED', weight: 1 },
];

function pickStatus(rng: SeededRandom): UserStatus {
  const total = STATUS_WEIGHTS.reduce((sum, s) => sum + s.weight, 0);
  let roll = rng.next() * total;
  for (const entry of STATUS_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.status;
  }
  return 'ACTIVE';
}

/**
 * Strip accents/punctuation so a display name becomes a mail-safe local part.
 *
 * The combining-mark range is written as an escape rather than as literal
 * characters so the class survives `npm run lint:control-chars` and stays
 * legible in a diff.
 */
function loginSlug(first: string, last: string): string {
  return `${first}.${last}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z.]/g, '');
}

/**
 * Build the org's people.
 *
 * Logins are de-duplicated with a numeric suffix, the way a real directory does
 * it, so two `Zara Petrov`s get `zara.petrov@` and `zara.petrov2@` rather than
 * colliding — which matters because several surfaces key on login.
 */
function buildUsers(): OktaUser[] {
  const rng = new SeededRandom(20260826);
  const seenLogins = new Map<string, number>();
  const users: OktaUser[] = [];

  for (let i = 0; i < DEMO_USER_COUNT; i += 1) {
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    const department = pickDepartment(rng);
    const title = rng.pick(department.titles);
    const location = rng.pick(LOCATIONS);
    const status = pickStatus(rng);

    const slug = loginSlug(firstName, lastName);
    const seen = (seenLogins.get(slug) ?? 0) + 1;
    seenLogins.set(slug, seen);
    const login = `${seen === 1 ? slug : `${slug}${seen}`}@example.com`;

    // Contractors cluster in Engineering and IT, which is what makes the
    // "contractors in a privileged group" beat in the rules worth showing.
    const employeeType =
      department.name === 'Engineering' || department.name === 'IT'
        ? rng.chance(0.18)
          ? 'CONTRACTOR'
          : rng.chance(0.09)
            ? 'INTERN'
            : 'FULL_TIME'
        : rng.chance(0.06)
          ? 'CONTRACTOR'
          : rng.chance(0.05)
            ? 'INTERN'
            : 'FULL_TIME';

    const createdDaysAgo = rng.int(30, 1400);
    const isDormant = status === 'ACTIVE' && rng.chance(0.12);

    users.push({
      id: fakeId('00u', i + 1),
      status,
      created: isoDaysAgo(createdDaysAgo),
      activated: status === 'STAGED' ? undefined : isoDaysAgo(createdDaysAgo - 1),
      lastUpdated: isoDaysAgo(rng.int(1, 120)),
      lastLogin:
        status === 'ACTIVE' || status === 'PASSWORD_EXPIRED'
          ? isoDaysAgo(isDormant ? rng.int(120, 400) : rng.int(0, 21))
          : null,
      profile: {
        login,
        email: login,
        firstName,
        lastName,
        department: department.name,
        title,
        city: location.city,
        ...(location.state ? { state: location.state } : {}),
        countryCode: location.countryCode,
        employeeType,
        userType: employeeType === 'CONTRACTOR' ? 'Contractor' : 'Employee',
        organization: DEMO_ORG_NAME,
      },
    });
  }

  return users;
}

/**
 * The demo org's ~250 people, in a stable order.
 *
 * Built once at module load. Every consumer shares the array, so a scene must
 * treat it as read-only.
 */
export const demoUsers: OktaUser[] = buildUsers();

/** Index by id, for the scene helpers that resolve a single user. */
export const demoUsersById: ReadonlyMap<string, OktaUser> = new Map(
  demoUsers.map((user) => [user.id, user]),
);

/**
 * The two people the comparison scene puts side by side.
 *
 * Pinned rather than picked at random so the scene's badges (group diff, app
 * diff, attribute diff) are the same on every take, and so the cut can be
 * narrated. They are overwritten below to guarantee an interesting contrast:
 * same department, different seniority, different office, one a contractor.
 */
export const DEMO_COMPARISON_PAIR = {
  /** The left-hand, longer-tenured engineer. */
  left: fakeId('00u', 7),
  /** The right-hand contractor, deliberately missing several of the left's groups. */
  right: fakeId('00u', 19),
} as const;

const heroLeft = demoUsersById.get(DEMO_COMPARISON_PAIR.left);
if (heroLeft) {
  heroLeft.status = 'ACTIVE';
  heroLeft.profile.firstName = 'Amara';
  heroLeft.profile.lastName = 'Okonkwo';
  heroLeft.profile.login = 'amara.okonkwo@example.com';
  heroLeft.profile.email = 'amara.okonkwo@example.com';
  heroLeft.profile.department = 'Engineering';
  heroLeft.profile.title = 'Staff Engineer';
  heroLeft.profile.city = 'Seattle';
  heroLeft.profile.state = 'WA';
  heroLeft.profile.countryCode = 'US';
  heroLeft.profile.employeeType = 'FULL_TIME';
  heroLeft.profile.userType = 'Employee';
}

const heroRight = demoUsersById.get(DEMO_COMPARISON_PAIR.right);
if (heroRight) {
  heroRight.status = 'ACTIVE';
  heroRight.profile.firstName = 'Tomas';
  heroRight.profile.lastName = 'Lindqvist';
  heroRight.profile.login = 'tomas.lindqvist@example.com';
  heroRight.profile.email = 'tomas.lindqvist@example.com';
  heroRight.profile.department = 'Engineering';
  heroRight.profile.title = 'Senior Software Engineer';
  heroRight.profile.city = 'Berlin';
  delete heroRight.profile.state;
  heroRight.profile.countryCode = 'DE';
  heroRight.profile.employeeType = 'CONTRACTOR';
  heroRight.profile.userType = 'Contractor';
}
