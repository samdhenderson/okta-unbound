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

/** Counts for the sub-counts, so a story can vary them independently. */
interface Slices {
  empty: number;
  unruled: number;
  inactive: number;
  idlePush: number;
  paused: number;
}

const NO_SLICES: Slices = { empty: 0, unruled: 0, inactive: 0, idlePush: 0, paused: 0 };

const boxes = (
  groups: FigureSource,
  apps: FigureSource,
  rules: FigureSource,
  appGroups: FigureSource,
  slices: Slices = NO_SLICES,
) => {
  const groupsNamed = { source: groups, noun: 'groups' };
  const appsNamed = { source: apps, noun: 'applications' };
  const rulesNamed = { source: rules, noun: 'group rules' };
  const appGroupsNamed = { source: appGroups, noun: 'app group assignments' };

  return [
    buildBox(buildFigure('groups', 'Groups', 'users', groups), 'groups', 'groups', [
      buildSubCount({
        key: 'groups-empty',
        label: 'Groups with no members',
        counted: groupsNamed,
        count: slices.empty,
        request: { tab: 'groups', view: 'empty' },
      }),
      buildSubCount({
        key: 'groups-unruled',
        label: 'Groups no rule fills',
        counted: groupsNamed,
        gates: [rulesNamed],
        count: slices.unruled,
        request: { tab: 'groups', view: 'no-rules' },
      }),
    ]),
    buildBox(buildFigure('apps', 'Applications', 'app', apps), 'apps', 'applications', [
      buildSubCount({
        key: 'apps-inactive',
        label: 'Deactivated applications',
        counted: appsNamed,
        count: slices.inactive,
        request: { tab: 'apps', view: 'inactive' },
      }),
      buildSubCount({
        key: 'apps-idle-push',
        label: 'Push apps pushing nothing',
        counted: appsNamed,
        gates: [appGroupsNamed],
        count: slices.idlePush,
        request: { tab: 'apps', view: 'pushes-nothing' },
      }),
    ]),
    buildBox(buildFigure('rules', 'Group rules', 'bolt', rules), 'rules', 'group rules', [
      buildSubCount({
        key: 'rules-paused',
        label: 'Paused group rules',
        counted: rulesNamed,
        count: slices.paused,
        request: { tab: 'rules', view: 'paused' },
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
          'What is worth fixing in this org, as a findings list. Each row is one actionable ' +
          'count — *31 groups with no members* — and pressing it opens that tab with the ' +
          'matching filter already applied. The collection totals are a caption underneath, ' +
          'because `214 groups` is trivia and the slice of it that needs work is not.\n\n' +
          'All of it is read from the background-owned org snapshot (ADR-0040), so a warm org ' +
          'renders the whole card at **zero requests**.\n\n' +
          'Two findings are computed by *subtraction* — "no rule fills" removes the groups some ' +
          'rule targets, "pushing nothing" removes the apps with a stored assignment — and those ' +
          'are held to a stricter bar. A rule list missing half its pages does not under-report; ' +
          'it reports every group those missing rules fed as unfilled. So the number is ' +
          'suppressed rather than published wrong, and the row keeps its place with an em dash ' +
          'and a sentence naming the missing read.\n\n' +
          'The states below are the deliverable. `rows.length === 0` is ambiguous three ways at ' +
          'once — an empty org, a read that has not happened, and a read that failed all produce ' +
          'it — so a figure is a number **only** when its collection’s last walk actually ' +
          'finished. Everything else gets its own copy: a skeleton while reading, a floor when the ' +
          'walk was interrupted (ADR-0040 §7 forbids serving a partial as complete), and a plain ' +
          'sentence when nothing was read.\n\n' +
          'The footnote is not decoration either. A cached number with no stated age *is* a cached ' +
          'number presented as current, so the card quotes the oldest walk behind it — oldest, not ' +
          'newest, or one refreshed corner would date the whole card. With any collection unwalked ' +
          'there is no honest age, and the line is omitted rather than guessed.',
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
    boxes: boxes(
      read({ count: 214 }),
      read({ count: 38 }),
      read({ count: 61 }),
      read({ count: 90 }),
      {
        empty: 31,
        unruled: 18,
        inactive: 4,
        idlePush: 2,
        paused: 4,
      },
    ),
  },
} satisfies Meta<typeof OrgSnapshotCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A warm org. Every number is exact, and none of them cost a request. */
export const Warm: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Counts as Okta reports them/),
    ).toBeInTheDocument();
  },
};

/**
 * A genuinely empty org. A loaded zero **is** an answer, so every row renders a
 * `0` — hiding them would be the same defect as inventing a number, in the
 * other direction.
 */
export const EmptyOrg: Story = {
  args: { boxes: boxes(read(), read(), read(), read()) },
};

