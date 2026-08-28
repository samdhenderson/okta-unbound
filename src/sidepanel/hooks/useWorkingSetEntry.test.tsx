/**
 * Tests for useWorkingSetEntry — the declarative recorder a detail rung mounts.
 *
 * The subject is **when it stays silent**. Recording is the easy half; the
 * failures that reach a reader are all writes that should not have happened —
 * a hidden tab re-asserting itself as the most recent thing viewed, a row on
 * Home reading a raw id because the name had not loaded, or one org's entity
 * recorded against another.
 *
 * The store is mocked: its own behaviour has its own suite, and what matters
 * here is which calls the hook makes.
 *
 * All ids are fake, per the repo's no-secrets rule.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const touch = vi.fn(async (_origin: unknown, _ref: unknown) => ({ pinned: [], recent: [] }));
vi.mock('../../shared/storage/workingSetStore', () => ({
  workingSetStore: { touch: (origin: unknown, ref: unknown) => touch(origin, ref) },
}));

const { useWorkingSetEntry } = await import('./useWorkingSetEntry');

const ORIGIN = 'https://example.okta.com';
const GROUP_ID = '00gFAKE0000000000001';

const base = {
  origin: ORIGIN,
  kind: 'group' as const,
  id: GROUP_ID,
  name: 'Engineering',
};

describe('useWorkingSetEntry', () => {
  beforeEach(() => touch.mockClear());

  it('records the open entity, with its pane', () => {
    renderHook(() => useWorkingSetEntry({ ...base, pane: 'Members' }));
    expect(touch).toHaveBeenCalledWith(ORIGIN, {
      kind: 'group',
      id: GROUP_ID,
      name: 'Engineering',
      lastPane: 'Members',
    });
  });

  it('rewrites the entry when the pane changes, so a return lands where you left', () => {
    const { rerender } = renderHook(
      (props: { pane: string }) => useWorkingSetEntry({ ...base, pane: props.pane }),
      { initialProps: { pane: 'Overview' } },
    );
    rerender({ pane: 'Rules' });
    expect(touch).toHaveBeenCalledTimes(2);
    expect(touch).toHaveBeenLastCalledWith(ORIGIN, expect.objectContaining({ lastPane: 'Rules' }));
  });

  it('does not re-record on a re-render that changed nothing', () => {
    const { rerender } = renderHook(() => useWorkingSetEntry({ ...base, pane: 'Members' }));
    rerender();
    rerender();
    expect(touch).toHaveBeenCalledTimes(1);
  });

  it('records nothing while the tab is hidden', () => {
    // Tabs stay mounted (ADR-0018). Without this gate, every mounted rung would
    // re-assert itself as "most recent" over whatever the reader is actually
    // looking at.
    renderHook(() => useWorkingSetEntry({ ...base, enabled: false }));
    expect(touch).not.toHaveBeenCalled();
  });

  it('records nothing before the name has loaded', () => {
    // A nameless entity would put a row on Home reading the raw id, and the
    // write a moment later would be the one that fixed it.
    const { rerender } = renderHook(
      (props: { name: string | null }) => useWorkingSetEntry({ ...base, name: props.name }),
      { initialProps: { name: null as string | null } },
    );
    expect(touch).not.toHaveBeenCalled();
    rerender({ name: 'Engineering' });
    expect(touch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no origin', { origin: null }],
    ['no id', { id: null }],
  ])('records nothing with %s', (_label, override) => {
    renderHook(() => useWorkingSetEntry({ ...base, ...override }));
    expect(touch).not.toHaveBeenCalled();
  });

  it('omits the pane entirely on a rung that has none', () => {
    // The design's `Rule · left on Attributes` is unbuildable — the Rules tab
    // has no view stack and no panes — so a rung with no pane says nothing
    // rather than inventing a location.
    renderHook(() => useWorkingSetEntry(base));
    expect(touch).toHaveBeenCalledWith(ORIGIN, expect.objectContaining({ lastPane: undefined }));
  });
});
