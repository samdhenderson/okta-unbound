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
 * ## Both sides are always named
 *
 * An earlier cut named only the side that held the item and let the other side be
 * identified by elimination, with an arrow on the Add button pointing at the `≠`
 * it would close. That failed twice over. The named side filled its third while
 * the button did not, so the strip was visibly lopsided. Worse, the arrow pointed
 * *away* from the user who would actually receive the item — the recipient is
 * whichever side the button sits on — so the row appeared to say the opposite of
 * what clicking it did.
 *
 * Now every cell names its user in every state, and the action says
 * `Add <recipient>`. There is no arrow, because with the recipient named there is
 * nothing left to disambiguate. The three cells are the same shape, so symmetry
 * is structural rather than something spacing has to maintain.
 *
 * ## Why the strip is a grid and every row is one height
 *
 * The three cells were `flex-1` around a fixed marker, which looks like equal
 * thirds and is not. `flex-1` is `flex: 1 1 0%`, and under `box-sizing:
 * border-box` a cell's own padding and border are floor space it keeps *before*
 * the free space is split: the named pill (`px-2` + a 1px border = 18px of
 * chrome) came out 18px wider than the bare wrapper around an Add button, so the
 * marker sat 9px off-centre — and it moved to the *other* side of centre on a row
 * whose button was on the right. Down a list, the `=` column visibly staggered.
 * `grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)]` sizes the tracks instead of the
 * boxes, so the two sides are equal whatever each one is made of. (`minmax(0,…)`
 * rather than plain `1fr`, whose `auto` minimum would let a long name push its
 * track wider again.)
 *
 * Height was the same failure in the other axis: a cell was as tall as whatever
 * it held, so a row with an Add button stood 36px and a row of two pills stood
 * 26px — which made every shared row shorter than every difference row. The
 * cells therefore carry the button's own `min-h-9`, and the meta line is a
 * reserved slot rather than an optional one (see {@link ParityListRow}), so a
 * shared row and a difference row are the same height and the list scans as
 * columns.
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
   *
   * `recipientName` is **this cell's own user** — the one who would receive the
   * item. The caller puts it in the control's label so the row states who
   * receives rather than leaving it to be inferred from which side the button
   * sits on. See {@link SideCell} for why that inference used to go wrong.
   */
  renderContextAction?: (row: ParityRow, recipientName: string) => React.ReactNode;
  /** Optional action for the RIGHT cell of a row the compared user lacks. */
  renderComparedAction?: (row: ParityRow, recipientName: string) => React.ReactNode;
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
        {/* All leads the row; `differences` is still the filter that opens
            active (see `useState` above) — the lead pill is the widest
            selection, not the default one. */}
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          All {rows.length}
        </FilterPill>
        <FilterPill active={filter === 'differences'} onClick={() => setFilter('differences')}>
          Differences {differenceCount}
        </FilterPill>
        <FilterPill active={filter === 'shared'} onClick={() => setFilter('shared')}>
          Shared {sharedCount}
        </FilterPill>
      </div>

      <Input
        type="search"
        value={query}
        onChange={setQuery}
        placeholder={`Filter ${noun}s…`}
        ariaLabel={`Filter ${noun}s by name`}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-neutral-200 bg-white">
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
                // Decided for the LIST, not per row: a list that annotates any
                // row reserves the line on every row, so one row saying nothing
                // (a shared group has no single provenance to state) does not
                // make it shorter than its neighbours. A list that annotates
                // nothing at all — the Apps tab before scopes load, the
                // read-only story — reserves nothing and stays dense.
                reserveMeta={renderMeta !== undefined}
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
  renderContextAction?: (row: ParityRow, recipientName: string) => React.ReactNode;
  renderComparedAction?: (row: ParityRow, recipientName: string) => React.ReactNode;
  renderMeta?: (row: ParityRow) => React.ReactNode;
  reserveMeta?: boolean;
}> = ({
  row,
  contextName,
  comparedName,
  renderContextAction,
  renderComparedAction,
  renderMeta,
  reserveMeta = false,
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
        {/* A fixed-height slot, occupied or not. The two indicators that live
            here are different heights themselves (a chip with a border is 22px,
            bare italic text is 16px), so even two annotated rows would otherwise
            differ; `h-6` clears the tallest and every row lands on one rhythm. */}
        {reserveMeta && <span className="flex h-6 min-w-0 max-w-full items-center">{meta}</span>}
      </span>

      {/* Real equal thirds: grid TRACKS, not `flex-1` boxes — under flex a padded
          cell and a bare one differ by their own chrome, which is what knocked
          the marker off the centre line. See the module header. */}
      <span className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-stretch gap-2">
        <SideCell
          held={row.inContext}
          userName={contextName}
          action={renderContextAction?.(row, contextName)}
        />
        {/* Not a button, not focusable: a status that borrows the silhouette. */}
        <span
          role="img"
          aria-label={matched ? 'Both users have this' : 'Only one user has this'}
          className={`flex min-h-9 items-center justify-center rounded-md border font-mono text-sm font-bold ${
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
          action={renderComparedAction?.(row, comparedName)}
        />
      </span>
    </li>
  );
};

/**
 * One side of a row: a third of the strip, whatever it holds.
 *
 * **Every side names its user, in every state.** That is the fix for two problems
 * the earlier cut had. Visually, only the holding side was named and only the
 * holding side filled its third, so a row read as a full-width grey pill facing a
 * small button floating in empty space — the asymmetry was structural, not a
 * spacing bug. Semantically, the unnamed side was the one you were about to act
 * on: the button added the item to *its own* user, but carried an arrow pointing
 * away from them at the only name on the row, so the row appeared to say the
 * opposite of what the click did.
 *
 * Naming the recipient inside the control removes the inference entirely. There
 * is no arrow, because there is nothing left for one to disambiguate.
 *
 * A side that lacks the item and cannot be given it (an app row, an app-mastered
 * group) still gets a stated non-answer, never a button that would fail — but it
 * names its user too, so all three states are the same shape.
 */
/**
 * The stated (non-button) cell, in both of its tones.
 *
 * `min-h-9` is `Button`'s own `sm` height, quoted rather than coincidental: it is
 * what stops a row of two stated cells from standing 10px shorter than a row
 * carrying an Add button. Width comes from the grid track, so the cell no longer
 * carries a flex basis of its own.
 */
const cellClasses =
  'flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs';

const SideCell: React.FC<{
  held: boolean;
  userName: string;
  action: React.ReactNode;
}> = ({ held, userName, action }) => {
  if (held) {
    return (
      <span
        className={`${cellClasses} border-neutral-200 bg-neutral-50 text-neutral-600`}
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
        className={`${cellClasses} border-dashed border-neutral-200 text-neutral-400`}
        title={`${userName} does not have this`}
      >
        <Icon type="minus" size="sm" aria-hidden="true" className="shrink-0" />
        <span className="truncate">{userName}</span>
      </span>
    );
  }

  // The action fills the cell — the caller passes `fullWidth`, so the button is
  // the same width as the named cell opposite it and the strip reads as thirds.
  return <span className="flex min-w-0">{action}</span>;
};

export default ComparisonDiffTab;
