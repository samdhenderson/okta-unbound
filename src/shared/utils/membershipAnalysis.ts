/**
 * @module shared/utils/membershipAnalysis
 * @description Group-membership attribution heuristic — the app's single
 * *client-side* classifier, and the **fallback** attribution path.
 *
 * Okta's API does not directly say whether a user was placed in a group by a
 * group rule or added manually, so `analyzeMemberships` infers it. This is the
 * unified, exclusion-aware heuristic shared by `UsersTab` and
 * `hooks/useUserMemberships.ts` (which powers `UserOverview` and the user
 * comparison). It DOES consult rule exclusion lists: a user on the exclusion
 * list of every rule targeting a group is treated as a manual (DIRECT) add.
 * It ALSO evaluates each targeting rule's condition against the user
 * (`shared/ruleEvaluator`): when every condition can be evaluated client-side
 * and none matches, the user must have been added by hand, so the membership is
 * DIRECT. Only when some condition is unevaluable does the legacy coarse
 * heuristic apply, and the result is then labelled `inferred` or `ambiguous`.
 *
 * ## "Single source of truth" is now **conditional** — read this before relying on it
 *
 * There are two attribution mechanisms in the app, not one, and they do not
 * cover the same ground (ADR-0020):
 *
 * - The **group** path (`shared/membership/groupSource`) reads Okta's own
 *   `_embedded['group-rules']` first. When Okta answers — `rules` or the
 *   positive `no-rules` — that answer *outranks this module entirely*.
 * - The **user** path (`sidepanel/hooks/useUserMemberships`) has no such source:
 *   `GET /api/v1/users/{id}/groups` carries no attribution embed, so this module
 *   is the whole of what that screen knows.
 *
 * So this module is the single source of truth **only where Okta itself said
 * nothing**. The contract that replaces the old unconditional claim, and the one
 * `shared/membership/attributionParity.test.ts` pins, is:
 *
 * > For a given user and group, the two paths produce the **same** verdict
 * > whenever `readEmbeddedGroupRules` returns `unknown`. Where it does not, the
 * > group path is Okta-asserted, the user path is client-evaluated, and the
 * > difference is **provenance** — which the UI states rather than hides.
 *
 * Provenance is deliberately *not* a fourth {@link MembershipAttribution} value.
 * Attribution answers "how strong is the evidence?"; provenance answers "who
 * produced it?", and the two compose rather than nest. It is already carried
 * beside the attribution — `RuleMemberCounts.oktaAttributedCount` vs
 * `clientAttributedCount` on the group path — and that is where it belongs.
 *
 * ## What `exact` does and does not promise
 *
 * `exact` means *exact given the inputs supplied* — it is not a claim about
 * Okta's own books. Two input gaps can make a truthful-looking `exact` wrong,
 * and both are the caller's responsibility, not this module's:
 *
 * 1. **An incomplete rule inventory.** Classifying against a partial (or empty)
 *    rule list makes every group look untargeted, i.e. `DIRECT` / `exact`. A
 *    caller that failed to load the org's rules must report
 *    {@link unclassifiedMemberships} instead of calling this function.
 * 2. **An incomplete user profile.** `shared/ruleEvaluator` resolves an absent
 *    profile attribute to `null`, which compares as a definitive `no-match`
 *    rather than `unevaluable`. Feed this function the full profile.
 *
 * Any change to the classification behavior belongs in its own commit with the
 * characterization assertions flipped — do not "improve" it here.
 */

import type {
  OktaGroup,
  OktaUser,
  MembershipRule,
  GroupMembership,
  MembershipAttribution,
} from '../types';
import { tryEvaluateRuleExpression, type RuleMatchOutcome } from '../ruleEvaluator';
import { createLogger } from './logger';

const log = createLogger('membershipAnalysis');

/** What an attribution class means to a consumer that has to act on it. */
export interface AttributionSemantics {
  /**
   * `fact` when the classification was proven from data; `deduction` when the
   * classifier guessed. A `deduction` must never be rendered with the visual
   * weight of an answer, and is what the group meter counts as indeterminate.
   */
  evidence: 'fact' | 'deduction';
  /**
   * Whether the rules the membership carries may be **named** as its source.
   * `false` for `ambiguous`: the list is a candidate set, so crediting any of
   * its entries would manufacture an attribution the classifier does not have.
   */
  namesRules: boolean;
}

