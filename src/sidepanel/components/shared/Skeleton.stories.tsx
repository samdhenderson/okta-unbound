import type { Meta, StoryObj } from '@storybook/react-vite';
import Skeleton from './Skeleton';

/**
 * Shimmering placeholder for known-shape content — member lists, rule cards, stat
 * grids. For unknown-shape or unknown-duration work, keep using `LoadingSpinner`.
 */
const meta = {
  title: 'Shared/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A shimmering placeholder for content whose shape is already known.\n\n' +
          'Four shapes — `text` (a bare single line), `lineRow` (one line inside a ' +
          'bordered row, matching `PolicyRulesList`’s rule rows and `RuleLinkRow`), ' +
          '`row` (a rich list-row block matching `GroupListItem`/`MemberRow`), and ' +
          '`card` (a stat/summary card block). `lineRow` and `row` differ in how many ' +
          'elements they draw, not in padding — `row` under a one-line list is four ' +
          'times too tall and lurches when the real rows arrive. The ' +
          '`count` prop renders N repeated blocks without a loop at the call site; ' +
          'repeats share a staggered `.rise-in-stagger` entrance (capped at the 8th) ' +
          'rather than each animating independently. The visual bones are ' +
          '`aria-hidden`; one hidden `role="status"` node carries the accessible name.',
      },
    },
  },
  argTypes: {
    variant: { description: 'Placeholder shape. Defaults to `text`.' },
    size: {
      description:
        'Size scale — controls line thickness (`text`) or block padding (`lineRow`/`row`/`card`). Defaults to `md`.',
    },
    count: {
      description:
        'Number of repeated blocks to render, staggered via `.rise-in-stagger`. Defaults to `1`.',
    },
    width: {
      description:
        'Tailwind width class for the `text` variant’s line (e.g. `w-1/2`). Ignored for `lineRow`/`row`/`card`. Defaults to `w-full`.',
    },
    gap: {
      description:
        'Tailwind vertical-gap class between repeated blocks (e.g. `space-y-1.5`). Defaults to the gap the variant’s real list uses.',
    },
    label: {
      description:
        'Accessible name for the single `role="status"` node announced to assistive tech. Defaults to `"Loading"`.',
    },
    className: { description: 'Extra classes merged onto the outer wrapper.' },
  },
  args: {
    variant: 'text',
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A single text line, full width. */
export const Default: Story = {};

/** A narrower text line. */
export const TextNarrow: Story = {
  args: { width: 'w-1/2' },
};

/** One single-line bordered row, matching a `ListRow` at `compact` density. */
export const LineRow: Story = {
  args: { variant: 'lineRow' },
  parameters: { layout: 'padded' },
};

/**
 * Three staggered single-line rows — what `PolicyRulesList` shows while a
 * policy's rules load, in the list's own `space-y-2`.
 */
export const LineRowCount: Story = {
  args: { variant: 'lineRow', count: 3, label: 'Loading rules…' },
  parameters: { layout: 'padded', motion: 'on' },
};

/**
 * The same rows at `GroupRulesSection`'s tighter `space-y-1.5`, via the `gap`
 * override — a placeholder whose gap is wrong still makes the list jump.
 */
export const LineRowCustomGap: Story = {
  args: { variant: 'lineRow', count: 3, gap: 'space-y-1.5', label: 'Loading rules…' },
  parameters: { layout: 'padded' },
};

/** One list-row placeholder, matching `GroupListItem`/`MemberRow` height. */
export const Row: Story = {
  args: { variant: 'row' },
  parameters: { layout: 'padded' },
};

/** Three staggered list-row placeholders — the common "list is loading" shape. */
export const RowCount: Story = {
  args: { variant: 'row', count: 3, label: 'Loading members' },
  parameters: { layout: 'padded', motion: 'on' },
};

/** One stat/summary card placeholder, matching `StatCard`. */
export const Card: Story = {
  args: { variant: 'card' },
  parameters: { layout: 'padded' },
};

/** Four staggered stat-card placeholders — the "stat grid is loading" shape. */
export const CardCount: Story = {
  args: { variant: 'card', count: 4, label: 'Loading stats' },
  parameters: { layout: 'padded', motion: 'on' },
};

/** The three sizes side by side for the `row` variant. */
export const Sizes: Story = {
  args: { variant: 'row' },
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="space-y-3">
      <Skeleton {...args} size="sm" />
      <Skeleton {...args} size="md" />
      <Skeleton {...args} size="lg" />
    </div>
  ),
};

/**
 * The same size scale on `lineRow` — `sm`/`md` track `ListRow`'s `tight` and
 * `compact` densities, `lg` its `comfortable` one.
 */
export const LineRowSizes: Story = {
  args: { variant: 'lineRow' },
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="space-y-3">
      <Skeleton {...args} size="sm" />
      <Skeleton {...args} size="md" />
      <Skeleton {...args} size="lg" />
    </div>
  ),
};
