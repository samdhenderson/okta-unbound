import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import FilterPill from './FilterPill';

/** Small toggle pill for filter panels — active (primary) or inactive (outlined). */
const meta = {
  title: 'Shared/FilterPill',
  component: FilterPill,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    children: 'Filter label',
    onClick: fn(),
  },
} satisfies Meta<typeof FilterPill>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Inactive state — outlined. */
export const Default: Story = {
  args: { active: false },
};

/** Active state — solid primary fill. */
export const Active: Story = {
  args: { active: true },
};

/** Disabled inactive. */
export const Disabled: Story = {
  args: { active: false, disabled: true },
};

/** Disabled active. */
export const DisabledActive: Story = {
  args: { active: true, disabled: true },
};

/** With optional title tooltip. */
export const WithTitle: Story = {
  args: { active: false, title: 'Click to toggle filter' },
};

/** Two pills side by side showing active/inactive pair. */
export const ActiveInactivePair: Story = {
  args: { active: false },
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <FilterPill {...args} active={false}>
        Inactive
      </FilterPill>
      <FilterPill {...args} active={true}>
        Active
      </FilterPill>
    </div>
  ),
};

/** Hover state (forced via the pseudo-states addon). */
export const Hover: Story = {
  args: { active: false },
  parameters: { pseudo: { hover: true } },
};

/** Focus-visible state (forced via the pseudo-states addon). */
export const Focus: Story = {
  args: { active: false },
  parameters: { pseudo: { focusVisible: true } },
};
