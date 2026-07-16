/**
 * @module sidepanel/components/groups/GroupComparisonModal.stories
 * @description Storybook stories for {@link GroupComparisonModal}.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupComparisonModal from './GroupComparisonModal';
import { mockGroup, mockUsers } from '../../../test/mocks/handlers';
import type { GroupSummary, GroupComparisonResult, OktaUser } from '../../../shared/types';

/** Build a {@link GroupSummary} fixture, reusing the mock group's type. */
function makeGroup(id: string, name: string, memberCount: number): GroupSummary {
  return {
    id,
    name,
    type: mockGroup.type,
    memberCount,
    hasRules: false,
    ruleCount: 0,
  };
}

const twoGroups: GroupSummary[] = [
  makeGroup('g1', 'Engineering', 60),
  makeGroup('g2', 'Product', 45),
];

const threeGroups: GroupSummary[] = [...twoGroups, makeGroup('g3', 'Design', 20)];

const twoGroupCache = new Map<string, OktaUser[]>([
  ['g1', mockUsers.slice(0, 60)],
  ['g2', mockUsers.slice(30, 75)],
]);

const threeGroupCache = new Map<string, OktaUser[]>([
  ...twoGroupCache,
  ['g3', mockUsers.slice(60, 80)],
]);

const twoGroupResult: GroupComparisonResult = {
  groups: [
    { id: 'g1', name: 'Engineering', memberCount: 60 },
    { id: 'g2', name: 'Product', memberCount: 45 },
  ],
  intersection: mockUsers.slice(30, 60).map((u) => u.id),
  uniqueMembers: {
    g1: mockUsers.slice(0, 30).map((u) => u.id),
    g2: mockUsers.slice(60, 75).map((u) => u.id),
  },
  totalUniqueUsers: 75,
};

const threeGroupResult: GroupComparisonResult = {
  groups: [
    { id: 'g1', name: 'Engineering', memberCount: 60 },
    { id: 'g2', name: 'Product', memberCount: 45 },
    { id: 'g3', name: 'Design', memberCount: 20 },
  ],
  intersection: [],
  uniqueMembers: {
    g1: mockUsers.slice(0, 30).map((u) => u.id),
    g2: [],
    g3: mockUsers.slice(75, 80).map((u) => u.id),
  },
  totalUniqueUsers: 80,
};

/** Modal comparing membership overlap across 2–5 selected groups. */
const meta = {
  title: 'Groups/GroupComparisonModal',
  component: GroupComparisonModal,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    isOpen: true,
    onClose: fn(),
    groups: twoGroups,
    compareGroups: fn(async () => twoGroupResult),
    memberCache: twoGroupCache,
  },
} satisfies Meta<typeof GroupComparisonModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: two groups compared, no pairwise matrix. */
export const Default: Story = {};

/** Three groups compared — renders the pairwise overlap matrix. */
export const ThreeGroups: Story = {
  args: {
    groups: threeGroups,
    compareGroups: fn(async () => threeGroupResult),
    memberCache: threeGroupCache,
  },
};

/** Comparison in flight — `compareGroups` never resolves. */
export const Loading: Story = {
  args: {
    compareGroups: fn(() => new Promise<GroupComparisonResult>(() => {})),
  },
};

/** The comparison call rejects. */
export const WithError: Story = {
  args: {
    compareGroups: fn(async () => {
      throw new Error('Comparison failed: rate limited');
    }),
  },
};

/** Closed state (renders nothing). */
export const Closed: Story = {
  args: { isOpen: false },
};
