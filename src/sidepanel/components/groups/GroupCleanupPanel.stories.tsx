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
  parameters: { layout: 'fullscreen' },
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
export const NoClutter: Story = {
  args: { groups: healthyGroups },
};

/** More flagged groups than the preview cap — shows the "N more" overflow line. */
export const ManyFlaggedGroups: Story = {
  args: { groups: manyFlaggedGroups },
};
