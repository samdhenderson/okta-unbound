import React, { useRef } from 'react';

interface SearchDropdownProps<T> {
  placeholder?: string;
  query: string;
  onQueryChange: (q: string) => void;
  isSearching: boolean;
  results: T[];
  showDropdown: boolean;
  onSelect: (item: T) => void;
  renderResult: (item: T) => React.ReactNode;
  selectedItem?: T | null;
  renderSelected?: (item: T) => React.ReactNode;
  onClear?: () => void;
  disabled?: boolean;
  label?: string;
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
 *       <div className="text-sm text-gray-500">{user.email}</div>
 *     </div>
 *   )}
 *   renderSelected={(user) => (
 *     <div className="flex items-center gap-2">
 *       <span>{user.firstName} {user.lastName}</span>
 *       <span className="text-gray-500">{user.email}</span>
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
        {label && (
          <label className="block text-sm font-medium text-gray-700">{label}</label>
        )}
        <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex-1 min-w-0">{renderSelected(selectedItem)}</div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-200"
              title="Clear selection"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="relative">
        {/* Search icon */}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder={placeholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          disabled={disabled}
        />

        {/* Loading spinner */}
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="w-4 h-4 border-2 border-gray-200 border-t-[#007dc1] rounded-full animate-spin" />
          </div>
        )}

        {/* Clear button when there's text */}
        {!isSearching && query && onClear && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            onClick={onClear}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Dropdown results */}
        {showDropdown && results.length > 0 && (
          <div
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
          >
            {results.map((item, index) => (
              <button
                key={index}
                type="button"
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                onClick={() => onSelect(item)}
              >
                {renderResult(item)}
              </button>
            ))}
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default SearchDropdown;
