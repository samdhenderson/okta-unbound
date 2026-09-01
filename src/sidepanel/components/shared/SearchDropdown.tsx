/**
 * @module sidepanel/components/shared/SearchDropdown
 * @description Generic search input with a live results dropdown and a selected-item summary state.
 *
 * Fully controlled and presentational — the caller owns query state, async
 * searching, and the results array (typically via a search hook). Generic over
 * the result type `T`; `renderResult` / `renderSelected` project each item to UI.
 *
 * ## The results panel is in flow, deliberately — do not make it `absolute`
 *
 * The panel renders as an ordinary block below the field rather than as an
 * overlay anchored to it. It used to be `absolute z-50`, and every consumer that
 * lives inside a {@link module:sidepanel/components/shared/Modal} was clipped by
 * it: the modal body is `overflow-y-auto`, so an absolutely-positioned child is
 * cut at the scroller's padding box — horizontally too, since `overflow-y: auto`
 * computes `overflow-x` to `auto`, not `visible`. No z-index reaches past that,
 * and the overlay is `isolate` besides. In flow, the modal simply grows to fit
 * the panel (and scrolls its body once the panel hits the panel's own
 * `max-h`), which is the same trade `TabJumpPalette` documents for its result
 * list. Consumers therefore must tolerate the content below the field moving
 * down while results are open; in practice each one shows only the selected-item
 * card there, and that card *replaces* the results.
 */
import React, { useRef } from 'react';
import AlertMessage from './AlertMessage';
import Input from './Input';
import IconButton from './IconButton';
import LoadingSpinner from './LoadingSpinner';
import Icon from '../shared/Icon';

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
  /**
   * Stable React key for a result. Defaults to the array index, which is only
   * safe while the list is append-only — pass this whenever results re-order
   * between keystrokes (i.e. for anything backed by a live type-ahead).
   */
  getKey?: (item: T) => string;
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
  /**
   * Inline error for a failed *search*, rendered as a danger `AlertMessage`
   * between the field and the results. A failed downstream action (an add, a
   * save) is the caller's to render — this slot describes the type-ahead only.
   */
  error?: string | null;
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
  getKey,
  selectedItem,
  renderSelected,
  onClear,
  disabled = false,
  label,
  hint,
  error,
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

      {error && <AlertMessage message={{ text: error, type: 'danger' }} />}

      {/*
        Results, in flow (see the module header). The panel keeps its own bounded
        height and scroller so a 200-hit search cannot outgrow its host; anything
        past that is the host's to scroll.
      */}
      {showDropdown && results.length > 0 && (
        <div className="mt-1 bg-white border border-neutral-200 rounded-md shadow-sm max-h-60 overflow-y-auto scrollable-list">
          {results.map((item, index) => (
            <button
              key={getKey ? getKey(item) : index}
              type="button"
              /* `press press-subtle` (ADR-0046): a wide list row, not a
                 button-weight target, so it takes the subtle press scale. */
              className="press press-subtle w-full px-4 py-3 text-left hover:bg-neutral-50 border-b border-neutral-100 last:border-b-0 transition-colors"
              onClick={() => onSelect(item)}
            >
              {renderResult(item)}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export default SearchDropdown;
