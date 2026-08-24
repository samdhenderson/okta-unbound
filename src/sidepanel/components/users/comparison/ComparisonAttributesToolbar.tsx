/**
 * @module sidepanel/components/users/comparison/ComparisonAttributesToolbar
 * @description Everything above the attribute list: the three filter pills, the
 * search field, the hidden-differences disclosure, and — one per user — the
 * Edit / Cancel / Save controls.
 *
 * Split out of {@link ComparisonAttributesTab} when the tab became editable, so
 * the tab holds grouping, filtering and the list while this holds the chrome
 * that drives them. It is presentational throughout: every piece of state it
 * renders is owned above it.
 *
 * ## Both edit affordances name their user
 *
 * The Attributes tab writes to a **profile**, and there are two profiles on
 * screen. "Edit" on its own would be a live write to whichever user the admin
 * had not been thinking about, so every control that starts, abandons or commits
 * an edit carries the name of the person it acts on. `Edit` states the name
 * visibly, because that is the control an admin reaches for cold; `Cancel` and
 * `Save` shorten it visually once the column is unambiguously in edit mode, and
 * keep the name in their accessible names so the two columns' controls are never
 * two identically-named buttons to a screen reader.
 *
 * At 360px two named buttons do not fit on one line, so the columns stack below
 * `sm` and sit side by side above it.
 *
 * ## A column with no host to publish to shows nothing
 *
 * {@link ComparisonEditSide.canEdit} is false when the surface is hidden, when
 * there is no user, or when nothing can lift the saved result (the context
 * column's case — see `useComparisonProfileEdit`). It renders **no** control
 * rather than a disabled one: a disabled button invites an admin to hunt for the
 * condition that enables it, and here there is none to find.
 *
 * ## Security
 *
 * Both users' display names and every attribute value the search field filters
 * on are end-user-controllable tenant data and frequently PII. They render
 * through React's escaping only, and **nothing in this module logs**.
 */
import React from 'react';
import { AlertMessage, Button, FilterPill, Input } from '../../shared';
import type { ComparisonEditSide } from '../../../hooks/useComparisonProfileEdit';

/** Which rows the list is showing. Mirrors `ComparisonDiffTab`'s `ParityFilter`. */
export type AttributeFilter = 'differences' | 'shared' | 'all';

/** Props for {@link ComparisonAttributesToolbar}. */
export interface ComparisonAttributesToolbarProps {
  /** The active filter pill. */
  filter: AttributeFilter;
  /** Called with the pill the reader chose. */
  onFilterChange: (filter: AttributeFilter) => void;
  /** How many listed rows differ — the number on the Differences pill. */
  differenceCount: number;
  /** How many listed rows agree — the number on the Shared pill. */
  sharedCount: number;
  /** How many rows are listed in total — the number on the All pill. */
  totalCount: number;
  /** The current search term. */
  query: string;
  /** Called with the new search term. */
  onQueryChange: (query: string) => void;
  /**
   * How many differing attributes the display config is hiding. `0` renders no
   * disclosure line at all — there is nothing being withheld to admit to.
   */
  hiddenDifferences: number;
  /** Whether the hidden rows are currently revealed. */
  revealHidden: boolean;
  /** Toggles the reveal. */
  onToggleHidden: () => void;
  /** The left column's editor. Absent renders no editing controls for it. */
  contextEdit?: ComparisonEditSide;
  /** The right column's editor. Absent renders no editing controls for it. */
  comparedEdit?: ComparisonEditSide;
}

/**
 * A short visible word beside the whole sentence a screen reader hears.
 *
 * The two are **separate, complete strings** rather than a visible word plus an
 * `sr-only` suffix: the accessible-name computation concatenates text nodes with
 * no separator and trims each, so `Save` + `" changes to Bo"` is announced as
 * "Savechanges to Bo". The visible half is `aria-hidden`, which takes it out of
 * the name entirely and leaves the spoken half saying the whole thing.
 */
const scopedLabel = (visible: string, spoken: string): React.ReactNode => (
  <>
    <span aria-hidden="true">{visible}</span>
    <span className="sr-only">{spoken}</span>
  </>
);

/**
 * One column's Edit / Cancel / Save cluster, plus the outcome of its last save
 * when there is no confirmation left to carry it.
 */
const SideEditControls: React.FC<{ side: ComparisonEditSide }> = ({ side }) => {
  if (!side.canEdit) return null;

  return (
    <div className="min-w-0 flex-1 space-y-1">
      {side.isEditing ? (
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="sm" onClick={side.cancel} disabled={side.isSaving}>
            {scopedLabel('Cancel', `Cancel editing ${side.userName}`)}
          </Button>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            loading={side.isSaving}
            disabled={!side.hasChanges || side.hasInvalid}
            title={
              side.hasInvalid
                ? 'Some values are not valid. Fix them before saving.'
                : !side.hasChanges
                  ? 'Nothing has been changed yet.'
                  : undefined
            }
            onClick={side.requestSave}
          >
            {scopedLabel('Save', `Save changes to ${side.userName}`)}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" fullWidth onClick={side.begin}>
          Edit {side.userName}
        </Button>
      )}
      {side.message && (
        <AlertMessage message={{ type: side.message.type, text: side.message.text }} />
      )}
    </div>
  );
};

/**
 * The Attributes tab's controls: filter, search, the hidden-differences
 * disclosure and the two per-user edit clusters.
 *
 * @param props - See {@link ComparisonAttributesToolbarProps}.
 */
const ComparisonAttributesToolbar: React.FC<ComparisonAttributesToolbarProps> = ({
  filter,
  onFilterChange,
  differenceCount,
  sharedCount,
  totalCount,
  query,
  onQueryChange,
  hiddenDifferences,
  revealHidden,
  onToggleHidden,
  contextEdit,
  comparedEdit,
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-1.5">
      {/* All leads the row, matching `ComparisonDiffTab`. Which pill opens
          active is the host's `filter` prop and is unaffected by this order. */}
      <FilterPill active={filter === 'all'} onClick={() => onFilterChange('all')}>
        All {totalCount}
      </FilterPill>
      <FilterPill active={filter === 'differences'} onClick={() => onFilterChange('differences')}>
        Differences {differenceCount}
      </FilterPill>
      <FilterPill active={filter === 'shared'} onClick={() => onFilterChange('shared')}>
        Shared {sharedCount}
      </FilterPill>
    </div>

    <Input
      type="search"
      value={query}
      onChange={onQueryChange}
      placeholder="Filter attributes…"
      ariaLabel="Filter attributes by name or value"
    />

    {hiddenDifferences > 0 && (
      <p className="flex flex-wrap items-center gap-1 text-xs text-neutral-600">
        <span>
          {hiddenDifferences === 1
            ? '1 differing attribute hidden by your display config'
            : `${hiddenDifferences} differing attributes hidden by your display config`}
        </span>
        <Button variant="ghost" size="sm" onClick={onToggleHidden}>
          {revealHidden ? 'Hide' : 'Show'}
        </Button>
      </p>
    )}

    {(contextEdit?.canEdit || comparedEdit?.canEdit) && (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        {contextEdit && <SideEditControls side={contextEdit} />}
        {comparedEdit && <SideEditControls side={comparedEdit} />}
      </div>
    )}
  </div>
);

export default ComparisonAttributesToolbar;
