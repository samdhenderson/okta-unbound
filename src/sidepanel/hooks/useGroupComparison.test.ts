/**
 * `useGroupComparison`: the Group Detail rung's second-operand picker.
 *
 * The comparison itself is not this hook's job — `GroupComparisonModal` and
 * `api.compareGroups` already do it for the Groups list, and this hook only
 * names the group to compare against. So what is pinned here is the part that
 * has no other owner: the search never offers the group you are already looking
 * at, the search does not run behind a closed dialog (ADR-0018), and the
 * confirmed operand is the single nullable discriminant that opens the result
 * modal.
 *
 * Mocked at the `useOktaApi` facade (docs/testing.md). Fixtures use fake
 * placeholders (`00gFAKE…`) only.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { GroupSummary } from '../../shared/types';

const api = vi.hoisted(() => ({
  makeApiRequest: vi.fn(),
}));

vi.mock('./useOktaApi', () => ({
  useOktaApi: () => api,
}));

import { useGroupComparison } from './useGroupComparison';

const group = (id: string, name: string, memberCount = 0): GroupSummary => ({
  id,
  name,
  type: 'OKTA_GROUP',
  memberCount,
  hasRules: false,
  ruleCount: 0,
  usedInRuleCount: 0,
});

const viewed = group('00gFAKE1', 'Engineering', 128);

/** The raw `expand=stats` shape the live search maps from. */
const rawGroup = (id: string, name: string, usersCount: number) => ({
  id,
  type: 'OKTA_GROUP',
  profile: { name },
  _embedded: { stats: { usersCount } },
});

beforeEach(() => {
  vi.clearAllMocks();
  api.makeApiRequest.mockResolvedValue({ success: true, data: [] });
});

describe('useGroupComparison', () => {
  it('runs no search until the picker is opened', async () => {
    const { result } = renderHook(() => useGroupComparison({ group: viewed, targetTabId: 1 }));

    act(() => result.current.setQuery('eng'));
    await waitFor(() => expect(result.current.query).toBe('eng'));

    expect(api.makeApiRequest).not.toHaveBeenCalled();
  });

  it('never offers the group already on screen as the other operand', async () => {
    api.makeApiRequest.mockResolvedValue({
      success: true,
      data: [rawGroup('00gFAKE1', 'Engineering', 128), rawGroup('00gFAKE2', 'Product', 61)],
    });

    const { result } = renderHook(() => useGroupComparison({ group: viewed, targetTabId: 1 }));
    act(() => result.current.openPicker());
    act(() => result.current.setQuery('e'));

    await waitFor(() => expect(result.current.results.length).toBe(1));
    expect(result.current.results[0]?.id).toBe('00gFAKE2');
  });

  it('carries the member count the comparison is computed against', async () => {
    api.makeApiRequest.mockResolvedValue({
      success: true,
      data: [rawGroup('00gFAKE2', 'Product', 61)],
    });

    const { result } = renderHook(() => useGroupComparison({ group: viewed, targetTabId: 1 }));
    act(() => result.current.openPicker());
    act(() => result.current.setQuery('pro'));

    await waitFor(() => expect(result.current.results.length).toBe(1));
    expect(result.current.results[0]?.memberCount).toBe(61);
  });

  it('opens no comparison until a pick is confirmed', () => {
    const { result } = renderHook(() => useGroupComparison({ group: viewed, targetTabId: 1 }));

    act(() => result.current.openPicker());
    expect(result.current.comparedWith).toBeNull();

    act(() => result.current.select(group('00gFAKE2', 'Product', 61)));
    expect(result.current.comparedWith).toBeNull();
    expect(result.current.selected?.id).toBe('00gFAKE2');

    act(() => result.current.confirm());
    expect(result.current.isPicking).toBe(false);
    expect(result.current.comparedWith?.id).toBe('00gFAKE2');
  });

  it('confirming nothing opens nothing', () => {
    const { result } = renderHook(() => useGroupComparison({ group: viewed, targetTabId: 1 }));

    act(() => result.current.openPicker());
    act(() => result.current.confirm());

    expect(result.current.comparedWith).toBeNull();
    expect(result.current.isPicking).toBe(true);
  });

  it('dismissing the picker drops the pick, so reopening is a clean slate', () => {
    const { result } = renderHook(() => useGroupComparison({ group: viewed, targetTabId: 1 }));

    act(() => result.current.openPicker());
    act(() => result.current.select(group('00gFAKE2', 'Product', 61)));
    act(() => result.current.closePicker());

    expect(result.current.selected).toBeNull();
    expect(result.current.query).toBe('');
  });

  it('closing the comparison leaves nothing open behind it', () => {
    const { result } = renderHook(() => useGroupComparison({ group: viewed, targetTabId: 1 }));

    act(() => result.current.openPicker());
    act(() => result.current.select(group('00gFAKE2', 'Product', 61)));
    act(() => result.current.confirm());
    act(() => result.current.closeComparison());

    expect(result.current.comparedWith).toBeNull();
    expect(result.current.isPicking).toBe(false);
  });

  it('suspends the search while the tab is hidden', async () => {
    const { result } = renderHook(() =>
      useGroupComparison({ group: viewed, targetTabId: 1, enabled: false }),
    );

    act(() => result.current.openPicker());
    act(() => result.current.setQuery('eng'));
    await waitFor(() => expect(result.current.query).toBe('eng'));

    expect(api.makeApiRequest).not.toHaveBeenCalled();
  });
});
