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
  /** HTTP status of the collection's last sync attempt (D-068). */
  status?: number | null;
  /** Overrides applied to the rules handle only, so one collection can lag. */
  rulesOver?: Partial<StubOptions>;
}

let syncs: { collection: string; force: boolean }[] = [];

/** A snapshot handle with a recording `sync`. */
function stub(
  collection: string,
  rows: unknown[],
  options: StubOptions,
  records: { id: string }[] = [],
) {
  const { lastFullWalkAt = NOW, isReading = false, complete = true, status = null } = options;
  return {
    rows,
    records,
    isReading,
    complete,
    lastFullWalkAt,
    isSyncing: false,
    error: null,
    status,
    sync: vi.fn(async (force = false) => {
      syncs.push({ collection, force });
      return null;
    }),
  };
}

/**
 * Two groups: one with a member, one empty. One rule feeds `g1` and nothing
 * feeds `g2`, so `empty` and `no rules` are both 1 and are not the same group —
 * a stub where they coincided could not tell the two joins apart.
 */
function makeIndex(options: StubOptions = {}): OrgEntityIndex {
  const rules = (options.ruleStatuses ?? ['ACTIVE', 'INACTIVE', 'INACTIVE']).map((status, i) => ({
    id: `0prFAKE000000000000${i}`,
    status,
    actions: i === 0 ? { assignUserToGroups: { groupIds: ['g1'] } } : undefined,
  }));
  const groups = [
    { id: 'g1', _embedded: { stats: { usersCount: 7 } } },
    { id: 'g2', _embedded: { stats: { usersCount: 0 } } },
  ];
  // One active push app with an assignment stored, one with none (the finding),
  // and one plain app that is deactivated.
  const apps = [
    { id: 'a1', status: 'ACTIVE', features: ['GROUP_PUSH'] },
    { id: 'a2', status: 'ACTIVE', features: ['GROUP_PUSH'] },
    { id: 'a3', status: 'INACTIVE' },
  ];
  return {
    lookup: () => ({ status: 'unknown' }),
    isAuthoritative: () => true,
    groups: stub('groups', groups, options),
    rules: stub('rules', rules, { ...options, ...options.rulesOver }),
    apps: stub('apps', apps, options),
    appGroups: stub('appGroups', [], options, [{ id: 'a1::g1' }]),
  } as unknown as OrgEntityIndex;
}

