import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import RulesMergeBanner from './RulesMergeBanner';
import type { MergeableRuleGroup } from '../../../shared/rules/consolidation';

/** Two clusters of duplicate-condition rules, ready to review and merge. */
const clusters: MergeableRuleGroup[] = [
  {
    expression: 'user.department == "Engineering"',
    unionGroupIds: ['00g1eng', '00g2eng-leads'],
    rules: [
      {
        id: 'rul1',
        name: 'Engineering Auto-Assign',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2025-01-10T00:00:00.000Z',
        lastUpdated: '2025-01-10T00:00:00.000Z',
        actions: { assignUserToGroups: { groupIds: ['00g1eng'] } },
      },
      {
        id: 'rul2',
        name: 'Engineering Leads Sync',
        status: 'INACTIVE',
        type: 'group_rule',
        created: '2025-02-14T00:00:00.000Z',
        lastUpdated: '2025-02-14T00:00:00.000Z',
        actions: { assignUserToGroups: { groupIds: ['00g2eng-leads'] } },
      },
    ],
  },
  {
    expression: 'user.city == "Austin"',
    unionGroupIds: ['00g3austin'],
    rules: [
      {
        id: 'rul3',
        name: 'Austin Office',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2025-03-01T00:00:00.000Z',
        lastUpdated: '2025-03-01T00:00:00.000Z',
        actions: { assignUserToGroups: { groupIds: ['00g3austin'] } },
      },
      {
        id: 'rul4',
        name: 'Austin Office Backup',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2025-03-02T00:00:00.000Z',
        lastUpdated: '2025-03-02T00:00:00.000Z',
        actions: { assignUserToGroups: { groupIds: ['00g3austin'] } },
      },
    ],
  },
];

/** Collapsible banner surfacing rule sets that can be safely merged (Feature A4). */
const meta = {
  title: 'Rules/RulesMergeBanner',
  component: RulesMergeBanner,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    clusters,
    onMerge: fn(),
    onFocusRule: fn(),
  },
} satisfies Meta<typeof RulesMergeBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: two mergeable clusters, collapsed until the header is clicked. */
export const Default: Story = {};

/** A single mergeable cluster. */
export const SingleCluster: Story = {
  args: { clusters: [clusters[0]] },
};

/** No `onFocusRule` handler — the per-rule "View" link is omitted. */
export const WithoutFocusLink: Story = {
  args: { onFocusRule: undefined },
};

/** No mergeable clusters — the component renders nothing. */
export const Empty: Story = {
  args: { clusters: [] },
};
