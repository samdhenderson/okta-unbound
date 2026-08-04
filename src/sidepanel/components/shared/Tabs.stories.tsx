import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import Tabs, { type TabItem, type TabsVariant } from './Tabs';

const SECTION_TABS: TabItem[] = [
  { key: 'account', label: 'Account' },
  { key: 'org', label: 'Org' },
  { key: 'contact', label: 'Contact' },
  { key: 'custom', label: 'Custom', count: 7 },
  { key: 'all', label: 'All' },
];

const COMPOSITION_TABS: TabItem[] = [
  { key: 'attrs', label: 'Attributes', count: 9 },
  { key: 'mfa', label: 'MFA factors' },
];

/** The side panel's real top-level sections — the rail's reason for existing. */
const RAIL_TABS: TabItem[] = [
  { key: 'overview', label: 'Overview', icon: 'chart' },
  { key: 'users', label: 'Users', icon: 'user' },
  { key: 'groups', label: 'Groups', icon: 'users' },
  { key: 'apps', label: 'Apps', icon: 'app' },
  { key: 'rules', label: 'Rules', icon: 'bolt' },
  { key: 'policies', label: 'Policies', icon: 'shield' },
  { key: 'export', label: 'Export', icon: 'download' },
  { key: 'history', label: 'History', icon: 'clipboard' },
];

/** Accessible tab bar with `underline`, `segmented` and `rail` variants. */
const meta = {
  title: 'Shared/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Accessible tab bar with `underline`, `segmented` and `rail` variants.\n\n' +
          'Renders the tab strip only — callers own the panels and toggle them on the active key. Implements the ARIA tablist pattern (`role="tablist"`/`role="tab"`, `aria-selected`, roving `tabindex`) with Left/Right/Home/End keyboard navigation and automatic activation. Tabs may carry an optional count badge.\n\n' +
          "The `rail` variant is icon-first: inactive tabs show only their glyph and the active tab's label unfurls beside it, so many sections fit a narrow panel. It stays horizontally scrollable with edge fades, scrolls the active tab into view, and slides an indicator underneath. Every rail tab carries its label as `aria-label`, so an icon-only tab still has an accessible name.\n\n" +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  argTypes: {
    tabs: { description: 'Tabs to render, in display order.' },
    activeKey: { description: 'Key of the currently selected tab.' },
    onChange: { description: 'Invoked with the newly selected tab key.' },
    variant: {
      description:
        '`underline` (default) for section navigation; `segmented` for compact toggles; `rail` for icon-first navigation in a narrow panel.',
    },
    ariaLabel: { description: 'Accessible label for the tablist (e.g. “User profile sections”).' },
    className: { description: 'Extra classes merged onto the tablist container.' },
  },
  args: {
    tabs: SECTION_TABS,
    activeKey: 'account',
    onChange: () => {},
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Controlled wrapper so the tabs actually switch in the story. */
const ControlledTabs = ({
  tabs,
  initial,
  variant,
  width,
}: {
  tabs: TabItem[];
  initial: string;
  variant: TabsVariant;
  width: number;
}) => {
  const [active, setActive] = useState(initial);
  return (
    <div style={{ width }}>
      <Tabs
        tabs={tabs}
        activeKey={active}
        onChange={setActive}
        variant={variant}
        ariaLabel="Demo"
      />
      <p className="text-sm text-neutral-600" style={{ padding: 12 }}>
        Active: <strong>{active}</strong>
      </p>
    </div>
  );
};

/** Underline variant — section navigation inside a card. */
export const Underline: Story = {
  render: () => (
    <ControlledTabs tabs={SECTION_TABS} initial="account" variant="underline" width={340} />
  ),
};

/** Segmented variant — compact two-way toggle. */
export const Segmented: Story = {
  render: () => (
    <ControlledTabs tabs={COMPOSITION_TABS} initial="attrs" variant="segmented" width={260} />
  ),
};

/**
 * Rail variant — eight sections in a 360px panel. Only the active label is
 * unfurled; click through to watch the next one grow as the previous collapses.
 */
export const Rail: Story = {
  render: () => <ControlledTabs tabs={RAIL_TABS} initial="overview" variant="rail" width={360} />,
};

/**
 * The rail with motion enabled, to review the label unfurl and the indicator
 * slide at their real duration (`--dur-move`). No `play` function — an
 * interaction would race the animation.
 */
export const RailMotion: Story = {
  parameters: { motion: 'on' },
  render: () => <ControlledTabs tabs={RAIL_TABS} initial="groups" variant="rail" width={360} />,
};

/** Rail at a comfortable width, where the whole strip fits and no edge fades. */
export const RailWide: Story = {
  render: () => <ControlledTabs tabs={RAIL_TABS} initial="history" variant="rail" width={720} />,
};
