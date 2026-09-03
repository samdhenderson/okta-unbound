/**
 * @module sidepanel/hooks/useExportTab
 * @description Orchestration hook for the descriptor-driven Export tab.
 *
 * Owns the `pick | configure` state machine and every piece of export state the
 * tab's presentational components render: the chosen descriptor, the enabled
 * column set, the search-to-select context, the raw filter text and its debounced
 * live match-count, saved presets / last-used selection, and the fetched preview
 * rows shared by Preview and Download. All Okta reads route through the injected
 * `api` (the rate-limited scheduler path); the hook never calls Okta directly.
 *
 * The hook is 100% generic over the descriptor contract — adding a new
 * {@link module:sidepanel/export/types.EntityExport} needs zero changes here.
 *
 * ## Two ways rows arrive, one place that branches
 *
 * A descriptor either names a list endpoint (the default, and what every
 * endpoint descriptor does) or declares `source: { kind: 'snapshot' }` and joins
 * its rows out of the already-mounted org snapshot (ADR-0065). This hook is the
 * single place that branch lives. The snapshot path **issues nothing**: it reads
 * the handles it is handed, which expose no `sync`, so an export cannot fetch,
 * top up, or mount a listener. It also never probes for a match-count — there is
 * no endpoint to probe and no filter box to hint at.
 *
 * The snapshot path does not get to decide what happens next. Its source returns
 * a `CountResolution` alongside the rows, and an `unavailable` verdict means
 * **there is no export**: {@link UseExportTab.canExport} is false, the tab
 * renders {@link UseExportTab.snapshotNote} instead of a Download control, and
 * the source has already returned zero rows. A verb whose result cannot be
 * trusted is a verb with no wire (ADR-0039).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProgress } from '../contexts/ProgressContext';
import { useExportPresets } from './useExportPresets';
import { buildExportEndpoint } from '../export/endpoint';
import { listDescriptors } from '../export/registry';
import type { EntityExport, ExportColumn, EntityContextOption } from '../export/types';
import type { ExportApiDeps } from '../export/types.deps';
import type { OrgSnapshotView } from '../export/snapshot';
import type { CountResolution, OrgFigureStatus } from '../components/home/orgFigures';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useExportTab');

/** First-page probe result used to drive the filter box match-count. */
export interface ExportMatchCount {
  /** Rows on the first page (0 reveals a filter typo). */
  count: number;
  /** Whether more pages exist beyond the first (true total is larger). */
  hasMore: boolean;
}

/** Result of a paginated export read. */
interface FetchResult<Row> {
  rows: Row[];
  fetched: number;
  dropped: number;
  capped: boolean;
}

/**
 * The subset of the `useOktaApi` facade the Export tab consumes. Declared
 * structurally so the full facade object is assignable without re-deriving its
 * ~40 operation signatures.
 */
export interface ExportTabApi {
  /** Fetch every row for a resolved endpoint, paginating on the `Link` header. */
  fetchExportRows: <Row>(
    descriptor: EntityExport<Row>,
    resolvedEndpoint: string,
    onPage?: (rowsSoFar: number) => void,
  ) => Promise<FetchResult<Row>>;
  /** Probe the first page for the live match-count. */
  countExportRows: <Row>(
    descriptor: EntityExport<Row>,
    resolvedEndpoint: string,
  ) => Promise<ExportMatchCount>;
  /** Project the fetched rows to CSV and download them. */
  runExport: <Row>(args: {
    descriptor: EntityExport<Row>;
    rows: Row[];
    enabledColumnIds: string[];
    contextLabel?: string;
    resolution?: CountResolution;
  }) => Promise<void>;
}

