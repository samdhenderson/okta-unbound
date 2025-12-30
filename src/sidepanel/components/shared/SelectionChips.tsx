interface SelectionChipsProps<T> {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onRemove: (item: T) => void;
  onClearAll?: () => void;
  emptyMessage?: string;
  className?: string;
}

/**
 * Displays a list of selected items as removable chips/tags.
 * Used for multi-select interfaces.
 *
 * @example
 * ```tsx
 * <SelectionChips
 *   items={selectedGroups}
 *   getKey={(g) => g.id}
 *   getLabel={(g) => g.name}
 *   onRemove={(g) => removeGroup(g.id)}
 *   onClearAll={() => clearAllGroups()}
 *   emptyMessage="No groups selected"
 * />
 * ```
 */
function SelectionChips<T>({
  items,
  getKey,
  getLabel,
  onRemove,
  onClearAll,
  emptyMessage = 'No items selected',
  className = '',
}: SelectionChipsProps<T>) {
  if (items.length === 0) {
    return (
      <div className={`text-sm text-gray-500 italic py-2 ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={getKey(item)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#007dc1]/10 text-[#007dc1] rounded-full text-sm font-medium border border-[#007dc1]/20"
          >
            <span className="max-w-[200px] truncate">{getLabel(item)}</span>
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="p-0.5 hover:bg-[#007dc1]/20 rounded-full transition-colors"
              title={`Remove ${getLabel(item)}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {onClearAll && items.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

export default SelectionChips;
