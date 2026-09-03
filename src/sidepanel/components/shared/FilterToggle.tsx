/**
 * @module sidepanel/components/shared/FilterToggle
 * @description The "Filters" toggle button with its active-filter count badge — the
 * control that sits beside a search field and discloses the filter panel below it.
 *
 * It arrives here as the survivor of two hand-copied implementations,
 * `groups/GroupFilterToggle` and `members/MemberFilterToggle`, whose own docblocks
 * each pointed at the other as "the same shape". They differed in exactly two ways:
 * the vertical padding, because one sits beside an `Input size="lg"` and the other
 * beside a smaller field, and a `gap-2` that ADR-0048 had already replaced with
 * `--sp-inline` on one side and not the other. The Rules rung wanted a third copy,
 * which is where copying stops being cheaper than promoting.
 *
 * **Still a raw `<button>`.** That is the documented `docs/components.md` §3
 * exception, and relocating the file does not change the reason for it: the
 * primary-light active wash does not map onto any shared `Button` variant, and a
 * `Button` cannot carry the `aria-pressed` toggle semantics this control needs.
 * What did change is the glyph — the funnel was an inlined `<svg>` in both copies
 * because it was not in the registry, so it has been added there (`Icon type="filter"`)
 * rather than pasted a third time.
 *
 * **The count is a fact, not decoration.** It renders only above zero, because a
 * `0` badge and an absent badge say the same thing and only one of them is quiet
 * (ADR-0032 §2a's rule of thumb, applied to a control).
 *
 * **And it is a fact in words, not just a digit.** Both copies appended a bare `2` to
 * the button's content, so the accessible name computed as `Filters2` — a screen reader
 * was read a number with nothing saying what it counted. The badge is now `aria-hidden`
 * and the count is stated in an `aria-label` (`Filters, 2 applied`), which is the same
 * correction ADR-0061 makes to the strip's open-panel marker one level up: state it,
 * do not decorate it.
 */
import React from 'react';
import Icon from './Icon';
import StableWidth from './StableWidth';

/** Props for {@link FilterToggle}. */
export interface FilterToggleProps {
  /** Whether the filter panel is currently expanded. Drives the active styling and the state attribute. */
  open: boolean;
  /** Number of filters currently applied. The badge is hidden at 0. */
  activeCount: number;
  /** Toggles the filter panel open/closed. */
  onToggle: () => void;
  /**
   * Vertical scale, named to match the {@link Input} it stands beside rather than
   * inventing a third size vocabulary: `lg` beside an `Input size="lg"`, `md`
   * beside anything shorter. It is deliberately not a full size scale — these are
   * the only two heights any search row in this app uses.
   */
  size?: 'md' | 'lg';
  /** Visible label. Defaults to `Filters`. */
  label?: string;
  /**
   * Native tooltip. Defaults to `Toggle filters`. Use it for the *why*; the accessible
   * name is built from {@link FilterToggleProps.label} and the count.
   */
  title?: string;
  /**
   * `id` of the region this control discloses.
   *
   * Supplying it makes the button a **disclosure** — `aria-expanded` plus
   * `aria-controls`, the same contract `IconButton` and `StretchedButton`
   * document — instead of a toggle button reporting `aria-pressed`. The two say
   * different things and a reader should be told one of them: *pressed* is a
   * setting that is on, *expanded* is a region below that is open. A rung whose
   * panel has no stable id keeps the toggle semantics it has always had, so this
   * is additive rather than a migration.
   */
  controls?: string;
}

const PADDING: Record<'md' | 'lg', string> = {
  md: 'px-4 py-2',
  lg: 'px-4 py-3',
};

/**
 * The Filters toggle button.
 *
 * The active wash is driven by `open || activeCount > 0`, not by `open` alone: a
 * collapsed panel with two filters still applied is a state the reader has to be
 * able to see, and it is the state in which a hidden filter silently shortens the
 * list beneath it.
 *
 * @example
 * ```tsx
 * <div className="flex gap-2">
 *   <SearchBar … />
 *   <FilterToggle open={showFilters} activeCount={2} onToggle={toggle} size="lg" />
 * </div>
 * ```
 */
const FilterToggle: React.FC<FilterToggleProps> = ({
  open,
  activeCount,
  onToggle,
  size = 'md',
  label = 'Filters',
  title = 'Toggle filters',
  controls,
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={controls ? undefined : open}
    aria-expanded={controls ? open : undefined}
    aria-controls={controls}
    aria-label={activeCount > 0 ? `${label}, ${activeCount} applied` : label}
    className={`press flex shrink-0 items-center gap-(--sp-inline) rounded-md border text-sm font-medium ${
      PADDING[size]
    } ${
      open || activeCount > 0
        ? 'bg-primary-light border-primary text-primary-text'
        : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400'
    }`}
    title={title}
  >
    <Icon type="filter" size="sm" />
    {label}
    {/*
      The badge's slot is held open from first render, and the button is
      `shrink-0`. Both halves matter: applying a filter used to widen this button,
      and because the search field beside it is the `flex-1` in the row, the field
      shrank under a typing user (D-053f). Reserving here rather than at the call
      site fixes every rung that hosts the control.
    */}
    <StableWidth
      reserve={
        <span className="min-w-[20px] px-1.5 py-0.5 text-xs font-bold">
          {Math.max(activeCount, 1)}
        </span>
      }
      align="center"
    >
      {activeCount > 0 && (
        <span
          aria-hidden="true"
          className="min-w-[20px] rounded-full bg-primary px-1.5 py-0.5 text-center text-xs font-bold tabular-nums text-white"
        >
          {activeCount}
        </span>
      )}
    </StableWidth>
  </button>
);

export default FilterToggle;