/** Find one finding by key. */
const sub = (
  boxes: { subCounts: { key: string; value: number | null; note?: string }[] }[],
  key: string,
) => boxes.flatMap((box) => box.subCounts).find((s) => s.key === key);

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

  it('derives one entry per collection from what is already mounted', () => {
    const { result } = render(makeIndex());
    expect(result.current.boxes.map((b) => b.key)).toEqual(['groups', 'apps', 'rules']);
    expect(result.current.boxes.map((b) => b.value)).toEqual([2, 3, 3]);
    expect(result.current.boxes.map((b) => b.tab)).toEqual(['groups', 'apps', 'rules']);
    expect(result.current.boxes.map((b) => b.noun)).toEqual([
      'groups',
      'applications',
      'group rules',
    ]);
  });

  it('derives every finding from rows already held — no extra read', () => {
    const { result } = render(makeIndex());
    const { boxes } = result.current;
    expect(sub(boxes, 'groups-empty')?.value).toBe(1);
    expect(sub(boxes, 'groups-unruled')?.value).toBe(1);
    expect(sub(boxes, 'apps-inactive')?.value).toBe(1);
    expect(sub(boxes, 'apps-idle-push')?.value).toBe(1);
    expect(sub(boxes, 'rules-paused')?.value).toBe(2);
    expect(syncs).toEqual([]);
  });

  it('agrees with a denominator of one — the nouns are declared plural (I-024)', () => {
    // End to end, because the fix lives in `orgFigures` while the nouns are
    // declared here: an org with a single application rendered "of 1
    // applications" on the panel's landing surface. The singular is derived
    // from the declared plural, so this passes with the literals untouched.
    const base = makeIndex();
    const index = {
      ...base,
      apps: stub('apps', [{ id: 'a1', status: 'INACTIVE' }], {}),
    } as unknown as OrgEntityIndex;
    const { result } = render(index);
    expect(sub(result.current.boxes, 'apps-inactive')).toMatchObject({
      value: 1,
      note: 'of 1 application',
    });
    // The collections with more than one of them are untouched.
    expect(sub(result.current.boxes, 'groups-empty')?.note).toBe('of 2 groups');
    expect(sub(result.current.boxes, 'rules-paused')?.note).toBe('of 3 group rules');
  });

  it('counts paused rules out of the rows already held', () => {
    const { result } = render(makeIndex({ ruleStatuses: ['ACTIVE', 'ACTIVE'] }));
    expect(sub(result.current.boxes, 'rules-paused')?.value).toBe(0);
  });

  it('carries each finding’s filtered destination with it', () => {
    const { result } = render(makeIndex());
    const requests = result.current.boxes.flatMap((box) =>
      box.subCounts.map((subCount) => subCount.request),
    );
    expect(requests).toEqual([
      { tab: 'groups', view: 'empty' },
      { tab: 'groups', view: 'no-rules' },
      { tab: 'apps', view: 'inactive' },
      { tab: 'apps', view: 'pushes-nothing' },
      { tab: 'rules', view: 'paused' },
    ]);
  });

  it('suppresses a subtracting finding when the collection it subtracts was never walked', () => {
    // Groups walked cleanly; rules never did. "Empty" is still exact — it reads
    // only the group rows — but "no rules" must not report both groups as unfed
    // on the strength of a rule list that does not exist.
    const { result } = render(makeIndex({ rulesOver: { lastFullWalkAt: null, complete: false } }));
    expect(sub(result.current.boxes, 'groups-empty')?.value).toBe(1);
    expect(sub(result.current.boxes, 'groups-unruled')?.value).toBeNull();
    expect(sub(result.current.boxes, 'groups-unruled')?.note).toBe(
      'Needs group rules, which have not been read.',
    );
  });

  /**
   * A groups handle with no rows and no finished walk, so `figureStatus`
   * lands on `unavailable` rather than `partial` — the branch
   * `unavailableNote` actually names a permission problem from.
   */
  function unwalkedGroupsIndex(status: number | null): OrgEntityIndex {
    const index = makeIndex();
    return {
      ...index,
      groups: stub('groups', [], { lastFullWalkAt: null, complete: false, status }),
    } as unknown as OrgEntityIndex;
  }

  it('names the permission problem when a collection’s last walk stopped on a 403 (D-068)', () => {
    // The status is threaded from the snapshot handle into `FigureSource`, so
    // `unavailableNote` can tell a 401/403 apart from any other failure — this
    // is the wiring D-068 closes: before it, `toSource` dropped the status and
    // this note read the generic "have not been read yet" line instead.
    const { result } = render(unwalkedGroupsIndex(403));
    const groupsBox = result.current.boxes.find((box) => box.key === 'groups');
    expect(groupsBox?.note).toBe('You are not allowed to read groups.');
  });

  it('keeps the generic copy for a non-permission failure (429, a dropped connection)', () => {
    // Only 401/403 earn the specific claim; every other status is not evidence
    // of a permissions problem and must not be reported as one.
    const { result } = render(unwalkedGroupsIndex(429));
    const groupsBox = result.current.boxes.find((box) => box.key === 'groups');
    expect(groupsBox?.note).toBe('Groups have not been read yet.');
  });

  it('drops the permission note once a later walk succeeds', () => {
    // The recovery case: a stale 403 must not outlive the walk that cleared
    // it. Pinned here at the render boundary — `useOrgSnapshot` persisting
    // `SyncMeta.status: null` on a successful sync is pinned separately in
    // `orgSnapshotStore.test.ts` — this proves the card stops showing the
    // permission copy the moment the handle it reads reports `status: null`
    // again.
    const { result, rerender } = render(unwalkedGroupsIndex(403));
    expect(result.current.boxes.find((box) => box.key === 'groups')?.note).toBe(
      'You are not allowed to read groups.',
    );

    const recovered = makeIndex({ lastFullWalkAt: NOW, complete: true, status: null });
    rerender({ index: recovered });

    const groupsBox = result.current.boxes.find((box) => box.key === 'groups');
    expect(groupsBox?.note).toBeUndefined();
    expect(groupsBox?.value).toBe(2);
  });

  it('spends nothing when the figures are fresh', async () => {
    // The point of the age floor: a reader flicking between tabs must not buy a
    // drift check every time they pass through Home.
    render(makeIndex({ lastFullWalkAt: NOW - 1000 }));
    await waitFor(() => expect(syncs).toEqual([]));
  });

  it('tops up with ONE sync when they are older than the floor', async () => {
    render(makeIndex({ lastFullWalkAt: NOW - ORG_FIGURES_MAX_AGE_MS - 1 }));
    await waitFor(() => expect(syncs).toHaveLength(1));
    // One, not one per collection: `syncSnapshot` is org-wide and walks every
    // collection, so four calls would be four messages answered by one run.
    expect(syncs).toEqual([{ collection: 'groups', force: false }]);
  });

  it('tops up when a collection has never been walked', async () => {
    render(makeIndex({ lastFullWalkAt: null, complete: false }));
    await waitFor(() => expect(syncs).toHaveLength(1));
  });

  it('tops up at most once per mount', async () => {
    const index = makeIndex({ lastFullWalkAt: null, complete: false });
    const { rerender } = render(index);
    await waitFor(() => expect(syncs).toHaveLength(1));
    rerender({ index });
    rerender({ index });
    expect(syncs).toHaveLength(1);
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
    expect(syncs).toEqual([{ collection: 'groups', force: true }]);
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
