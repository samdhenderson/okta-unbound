/**
 * @module sidepanel/components/home/OrgSnapshotCard
 * @description The Home tab's third region: what is worth fixing in this org.
 *
 * A findings list. Each row is one actionable count — *31 groups with no
 * members* — and pressing it opens that tab with the matching filter already
 * applied. The collection totals are a caption underneath, because `214 groups`
 * is trivia and the slice of it that needs work is not.
 *
 * All of it is read from the background-owned org snapshot (ADR-0040), so a warm
 * org renders the whole card at **zero requests**.
 *
 * ## A number is a place, not a fact
 *
 * `31` that leaves you to rebuild its filter by hand is a worse version of a
 * link, so every finding with a number is a control. A finding whose collections
 * cannot support a number is a row with an em dash and a sentence saying which
 * read is missing — still present, still legible, but not a control: a link into
 * a list that would disagree with the figure is the dead control ADR-0039 bans,
 * wearing a different hat.
 *
 * Keeping the row rather than dropping it is the whole reason this reads as a
 * findings list *plus placeholders* rather than a pure one. A collection that
 * was never read has no findings, and "nothing to fix" and "nothing known" must
 * not look the same.
 *
 * ## Every figure states its own age
 *
 * The footnote is not decoration. A cached number with no stated age *is* a
 * cached number presented as current, which is the thing this repo's ledger
 * bans — so the card quotes the oldest walk behind it and offers a Refresh that
 * forces a real one. What it never does is claim freshness it does not have:
 * with any collection unwalked there is no honest age, and the line says so
 * instead of inventing one.
 *
 * The four states a figure can be in, and why a `0` is never a stand-in for
 * "unknown", live in {@link module:sidepanel/components/home/orgFigures}.
 */
import React from 'react';
import Eyebrow from '../shared/Eyebrow';
import Icon from '../shared/Icon';
import IconButton from '../shared/IconButton';
import Skeleton from '../shared/Skeleton';
import StretchedButton from '../shared/StretchedButton';
import FigureNumber from './FigureNumber';
import { getRelativeTime } from '../../../shared/utils/dateFormat';
import type { ListViewRequest, ListViewTab } from '../../listViewRequest';
import type { OrgBox, OrgSubCount } from './orgFigures';

/** Props for {@link OrgSnapshotCard}. */
export interface OrgSnapshotCardProps {
  /** One entry per collection: its total, and the findings drawn from it. */
  boxes: OrgBox[];
  /** Epoch millis of the oldest finished walk, or `null` when there is none. */
  readAt: number | null;
  /** Whether a refresh is in flight. */
  isRefreshing: boolean;
  /** Force a full walk. */
  onRefresh: () => void;
  /** Whether a refresh can be issued (needs a connected Okta tab). */
  canRefresh: boolean;
  /** Open a tab's list unfiltered — what a total in the caption does. */
  onOpenTab: (tab: ListViewTab) => void;
  /** Open a tab's list with a filter applied — what a finding does. */
  onOpenListView: (request: ListViewRequest) => void;
}

/** The two lines beside the number: the finding, and what it is out of. */
const FindingLines: React.FC<{ subCount: OrgSubCount; id: string }> = ({ subCount, id }) => (
  <span className="flex min-w-0 flex-1 flex-col gap-px">
    <span
      id={id}
      className={`text-sm ${
        subCount.value === null ? 'font-medium text-neutral-600' : 'font-semibold text-neutral-900'
      }`}
    >
      {subCount.label}
    </span>
    {subCount.note && (
      <span
        className={`text-xs ${
          subCount.status === 'partial' ? 'text-warning-text' : 'text-neutral-600'
        }`}
      >
        {subCount.note}
      </span>
    )}
  </span>
);

/**
 * One finding row.
 *
 * A flush `<li>` with no border of its own — the separators belong to the
 * parent's `divide-y divide-neutral-100`, which is ADR-0029's second sanctioned
 * pattern for a dense list that reads as one table-like surface rather than a
 * stack of cards. A per-row `ListRow` would draw a card border inside a card
 * border; a per-row `border-t` + `first:border-t-0` is the same idea spelled the
 * way that ADR bans.
 *
 * Activation is a {@link StretchedButton} covering the row rather than a
 * `<button>` wrapping its content, so the row keeps flush padding and no button
 * chrome. `describedBy` points at this row's own finding text, so every overlay
 * announcing "Open the filtered list" is still distinguishable.
 */