/**
 * How each attribution class is to be acted on.
 *
 * A `Record` keyed by {@link MembershipAttribution} on purpose: it is one of the
 * two exhaustive tables (the other is
 * `sidepanel/components/groups/memberSourceBuckets.ATTRIBUTION_BUCKET`) that
 * make widening the union a compile error instead of a silent fall-through into
 * the confident branch.
 */
const ATTRIBUTION_SEMANTICS: Record<MembershipAttribution, AttributionSemantics> = {
  exact: { evidence: 'fact', namesRules: true },
  inferred: { evidence: 'deduction', namesRules: true },
  ambiguous: { evidence: 'deduction', namesRules: false },
};

/**
 * How to act on one attribution class — see {@link AttributionSemantics}.
 *
 * @param attribution - The classification's attribution label.
 * @returns Its evidence kind and whether its rules may be named as the source.
 */
export function attributionSemantics(attribution: MembershipAttribution): AttributionSemantics {
  return ATTRIBUTION_SEMANTICS[attribution];
}

/**
 * Whether an attribution is a deduction rather than a fact — i.e. whether a
 * caller must present it as unconfirmed.
 *
 * @param attribution - The classification's attribution label.
 * @returns `true` for every guessing class, `false` only for `exact`.
 */
export function isDeducedAttribution(attribution: MembershipAttribution): boolean {
  return ATTRIBUTION_SEMANTICS[attribution].evidence === 'deduction';
}

/**
 * Whether an attribution licenses naming the rules it carries as the membership's
 * source (crediting them in a per-rule tally, deep-linking them as "added by").
 *
 * @param attribution - The classification's attribution label.
 * @returns `true` when each carried rule is at least a plausible source.
 */
export function attributionNamesRules(attribution: MembershipAttribution): boolean {
  return ATTRIBUTION_SEMANTICS[attribution].namesRules;
}

/**
 * Whether `userId` is explicitly excluded from a rule. Excluded users are not
 * affected by the rule even if they otherwise match its conditions.
 *
 * Reads **both** shapes a rule can arrive in, because the two attribution paths
 * do not agree on one. A raw Okta rule carries its exclusions under
 * `conditions.people.users.exclude`; a formatted rule
 * (`shared/ruleUtils.formatRuleForDisplay`, the only shape the user path ever
 * sees) carries them as {@link MembershipRule.excludedUserIds}. Reading only the
 * raw field is what let this function answer `false` for every cache-served
 * rule, so an explicitly-excluded user was still attributed to the rule that
 * excludes them (D-048).
 *
 * @param rule - The rule, raw or formatted.
 * @param userId - The user being attributed.
 * @returns `true` when the rule names this user in its exclusion list.
 */
function isUserExcludedFromRule(rule: MembershipRule, userId: string): boolean {
  // The union, not the first shape that answers: the formatter always sets
  // `excludedUserIds` (empty when there are none), so preferring it would make an
  // empty formatted list hide a raw `conditions` block on any rule carrying both.
  return (
    (rule.excludedUserIds?.includes(userId) ?? false) ||
    (rule.conditions?.people?.users?.exclude?.includes(userId) ?? false)
  );
}

/**
 * A rule's condition expression, whichever shape the rule arrived in. Empty
 * when the rule carries no expression at all — which the evaluator reports as
 * `unevaluable`, not as "matches nothing".
 */
function conditionExpressionOf(rule: MembershipRule): string {
  return rule.conditionExpression || rule.conditions?.expression?.value || '';
}

/**
 * Legacy coarse scorer, used only for candidate rules whose conditions could not
 * be evaluated.
 *
 * Returns **every** candidate whose referenced user attributes have values that
 * appear (as a lowercased substring — this is deliberately crude) in that
 * candidate's own condition text. That is the only positive evidence this
 * heuristic can produce; when it produces none, the caller must not pretend the
 * first array element is an answer.
 *
 * Callers must pass only rules the evaluator did **not** already rule out: a
 * definitive `no-match` outranks any amount of substring coincidence, and
 * scoring such a rule would credit a rule proven not to apply.
 *
 * @param rules - Candidate rules, already filtered to exclusions and `no-match`.
 * @param user - The user being attributed.
 * @returns The candidates with positive scoring evidence, in input order.
 *   Possibly empty.
 */
