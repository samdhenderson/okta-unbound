/**
 * @module shared/rules/groupRuleIndex.test
 * @description Unit tests for the pure group→rule attribution helpers.
 */
import { describe, it, expect } from 'vitest';
import { countRulesByGroup, annotateGroupsWithRuleCounts } from './groupRuleIndex';
import type { GroupSummary } from '../types';

/** Minimal GroupSummary factory (only the fields the annotator reads/writes). */
function group(id: string, over: Partial<GroupSummary> = {}): GroupSummary {
  return {
    id,
    name: id,
    type: 'OKTA_GROUP',
    memberCount: 0,
    hasRules: false,
    ruleCount: 0,
    ...over,
  };
}

describe('countRulesByGroup', () => {
  it('tallies how many rules feed each group', () => {
    const counts = countRulesByGroup([
      { groupIds: ['a', 'b'] },
      { groupIds: ['b', 'c'] },
      { groupIds: ['b'] },
    ]);
    expect(counts.get('a')).toBe(1);
    expect(counts.get('b')).toBe(3);
    expect(counts.get('c')).toBe(1);
  });

  it('omits groups no rule targets', () => {
    const counts = countRulesByGroup([{ groupIds: ['a'] }]);
    expect(counts.has('z')).toBe(false);
  });

  it('counts a rule once per group even if it lists the group twice', () => {
    const counts = countRulesByGroup([{ groupIds: ['a', 'a'] }]);
    expect(counts.get('a')).toBe(1);
  });

  it('tolerates a missing groupIds field', () => {
    const counts = countRulesByGroup([{ groupIds: undefined as unknown as string[] }]);
    expect(counts.size).toBe(0);
  });
});

describe('annotateGroupsWithRuleCounts', () => {
  it('sets hasRules/ruleCount from the feeding rules', () => {
    const groups = [group('a'), group('b'), group('c')];
    const rules = [{ groupIds: ['a', 'b'] }, { groupIds: ['b'] }];
    const annotated = annotateGroupsWithRuleCounts(groups, rules);

    expect(annotated.find((g) => g.id === 'a')).toMatchObject({ hasRules: true, ruleCount: 1 });
    expect(annotated.find((g) => g.id === 'b')).toMatchObject({ hasRules: true, ruleCount: 2 });
    expect(annotated.find((g) => g.id === 'c')).toMatchObject({ hasRules: false, ruleCount: 0 });
  });

  it('does not mutate the input groups', () => {
    const groups = [group('a')];
    annotateGroupsWithRuleCounts(groups, [{ groupIds: ['a'] }]);
    expect(groups[0]).toMatchObject({ hasRules: false, ruleCount: 0 });
  });

  it('zeroes attribution when there are no rules', () => {
    const annotated = annotateGroupsWithRuleCounts(
      [group('a', { hasRules: true, ruleCount: 9 })],
      [],
    );
    expect(annotated[0]).toMatchObject({ hasRules: false, ruleCount: 0 });
  });
});
