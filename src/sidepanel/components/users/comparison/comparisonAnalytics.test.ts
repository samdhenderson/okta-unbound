import { describe, it, expect } from 'vitest';
import {
  jaccard,
  bucketGroups,
  bucketApps,
  similarityColor,
  type AppEntry,
} from './comparisonAnalytics';
import type { GroupMembership, OktaGroup, GroupType } from '../../../../shared/types';

const group = (id: string, name = id, type: GroupType = 'OKTA_GROUP'): OktaGroup => ({
  id,
  type,
  profile: { name },
});

const membership = (id: string): GroupMembership => ({
  group: group(id),
  membershipType: 'DIRECT',
});

const app = (id: string, label = id): AppEntry => ({ id, label });

describe('jaccard', () => {
  it('returns whole-percent overlap', () => {
    expect(jaccard(1, 4)).toBe(25);
    expect(jaccard(3, 4)).toBe(75);
    expect(jaccard(2, 2)).toBe(100);
  });

  it('CHARACTERIZED: an empty union scores 0, not 100', () => {
    expect(jaccard(0, 0)).toBe(0);
  });

  it('rounds to the nearest whole percent', () => {
    expect(jaccard(1, 3)).toBe(33);
    expect(jaccard(2, 3)).toBe(67);
  });
});

describe('bucketGroups', () => {
  it('splits into onlyCompared / shared / onlyContext by group id', () => {
    const contextGroups = [membership('a'), membership('b')];
    const comparedGroups = [membership('b'), membership('c')];

    const { onlyCompared, shared, onlyContext } = bucketGroups(
      contextGroups,
      comparedGroups,
      new Set(),
    );

    expect(onlyCompared.map((g) => g.id)).toEqual(['c']);
    expect(shared.map((g) => g.id)).toEqual(['b']);
    expect(onlyContext.map((g) => g.id)).toEqual(['a']);
  });

  it('treats addedToContextIds as shared before contextGroups catches up', () => {
    const contextGroups = [membership('a')];
    const comparedGroups = [membership('b'), membership('c')];

    const { onlyCompared, shared } = bucketGroups(contextGroups, comparedGroups, new Set(['b']));

    expect(shared.map((g) => g.id)).toEqual(['b']);
    expect(onlyCompared.map((g) => g.id)).toEqual(['c']);
  });

  it('treats addedToComparedIds as shared, moving a context-only group out of onlyContext', () => {
    const contextGroups = [membership('a'), membership('b')];
    const comparedGroups = [membership('b')];

    // 'a' is context-only, but was just copied onto the compared user this session.
    const { onlyCompared, shared, onlyContext } = bucketGroups(
      contextGroups,
      comparedGroups,
      new Set(),
      new Set(['a']),
    );

    expect(onlyCompared).toEqual([]);
    expect(shared.map((g) => g.id)).toEqual(['b', 'a']);
    expect(onlyContext).toEqual([]);
  });

  it('re-buckets both directions at once without double-counting', () => {
    const contextGroups = [membership('a'), membership('shared')];
    const comparedGroups = [membership('shared'), membership('c')];

    const { onlyCompared, shared, onlyContext } = bucketGroups(
      contextGroups,
      comparedGroups,
      new Set(['c']), // c copied onto context
      new Set(['a']), // a copied onto compared
    );

    expect(onlyCompared).toEqual([]);
    expect(onlyContext).toEqual([]);
    expect(shared.map((g) => g.id).sort()).toEqual(['a', 'c', 'shared']);
  });

  it('preserves comparedGroups order within onlyCompared/shared', () => {
    const comparedGroups = [membership('z'), membership('a'), membership('m')];
    const { onlyCompared } = bucketGroups([], comparedGroups, new Set());
    expect(onlyCompared.map((g) => g.id)).toEqual(['z', 'a', 'm']);
  });
});

describe('bucketApps', () => {
  it('splits into onlyCompared / shared / onlyContext by app id', () => {
    const contextApps = [app('a'), app('b')];
    const comparedApps = [app('b'), app('c')];

    const { onlyCompared, shared, onlyContext } = bucketApps(contextApps, comparedApps);

    expect(onlyCompared.map((a) => a.id)).toEqual(['c']);
    expect(shared.map((a) => a.id)).toEqual(['b']);
    expect(onlyContext.map((a) => a.id)).toEqual(['a']);
  });

  it('has no added-id concept (unlike bucketGroups)', () => {
    const { shared } = bucketApps([], [app('x')]);
    expect(shared).toEqual([]);
  });
});

describe('similarityColor', () => {
  it('maps percentage bands to color tokens', () => {
    expect(similarityColor(90)).toBe('var(--color-success-text)');
    expect(similarityColor(75)).toBe('var(--color-success-text)');
    expect(similarityColor(50)).toBe('var(--color-primary-text)');
    expect(similarityColor(40)).toBe('var(--color-primary-text)');
    expect(similarityColor(20)).toBe('var(--color-warning-text)');
    expect(similarityColor(15)).toBe('var(--color-warning-text)');
    expect(similarityColor(0)).toBe('var(--color-neutral-700)');
  });
});
