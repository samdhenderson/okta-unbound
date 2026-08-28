import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import OrgSnapshotCard from './OrgSnapshotCard';
import { buildFigure, type FigureSource } from './orgFigures';

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

const figures = (groups: FigureSource, apps: FigureSource, rules: FigureSource, paused: number) => [
  buildFigure('groups', 'Groups', 'users', groups),
  buildFigure('apps', 'Applications', 'app', apps),
  buildFigure('rules', 'Group rules', 'bolt', rules),
  buildFigure('paused', 'Rules paused', 'pause', rules, paused),
];

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
          'How big this org is, in four numbers — all read from the background-owned org snapshot ' +
          '(ADR-0040), so a warm org renders them at **zero requests**.\n\n' +
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
    figures: { description: 'The four figures, in display order.' },
    readAt: { description: 'Oldest finished walk, or null when there is none.' },
    onRefresh: { description: 'Force a full walk of all three collections.' },
    canRefresh: { description: 'False with no connected Okta tab.' },
  },
  args: {
    onRefresh: fn(),
    isRefreshing: false,
    canRefresh: true,
    readAt: NOW - 20 * 60 * 1000,
    figures: figures(read({ count: 214 }), read({ count: 38 }), read({ count: 61 }), 4),
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
 * A genuinely empty org. A loaded zero **is** an answer, so it renders — hiding
 * it would be the same defect as inventing one, in the other direction.
 */
export const EmptyOrg: Story = {
  args: { figures: figures(read(), read(), read(), 0) },
};

/** The first read is still in flight: skeletons, never zeroes. */
export const Reading: Story = {
  args: {
    readAt: null,
    figures: figures(
      read({ isReading: true }),
      read({ isReading: true }),
      read({ isReading: true }),
      0,
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
    figures: figures(
      read({ complete: false, lastFullWalkAt: null }),
      read({ complete: false, lastFullWalkAt: null }),
      read({ complete: false, lastFullWalkAt: null }),
      0,
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Groups have not been read yet.')).toBeInTheDocument();
    // The absence is the assertion: an invented age is worse than none.
    await expect(canvas.queryByText(/Counts as Okta reports them/)).not.toBeInTheDocument();
  },
};

/**
 * One collection's walk was interrupted. Its rows are real but incomplete, so
 * the count is marked as a floor rather than presented as the org's total — and
 * the two figures derived from it are both caveated, while groups and apps are
 * untouched.
 */
export const PartialWalk: Story = {
  args: {
    figures: figures(
      read({ count: 214 }),
      read({ count: 38 }),
      read({ count: 12, complete: false }),
      1,
    ),
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
    figures: figures(
      read({ count: 214 }),
      read({ count: 38 }),
      read({ complete: false, lastFullWalkAt: null, error: 'Failed to load from Okta' }),
      0,
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('The last read of group rules did not finish.'),
    ).toBeInTheDocument();
    await expect(canvas.queryByText(/403/)).not.toBeInTheDocument();
  },
};

/** Refresh in flight — a real, forced walk. */
export const Refreshing: Story = {
  args: { isRefreshing: true },
};

/** No Okta tab connected: the stored figures still show, Refresh cannot run. */
export const Disconnected: Story = {
  args: { canRefresh: false },
};
