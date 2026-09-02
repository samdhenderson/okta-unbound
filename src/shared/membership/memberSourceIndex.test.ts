/**
 * @module shared/membership/memberSourceIndex.test
 * @description Unit tests for the per-member source index.
 *
 * The load-bearing property is **agreement with the summary**: the meter draws
 * `summarizeMemberSources`' counts and the filter selects this index's sets, so
 * a member who is rule-based in one and manual in the other is a bug a reader
 * would see. Several cases below assert both sides of the same roster.
 */

import { describe, it, expect } from 'vitest';
import { buildMemberSourceIndex, classifyMemberSource } from './memberSourceIndex';
import { summarizeMemberSources, type GroupIdentity } from './groupSource';
import type { MembershipRule, OktaUser } from '../types';

function member(id: string, profile: Record<string, string> = {}): OktaUser {
  return {
    id,
    status: 'ACTIVE',
    profile: {
      login: `${id}@example.com`,
      email: `${id}@example.com`,
      firstName: id,
      lastName: 'U',
      ...profile,
    },
  };
}

/** A member row as the listing returns it when `expand=group-rules` was honoured. */
function memberWithEmbed(
  id: string,
  rules: unknown[],
  profile: Record<string, string> = {},
): OktaUser {
  return { ...member(id, profile), _embedded: { 'group-rules': rules } } as OktaUser;
}

const oktaGroup: GroupIdentity = { id: 'g1', name: 'Engineering', type: 'OKTA_GROUP' };
const appGroup: GroupIdentity = { id: 'g2', name: 'Salesforce Users', type: 'APP_GROUP' };

const engRule: MembershipRule = {
  id: 'r1',
  name: 'Eng feeder',
  status: 'ACTIVE',
  groupIds: ['g1'],
  conditionExpression: 'user.department=="Eng"',
  userAttributes: ['department'],
};

const salesRule: MembershipRule = {
  ...engRule,
  id: 'r2',
  name: 'Sales feeder',
  conditionExpression: 'user.department=="Sales"',
};

/** A rule whose condition the client cannot evaluate, forcing a deduction. */
const opaqueRule: MembershipRule = {
  ...engRule,
  id: 'r3',
  name: 'Opaque feeder',
  conditionExpression: 'isMemberOfGroup("00gFAKE")',
};

describe('classifyMemberSource', () => {
  it('buckets a member to the single rule that explains them', () => {
    const result = classifyMemberSource(oktaGroup, member('u1', { department: 'Eng' }), [engRule]);

    expect(result.userId).toBe('u1');
    expect(result.verdict.kind).toBe('ruleBased');
    expect(result.verdict.soleRuleId).toBe('r1');
    expect(result.bucket).toBe('rule:r1');
  });

  it('buckets a member no rule explains as direct', () => {
    const result = classifyMemberSource(oktaGroup, member('u1', { department: 'Legal' }), [
      engRule,
    ]);

    expect(result.verdict.kind).toBe('direct');
    expect(result.verdict.credited).toEqual([]);
    expect(result.bucket).toBe('direct');
  });

  it('buckets a member two rules explain as multiRule, owned by neither', () => {
    // Both conditions hold, so no single rule exclusively explains this member.
    const bothRule: MembershipRule = {
      ...salesRule,
      conditionExpression: 'user.department=="Eng"',
    };
    const result = classifyMemberSource(oktaGroup, member('u1', { department: 'Eng' }), [
      engRule,
      bothRule,
    ]);

    expect(result.verdict.multiRule).toBe(true);
    expect(result.verdict.soleRuleId).toBeNull();
    expect(result.bucket).toBe('multiRule');
  });

  it('buckets a deduced member as unattributed, not to a rule segment', () => {
    const result = classifyMemberSource(oktaGroup, member('u1', { department: 'Eng' }), [
      opaqueRule,
    ]);

    expect(result.verdict.kind).toBe('ruleBased');
    expect(result.verdict.deduced).toBe(true);
    // A deduction owns no exclusive segment — it is already carried by
    // `unattributed`, and a rule segment too would count one person twice.
    expect(result.verdict.soleRuleId).toBeNull();
    expect(result.bucket).toBe('unattributed');
  });

  it("prefers Okta's answer over the heuristic's guess, and records it as provenance", () => {
    // The profile does not satisfy the feeding rule, so the heuristic alone
    // would call this a manual add. Okta says otherwise, and Okta is right.
    const row = memberWithEmbed('u1', [{ id: 'r1', name: 'Eng feeder' }], { department: 'Sales' });
    const result = classifyMemberSource(oktaGroup, row, [engRule]);

    expect(result.verdict.kind).toBe('ruleBased');
    expect(result.verdict.creditedBy).toBe('okta');
    expect(result.bucket).toBe('rule:r1');
    expect(result.membership.provenance).toEqual({
      source: 'okta',
      rules: [{ id: 'r1', name: 'Eng feeder' }],
    });
  });

  it('attaches no provenance when Okta said nothing — absent is not an answer', () => {
    const result = classifyMemberSource(oktaGroup, member('u1', { department: 'Eng' }), [engRule]);
    expect(result.membership.provenance).toBeUndefined();
  });

  it('keeps the evaluable rule on the membership even when Okta named it', () => {
    // The whole reason this runs the heuristic unconditionally: Okta names
    // rules, it does not describe them, and a row explains a membership clause
    // by clause. `provenance.rules` are bare references; `membership.rules`
    // carry the condition.
    const row = memberWithEmbed('u1', [{ id: 'r1', name: 'Eng feeder' }], { department: 'Eng' });
    const result = classifyMemberSource(oktaGroup, row, [engRule]);

    expect(result.membership.rules[0]?.conditionExpression).toBe('user.department=="Eng"');
    expect(result.membership.provenance?.rules[0]).toEqual({ id: 'r1', name: 'Eng feeder' });
  });

  it("treats Okta's empty embed on an APP_GROUP as saying nothing, not as a manual add", () => {
    // The source there is the application, not a group rule, so an empty
    // group-rules embed is not evidence of a manual add.
    const result = classifyMemberSource(appGroup, memberWithEmbed('u1', []), []);
    expect(result.verdict.kind).toBe('ruleBased');
    expect(result.bucket).toBe('ruleBased');
  });
});

