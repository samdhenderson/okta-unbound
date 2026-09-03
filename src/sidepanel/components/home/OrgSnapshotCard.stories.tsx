import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import OrgSnapshotCard from './OrgSnapshotCard';
import { buildBox, buildFigure, buildSubCount, type FigureSource } from './orgFigures';

const NOW = Date.now();

/** A finished, populated read — the only shape that produces a number. */
const read = (over: Partial<FigureSource> = {}): FigureSource => ({
  isReading: false,
  complete: true,
  lastFullWalkAt: NOW - 20 * 60 * 1000,
  count: 0,
  error: null,
  ...over,
});

/** The two findings' counts, so a story can vary them independently. */
interface Slices {
  /** Row 1: rules whose status is `INACTIVE`. */
  paused: number;
  /** Row 2: groups with no members that no rule fills. */
  emptyUnfilled: number;
}

const NO_SLICES: Slices = { paused: 0, emptyUnfilled: 0 };

/**
 * The two boxes the card is built from, in row order.
 *
 * Two, not the five findings across three collections this card once carried —
 * every app-derived row was removed, because an apps walk plus a per-app
 * assignment read is the org's tightest rate budget and no row here is allowed
 * to spend one. The budget is written down in `useOrgFigures`.
 */
const boxes = (groups: FigureSource, rules: FigureSource, slices: Slices = NO_SLICES) => {
  const groupsNamed = { source: groups, noun: 'groups' };
  const rulesNamed = { source: rules, noun: 'group rules' };

  return [
    buildBox(buildFigure('rules', 'Group rules', 'bolt', rules), 'rules', 'group rules', [
      buildSubCount({
        key: 'rules-paused',
        label: 'Group rules paused',
        icon: 'pause',
        counted: rulesNamed,
        count: slices.paused,
        request: { tab: 'rules', view: 'paused' },
      }),
    ]),
    buildBox(buildFigure('groups', 'Groups', 'users', groups), 'groups', 'groups', [
      buildSubCount({
        key: 'groups-empty-unfilled',
        label: 'Groups with no members that no rule fills',
        icon: 'users',
        counted: groupsNamed,
        gates: [rulesNamed],
        count: slices.emptyUnfilled,
        request: { tab: 'groups', view: 'empty-no-rules' },
      }),
    ]),
  ];
};

const meta = {
  title: 'Home/OrgSnapshotCard',
  component: OrgSnapshotCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // heading-order disabled: the section heading renders as an `h3` out of the
    // app shell, with no `h1` above it.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'What is worth fixing in this org, as a findings list two rows long. Each row is one ' +
          'actionable count — *4 group rules paused* — and pressing it opens that tab with the ' +
          'matching filter already applied. The collection totals are a caption underneath, ' +
          'because `214 groups` is trivia and the slice of it that needs work is not.\n\n' +
          'All of it is read from the background-owned org snapshot (ADR-0040), so a warm org ' +
          'renders the whole card at **zero requests** — and that is exactly why there are two ' +
          'rows. A row has to cost no walk of its own, name a subject, have a verb at the end of ' +
          'it, and not be a superset of a sharper row. Every app-derived finding failed the ' +
          'first test: an apps walk plus a per-app assignment read is the tightest rate budget ' +
          'in the org, and it must never be spent because a tab opened.\n\n' +
          'The row anatomy is inverted from what it was: a 20px glyph leads, then the finding as ' +
          'a sentence, then the count at the trailing edge, then the chevron. The count used to ' +
          'be a `text-3xl` number on the left, which made the card a wall of digits you read ' +
          'twice — once to see the number, once to find out what it counted. It still holds the ' +
          'darkest ink and the heaviest weight in a fixed `3ch` right-aligned slot; it is simply ' +
          'no longer the biggest thing anywhere. The glyph lead matches `WorkingSetRow`’s ' +
          'exactly, so the entity rows above and the findings below read as one column.\n\n' +
          'Row 2 is computed by *subtraction* — it removes the groups some rule fills — and is ' +
          'held to a stricter bar because of it. A rule list missing half its pages does not ' +
          'under-report it; it reports every group those missing rules fill as unfilled. So the ' +
          'number is suppressed rather than published wrong, and the row keeps its place with an ' +
          'em dash and a sentence naming the missing read.\n\n' +
          'The four states below are the deliverable. `rows.length === 0` is ambiguous three ' +
          'ways at once — an empty org, a read that has not happened, and a read that failed all ' +
          'produce it — so a figure is a number **only** when its collection’s last walk ' +
          'actually finished. Everything else gets its own copy: a skeleton while reading, a ' +
          'floor when the walk was interrupted (ADR-0040 §7 forbids serving a partial as ' +
          'complete), and a recessed row with an em dash when nothing was read. Only the first ' +
          'is ever a control.\n\n' +
          'The footnote is not decoration either. A cached number with no stated age *is* a ' +
          'cached number presented as current, so the card quotes the oldest walk behind it — ' +
          'oldest, not newest, or one refreshed corner would date the whole card. With any ' +
          'collection unwalked there is no honest age, and the line says so rather than guessing.',
      },
    },
  },
  argTypes: {
    boxes: { description: 'One entry per collection: its total, and the findings drawn from it.' },
    readAt: { description: 'Oldest finished walk, or null when there is none.' },
    onRefresh: { description: 'Force a full walk of every collection behind the card.' },
    canRefresh: { description: 'False with no connected Okta tab.' },
    onOpenTab: { description: 'Open a tab unfiltered — what a total in the caption does.' },
    onOpenListView: { description: 'Open a tab filtered — what a finding does.' },
  },
  args: {
    onRefresh: fn(),
    onOpenTab: fn(),
    onOpenListView: fn(),
    isRefreshing: false,
    canRefresh: true,
    readAt: NOW - 20 * 60 * 1000,
    boxes: boxes(read({ count: 412 }), read({ count: 38 }), { paused: 4, emptyUnfilled: 31 }),
  },
} satisfies Meta<typeof OrgSnapshotCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * **State: loaded.** A warm org. Every number is exact, and none of them cost a
 * request. Both rows are controls, and each announces its count as part of its
 * name — the figure is the fact, so dropping it from the accessible name would
 * leave a screen-reader user with the sentence and not the answer.
 */