function scoreCandidateRules(rules: MembershipRule[], user: OktaUser): MembershipRule[] {
  return rules.filter((rule) => {
    const condition = conditionExpressionOf(rule).toLowerCase();
    const userAttrs = rule.userAttributes || [];

    let attributesMatch = 0;
    let attributesChecked = 0;

    for (const attr of userAttrs) {
      attributesChecked++;
      const userValue = (user.profile as Record<string, unknown>)[attr];

      // Only a present, non-empty value can be evidence of anything.
      if (userValue !== undefined && userValue !== null && userValue !== '') {
        const valueStr = String(userValue).toLowerCase();
        if (condition.includes(valueStr) || condition.includes(`"${valueStr}"`)) {
          attributesMatch++;
        }
      }
    }

    return attributesChecked > 0 && attributesMatch >= attributesChecked * 0.5;
  });
}

/** A classified membership, before the group is attached. */
type Classification = Pick<GroupMembership, 'membershipType' | 'rules' | 'attribution'>;

/**
 * A membership no rule explains. A factory rather than a shared constant so no
 * two memberships ever alias the same `rules` array.
 */
const direct = (): Classification => ({
  membershipType: 'DIRECT',
  rules: [],
  attribution: 'exact',
});

/**
 * The honest answer for a set of groups that could **not** be classified at all,
 * because the inputs the classifier needs were unavailable.
 *
 * The failure mode this exists to prevent: calling {@link analyzeMemberships}
 * with an empty or partial rule list. Every group then looks untargeted and
 * comes back `DIRECT` with `attribution: 'exact'` — a *fact* claim ("this person
 * was added by hand") manufactured out of a failed rules fetch. `UNKNOWN` plus
 * `ambiguous` is the vocabulary's sanctioned way to say "not classified"
 * (see {@link MembershipAttribution}), and every consumer already renders it as
 * an absence of an answer rather than as an answer.
 *
 * Callers must not cache the result as if it were an analysis — it describes the
 * load that failed, not the org.
 *
 * @param groups - The user's groups, exactly as fetched.
 * @returns One unclassified {@link GroupMembership} per group, in input order.
 */
export function unclassifiedMemberships(groups: OktaGroup[]): GroupMembership[] {
  return groups.map((group) => ({
    group,
    membershipType: 'UNKNOWN' as const,
    rules: [],
    attribution: 'ambiguous' as const,
  }));
}

/**
 * Classify each of a user's groups as `RULE_BASED` or `DIRECT`.
 *
 * Heuristics, in order:
 * 1. `APP_GROUP`s are always application-managed → `RULE_BASED`, no rule,
 *    `attribution: 'exact'`.
 * 2. A group with no targeting ACTIVE rule → `DIRECT` (`exact`).
 * 3. A user excluded from EVERY targeting ACTIVE rule, yet still in the group →
 *    `DIRECT` (`exact`) — they were added manually despite the rules.
 * 4. The user satisfies one or more non-excluding ACTIVE rules' conditions →
 *    `RULE_BASED` (`exact`), attributed to **all** of them. Two rules really can
 *    both put the same user in the same group; reporting only the first would be
 *    a fabricated singular answer.
 * 5. Every non-excluding ACTIVE rule's condition was evaluated and none matched
 *    → `DIRECT` (`exact`) — a manual add into a rule-fed group.
 * 6. Some condition is outside the client-side evaluable subset → `RULE_BASED`
 *    via the coarse scorer, over the candidates the evaluator did **not** rule
 *    out. Labelled `inferred` when the scorer found evidence or exactly one
 *    candidate survived; `ambiguous` when several indistinguishable candidates
 *    survived and no evidence separates them.
 *
 * Only case 6 guesses, and it says which kind of guess it made.
 *
 * @param groups - The user's groups (raw Okta group objects).
 * @param rules - Candidate group rules to attribute memberships to.
 * @param user - The user whose memberships are being analysed.
 * @returns One {@link GroupMembership} per input group, annotated with the
 *   evidence behind its classification and (when rule-based) the attributed
 *   rules.
 */
export function analyzeMemberships(
  groups: OktaGroup[],
  rules: MembershipRule[],
  user: OktaUser,
): GroupMembership[] {
  log.debug('Analyzing memberships for user:', user.id);
  log.debug(
    'Total rules:',
    rules.length,
    'Active rules:',
    rules.filter((r) => r.status === 'ACTIVE').length,
  );
  log.debug('Total groups:', groups.length);

  return groups.map((group) => ({ group, ...classify(group, rules, user) }));
}