describe('buildMemberSourceIndex', () => {
  it('indexes every member by id and by bucket', () => {
    const members = [
      member('u1', { department: 'Eng' }),
      member('u2', { department: 'Eng' }),
      member('u3', { department: 'Legal' }),
    ];

    const index = buildMemberSourceIndex(oktaGroup, members, [engRule]);

    expect(index.byUserId.size).toBe(3);
    expect(index.userIdsByBucket.get('rule:r1')).toEqual(new Set(['u1', 'u2']));
    expect(index.userIdsByBucket.get('direct')).toEqual(new Set(['u3']));
  });

  it('omits buckets nobody is in, rather than mapping them to an empty set', () => {
    const index = buildMemberSourceIndex(
      oktaGroup,
      [member('u1', { department: 'Legal' })],
      [engRule],
    );

    expect(index.userIdsByBucket.has('direct')).toBe(true);
    expect(index.userIdsByBucket.has('multiRule')).toBe(false);
    expect(index.userIdsByBucket.has('unattributed')).toBe(false);
  });

  it('handles an empty roster without inventing buckets', () => {
    const index = buildMemberSourceIndex(oktaGroup, [], [engRule]);
    expect(index.byUserId.size).toBe(0);
    expect(index.userIdsByBucket.size).toBe(0);
  });

  // The property the meter and the filter both depend on. If these drift, a
  // reader sees "62 by rule" on the meter and a different number of rows after
  // clicking that segment.
  describe('agrees with summarizeMemberSources', () => {
    const cases: Array<{
      name: string;
      group: GroupIdentity;
      members: OktaUser[];
      rules: MembershipRule[];
    }> = [
      {
        name: 'a mixed roster of rule-managed and manual members',
        group: oktaGroup,
        members: [
          member('u1', { department: 'Eng' }),
          member('u2', { department: 'Sales' }),
          member('u3', { department: 'Legal' }),
        ],
        rules: [engRule, salesRule],
      },
      {
        name: 'a roster Okta attributed itself',
        group: oktaGroup,
        members: [
          memberWithEmbed('u1', [{ id: 'r1', name: 'Eng feeder' }], { department: 'Sales' }),
          memberWithEmbed('u2', [], { department: 'Eng' }),
        ],
        rules: [engRule],
      },
      {
        name: 'a roster with a deduced member',
        group: oktaGroup,
        members: [member('u1', { department: 'Eng' }), member('u2', { department: 'Eng' })],
        rules: [opaqueRule],
      },
      {
        name: 'an APP_GROUP, whose members no group rule explains',
        group: appGroup,
        members: [member('u1'), member('u2')],
        rules: [],
      },
    ];

    it.each(cases)('$name', ({ group, members, rules }) => {
      const summary = summarizeMemberSources(group, members, rules);
      const index = buildMemberSourceIndex(group, members, rules);

      const classifications = [...index.byUserId.values()];
      const ruleBased = classifications.filter((c) => c.verdict.kind === 'ruleBased').length;
      const direct = classifications.filter((c) => c.verdict.kind === 'direct').length;
      const deduced = classifications.filter((c) => c.verdict.deduced).length;
      const multiRule = classifications.filter(
        (c) => c.verdict.kind === 'ruleBased' && c.verdict.multiRule,
      ).length;

      expect({ total: classifications.length, ruleBased, direct, deduced, multiRule }).toEqual({
        total: summary.total,
        ruleBased: summary.ruleBased,
        direct: summary.direct,
        deduced: summary.unattributed,
        multiRule: summary.multiRuleMembers,
      });

      // Every member lands in exactly one bucket, and the buckets partition the
      // roster — the invariant a stacked meter's track depends on.
      const bucketed = [...index.userIdsByBucket.values()].reduce((sum, set) => sum + set.size, 0);
      expect(bucketed).toBe(members.length);
    });

    it("matches each rule's exclusive member count", () => {
      const members = [
        member('u1', { department: 'Eng' }),
        member('u2', { department: 'Eng' }),
        member('u3', { department: 'Sales' }),
      ];

      const summary = summarizeMemberSources(oktaGroup, members, [engRule, salesRule]);
      const index = buildMemberSourceIndex(oktaGroup, members, [engRule, salesRule]);

      for (const rule of summary.byRuleMembers ?? []) {
        expect(index.userIdsByBucket.get(`rule:${rule.ruleId}`)?.size ?? 0).toBe(rule.soleCount);
      }
    });
  });
});