/**
 * An org with exactly one of everything — the case that made the denominators
 * read *of 1 applications* (I-024). Each finding's note agrees with its own
 * number, and the singular is derived from the plural noun the collection is
 * declared with, so no call site had to restate it.
 *
 * The totals caption underneath still says `1 groups`: it names the collection
 * rather than a count of anything, and it is rendered by the card, not by the
 * findings builder this story exercises.
 */
export const SingleItemOrg: Story = {
  args: {
    boxes: boxes(read({ count: 1 }), read({ count: 1 }), read({ count: 1 }), read({ count: 1 }), {
      empty: 1,
      unruled: 1,
      inactive: 1,
      idlePush: 1,
      paused: 1,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('of 1 group')).toHaveLength(2);
    await expect(canvas.getAllByText('of 1 application')).toHaveLength(2);
    await expect(canvas.getByText('of 1 group rule')).toBeInTheDocument();
    await expect(canvas.queryByText(/of 1 \w+s\b/)).not.toBeInTheDocument();
  },
};

/** The first read is still in flight: a skeleton per row, never a zero. */
export const Reading: Story = {
  args: {
    readAt: null,
    boxes: boxes(
      read({ isReading: true }),
      read({ isReading: true }),
      read({ isReading: true }),
      read({ isReading: true }),
    ),
  },
};

/**
 * A cold org, nothing walked yet. No numbers at all — and no age line, because
 * there is no honest one to state.
 */
export const NeverRead: Story = {
  args: {
    readAt: null,
    boxes: boxes(
      read({ complete: false, lastFullWalkAt: null }),
      read({ complete: false, lastFullWalkAt: null }),
      read({ complete: false, lastFullWalkAt: null }),
      read({ complete: false, lastFullWalkAt: null }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Groups have not been read yet.')).toBeInTheDocument();
    // The card says why there is no age rather than going quiet — but it still
    // states none, which is what the rule is actually about. Nothing renders a
    // relative time, and the totals caption is absent entirely.
    await expect(canvas.getByText(/No age stated/)).toBeInTheDocument();
    await expect(canvas.queryByText(/ago/)).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /groups$/ })).not.toBeInTheDocument();
  },
};

/**
 * One collection's walk was interrupted. Its rows are real but incomplete, so
 * its own findings are marked as a floor rather than presented as totals, its
 * caption entry reads "at least", and the finding that *subtracts* from it is
 * suppressed outright.
 */
export const PartialWalk: Story = {
  args: {
    boxes: boxes(
      read({ count: 214 }),
      read({ count: 38 }),
      read({ count: 12, complete: false }),
      read({ count: 90 }),
      { empty: 31, unruled: 18, inactive: 4, idlePush: 2, paused: 1 },
    ),
  },
};

/**
 * The cross-collection rule, seen from the outside. Groups walked cleanly and
 * rules were never read — so the *groups* headline and its "empty" slice are
 * both exact, while "no rules" refuses to state a number rather than reporting
 * all 214 groups as unfed.
 */
export const CrossCollectionSuppressed: Story = {
  args: {
    readAt: null,
    boxes: boxes(
      read({ count: 214 }),
      read({ count: 38 }),
      read({ complete: false, lastFullWalkAt: null }),
      read({ count: 90 }),
      { empty: 31, unruled: 214, inactive: 4, idlePush: 2, paused: 0 },
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('31')).toBeInTheDocument();
    // The absence is the assertion, and it is one of the few things a
    // Tailwind-less headless story genuinely proves: 214 must not appear as the
    // unfilled count, and the row must not be a control.
    await expect(
      canvas.queryByRole('button', { description: /Groups no rule fills/ }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByText('Needs group rules, which have not been read.'),
    ).toBeInTheDocument();
  },
};

/**
 * A finding is a control, and pressing it opens the filtered list it counted —
 * the figure and its destination are one descriptor, so they cannot disagree.
 */
export const FindingOpensTheList: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Named generically and described by its own row — StretchedButton's
    // documented contract, since every overlay in a list carries the same label.
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Open the filtered list',
        description: /Groups with no members/,
      }),
    );
    await expect(args.onOpenListView).toHaveBeenCalledWith({ tab: 'groups', view: 'empty' });
  },
};

/** The caption's totals open their tab unfiltered. */
export const TotalOpensTheTab: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '214 groups' }));
    await expect(args.onOpenTab).toHaveBeenCalledWith('groups');
  },
};

/**
 * A read that failed. The copy says what is known and stops — the design's
 * literal 403 line cannot be earned, because request status is dropped between
 * the scheduler and the panel, and claiming a permission problem on a dropped
 * connection would be a guess presented as a fact.
 */
export const ReadFailed: Story = {
  args: {
    readAt: null,
    boxes: boxes(
      read({ count: 214 }),
      read({ count: 38 }),
      read({ complete: false, lastFullWalkAt: null, error: 'Failed to load from Okta' }),
      read({ count: 90 }),
      { empty: 31, unruled: 0, inactive: 4, idlePush: 2, paused: 0 },
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
