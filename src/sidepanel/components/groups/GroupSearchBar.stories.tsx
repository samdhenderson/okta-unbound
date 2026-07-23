import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupSearchBar from './GroupSearchBar';

/** The groups search input row; swaps its bound query by search mode. */
const meta = {
  title: 'Groups/GroupSearchBar',
  component: GroupSearchBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The groups search input row.\n\n' +
          'Binds to a different query depending on the search mode: `live` queries Okta ' +
          'directly (showing a trailing spinner while a request is in flight), while ' +
          '`cached` filters the already-loaded list client-side.',
      },
    },
  },
  argTypes: {
    searchMode: {
      description: '`live` queries Okta directly; `cached` filters the loaded list.',
    },
    liveSearchQuery: { description: 'Query bound in live mode.' },
    onLiveSearchQueryChange: { description: 'Fired as the live-mode query changes.' },
    searchQuery: { description: 'Query bound in cached mode.' },
    onSearchQueryChange: { description: 'Fired as the cached-mode query changes.' },
    isLiveSearching: {
      description: 'Whether a live search is in flight (shows the trailing spinner).',
    },
  },
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
