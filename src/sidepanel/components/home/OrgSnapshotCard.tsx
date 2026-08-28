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
import Button from '../shared/Button';
import Icon from '../shared/Icon';
import IconButton from '../shared/IconButton';
import ListRow from '../shared/ListRow';
import Skeleton from '../shared/Skeleton';
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

/**
 * The number column.
 *
 * A fixed `2.6ch` of `tabular-nums` so the left edge of the sentences beside it
 * never twitches between a `4` and a `214` — and so an em dash occupies the same
 * space a number would, which is what lets a missing value sit in the list
 * without the row looking broken.
 */
const FigureNumber: React.FC<{ value: number | null }> = ({ value }) => (
  <span
    aria-hidden={value === null ? 'true' : undefined}
    className="w-[2.6ch] shrink-0 text-right text-xl font-semibold tabular-nums text-neutral-900"
  >
    {value === null ? '—' : value.toLocaleString()}
  </span>
);

/**
 * One finding row.
 *
 * A control when it has a number to stand behind, and a plain row when it does
 * not.
 */
const Finding: React.FC<{
  subCount: OrgSubCount;
  onOpen: (request: ListViewRequest) => void;
}> = ({ subCount, onOpen }) => {
  if (subCount.status === 'reading') {
    return (
      <ListRow density="compact">
        <Skeleton variant="text" size="sm" width="w-3/4" label={`Reading ${subCount.label}`} />
      </ListRow>
    );
  }

  const lines = (
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-neutral-900">{subCount.label}</span>
      {subCount.note && (
        <span
          className={`block text-xs ${
            subCount.status === 'partial' ? 'text-warning-text' : 'text-neutral-600'
          }`}
        >
          {subCount.note}
        </span>
      )}
    </span>
  );

  if (subCount.value === null) {
    return (
      <ListRow density="compact">
        <span className="flex items-center gap-3">
          <FigureNumber value={null} />
          {lines}
        </span>
      </ListRow>
    );
  }

  return (
    <ListRow
      as="button"
      density="compact"
      onClick={() => onOpen(subCount.request)}
      ariaLabel={`${subCount.value.toLocaleString()} ${subCount.label} — open the filtered list`}
    >
      <span className="flex items-center gap-3">
        <FigureNumber value={subCount.value} />
        {lines}
        <Icon type="chevron-right" size="xs" className="shrink-0 text-neutral-400" />
      </span>
    </ListRow>
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
      <div className="flex items-center justify-between gap-2">
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

      <div className="space-y-1">
        {findings.map((subCount) => (
          <Finding key={subCount.key} subCount={subCount} onOpen={onOpenListView} />
        ))}
      </div>

      {totals.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-neutral-600">
          {totals.map((box, index) => (
            <React.Fragment key={box.key}>
              {index > 0 && <span aria-hidden="true">·</span>}
              <Button variant="ghost" size="sm" onClick={() => onOpenTab(box.tab)}>
                {box.status === 'partial' ? 'at least ' : ''}
                {box.value?.toLocaleString()} {box.noun}
              </Button>
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
