/**
 * Tests for `useMemberFilters` — the member explorer's facet-filter set.
 *
 * The companion to `components/members/MemberExplorer.test.tsx`: that suite
 * pins what a reader sees, this one pins the grammar underneath it, including
 * the parts no single layout exercises (multi-attribute composition, the
 * three-state factor mode, dimension-scoped clears).
 *
 * The set is also fed through the real `filterMembers` in a few cases, because
 * "the set says department + status" and "the list narrows to the intersection"
 * are two claims, and only the second is the one that matters.
 */
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMemberFilters } from './useMemberFilters';
import {
  filterMembers,
  type BreakdownRow,
  type MemberFilter,
} from '../components/members/memberAnalytics';
import type { OktaUser, UserStatus } from '../../shared/types';

const row = (value: string, label = value): BreakdownRow => ({ value, label, count: 1, pct: 10 });

function member(n: number, status: UserStatus, department: string): OktaUser {
  return {
    id: `00uFAKE0000000000${n}`,
    status,
    profile: {
      firstName: 'Ada',
      lastName: `Lovelace ${n}`,
      email: `member${n}@example.com`,
      login: `member${n}@example.com`,
      department,
    },
  };
}

const members: OktaUser[] = [
  member(1, 'ACTIVE', 'Engineering'),
  member(2, 'ACTIVE', 'Support'),
  member(3, 'SUSPENDED', 'Engineering'),
  member(4, 'SUSPENDED', 'Support'),
];

describe('useMemberFilters', () => {
  it('starts with nothing applied', () => {
    const { result } = renderHook(() => useMemberFilters());

    expect(result.current.filters).toEqual([]);
    expect(result.current.activeCount).toBe(0);
    expect(result.current.key).toBe('');
  });

  it('adds a filter with the label the chip will show', () => {
    const { result } = renderHook(() => useMemberFilters());

    act(() => result.current.toggleStatus(row('ACTIVE')));

    expect(result.current.filters).toEqual([
      { dimension: 'status', value: 'ACTIVE', label: 'Status: ACTIVE' },
    ]);
    expect(result.current.activeCount).toBe(1);
  });

  it('re-selecting the same value removes it — a pill is its own off switch', () => {
    const { result } = renderHook(() => useMemberFilters());

    act(() => result.current.toggleStatus(row('ACTIVE')));
    act(() => result.current.toggleStatus(row('ACTIVE')));

    expect(result.current.filters).toEqual([]);
  });

  it('titles a breakdown row by its dimension', () => {
    const { result } = renderHook(() => useMemberFilters());

    act(() => result.current.toggleRow('department', row('Engineering')));

    expect(result.current.filters[0].label).toBe('Department: Engineering');
  });

  it('keeps two values of one dimension side by side', () => {
    const { result } = renderHook(() => useMemberFilters());

    act(() => result.current.toggleRow('department', row('Engineering')));
    act(() => result.current.toggleRow('department', row('Support')));

    expect(result.current.valuesFor('department')).toEqual(new Set(['Engineering', 'Support']));
    // OR within a dimension: both departments is everyone, not nobody.
    expect(filterMembers(members, '', result.current.filters, null)).toHaveLength(4);
  });

  it('intersects across dimensions', () => {
    const { result } = renderHook(() => useMemberFilters());

    act(() => result.current.toggleRow('department', row('Engineering')));
    act(() => result.current.toggleStatus(row('SUSPENDED')));

    const shown = filterMembers(members, '', result.current.filters, null);
    expect(shown.map((m) => m.id)).toEqual(['00uFAKE00000000003']);
  });

  it('composes three dimensions at once, source included', () => {
    const { result } = renderHook(() => useMemberFilters());
    const buckets = new Map([['direct', new Set(['00uFAKE00000000001'])]]);

    act(() => result.current.toggleRow('department', row('Engineering')));
    act(() => result.current.toggleStatus(row('ACTIVE')));
    act(() => result.current.toggleSource('direct', 'Manual'));

    expect(result.current.activeCount).toBe(3);
    expect(result.current.sourceKeys).toEqual(new Set(['direct']));
    const shown = filterMembers(members, '', result.current.filters, null, buckets);
    expect(shown.map((m) => m.id)).toEqual(['00uFAKE00000000001']);
  });

  it('narrows to nobody when the dimensions disagree, rather than widening', () => {
    const { result } = renderHook(() => useMemberFilters());

    act(() => result.current.toggleRow('department', row('Engineering')));
    act(() => result.current.toggleRow('department', row('Support')));
    act(() => result.current.toggleStatus(row('DEPROVISIONED')));

    expect(filterMembers(members, '', result.current.filters, null)).toEqual([]);
  });

  it('removes one filter by identity and leaves its neighbours', () => {
    const { result } = renderHook(() => useMemberFilters());

    act(() => result.current.toggleStatus(row('ACTIVE')));
    act(() => result.current.toggleRow('department', row('Support')));
    act(() => result.current.remove(result.current.filters[0]));

    expect(result.current.filters).toHaveLength(1);
    expect(result.current.filters[0].dimension).toBe('department');
  });

  it('clears one dimension without touching the others', () => {
    const { result } = renderHook(() => useMemberFilters());

    act(() => result.current.toggleStatus(row('ACTIVE')));
    act(() => result.current.toggleStatus(row('SUSPENDED')));
    act(() => result.current.toggleSource('direct', 'Manual'));

    act(() => result.current.clearStatus());
    expect(result.current.valuesFor('status')).toEqual(new Set());
    expect(result.current.sourceKeys).toEqual(new Set(['direct']));

    act(() => result.current.clearSource());
    expect(result.current.sourceKeys).toEqual(new Set());
  });

  it('drops everything on clearAll', () => {
    const { result } = renderHook(() => useMemberFilters());

    act(() => result.current.toggleStatus(row('ACTIVE')));
    act(() => result.current.toggleSource('direct', 'Manual'));
    act(() => result.current.toggleMfaValue('none', 'No factors enrolled'));

    act(() => result.current.clearAll());

    expect(result.current.filters).toEqual([]);
    expect(result.current.key).toBe('');
  });

  describe('the three-state factor mode', () => {
    it('has and missing for one factor are exclusive, not cumulative', () => {
      const { result } = renderHook(() => useMemberFilters());

      act(() => result.current.setFactorMode('SMS', 'has'));
      expect(result.current.filters).toEqual([
        { dimension: 'mfa', value: 'has:SMS', label: 'Has SMS' },
      ]);

      act(() => result.current.setFactorMode('SMS', 'missing'));
      expect(result.current.filters).toEqual([
        { dimension: 'mfa', value: 'missing:SMS', label: 'Missing SMS' },
      ]);
    });

    it('off removes the factor entirely', () => {
      const { result } = renderHook(() => useMemberFilters());

      act(() => result.current.setFactorMode('SMS', 'has'));
      act(() => result.current.setFactorMode('SMS', 'off'));

      expect(result.current.filters).toEqual([]);
    });

    it('constrains two different factors independently', () => {
      const { result } = renderHook(() => useMemberFilters());

      act(() => result.current.setFactorMode('SMS', 'has'));
      act(() => result.current.setFactorMode('Okta Verify', 'missing'));

      expect(result.current.valuesFor('mfa')).toEqual(new Set(['has:SMS', 'missing:Okta Verify']));
    });

    it('leaves a count-based MFA value alone when a factor mode changes', () => {
      const { result } = renderHook(() => useMemberFilters());

      act(() => result.current.toggleMfaValue('multiple', 'Multiple factors (2+)'));
      act(() => result.current.setFactorMode('SMS', 'has'));

      expect(result.current.valuesFor('mfa')).toEqual(new Set(['multiple', 'has:SMS']));
    });
  });

  describe('the reset key', () => {
    it('changes when the set changes', () => {
      const { result } = renderHook(() => useMemberFilters());
      const empty = result.current.key;

      act(() => result.current.toggleStatus(row('ACTIVE')));
      expect(result.current.key).not.toBe(empty);

      const one = result.current.key;
      act(() => result.current.toggleRow('department', row('Support')));
      expect(result.current.key).not.toBe(one);
    });

    it('is built from the dimension and value, not the display label', () => {
      const { result } = renderHook(() => useMemberFilters());

      act(() => result.current.toggleStatus(row('ACTIVE', 'Active')));

      expect(result.current.key).toBe('status:ACTIVE');
    });
  });
});