/** Arguments for {@link useExportTab}. */
export interface UseExportTabOptions {
  /** The export operations from `useOktaApi` (scheduler-routed reads + download). */
  api: ExportTabApi;
  /** The descriptor registry built from {@link module:sidepanel/export/registry.buildRegistry}. */
  registry: Record<string, EntityExport>;
  /** Live search functions, used to resolve a search-to-select descriptor's context search. */
  deps: ExportApiDeps;
  /**
   * The mounted org snapshot, for snapshot-sourced descriptors.
   *
   * Read-only and optional: a build with no snapshot mounted simply reports
   * those descriptors as unavailable rather than fetching to repair it — an
   * unread collection is not a reason to fetch, it is a reason to say so
   * (ADR-0065 §3). Memoize it; the join re-runs on a new identity.
   */
  snapshot?: OrgSnapshotView;
  /** Okta org origin used to build per-row deep links in the preview. */
  oktaOrigin?: string;
  /** Whether an Okta tab is connected; export/preview are disabled when false. */
  hasConnectedTab: boolean;
  /** Report a user-facing error (or `null` to clear). Owned by the tab shell. */
  onError: (message: string | null) => void;
  /**
   * Whether the Export tab is the visible one. The tab stays mounted while hidden
   * (so a half-built export survives a trip to another tab), and the live
   * match-count probe re-fires whenever `api` changes identity — i.e. on a new
   * `targetTabId`. Gating it keeps a hidden tab from probing Okta. Defaults to
   * `true`.
   */
  enabled?: boolean;
}

/** The `pick` (entity hub) or `configure` (build the export) phase. */
export type ExportPhase = 'pick' | 'configure';

/** Everything {@link useExportTab} returns for the presentational components. */
export interface UseExportTab {
  /** Current phase of the export flow. */
  phase: ExportPhase;
  /** Ordered descriptors for the entity hub. */
  descriptors: EntityExport[];
  /** The active descriptor, or `null` in the `pick` phase. */
  descriptor: EntityExport | null;
  /** Enter the `configure` phase for the given descriptor id. */
  selectEntity: (id: string) => void;
  /** Return to the entity hub, discarding the in-progress configuration. */
  backToPick: () => void;

  /** Enabled column ids. */
  enabledColumnIds: Set<string>;
  /** Enabled columns, in catalog order (headers + projection order). */
  enabledColumns: ExportColumn<unknown>[];
  /** Number of enabled columns. */
  enabledCount: number;
  /** Toggle one column on/off. */
  toggleColumn: (id: string) => void;

  /** Chosen context entity id (search-to-select), or `null`. */
  contextId: string | null;
  /** Chosen context entity label, folded into the filename. */
  contextLabel: string | null;
  /** Set (or clear) the search-to-select context entity. */
  setContext: (option: EntityContextOption | null) => void;
  /** Search for context entities for the active descriptor. */
  contextSearch: (query: string) => Promise<EntityContextOption[]>;

  /** Raw filter expression from the filter box. */
  filterText: string;
  /** Update the raw filter expression (invalidates any loaded preview). */
  setFilterText: (text: string) => void;
  /** Debounced first-page match-count, or `null` while unknown. */
  matchCount: ExportMatchCount | null;
  /** Whether a match-count probe is in flight. */
  matchCountLoading: boolean;

  /** Saved presets for the active entity, newest first. */
  presets: ReturnType<typeof useExportPresets>['presets'];
  /** Id of the currently applied preset, or `null`. */
  activePresetId: string | null;
  /** Apply a saved preset's column selection + filter. */
  applyPreset: (id: string) => void;
  /** Save the current selection under a name. */
  savePreset: (name: string) => Promise<void>;
  /** Delete a saved preset by id. */
  deletePreset: (id: string) => Promise<void>;

  /** Fetched preview rows (shared by Preview + Download), or `null`. */
  previewRows: unknown[] | null;
  /** Total raw rows the server returned (before validation). */
  fetched: number;
  /** Rows skipped for failing schema validation. */
  dropped: number;
  /** Whether the descriptor's row cap was hit. */
  capped: boolean;
  /** Fetch rows and populate the preview. */
  loadPreview: () => Promise<void>;
  /** Download the CSV, reusing preview rows when present. */
  download: () => Promise<void>;
  /** Whether a fetch/export is in flight (disables the action buttons). */
  isBusy: boolean;

