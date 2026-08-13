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

/**
 * Which way the equality marker lies from a side cell — so an action can point
 * **inward**, at the `≠` it would close.
 */
export type CellDirection = 'left' | 'right';

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
   *
   * `direction` is which way the marker lies from this cell, so the caller can
   * put the arrow **inside** the control it belongs to (`Add →` on the left,
   * `← Add` on the right) rather than beside it.
   */
  renderContextAction?: (row: ParityRow, direction: CellDirection) => React.ReactNode;
  /** Optional action for the RIGHT cell of a row the compared user lacks. */
  renderComparedAction?: (row: ParityRow, direction: CellDirection) => React.ReactNode;
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

/** One item: its label and provenance, then the two sides and the marker between. */
const ParityListRow: React.FC<{
  row: ParityRow;
  contextName: string;
  comparedName: string;
  renderContextAction?: (row: ParityRow, direction: CellDirection) => React.ReactNode;
  renderComparedAction?: (row: ParityRow, direction: CellDirection) => React.ReactNode;
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

      {/* Equal thirds around a fixed marker, so the strip spans the row and an
          action can never overflow the cell it lives in. */}
      <span className="flex items-stretch gap-2">
        <SideCell
          held={row.inContext}
          userName={contextName}
          action={renderContextAction?.(row, 'right')}
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
          action={renderComparedAction?.(row, 'left')}
        />
      </span>
    </li>
  );
};

/**
 * One side of a row: a third of the strip, whatever it holds.
 *
 * The side that HAS the item is **named**. That is what makes the row readable
 * without a column header — with two users, naming the holder identifies the
 * other side by elimination, which is how the design was drawn
 * (`[Add →] ≠ [Jordan]`). An earlier cut showed a bare check here and put the
 * names in a header above the list; the header's columns could not line up with a
 * strip that sits on its own line, so the check identified nobody.
 *
 * A side that lacks the item and *can* be given it renders the caller's action —
 * which carries the inward-pointing arrow in its own label, so button and arrow
 * are one target rather than a glyph floating beside it. A side that lacks it and
 * cannot be given it (an app row, an app-mastered group) gets a stated
 * non-answer, never a button that would fail.
 */
const SideCell: React.FC<{
  held: boolean;
  userName: string;
  action: React.ReactNode;
}> = ({ held, userName, action }) => {
  if (held) {
    return (
      <span
        className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600"
        title={`${userName} has this`}
      >
        <Icon type="check" size="sm" className="shrink-0 text-success-text" />
        <span className="truncate">{userName}</span>
      </span>
    );
  }

  if (!action) {
    return (
      <span
        className="flex min-w-0 flex-1 items-center justify-center rounded-md border border-dashed border-neutral-200 px-2 py-1 text-xs text-neutral-400"
        title={`${userName} does not have this`}
      >
        —
      </span>
    );
  }

  return <span className="flex min-w-0 flex-1 items-center justify-center">{action}</span>;
};

export default ComparisonDiffTab;
