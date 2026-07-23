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
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A sort-toggle pill: a `FilterPill` that shows a directional caret when its field is the active sort, rotating it 180° for descending order.\n\n' +
          'Filter panels reuse this instead of hand-rolling a raw `<button>` + inline caret per sort field. Generic over the caller’s sort-field union so it stays type-safe. Inactive when a different field is active; filled with an up/down caret when it is the active field.',
      },
    },
  },
  argTypes: {
    field: { description: 'The sort field this pill selects.' },
    label: { description: 'Human-readable label shown on the pill.' },
    activeField: {
      description: 'The currently active sort field (the pill fills when it matches `field`).',
    },
    descending: { description: 'Whether the active sort is descending — rotates the caret 180°.' },
    onToggle: {
      description: 'Toggle this field as the sort (or flip direction if already active).',
    },
  },
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
