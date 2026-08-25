/**
 * @module shared/membership/memberSourceIndex
 * @description Per-member "why is this person in this group?", for surfaces
 * that show people rather than tallies.
 *
 * {@link module:shared/membership/groupSource.summarizeMemberSources} answers
 * the same question in aggregate: it classifies every member and then keeps only
 * the counters. That is the right shape for a meter and the wrong shape for a
 * list — a row has to name the rule that put *this* person here, and a filter
 * has to know which people are in the bucket a reader just clicked.
 *
 * This module keeps the verdicts. It shares
 * {@link module:shared/membership/groupSource.memberSourceVerdict} with the
 * summary, so the meter's segment counts and the filtered list's contents cannot
 * disagree about who is in which bucket.
 *
 * ## Costs nothing extra to ask
 *
 * Every input is already in hand. The roster is fetched with
 * `?expand=group-rules` (`useOktaApi/groupMembers.getAllGroupMembers`), the
 * member schema is `.passthrough()` and `_embedded` is declared `z.unknown()`,
 * so Okta's own attribution survives validation *and* the entity cache.
 * {@link readEmbeddedGroupRules} reads it back out. **No request is issued
 * here, and none is needed.**
 *
 * A consequence worth stating, because it looks like an inconsistency and is
 * not: a Group Detail member row can say "Okta confirms: added by rule X" for
 * free, where the equivalent User Detail row must spend an ADR-0031 request to
 * say the same thing. `GET /api/v1/users/{id}/groups` carries no embed; the
 * group-side listing does. That asymmetry is ADR-0020's contract, made visible.
 *
 * ## Why a `GroupMembership` and not a type of its own
 *
 * The whole explanation stack already consumes one — `membershipSourceLine`,
 * `membershipVerdict`/`membershipBucket`, `MembershipRuleEvidence` and its
 * `ClauseChecklist`, `MembershipProofAction`. A parallel vocabulary for the same
 * facts is the exact failure `shared/membership/sourceLine` was written to fix,
 * where a surface rendered nothing at all for three of six cases because it had
 * its own idea of the shape. Reuse means a group-side row explains a membership
 * with the same words, and the same hedging, as a user-side one.
 *
 * Unlike the summary, this **does** run the client-side heuristic for every
 * member even where Okta answered: Okta names rules, it does not describe them,
 * and a row that explains a membership clause by clause needs the evaluable
 * rule, not a bare reference. Provenance is then attached additively by
 * {@link withMembershipProvenance}, so a row holds both answers and can say
 * which is which.
 *
 * ## What this deliberately does not decide
 *
 * `otherRules` — the meter's aggregated tail — is **presentation**, not a fact
 * about a member. Which rules get their own segment depends on how wide the
 * meter is (`toMemberSourceSegments`' `maxRules`), so a member's bucket here is
 * always their *natural* one: their sole rule's `rule:<id>`, or `multiRule`,
 * `unattributed`, `ruleBased`, `direct`. A surface that aggregates a tail
 * resolves `otherRules` by unioning the `rule:<id>` sets it folded together —
 * it knows which those were; this module cannot.
 */
import type { GroupMembership, GroupType, MembershipRule, OktaGroup, OktaUser } from '../types';
import type { MemberSourceBucketKey } from '../../sidepanel/components/groups/memberSourceBuckets';
import { analyzeMemberships } from '../utils/membershipAnalysis';
import { readEmbeddedGroupRules } from './memberRuleAttribution';
import { withMembershipProvenance } from './provenance';
import { memberSourceVerdict, type GroupIdentity, type MemberSourceVerdict } from './groupSource';

/** One member's classification, keyed back to the person it describes. */
export interface MemberSourceClassification {
  /** The member's Okta id. */
  userId: string;
  /**
   * The membership as the classifier produced it, with Okta's answer attached
   * as `provenance` when the embed carried one. Additive: `membershipType`,
   * `rules` and `attribution` still describe what the *classifier* concluded.
   */
  membership: GroupMembership;
  /** The exclusive verdict the meter and the filter share. */
  verdict: MemberSourceVerdict;
  /** The member's natural bucket — see the module note on `otherRules`. */
  bucket: MemberSourceBucketKey;
}

