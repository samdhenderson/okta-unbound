/**
 * Tests for useOrgFigures — the org snapshot card's request budget.
 *
 * The honesty rules live in `components/home/orgFigures.ts` and are tested
 * there, without React. What is left here is **what a visit to Home costs**:
 * nothing when the figures are fresh, one cheap top-up per mount when they are
 * not, nothing at all from a hidden tab, and a forced walk only when a person
 * presses Refresh.
 *
 * The snapshot handles are stubs. `useOrgSnapshot`'s own reads, broadcasts and
 * sync ladder have their own subject.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOrgFigures, ORG_FIGURES_MAX_AGE_MS } from './useOrgFigures';
import type { OrgEntityIndex } from './useOrgEntityIndex';

const NOW = 1_800_000_000_000;

interface StubOptions {
  lastFullWalkAt?: number | null;
  isReading?: boolean;
  complete?: boolean;
  ruleStatuses?: Array<'ACTIVE' | 'INACTIVE'>;
}

let syncs: { collection: string; force: boolean }[] = [];

/** A snapshot handle with a recording `sync`. */
function stub(collection: string, rows: unknown[], options: StubOptions) {
  const { lastFullWalkAt = NOW, isReading = false, complete = true } = options;
  return {
    rows,
    records: [],
    isReading,
    complete,
    lastFullWalkAt,
    isSyncing: false,
    error: null,
    sync: vi.fn(async (force = false) => {
      syncs.push({ collection, force });
      return null;
    }),
  };
}

function makeIndex(options: StubOptions = {}): OrgEntityIndex {
  const rules = (options.ruleStatuses ?? ['ACTIVE', 'INACTIVE', 'INACTIVE']).map((status, i) => ({
    id: `0prFAKE000000000000${i}`,
    status,
  }));
  return {
    lookup: () => ({ status: 'unknown' }),
    isAuthoritative: () => true,
    groups: stub('groups', [{ id: 'g1' }, { id: 'g2' }], options),
    rules: stub('rules', rules, options),
    apps: stub('apps', [{ id: 'a1' }], options),
  } as unknown as OrgEntityIndex;
}

/**
 * Render through the real lifecycle: one commit while the snapshot reads are in
 * flight, then the settled one.
 *
 * Not a formality. `useOrgSnapshot` starts at `isReading: false` and flips it
 * true inside its own mount effect, so the first commit looks *settled and
 * never walked* — the exact shape of a cold org. A helper that skipped straight
 * to the settled state would hide the top-up firing against a snapshot nobody
 * had read yet.
 */
const render = (index: OrgEntityIndex, over: { enabled?: boolean; connected?: boolean } = {}) => {
  const reading = { ...index, groups: { ...index.groups, isReading: true } } as OrgEntityIndex;
  const view = renderHook(
    (props: { index: OrgEntityIndex }) =>
      useOrgFigures({
        index: props.index,
        enabled: over.enabled ?? true,
        connected: over.connected ?? true,
      }),
    { initialProps: { index: reading } },
  );
  view.rerender({ index });
  return view;
};

