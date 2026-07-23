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
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Summary tab of the comparison modal: two proportion cards (groups + apps) with jump-to-detail links.\n\n' +
          'Each card visualizes the shared vs unique split for one dimension and shows its whole-percent overlap; the links jump to the corresponding Groups or Apps detail tab. Prop-driven from pre-bucketed data, so it renders full-overlap, no-overlap, and fully-empty states purely from its inputs.',
      },
    },
  },
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
  argTypes: {
    contextName: { description: 'Display name for the context user.' },
    comparedName: { description: 'Display name for the compared user.' },
    groupBuckets: {
      description: 'Bucketed group memberships (only-compared / shared / only-context).',
    },
    appBuckets: {
      description: 'Bucketed app assignments (only-compared / shared / only-context).',
    },
    groupSimilarity: { description: 'Group overlap as a whole percent (0–100).' },
    appSimilarity: { description: 'App overlap as a whole percent (0–100).' },
    onJumpToGroups: { description: 'Jumps to the Groups detail tab.' },
    onJumpToApps: { description: 'Jumps to the Apps detail tab.' },
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
