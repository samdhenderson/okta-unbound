import type { Meta, StoryObj } from '@storybook/react-vite';
import CollapsibleSection from './CollapsibleSection';

/** Bordered card whose header toggles the body open/closed. */
const meta = {
  title: 'Shared/CollapsibleSection',
  component: CollapsibleSection,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    title: 'Advanced Filters',
    defaultOpen: true,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="text-sm text-neutral-600">Filter controls would go here</p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" />
          <span>Option A</span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" />
          <span>Option B</span>
        </label>
      </div>
    ),
  },
} satisfies Meta<typeof CollapsibleSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default (open). */
export const Default: Story = {};

/** Starts in closed state. */
export const Closed: Story = {
  args: {
    defaultOpen: false,
  },
};

/** With item count badge. */
export const WithItemCount: Story = {
  args: {
    itemCount: 3,
  },
};

/** Zero count badge. */
export const WithZeroCount: Story = {
  args: {
    itemCount: 0,
  },
};

/** With longer content. */
export const WithLongContent: Story = {
  args: {
    title: 'Permissions',
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['View users', 'Edit users', 'Delete users', 'Manage groups', 'View reports'].map(
          (perm) => (
            <label key={perm} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" />
              <span>{perm}</span>
            </label>
          ),
        )}
      </div>
    ),
  },
};
