import { describe, it, expect } from 'vitest';
import {
  jaccard,
  bucketGroups,
  bucketApps,
  groupDiffItem,
  similarityColor,
  type AppEntry,
} from './comparisonAnalytics';
import type {
  GroupMembership,
  MembershipRule,
  OktaGroup,
  GroupType,
} from '../../../../shared/types';

const group = (id: string, name = id, type: GroupType = 'OKTA_GROUP'): OktaGroup => ({
  id,
  type,
  profile: { name },
});

const membership = (id: string): GroupMembership => ({
  group: group(id),
  membershipType: 'DIRECT',
  rules: [],
  attribution: 'exact',
});

/** An obviously-fake rule, for the provenance fixtures. */
const rule = (id: string): MembershipRule => ({
  id,
  name: `Rule ${id}`,
  status: 'ACTIVE',
  conditionExpression: 'user.userType == "Contractor"',
  userAttributes: ['userType'],
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

/**
 * Bucket ids, read through the membership wrapper. Phase 3.6 changed the bucket
 * ELEMENT from `OktaGroup` to `GroupMembership`; the assertions below are
 * unchanged, only the path to the id is.
 */
const ids = (bucket: GroupMembership[]): string[] => bucket.map((m) => m.group.id);

describe('bucketGroups', () => {
  it('splits into onlyCompared / shared / onlyContext by group id', () => {
    const contextGroups = [membership('a'), membership('b')];
    const comparedGroups = [membership('b'), membership('c')];

    const { onlyCompared, shared, onlyContext } = bucketGroups(
      contextGroups,
      comparedGroups,
      new Set(),
    );

    expect(ids(onlyCompared)).toEqual(['c']);
    expect(ids(shared)).toEqual(['b']);
    expect(ids(onlyContext)).toEqual(['a']);
  });

  it('treats addedToContextIds as shared before contextGroups catches up', () => {
    const contextGroups = [membership('a')];
    const comparedGroups = [membership('b'), membership('c')];

    const { onlyCompared, shared } = bucketGroups(contextGroups, comparedGroups, new Set(['b']));

    expect(ids(shared)).toEqual(['b']);
    expect(ids(onlyCompared)).toEqual(['c']);
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
    expect(ids(shared)).toEqual(['b', 'a']);
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
    expect(ids(shared).sort()).toEqual(['a', 'c', 'shared']);
  });

  it('preserves comparedGroups order within onlyCompared/shared', () => {
    const comparedGroups = [membership('z'), membership('a'), membership('m')];
    const { onlyCompared } = bucketGroups([], comparedGroups, new Set());
    expect(ids(onlyCompared)).toEqual(['z', 'a', 'm']);
  });

  // Phase 3.6: buckets carry the whole GroupMembership, not the bare group, so
  // the comparison can say WHY a user is in a group and not merely that they are.
  describe('provenance pass-through', () => {
    const ruleBased = (id: string, over: Partial<GroupMembership> = {}): GroupMembership => ({
      group: group(id),
      membershipType: 'RULE_BASED',
      rules: [rule(`0prFAKE${id}`)],
      attribution: 'inferred',
      ...over,
    });

    it('carries membershipType, rules and attribution into all three buckets', () => {
      const onlyContextM = ruleBased('ctx-only', { attribution: 'ambiguous' });
      const sharedM = ruleBased('both');
      const onlyComparedM = ruleBased('cmp-only', { attribution: 'exact' });

      const { onlyCompared, shared, onlyContext } = bucketGroups(
        [onlyContextM, membership('both')],
        [sharedM, onlyComparedM],
        new Set(),
      );

      expect(onlyCompared[0]).toEqual(onlyComparedM);
      expect(onlyCompared[0].rules.map((r) => r.id)).toEqual(['0prFAKEcmp-only']);
      expect(onlyCompared[0].attribution).toBe('exact');

      // `shared` is taken from the COMPARED side's pass, so it reports the
      // compared user's membership — the context user may hold it another way.
      expect(shared[0]).toEqual(sharedM);
      expect(shared[0].membershipType).toBe('RULE_BASED');
      expect(shared[0].rules.map((r) => r.id)).toEqual(['0prFAKEboth']);

      expect(onlyContext[0]).toEqual(onlyContextM);
      expect(onlyContext[0].attribution).toBe('ambiguous');
      expect(onlyContext[0].rules.map((r) => r.id)).toEqual(['0prFAKEctx-only']);
    });

    it('keeps provenance on a group re-bucketed from onlyContext to shared', () => {
      const copied = ruleBased('a');

      const { shared } = bucketGroups(
        [copied, membership('b')],
        [membership('b')],
        new Set(),
        new Set(['a']),
      );

      expect(ids(shared)).toEqual(['b', 'a']);
      expect(shared[1]).toBe(copied);
      expect(shared[1].rules).toHaveLength(1);
      expect(shared[1].attribution).toBe('inferred');
    });

    it('passes the membership objects through by reference, unmutated', () => {
      const m = ruleBased('x');
      const { onlyCompared } = bucketGroups([], [m], new Set());

      expect(onlyCompared[0]).toBe(m);
      expect(m.rules).toHaveLength(1);
    });
  });
});

describe('groupDiffItem', () => {
  it('projects id and label from the membership group', () => {
    const item = groupDiffItem(membership('g1'));
    expect(item.id).toBe('g1');
    expect(item.label).toBe('g1');
  });

  it('carries the membership whole, so rules and attribution reach the row', () => {
    const m: GroupMembership = {
      group: group('g2', 'VPN Access'),
      membershipType: 'RULE_BASED',
      rules: [rule('0prFAKE0001'), rule('0prFAKE0002')],
      attribution: 'ambiguous',
    };

    const item = groupDiffItem(m);

    expect(item.membership).toBe(m);
    expect(item.membership?.membershipType).toBe('RULE_BASED');
    expect(item.membership?.rules.map((r) => r.id)).toEqual(['0prFAKE0001', '0prFAKE0002']);
    expect(item.membership?.attribution).toBe('ambiguous');
  });

  it('keeps group.type and the description, which the old id+label projection dropped', () => {
    const m: GroupMembership = {
      group: {
        id: 'g3',
        type: 'APP_GROUP',
        profile: { name: 'Salesforce Users', description: 'Mastered by Salesforce' },
      },
      membershipType: 'RULE_BASED',
      rules: [],
      attribution: 'exact',
    };

    const item = groupDiffItem(m);

    expect(item.membership?.group.type).toBe('APP_GROUP');
    expect(item.membership?.group.profile.description).toBe('Mastered by Salesforce');
  });

  it('survives Array.prototype.map, which passes an index and the array', () => {
    const items = [membership('a'), membership('b')].map(groupDiffItem);
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(items.every((i) => i.membership !== undefined)).toBe(true);
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

  // Phase 4.1: entries now carry Okta's assignment `scope`. Bucketing is by id
  // alone, so the scope must ride through every bucket untouched — and an entry
  // without one must bucket exactly as it did before the field existed.
  describe('assignment scope pass-through', () => {
    const scoped = (id: string, scope: AppEntry['scope']): AppEntry => ({ id, label: id, scope });

    it('carries scope through all three buckets', () => {
      const contextApps = [scoped('a', 'USER'), scoped('b', 'GROUP')];
      const comparedApps = [scoped('b', 'USER'), scoped('c', 'GROUP')];

      const { onlyCompared, shared, onlyContext } = bucketApps(contextApps, comparedApps);

      expect(onlyCompared).toEqual([scoped('c', 'GROUP')]);
      expect(onlyContext).toEqual([scoped('a', 'USER')]);
      // `shared` is derived from comparedApps only, so a shared app reports the
      // COMPARED user's scope ('USER' here), not the context user's ('GROUP').
      expect(shared).toEqual([scoped('b', 'USER')]);
    });

    it('buckets by id alone — a differing scope never splits a shared app', () => {
      const { shared, onlyCompared, onlyContext } = bucketApps(
        [scoped('a', 'GROUP')],
        [scoped('a', 'USER')],
      );

      expect(shared.map((a) => a.id)).toEqual(['a']);
      expect(onlyCompared).toEqual([]);
      expect(onlyContext).toEqual([]);
    });

    it('buckets an entry with no scope exactly as before (unknown, not "no direct")', () => {
      const { onlyCompared, shared, onlyContext } = bucketApps(
        [app('a'), scoped('b', 'USER')],
        [app('b'), app('c')],
      );

      expect(onlyCompared.map((a) => a.id)).toEqual(['c']);
      expect(shared.map((a) => a.id)).toEqual(['b']);
      expect(onlyContext.map((a) => a.id)).toEqual(['a']);
      expect(shared[0].scope).toBeUndefined();
    });
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
