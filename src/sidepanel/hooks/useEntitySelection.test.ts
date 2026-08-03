/**
 * Tests for useEntitySelection — the generic id-set selection hook.
 *
 * Pins toggle semantics (add/remove), whole-selection replacement, deselect-all,
 * and the full-list resolution contract: selected entities are resolved against
 * the complete list passed in, so ids hidden by a filtered view stay selected.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntitySelection } from './useEntitySelection';

interface FakeEntity {
  id: string;
  name: string;
}

const ENTITIES: FakeEntity[] = [
  { id: '00gFAKE00000000000001', name: 'Alpha' },
  { id: '00gFAKE00000000000002', name: 'Beta' },
  { id: '00gFAKE00000000000003', name: 'Gamma' },
];

describe('useEntitySelection', () => {
  it('starts with an empty selection', () => {
    const { result } = renderHook(() => useEntitySelection(ENTITIES));
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.selectedEntities).toEqual([]);
  });

  it('toggleSelect adds then removes an id', () => {
    const { result } = renderHook(() => useEntitySelection(ENTITIES));

    act(() => result.current.toggleSelect('00gFAKE00000000000002'));
    expect(result.current.selectedIds.has('00gFAKE00000000000002')).toBe(true);
    expect(result.current.selectedEntities).toEqual([
      { id: '00gFAKE00000000000002', name: 'Beta' },
    ]);

    act(() => result.current.toggleSelect('00gFAKE00000000000002'));
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.selectedEntities).toEqual([]);
  });

  it('replaceSelection swaps the whole selection', () => {
    const { result } = renderHook(() => useEntitySelection(ENTITIES));

    act(() => result.current.toggleSelect('00gFAKE00000000000001'));
    act(() => result.current.replaceSelection(['00gFAKE00000000000002', '00gFAKE00000000000003']));

    expect(result.current.selectedIds.has('00gFAKE00000000000001')).toBe(false);
    expect(result.current.selectedEntities.map((e) => e.name)).toEqual(['Beta', 'Gamma']);
  });

  it('deselectAll clears the selection', () => {
    const { result } = renderHook(() => useEntitySelection(ENTITIES));

    act(() => result.current.replaceSelection(ENTITIES.map((e) => e.id)));
    act(() => result.current.deselectAll());

    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.selectedEntities).toEqual([]);
  });

  it('resolves selected entities against the full list, keeping hidden picks selected', () => {
    // Simulate a filtered view by re-rendering with a narrower list: the id stays
    // selected, and reappears in selectedEntities once the full list returns.
    const { result, rerender } = renderHook(({ list }) => useEntitySelection(list), {
      initialProps: { list: ENTITIES },
    });

    act(() => result.current.toggleSelect('00gFAKE00000000000003'));
    expect(result.current.selectedEntities.map((e) => e.name)).toEqual(['Gamma']);

    rerender({ list: ENTITIES.slice(0, 2) });
    expect(result.current.selectedIds.has('00gFAKE00000000000003')).toBe(true);
    expect(result.current.selectedEntities).toEqual([]);

    rerender({ list: ENTITIES });
    expect(result.current.selectedEntities.map((e) => e.name)).toEqual(['Gamma']);
  });

  it('ignores selected ids that are not in the list when resolving entities', () => {
    const { result } = renderHook(() => useEntitySelection(ENTITIES));

    act(() => result.current.replaceSelection(['00gFAKE00000000000099']));

    expect(result.current.selectedIds.has('00gFAKE00000000000099')).toBe(true);
    expect(result.current.selectedEntities).toEqual([]);
  });
});
