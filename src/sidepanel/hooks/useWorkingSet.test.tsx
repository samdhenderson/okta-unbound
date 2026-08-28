/**
 * Tests for useWorkingSet — the read side of the Home tab's working set.
 *
 * Two behaviours here are worth pinning and easy to lose. **Switching orgs
 * blanks the list before the new read lands**, because a group name from the
 * org you just left must not sit on screen under the new org's identity, even
 * for a frame. And **a write repaints immediately**, because
 * `chrome.storage.onChanged` does not fire in the page that wrote it — waiting
 * for a broadcast would leave the pin unpressed until some unrelated change
 * came along.
 *
 * All ids and names are fake, per the repo's no-secrets rule.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { WorkingSet } from '../../shared/storage/workingSetStore';

const ORG_A = 'https://a.example.okta.com';
const ORG_B = 'https://b.example.okta.com';

const ref = (id: string, name: string) => ({
  kind: 'group' as const,
  id,
  name,
  lastSeenAt: 1,
});

const setA: WorkingSet = { pinned: [ref('g1', 'Org A group')], recent: [] };
const setB: WorkingSet = { pinned: [ref('g2', 'Org B group')], recent: [] };

const read = vi.fn(async (origin: string | null | undefined) =>
  origin === ORG_A ? setA : origin === ORG_B ? setB : { pinned: [], recent: [] },
);
const togglePin = vi.fn(async () => ({ pinned: [], recent: [] }) as WorkingSet);
const forget = vi.fn(async () => ({ pinned: [], recent: [] }) as WorkingSet);
const subscribers = new Set<(file: unknown) => void>();

vi.mock('../../shared/storage/workingSetStore', () => ({
  EMPTY_WORKING_SET: { pinned: [], recent: [] },
  workingSetStore: {
    read: (...args: [string | null | undefined]) => read(...args),
    togglePin: (...args: unknown[]) => togglePin(...(args as [])),
    forget: (...args: unknown[]) => forget(...(args as [])),
    subscribe: (listener: (file: unknown) => void) => {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    select: (file: { origins: Record<string, WorkingSet> }, origin: string) =>
      file.origins[origin] ?? { pinned: [], recent: [] },
  },
}));

const { useWorkingSet } = await import('./useWorkingSet');

describe('useWorkingSet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribers.clear();
  });

  it('reads the connected org’s set', async () => {
    const { result } = renderHook(() => useWorkingSet(ORG_A));
    await waitFor(() => expect(result.current.isReading).toBe(false));
    expect(result.current.pinned.map((r) => r.name)).toEqual(['Org A group']);
  });

  it('blanks the previous org before the next read lands', async () => {
    const { result, rerender } = renderHook((origin: string) => useWorkingSet(origin), {
      initialProps: ORG_A,
    });
    await waitFor(() => expect(result.current.pinned).toHaveLength(1));

    rerender(ORG_B);
    // Synchronously after the switch, and before the ORG_B read resolves: the
    // name from the org just left must not linger under the new identity.
    expect(result.current.pinned).toEqual([]);

    await waitFor(() => expect(result.current.pinned.map((r) => r.name)).toEqual(['Org B group']));
  });

  it('reads nothing without an origin', async () => {
    const { result } = renderHook(() => useWorkingSet(null));
    await waitFor(() => expect(result.current.isReading).toBe(false));
    expect(result.current.pinned).toEqual([]);
  });

  it('reports whether one entity is pinned', async () => {
    const { result } = renderHook(() => useWorkingSet(ORG_A));
    await waitFor(() => expect(result.current.pinned).toHaveLength(1));
    expect(result.current.isPinned('group', 'g1')).toBe(true);
    expect(result.current.isPinned('user', 'g1')).toBe(false);
    expect(result.current.isPinned('group', 'g9')).toBe(false);
  });

  it('repaints from the toggle’s own result, not from a broadcast', async () => {
    // `chrome.storage.onChanged` does not fire in the page that wrote it.
    const next: WorkingSet = { pinned: [ref('g5', 'Newly pinned')], recent: [] };
    togglePin.mockResolvedValueOnce(next);

    const { result } = renderHook(() => useWorkingSet(ORG_A));
    await waitFor(() => expect(result.current.isReading).toBe(false));

    await act(async () => {
      result.current.togglePin({ kind: 'group', id: 'g5', name: 'Newly pinned' });
    });
    expect(result.current.pinned.map((r) => r.name)).toEqual(['Newly pinned']);
  });

  it('repaints when another surface writes', async () => {
    // The case this exists for: pinning from the Groups tab while Home is
    // hidden. Without the subscription Home would show yesterday's list until
    // the panel was reopened.
    const { result } = renderHook(() => useWorkingSet(ORG_A));
    await waitFor(() => expect(result.current.isReading).toBe(false));

    const broadcast = {
      origins: { [ORG_A]: { pinned: [ref('g9', 'From elsewhere')], recent: [] } },
    };
    act(() => subscribers.forEach((listener) => listener(broadcast)));

    expect(result.current.pinned.map((r) => r.name)).toEqual(['From elsewhere']);
  });

  it('does not subscribe without an origin', () => {
    renderHook(() => useWorkingSet(null));
    expect(subscribers.size).toBe(0);
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useWorkingSet(ORG_A));
    await waitFor(() => expect(subscribers.size).toBe(1));
    unmount();
    expect(subscribers.size).toBe(0);
  });

  it('forgets an entity through the store', async () => {
    const { result } = renderHook(() => useWorkingSet(ORG_A));
    await waitFor(() => expect(result.current.isReading).toBe(false));
    await act(async () => {
      result.current.forget('group', 'g1');
    });
    expect(forget).toHaveBeenCalledWith(ORG_A, { kind: 'group', id: 'g1' });
  });
});
