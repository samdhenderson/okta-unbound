import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import StatCard from './StatCard';
import Button from './Button';

/**
 * Single metric tile (title, value, optional icon) used in the Overview stat grids.
 */
const meta = {
  title: 'Shared/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Single metric tile — an uppercase title, a large value, and an optional ' +
          'top-right icon — used to build the Overview stat grids.\n\n' +
          'Presentational only. Numeric values are localized with thousands separators; ' +
          'string values render verbatim. The `color` prop selects a semantic icon/border ' +
          'token set (`primary`, `success`, `warning`, `danger`, `neutral`). Passing ' +
          '`onClick` turns the whole card into a real button — `role="button"`, a tab ' +
          'stop, Enter/Space, and the shared `.press` depress + `.lift` hover elevation ' +
          '(ADR-0046/ADR-0047).\n\n' +
          'A card can opt into `countUp`, which interpolates a numeric value up to its ' +
          'figure over `--dur-tell` when it first resolves and whenever it changes — the ' +
          'motion that says "this number just arrived" rather than "this was always here". ' +
          'It never fires on an incidental re-render, and is instant under ' +
          '`prefers-reduced-motion`. The value is always rendered with `tabular-nums`, so ' +
          'the card cannot twitch as the digits change. The same opt-in also tints the ' +
          'settled figure `text-success-text` for a beat, easing back over `--dur-tell` — ' +
          'a refreshed number that silently swapped is a missed event.',
      },
    },
  },
  argTypes: {
    title: { description: 'Uppercase label above the value.' },
    value: { description: 'The metric; numbers are rendered with thousands separators.' },
    color: {
      description:
        'Semantic color, selecting the icon and border token set; defaults to `neutral`.',
    },
    icon: { description: 'Optional icon shown at the top-right.' },
    subtitle: { description: 'Optional caption below the value.' },
    onClick: { description: 'When provided, makes the card a clickable button.' },
    countUp: {
      description:
        'Count a numeric value up to its figure over `--dur-tell` when it resolves or changes. Ignored for string values; instant under reduced motion.',
    },
  },
  args: {
    title: 'Active Users',
    value: 1250,
    onClick: fn(),
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default card with numeric value. */
export const Default: Story = {};

/** String value (no localization). */
export const StringValue: Story = {
  args: {
    value: 'N/A',
  },
};

/** With subtitle. */
export const WithSubtitle: Story = {
  args: {
    subtitle: 'Last updated today',
  },
};

/** With icon. */
export const WithIcon: Story = {
  args: {
    icon: 'users',
  },
};

/** Primary color variant. */
export const Primary: Story = {
  args: {
    color: 'primary',
    icon: 'bolt',
  },
};

/** Success color variant. */
export const Success: Story = {
  args: {
    color: 'success',
    title: 'Completed Tasks',
    value: 42,
    icon: 'check',
  },
};

/** Warning color variant. */
export const Warning: Story = {
  args: {
    color: 'warning',
    title: 'Pending Reviews',
    value: 8,
    icon: 'alert',
  },
};

/** Danger color variant. */
export const ErrorState: Story = {
  args: {
    color: 'danger',
    title: 'Failed Requests',
    value: 3,
    icon: 'alert',
  },
};

/**
 * Clickable card — a real activatable button (`role="button"`, a tab stop,
 * Enter/Space), not a mouse-only `onClick` on a `<div>`.
 */
export const Clickable: Story = {
  args: {
    title: 'Click me',
    value: 999,
    icon: 'chart',
  },
};

/**
 * Hover state of a clickable card (forced via the pseudo-states addon): the
 * border darkens and `.lift` cross-fades in its shadow.
 */
export const ClickableHover: Story = {
  ...Clickable,
  parameters: { pseudo: { hover: true } },
};

/** Focus-visible state of a clickable card (forced via the pseudo-states addon). */
export const ClickableFocus: Story = {
  ...Clickable,
  parameters: { pseudo: { focusVisible: true } },
};

/**
 * Pressed state of a clickable card (forced via the pseudo-states addon):
 * `.press`'s `scale(.955)` depress plus `active:brightness-90` (ADR-0046).
 */
export const ClickablePressed: Story = {
  ...Clickable,
  parameters: { pseudo: { active: true } },
};

/** Large number with thousands separator. */
export const LargeNumber: Story = {
  args: {
    title: 'Total Records',
    value: 1234567,
    color: 'primary',
  },
};

/**
 * `countUp` motion showcase: the figure counts from zero over `--dur-tell` on an
 * ease-out curve, the way a stat card behaves the moment its data resolves.
 *
 * Motion is opted back **on** for this story (the global decorator switches it off
 * everywhere else so the story suite stays deterministic), so it deliberately
 * carries no `play` function.
 */
export const CountUp: Story = {
  parameters: { motion: 'on' },
  args: {
    title: 'Total Members',
    value: 4820,
    color: 'primary',
    icon: 'users',
    countUp: true,
  },
};

/** Harness for {@link Refreshed} — owns the value so a click can genuinely change it. */
const RefreshDemo: React.FC<React.ComponentProps<typeof StatCard>> = (args) => {
  const [value, setValue] = useState(4820);
  return (
    <div className="flex flex-col items-start gap-3">
      <StatCard {...args} value={value} />
      <Button size="sm" onClick={() => setValue((v) => v + 137)}>
        Refresh
      </Button>
    </div>
  );
};

/**
 * A value that changes *after* mount — a refresh, not merely the initial resolve.
 * `justResolved` (ADR-0046) only lights up on a genuine change, never on mount, so
 * this is the shape that shows the `text-success-text` tint the `CountUp` story
 * above cannot: it mounts already resolved, with nothing yet to compare against.
 *
 * Motion is opted back on, same as `CountUp`, so click "Refresh" to watch the
 * figure count to its new value while tinted green, then ease back to neutral.
 */
export const Refreshed: Story = {
  parameters: { motion: 'on' },
  render: (args) => <RefreshDemo {...args} />,
  args: {
    title: 'Total Members',
    color: 'primary',
    icon: 'users',
    countUp: true,
  },
};

/**
 * The same card with motion suppressed — `countUp` is a no-op and the figure is
 * correct on the first painted frame. This is what every reduced-motion user sees.
 */
export const CountUpReducedMotion: Story = {
  args: {
    title: 'Total Members',
    value: 4820,
    color: 'primary',
    icon: 'users',
    countUp: true,
  },
};
