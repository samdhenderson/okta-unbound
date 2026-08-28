import { describe, it, expect } from 'vitest';
import type { GroupSummary } from '../../../shared/types';
import {
  matchesSizeFilter,
  compareGroupsBy,
  filterAndSortGroups,
  computeActiveFilterCount,
  parseRegexQuery,
  matchesSearchQuery,
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
  ruleFilter: '',
  sortBy: 'name',
  sortDesc: false,
};

describe('parseRegexQuery', () => {
  it('compiles a slash-wrapped pattern with flags', () => {
    const rx = parseRegexQuery('/^sales-.*/i');
    expect(rx).toBeInstanceOf(RegExp);
    expect(rx!.test('Sales-EMEA')).toBe(true);
  });

  it('returns null for a plain (non-slash-wrapped) query', () => {
    expect(parseRegexQuery('sales')).toBeNull();
  });

  it('returns null for an invalid pattern', () => {
    expect(parseRegexQuery('/[unclosed/')).toBeNull();
  });

  it('strips the stateful g/y flags so repeated .test is stable', () => {
    const rx = parseRegexQuery('/a/g');
    expect(rx!.flags).toBe('');
    // Would flip-flop if the `g` flag survived (lastIndex statefulness).
    expect(rx!.test('a')).toBe(true);
    expect(rx!.test('a')).toBe(true);
  });
});

describe('matchesSearchQuery', () => {
  const grp = g({ id: '00gFAKE1', name: 'Sales-EMEA', description: 'Regional sales team' });

  it('empty query matches everything', () => {
    expect(matchesSearchQuery(grp, '   ')).toBe(true);
  });

  it('substring matches name, description, and id case-insensitively', () => {
    expect(matchesSearchQuery(grp, 'emea')).toBe(true);
    expect(matchesSearchQuery(grp, 'regional')).toBe(true);
    expect(matchesSearchQuery(grp, '00gfake1')).toBe(true);
    expect(matchesSearchQuery(grp, 'engineering')).toBe(false);
  });

  it('regex query matches on the name', () => {
    expect(matchesSearchQuery(grp, '/^sales-/i')).toBe(true);
    expect(matchesSearchQuery(grp, '/^eng-/i')).toBe(false);
  });

  it('filterAndSortGroups applies a regex searchQuery', () => {
    const groups = [
      g({ id: 'a', name: 'Sales-EMEA' }),
      g({ id: 'b', name: 'Sales-AMER' }),
      g({ id: 'c', name: 'Engineering' }),
    ];
    const result = filterAndSortGroups(groups, { ...emptyState, searchQuery: '/^sales-/i' });
    expect(result.map((x) => x.name)).toEqual(['Sales-AMER', 'Sales-EMEA']);
  });
});

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
        pushAppFilter: new Set(),
        ruleFilter: '',
      }),
    ).toBe(0);
    expect(
      computeActiveFilterCount({
        typeFilter: 'OKTA_GROUP',
        sizeFilter: 'small',
        pushFilter: 'pushed',
        pushAppFilter: new Set(['a1', 'a2']),
        ruleFilter: 'unruled',
      }),
    ).toBe(5);
    expect(
      computeActiveFilterCount({
        typeFilter: 'OKTA_GROUP',
        sizeFilter: '',
        pushFilter: '',
        pushAppFilter: new Set(),
        ruleFilter: '',
      }),
    ).toBe(1);
  });
});

describe('the rule filter', () => {
  const fed = g({ id: 'fed', hasRules: true, ruleCount: 2 });
  const unfed = g({ id: 'unfed', hasRules: false });
  // A group named in another rule's CONDITION, but that no rule assigns anyone
  // to. It still has nothing filling it, so it counts as unruled.
  const conditionOnly = g({ id: 'condition-only', hasRules: false, usedInRuleCount: 3 });

  it('passes everything through when unset', () => {
    const all = [fed, unfed, conditionOnly];
    expect(filterAndSortGroups(all, emptyState)).toHaveLength(3);
  });

  it('keeps only groups no rule assigns anyone to', () => {
    const kept = filterAndSortGroups([fed, unfed, conditionOnly], {
      ...emptyState,
      ruleFilter: 'unruled',
    });
    expect(kept.map((group) => group.id)).toEqual(['condition-only', 'unfed']);
  });

  it('keeps only groups a rule feeds', () => {
    const kept = filterAndSortGroups([fed, unfed, conditionOnly], {
      ...emptyState,
      ruleFilter: 'ruled',
    });
    expect(kept.map((group) => group.id)).toEqual(['fed']);
  });

  it('reads `hasRules`, not `usedInRuleCount`', () => {
    // The two answer different questions: `hasRules` is "does a rule PUT people
    // here", `usedInRuleCount` is "does a rule mention this group to decide
    // something else". Only the first says whether membership maintains itself.
    const kept = filterAndSortGroups([conditionOnly], { ...emptyState, ruleFilter: 'unruled' });
    expect(kept).toHaveLength(1);
  });
});
