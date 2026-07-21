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
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProgress } from '../contexts/ProgressContext';
import { useExportPresets } from './useExportPresets';
import { buildExportEndpoint } from '../export/endpoint';
import { listDescriptors } from '../export/registry';
import type { EntityExport, ExportColumn, EntityContextOption } from '../export/types';
import type { ExportApiDeps } from '../export/types.deps';
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
  /** Okta org origin used to build per-row deep links in the preview. */
  oktaOrigin?: string;
  /** Whether an Okta tab is connected; export/preview are disabled when false. */
  hasConnectedTab: boolean;
  /** Report a user-facing error (or `null` to clear). Owned by the tab shell. */
  onError: (message: string | null) => void;
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
  oktaOrigin: _oktaOrigin,
  hasConnectedTab,
  onError,
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
  const [dropped, setDropped] = useState(0);
  const [capped, setCapped] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const descriptors = useMemo(() => listDescriptors(registry), [registry]);
  const descriptor = selectedId ? (registry[selectedId] ?? null) : null;

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
  }, [descriptor, contextId, filterText, api]);

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
      const endpoint = buildExportEndpoint(descriptor as EntityExport, {
        contextId: contextId ?? undefined,
        filterText,
      });
      startProgress(`Export: ${target.displayName}`, 'Fetching…', 0, true);
      try {
        const result = await api.fetchExportRows(target, endpoint, (n) => updateProgress(n));
        setPreviewRows(result.rows);
        setDropped(result.dropped);
        setCapped(result.capped);
        return result.rows;
      } finally {
        completeProgress();
      }
    },
    [descriptor, contextId, filterText, api, startProgress, updateProgress, completeProgress],
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
    onError,
  ]);

  const contextReady = descriptor?.context.kind !== 'search-to-select' || contextId !== null;
  const canExport = enabledColumns.length > 0 && hasConnectedTab && contextReady && !isBusy;

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
    dropped,
    capped,
    loadPreview,
    download,
    isBusy,

    canExport,
    hasConnectedTab,
  };
}
