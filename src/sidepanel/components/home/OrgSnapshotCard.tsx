/**
 * @module sidepanel/components/home/OrgSnapshotCard
 * @description The Home tab's third region: what is worth fixing in this org.
 *
 * A findings list, two rows long. Each row is one actionable count — *4 group
 * rules paused* — and pressing it opens that tab with the matching filter
 * already applied. The collection totals are a caption underneath, because `214
 * groups` is trivia and the slice of it that needs work is not.
 *
 * All of it is read from the background-owned org snapshot (ADR-0040), so a warm
 * org renders the whole card at **zero requests**. Which two rows, and the four
 * tests a third would have to pass, live in
 * {@link module:sidepanel/hooks/useOrgFigures} — the budget belongs next to the
 * code that would spend it.
 *
 * ## The row reads left to right, and the number is not the subject
 *
 * A 20px glyph leads, then the finding as a sentence, then the count at the
 * trailing edge, then the chevron. The count used to be a `text-3xl` tabular
 * number occupying the left third of the row, which made the card a wall of
 * digits you had to read twice: once to see the number, once to find out what it
 * counted.
 *
 * Inverted, the sentence is what you scan and the number is what you land on.
 * It keeps the darkest ink and the heaviest weight on the card (`text-base
 * font-semibold` against a `text-sm font-medium` label) and sits in a fixed
 * `3ch` right-aligned slot, so the digits still stack into a column of their
 * own — it is simply no longer the biggest thing anywhere.
 *
 * The glyph lead is `Icon size="md"` + `gap-3` + `items-center`, deliberately
 * identical to
 * {@link module:sidepanel/components/home/WorkingSetRow}'s, so the entity rows
 * above and the findings below read as one column of rows. Their text axes
 * differ only by the `compact` → `comfortable` padding step; that is the
 * density system working, not a defect to correct with an override.
 *
 * ## A number is a place, not a fact
 *
 * `31` that leaves you to rebuild its filter by hand is a worse version of a
 * link, so every finding with something to open is a control — a real
 * `ListRow`, with its own hover border and `.press` (ADR-0046), no
 * `StretchedButton` overlay needed now that the row is a card again rather than
 * a flush `<li>` in a shared-border list.
 *
 * Three rows are **not** controls, and each says why on its own face:
 *
 * - a collection still being read (a skeleton, and the number slot holds its
 *   width so nothing widens when the figure lands);
 * - a collection that cannot support a number (an em dash, a sentence naming
 *   the missing read, and a recessed label) — a link into a list that would
 *   disagree with the figure is the dead control ADR-0039 bans, wearing a
 *   different hat;
 * - a genuine, walked **zero** (the glyph turns `text-success-text`, and there
 *   is nothing to open because there is nothing there).
 *
 * Keeping the unavailable row rather than dropping it is the whole reason this
 * reads as a findings list *plus placeholders*. "Nothing to fix" and "nothing
 * known" must not look the same.
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
 * The number slot. Fixed `3ch` and right-aligned so the digits of every row
 * stack into one column, and so the loading placeholder holds exactly the width
 * the figure will take — nothing moves horizontally when a read lands.
 */
const NUMBER_SLOT = 'shrink-0 min-w-[3ch] text-right text-base font-semibold tabular-nums';

/** Which colour the leading glyph takes, which is the row's whole state in one mark. */
function glyphTone(subCount: OrgSubCount): string {
  if (subCount.status === 'reading') return 'text-neutral-300';
  // A walked zero is an answer, and the only place on this card anything reads
  // as good news.
  if (subCount.value === 0) return 'text-success-text';
  return 'text-neutral-400';
}

/**
 * The row interior, identical in every state.
 *
 * `items-center`, never `items-start`: the glyph, the number and the chevron
 * all sit on the row midline, so a two-line label grows the row symmetrically
 * and nothing shifts horizontally.
 */
