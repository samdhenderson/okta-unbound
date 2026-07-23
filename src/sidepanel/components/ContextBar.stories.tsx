import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ContextBar from './ContextBar';

/**
 * Slim merged context header (identity + connection + refresh + pin). Replaces the
 * old stacked ContextBanner and Overview PageHeader. Pinning freezes the panel on
 * the current entity; when the live tab moves while pinned, a hint offers to switch.
 */
const meta = {
  title: 'Sidepanel/ContextBar',
  component: ContextBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Slim, merged context header: app wordmark + entity identity + connection + refresh + pin.\n\n' +
          'Shows the `Okta Unbound · {pageType}` eyebrow, a connection dot, the detected entity name and (copyable) id, and the two global context controls. Notable states: resolving (`Loading`), a connection/context failure with a reload-tab affordance (`ErrorState`), pinned to the current entity (`Pinned`), and pinned-but-the-live-tab-moved (`PinnedLiveChanged`). Presentational — pin/refresh behaviour and the live-vs-pinned comparison are owned by the caller (App).\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Shared utilities](?path=/docs/internals-shared-utilities--docs)',
      },
    },
  },
  argTypes: {
    pageType: { description: 'Detected page type; drives the label fallback and dot colour.' },
    entityName: { description: 'Display name of the detected (or pinned) entity, if resolved.' },
    entityId: {
      description: 'Okta id of the detected (or pinned) entity; gates the id chip + copy.',
    },
    connectionStatus: { description: 'Connection state to the Okta tab.' },
    isLoading: { description: 'Whether page context is still resolving.' },
    error: { description: 'Connection/context error message, or `null` when healthy.' },
    isPinned: { description: 'Whether the panel is currently pinned to the entity.' },
    canPin: {
      description: 'Whether pinning is available right now (a group/user entity is present).',
    },
    liveContextChanged: {
      description: 'While pinned, `true` once the live Okta tab has navigated to another entity.',
    },
    liveEntityName: {
      description: 'Optional name of the live entity, shown in the switch hint when known.',
    },
    onTogglePin: { description: 'Toggle the pin on/off.' },
    onRefresh: { description: 'Re-detect the live context (disabled while pinned).' },
    onReconnect: {
      description:
        'Reload the Okta tab to re-establish the content script, then re-detect. Shown only on error.',
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
    onReconnect: fn(),
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

/** Connection/context error, with the reconnect (reload-tab) affordance. */
export const ErrorState: Story = {
  args: {
    entityName: undefined,
    entityId: undefined,
    error: 'Can’t reach the Okta tab — reload it to reconnect.',
    canPin: false,
  },
};