export const Warm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Group rules paused — 4' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Groups with no members that no rule fills — 31' }),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/Counts as Okta reports them/)).toBeInTheDocument();
  },
};

/**
 * A genuinely empty org — the one legitimate zero. A walked `0` **is** an
 * answer, so the row renders it rather than hiding, with the glyph in
 * `text-success-text`. It is not a control: there is nothing behind it to open.
 */
export const EmptyOrg: Story = {
  args: { boxes: boxes(read(), read()) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('0')).toHaveLength(2);
    await expect(
      canvas.queryByRole('button', { name: /Group rules paused/ }),
    ).not.toBeInTheDocument();
  },
};

/**
 * An org with exactly one of everything — the case that made the denominators
 * read *of 1 applications* (I-024). Each finding's note agrees with its own
 * number, and the singular is derived from the plural noun the collection is
 * declared with, so no call site had to restate it.
 */
export const SingleItemOrg: Story = {
  args: {
    boxes: boxes(read({ count: 1 }), read({ count: 1 }), { paused: 1, emptyUnfilled: 1 }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('of 1 group')).toBeInTheDocument();
    await expect(canvas.getByText('of 1 group rule')).toBeInTheDocument();
    await expect(canvas.queryByText(/of 1 \w+s\b/)).not.toBeInTheDocument();
  },
};

/**
 * **State: loading.** The first read is still in flight: two skeleton lines per
 * row and a `·` holding the number slot's width, so nothing widens when the
 * figure lands. Never a zero — `rows.length === 0` means three different things
 * at this moment and only one of them is "none".
 */
export const Reading: Story = {
  args: {
    readAt: null,
    boxes: boxes(read({ isReading: true }), read({ isReading: true })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status', { name: 'Reading Group rules paused' })).toBeVisible();
    await expect(canvas.queryByText('0')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /paused/ })).not.toBeInTheDocument();
  },
};

/**
 * **State: unavailable.** A cold org, nothing walked yet. Em dashes rather than
 * numbers, a sentence per row naming the read that is missing, and no age line
 * because there is no honest one to state.
 *
 * The rows stay. Dropping them would make "nothing to fix" and "nothing known"
 * look identical, which is the one thing this card may never do.
 */
export const NeverRead: Story = {
  args: {
    readAt: null,
    boxes: boxes(
      read({ complete: false, lastFullWalkAt: null }),
      read({ complete: false, lastFullWalkAt: null }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Group rules have not been read yet.')).toBeInTheDocument();
    // The card says why there is no age rather than going quiet — but it still
    // states none, which is what the rule is actually about. Nothing renders a
    // relative time, and the totals caption is absent entirely.
    await expect(canvas.getByText(/No age stated/)).toBeInTheDocument();
    await expect(canvas.queryByText(/ago/)).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /groups$/ })).not.toBeInTheDocument();
  },
};

