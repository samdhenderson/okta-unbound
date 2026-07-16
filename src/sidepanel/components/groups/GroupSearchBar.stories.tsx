import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupSearchBar from './GroupSearchBar';

/** The groups search input row; swaps its bound query by search mode. */
const meta = {
  title: 'Groups/GroupSearchBar',
  component: GroupSearchBar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    searchMode: 'cached',
    liveSearchQuery: '',
    onLiveSearchQueryChange: fn(),
    searchQuery: '',
    onSearchQueryChange: fn(),
    isLiveSearching: false,
  },
} satisfies Meta<typeof GroupSearchBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Cached mode, empty query. */
export const Default: Story = {
  render: (args) => (
    <div style={{ width: 360 }}>
      <GroupSearchBar {...args} />
    </div>
  ),
};

/** Cached mode with a typed query. */
export const CachedWithQuery: Story = {
  args: { searchQuery: 'engineering' },
  render: Default.render,
};

/** Live mode, no query yet. */
export const LiveMode: Story = {
  args: { searchMode: 'live' },
  render: Default.render,
};

/** Live mode with a query and the spinner shown while the request is in flight. */
export const LiveSearching: Story = {
  args: { searchMode: 'live', liveSearchQuery: 'admins', isLiveSearching: true },
  render: Default.render,
};
