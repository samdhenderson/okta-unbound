import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ContextBar from './ContextBar';

/**
 * Slim merged context header (identity + connection + refresh + pin). Replaces the
 * old stacked ContextBanner and Overview PageHeader. Pinning freezes the panel on
 * the current entity; when the live tab moves while pinned, a hint offers to switch.
 */
const meta = {
  title: 'Components/ContextBar',
  component: ContextBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Slim, merged context header: entity identity + connection + refresh + pin.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Shared utilities](?path=/docs/internals-shared-utilities--docs)',
      },
    },
  },
  args: {
    pageType: 'group',
    entityName: 'Engineering Team',
    entityId: '00g1abcd2345EFGH6789',
    connectionStatus: 'connected',
    isLoading: false,
    error: null,
    isPinned: false,
    canPin: true,
    onTogglePin: fn(),
    onRefresh: fn(),
  },
} satisfies Meta<typeof ContextBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A resolved group page, unpinned. */
export const Default: Story = {};

/** A resolved user page (accent dot). */
export const UserPage: Story = {
  args: {
    pageType: 'user',
    entityName: 'Jordan Rivera',
    entityId: '00u9zyxw8765MNOP4321',
  },
};

/** Pinned to the current group. */
export const Pinned: Story = {
  args: { isPinned: true },
};

/** Pinned, but the live tab has moved to another entity — switch hint shown. */
export const PinnedLiveChanged: Story = {
  args: { isPinned: true, liveContextChanged: true, liveEntityName: 'Finance Team' },
};

/** Nothing pinnable yet (admin/unknown page) — pin disabled. */
export const NotPinnable: Story = {
  args: {
    pageType: 'admin',
    entityName: undefined,
    entityId: undefined,
    canPin: false,
  },
};

/** Context still resolving. */
export const Loading: Story = {
  args: {
    isLoading: true,
    connectionStatus: 'connecting',
    entityName: undefined,
    entityId: undefined,
    canPin: false,
  },
};

/** Connection/context error. */
export const WithError: Story = {
  args: {
    entityName: undefined,
    entityId: undefined,
    error: 'Unable to reach Okta tab',
    canPin: false,
  },
};