/**
 * **State: unavailable — and the row is not a control.** The assertion that
 * matters most on this card, and one of the few a Tailwind-less headless story
 * genuinely proves: an unreadable finding offers nothing to press.
 *
 * A link into a list that would disagree with the figure is the dead control
 * ADR-0039 bans, wearing a different hat — so there is no button, no click
 * target, and no chevron, only the sentence saying which read is missing.
 */
export const UnavailableRowIsNotAControl: Story = {
  args: {
    readAt: null,
    boxes: boxes(
      read({ complete: false, lastFullWalkAt: null }),
      read({ complete: false, lastFullWalkAt: null }),
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByText('Group rules paused').closest('li');
    await expect(row).not.toBeNull();
    await expect(within(row as HTMLElement).queryByRole('button')).not.toBeInTheDocument();

    // Pressing where the control would have been does nothing at all.
    await userEvent.click(row as HTMLElement);
    await expect(args.onOpenListView).not.toHaveBeenCalled();
  },
};

/**
 * **State: partial.** The group walk was interrupted. Row 2 subtracts from the
 * rules, which read cleanly, so the count survives as a **floor** — the pages
 * that never arrived can only add more — and its note moves to `text-warning-text`
 * to say "at least". The row is still a control: every group it counted is real.
 */
export const PartialWalk: Story = {
  args: {
    boxes: boxes(read({ count: 120, complete: false }), read({ count: 38 }), {
      paused: 4,
      emptyUnfilled: 31,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('At least — the last read of groups did not finish.'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Groups with no members that no rule fills — 31' }),
    ).toBeInTheDocument();
    // The caption says it too, rather than quoting the floor as a total.
    await expect(canvas.getByRole('button', { name: 'at least 120 groups' })).toBeInTheDocument();
  },
};

/**
 * The cross-collection rule, seen from the outside. Groups walked cleanly and
 * rules were never read — so row 1 has no number of its own to state, and row 2
 * refuses to state one rather than reporting all 412 groups as unfilled.
 *
 * This is why group rules are a **gate** and not a floor: an incomplete rule
 * list does not shorten row 2's answer, it corrupts it, and there is no honest
 * label for that.
 */
export const CrossCollectionSuppressed: Story = {
  args: {
    readAt: null,
    boxes: boxes(read({ count: 412 }), read({ complete: false, lastFullWalkAt: null }), {
      paused: 0,
      emptyUnfilled: 412,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The absence is the assertion: 412 must not appear as the unfilled count,
    // and the row must not be a control.
    await expect(canvas.queryByText('412')).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: /Groups with no members/ }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByText('Needs group rules, which have not been read.'),
    ).toBeInTheDocument();
  },
};

/**
 * A finding is a control, and pressing it opens the filtered list it counted —
 * the figure and its destination are one descriptor, so they cannot disagree.
 * Row 2 states an intersection, so the view it opens is the intersection too.
 */
export const FindingOpensTheList: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Groups with no members that no rule fills — 31' }),
    );
    await expect(args.onOpenListView).toHaveBeenCalledWith({
      tab: 'groups',
      view: 'empty-no-rules',
    });
  },
};

/** The caption's totals open their tab unfiltered. */
export const TotalOpensTheTab: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '412 groups' }));
    await expect(args.onOpenTab).toHaveBeenCalledWith('groups');
  },
};

/**
 * A read that failed with no status behind it. The copy says what is known and
 * stops — claiming a permission problem on a dropped connection would be a guess
 * presented as a fact, and only a 401/403 earns that sentence.
 */
export const ReadFailed: Story = {
  args: {
    readAt: null,
    boxes: boxes(
      read({ count: 412 }),
      read({ complete: false, lastFullWalkAt: null, error: 'Failed to load from Okta' }),
      { paused: 0, emptyUnfilled: 0 },
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Group rules have not been read yet.')).toBeInTheDocument();
    await expect(canvas.queryByText(/403/)).not.toBeInTheDocument();
  },
};

/**
 * Refresh in flight — a real, forced walk. One control for the whole card, not
 * one per row: `syncSnapshot` is org-wide and coalesces concurrent callers, so a
 * per-row refresh could not refresh only that row.
 */
export const Refreshing: Story = {
  args: { isRefreshing: true },
};

/** No Okta tab connected: the stored figures still show, Refresh cannot run. */
export const Disconnected: Story = {
  args: { canRefresh: false },
};
