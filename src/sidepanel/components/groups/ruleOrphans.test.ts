/**
 * Unit tests for the joins that need the rules payload.
 *
 * Two questions are at stake, and both are easy to get subtly wrong in a way
 * that reads fine on screen:
 *
 * 1. **Filled means assigned, not mentioned.** A group named in a rule's
 *    *condition* is read by that rule, not filled by it. Counting a mention as
 *    a fill would quietly drop the groups most worth finding.
 * 2. **Empty is not the same as unused.** A group with no members can still be
 *    holding an app open, and an `APP_GROUP` is mastered by its app rather than
 *    by any rule. Both are excluded, and both get a case.
 */
import { describe, it, expect } from 'vitest';
import {
  appNamesByGroup,
  findCleanupCandidates,
  findRulesWithMissingTargets,
  findUnmaintainedAppAccess,
  groupIdsFilledByRules,
  type OrphanCandidateGroup,
} from './ruleOrphans';

const group = (over: Partial<OrphanCandidateGroup> & { id: string }): OrphanCandidateGroup => ({
  name: over.id,
  memberCount: 0,
  type: 'OKTA_GROUP',
  ...over,
});

describe('groupIdsFilledByRules', () => {
  it('collects every group any rule assigns to', () => {
    const filled = groupIdsFilledByRules([
      { groupIds: ['00gFAKE1', '00gFAKE2'] },
      { groupIds: ['00gFAKE2'] },
      { groupIds: [] },
    ]);
    expect([...filled].sort()).toEqual(['00gFAKE1', '00gFAKE2']);
  });
});

describe('appNamesByGroup', () => {
  it('recovers the app from the compound record id, not from the entity', () => {
    // Okta returns the assigned *group's* id as the assignment's own id, so the
    // app exists only in the snapshot's key. Reading the entity here would
    // attribute every assignment to the wrong side of the pair.
    const byGroup = appNamesByGroup(
      ['0oaFAKE1::00gFAKE1', '0oaFAKE2::00gFAKE1', '0oaFAKE1::00gFAKE2'],
      new Map([
        ['0oaFAKE1', 'Slack'],
        ['0oaFAKE2', 'Workday'],
      ]),
    );
    expect(byGroup.get('00gFAKE1')).toEqual(['Slack', 'Workday']);
    expect(byGroup.get('00gFAKE2')).toEqual(['Slack']);
  });

  it('falls back to the app id rather than dropping an unnamed app', () => {
    // The finding is about the group. A label the inventory has not supplied is
    // not a reason to under-report the apps it is holding open.
    const byGroup = appNamesByGroup(['0oaFAKE9::00gFAKE1'], new Map());
    expect(byGroup.get('00gFAKE1')).toEqual(['0oaFAKE9']);
  });

  it('ignores a record id with no shard key', () => {
    expect(appNamesByGroup(['00gFAKE1'], new Map()).size).toBe(0);
  });
});

describe('findCleanupCandidates', () => {
  const groups = [
    group({ id: '00gFAKE1', name: 'Abandoned' }),
    group({ id: '00gFAKE2', name: 'Filled by a rule' }),
    group({ id: '00gFAKE3', name: 'Has members', memberCount: 4 }),
    group({ id: '00gFAKE4', name: 'Holds an app open' }),
    group({ id: '00gFAKE5', name: 'Sourced from an app', type: 'APP_GROUP' }),
    group({ id: '00gFAKE6', name: 'Everyone', type: 'BUILT_IN' }),
  ];

  it('finds only the groups that are empty, unfilled and unassigned', () => {
    const found = findCleanupCandidates(groups, new Set(['00gFAKE2']), new Set(['00gFAKE4']));
    expect(found.map((finding) => finding.id)).toEqual(['00gFAKE1']);
    expect(found[0].detail).toBe('No members · no rule fills it · no app assigned');
  });

  it('keeps an empty group that is holding app access open', () => {
    // Deleting it would revoke the access it is holding, so it is not a cleanup
    // candidate however empty it looks.
    const found = findCleanupCandidates(groups, new Set(), new Set(['00gFAKE1', '00gFAKE4']));
    expect(found.map((finding) => finding.id)).not.toContain('00gFAKE4');
    expect(found.map((finding) => finding.id)).not.toContain('00gFAKE1');
  });

  it('leaves app-sourced and built-in groups alone', () => {
    const found = findCleanupCandidates(groups, new Set(), new Set());
    expect(found.map((finding) => finding.id)).toEqual(['00gFAKE1', '00gFAKE2', '00gFAKE4']);
  });

  it('orders by name, so the same org lists the same way twice running', () => {
    const found = findCleanupCandidates(
      [group({ id: 'b', name: 'Zulu' }), group({ id: 'a', name: 'Alpha' })],
      new Set(),
      new Set(),
    );
    expect(found.map((finding) => finding.name)).toEqual(['Alpha', 'Zulu']);
  });
});

