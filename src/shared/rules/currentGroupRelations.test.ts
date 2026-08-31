/**
 * @module shared/rules/currentGroupRelations.test
 * @description The two current-group relation directions, and the union the strip counts.
 *
 * The count is the reason these are tested rather than left inline: it rides the rules
 * strip's *This group (N)* label, so a wrong number is a promise the panel then fails to
 * keep. The double-counting case below is the one that would produce it.
 */
import { describe, it, expect } from 'vitest';
import {
  splitCurrentGroupRuleRelations,
  countCurrentGroupRuleRelations,
} from './currentGroupRelations';
import type { FormattedRule } from '../types';

/** A minimal formatted rule; only the two fields these helpers read are meaningful. */
const rule = (id: string, groupIds: string[], expression = ''): FormattedRule =>
  ({
    id,
    name: `Rule ${id}`,
    status: 'ACTIVE',
    groupIds,
    groupNames: [],
    conditionExpression: expression,
  }) as unknown as FormattedRule;

const GROUP = '00gFAKEcurrent';

describe('splitCurrentGroupRuleRelations', () => {
  it('separates the rules that feed the group from those that only read it', () => {
    const feeds = rule('r1', [GROUP]);
    const reads = rule('r2', ['00gFAKEother'], `isMemberOfGroup("${GROUP}")`);

    const { assigning, referencing } = splitCurrentGroupRuleRelations([feeds, reads], GROUP);

    expect(assigning.map((r) => r.id)).toEqual(['r1']);
    expect(referencing.map((r) => r.id)).toEqual(['r2']);
  });

  it('lists a rule that does both under both headings', () => {
    const both = rule('r1', [GROUP], `isMemberOfGroup("${GROUP}")`);

    const { assigning, referencing } = splitCurrentGroupRuleRelations([both], GROUP);

    expect(assigning.map((r) => r.id)).toEqual(['r1']);
    expect(referencing.map((r) => r.id)).toEqual(['r1']);
  });

  it('finds nothing when no group is detected', () => {
    const anything = rule('r1', ['00gFAKEother'], 'isMemberOfGroup("00gFAKEother")');

    expect(splitCurrentGroupRuleRelations([anything], undefined)).toEqual({
      assigning: [],
      referencing: [],
    });
  });
});

describe('countCurrentGroupRuleRelations', () => {
  it('counts each direction once', () => {
    const rules = [
      rule('r1', [GROUP]),
      rule('r2', ['00gFAKEother'], `isMemberOfGroup("${GROUP}")`),
    ];

    expect(countCurrentGroupRuleRelations(rules, GROUP)).toBe(2);
  });

  /*
    The whole reason this is a helper and not `assigning.length + referencing.length` at
    the call site. Summing would put `2` on a verb that opens a panel showing one rule.
  */
  it('counts a rule that both feeds and reads the group exactly once', () => {
    const both = rule('r1', [GROUP], `isMemberOfGroup("${GROUP}")`);

    expect(countCurrentGroupRuleRelations([both], GROUP)).toBe(1);
  });

  it('is zero with no detected group, and zero with nothing related', () => {
    const unrelated = rule('r1', ['00gFAKEother']);

    expect(countCurrentGroupRuleRelations([unrelated], undefined)).toBe(0);
    expect(countCurrentGroupRuleRelations([unrelated], GROUP)).toBe(0);
  });
});
