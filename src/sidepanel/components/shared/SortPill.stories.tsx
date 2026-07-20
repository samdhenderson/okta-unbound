import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import SortPill from './SortPill';

/**
 * A sort-toggle pill: a {@link FilterPill} that shows a directional caret when its
 * field is the active sort, rotating it for descending order.
 */
const meta = {
  title: 'Shared/SortPill',
  component: SortPill,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    field: 'name',
    label: 'Name',
    onToggle: fn(),
  },
} satisfies Meta<typeof SortPill<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Inactive — a different field is the active sort. */
export const Inactive: Story = {
  args: { activeField: 'status', descending: false },
};

/** Active, ascending — the caret points up. */
export const ActiveAscending: Story = {
  args: { activeField: 'name', descending: false },
};

/** Active, descending — the caret rotates to point down. */
export const ActiveDescending: Story = {
  args: { activeField: 'name', descending: true },
};

/** A row of sort pills with one active field. */
export const Row: Story = {
  args: { activeField: 'name', descending: false },
  render: (args) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <SortPill {...args} field="name" label="Name" />
      <SortPill {...args} field="status" label="Status" />
      <SortPill {...args} field="factors" label="Factor count" />
    </div>
  ),
};
