/**
 * @module sidepanel/demo/demoRuleCoverage.test
 * @description The demo org's predicates and its declared rules are one list.
 *
 * `memberships.RULE_FED` fills a group by applying a predicate; `snapshot.demoRules`
 * declares the rules an admin can see. Those had drifted to twenty-three
 * predicates against nine rules, and the gap was invisible because nothing ever
 * evaluated a rule — the panel read the derived membership, and the reel worked
 * around the groups whose membership had no stated reason.
 *
 * This suite is the thing that evaluates them. It holds three properties:
 *
 * 1. Every rule-fed group either declares its predicate as a rule, verbatim, or
 *    carries a written exemption naming the invisible maintainer that fills it.
 * 2. No rule feeds a group that has no predicate — the drift's other direction.
 * 3. Running the declared expression through `shared/ruleEvaluator` over the org
 *    selects **exactly** the members the predicate derived. A rule whose
 *    condition does not reproduce the membership is worse than a missing rule,
 *    because the evaluator will then confidently disagree with the fixture.
 *
 * Property 3 carried one written-down exception, `EVALUATOR_CANNOT_REPRODUCE`,
 * for the VPN group: its predicate is `user.status == "ACTIVE"`, and the
 * evaluator resolved `user.*` against the profile only, so `status` came back
 * absent, absent came back `null`, and the rule confidently selected nobody in an
 * org where it selects everybody (D-114). Both halves of that are fixed, the
 * exception is gone, and the ordinary equality check below covers the group.
 */
import { describe, expect, it } from 'vitest';
import { tryEvaluateRuleExpression, type RuleGroupContext } from '../../shared/ruleEvaluator';
import { GROUP, RULE_FED_GROUPS, demoGroupMembers } from './memberships';
import { fakeId } from './org';
import { currentGroupsById, demoRules } from './snapshot';
import { demoUsers } from './users';

/** The groups allowed to be fed by a predicate no rule states. Named, not implied. */
const EXPECTED_EXEMPT_ORDINALS: readonly number[] = [GROUP.everyone, GROUP.workdayAllWorkers];

const groupId = (ordinal: number): string => fakeId('00g', ordinal);

const groupName = (ordinal: number): string =>
  currentGroupsById().get(groupId(ordinal))?.profile?.name ?? `<no group ${ordinal}>`;

const targets = (rule: (typeof demoRules)[number]): readonly string[] =>
  rule.actions?.assignUserToGroups?.groupIds ?? [];

const rulesTargeting = (ordinal: number) =>
  demoRules.filter((rule) => targets(rule).includes(groupId(ordinal)));

const declared = RULE_FED_GROUPS.filter((entry) => entry.expression !== null);
const exempt = RULE_FED_GROUPS.filter((entry) => entry.expression === null);

describe('every rule-fed demo group states its reason', () => {
  for (const entry of declared) {
    const name = groupName(entry.ordinal);

    it(`${name} is fed by a rule that declares its predicate`, () => {
      const matches = rulesTargeting(entry.ordinal);
      expect(
        matches.map((rule) => rule.name),
        `${name} is filled by a predicate; exactly one rule in demoRules must declare it`,
      ).toHaveLength(1);
      expect(matches[0]?.conditions?.expression?.value).toBe(entry.expression);
    });
  }

  for (const entry of exempt) {
    const name = groupName(entry.ordinal);

    it(`${name} is exempt, and says who fills it instead`, () => {
      expect(entry.exemption ?? '', `${name} has no rule and no written exemption`).not.toBe('');
      expect(
        rulesTargeting(entry.ordinal).map((rule) => rule.name),
        `${name} claims an exemption but a rule feeds it; drop the exemption`,
      ).toEqual([]);
    });
  }

  it('the exemption list is exactly the groups with an invisible maintainer', () => {
    expect(exempt.map((entry) => groupName(entry.ordinal)).sort()).toEqual(
      EXPECTED_EXEMPT_ORDINALS.map(groupName).sort(),
    );
  });

  it('no rule feeds a group that has no predicate', () => {
    const fed = new Set(RULE_FED_GROUPS.map((entry) => groupId(entry.ordinal)));
    const orphans = demoRules.flatMap((rule) =>
      targets(rule)
        .filter((id) => !fed.has(id))
        .map((id) => `${rule.name} → ${currentGroupsById().get(id)?.profile?.name ?? id}`),
    );
    expect(orphans).toEqual([]);
  });
});

/**
 * Every user's complete group list, in the shape `isMemberOf*` matches against.
 *
 * Built once, from the derived memberships — which is the same thing the panel
 * hands the evaluator at runtime, and the thing it used to omit. `isMemberOf*`
 * is two-valued over the list it is given (ADR-0021), so a partial list here
 * would not weaken the assertion below, it would invert it.
 */
const groupContextByUser = ((): ReadonlyMap<string, RuleGroupContext> => {
  const byUser = new Map<string, { id: string; name: string }[]>();
  for (const [id, members] of demoGroupMembers()) {
    const name = currentGroupsById().get(id)?.profile?.name ?? id;
    for (const userId of members) {
      const held = byUser.get(userId) ?? [];
      held.push({ id, name });
      byUser.set(userId, held);
    }
  }
  return byUser;
})();

describe('the declared expression selects the derived membership', () => {
  for (const entry of declared) {
    const name = groupName(entry.ordinal);
    const expression = entry.expression ?? '';

    it(`${name}'s rule evaluates to exactly its ${demoGroupMembers().get(groupId(entry.ordinal))?.length ?? 0} members`, () => {
      const derived = new Set(demoGroupMembers().get(groupId(entry.ordinal)) ?? []);
      const evaluated = new Set(
        demoUsers
          .filter(
            (user) =>
              tryEvaluateRuleExpression(expression, user, groupContextByUser.get(user.id) ?? []) ===
              'match',
          )
          .map((user) => user.id),
      );

      expect({
        group: name,
        inRuleNotInGroup: [...evaluated].filter((id) => !derived.has(id)).length,
        inGroupNotInRule: [...derived].filter((id) => !evaluated.has(id)).length,
      }).toEqual({ group: name, inRuleNotInGroup: 0, inGroupNotInRule: 0 });
    });
  }
});