const FindingBody: React.FC<{
  subCount: OrgSubCount;
  noteId: string;
  isControl: boolean;
}> = ({ subCount, noteId, isControl }) => {
  const recessed = subCount.value === null;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Icon type={subCount.icon} size="md" className={`shrink-0 ${glyphTone(subCount)}`} />

      <div className="min-w-0 flex-1">
        {subCount.status === 'reading' ? (
          <div className="space-y-1">
            <Skeleton
              variant="text"
              size="sm"
              width="w-3/4"
              label={`Reading ${subCount.label}`}
              className="text-left"
            />
            {/* The note's placeholder. `label=""` because the line above already
                carries this row's one announcement; a second `role="status"`
                would say the same thing twice. */}
            <Skeleton variant="text" size="sm" width="w-1/2" label="" />
          </div>
        ) : (
          <>
            <p
              className={`text-pretty text-sm font-medium ${
                recessed ? 'text-neutral-600' : 'text-neutral-900'
              }`}
            >
              {subCount.label}
            </p>
            {subCount.note && (
              <p
                id={noteId}
                className={`text-xs ${
                  subCount.status === 'partial' ? 'text-warning-text' : 'text-neutral-600'
                }`}
              >
                {subCount.note}
              </p>
            )}
          </>
        )}
      </div>

      <span
        className={`${NUMBER_SLOT} ${recessed ? 'text-neutral-400' : 'text-neutral-900'}`}
        // The em dash and the loading placeholder are shape, not content — the
        // note beside them is the sentence that carries the meaning.
        aria-hidden={subCount.value === null ? 'true' : undefined}
      >
        {subCount.status === 'reading' ? '·' : (subCount.value?.toLocaleString() ?? '—')}
      </span>

      {isControl ? (
        <Icon type="chevron-right" size="xs" className="shrink-0 text-neutral-400" />
      ) : (
        // Holds the chevron's 12px so the number column stays aligned between a
        // row you can open and one you cannot. Drawing a chevron on a row that
        // opens nothing would be the lie; leaving a ragged column is a
        // different, smaller one.
        <span aria-hidden="true" className="w-3 shrink-0" />
      )}
    </div>
  );
};

/** One finding row: a `ListRow` card, a control only when there is something to open. */
const Finding: React.FC<{
  subCount: OrgSubCount;
  onOpen: (request: ListViewRequest) => void;
}> = ({ subCount, onOpen }) => {
  const noteId = `org-finding-note-${subCount.key}`;
  // A zero is a real answer with nothing behind it, and a `null` has nothing to
  // stand behind at all. Neither may be a control.
  const isControl = subCount.value !== null && subCount.value > 0;

  if (!isControl) {
    return (
      <ListRow as="li" density="comfortable">
        <FindingBody subCount={subCount} noteId={noteId} isControl={false} />
      </ListRow>
    );
  }

  return (
    <li>
      {/*
        `as="button"` rather than a `<li>` with an `onClick`: the row is the
        click target, and a click target has to be reachable from the keyboard
        and announce itself as a control. `ListRow` supplies the focus ring and
        `.press` for it. The accessible name carries the number as well as the
        sentence — the count is the fact, and a name of "Group rules paused"
        alone would drop it — and `describedBy` adds the note, which is where a
        partial walk says so.
      */}
      <ListRow
        as="button"
        density="comfortable"
        onClick={() => onOpen(subCount.request)}
        ariaLabel={`${subCount.label} — ${subCount.value?.toLocaleString()}`}
        describedBy={subCount.note ? noteId : undefined}
      >
        <FindingBody subCount={subCount} noteId={noteId} isControl />
      </ListRow>
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

      {/*
        Cards with a gap, not one bordered container with `divide-y`. Two rows
        do not make a table-like surface, and as cards they carry `ListRow`'s
        own hover border and press response instead of a hand-rolled row
        treatment (ADR-0029).
      */}
      <ul className="space-y-1">
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
                `Button` here would put chunky pills under a dense list and
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
