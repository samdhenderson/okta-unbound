import { describe, it, expect } from 'vitest';
import type { GroupSummary } from '../../../shared/types';
import {
  matchesSizeFilter,
  matchesStalenessFilter,
  compareGroupsBy,
  filterAndSortGroups,
  computeActiveFilterCount,
  type GroupFilterState,
} from './groupFilters';

const g = (o: Partial<GroupSummary> & { id: string }): GroupSummary => ({
  name: o.id,
  type: 'OKTA_GROUP',
  memberCount: 0,
  hasRules: false,
  ruleCount: 0,
  ...o,
});

const emptyState: GroupFilterState = {
  searchQuery: '',
  typeFilter: '',
  sizeFilter: '',
  pushFilter: '',
  pushAppFilter: new Set(),
  stalenessFilter: '',
  sortBy: 'name',
  sortDesc: false,
};

describe('matchesSizeFilter', () => {
  it('buckets by member count', () => {
    expect(matchesSizeFilter(0, 'empty')).toBe(true);
    expect(matchesSizeFilter(1, 'empty')).toBe(false);
    expect(matchesSizeFilter(0, 'small')).toBe(false);
    expect(matchesSizeFilter(49, 'small')).toBe(true);
    expect(matchesSizeFilter(50, 'small')).toBe(false);
    expect(matchesSizeFilter(50, 'medium')).toBe(true);
    expect(matchesSizeFilter(199, 'medium')).toBe(true);
    expect(matchesSizeFilter(200, 'medium')).toBe(false);
    expect(matchesSizeFilter(200, 'large')).toBe(true);
    expect(matchesSizeFilter(999, 'large')).toBe(true);
    expect(matchesSizeFilter(1000, 'large')).toBe(false);
    expect(matchesSizeFilter(1000, 'xlarge')).toBe(true);
  });

  it('matches everything for an unrecognised filter', () => {
    expect(matchesSizeFilter(123, '')).toBe(true);
  });
});

describe('matchesStalenessFilter', () => {
  it('buckets by score with the documented boundaries', () => {
    expect(matchesStalenessFilter(25, 'healthy')).toBe(true);
    expect(matchesStalenessFilter(26, 'healthy')).toBe(false);
    expect(matchesStalenessFilter(26, 'monitor')).toBe(true);
    expect(matchesStalenessFilter(50, 'monitor')).toBe(true);
    expect(matchesStalenessFilter(51, 'monitor')).toBe(false);
    expect(matchesStalenessFilter(51, 'stale')).toBe(true);
    expect(matchesStalenessFilter(75, 'stale')).toBe(true);
    expect(matchesStalenessFilter(76, 'stale')).toBe(false);
    expect(matchesStalenessFilter(76, 'very_stale')).toBe(true);
  });
});

describe('compareGroupsBy', () => {
  it('sorts by name via localeCompare', () => {
    expect(
      compareGroupsBy(g({ id: 'a', name: 'Apple' }), g({ id: 'b', name: 'Banana' }), 'name'),
    ).toBeLessThan(0);
  });

  it('sorts by member count numerically', () => {
    expect(
      compareGroupsBy(
        g({ id: 'a', memberCount: 5 }),
        g({ id: 'b', memberCount: 3 }),
        'memberCount',
      ),
    ).toBe(2);
  });

  it('sorts a missing lastUpdated last regardless of the other side', () => {
    const withDate = g({ id: 'a', lastUpdated: new Date('2026-01-01') });
    const noDate = g({ id: 'b' });
    expect(compareGroupsBy(noDate, withDate, 'lastUpdated')).toBe(1);
    expect(compareGroupsBy(withDate, noDate, 'lastUpdated')).toBe(-1);
  });

  it('sorts by staleness score, treating a missing score as 0', () => {
    expect(
      compareGroupsBy(
        g({ id: 'a', staleness: { score: 80 } as GroupSummary['staleness'] }),
        g({ id: 'b' }),
        'staleness',
      ),
    ).toBe(80);
  });
});

