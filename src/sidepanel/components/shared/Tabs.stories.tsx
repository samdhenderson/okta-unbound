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

/** Accessible tab bar with `underline` and `segmented` variants. */
const meta = {
  title: 'Shared/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
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