describe('useOrgFigures', () => {
  beforeEach(() => {
    syncs = [];
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  it('derives four figures from three collections', () => {
    const { result } = render(makeIndex());
    expect(result.current.figures.map((f) => f.key)).toEqual(['groups', 'apps', 'rules', 'paused']);
    expect(result.current.figures.map((f) => f.value)).toEqual([2, 1, 3, 2]);
  });

  it('counts paused rules out of the rows already held — no extra read', () => {
    const { result } = render(makeIndex({ ruleStatuses: ['ACTIVE', 'ACTIVE'] }));
    expect(result.current.figures.find((f) => f.key === 'paused')?.value).toBe(0);
    expect(syncs).toEqual([]);
  });

  it('spends nothing when the figures are fresh', async () => {
    // The point of the age floor: a reader flicking between tabs must not buy a
    // drift check every time they pass through Home.
    render(makeIndex({ lastFullWalkAt: NOW - 1000 }));
    await waitFor(() => expect(syncs).toEqual([]));
  });

  it('tops up once when they are older than the floor', async () => {
    render(makeIndex({ lastFullWalkAt: NOW - ORG_FIGURES_MAX_AGE_MS - 1 }));
    await waitFor(() => expect(syncs).toHaveLength(3));
    // `sync(false)` — the 0-to-1-request ladder, never a walk.
    expect(syncs.every((s) => s.force === false)).toBe(true);
    expect(syncs.map((s) => s.collection).sort()).toEqual(['apps', 'groups', 'rules']);
  });

  it('tops up when a collection has never been walked', async () => {
    render(makeIndex({ lastFullWalkAt: null, complete: false }));
    await waitFor(() => expect(syncs).toHaveLength(3));
  });

  it('tops up at most once per mount', async () => {
    const index = makeIndex({ lastFullWalkAt: null, complete: false });
    const { rerender } = render(index);
    await waitFor(() => expect(syncs).toHaveLength(3));
    rerender({ index });
    rerender({ index });
    expect(syncs).toHaveLength(3);
  });

  it('spends nothing from a hidden tab', async () => {
    // Tabs stay mounted (ADR-0018); a tab nobody is looking at drives no
    // org-wide traffic.
    render(makeIndex({ lastFullWalkAt: null, complete: false }), { enabled: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(syncs).toEqual([]);
  });

  it('spends nothing with no Okta tab connected', async () => {
    render(makeIndex({ lastFullWalkAt: null, complete: false }), { connected: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(syncs).toEqual([]);
  });

  it('does not decide on the age while the read is still in flight', async () => {
    // Deciding before the stamp is known would top up a snapshot that turns out
    // to be minutes old.
    const index = makeIndex({ isReading: true, lastFullWalkAt: null });
    renderHook(() => useOrgFigures({ index, enabled: true, connected: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(syncs).toEqual([]);
  });

  it('does not top up on the first commit, before any read has started', async () => {
    // The exact sequence `useOrgSnapshot` produces for a WARM org: it holds
    // `isReading: false` and `lastFullWalkAt: null` until its own mount effect
    // runs, so the opening commit is indistinguishable from a cold org. Acting
    // on it would spend a drift check on every single mount of Home.
    const beforeRead = makeIndex({ lastFullWalkAt: null, complete: false });
    const reading = {
      ...beforeRead,
      groups: { ...beforeRead.groups, isReading: true },
    } as OrgEntityIndex;
    const settled = makeIndex({ lastFullWalkAt: NOW - 1000 });

    const { rerender } = renderHook(
      (props: { index: OrgEntityIndex }) =>
        useOrgFigures({ index: props.index, enabled: true, connected: true }),
      { initialProps: { index: beforeRead } },
    );
    rerender({ index: reading });
    rerender({ index: settled });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(syncs).toEqual([]);
  });

  it('forces a real walk on Refresh, floor or no floor', async () => {
    const { result } = render(makeIndex({ lastFullWalkAt: NOW - 1000 }));
    await act(async () => {
      result.current.refresh();
    });
    expect(syncs).toHaveLength(3);
    expect(syncs.every((s) => s.force === true)).toBe(true);
  });

  it('quotes the oldest walk behind the card', () => {
    const index = makeIndex();
    (index.apps as { lastFullWalkAt: number | null }).lastFullWalkAt = NOW - 9000;
    const { result } = render(index);
    expect(result.current.readAt).toBe(NOW - 9000);
  });

  it('states no age at all when a collection has never been walked', () => {
    const { result } = render(makeIndex({ lastFullWalkAt: null, complete: false }));
    expect(result.current.readAt).toBeNull();
  });

  it('cannot refresh without a connected tab', () => {
    const { result } = render(makeIndex(), { connected: false });
    expect(result.current.canRefresh).toBe(false);
  });
});
