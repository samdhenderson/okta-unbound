/**
 * @module sidepanel/components/users/comparison/ComparisonDiffTab
 * @description One list where every row states the comparison: two sides, an equality marker, and the action that closes the gap.
 *
 * Reused for both the Groups and Apps tabs; `noun` and the empty-state string are
 * supplied by the parent, and the two side actions are render props so this stays
 * presentational.
 *
 * ## Why not three buckets
 *
 * This surface used to render onlyCompared / shared / onlyContext as three cards
 * sharing the panel's height in proportion to their row counts. That failed twice
 * over: it separated the two users *spatially*, so reading a row meant knowing
 * which card you were in, and it handed most of the screen to `shared` — the one
 * group nobody acts on. A comparison of 65 groups gave 53 shared rows ~80% of the
 * panel and left the 12 actionable ones scrolling in a sliver.
 *
 * The parity row states both facts in place instead. It also fixes a subtler
 * wrong: under buckets a successful copy made the Add button *vanish*, because
 * the row moved to another card. Here the row flips `≠` → `=` where you are
 * already looking.
 *
 * ## The middle cell is not a control
 *
 * It keeps the button silhouette so the three cells read as one set, but it is
 * inert: no `<button>`, not focusable, `role="img"` with a label so a screen
 * reader hears "Both members" rather than "equals". `=` and `≠` are different
 * glyphs, so the state never depends on colour.
 *
 * ## Security
 *
 * Row labels are untrusted, end-user-controllable tenant data. Rendered through
 * React's escaping — never `dangerouslySetInnerHTML` — and never logged; this
 * module logs nothing.
 */
import React, { useMemo, useState } from 'react';
import Icon from '../../overview/shared/Icon';
import Input from '../../shared/Input';
import FilterPill from '../../shared/FilterPill';
import type { ParityRow } from './comparisonAnalytics';

/** Which rows the list is showing. */
export type ParityFilter = 'differences' | 'shared' | 'all';

/** Props for {@link ComparisonDiffTab}. */
interface ComparisonDiffTabProps {
  /** Display name of the context user (baseline) — the LEFT side of every row. */
  contextName: string;
  /** Display name of the compared user — the RIGHT side of every row. */
  comparedName: string;
  /** Every item either user holds, in display order (differences first). */
  rows: ParityRow[];
  /** Singular noun for the items ("group" or "app"), used in the copy. */
  noun: string;
  /** Shown when there are no rows at all. */
  emptyText: string;
  /**
   * Optional action for the LEFT cell of a row the context user lacks — "add it
   * to them". Returning `null` renders a plain unmet marker instead, which is
   * what an app row (nothing to copy) and an app-mastered group both do.
   */
  renderContextAction?: (row: ParityRow) => React.ReactNode;
  /** Optional action for the RIGHT cell of a row the compared user lacks. */
  renderComparedAction?: (row: ParityRow) => React.ReactNode;
  /**
   * Optional per-row detail under the label — today, how the membership was
   * granted. Kept a render prop because only the caller knows what its facet
   * means, and on a shared row it describes only one of the two users.
   */
  renderMeta?: (row: ParityRow) => React.ReactNode;
}

/** Whether a row is a difference between the two users. */
const differs = (row: ParityRow): boolean => row.inContext !== row.inCompared;

