import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import AppOverview from './AppOverview';

/**
 * Minimal Overview branch for a detected Okta app page: identity plus the
 * app-scoped export deep-links. A foundation to grow into a richer app view.
 */
const meta = {
  title: 'Overview/AppOverview',
  component: AppOverview,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    appId: '0oaFAKE001',
    appName: 'Salesforce',
    onExport: fn(),
  },
} satisfies Meta<typeof AppOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default detected-app view with both export actions. */
export const Default: Story = {};