describe('findUnmaintainedAppAccess', () => {
  const groups = [
    group({ id: '00gFAKE1', name: 'Sales tools', memberCount: 12 }),
    group({ id: '00gFAKE2', name: 'Engineering tools', memberCount: 40 }),
    group({ id: '00gFAKE3', name: 'Ruled', memberCount: 7 }),
    group({ id: '00gFAKE4', name: 'Empty but assigned', memberCount: 0 }),
    group({ id: '00gFAKE5', name: 'No app', memberCount: 9 }),
  ];
  const byGroup = new Map([
    ['00gFAKE1', ['Slack']],
    ['00gFAKE2', ['Slack', 'Workday']],
    ['00gFAKE3', ['Slack']],
    ['00gFAKE4', ['Slack']],
  ]);

  it('lists the unmanaged access, biggest blast radius first', () => {
    const found = findUnmaintainedAppAccess(groups, new Set(['00gFAKE3']), byGroup);
    expect(found.map((finding) => finding.id)).toEqual(['00gFAKE2', '00gFAKE1']);
    expect(found[0].detail).toBe('40 members · Slack, Workday');
  });

  it('leaves the empty ones to the cleanup report', () => {
    // Listing a group nobody is in as "access nothing maintains" would put a
    // finding with no consequence at the top of a list sorted by consequence.
    const found = findUnmaintainedAppAccess(groups, new Set(), byGroup);
    expect(found.map((finding) => finding.id)).not.toContain('00gFAKE4');
  });

  it('says "member" for one', () => {
    const found = findUnmaintainedAppAccess(
      [group({ id: '00gFAKE1', name: 'Solo', memberCount: 1 })],
      new Set(),
      new Map([['00gFAKE1', ['Slack']]]),
    );
    expect(found[0].detail).toBe('1 member · Slack');
  });

  it('carries no member count into the finding it returns', () => {
    // The sort key is an implementation detail of this function. Leaking it
    // would put a field on the finding type that only one of the two producers
    // sets, and the row would start branching on its presence.
    const [found] = findUnmaintainedAppAccess(
      [group({ id: '00gFAKE1', name: 'Solo', memberCount: 1 })],
      new Set(),
      new Map([['00gFAKE1', ['Slack']]]),
    );
    expect(Object.keys(found).sort()).toEqual(['detail', 'id', 'name']);
  });
});

describe('findRulesWithMissingTargets', () => {
  const rule = { id: '0prFAKE1', name: 'Contractor intake', groupIds: ['00gFAKE1', '00gFAKE2'] };

  it('says nothing when every target still exists', () => {
    const found = findRulesWithMissingTargets([rule], new Set(['00gFAKE1', '00gFAKE2']), true);
    expect(found).toEqual([]);
  });

  it('names only the targets with no group behind them', () => {
    const found = findRulesWithMissingTargets([rule], new Set(['00gFAKE1']), true);
    expect(found).toEqual([
      { id: '0prFAKE1', name: 'Contractor intake', missingGroupIds: ['00gFAKE2'] },
    ]);
  });

  it('suppresses the finding entirely when the group walk did not finish', () => {
    // The gate, and the reason this join is not a one-liner: the group
    // collection is read *negatively*, so against a half-read inventory every
    // rule in the org looks broken. Silence is the only honest answer — not a
    // hedged wording, and not the subset that happened to be on disk.
    const found = findRulesWithMissingTargets([rule], new Set(['00gFAKE1']), false);
    expect(found).toEqual([]);
  });

  it('reports a rule whose every target is gone, and keeps the rule order', () => {
    const second = { id: '0prFAKE2', name: 'Alpha rule', groupIds: ['00gFAKE9'] };
    const found = findRulesWithMissingTargets([rule, second], new Set(), true);
    expect(found.map((f) => f.id)).toEqual(['0prFAKE1', '0prFAKE2']);
    expect(found[0].missingGroupIds).toEqual(['00gFAKE1', '00gFAKE2']);
  });

  it('is silent about a rule that assigns to nothing at all', () => {
    // "Assigns nowhere" is a different finding with its own copy on the rule
    // rung. Reporting it here would put two unrelated defects behind one badge.
    const found = findRulesWithMissingTargets(
      [{ id: '0prFAKE3', name: 'Inert', groupIds: [] }],
      new Set(),
      true,
    );
    expect(found).toEqual([]);
  });
});
