/**
 * @module sidepanel/components/groups/clutterAnalysis.test
 * @description Unit tests for the local directory-clutter classifier.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeClutter,
  normalizeGroupName,
  CLUTTER_WEIGHTS,
  STALE_AGE_DAYS,
} from './clutterAnalysis';
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

/** A fixed "now" so the age predicate is deterministic. */
const NOW = new Date('2026-07-01T00:00:00.000Z').getTime();
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** A `lastUpdated` exactly `days` before {@link NOW}. */
const daysAgo = (days: number) => new Date(NOW - days * MS_PER_DAY);

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

  it('flags groups at/above the age threshold only', () => {
    const report = analyzeClutter(
      [
        group({ id: 'g1', name: 'Stale', lastMembershipUpdated: daysAgo(STALE_AGE_DAYS) }),
        group({ id: 'g2', name: 'Fresh', lastMembershipUpdated: daysAgo(STALE_AGE_DAYS - 1) }),
      ],
      NOW,
    );
    expect(report.categories.stale).toEqual(['g1']);
    expect(report.entries[0].reasons).toContain('No membership change in over a year');
  });

  it('flags a group whose roster is frozen even though its profile was edited yesterday', () => {
    // The false negative this signal was changed to fix, and the reason it
    // mattered: a group under periodic review has its description touched
    // constantly, so the profile clock never goes stale while the roster
    // ossifies. Scored on `lastUpdated` this group is invisible; it is exactly
    // the group an access review needs to see.
    const report = analyzeClutter(
      [
        group({
          id: 'g1',
          name: 'AWS Prod - Admin',
          lastUpdated: daysAgo(1),
          lastMembershipUpdated: daysAgo(STALE_AGE_DAYS + 800),
        }),
      ],
      NOW,
    );
    expect(report.categories.stale).toEqual(['g1']);
  });

  it('does not flag a group whose members churn weekly but whose profile is untouched', () => {
    // The mirrored false positive: a live team nobody has renamed in years.
    const report = analyzeClutter(
      [
        group({
          id: 'g1',
          name: 'Engineering',
          lastUpdated: daysAgo(STALE_AGE_DAYS + 800),
          lastMembershipUpdated: daysAgo(3),
        }),
      ],
      NOW,
    );
    expect(report.categories.stale).toEqual([]);
  });

  it('falls back to lastUpdated when Okta reported no membership date', () => {
    // A snapshot synced before `lastMembershipUpdated` was parsed carries no
    // value; the old behaviour is preserved rather than the signal going dark.
    const report = analyzeClutter(
      [group({ id: 'g1', name: 'Stale', lastUpdated: daysAgo(STALE_AGE_DAYS) })],
      NOW,
    );
    expect(report.categories.stale).toEqual(['g1']);
  });

  it('does not claim a membership fact when it only had the profile clock', () => {
    // The fallback verdict cannot support the stronger sentence — we know the
    // profile has not moved, not that nobody joined or left.
    const report = analyzeClutter(
      [group({ id: 'g1', name: 'Stale', lastUpdated: daysAgo(STALE_AGE_DAYS) })],
      NOW,
    );
    expect(report.entries[0].reasons).toContain('Not updated in over a year');
    expect(report.entries[0].reasons).not.toContain('No membership change in over a year');
  });

  it('does not flag a group with neither date (missing data is not age)', () => {
    const report = analyzeClutter([group({ id: 'g1', name: 'NoDate' })], NOW);
    expect(report.categories.stale).toEqual([]);
    expect(report.entries).toHaveLength(0);
  });

  it('never calls an APP_GROUP or BUILT_IN stale, however old its roster', () => {
    // An app group is mastered upstream, so a quiet roster is a fact about the
    // source directory, not neglect here; Everyone is filled by Okta itself.
    // Neither is a finding an admin can act on in this app.
    const ancient = daysAgo(STALE_AGE_DAYS + 2000);
    const report = analyzeClutter(
      [
        group({ id: 'g1', name: 'AD Synced', type: 'APP_GROUP', lastMembershipUpdated: ancient }),
        group({ id: 'g2', name: 'Everyone', type: 'BUILT_IN', lastMembershipUpdated: ancient }),
        group({ id: 'g3', name: 'Okta Owned', type: 'OKTA_GROUP', lastMembershipUpdated: ancient }),
      ],
      NOW,
    );
    expect(report.categories.stale).toEqual(['g3']);
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
    const report = analyzeClutter(
      [
        // Empty only -> 40
        group({ id: 'g1', name: 'A', memberCount: 0 }),
        // Empty + duplicate + stale + no desc -> capped 100
        group({
          id: 'g2',
          name: 'Dup',
          memberCount: 0,
          description: undefined,
          lastUpdated: daysAgo(STALE_AGE_DAYS + 35),
        }),
        group({ id: 'g3', name: 'dup', memberCount: 3 }),
      ],
      NOW,
    );
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
