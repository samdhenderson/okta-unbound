import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import MemberSearchBar from './MemberSearchBar';

/** Search input for the member list, with a leading search icon and a clear button. */
const meta = {
  title: 'Overview/Members/MemberSearchBar',
  component: MemberSearchBar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    value: '',
    onChange: fn(),
  },
} satisfies Meta<typeof MemberSearchBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty query — placeholder text shown, no clear button. */
export const Default: Story = {};

/** Custom placeholder override. */
export const CustomPlaceholder: Story = {
  args: { placeholder: 'Search…' },
};

/** Non-empty query — the clear button appears. */
export const WithValue: Story = {
  args: { value: 'jane.doe' },
};

/** A long query still truncates/renders cleanly. */
export const LongText: Story = {
  args: { value: 'a very long search query that a user might paste into the box by mistake' },
};
