import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import MemberFilterToggle from './MemberFilterToggle';

/** The "Filters" toggle beside the member search bar, with its active-count badge. */
const meta = {
  title: 'Members/MemberFilterToggle',
  component: MemberFilterToggle,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The "Filters" toggle button shown beside the member search bar, with its ' +
          'active-filter count badge.\n\n' +
          'Kept a raw `<button>` (documented §3 exception, same as `groups/GroupFilterToggle`): ' +
          'the primary-light active styling does not map cleanly onto a shared `Button` ' +
          'variant, and the funnel glyph is not in the shared `Icon` registry.',
      },
    },
  },
  argTypes: {
    showFilters: { description: 'Whether the filter panel is currently expanded.' },
    activeFilterCount: { description: 'Active-filter count shown in the badge (hidden at 0).' },
    onToggle: { description: 'Toggles the filter panel open/closed.' },
  },
  args: {
    showFilters: false,
    activeFilterCount: 0,
    onToggle: fn(),
  },
} satisfies Meta<typeof MemberFilterToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed, no active filters. */
export const Default: Story = {
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole('button', { name: 'Filters' });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    await expect(args.onToggle).toHaveBeenCalled();
  },
};

/** Panel expanded — the primary-light active treatment. */
export const Open: Story = {
  args: { showFilters: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Filters' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
};

/** Filters active while the panel is closed — the count badge carries the state. */
export const WithActiveCount: Story = {
  args: { activeFilterCount: 3 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('3')).toBeInTheDocument();
  },
};
