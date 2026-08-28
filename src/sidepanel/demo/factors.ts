/**
 * @module sidepanel/demo/factors
 * @description Who has enrolled which MFA factors — derived, never asserted.
 *
 * Same discipline as {@link module:sidepanel/demo/memberships}: nothing here is
 * a hand-typed count. Every user's factor set is computed from attributes the
 * demo org already carries — status, employee type, department, title — through
 * a seeded PRNG, so the coverage breakdown the panel renders is a *consequence*
 * of the org rather than a caption written to match a screenshot.
 *
 * That is the whole point for the coverage scene. It closes on the claim that
 * some number of people in a group have no second factor, and then filters the
 * member list to exactly those people. If the factor data were asserted and the
 * membership derived, the two would drift apart the first time either changed,
 * and the scene would be filming a lie that happens to look right.
 *
 * The shape of the population is deliberate rather than uniform, and each rule
 * below is one an administrator would recognise:
 *
 * - `STAGED` and `PROVISIONED` users have never completed activation, so they
 *   have nothing enrolled. This is not a risk finding, it is what those statuses
 *   mean, and a coverage report that treats them as gaps is crying wolf.
 * - `DEPROVISIONED` users keep no active factors.
 * - Contractors skew unenrolled: they are onboarded fastest and chased least.
 * - Security, IT and the Okta administrators carry Fastpass and a security key,
 *   because that population is the one that gets the hardware.
 * - Everyone else lands on a realistic long tail, with SMS still present in
 *   numbers, because an org where the only factor is a security key is not an
 *   org anybody watching this has ever worked in.
 *
 * Import order is `org → users → factors`. This module must not import from
 * `./snapshot` or `./memberships`, or the graph gains a cycle
 * (`npm run knip:circular`).
 */
import type { OktaFactor, OktaUser } from '../../shared/types';
import { SeededRandom, fakeId } from './org';
import { demoUsers } from './users';

/**
 * The factor kinds the demo org issues, as `factorType`/`provider` pairs.
 *
 * Kept as raw Okta shapes rather than as labels, so the panel's own
 * {@link module:shared/utils/mfaUtils.factorLabel} does the naming. A demo that
 * pre-labelled its factors would be testing the fixture, not the code.
 */
const FACTOR_KINDS = {
  fastpass: { factorType: 'signed_nonce', provider: 'OKTA' },
  push: { factorType: 'push', provider: 'OKTA' },
  oktaTotp: { factorType: 'token:software:totp', provider: 'OKTA' },
  googleTotp: { factorType: 'token:software:totp', provider: 'GOOGLE' },
  webauthn: { factorType: 'webauthn', provider: 'FIDO' },
  sms: { factorType: 'sms', provider: 'OKTA' },
  email: { factorType: 'email', provider: 'OKTA' },
} as const;

/** A factor kind's key. */
type FactorKind = keyof typeof FACTOR_KINDS;

/** Departments whose people are issued hardware and Fastpass as a matter of course. */
const HARDENED_DEPARTMENTS = new Set(['Security', 'IT']);

/**
 * Statuses that cannot hold an active factor.
 *
 * `STAGED` and `PROVISIONED` have not finished activating; `DEPROVISIONED` has
 * been torn down. Treating any of them as an enrollment gap would overstate the
 * finding, which is the same class of error the rule-impact module makes about
 * deactivation (see `DEBT.md`).
 */
const UNENROLLABLE_STATUSES = new Set(['STAGED', 'PROVISIONED', 'DEPROVISIONED']);

/**
 * Build one user's factor list.
 *
 * @param user - The user to derive factors for.
 * @param rng - The shared sequence, so the whole org is one deterministic draw.
 * @returns Zero or more factors, in the shape Okta's `/factors` endpoint returns.
 */
function factorsFor(user: OktaUser, rng: SeededRandom, ordinal: number): OktaFactor[] {
  const kinds: FactorKind[] = [];

  const isContractor = user.profile.employeeType === 'CONTRACTOR';
  const hardened =
    HARDENED_DEPARTMENTS.has(user.profile.department ?? '') ||
    /(^|\s)(Head|Director|VP|Chief)(\s|$)/.test(user.profile.title ?? '');

  // Draw for every user, enrolled or not, so that adding a status to
  // UNENROLLABLE_STATUSES cannot shift everyone else's factors underneath it.
  // A fixture whose unrelated rows change when one rule changes is a fixture
  // nobody will trust twice.
  const roll = rng.next();
  const secondRoll = rng.next();
  const thirdRoll = rng.next();

  if (UNENROLLABLE_STATUSES.has(user.status)) return [];

  if (hardened) {
    kinds.push('fastpass', 'webauthn');
    if (secondRoll < 0.4) kinds.push('push');
  } else if (isContractor) {
    // The long tail this scene exists to find. Roughly a third have nothing.
    if (roll < 0.34) return [];
    if (roll < 0.7) kinds.push('sms');
    else kinds.push('googleTotp');
    if (secondRoll < 0.15) kinds.push('email');
  } else {
    if (roll < 0.08) return [];
    if (roll < 0.5) kinds.push('push');
    else if (roll < 0.72) kinds.push('fastpass');
    else if (roll < 0.88) kinds.push('oktaTotp');
    else kinds.push('sms');

    if (secondRoll < 0.36) kinds.push(thirdRoll < 0.5 ? 'sms' : 'oktaTotp');
    if (secondRoll > 0.94) kinds.push('webauthn');
  }

  // Deduplicate: the draws above can legitimately land on the same kind twice,
  // and Okta does not return two enrollments of one factor type per user.
  const unique = [...new Set(kinds)];
  return unique.map((kind, i) => ({
    id: fakeId('ufs', ordinal * 10 + i),
    factorType: FACTOR_KINDS[kind].factorType,
    provider: FACTOR_KINDS[kind].provider,
    status: 'ACTIVE',
  }));
}

function buildFactors(): Map<string, OktaFactor[]> {
  // A seed of its own, so factor data cannot shift if the user or membership
  // generators change how many values they draw.
  const rng = new SeededRandom(0x4d4641);
  const byUser = new Map<string, OktaFactor[]>();
  demoUsers.forEach((user, i) => {
    byUser.set(user.id, factorsFor(user, rng, i + 1));
  });
  return byUser;
}

/**
 * Every demo user's active factors, keyed by user id.
 *
 * Built once at module load, like {@link module:sidepanel/demo/users.demoUsers}.
 */
export const demoFactorsByUser: ReadonlyMap<string, OktaFactor[]> = buildFactors();

/**
 * The factors for one user.
 *
 * @param userId - An Okta user id.
 * @returns The user's active factors, or an empty array for an unknown user —
 * which is also what Okta returns for a user who has enrolled nothing, so a
 * caller cannot tell the two apart and does not need to.
 */
export function demoFactorsFor(userId: string): OktaFactor[] {
  return demoFactorsByUser.get(userId) ?? [];
}