describe('filterAndSortGroups', () => {
  const groups = [
    g({
      id: 'g1',
      name: 'Engineering',
      description: 'builds things',
      memberCount: 100,
      type: 'OKTA_GROUP',
    }),
    g({
      id: 'g2',
      name: 'Sales',
      memberCount: 5,
      type: 'APP_GROUP',
      pushMappings: [{ appId: 'a1', appName: 'App1' }] as GroupSummary['pushMappings'],
    }),
    g({
      id: 'g3',
      name: 'Marketing',
      memberCount: 0,
      type: 'BUILT_IN',
      pushMappings: [{ appId: 'a2', appName: 'App2' }] as GroupSummary['pushMappings'],
    }),
  ];

  it('text search matches name, description, or id case-insensitively', () => {
    expect(
      filterAndSortGroups(groups, { ...emptyState, searchQuery: 'eng' }).map((x) => x.id),
    ).toEqual(['g1']);
    expect(
      filterAndSortGroups(groups, { ...emptyState, searchQuery: 'BUILDS' }).map((x) => x.id),
    ).toEqual(['g1']);
    expect(
      filterAndSortGroups(groups, { ...emptyState, searchQuery: 'g2' }).map((x) => x.id),
    ).toEqual(['g2']);
  });

  it('type filter narrows to the chosen type', () => {
    expect(
      filterAndSortGroups(groups, { ...emptyState, typeFilter: 'APP_GROUP' }).map((x) => x.id),
    ).toEqual(['g2']);
  });

  it('push filter splits pushed from not-pushed', () => {
    expect(
      filterAndSortGroups(groups, { ...emptyState, pushFilter: 'pushed' })
        .map((x) => x.id)
        .sort(),
    ).toEqual(['g2', 'g3']);
    expect(
      filterAndSortGroups(groups, { ...emptyState, pushFilter: 'not_pushed' }).map((x) => x.id),
    ).toEqual(['g1']);
  });

  it('push-app filter is a multi-select OR across apps', () => {
    expect(
      filterAndSortGroups(groups, { ...emptyState, pushAppFilter: new Set(['a1', 'a2']) })
        .map((x) => x.id)
        .sort(),
    ).toEqual(['g2', 'g3']);
    expect(
      filterAndSortGroups(groups, { ...emptyState, pushAppFilter: new Set(['a1']) }).map(
        (x) => x.id,
      ),
    ).toEqual(['g2']);
  });

  it('composes multiple axes conjunctively', () => {
    expect(
      filterAndSortGroups(groups, { ...emptyState, pushFilter: 'pushed', sizeFilter: 'small' }).map(
        (x) => x.id,
      ),
    ).toEqual(['g2']);
  });

  it('sorts and honours the direction flag', () => {
    expect(
      filterAndSortGroups(groups, { ...emptyState, sortBy: 'memberCount' }).map((x) => x.id),
    ).toEqual(['g3', 'g2', 'g1']);
    expect(
      filterAndSortGroups(groups, { ...emptyState, sortBy: 'memberCount', sortDesc: true }).map(
        (x) => x.id,
      ),
    ).toEqual(['g1', 'g2', 'g3']);
  });

  it('returns a new array and does not mutate or reorder the input', () => {
    const input = [g({ id: 'b', name: 'Beta' }), g({ id: 'a', name: 'Alpha' })];
    const out = filterAndSortGroups(input, emptyState);
    expect(out).not.toBe(input);
    expect(input.map((x) => x.id)).toEqual(['b', 'a']); // input order untouched
    expect(out.map((x) => x.id)).toEqual(['a', 'b']); // output sorted
  });
});

describe('computeActiveFilterCount', () => {
  it('counts the 4 scalar filters plus one for any push-app selection', () => {
    expect(
      computeActiveFilterCount({
        typeFilter: '',
        sizeFilter: '',
        pushFilter: '',
        stalenessFilter: '',
        pushAppFilter: new Set(),
      }),
    ).toBe(0);
    expect(
      computeActiveFilterCount({
        typeFilter: 'OKTA_GROUP',
        sizeFilter: 'small',
        pushFilter: 'pushed',
        stalenessFilter: 'stale',
        pushAppFilter: new Set(['a1', 'a2']),
      }),
    ).toBe(5);
    expect(
      computeActiveFilterCount({
        typeFilter: 'OKTA_GROUP',
        sizeFilter: '',
        pushFilter: '',
        stalenessFilter: '',
        pushAppFilter: new Set(),
      }),
    ).toBe(1);
  });
});
