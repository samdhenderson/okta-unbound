import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import OverviewTab from './OverviewTab';

/**
 * Context-aware landing tab. Now prop-driven: {@link App} resolves the live (or
 * pinned) page context and passes it in, so these stories exercise the states the
 * tab itself owns — waiting-for-context, loading, and disconnected. The populated
 * group/user overviews are covered by their own stories.
 */
const meta = {
  title: 'Overview/OverviewTab',
  component: OverviewTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Context-aware landing tab that adapts to the detected Okta page.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  args: {
    onTabChange: fn(),
    pageType: 'admin',
    groupInfo: null,
    userInfo: null,
    appInfo: null,
    connectionStatus: 'connected',
    targetTabId: 1,
    error: null,
    isLoading: false,
    oktaOrigin: 'https://example.okta.com',
    onRetry: fn(),
    onViewAllGroups: fn(),
    onExportGroup: fn(),
    onExportApp: fn(),
    onViewGroupRules: fn(),
  },
} satisfies Meta<typeof OverviewTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** On a non-entity (admin) page — the waiting-for-context guidance. */
export const WaitingForContext: Story = {};

/** Context still resolving — full-panel spinner. */
export const Loading: Story = {
  args: { isLoading: true },
};

/** No Okta tab / connection error — retry + quick-start guidance. */
export const Disconnected: Story = {
  args: {
    connectionStatus: 'error',
    error: 'Please open an Okta admin page in this window',
  },
};

/** On a detected app page — the minimal app branch with its export deep-links. */
export const AppPage: Story = {
  args: {
    pageType: 'app',
    appInfo: { appId: '0oaFAKE001', appName: 'Salesforce' },
  },
};