/** Per-member source facts for one group's roster. */
export interface MemberSourceIndex {
  /** Every member's classification, keyed by user id. */
  byUserId: ReadonlyMap<string, MemberSourceClassification>;
  /**
   * The members in each natural bucket, keyed by bucket. Set membership rather
   * than a predicate: `otherRules` folds an arbitrary set of rules together, and
   * a predicate would have to be told which — a lookup just answers.
   */
  userIdsByBucket: ReadonlyMap<MemberSourceBucketKey, ReadonlySet<string>>;
}

/**
 * Which bucket a verdict puts a member in, naturally — before any
 * presentation-level aggregation of the tail.
 *
 * Order matters and mirrors the meter's own: a sole rule owns the member; else
 * a multi-rule member is its own bucket; else a deduced member is
 * indeterminate; else they are rule-managed with no single rule to name.
 */
function bucketOf(verdict: MemberSourceVerdict): MemberSourceBucketKey {
  if (verdict.kind === 'direct') return 'direct';
  if (verdict.soleRuleId !== null) return `rule:${verdict.soleRuleId}`;
  if (verdict.multiRule) return 'multiRule';
  if (verdict.deduced) return 'unattributed';
  return 'ruleBased';
}

/**
 * Classify one member's membership of one group.
 *
 * Pure — no API calls. Runs the client-side heuristic unconditionally (see the
 * module docs on why a row needs the evaluable rule even when Okta answered),
 * then attaches Okta's answer as provenance where there was one.
 *
 * @param group - The group being explained (id/name/type).
 * @param member - The member row, ideally as fetched with `expand=group-rules`
 * so Okta's own attribution is available.
 * @param rules - Candidate rules, ideally those targeting the group.
 * @returns This member's {@link MemberSourceClassification}.
 */
export function classifyMemberSource(
  group: GroupIdentity,
  member: OktaUser,
  rules: MembershipRule[],
): MemberSourceClassification {
  // `analyzeMemberships` classifies one user's groups; feed it a single-group
  // list shaped as the `OktaGroup` it expects (only id/type/profile.name read).
  const oktaGroup: OktaGroup = {
    id: group.id,
    type: group.type,
    profile: { name: group.name },
  };

  const answer = readEmbeddedGroupRules(member);
  const heuristic = analyzeMemberships([oktaGroup], rules, member)[0];
  const verdict = memberSourceVerdict(answer, heuristic, group.type as GroupType | undefined);

  return {
    userId: member.id,
    // Additive, and `unknown` attaches nothing — a silent or absent embed must
    // not leave a membership looking like it was proven.
    membership: withMembershipProvenance(heuristic, answer),
    verdict,
    bucket: bucketOf(verdict),
  };
}

/**
 * Classify every member of a group, and index them by user and by bucket.
 *
 * Pure — no API calls; every input is already in the entity cache. Cost is one
 * heuristic classification per member, the same order as the fallback path
 * `summarizeMemberSources` already pays in an org that does not honour
 * `expand=group-rules`.
 *
 * @param group - The group being explained (id/name/type).
 * @param members - The group's current members.
 * @param rules - Candidate rules, ideally those targeting the group.
 * @returns A {@link MemberSourceIndex} over exactly those members.
 *
 * @example
 * ```ts
 * const index = buildMemberSourceIndex(group, members, rules);
 * const manual = index.userIdsByBucket.get('direct') ?? new Set();
 * const why = index.byUserId.get(user.id)?.membership;
 * ```
 */
export function buildMemberSourceIndex(
  group: GroupIdentity,
  members: OktaUser[],
  rules: MembershipRule[],
): MemberSourceIndex {
  const byUserId = new Map<string, MemberSourceClassification>();
  const userIdsByBucket = new Map<MemberSourceBucketKey, Set<string>>();

  for (const member of members) {
    const classification = classifyMemberSource(group, member, rules);
    byUserId.set(member.id, classification);

    let bucket = userIdsByBucket.get(classification.bucket);
    if (!bucket) {
      bucket = new Set<string>();
      userIdsByBucket.set(classification.bucket, bucket);
    }
    bucket.add(member.id);
  }

  return { byUserId, userIdsByBucket };
}