  /** Whether Preview/Download are allowed. */
  canExport: boolean;
  /** Whether an Okta tab is connected. */
  hasConnectedTab: boolean;

  /**
   * For a snapshot-sourced descriptor, whether its answer may be published —
   * `null` for every endpoint descriptor.
   *
   * `'reading'` means wait, `'unavailable'` means there is no export, and
   * `'partial'` means the rows ship with the shortfall stated on each one.
   */
  snapshotStatus: OrgFigureStatus | null;
  /**
   * The sentence explaining {@link UseExportTab.snapshotStatus} — what the
   * number is out of, or which read is missing. `null` when there is nothing to
   * say.
   */
  snapshotNote: string | null;
}

/** Coerce an unknown thrown value into a display message. */
function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Drive the Export tab: the `pick | configure` state machine plus all export
 * configuration and the shared preview rows.
 *
 * @param options - Injected api, registry, deps, origin, connection + error sink.
 * @returns State and actions for the Export tab's presentational components.
 */
export function useExportTab({
  api,
  registry,
  deps,
  snapshot,
  oktaOrigin: _oktaOrigin,
  hasConnectedTab,
  onError,
  enabled = true,
}: UseExportTabOptions): UseExportTab {
  const { startProgress, updateProgress, completeProgress } = useProgress();

  const [phase, setPhase] = useState<ExportPhase>('pick');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enabledColumnIds, setEnabledColumnIds] = useState<Set<string>>(new Set());
  const [contextId, setContextId] = useState<string | null>(null);
  const [contextLabel, setContextLabel] = useState<string | null>(null);
  const [filterText, setFilterTextState] = useState('');
  const [matchCount, setMatchCount] = useState<ExportMatchCount | null>(null);
  const [matchCountLoading, setMatchCountLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<unknown[] | null>(null);
  const [fetched, setFetched] = useState(0);
  const [dropped, setDropped] = useState(0);
  const [capped, setCapped] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const descriptors = useMemo(() => listDescriptors(registry), [registry]);
  const descriptor = selectedId ? (registry[selectedId] ?? null) : null;

  const snapshotSource = descriptor?.source?.kind === 'snapshot' ? descriptor.source : null;

  // The join, run eagerly rather than on Preview: its verdict is what decides
  // whether a Download control may be rendered at all, and that has to be known
  // before the reader presses anything. Pure, synchronous, and zero requests —
  // it reads handles that expose no `sync`.
  const snapshotResult = useMemo(
    () => (snapshotSource && snapshot ? snapshotSource.read(snapshot) : null),
    [snapshotSource, snapshot],
  );

  const validColumnIds = useMemo(
    () => descriptor?.columnCatalog.map((column) => column.id) ?? [],
    [descriptor],
  );
  const { presets, save, remove, loadLastUsed, saveLastUsed, reconcile } = useExportPresets(
    descriptor?.id ?? '',
    validColumnIds,
  );

  const enabledColumns = useMemo(
    () => descriptor?.columnCatalog.filter((column) => enabledColumnIds.has(column.id)) ?? [],
    [descriptor, enabledColumnIds],
  );
  const orderedEnabledIds = useMemo(
    () => enabledColumns.map((column) => column.id),
    [enabledColumns],
  );

  const selectEntity = useCallback(
    (id: string) => {
      const next = registry[id];
      if (!next) return;
      setSelectedId(id);
      setPhase('configure');
      setEnabledColumnIds(
        new Set(next.columnCatalog.filter((column) => column.defaultEnabled).map((c) => c.id)),
      );
      setFilterTextState('');
      setContextId(null);
      setContextLabel(null);
      setPreviewRows(null);
      setFetched(0);
      setDropped(0);
      setCapped(false);
      setActivePresetId(null);
      setMatchCount(null);
      onError(null);
    },
    [registry, onError],
  );

  // Hydrate the last-used selection once per entity, overriding the seeded
  // defaults. Guarded by a ref so user edits are never clobbered mid-session.
  const hydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!descriptor) return;
    if (hydratedRef.current === descriptor.id) return;
    hydratedRef.current = descriptor.id;
    void (async () => {
      const last = await loadLastUsed();
      if (last && last.enabledColumnIds.length > 0) {
        setEnabledColumnIds(new Set(last.enabledColumnIds));
        // The filter is deliberately NOT restored from last-used — a raw filter
        // may carry PII, so it is only persisted in explicit, deletable presets.
        setFilterTextState('');
      }
    })();
  }, [descriptor, loadLastUsed]);

  const backToPick = useCallback(() => {
    setPhase('pick');
    setSelectedId(null);
    hydratedRef.current = null;
    setPreviewRows(null);
    setActivePresetId(null);
    setMatchCount(null);
    onError(null);
  }, [onError]);

  const toggleColumn = useCallback((id: string) => {
    setEnabledColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setActivePresetId(null);
  }, []);

  const setFilterText = useCallback((text: string) => {
    setFilterTextState(text);
    setPreviewRows(null);
    setActivePresetId(null);
  }, []);

  const setContext = useCallback((option: EntityContextOption | null) => {
    setContextId(option?.id ?? null);
    setContextLabel(option?.label ?? null);
    setPreviewRows(null);
  }, []);

  // Choose the deps search matching the descriptor's context. The label is the
  // only data-driven signal, so an "App …" context uses `searchApps` when
  // available; everything else falls back to group search.
  const contextSearch = useCallback(
    (query: string): Promise<EntityContextOption[]> => {
      const context = descriptor?.context;
      if (!context || context.kind !== 'search-to-select') return Promise.resolve([]);
      if (/app/i.test(context.label) && deps.searchApps) return deps.searchApps(query);
      return deps.searchGroups(query);
    },
    [descriptor, deps],
  );

  // Debounced live match-count. Ignores stale responses via a monotonic request
  // id and only probes once an endpoint can actually be built.
  const matchReqRef = useRef(0);
  useEffect(() => {
    // Never probe from a hidden tab: the count is a live hint for a filter box
    // nobody can see, and the effect re-fires on a `targetTabId` change.
    if (!enabled) return;
    // A snapshot-sourced descriptor has no endpoint to probe. Guarded on the
    // source rather than only on `filter.kind`, so a future snapshot descriptor
    // that does offer a filter still cannot reach the wire from here.
    if (snapshotSource) {
      setMatchCount(null);
      return;
    }
    if (!descriptor || descriptor.filter.kind === 'none') {
      setMatchCount(null);
      return;
    }
    if (descriptor.context.kind === 'search-to-select' && !contextId) {
      setMatchCount(null);
      return;
    }
    const reqId = ++matchReqRef.current;
    setMatchCountLoading(true);
    const timer = setTimeout(async () => {
      try {
        const endpoint = buildExportEndpoint(descriptor, {
          contextId: contextId ?? undefined,
          filterText,
        });
        const result = await api.countExportRows(descriptor, endpoint);
        if (matchReqRef.current === reqId) setMatchCount(result);
      } catch {
        // Redacted: the error can echo the admin's raw filter (which may carry
        // PII) back from Okta's error body. Log the entity only — never the error.
        log.warn('Match-count probe failed', { entity: descriptor.id });
        if (matchReqRef.current === reqId) setMatchCount(null);
      } finally {
        if (matchReqRef.current === reqId) setMatchCountLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [enabled, descriptor, snapshotSource, contextId, filterText, api]);

  const applyPreset = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id);
      if (!preset) return;
      setEnabledColumnIds(new Set(reconcile(preset.enabledColumnIds)));
      setFilterTextState(preset.filterText ?? '');
      setPreviewRows(null);
      setActivePresetId(id);
    },
    [presets, reconcile],
  );

  const savePreset = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const preset = await save(trimmed, orderedEnabledIds, filterText || undefined);
      if (preset) setActivePresetId(preset.id);
    },
    [save, orderedEnabledIds, filterText],
  );

  const deletePreset = useCallback(
    async (id: string) => {
      await remove(id);
      setActivePresetId((prev) => (prev === id ? null : prev));
    },
    [remove],
  );

  const fetchRows = useCallback(
    async (target: EntityExport): Promise<unknown[]> => {
      // The snapshot arm. No endpoint is built, no request is issued, and no
      // progress bar is started — there is nothing to wait for. `snapshotResult`
      // is already computed; this only publishes it as the preview.
      if (snapshotResult) {
        setPreviewRows(snapshotResult.rows);
        setFetched(snapshotResult.rows.length + snapshotResult.dropped);
        setDropped(snapshotResult.dropped);
        setCapped(false);
        return snapshotResult.rows;
      }
      const endpoint = buildExportEndpoint(descriptor as EntityExport, {
        contextId: contextId ?? undefined,
        filterText,
      });
      startProgress(`Export: ${target.displayName}`, 'Fetching…', 0, true);
      try {
        const result = await api.fetchExportRows(target, endpoint, (n) => updateProgress(n));
        setPreviewRows(result.rows);
        setFetched(result.fetched);
        setDropped(result.dropped);
        setCapped(result.capped);
        return result.rows;
      } finally {
        completeProgress();
      }
    },
    [
      descriptor,
      snapshotResult,
      contextId,
      filterText,
      api,
      startProgress,
      updateProgress,
      completeProgress,
    ],
  );

  const loadPreview = useCallback(async () => {
    if (!descriptor) return;
    setIsBusy(true);
    onError(null);
    try {
      await fetchRows(descriptor);
    } catch (error) {
      onError(toMessage(error));
    } finally {
      setIsBusy(false);
    }
  }, [descriptor, fetchRows, onError]);

  const download = useCallback(async () => {
    if (!descriptor) return;
    setIsBusy(true);
    onError(null);
    try {
      const rows = previewRows ?? (await fetchRows(descriptor));
      await api.runExport({
        descriptor,
        rows,
        enabledColumnIds: orderedEnabledIds,
        contextLabel: contextLabel ?? undefined,
        // Carried through so the engine can force the completeness column and
        // mark the filename. Undefined for every endpoint descriptor.
        resolution: snapshotResult?.resolution,
      });
      await saveLastUsed(orderedEnabledIds);
    } catch (error) {
      onError(toMessage(error));
    } finally {
      setIsBusy(false);
    }
  }, [
    descriptor,
    previewRows,
    fetchRows,
    api,
    orderedEnabledIds,
    contextLabel,
    saveLastUsed,
    filterText,
    snapshotResult,
    onError,
  ]);

  const contextReady = descriptor?.context.kind !== 'search-to-select' || contextId !== null;
  // A snapshot-sourced descriptor's answer must be publishable before either
  // control is offered. `value === null` covers both `reading` and `unavailable`
  // — nothing to show yet, and nothing that may ever be shown — and it is the
  // resolution's own verdict rather than a second reading of the collections.
  const snapshotReady =
    snapshotSource === null || (snapshotResult?.resolution.value ?? null) !== null;
  const canExport =
    enabledColumns.length > 0 && hasConnectedTab && contextReady && snapshotReady && !isBusy;

  return {
    phase,
    descriptors,
    descriptor,
    selectEntity,
    backToPick,

    enabledColumnIds,
    enabledColumns,
    enabledCount: enabledColumns.length,
    toggleColumn,

    contextId,
    contextLabel,
    setContext,
    contextSearch,

    filterText,
    setFilterText,
    matchCount,
    matchCountLoading,

    presets,
    activePresetId,
    applyPreset,
    savePreset,
    deletePreset,

    previewRows,
    fetched,
    dropped,
    capped,
    loadPreview,
    download,
    isBusy,

    canExport,
    hasConnectedTab,

    snapshotStatus: snapshotSource ? (snapshotResult?.resolution.status ?? 'unavailable') : null,
    snapshotNote: snapshotSource
      ? (snapshotResult?.resolution.note ??
        'The org snapshot has not been read yet, so there is nothing to export.')
      : null,
  };
}
