/**
 * @module shared/membership/mergePlan.test
 * @description Unit tests for the pure group-merge planner.
 */

import { describe, it, expect } from 'vitest';
import { planGroupMerge, type MergeFeedingRule } from './mergePlan';
import type { OktaUser } from '../types';

function member(id: string): OktaUser {
  return {
    id,
    status: 'ACTIVE',
    profile: { login: `${id}@x.io`, email: `${id}@x.io`, firstName: id, lastName: 'U' },
  };
}

const survivor = { id: 'surv', name: 'Survivor' };

describe('planGroupMerge', () => {
  it('copies distinct source members that are not already in the survivor', () => {
    const members = new Map<string, OktaUser[]>([
      ['surv', [member('u1')]],
      ['s1', [member('u1'), member('u2')]], // u1 already in survivor
      ['s2', [member('u2'), member('u3')]], // u2 duplicated across sources
    ]);
    const plan = planGroupMerge(
      survivor,
      [
        { id: 's1', name: 'S1' },
        { id: 's2', name: 'S2' },
      ],
      members,
      new Map(),
    );

    expect(plan.toCopy.map((u) => u.id).sort()).toEqual(['u2', 'u3']);
    expect(plan.totalCopies).toBe(2);
    // Every source member is removed when emptying (u1,u2 + u2,u3).
    expect(plan.totalRemovals).toBe(4);
    expect(plan.blocked).toBe(false);
  });

  it('records per-source members to remove', () => {
    const members = new Map<string, OktaUser[]>([
      ['surv', []],
      ['s1', [member('a'), member('b')]],
    ]);
    const plan = planGroupMerge(survivor, [{ id: 's1', name: 'S1' }], members, new Map());
    expect(plan.sources[0].membersToRemove.map((u) => u.id)).toEqual(['a', 'b']);
  });

  it('flags a source fed by an active rule as a blocker', () => {
    const members = new Map<string, OktaUser[]>([
      ['surv', []],
      ['s1', [member('a')]],
    ]);
    const rules = new Map<string, MergeFeedingRule[]>([
      ['s1', [{ name: 'Feeder', status: 'ACTIVE' }]],
    ]);
    const plan = planGroupMerge(survivor, [{ id: 's1', name: 'S1' }], members, rules);
    expect(plan.blocked).toBe(true);
    expect(plan.sources[0].hasActiveFeedingRule).toBe(true);
    expect(plan.sources[0].feedingRuleNames).toEqual(['Feeder']);
  });

  it('does not block on an inactive feeding rule', () => {
    const members = new Map<string, OktaUser[]>([
      ['surv', []],
      ['s1', [member('a')]],
    ]);
    const rules = new Map<string, MergeFeedingRule[]>([
      ['s1', [{ name: 'Feeder', status: 'INACTIVE' }]],
    ]);
    const plan = planGroupMerge(survivor, [{ id: 's1', name: 'S1' }], members, rules);
    expect(plan.blocked).toBe(false);
  });

  it('handles an empty source (nothing to copy or remove)', () => {
    const members = new Map<string, OktaUser[]>([
      ['surv', [member('u1')]],
      ['s1', []],
    ]);
    const plan = planGroupMerge(survivor, [{ id: 's1', name: 'S1' }], members, new Map());
    expect(plan.totalCopies).toBe(0);
    expect(plan.totalRemovals).toBe(0);
  });
});