describe('a filter requested by another surface', () => {
  const request = { dimension: 'department', value: 'Support', label: 'Department: Support' };

  it('applies one already in hand on the first render', () => {
    const { result } = renderHook(() => useMemberFilters({ pendingFilter: request }));

    expect(result.current.filters).toEqual([request]);
  });

  it('applies one that arrives later, against a live set', () => {
    const { result, rerender } = renderHook(
      ({ pendingFilter }: { pendingFilter: MemberFilter | null }) =>
        useMemberFilters({ pendingFilter }),
      { initialProps: { pendingFilter: null as MemberFilter | null } },
    );

    act(() => result.current.toggleStatus(row('ACTIVE')));
    rerender({ pendingFilter: request });

    // Added to what was already there, not replacing it.
    expect(result.current.valuesFor('status')).toEqual(new Set(['ACTIVE']));
    expect(result.current.valuesFor('department')).toEqual(new Set(['Support']));
  });

  it('applies each request once, so a re-render does not re-add a removed chip', () => {
    const { result, rerender } = renderHook(
      ({ pendingFilter }: { pendingFilter: MemberFilter | null }) =>
        useMemberFilters({ pendingFilter }),
      { initialProps: { pendingFilter: request as MemberFilter | null } },
    );

    act(() => result.current.remove(result.current.filters[0]));
    expect(result.current.filters).toEqual([]);

    // Same object, same request — already honoured.
    rerender({ pendingFilter: request });
    expect(result.current.filters).toEqual([]);
  });

  it('is a jump, not a toggle — asking for a filter already applied leaves it on', () => {
    const { result, rerender } = renderHook(
      ({ pendingFilter }: { pendingFilter: MemberFilter | null }) =>
        useMemberFilters({ pendingFilter }),
      { initialProps: { pendingFilter: request as MemberFilter | null } },
    );

    // A second click over on Insights builds a new object for the same value.
    rerender({ pendingFilter: { ...request } });

    expect(result.current.filters).toEqual([request]);
  });

  it('leaves the set alone when nobody is asking', () => {
    const { result } = renderHook(() => useMemberFilters({ pendingFilter: null }));

    expect(result.current.filters).toEqual([]);
  });
});
