import type { Meta, StoryObj } from '@storybook/react-vite';
import ContextBanner from './ContextBanner';

/**
 * Header banner summarising the Okta entity detected on the active tab —
 * shows name/id, a loading/connected/error indicator, and an "Edit in Okta"
 * deep link, with colours derived from the detected page type.
 */
const meta = {
  title: 'Components/ContextBanner',
  component: ContextBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Banner summarising the Okta entity detected on the active tab.\n\n' +
          '**Related internals:** [Shared utilities](?path=/docs/internals-shared-utilities--docs)',
      },
    },
  },
  args: {
    pageType: 'group',
    entityName: 'Engineering Team',
    entityId: '00g1abcd2345EFGH6789',
    isLoading: false,
    error: null,
  },
} satisfies Meta<typeof ContextBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A resolved group page, with the "Edit in Okta" deep link visible. */
export const Default: Story = {};

/** A resolved user page — accent colour scheme. */
export const UserPage: Story = {
  args: {
    pageType: 'user',
    entityName: 'Jordan Rivera',
    entityId: '00u9zyxw8765MNOP4321',
  },
};

/** A resolved app page — success colour scheme. */
export const AppPage: Story = {
  args: {
    pageType: 'app',
    entityName: 'Salesforce',
    entityId: '0oa5qrst1122UVWX3344',
  },
};

/** The org-wide admin overview page — no edit link, neutral colour scheme. */
export const AdminOverview: Story = {
  args: {
    pageType: 'admin',
    entityName: undefined,
    entityId: undefined,
  },
};

/** Page context is still being resolved. */
export const Loading: Story = {
  args: {
    isLoading: true,
    entityName: undefined,
    entityId: undefined,
  },
};

/** A group page with no entity resolved yet — contextual guidance shown. */
export const NoEntitySelected: Story = {
  args: {
    entityName: undefined,
    entityId: undefined,
  },
};

/** Connection/context error — overrides the name and id display. */
export const WithError: Story = {
  args: {
    entityName: undefined,
    entityId: undefined,
    error: 'Unable to reach Okta tab',
  },
};
