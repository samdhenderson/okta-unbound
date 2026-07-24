/**
 * @module sidepanel/hooks/useSearchWithDropdown
 * @description Generic debounced type-ahead-with-dropdown state machine.
 *
 * Reusable across any entity: owns the query, debounced async results, dropdown
 * visibility and the selected item. Search pauses while an item is selected,
 * while `disabled`, or while the query is shorter than `minQueryLength`.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useSearchWithDropdown');

/** Options for {@link useSearchWithDropdown}. */
interface UseSearchWithDropdownOptions<T> {
  /** Async fetcher run (debounced) for the current query. */
  searchFn: (query: string) => Promise<T[]>;
  /** Debounce delay before searching. Defaults to 300ms. */
  debounceMs?: number;
  /** Minimum query length before searching. Defaults to 2. */
  minQueryLength?: number;
  /** Called when an item is chosen via `selectItem`. */
  onSelect?: (item: T) => void;
  /** Post-process results, e.g. to exclude already-selected items. */
  filterFn?: (results: T[]) => T[];
  /** When true, searching is suppressed entirely. */
  disabled?: boolean;
  /**
   * Seed the initially-selected item (e.g. a deep-linked pre-scoped context).
   * Only the initial value is read; later changes don't re-seed. Search stays
   * paused until it is cleared, exactly as if the user had picked it.
   */
  initialSelected?: T | null;
}

/** Return shape of {@link useSearchWithDropdown}. */
interface UseSearchWithDropdownReturn<T> {
  query: string;
  setQuery: (q: string) => void;
  results: T[];
  isSearching: boolean;
  showDropdown: boolean;
  setShowDropdown: (show: boolean) => void;
  /** Choose an item: sets it, hides the dropdown, clears results, fires `onSelect`. */
  selectItem: (item: T) => void;
  /** Reset query, results, dropdown and selection back to empty. */
  clearSearch: () => void;
  selectedItem: T | null;
  setSelectedItem: (item: T | null) => void;
}

/**
 * Hook for managing search with dropdown functionality.
 * Handles debounced search, dropdown visibility, and selection.
 *
 * @typeParam T - The result/item type returned by `searchFn`.
 * @param options - See `UseSearchWithDropdownOptions`.
 * @returns Query state, debounced `results`, `isSearching` /`showDropdown` flags,
 *   and `selectItem` / `clearSearch` / `setSelectedItem` controls.
 *
 * @example
 * ```tsx
 * const userSearch = useSearchWithDropdown({
 *   searchFn: async (q) => oktaApi.searchUsers(q),
 *   debounceMs: 300,
 *   minQueryLength: 2,
 *   onSelect: (user) => console.log('Selected:', user),
 * });
 *
 * return (
 *   <SearchDropdown
 *     query={userSearch.query}
 *     onQueryChange={userSearch.setQuery}
 *     results={userSearch.results}
 *     isSearching={userSearch.isSearching}
 *     showDropdown={userSearch.showDropdown}
 *     onSelect={userSearch.selectItem}
 *     selectedItem={userSearch.selectedItem}
 *     onClear={userSearch.clearSearch}
 *   />
 * );
 * ```
 */
export function useSearchWithDropdown<T>({
  searchFn,
  debounceMs = 300,
  minQueryLength = 2,
  onSelect,
  filterFn,
  disabled = false,
  initialSelected = null,
}: UseSearchWithDropdownOptions<T>): UseSearchWithDropdownReturn<T> {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState<T | null>(initialSelected);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Debounced search effect
  useEffect(() => {
    // Don't search if disabled, query too short, or item already selected
    if (disabled || query.length < minQueryLength || selectedItem) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        let searchResults = await searchFn(query);

        // Apply filter function if provided (e.g., to exclude already-selected items)
        if (filterFn) {
          searchResults = filterFn(searchResults);
        }

        if (isMounted.current) {
          setResults(searchResults);
          setShowDropdown(searchResults.length > 0);
        }
      } catch (error) {
        log.error('Search error:', error);
        if (isMounted.current) {
          setResults([]);
          setShowDropdown(false);
        }
      } finally {
        if (isMounted.current) {
          setIsSearching(false);
        }
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs, minQueryLength, searchFn, filterFn, disabled, selectedItem]);

  const selectItem = useCallback(
    (item: T) => {
      setSelectedItem(item);
      setShowDropdown(false);
      setResults([]);
      onSelect?.(item);
    },
    [onSelect],
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    setSelectedItem(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    showDropdown,
    setShowDropdown,
    selectItem,
    clearSearch,
    selectedItem,
    setSelectedItem,
  };
}

export default useSearchWithDropdown;
