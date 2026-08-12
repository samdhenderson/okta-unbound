/**
 * @module shared/membership/groupSource.test
 * @description Unit tests for the member-source aggregation.
 */

import { describe, it, expect } from 'vitest';
import { summarizeMemberSources, type GroupIdentity } from './groupSource';
import type { MembershipRule, OktaUser } from '../types';

function member(id: string, profile: Record<string, string> = {}): OktaUser {
  return {
    id,
    status: 'ACTIVE',
    profile: { login: `${id}@x.io`, email: `${id}@x.io`, firstName: id, lastName: 'U', ...profile },
  };
}

const oktaGroup: GroupIdentity = { id: 'g1', name: 'Engineering', type: 'OKTA_GROUP' };

const engRule: MembershipRule = {
  id: 'r1',
  name: 'Eng feeder',
  status: 'ACTIVE',
  groupIds: ['g1'],
  conditionExpression: 'user.department=="Eng"',
  userAttributes: ['department'],
};

describe('summarizeMemberSources', () => {
  it('classifies members with a matching active rule as rule-based', () => {
    const members = [member('u1', { department: 'Eng' }), member('u2', { department: 'Eng' })];
    const result = summarizeMemberSources(oktaGroup, members, [engRule]);
    expect(result).toMatchObject({ total: 2, direct: 0, ruleBased: 2 });
    expect(result.byRule).toEqual([{ ruleId: 'r1', ruleName: 'Eng feeder', count: 2 }]);
  });

  it('classifies members as manual when no rule targets the group', () => {
    const result = summarizeMemberSources(oktaGroup, [member('u1')], []);
    expect(result).toMatchObject({ total: 1, direct: 1, ruleBased: 0 });
    expect(result.byRule).toEqual([]);
  });

  it('treats APP_GROUP membership as application-managed (rule-based, no attributed rule)', () => {
    const appGroup: GroupIdentity = { id: 'g2', name: 'App Group', type: 'APP_GROUP' };
    const result = summarizeMemberSources(appGroup, [member('u1')], []);
    expect(result).toMatchObject({ total: 1, direct: 0, ruleBased: 1 });
    // Application-managed members have no group rule to attribute.
    expect(result.byRule).toEqual([]);
  });

  it('counts a member excluded from every feeding rule as manual', () => {
    const excludingRule: MembershipRule = {
      ...engRule,
      conditions: { people: { users: { exclude: ['u1'] } } },
    };
    const result = summarizeMemberSources(
      oktaGroup,
      [member('u1', { department: 'Eng' })],
      [excludingRule],
    );
    expect(result).toMatchObject({ direct: 1, ruleBased: 0 });
  });

  it('reports no unattributed members when every feeding rule can be evaluated', () => {
    const members = [member('u1', { department: 'Eng' }), member('u2', { department: 'Sales' })];
    const result = summarizeMemberSources(oktaGroup, members, [engRule]);
    // u2 does not satisfy the only feeding rule → a manual add, exactly known.
    expect(result).toMatchObject({ total: 2, direct: 1, ruleBased: 1, unattributed: 0 });
  });

  it('counts members as unattributed when a feeding rule cannot be evaluated', () => {
    const opaqueRule: MembershipRule = {
      ...engRule,
      id: 'r9',
      name: 'Opaque feeder',
      conditionExpression: 'isMemberOfGroup("00gFAKE")',
    };
    const result = summarizeMemberSources(
      oktaGroup,
      [member('u1', { department: 'Eng' })],
      [opaqueRule],
    );
    // Indeterminate: counted as rule-based (today's behavior) but flagged.
    expect(result).toMatchObject({ total: 1, direct: 0, ruleBased: 1, unattributed: 1 });
  });

  it('keeps unattributed a subset of ruleBased, never a fourth bucket', () => {
    const opaqueRule: MembershipRule = {
      ...engRule,
      id: 'r9',
      name: 'Opaque feeder',
      conditionExpression: 'isMemberOfGroup("00gFAKE")',
    };
    const members = [member('u1'), member('u2')];
    const result = summarizeMemberSources(oktaGroup, members, [opaqueRule]);
    expect(result.direct + result.ruleBased).toBe(result.total);
    expect(result.unattributed).toBeLessThanOrEqual(result.ruleBased);
  });

  it('tallies contributions across multiple rules, sorted by count', () => {
    const salesRule: MembershipRule = {
      id: 'r2',
      name: 'Sales feeder',
      status: 'ACTIVE',
      groupIds: ['g1'],
      conditionExpression: 'user.department=="Sales"',
      userAttributes: ['department'],
    };
    const members = [
      member('u1', { department: 'Eng' }),
      member('u2', { department: 'Eng' }),
      member('u3', { department: 'Sales' }),
    ];
    const result = summarizeMemberSources(oktaGroup, members, [engRule, salesRule]);
    expect(result.ruleBased).toBe(3);
    expect(result.byRule[0]).toEqual({ ruleId: 'r1', ruleName: 'Eng feeder', count: 2 });
    expect(result.byRule[1]).toEqual({ ruleId: 'r2', ruleName: 'Sales feeder', count: 1 });
  });
});

