import { useState, useCallback, useMemo } from 'react';
import { useSearchWithDropdown } from './useSearchWithDropdown';

interface UseBulkSelectionOptions<T> {
  searchFn: (query: string) => Promise<T[]>;
  getItemId: (item: T) => string;
  debounceMs?: number;
  minQueryLength?: number;
}

interface UseBulkSelectionReturn<T> {
  selectedItems: T[];
  addItem: (item: T) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  hasItem: (id: string) => boolean;
  // Search state
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: T[];
  isSearching: boolean;
  showDropdown: boolean;
  setShowDropdown: (show: boolean) => void;
}

/**
 * Hook for managing multi-select with search functionality.
 * Combines useSearchWithDropdown with a selected items list.
 *
 * @example
 * ```tsx
 * const groupSelection = useBulkSelection({
 *   searchFn: async (q) => oktaApi.searchGroups(q),
 *   getItemId: (group) => group.id,
 * });
 *
 * return (
 *   <>
 *     <SearchDropdown
 *       query={groupSelection.searchQuery}
 *       onQueryChange={groupSelection.setSearchQuery}
 *       results={groupSelection.searchResults}
 *       isSearching={groupSelection.isSearching}
 *       showDropdown={groupSelection.showDropdown}
 *       onSelect={groupSelection.addItem}
 *     />
 *     <SelectionChips
 *       items={groupSelection.selectedItems}
 *       getKey={(g) => g.id}
 *       getLabel={(g) => g.name}
 *       onRemove={(g) => groupSelection.removeItem(g.id)}
 *       onClearAll={groupSelection.clearAll}
 *     />
 *   </>
 * );
 * ```
 */
export function useBulkSelection<T>({
  searchFn,
  getItemId,
  debounceMs = 300,
  minQueryLength = 2,
}: UseBulkSelectionOptions<T>): UseBulkSelectionReturn<T> {
  const [selectedItems, setSelectedItems] = useState<T[]>([]);

  // Create a set of selected IDs for fast lookup
  const selectedIds = useMemo(
    () => new Set(selectedItems.map(getItemId)),
    [selectedItems, getItemId]
  );

  // Filter function to exclude already-selected items from results
  const filterFn = useCallback(
    (results: T[]) => results.filter((item) => !selectedIds.has(getItemId(item))),
    [selectedIds, getItemId]
  );

  // Use the search hook with our filter
  const search = useSearchWithDropdown<T>({
    searchFn,
    debounceMs,
    minQueryLength,
    filterFn,
    onSelect: (item) => {
      // When an item is selected via the search dropdown, add it to our list
      setSelectedItems((prev) => [...prev, item]);
    },
  });

  const addItem = useCallback(
    (item: T) => {
      const itemId = getItemId(item);
      if (!selectedIds.has(itemId)) {
        setSelectedItems((prev) => [...prev, item]);
      }
      // Clear the search after adding
      search.clearSearch();
    },
    [getItemId, selectedIds, search]
  );

  const removeItem = useCallback(
    (id: string) => {
      setSelectedItems((prev) => prev.filter((item) => getItemId(item) !== id));
    },
    [getItemId]
  );

  const clearAll = useCallback(() => {
    setSelectedItems([]);
  }, []);

  const hasItem = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  return {
    selectedItems,
    addItem,
    removeItem,
    clearAll,
    hasItem,
    // Expose search state
    searchQuery: search.query,
    setSearchQuery: search.setQuery,
    searchResults: search.results,
    isSearching: search.isSearching,
    showDropdown: search.showDropdown,
    setShowDropdown: search.setShowDropdown,
  };
}

export default useBulkSelection;
