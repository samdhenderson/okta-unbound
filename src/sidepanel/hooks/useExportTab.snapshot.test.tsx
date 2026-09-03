/**
 * @module sidepanel/hooks/useExportTab.snapshot.test
 * @description Tests for the snapshot row-acquisition arm of the Export tab hook.
 *
 * Pins the branch ADR-0065 puts here and nowhere else: a snapshot-sourced
 * descriptor is resolved from the mounted collections, issues nothing, and does
 * not get to publish an answer its collections cannot support. `canExport`
 * false is what removes the Download control from the tab — a verb whose result
 * cannot be trusted is a verb with no wire (ADR-0039).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExportTab, type ExportTabApi } from './useExportTab';
import { ProgressProvider } from '../contexts/ProgressContext';
import { groupCleanupReportDescriptor } from '../export/descriptors/orgReports';
import { rulesDescriptor } from '../export/descriptors/groupRules';
import type { OrgSnapshotView, SnapshotCollection } from '../export/snapshot';
import type { EntityExport } from '../export/types';

const WALK_AT = Date.parse('2026-08-20T00:00:00.000Z');

function collection(
  rows: unknown[],
  overrides: Partial<SnapshotCollection> = {},
): SnapshotCollection {
  return {
    rows,
    records: [],
    isReading: false,
    complete: true,
    lastFullWalkAt: WALK_AT,
    error: null,
    ...overrides,
  };
}

function snapshot(overrides: Partial<OrgSnapshotView> = {}): OrgSnapshotView {
  return {
    groups: collection([
      { id: '00gFAKE1', profile: { name: 'Orphan' }, _embedded: { stats: { usersCount: 0 } } },
    ]),
    rules: collection([]),
    apps: collection([]),
    appGroups: collection([]),
    ...overrides,
  };
}

const registry: Record<string, EntityExport> = {
  [groupCleanupReportDescriptor.id]: groupCleanupReportDescriptor as EntityExport,
  [rulesDescriptor.id]: rulesDescriptor as EntityExport,
};

function makeApi(): ExportTabApi {
  return {
    fetchExportRows: vi.fn().mockResolvedValue({ rows: [], fetched: 0, dropped: 0, capped: false }),
    countExportRows: vi.fn().mockResolvedValue({ count: 0, hasMore: false }),
    runExport: vi.fn().mockResolvedValue(undefined),
  };
}

function render(api: ExportTabApi, view: OrgSnapshotView | undefined) {
  return renderHook(
    () =>
      useExportTab({
        api,
        registry,
        deps: { searchGroups: vi.fn() },
        snapshot: view,
        hasConnectedTab: true,
        onError: vi.fn(),
      }),
    {
      wrapper: ({ children }) => <ProgressProvider>{children}</ProgressProvider>,
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('a snapshot-sourced descriptor', () => {
  it('resolves rows without touching the transport', async () => {
    const api = makeApi();
    const { result } = render(api, snapshot());

    act(() => result.current.selectEntity('report-group-cleanup'));
    await act(async () => {
      await result.current.loadPreview();
    });

    expect(result.current.previewRows).toHaveLength(1);
    expect(result.current.canExport).toBe(true);
    // Zero requests: neither the walk nor the match-count probe was reached.
    expect(api.fetchExportRows).not.toHaveBeenCalled();
    expect(api.countExportRows).not.toHaveBeenCalled();
  });

  it('never probes for a match count, even after the debounce window', async () => {
    const api = makeApi();
    const { result } = render(api, snapshot());

    act(() => result.current.selectEntity('report-group-cleanup'));
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(api.countExportRows).not.toHaveBeenCalled();
    expect(result.current.matchCount).toBeNull();
  });

  it('offers no export at all when a gate collection was never read', () => {
    const api = makeApi();
    const { result } = render(
      api,
      // The rule list gates this report; unread, it cannot be published.
      snapshot({ rules: collection([], { lastFullWalkAt: null }) }),
    );

    act(() => result.current.selectEntity('report-group-cleanup'));

    expect(result.current.snapshotStatus).toBe('unavailable');
    // The tab renders this sentence in place of the Download control.
    expect(result.current.snapshotNote).toContain('group rules');
    expect(result.current.canExport).toBe(false);
  });

  it('reports no export when no snapshot is mounted, rather than fetching to repair it', () => {
    const api = makeApi();
    const { result } = render(api, undefined);

    act(() => result.current.selectEntity('report-group-cleanup'));

    expect(result.current.canExport).toBe(false);
    expect(api.fetchExportRows).not.toHaveBeenCalled();
  });

  it('hands the resolution to runExport so the engine can honour it', async () => {
    const api = makeApi();
    const { result } = render(
      api,
      snapshot({
        groups: collection([
          { id: '00gFAKE1', profile: { name: 'Orphan' }, _embedded: { stats: { usersCount: 0 } } },
        ]),
      }),
    );

    act(() => result.current.selectEntity('report-group-cleanup'));
    await act(async () => {
      await result.current.download();
    });

    await waitFor(() => expect(api.runExport).toHaveBeenCalledTimes(1));
    const args = vi.mocked(api.runExport).mock.calls[0][0];
    expect(args.resolution?.status).toBe('ok');
  });
});

describe('an endpoint descriptor is untouched by the widening', () => {
  it('still walks the endpoint and carries no resolution', async () => {
    const api = makeApi();
    const { result } = render(api, snapshot());

    act(() => result.current.selectEntity('group-rules'));
    await act(async () => {
      await result.current.download();
    });

    expect(api.fetchExportRows).toHaveBeenCalledTimes(1);
    expect(result.current.snapshotStatus).toBeNull();
    const args = vi.mocked(api.runExport).mock.calls[0][0];
    expect(args.resolution).toBeUndefined();
  });
});
