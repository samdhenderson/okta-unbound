import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import MemberSearchBar from './MemberSearchBar';

/** Search input for the member list, with a leading search icon and a clear button. */
const meta = {
  title: 'Overview/Members/MemberSearchBar',
  component: MemberSearchBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Search input for the member list, with a leading search icon and a clear button.\n\n' +
          'A thin controlled wrapper over the shared `Input`; the parent ' +
          '(`MemberExplorer`) owns the value and debounces it before filtering. A clear ' +
          'button appears only when the query is non-empty.',
      },
    },
  },
  argTypes: {
    value: { description: 'Current query text (controlled).' },
    onChange: { description: 'Called with the new query on each change / clear.' },
    placeholder: { description: 'Optional placeholder override.' },
  },
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
