/**
 * @module sidepanel/components/groups/clutterAnalysis.test
 * @description Unit tests for the local directory-clutter classifier.
 */

import { describe, it, expect } from 'vitest';
import { analyzeClutter, normalizeGroupName, CLUTTER_WEIGHTS } from './clutterAnalysis';
import type { GroupSummary } from '../../../shared/types';

function group(overrides: Partial<GroupSummary> & { id: string; name: string }): GroupSummary {
  return {
    type: 'OKTA_GROUP',
    memberCount: 5,
    hasRules: false,
    ruleCount: 0,
    description: 'A group',
    ...overrides,
  };
}

describe('normalizeGroupName', () => {
  it('lower-cases, trims, and collapses whitespace', () => {
    expect(normalizeGroupName('  Eng   Team ')).toBe('eng team');
    expect(normalizeGroupName('ENG TEAM')).toBe('eng team');
  });
});

describe('analyzeClutter', () => {
  it('flags empty groups', () => {
    const report = analyzeClutter([group({ id: 'g1', name: 'Empty', memberCount: 0 })]);
    expect(report.categories.empty).toEqual(['g1']);
    expect(report.entries[0].reasons).toContain('No members');
    expect(report.entries[0].signals.empty).toBe(true);
  });

  it('flags case/whitespace-insensitive duplicate names across all members of the cluster', () => {
    const report = analyzeClutter([
      group({ id: 'g1', name: 'Sales Team' }),
      group({ id: 'g2', name: 'sales  team' }),
      group({ id: 'g3', name: 'Unique' }),
    ]);
    expect(report.categories.duplicateName.sort()).toEqual(['g1', 'g2']);
    expect(report.duplicateNameClusters).toHaveLength(1);
    expect(report.duplicateNameClusters[0].groupIds.sort()).toEqual(['g1', 'g2']);
  });

  it('flags stale groups at/above the threshold only', () => {
    const report = analyzeClutter([
      group({ id: 'g1', name: 'Stale', staleness: { score: 70, factors: [] } }),
      group({ id: 'g2', name: 'Fresh', staleness: { score: 30, factors: [] } }),
    ]);
    expect(report.categories.stale).toEqual(['g1']);
  });

  it('does not flag a group solely for a missing description (hygiene, not clutter)', () => {
    const report = analyzeClutter([group({ id: 'g1', name: 'Fine', description: undefined })]);
    expect(report.entries).toHaveLength(0);
    expect(report.flaggedIds).toEqual([]);
  });

  it('adds the no-description reason when a group is otherwise flagged', () => {
    const report = analyzeClutter([
      group({ id: 'g1', name: 'Empty', memberCount: 0, description: undefined }),
    ]);
    expect(report.entries[0].reasons).toContain('No description');
    expect(report.entries[0].signals.noDescription).toBe(true);
  });

  it('fuses signals into reviewScore and sorts flagged groups descending', () => {
    const report = analyzeClutter([
      // Empty only -> 40
      group({ id: 'g1', name: 'A', memberCount: 0 }),
      // Empty + duplicate + stale + no desc -> capped 100
      group({
        id: 'g2',
        name: 'Dup',
        memberCount: 0,
        description: undefined,
        staleness: { score: 90, factors: [] },
      }),
      group({ id: 'g3', name: 'dup', memberCount: 3 }),
    ]);
    // g2 has the most signals -> first.
    expect(report.entries[0].group.id).toBe('g2');
    expect(report.entries[0].reviewScore).toBe(100);
    const g1 = report.entries.find((e) => e.group.id === 'g1');
    expect(g1?.reviewScore).toBe(CLUTTER_WEIGHTS.empty);
  });

  it('reports totals and leaves a clean directory empty', () => {
    const report = analyzeClutter([
      group({ id: 'g1', name: 'Alpha' }),
      group({ id: 'g2', name: 'Beta' }),
    ]);
    expect(report.totalGroups).toBe(2);
    expect(report.entries).toHaveLength(0);
    expect(report.flaggedIds).toEqual([]);
  });
});
