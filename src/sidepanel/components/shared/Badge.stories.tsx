import type { Meta, StoryObj } from '@storybook/react-vite';
import Badge from './Badge';

/**
 * The single home for the badge/pill recipe. Replaces eighteen hand-rolled
 * copies, one of which had rotted into class names with no CSS behind them.
 */
const meta = {
  title: 'Shared/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A small status or type mark — the one place the recipe `px-2 py-0.5 rounded-md text-xs font-medium` plus a token background/border lives.\n\n' +
          'Variants follow the shared status vocabulary (`success | warning | danger | info`, never `error` — ADR-0002), plus `neutral` for an uncolored mark and `primary` for entity type/identity. The set is a superset of `UserStatusVariant`, so `userStatusVariant(status)` drops straight into `variant` with no mapping layer.\n\n' +
          '`solid` is for the one badge on screen that must outrank its siblings; two solid badges side by side both lose.\n\n' +
          'A badge is a **label, not a control**. If it needs a click handler, use `FilterPill` or `Button`.',
      },
    },
  },
  argTypes: {
    children: {
      description: 'Badge label. Keep it to a word or two — this is a mark, not a sentence.',
    },
    variant: {
      description:
        'Colour treatment: the canonical status severities plus `neutral` (no signal) and `primary` (entity type/identity). Defaults to `neutral`.',
    },
    solid: {
      description:
        'Render the filled treatment instead of the tinted one. Reserve it for the one mark that must win.',
    },
    title: { description: 'Native `title` tooltip, for a mark whose full meaning does not fit.' },
    className: { description: 'Extra classes merged after the variant classes.' },
    testId: { description: 'Optional test handle.' },
  },
  args: {
    children: 'Active',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default, uncolored mark. */
export const Default: Story = {
  args: { variant: 'neutral', children: 'Okta group' },
};

/** Every tinted treatment, as they appear together on a row. */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="neutral">Built-in</Badge>
      <Badge variant="primary">Okta group</Badge>
      <Badge variant="info">Rule</Badge>
      <Badge variant="success">Active</Badge>
      <Badge variant="warning">Suspended</Badge>
      <Badge variant="danger">Deprovisioned</Badge>
    </div>
  ),
};

/** The filled treatment, next to the tinted marks it is meant to outrank. */
export const Solid: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="primary" solid>
        Current group
      </Badge>
      <Badge variant="primary">Okta group</Badge>
      <Badge variant="neutral">412 members</Badge>
    </div>
  ),
};

/** A mark whose full meaning does not fit, carrying the rest on `title`. */
export const WithTooltip: Story = {
  args: {
    variant: 'warning',
    children: 'App group',
    title: 'Mastered by an application, which manages its own members.',
  },
};
