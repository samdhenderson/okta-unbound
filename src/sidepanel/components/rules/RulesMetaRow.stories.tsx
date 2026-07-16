import type { Meta, StoryObj } from '@storybook/react-vite';
import RulesMetaRow from './RulesMetaRow';

/** Small metadata chips above the Rules list: API cost + cache time. */
const meta = {
  title: 'Rules/RulesMetaRow',
  component: RulesMetaRow,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    apiCost: 12,
    lastFetchTime: '2026-07-16T14:30:00.000Z',
    hasRules: true,
  },
} satisfies Meta<typeof RulesMetaRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both chips shown: request count and cache time. */
export const Default: Story = {};

/** Only the API-requests chip (no cache time known). */
export const ApiCostOnly: Story = {
  args: { lastFetchTime: null, hasRules: false },
};

/** Only the cached-time chip (cost unknown). */
export const CachedOnly: Story = {
  args: { apiCost: null },
};

/** Cache time present but no rules loaded yet — the cache chip is suppressed too. */
export const NoRulesLoaded: Story = {
  args: { apiCost: null, hasRules: false },
};

/** Nothing to show — the component renders null. */
export const Empty: Story = {
  args: { apiCost: null, lastFetchTime: null, hasRules: false },
};