const Finding: React.FC<{
  subCount: OrgSubCount;
  onOpen: (request: ListViewRequest) => void;
}> = ({ subCount, onOpen }) => {
  const labelId = `org-finding-${subCount.key}`;

  if (subCount.status === 'reading') {
    return (
      <li className="px-(--sp-row-x) py-(--sp-row-y)">
        <Skeleton variant="text" size="sm" width="w-3/4" label={`Reading ${subCount.label}`} />
      </li>
    );
  }

  if (subCount.value === null) {
    // Recessed rather than removed. A collection that was never read has no
    // findings, so dropping the row would make "nothing to fix" and "nothing
    // known" look identical — and it is not a control, because a link into a
    // list that would disagree with the figure is the dead control ADR-0039
    // bans, wearing a different hat.
    return (
      <li className="flex items-stretch gap-3 bg-neutral-50 px-(--sp-row-x) py-(--sp-row-y)">
        <FigureNumber value={null} />
        <FindingLines subCount={subCount} id={labelId} />
      </li>
    );
  }

  return (
    // No `.press` on the row: `StretchedButton` itself carries the response
    // layer's press feedback (ADR-0046) — a state-layer wash on its own
    // `:active` — since the overlay has no visible box of its own for a scale
    // to read on, the same reasoning `ListRow` now documents for any row
    // activated this way.
    <li className="relative flex items-stretch gap-3 px-(--sp-row-x) py-(--sp-row-y) transition-colors duration-(--dur-instant) hover:bg-neutral-50">
      <StretchedButton
        label="Open the filtered list"
        describedBy={labelId}
        onClick={() => onOpen(subCount.request)}
      />
      <FigureNumber value={subCount.value} />
      <FindingLines subCount={subCount} id={labelId} />
      <Icon type="chevron-right" size="xs" className="shrink-0 self-center text-neutral-400" />
    </li>
  );
};

/**
 * Render the org snapshot card.
 *
 * @param props - See {@link OrgSnapshotCardProps}.
 */
const OrgSnapshotCard: React.FC<OrgSnapshotCardProps> = ({
  boxes,
  readAt,
  isRefreshing,
  onRefresh,
  canRefresh,
  onOpenTab,
  onOpenListView,
}) => {
  const age = readAt === null ? null : getRelativeTime(new Date(readAt).toISOString());
  const findings = boxes.flatMap((box) => box.subCounts);
  // A total with no number is left out of the caption rather than shown as a
  // gap: the findings list already carries the sentence explaining what is
  // missing, and repeating it here would say it twice.
  const totals = boxes.filter((box) => box.value !== null);

  return (
    <section aria-label="This org" className="space-y-2">
      <div className="flex items-center justify-between gap-(--sp-inline)">
        <Eyebrow as="h3">This org</Eyebrow>
        {/*
          One control, not one per collection: `syncSnapshot` is org-wide — it
          walks every collection and coalesces concurrent callers per origin —
          so a per-row refresh could not refresh only that row.
        */}
        <IconButton
          label="Refresh this org"
          variant="ghost"
          onClick={onRefresh}
          disabled={!canRefresh || isRefreshing}
        >
          <Icon type="refresh" size="sm" className={isRefreshing ? 'animate-spin' : undefined} />
        </IconButton>
      </div>

      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200 bg-white">
        {findings.map((subCount) => (
          <Finding key={subCount.key} subCount={subCount} onOpen={onOpenListView} />
        ))}
      </ul>

      {totals.length > 0 && (
        <p className="flex flex-wrap items-baseline gap-(--sp-inline) text-xs text-neutral-600">
          {totals.map((box, index) => (
            <React.Fragment key={box.key}>
              {index > 0 && (
                <span aria-hidden="true" className="text-neutral-300">
                  ·
                </span>
              )}
              {/*
                §3 exception: chromeless text-link, the same one `GroupFilterPanel`'s
                "Clear all" takes — there is no shared text-link primitive, and a
                `Button` here would put three chunky pills under a dense list and
                out-weigh the findings the card exists to lead with. `.press` (not
                `-subtle`) because the target is small — a word, not a row —
                and `active:brightness-90` for the same darker press step
                `Button`/`IconButton` carry (ADR-0046).
              */}
              <button
                type="button"
                onClick={() => onOpenTab(box.tab)}
                className="press rounded-sm px-0.5 text-primary-text underline decoration-primary-highlight underline-offset-2 hover:bg-primary-light active:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              >
                {box.status === 'partial' ? 'at least ' : ''}
                {box.value?.toLocaleString()} {box.noun}
              </button>
            </React.Fragment>
          ))}
        </p>
      )}

      <p className="text-xs text-neutral-600">
        {age
          ? `Counts as Okta reports them · read ${age}`
          : // Not omitted, and not guessed. Saying why there is no age is the
            // only reading that is both honest and useful.
            'Counts as Okta reports them. No age stated — not every collection has finished a read.'}
      </p>
    </section>
  );
};

export default OrgSnapshotCard;
