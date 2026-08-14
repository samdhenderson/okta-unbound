/**
 * @module sidepanel/components/shared/SearchDropdown
 * @description Generic search input with a live results dropdown and a selected-item summary state.
 *
 * Fully controlled and presentational — the caller owns query state, async
 * searching, and the results array (typically via a search hook). Generic over
 * the result type `T`; `renderResult` / `renderSelected` project each item to UI.
 */
import React, { useRef } from 'react';
import Input from './Input';
import IconButton from './IconButton';
import LoadingSpinner from './LoadingSpinner';
import Icon from '../overview/shared/Icon';

interface SearchDropdownProps<T> {
  placeholder?: string;
  /** Controlled query text. */
  query: string;
  /** Called with the new query on each keystroke. */
  onQueryChange: (q: string) => void;
  /** When true, shows a spinner in the field (search in flight). */
  isSearching: boolean;
  /** Result items to render in the dropdown. */
  results: T[];
  /** Whether the results dropdown is visible (also requires non-empty `results`). */
  showDropdown: boolean;
  /** Called when a result is clicked. */
  onSelect: (item: T) => void;
  /** Renders a single result row. */
  renderResult: (item: T) => React.ReactNode;
  /** Currently selected item; when set (with `renderSelected`) the picker shows its summary state instead of the input. */
  selectedItem?: T | null;
  /** Renders the selected item's summary; required to show the selected state. */
  renderSelected?: (item: T) => React.ReactNode;
  /** Clears the query or selection; renders the clear affordance when provided. */
  onClear?: () => void;
  disabled?: boolean;
  /** Optional field label. */
  label?: string;
  /** Optional helper text below the field. */
  hint?: string;
}

/**
 * Reusable search input with dropdown results.
 * Handles the UI for searching and selecting items.
 *
 * @example
 * ```tsx
 * <SearchDropdown
 *   label="Source User"
 *   placeholder="Search by name or email..."
 *   query={userSearch.query}
 *   onQueryChange={userSearch.setQuery}
 *   isSearching={userSearch.isSearching}
 *   results={userSearch.results}
 *   showDropdown={userSearch.showDropdown}
 *   onSelect={userSearch.selectItem}
 *   selectedItem={userSearch.selectedItem}
 *   onClear={userSearch.clearSearch}
 *   renderResult={(user) => (
 *     <div>
 *       <div className="font-medium">{user.firstName} {user.lastName}</div>
 *       <div className="text-sm text-neutral-500">{user.email}</div>
 *     </div>
 *   )}
 *   renderSelected={(user) => (
 *     <div className="flex items-center gap-2">
 *       <span>{user.firstName} {user.lastName}</span>
 *       <span className="text-neutral-500">{user.email}</span>
 *     </div>
 *   )}
 * />
 * ```
 */
function SearchDropdown<T>({
  placeholder = 'Search...',
  query,
  onQueryChange,
  isSearching,
  results,
  showDropdown,
  onSelect,
  renderResult,
  selectedItem,
  renderSelected,
  onClear,
  disabled = false,
  label,
  hint,
}: SearchDropdownProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);

  // If an item is selected, show the selected state
  if (selectedItem && renderSelected) {
    return (
      <div className="space-y-1">
        {label && <label className="block text-sm font-medium text-neutral-700">{label}</label>}
        <div className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded-md">
          <div className="flex-1 min-w-0">{renderSelected(selectedItem)}</div>
          {onClear && (
            <IconButton
              label="Clear selection"
              onClick={onClear}
              variant="ghost"
              size="sm"
              className="ml-2 rounded-full hover:bg-neutral-200"
            >
              <Icon type="close" size="md" />
            </IconButton>
          )}
        </div>
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-neutral-700">{label}</label>}
      <div className="relative">
        {/*
         * `size="md"` is a deliberate tie-break: the pre-migration field was
         * `py-2.5` (10px), exactly 2px from both `md` (`py-2`, 8px) and `lg`
         * (`py-3`, 12px). `md` wins because its `pl-10` leading reservation is an
         * exact match for the original `pl-10`, whereas `lg`'s `pl-11` is not.
         * The trailing slot below carries the spinner/clear button so the field's
         * right padding is reserved again (`pr-11` vs. the original `pr-10` — one
         * step wider, since `size="md"`'s scale is shared with a leading glyph
         * that doesn't have this field's alternate `sm` bucket to itself).
         */}
        <Input
          inputRef={inputRef}
          type="text"
          value={query}
          onChange={onQueryChange}
          placeholder={placeholder}
          disabled={disabled}
          size="md"
          icon={<Icon type="search" size="md" className="text-neutral-400" />}
          trailing={
            <>
              {isSearching && <LoadingSpinner size="sm" />}
              {!isSearching && query && onClear && (
                <IconButton label="Clear search" onClick={onClear} variant="ghost" size="sm">
                  <Icon type="close" size="md" />
                </IconButton>
              )}
            </>
          }
          trailingInteractive={!isSearching && !!query && !!onClear}
        />

        {/* Dropdown results */}
        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-60 divide-y divide-neutral-100 overflow-auto">
            {results.map((item, index) => (
              <button
                key={index}
                type="button"
                className="w-full px-3 py-2 text-left transition-colors duration-(--dur-instant) hover:bg-neutral-50"
                onClick={() => onSelect(item)}
              >
                {renderResult(item)}
              </button>
            ))}
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export default SearchDropdown;
