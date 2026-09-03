import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import ComparisonTabBar from './ComparisonTabBar';
import type { TabKey } from './comparisonAnalytics';

/** Tab bar (Overview / Groups / Apps / Attributes) with per-tab diff-count badges. */
const meta = {
  title: 'Users/Comparison/ComparisonTabBar',
  component: ComparisonTabBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Tab bar (Overview / Groups / Apps / Attributes) for the comparison surface, with per-tab diff-count badges.\n\n' +
          "Shared `Tabs` in its `segmented` variant: the Groups, Apps and Attributes tabs carry a pill badge showing the number of differing items, hidden when the count is 0 (`countDisplay: 'nonzero'`). Purely presentational — selection and diff counts are supplied by the parent.\n\n" +
          'It used to be a hand-rolled `role="tablist"`, forked from that variant for its icons and its second row. The fork left the keyboard behind: no roving `tabindex`, no arrow keys. Both reasons for the fork are capabilities of the primitive now, so the strip is keyboard-navigable for free — see **KeyboardNavigation** below.\n\n' +
          "The bar is a **two-column grid below 640px** (`Tabs`' `wrap`) and one equal-width row above it: four tabs of icon + label do not fit on one line in a 360px side panel, and the alternatives were truncating a label or dropping the glyphs.",
      },
    },
  },
  args: {
    activeTab: 'overview',
    onChange: fn(),
    groupDiff: 0,
    appDiff: 0,
    attributeDiff: 0,
  },
  argTypes: {
    activeTab: { description: 'Currently selected tab.' },
    onChange: { description: 'Invoked with the newly selected tab key.' },
    groupDiff: {
      description:
        'Number of differing groups, shown as a badge on the Groups tab (hidden when 0).',
    },
    appDiff: {
      description: 'Number of differing apps, shown as a badge on the Apps tab (hidden when 0).',
    },
    attributeDiff: {
      description:
        'Number of differing attributes the display config makes visible, shown as a badge on the Attributes tab (hidden when 0).',
    },
  },
} satisfies Meta<typeof ComparisonTabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Overview tab selected, no diff badges. */
export const Default: Story = {};

/** Groups tab selected. */
export const GroupsActive: Story = {
  args: { activeTab: 'groups' },
};

/** Apps tab selected. */
export const AppsActive: Story = {
  args: { activeTab: 'apps' },
};

/** Attributes tab selected — the fourth dimension of the comparison. */
export const AttributesActive: Story = {
  args: { activeTab: 'attributes' },
};

/** Non-zero diff counts render badges on the Groups, Apps and Attributes tabs. */
export const WithDiffBadges: Story = {
  args: { groupDiff: 3, appDiff: 12, attributeDiff: 4 },
};

/** Large diff counts still fit within the pill badge. */
export const LargeDiffCounts: Story = {
  args: { activeTab: 'groups', groupDiff: 128, appDiff: 999, attributeDiff: 42 },
};

/**
 * The compact side panel, which is what made the fourth tab a layout question:
 * four icon+label tabs need roughly 440px on one line and have about 330px, so
 * the bar wraps to two rows rather than truncating "Attributes" or dropping the
 * glyphs.
 */
export const CompactPanel: Story = {
  args: { activeTab: 'attributes', groupDiff: 3, appDiff: 12, attributeDiff: 4 },
  parameters: { layout: 'padded', viewport: { value: 'sidepanelCompact' } },
};

/** Controlled wrapper, so the keyboard story can actually change the selection. */
const ControlledTabBar = ({ initial }: { initial: TabKey }) => {
  const [active, setActive] = useState<TabKey>(initial);
  return (
    <div style={{ width: 480 }}>
      <ComparisonTabBar
        activeTab={active}
        onChange={setActive}
        groupDiff={3}
        appDiff={12}
        attributeDiff={4}
      />
    </div>
  );
};

/**
 * The reason this bar is no longer hand-rolled. A tablist is one tab stop, and
 * the arrow keys move inside it: Right/Left step and wrap, Home and End jump to
 * the ends, and each of them both selects the tab **and** takes focus to it —
 * the WAI-ARIA tabs pattern with automatic activation.
 */
export const KeyboardNavigation: Story = {
  render: () => <ControlledTabBar initial="overview" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const overview = canvas.getByRole('tab', { name: 'Overview' });
    const groups = canvas.getByRole('tab', { name: /Groups/ });
    const attributes = canvas.getByRole('tab', { name: /Attributes/ });

    // Only the selected tab is in the page's tab order; Tab reaches the strip once.
    await expect(overview).toHaveAttribute('tabindex', '0');
    await expect(groups).toHaveAttribute('tabindex', '-1');

    overview.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(groups).toHaveFocus();
    await expect(groups).toHaveAttribute('aria-selected', 'true');
    await expect(overview).toHaveAttribute('aria-selected', 'false');

    await userEvent.keyboard('{ArrowLeft}');
    await expect(overview).toHaveFocus();
    await expect(overview).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{End}');
    await expect(attributes).toHaveFocus();
    await expect(attributes).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{Home}');
    await expect(overview).toHaveFocus();
    await expect(overview).toHaveAttribute('aria-selected', 'true');

    // From the first tab, ArrowLeft wraps to the last.
    await userEvent.keyboard('{ArrowLeft}');
    await expect(attributes).toHaveFocus();
    await expect(attributes).toHaveAttribute('aria-selected', 'true');
  },
};
