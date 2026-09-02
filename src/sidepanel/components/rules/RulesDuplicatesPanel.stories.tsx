import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import RulesDuplicatesPanel from './RulesDuplicatesPanel';
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

/** The Rules rung's duplicate-condition panel: rule sets that can be safely merged (Feature A4). */
const meta = {
  title: 'Rules/RulesDuplicatesPanel',
  component: RulesDuplicatesPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "The duplicate-condition panel, opened from the rules strip's **Duplicates (N)** verb (Feature A4).\n\n" +
          'Rules that share a match expression but target different groups are redundant and can be folded into one rule carrying the union of their target groups, with no change to who is matched. Each cluster expands to reveal its shared condition and member rules, each with a "View" link that scrolls to the rule\'s card. Merging opens a non-destructive preview wizard — nothing is written until the admin confirms.\n\n' +
          'It was `RulesMergeBanner`, a band that sat permanently above the list and started **collapsed**, putting the sets behind a *Review* pill and each set behind a second chevron — two presses to see one duplicate, on the most valuable read-only analysis the tab performs. The outer disclosure now belongs to the strip. Renders nothing when there are no mergeable clusters.',
      },
    },
  },
  argTypes: {
    clusters: { description: 'Clusters of identical-expression rules (2+ each).' },
    onMerge: {
      description: 'Start merging a cluster (opens the non-destructive preview wizard).',
    },
    onFocusRule: { description: 'Scroll to and highlight a rule by id (its "View" link).' },
  },
  args: {
    clusters,
    onMerge: fn(),
    onFocusRule: fn(),
  },
} satisfies Meta<typeof RulesDuplicatesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: two mergeable clusters, each behind its own set-level chevron. */
export const Default: Story = {};

/** A single mergeable cluster. */
export const SingleCluster: Story = {
  args: { clusters: [clusters[0]] },
};

/** No `onFocusRule` handler — the per-rule "View" link is omitted. */
export const WithoutFocusLink: Story = {
  args: { onFocusRule: undefined },
};

/**
 * A cluster holding a rule Okta reports as `INVALID` — one it can no longer evaluate,
 * usually because a group its expression names was deleted.
 *
 * The mark is `danger` **Broken**, not the neutral *Inactive* the old hand-rolled pill
 * gave everything that was not `ACTIVE` (D-085). It is worth seeing here specifically:
 * this panel's whole purpose is to offer these rules for merging, and "somebody paused
 * it" and "Okta cannot run it" call for opposite decisions.
 */
export const BrokenMemberRule: Story = {
  args: {
    clusters: [
      {
        ...clusters[0],
        rules: [
          clusters[0].rules[0],
          {
            ...clusters[0].rules[1],
            id: 'rul5',
            name: 'Engineering Contractors',
            status: 'INVALID',
          },
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /2 rules/ }));
    await expect(canvas.getByText('Broken')).toBeInTheDocument();
  },
};

/** No mergeable clusters — the component renders nothing. */
export const Empty: Story = {
  args: { clusters: [] },
};
