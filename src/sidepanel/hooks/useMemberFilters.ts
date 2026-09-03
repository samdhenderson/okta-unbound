/**
 * @module sidepanel/hooks/useMemberFilters
 * @description The member explorer's facet-filter set, and every way it changes.
 *
 * Lifted verbatim out of `components/members/MemberExplorer`, where the whole
 * grammar lived as one `useState<MemberFilter[]>` plus eight `useCallback`
 * mutators inlined between the render tree and the memoised derivations. The
 * filter set is the one piece of that component's state more than one surface
 * has a reason to touch, and the only piece a *neighbouring* pane (Insights)
 * needs a way into, so it is the piece that becomes a hook.
 *
 * ## The grammar, stated once
 *
 * A {@link MemberFilter} is a `(dimension, value, label)` triple, and the set is
 * flat — `filterMembers` reads OR within a dimension and AND across dimensions
 * (per-factor MFA constraints excepted; see `memberAnalytics`). Every mutator
 * here is a projection of one rule onto that flat set:
 *
 * - **toggle** — the default. Selecting a value already present removes it, so a
 *   pill is its own off switch.
 * - **clear one dimension** — the "All" pill on the status and source rows.
 * - **set a factor mode** — the only three-state control: `off | has | missing`
 *   for one factor label, where `has:` and `missing:` are mutually exclusive
 *   values of the same dimension, so setting one drops the other rather than
 *   accumulating a contradiction.
 *
 * ## No derivation lives here
 *
 * The hook owns the *set* and nothing downstream of it. Filtering, sorting and
 * the breakdowns stay in the pure `memberAnalytics` helpers where they are
 * testable without React, and the explorer still calls them. What the hook adds
 * on top of raw state is the two read-side projections every consumer was
 * recomputing by hand — {@link MemberFiltersApi.valuesFor} and
 * {@link MemberFiltersApi.key}.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  type BreakdownRow,
  type Dimension,
  type MemberFilter,
  SOURCE_DIMENSION,
  dimensionTitle,
} from '../components/members/memberAnalytics';

/**
 * Per-factor filter intent: unset, require-present, or require-absent.
 *
 * The one facet control with three states rather than two. It lives here
 * because the hook is what turns a mode into the `has:`/`missing:` filter
 * values the analytics layer evaluates.
 */
export type FactorMode = 'off' | 'has' | 'missing';

/** The filter set plus every mutation the explorer's controls perform on it. */
export interface MemberFiltersApi {
  /** The active facet filters, in the order they were applied. */
  filters: MemberFilter[];
  /** How many filters are applied — the count the Filters control badges. */
  activeCount: number;
  /**
   * Canonical values active for one dimension, for reflecting pressed states.
   * Memoised per call site by {@link MemberFiltersApi.filters}' identity.
   */
  valuesFor: (dimension: Dimension | null) => Set<string>;
  /** The active membership-source bucket keys. */
  sourceKeys: Set<string>;
  /**
   * A stable string identifying the current filter set — order-sensitive and
   * cheap to compare. The explorer folds it into the key that resets its paging
   * window during render.
   */
  key: string;
  /** Add a value to the set, or remove it if it is already there. */
  toggle: (dimension: Dimension, value: string, label: string) => void;
  /** Toggle a breakdown row, labelling the chip `<Dimension>: <value>`. */
  toggleRow: (dimension: Dimension, row: BreakdownRow) => void;
  /** Toggle a status value (`Status: <value>`). */
  toggleStatus: (row: BreakdownRow) => void;
  /** Drop every status filter — the status row's "All" pill. */
  clearStatus: () => void;
  /** Toggle a count-based MFA value (`none`, `multiple`), with its own label. */
  toggleMfaValue: (value: string, label: string) => void;
  /** Set one factor label's has/missing/off mode, replacing the other two. */
  setFactorMode: (label: string, mode: FactorMode) => void;
  /** Toggle one membership-source bucket (`Source: <label>`). */
  toggleSource: (key: string, label: string) => void;
  /** Drop every membership-source filter — the source row's "All" pill. */
  clearSource: () => void;
  /** Remove one filter, by identity — what a chip's remove control calls. */
  remove: (filter: MemberFilter) => void;
  /** Drop every filter in every dimension. */
  clearAll: () => void;
}

/**
 * Owns the member explorer's facet-filter set.
 *
 * @returns The set and its mutators — see {@link MemberFiltersApi}.
 *
 * @example
 * ```tsx
 * const memberFilters = useMemberFilters();
 * const shown = filterMembers(members, query, memberFilters.filters, mfaResults);
 * ```
 */
export function useMemberFilters(): MemberFiltersApi {
  const [filters, setFilters] = useState<MemberFilter[]>([]);

  const toggle = useCallback((dimension: Dimension, value: string, label: string) => {
    setFilters((prev) => {
      const existing = prev.find((f) => f.dimension === dimension && f.value === value);
      if (existing) return prev.filter((f) => f !== existing);
      return [...prev, { dimension, value, label }];
    });
  }, []);

  const toggleRow = useCallback(
    (dimension: Dimension, row: BreakdownRow) => {
      toggle(dimension, row.value, `${dimensionTitle(dimension)}: ${row.label}`);
    },
    [toggle],
  );

  const toggleStatus = useCallback(
    (row: BreakdownRow) => toggle('status', row.value, `Status: ${row.label}`),
    [toggle],
  );

  const clearStatus = useCallback(
    () => setFilters((prev) => prev.filter((f) => f.dimension !== 'status')),
    [],
  );

  const toggleMfaValue = useCallback(
    (value: string, label: string) => toggle('mfa', value, label),
    [toggle],
  );

  const setFactorMode = useCallback((label: string, mode: FactorMode) => {
    setFilters((prev) => {
      const without = prev.filter(
        (f) =>
          !(
            f.dimension === 'mfa' &&
            (f.value === `has:${label}` || f.value === `missing:${label}`)
          ),
      );
      if (mode === 'off') return without;
      const value = mode === 'has' ? `has:${label}` : `missing:${label}`;
      const chip = `${mode === 'has' ? 'Has' : 'Missing'} ${label}`;
      return [...without, { dimension: 'mfa', value, label: chip }];
    });
  }, []);

  const toggleSource = useCallback(
    (key: string, label: string) => toggle(SOURCE_DIMENSION, key, `Source: ${label}`),
    [toggle],
  );

  const clearSource = useCallback(
    () => setFilters((prev) => prev.filter((f) => f.dimension !== SOURCE_DIMENSION)),
    [],
  );

  const remove = useCallback(
    (filter: MemberFilter) => setFilters((prev) => prev.filter((f) => f !== filter)),
    [],
  );

  const clearAll = useCallback(() => setFilters([]), []);

  const valuesFor = useCallback(
    (dimension: Dimension | null) =>
      new Set(filters.filter((f) => f.dimension === dimension).map((f) => f.value)),
    [filters],
  );

  const sourceKeys = useMemo(
    () => new Set(filters.filter((f) => f.dimension === SOURCE_DIMENSION).map((f) => f.value)),
    [filters],
  );

  const key = useMemo(() => filters.map((f) => `${f.dimension}:${f.value}`).join('|'), [filters]);

  return {
    filters,
    activeCount: filters.length,
    valuesFor,
    sourceKeys,
    key,
    toggle,
    toggleRow,
    toggleStatus,
    clearStatus,
    toggleMfaValue,
    setFactorMode,
    toggleSource,
    clearSource,
    remove,
    clearAll,
  };
}
