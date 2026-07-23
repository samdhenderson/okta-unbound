/**
 * @module sidepanel/components/groups/GroupCleanupPanel.stories
 * @description Storybook stories for {@link GroupCleanupPanel}.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupCleanupPanel from './GroupCleanupPanel';
import { mockGroup } from '../../../test/mocks/handlers';
import type { GroupSummary } from '../../../shared/types';

/** Build a {@link GroupSummary} fixture, reusing the mock group's type. */
function makeGroup(overrides: Partial<GroupSummary> & { id: string; name: string }): GroupSummary {
  return {
    type: mockGroup.type,
    memberCount: 25,
    hasRules: false,
    ruleCount: 0,
    description: 'Team-managed group',
    ...overrides,
  };
}

const mixedGroups: GroupSummary[] = [
  makeGroup({ id: 'g1', name: 'Engineering', memberCount: 120, hasRules: true, ruleCount: 2 }),
  makeGroup({ id: 'g2', name: 'Old Project X', memberCount: 0 }),
  makeGroup({ id: 'g3', name: 'Marketing', memberCount: 0, description: '' }),
  makeGroup({
    id: 'g4',
    name: 'Contractors 2019',
    memberCount: 8,
    staleness: { score: 75, factors: ['No membership change in 400+ days'] },
  }),
  makeGroup({ id: 'g5', name: 'Sales Team', memberCount: 40 }),
  makeGroup({ id: 'g6', name: 'Sales Team', memberCount: 15 }),
  makeGroup({ id: 'g7', name: 'Finance', memberCount: 12 }),
];

const healthyGroups: GroupSummary[] = [
  makeGroup({ id: 'g1', name: 'Engineering', memberCount: 120, hasRules: true, ruleCount: 2 }),
  makeGroup({ id: 'g2', name: 'Product', memberCount: 30 }),
  makeGroup({ id: 'g3', name: 'Sales', memberCount: 18 }),
  makeGroup({ id: 'g4', name: 'Finance', memberCount: 9 }),
];

const manyFlaggedGroups: GroupSummary[] = Array.from({ length: 12 }, (_, i) =>
  makeGroup({ id: `empty${i + 1}`, name: `Unused Group ${i + 1}`, memberCount: 0 }),
);

/** Read-only clutter-triage panel: category selectors plus a ranked review preview. */
const meta = {
  title: 'Groups/GroupCleanupPanel',
  component: GroupCleanupPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Read-only clutter-triage panel over the loaded groups.\n\n' +
          'Buckets groups into cleanup categories (empty, duplicate-named, stale, …), ' +
          'offers category selectors, and previews a ranked review list that can be ' +
          'pushed back as the current selection. When nothing is flagged it renders an ' +
          'empty state; a long flagged list is capped with an "N more" overflow line. ' +
          'The panel itself performs no mutations.\n\n' +
          '**Related internals:** [Shared utilities](?path=/docs/internals-shared-utilities--docs), ' +
          '[Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  argTypes: {
    groups: { description: 'The loaded (cached) groups to analyze.' },
    onSelectGroups: { description: 'Replace the current selection with the given group ids.' },
    onAnalyzeSource: {
      description: 'Open the read-only membership-source insight for a flagged group.',
    },
    onClose: { description: 'Close the panel.' },
  },
  args: {
    groups: mixedGroups,
    onSelectGroups: fn(),
    onAnalyzeSource: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof GroupCleanupPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: a mix of empty, duplicate-named, and stale groups. */
export const Default: Story = {};

/** No clutter detected — renders the empty state. */
export const Empty: Story = {
  args: { groups: healthyGroups },
};

/** More flagged groups than the preview cap — shows the "N more" overflow line. */
export const ManyFlaggedGroups: Story = {
  args: { groups: manyFlaggedGroups },
};