/**
 * Okta's own per-member attribution, embedded by `expand=group-rules` on the
 * membership listing (`shared/membership/memberRuleAttribution`). It is the same
 * data the admin console's "assigned by rule" column shows, so it outranks the
 * client-side heuristic wherever it is present.
 *
 * Rule ids use the real `0pr…` prefix — a rule id, not a group id.
 */
describe('summarizeMemberSources with Okta-embedded rule attribution', () => {
  /** A member row as the listing returns it when `expand=group-rules` was honoured. */
  function memberWithEmbed(
    id: string,
    embedded: unknown,
    profile: Record<string, string> = {},
  ): OktaUser & { _embedded: unknown } {
    return { ...member(id, profile), _embedded: embedded };
  }

  /** Shorthand for the embed Okta returns when it names `rules` for a member. */
  function groupRulesEmbed(rules: unknown[]): unknown {
    return { 'group-rules': rules };
  }

  const opaqueRule: MembershipRule = {
    ...engRule,
    id: '0prFAKEOPAQUE',
    name: 'Opaque feeder',
    conditionExpression: 'isMemberOfGroup("00gFAKE")',
  };

  it("attributes a member to the rule Okta names, overriding the heuristic's guess", () => {
    // Profile does not satisfy the only feeding rule, so the heuristic alone
    // would call this a manual add. Okta says otherwise, and Okta is right.
    const members = [
      memberWithEmbed('u1', groupRulesEmbed([{ id: '0prFAKE1', name: 'Eng feeder' }]), {
        department: 'Sales',
      }),
    ];

    const result = summarizeMemberSources(oktaGroup, members, [engRule]);

    expect(result).toMatchObject({ total: 1, direct: 0, ruleBased: 1, unattributed: 0 });
    expect(result.byRule).toEqual([{ ruleId: '0prFAKE1', ruleName: 'Eng feeder', count: 1 }]);
  });

  // The centrepiece: an EMPTY array and an ABSENT key are different answers.
  // Collapsing empty→absent under-reports manual adds; collapsing absent→empty
  // turns an unknown into a confident manual add. Both are the bug this exists
  // to remove.
  it('separates an empty group-rules array (authoritative manual add) from an absent one (unknown)', () => {
    const emptyArray = summarizeMemberSources(
      oktaGroup,
      [memberWithEmbed('u1', groupRulesEmbed([]))],
      [opaqueRule],
    );
    const absentKey = summarizeMemberSources(oktaGroup, [member('u1')], [opaqueRule]);

    // Okta positively asserted "no rule feeds this member" — a manual add, known
    // exactly, even though the unevaluable rule makes the heuristic guess
    // RULE_BASED.
    expect(emptyArray).toMatchObject({ total: 1, direct: 1, ruleBased: 0, unattributed: 0 });
    // Okta said nothing, so the heuristic decides — and flags its own guess.
    expect(absentKey).toMatchObject({ total: 1, direct: 0, ruleBased: 1, unattributed: 1 });
  });

  it('treats an empty _embedded object (no group-rules key) as unknown, not as "no rule"', () => {
    const result = summarizeMemberSources(oktaGroup, [memberWithEmbed('u1', {})], [opaqueRule]);

    expect(result).toMatchObject({ total: 1, direct: 0, ruleBased: 1, unattributed: 1 });
  });

  it('credits a two-rule member to both rules while counting the member once', () => {
    const members = [
      memberWithEmbed(
        'u1',
        groupRulesEmbed([
          { id: '0prFAKE1', name: 'Eng feeder' },
          { id: '0prFAKE2', name: 'Contractor feeder' },
        ]),
      ),
    ];

    const result = summarizeMemberSources(oktaGroup, members, [engRule]);

    // One member, not two — byRule counts attributions, total counts people.
    expect(result).toMatchObject({ total: 1, direct: 0, ruleBased: 1, unattributed: 0 });
    expect(result.direct + result.ruleBased).toBe(result.total);
    expect(result.byRule).toEqual([
      { ruleId: '0prFAKE1', ruleName: 'Eng feeder', count: 1 },
      { ruleId: '0prFAKE2', ruleName: 'Contractor feeder', count: 1 },
    ]);
  });

  it.each([
    ['a non-object embed', 'nope'],
    ['a null embed', null],
    ['a non-array group-rules value', { 'group-rules': 'nope' }],
    ['entries missing id/name', { 'group-rules': [{}, { id: 42 }] }],
    ['a null entry', { 'group-rules': [null] }],
  ])('never drops a member on %s — it falls back to the heuristic', (_label, embedded) => {
    const members = [memberWithEmbed('u1', embedded), member('u2')];

    const result = summarizeMemberSources(oktaGroup, members, [engRule]);

    // Under-reporting membership would be worse than mis-attributing it.
    expect(result.total).toBe(2);
    expect(result.direct + result.ruleBased).toBe(result.total);
  });

  it('mixes Okta-attributed and heuristic-attributed members in one group', () => {
    const members = [
      memberWithEmbed('u1', groupRulesEmbed([{ id: '0prFAKE1', name: 'Eng feeder' }])),
      memberWithEmbed('u2', groupRulesEmbed([])),
      member('u3', { department: 'Eng' }), // no embed → heuristic, matches engRule
      member('u4', { department: 'Sales' }), // no embed → heuristic, manual add
    ];

    const result = summarizeMemberSources(oktaGroup, members, [engRule]);

    expect(result).toMatchObject({ total: 4, direct: 2, ruleBased: 2, unattributed: 0 });
    expect(result.byRule).toEqual([
      { ruleId: '0prFAKE1', ruleName: 'Eng feeder', count: 1 },
      { ruleId: 'r1', ruleName: 'Eng feeder', count: 1 },
    ]);
  });

  it('counts a two-rule member once, in multiRuleMembers, and in no rule’s soleCount', () => {
    const members = [
      memberWithEmbed(
        'u1',
        groupRulesEmbed([
          { id: '0prFAKE1', name: 'Eng feeder' },
          { id: '0prFAKE2', name: 'Contractor feeder' },
        ]),
      ),
      memberWithEmbed('u2', groupRulesEmbed([{ id: '0prFAKE1', name: 'Eng feeder' }])),
    ];

    const result = summarizeMemberSources(oktaGroup, members, [engRule]);

    // byRule credits the shared member to both rules (2 + 1 = 3 attributions for
    // 2 people); the exclusive counts must not.
    expect(result.byRule.map((r) => r.count)).toEqual([2, 1]);
    expect(result.multiRuleMembers).toBe(1);
    expect(result.byRuleMembers).toEqual([
      {
        ruleId: '0prFAKE1',
        ruleName: 'Eng feeder',
        soleCount: 1,
        oktaAttributedCount: 2,
        clientAttributedCount: 0,
      },
      {
        ruleId: '0prFAKE2',
        ruleName: 'Contractor feeder',
        soleCount: 0,
        oktaAttributedCount: 1,
        clientAttributedCount: 0,
      },
    ]);
  });

  it('keeps the exclusive counts within the rule-managed member budget', () => {
    // The invariant every stacked-meter segment set is built on:
    // Σ soleCount + multiRuleMembers + unattributed <= ruleBased.
    const opaque: MembershipRule = {
      ...engRule,
      id: '0prFAKEOPAQUE2',
      conditionExpression: 'isMemberOfGroup("00gFAKE")',
    };
    const members = [
      memberWithEmbed('u1', groupRulesEmbed([{ id: '0prFAKE1', name: 'Eng feeder' }])),
      memberWithEmbed(
        'u2',
        groupRulesEmbed([
          { id: '0prFAKE1', name: 'Eng feeder' },
          { id: '0prFAKE2', name: 'Contractor feeder' },
        ]),
      ),
      member('u3'), // no embed → heuristic, and the rule cannot be evaluated
      memberWithEmbed('u4', groupRulesEmbed([])), // Okta: manual add
    ];

    const result = summarizeMemberSources(oktaGroup, members, [opaque]);

    const sole = (result.byRuleMembers ?? []).reduce((sum, r) => sum + r.soleCount, 0);
    expect(sole + (result.multiRuleMembers ?? 0) + result.unattributed).toBeLessThanOrEqual(
      result.ruleBased,
    );
    expect(result.direct + result.ruleBased).toBe(result.total);
  });

  it('separates Okta-asserted attributions from client-side deductions per rule', () => {
    const members = [
      memberWithEmbed('u1', groupRulesEmbed([{ id: 'r1', name: 'Eng feeder' }]), {
        department: 'Sales',
      }),
      member('u2', { department: 'Eng' }), // no embed → the heuristic matches engRule
    ];

    const result = summarizeMemberSources(oktaGroup, members, [engRule]);

    expect(result.byRule).toEqual([{ ruleId: 'r1', ruleName: 'Eng feeder', count: 2 }]);
    expect(result.byRuleMembers).toEqual([
      {
        ruleId: 'r1',
        ruleName: 'Eng feeder',
        soleCount: 2,
        oktaAttributedCount: 1,
        clientAttributedCount: 1,
      },
    ]);
  });

  it('gives an inferred member no rule segment — it is already counted as indeterminate', () => {
    const opaque: MembershipRule = {
      ...engRule,
      conditionExpression: 'isMemberOfGroup("00gFAKE")',
    };

    const result = summarizeMemberSources(oktaGroup, [member('u1')], [opaque]);

    expect(result).toMatchObject({ ruleBased: 1, unattributed: 1, multiRuleMembers: 0 });
    expect(result.byRuleMembers).toEqual([
      {
        ruleId: 'r1',
        ruleName: 'Eng feeder',
        soleCount: 0,
        oktaAttributedCount: 0,
        clientAttributedCount: 1,
      },
    ]);
  });

  it('keeps an APP_GROUP application-managed despite an empty group-rules embed', () => {
    // Group rules are not what feeds an APP_GROUP, so "no group rule" says
    // nothing about it — the application-managed classification still stands.
    const appGroup: GroupIdentity = { id: 'g2', name: 'App Group', type: 'APP_GROUP' };

    const result = summarizeMemberSources(
      appGroup,
      [memberWithEmbed('u1', groupRulesEmbed([]))],
      [],
    );

    expect(result).toMatchObject({ total: 1, direct: 0, ruleBased: 1 });
  });
});
