/**
 * @module shared/membership/provenance
 * @description Turning Okta's own per-membership answer into the additive
 * `provenance` field a membership carries.
 *
 * The user-detail page classifies memberships with a client-side heuristic,
 * because `GET /api/v1/users/{id}/groups` carries no attribution embed. ADR-0031
 * gives a reader one way out, per row and on demand:
 * `GET /api/v1/groups/{groupId}/users/{userId}/group-rules` returns the rules
 * Okta itself says manage that membership. This module is the join between that
 * answer and the membership object.
 *
 * ## The one thing this module exists to protect
 *
 * {@link MemberRuleAttribution} has **three** states and only two of them are
 * answers. `no-rules` is Okta asserting a manual add; `unknown` is Okta having
 * said nothing (or the request having failed). Collapsing them would let a
 * failed request render as a confident "added directly", which is exactly the
 * class of manufactured fact ADR-0020 §4 removed from this path. So:
 *
 * - `rules` → provenance naming those rules;
 * - `no-rules` → provenance with an **empty** rule list — still an answer;
 * - `unknown` → **no provenance at all**, and the membership comes back
 *   untouched.
 *
 * ## Additive, never a rewrite
 *
 * {@link withMembershipProvenance} does not touch `membershipType`, `rules` or
 * `attribution`. Okta's answer names rules, it does not describe them, so
 * over-writing the classifier's `rules` would replace evaluable rules (which the
 * UI explains clause by clause) with bare references. The two answers sit side by
 * side and the surface says which is which — ADR-0020 §3's shape, not a fourth
 * attribution level.
 *
 * Rule names are end-user-controllable Okta data: nothing here is logged, and
 * consumers render them as escaped React text.
 */
import type { GroupMembership, MembershipProvenance } from '../types';
import type { MemberRuleAttribution } from './memberRuleAttribution';

/**
 * Convert Okta's three-state answer into a provenance, or nothing.
 *
 * @param answer - What Okta said about this membership.
 * @returns A {@link MembershipProvenance} for either of the two *answers*, and
 * `undefined` for `unknown` — the absence of an answer is never encoded as an
 * empty one.
 */
export function membershipProvenanceOf(
  answer: MemberRuleAttribution,
): MembershipProvenance | undefined {
  if (answer.state === 'unknown') return undefined;
  return {
    source: 'okta',
    // `no-rules` is an authoritative manual add: an empty list, not a missing one.
    rules: answer.state === 'rules' ? answer.rules.map(({ id, name }) => ({ id, name })) : [],
  };
}

/**
 * Attach Okta's answer to a membership.
 *
 * @param membership - The membership as the classifier produced it.
 * @param answer - What Okta said when asked about this membership.
 * @returns A copy carrying `provenance`, or **the original object** when Okta
 * said nothing — so a silent or failed read cannot leave a membership looking
 * like it was proven.
 */
export function withMembershipProvenance(
  membership: GroupMembership,
  answer: MemberRuleAttribution,
): GroupMembership {
  const provenance = membershipProvenanceOf(answer);
  return provenance ? { ...membership, provenance } : membership;
}