/**
 * The per-group decision behind {@link analyzeMemberships}, split out so the
 * six branches read as one ordered list instead of six early returns threading
 * the group object through.
 *
 * Logging here is reason codes and identifiers only — never condition text,
 * group names, or resolved profile values.
 */
function classify(group: OktaGroup, rules: MembershipRule[], user: OktaUser): Classification {
  // 1. APP_GROUPs are always managed by the application (rule-based), and no
  //    *group rule* explains them, so there is nothing to attribute.
  if (group.type === 'APP_GROUP') {
    log.debug(`Group ${group.id}: APP_GROUP (application managed)`);
    return { membershipType: 'RULE_BASED', rules: [], attribution: 'exact' };
  }

  // Find ACTIVE rules that assign users to this group.
  const targetingRules = rules.filter((rule) => {
    if (rule.status !== 'ACTIVE') return false;
    const groupIds = rule.groupIds || rule.actions?.assignUserToGroups?.groupIds || [];
    return groupIds.includes(group.id);
  });

  log.debug(`Group ${group.id}: Found ${targetingRules.length} active rules`);

  // 2. No active rule targets this group — it must be a direct assignment.
  if (targetingRules.length === 0) {
    log.debug(`Group ${group.id}: DIRECT (no active rules)`);
    return direct();
  }

  // 3. Excluded from every targeting rule but still in the group = manual add.
  const candidates = targetingRules.filter((rule) => !isUserExcludedFromRule(rule, user.id));

  if (candidates.length === 0) {
    log.debug(`Group ${group.id}: DIRECT (user excluded from all ${targetingRules.length} rules)`);
    return direct();
  }

  if (candidates.length < targetingRules.length) {
    log.debug(
      `Group ${group.id}: user excluded from ${targetingRules.length - candidates.length} rule(s)`,
    );
  }

  // Ask each candidate rule whether the user actually satisfies its condition.
  // `unevaluable` is deliberately distinct from `no-match`: concluding "not
  // rule-managed" from an expression we failed to parse would be a new,
  // confidently wrong answer.
  const outcomes = candidates.map((rule): [MembershipRule, RuleMatchOutcome] => [
    rule,
    tryEvaluateRuleExpression(conditionExpressionOf(rule), user),
  ]);

  // 4. Every rule the user provably satisfies — not just the first one found.
  const matched = outcomes.filter(([, outcome]) => outcome === 'match').map(([rule]) => rule);
  if (matched.length > 0) {
    log.debug(
      `Group ${group.id}: RULE_BASED (${matched.length} matched rule(s), evidence: proven)`,
    );
    return { membershipType: 'RULE_BASED', rules: matched, attribution: 'exact' };
  }

  // 5. Everything was evaluable and nothing matched → added by hand.
  const unevaluated = outcomes
    .filter(([, outcome]) => outcome === 'unevaluable')
    .map(([rule]) => rule);
  if (unevaluated.length === 0) {
    log.debug(`Group ${group.id}: DIRECT (no rule condition matches; evidence: proven)`);
    return direct();
  }

  // 6. Fall back to the coarse scorer — but only over rules the evaluator did
  //    NOT rule out. A rule that returned `no-match` provably does not apply to
  //    this user, and no amount of substring coincidence outranks that.
  const scored = scoreCandidateRules(unevaluated, user);
  if (scored.length > 0) {
    log.debug(
      `Group ${group.id}: RULE_BASED (${scored.length} scored rule(s), evidence: attribute-in-condition)`,
    );
    return { membershipType: 'RULE_BASED', rules: scored, attribution: 'inferred' };
  }

  // Nothing scored. A single surviving candidate is still evidence — nothing
  // else could have granted the membership. Several are not: naming one would be
  // array order dressed up as an answer, so carry the whole candidate set and
  // say plainly that it is unresolved.
  const attribution: MembershipAttribution = unevaluated.length === 1 ? 'inferred' : 'ambiguous';
  log.debug(
    `Group ${group.id}: RULE_BASED (${unevaluated.length} unevaluable candidate(s), evidence: ${attribution === 'inferred' ? 'sole-candidate' : 'none'})`,
  );
  return { membershipType: 'RULE_BASED', rules: unevaluated, attribution };
}
