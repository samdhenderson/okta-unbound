/**
 * @module sidepanel/hooks/useGroupComparison
 * @description The Group Detail rung's "compare with another group" state machine.
 *
 * Comparing groups is **not** a new feature — `GroupComparisonModal` and
 * `api.compareGroups` already do the overlap analysis, and the Groups list opens
 * them by ticking two to five rows. A detail page has no rows to tick, so the
 * only thing missing was a way to name the second operand. That is all this hook
 * owns: the picker's open state, its type-ahead, the chosen group, and the
 * member cache the comparison fills as it reads.
 *
 * ## Why the live search rather than `searchGroups`
 *
 * `GroupComparisonModal` reads `memberCount` off every group handed to it — the
 * per-group "unique / shared" split is computed against it. `searchGroups` (the
 * type-ahead behind Add-to-Group) returns `{id, name, description, type}` and no
 * count, so a picker built on it would report the chosen group as `0 members`
 * and its shared count as a negative number. {@link useGroupLiveSearch} issues
 * the `expand=stats` request the Groups tab's live search already uses and maps
 * straight to `GroupSummary`, so the operand arrives complete.
 *
 * ## Two dialogs, one nullable discriminant
 *
 * `comparedWith` is both "which comparison" and "is there one" — the rule
 * `UserDetailPanel` states for its own two dialogs — so the result modal cannot
 * be open against a group nobody picked.
 *
 * The search is gated on the picker being open *and* the tab being visible
 * (ADR-0018): this rung stays mounted, and a standing query must not re-fire
 * from behind a closed dialog.
 */
import { useCallback, useState } from 'react';
import { useGroupLiveSearch } from './useGroupLiveSearch';
import type { GroupSummary, OktaUser } from '../../shared/types';

/** Options for {@link useGroupComparison}. */
export interface UseGroupComparisonOptions {
  /** The group on screen — the first operand, and never a search hit. */
  group: GroupSummary;
  /** Tab whose scheduler runs the group search and the comparison's member reads. */
  targetTabId: number | null;
  /** `false` while the Groups tab is hidden; suspends the type-ahead. */
  enabled?: boolean;
}

/** Return shape of {@link useGroupComparison}. */
export interface UseGroupComparisonReturn {
  /** Whether the second-operand picker is open. */
  isPicking: boolean;
  /** Open the picker on a clean slate. */
  openPicker: () => void;
  /** Dismiss the picker without comparing. */
  closePicker: () => void;

  /** Controlled type-ahead query. */
  query: string;
  /** Called with the new query on each keystroke. */
  setQuery: (value: string) => void;
  /** Hits, with the group being viewed already removed. */
  results: GroupSummary[];
  /** True while a debounced search is in flight. */
  isSearching: boolean;
  /** Message from a failed search, or `null`. */
  searchError: string | null;

  /** The chosen second operand, before confirming. */
  selected: GroupSummary | null;
  /** Choose a hit from the dropdown. */
  select: (hit: GroupSummary) => void;
  /** Clear the chosen group and the query. */
  clearSelected: () => void;
  /** Confirm the pick: closes the picker and opens the comparison. */
  confirm: () => void;

  /** The group being compared against, or `null` when no comparison is open. */
  comparedWith: GroupSummary | null;
  /** Close the comparison. */
  closeComparison: () => void;
  /**
   * Member cache for the comparison. Starts empty; `compareGroups` fills it as
   * it reads and `GroupComparisonModal` reads it back for the pairwise matrix.
   * Created once and mutated in place; its identity never changes, so nothing
   * re-renders off it.
   */
  memberCache: Map<string, OktaUser[]>;
}

/**
 * Owns the Group Detail rung's group-comparison flow: the picker, its
 * type-ahead, and the chosen operand.
 *
 * @param options - See {@link UseGroupComparisonOptions}.
 * @returns The picker state and type-ahead controls, the confirmed operand, and
 *   the member cache to hand `GroupComparisonModal`.
 */
export function useGroupComparison({
  group,
  targetTabId,
  enabled = true,
}: UseGroupComparisonOptions): UseGroupComparisonReturn {
  const [isPicking, setIsPicking] = useState(false);
  const [selected, setSelected] = useState<GroupSummary | null>(null);
  const [comparedWith, setComparedWith] = useState<GroupSummary | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  // A lazy `useState` initializer, not a `useRef`: the Map is created once and
  // mutated in place, and reading a ref during render to return it is exactly
  // what `react-hooks/refs` forbids. Its identity never changes, so nothing
  // re-renders off it.
  const [memberCache] = useState(() => new Map<string, OktaUser[]>());

  const { liveSearchQuery, setLiveSearchQuery, liveSearchResults, isLiveSearching } =
    useGroupLiveSearch({
      targetTabId,
      searchMode: 'live',
      setError: setSearchError,
      enabled: enabled && isPicking,
    });

  const reset = useCallback(() => {
    setSelected(null);
    setSearchError(null);
    setLiveSearchQuery('');
  }, [setLiveSearchQuery]);

  const openPicker = useCallback(() => {
    reset();
    setIsPicking(true);
  }, [reset]);

  const closePicker = useCallback(() => {
    setIsPicking(false);
    reset();
  }, [reset]);

  const select = useCallback(
    (hit: GroupSummary) => {
      setSelected(hit);
      setLiveSearchQuery('');
    },
    [setLiveSearchQuery],
  );

  const clearSelected = useCallback(() => {
    setSelected(null);
    setLiveSearchQuery('');
  }, [setLiveSearchQuery]);

  const confirm = useCallback(() => {
    if (!selected) return;
    setIsPicking(false);
    setComparedWith(selected);
  }, [selected]);

  const closeComparison = useCallback(() => setComparedWith(null), []);

  // A group compared with itself is a tautology, not a result.
  const results = liveSearchResults.filter((hit) => hit.id !== group.id);

  return {
    isPicking,
    openPicker,
    closePicker,
    query: liveSearchQuery,
    setQuery: setLiveSearchQuery,
    results,
    isSearching: isLiveSearching,
    searchError,
    selected,
    select,
    clearSelected,
    confirm,
    comparedWith,
    closeComparison,
    memberCache,
  };
}
