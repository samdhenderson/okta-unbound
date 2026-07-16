import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import OverviewTab from './OverviewTab';

/**
 * Context-aware landing tab; without a live Okta tab connection (as in
 * Storybook) it settles into its disconnected retry/quick-start state.
 */
const meta = {
  title: 'Components/OverviewTab',
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
  },
} satisfies Meta<typeof OverviewTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No Okta tab detected in this window — shows the retry + quick-start guidance. */
export const Default: Story = {};
