import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSearchWithDropdownOptions<T> {
  searchFn: (query: string) => Promise<T[]>;
  debounceMs?: number;
  minQueryLength?: number;
  onSelect?: (item: T) => void;
  filterFn?: (results: T[]) => T[];
  disabled?: boolean;
}

interface UseSearchWithDropdownReturn<T> {
  query: string;
  setQuery: (q: string) => void;
  results: T[];
  isSearching: boolean;
  showDropdown: boolean;
  setShowDropdown: (show: boolean) => void;
  selectItem: (item: T) => void;
  clearSearch: () => void;
  selectedItem: T | null;
  setSelectedItem: (item: T | null) => void;
}

/**
 * Hook for managing search with dropdown functionality.
 * Handles debounced search, dropdown visibility, and selection.
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
}: UseSearchWithDropdownOptions<T>): UseSearchWithDropdownReturn<T> {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);

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
        console.error('[useSearchWithDropdown] Search error:', error);
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
    [onSelect]
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
