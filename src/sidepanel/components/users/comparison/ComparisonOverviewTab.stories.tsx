import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ComparisonOverviewTab from './ComparisonOverviewTab';
import { mockGroup } from '../../../../test/mocks/handlers';
import type { OktaGroup } from '../../../../shared/types';
import type { AppEntry } from './comparisonAnalytics';

const makeGroup = (id: string, name: string): OktaGroup => ({
  ...mockGroup,
  id,
  profile: { ...mockGroup.profile, name },
});

const groupBuckets = {
  onlyCompared: [makeGroup('g1', 'Engineering - Platform'), makeGroup('g2', 'VPN Access')],
  shared: [makeGroup('g3', 'All Employees')],
  onlyContext: [makeGroup('g4', 'Finance Approvers')],
};

const appBuckets: {
  onlyCompared: AppEntry[];
  shared: AppEntry[];
  onlyContext: AppEntry[];
} = {
  onlyCompared: [{ id: 'a1', label: 'Salesforce' }],
  shared: [
    { id: 'a2', label: 'Slack' },
    { id: 'a3', label: 'Google Workspace' },
  ],
  onlyContext: [],
};

/** Summary tab with two proportion cards (groups + apps) and jump-to-detail links. */
const meta = {
  title: 'Users/Comparison/ComparisonOverviewTab',
  component: ComparisonOverviewTab,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    contextName: 'Jane Doe',
    comparedName: 'John Smith',
    groupBuckets,
    appBuckets,
    groupSimilarity: 33,
    appSimilarity: 67,
    onJumpToGroups: fn(),
    onJumpToApps: fn(),
  },
} satisfies Meta<typeof ComparisonOverviewTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default overview with a mix of shared and unique groups/apps. */
export const Default: Story = {};

/** Perfect overlap on both groups and apps. */
export const FullOverlap: Story = {
  args: {
    groupBuckets: { onlyCompared: [], shared: groupBuckets.shared, onlyContext: [] },
    appBuckets: { onlyCompared: [], shared: appBuckets.shared, onlyContext: [] },
    groupSimilarity: 100,
    appSimilarity: 100,
  },
};

/** No overlap at all between the two users. */
export const NoOverlap: Story = {
  args: {
    groupBuckets: {
      onlyCompared: groupBuckets.onlyCompared,
      shared: [],
      onlyContext: groupBuckets.onlyContext,
    },
    appBuckets: { onlyCompared: appBuckets.onlyCompared, shared: [], onlyContext: [] },
    groupSimilarity: 0,
    appSimilarity: 0,
  },
};

/** Both users have zero groups and zero apps. */
export const Empty: Story = {
  args: {
    groupBuckets: { onlyCompared: [], shared: [], onlyContext: [] },
    appBuckets: { onlyCompared: [], shared: [], onlyContext: [] },
    groupSimilarity: 0,
    appSimilarity: 0,
  },
};
