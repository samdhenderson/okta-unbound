/**
 * @module sidepanel/components/shared/SortPill
 * @description A sort-toggle pill: a {@link FilterPill} that shows a directional
 * caret when its field is the active sort, rotating it for descending order.
 *
 * Filter panels reuse this instead of hand-rolling a raw `<button>` + inline caret
 * per sort field. Generic over the caller's sort-field union so it stays type-safe.
 */
import FilterPill from './FilterPill';

/** Props for {@link SortPill}. */
interface SortPillProps<T extends string> {
  /** The sort field this pill selects. */
  field: T;
  /** Human-readable label shown on the pill. */
  label: string;
  /** The currently active sort field (the pill fills when it matches `field`). */
  activeField: T;
  /** Whether the active sort is descending — rotates the caret 180°. */
  descending: boolean;
  /** Toggle this field as the sort (or flip direction if already active). */
  onToggle: (field: T) => void;
}

/**
 * A sort-field toggle rendered as a {@link FilterPill}. When its `field` is the
 * `activeField`, the pill is filled and shows a caret that points up (ascending)
 * or down (descending).
 *
 * @example
 * ```tsx
 * <SortPill field="name" label="Name" activeField={sortBy} descending={sortDesc} onToggle={toggleSort} />
 * ```
 */
function SortPill<T extends string>({
  field,
  label,
  activeField,
  descending,
  onToggle,
}: SortPillProps<T>) {
  const active = activeField === field;
  return (
    <FilterPill active={active} onClick={() => onToggle(field)}>
      <span className="flex items-center gap-1">
        {label}
        {active && (
          <svg
            className={`w-3 h-3 transition-transform ${descending ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        )}
      </span>
    </FilterPill>
  );
}

export default SortPill;
