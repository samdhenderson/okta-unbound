/**
 * @module shared/rules/groupRuleIndex.test
 * @description Unit tests for the pure group→rule attribution helpers.
 */
import { describe, it, expect } from 'vitest';
import {
  countRulesByGroup,
  countReferencedGroups,
  extractReferencedGroupIds,
  annotateGroupsWithRuleCounts,
} from './groupRuleIndex';
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

describe('extractReferencedGroupIds', () => {
  it('pulls ids out of isMemberOfAnyGroup / isMemberOfGroup calls', () => {
    expect(extractReferencedGroupIds('isMemberOfAnyGroup("00gAAA", "00gBBB")')).toEqual([
      '00gAAA',
      '00gBBB',
    ]);
    expect(extractReferencedGroupIds('isMemberOfGroup("00gCCC")')).toEqual(['00gCCC']);
  });

  it('excludes the name/pattern variants (their args are names, not ids)', () => {
    expect(extractReferencedGroupIds('isMemberOfGroupName("Engineering")')).toEqual([]);
    expect(extractReferencedGroupIds('isMemberOfAnyGroupNameStartsWith("Eng")')).toEqual([]);
  });

  it('combines with other predicates and dedupes within one expression', () => {
    const expr = 'user.department=="Eng" AND isMemberOfAnyGroup("00gAAA", "00gAAA")';
    expect(extractReferencedGroupIds(expr)).toEqual(['00gAAA']);
  });

  it('returns nothing for empty, missing, or reference-free expressions', () => {
    expect(extractReferencedGroupIds('')).toEqual([]);
    expect(extractReferencedGroupIds(undefined)).toEqual([]);
    expect(extractReferencedGroupIds('user.title=="Manager"')).toEqual([]);
  });
});

describe('countReferencedGroups', () => {
  it('tallies how many rules reference each group in their conditions', () => {
    const counts = countReferencedGroups([
      { groupIds: [], conditionExpression: 'isMemberOfAnyGroup("00gA", "00gB")' },
      { groupIds: [], conditionExpression: 'isMemberOfGroup("00gB")' },
      { groupIds: ['00gA'], conditionExpression: 'user.dept=="x"' },
    ]);
    expect(counts.get('00gA')).toBe(1);
    expect(counts.get('00gB')).toBe(2);
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

  it('tracks assigned-by and used-in independently', () => {
    const groups = [group('assigned'), group('used'), group('both')];
    const rules = [
      // feeds `assigned` and `both`; references `used` and `both`.
      {
        groupIds: ['assigned', 'both'],
        conditionExpression: 'isMemberOfAnyGroup("used", "both")',
      },
    ];
    const annotated = annotateGroupsWithRuleCounts(groups, rules);

    expect(annotated.find((g) => g.id === 'assigned')).toMatchObject({
      hasRules: true,
      ruleCount: 1,
      usedInRuleCount: 0,
    });
    // A group only referenced in a condition is NOT counted as fed — hasRules stays
    // false so the "no feeding rule" staleness signal is preserved.
    expect(annotated.find((g) => g.id === 'used')).toMatchObject({
      hasRules: false,
      ruleCount: 0,
      usedInRuleCount: 1,
    });
    expect(annotated.find((g) => g.id === 'both')).toMatchObject({
      hasRules: true,
      ruleCount: 1,
      usedInRuleCount: 1,
    });
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
