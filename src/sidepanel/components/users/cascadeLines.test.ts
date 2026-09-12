/**
 * @module sidepanel/components/users/cascadeLines.test
 * @description Unit tests for the cascade join — a pure function, so a unit test
 * rather than a story.
 */

import { describe, it, expect } from 'vitest';
import { cascadeLinesByGroupId, isPatternMatch, type CascadeLine } from './cascadeLines';
import type {
  BlastRadiusReport,
  GroupCascade,
  RuleEffect,
} from '../../../shared/membership/blastRadiusTypes';

const FEEDER = '0prFAKEfeeder001';
const SALES = '00gFAKEsales0001';

function ruleOf(overrides: Partial<RuleEffect> = {}): RuleEffect {
  return {
    ruleId: FEEDER,
    ruleName: 'Downstream feeder',
    expression: 'isMemberOfGroupName("Sales-All")',
    transition: 'unchanged-no-match',
    targetGroupIds: ['00gFAKEfinance01'],
    targetGroupNames: ['Finance'],
    touchedAttributes: [],
    active: true,
    ...overrides,
  };
}

function reportOf(cascades: GroupCascade[], rules: RuleEffect[] = [ruleOf()]): BlastRadiusReport {
  return {
    status: 'computed',
    groups: [],
    rules,
    counts: { added: 0, removed: 0, notPredicted: 0, starts: 0, stops: 0, undetermined: 0 },
    cascades,
  };
}

const cascadeOf = (overrides: Partial<GroupCascade['rules'][number]> = {}): GroupCascade => ({
  groupId: SALES,
  rules: [{ ruleId: FEEDER, direction: 'toward-match', matchedBy: 'name', ...overrides }],
});

describe('cascadeLinesByGroupId', () => {
  it('resolves the rule name and its target groups off the report', () => {
    const resolved = cascadeLinesByGroupId(reportOf([cascadeOf()]));

    expect(resolved.get(SALES)).toEqual<CascadeLine[]>([
      {
        ruleId: FEEDER,
        ruleName: 'Downstream feeder',
        direction: 'toward-match',
        matchedBy: 'name',
        targetGroupNames: ['Finance'],
      },
    ]);
  });

  it('MIRROR: drops a cascade rule the report does not carry, rather than showing a raw id', () => {
    // Cannot happen — `rules` is the whole inventory — but a dropped line beats a
    // `0pr…` rendered where a rule name belongs.
    const resolved = cascadeLinesByGroupId(reportOf([cascadeOf()], []));

    expect(resolved.has(SALES)).toBe(false);
  });

  it('holds no entry for a group with no cascade, rather than an empty one', () => {
    // An empty entry would invite a surface to render "nothing reads this group",
    // which the under-reporting scan cannot back.
    const resolved = cascadeLinesByGroupId(reportOf([]));

    expect(resolved.size).toBe(0);
  });

  it('carries a rule that assigns nothing, with no target names', () => {
    const resolved = cascadeLinesByGroupId(
      reportOf([cascadeOf()], [ruleOf({ targetGroupIds: [], targetGroupNames: [] })]),
    );

    expect(resolved.get(SALES)?.[0].targetGroupNames).toEqual([]);
  });
});

describe('isPatternMatch', () => {
  const lineWith = (matchedBy: CascadeLine['matchedBy']): CascadeLine => ({
    ruleId: FEEDER,
    ruleName: 'Downstream feeder',
    direction: 'toward-match',
    matchedBy,
    targetGroupNames: [],
  });

  it('is true for the three pattern forms, where the link is not self-evident', () => {
    expect(isPatternMatch(lineWith('nameStartsWith'))).toBe(true);
    expect(isPatternMatch(lineWith('nameContains'))).toBe(true);
    expect(isPatternMatch(lineWith('nameRegex'))).toBe(true);
  });

  it('MIRROR: is false when the condition named the group outright', () => {
    expect(isPatternMatch(lineWith('id'))).toBe(false);
    expect(isPatternMatch(lineWith('name'))).toBe(false);
  });
});