/** The parity list: one row per item, stating who holds it and what closes the gap. */
const ComparisonDiffTab: React.FC<ComparisonDiffTabProps> = ({
  contextName,
  comparedName,
  rows,
  noun,
  emptyText,
  renderContextAction,
  renderComparedAction,
  renderMeta,
}) => {
  const [filter, setFilter] = useState<ParityFilter>('differences');
  const [query, setQuery] = useState('');

  const differenceCount = useMemo(() => rows.filter(differs).length, [rows]);
  const sharedCount = rows.length - differenceCount;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'differences' && !differs(row)) return false;
      if (filter === 'shared' && differs(row)) return false;
      return needle === '' || row.label.toLowerCase().includes(needle);
    });
  }, [rows, filter, query]);

  return (
    // Viewport-derived rather than `h-full`: there is no definite-height chain to
    // inherit — the side panel's scroller is `App`'s `h-screen` div and every tab
    // below it is content-sized, so `h-full` would resolve against `auto` and
    // collapse. `flex-1` is kept so a host that ever does give this a real height
    // wins over the minimum.
    <div className="flex min-h-[calc(100vh-22rem)] flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterPill active={filter === 'differences'} onClick={() => setFilter('differences')}>
          Differences {differenceCount}
        </FilterPill>
        <FilterPill active={filter === 'shared'} onClick={() => setFilter('shared')}>
          Shared {sharedCount}
        </FilterPill>
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          All {rows.length}
        </FilterPill>
      </div>

      <Input
        type="search"
        value={query}
        onChange={setQuery}
        placeholder={`Filter ${noun}s…`}
        ariaLabel={`Filter ${noun}s by name`}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <ColumnHeader
          contextName={contextName}
          comparedName={comparedName}
          count={visible.length}
        />
        {visible.length === 0 ? (
          <p className="px-3 py-3 text-xs text-neutral-500 italic">
            {rows.length === 0 ? emptyText : `No ${noun}s match this filter.`}
          </p>
        ) : (
          <ul className="scrollable-list min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
            {visible.map((row) => (
              <ParityListRow
                key={row.id}
                row={row}
                contextName={contextName}
                comparedName={comparedName}
                renderContextAction={renderContextAction}
                renderComparedAction={renderComparedAction}
                renderMeta={renderMeta}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/** Names the two columns once, so a row's cells need not repeat them. */
const ColumnHeader: React.FC<{ contextName: string; comparedName: string; count: number }> = ({
  contextName,
  comparedName,
  count,
}) => (
  <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-1.5">
    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-neutral-500">
      {count} showing
    </span>
    <span className="w-20 shrink-0 truncate text-center text-[11px] font-semibold text-neutral-600">
      {contextName}
    </span>
    <span className="w-8 shrink-0" aria-hidden="true" />
    <span className="w-20 shrink-0 truncate text-center text-[11px] font-semibold text-neutral-600">
      {comparedName}
    </span>
  </div>
);

/** One item: its label and provenance, then the two sides and the marker between. */
const ParityListRow: React.FC<{
  row: ParityRow;
  contextName: string;
  comparedName: string;
  renderContextAction?: (row: ParityRow) => React.ReactNode;
  renderComparedAction?: (row: ParityRow) => React.ReactNode;
  renderMeta?: (row: ParityRow) => React.ReactNode;
}> = ({
  row,
  contextName,
  comparedName,
  renderContextAction,
  renderComparedAction,
  renderMeta,
}) => {
  const meta = renderMeta?.(row);
  const matched = row.inContext && row.inCompared;

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2 hover:bg-neutral-50/70">
      {/* `min-w-0` + `items-start`: the label column truncates and the meta line
          hugs its text instead of stretching into a full-width bar (flex children
          stretch by default). */}
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="w-full truncate text-sm text-neutral-800" title={row.label}>
          {row.label}
        </span>
        {meta}
      </span>

      <span className="flex items-stretch gap-2">
        <SideCell
          held={row.inContext}
          userName={contextName}
          direction="right"
          action={renderContextAction?.(row)}
        />
        {/* Not a button, not focusable: a status that borrows the silhouette. */}
        <span
          role="img"
          aria-label={matched ? 'Both users have this' : 'Only one user has this'}
          className={`flex w-8 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-bold ${
            matched
              ? 'border-success-light bg-success-light text-success-text'
              : 'border-warning-light bg-warning-light text-warning-text'
          }`}
        >
          {matched ? '=' : '≠'}
        </span>
        <SideCell
          held={row.inCompared}
          userName={comparedName}
          direction="left"
          action={renderComparedAction?.(row)}
        />
      </span>
    </li>
  );
};

/**
 * One side of a row.
 *
 * Three states, and the middle one is the whole point of the design: a user who
 * lacks the item and *can* be given it gets a real button, with the arrow on the
 * edge nearest the marker pointing inward — the gesture and the goal are the same,
 * close the `≠`. A user who lacks it and cannot be given it (an app row, an
 * app-mastered group) gets a stated non-answer, never a button that would fail.
 */
const SideCell: React.FC<{
  held: boolean;
  userName: string;
  direction: 'left' | 'right';
  action: React.ReactNode;
}> = ({ held, userName, direction, action }) => {
  if (held) {
    return (
      <span
        className="flex w-20 shrink-0 items-center justify-center gap-1 truncate rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600"
        title={`${userName} has this`}
      >
        <Icon type="check" size="sm" className="shrink-0 text-success-text" />
      </span>
    );
  }

  if (!action) {
    return (
      <span
        className="flex w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-neutral-200 px-2 py-1 text-xs text-neutral-400"
        title={`${userName} does not have this`}
      >
        —
      </span>
    );
  }

  return (
    <span className="flex w-20 shrink-0 items-center justify-center">
      {direction === 'right' ? (
        <>
          {action}
          <span aria-hidden="true" className="ml-0.5 font-mono text-xs text-neutral-400">
            →
          </span>
        </>
      ) : (
        <>
          <span aria-hidden="true" className="mr-0.5 font-mono text-xs text-neutral-400">
            ←
          </span>
          {action}
        </>
      )}
    </span>
  );
};

export default ComparisonDiffTab;
