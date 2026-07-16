import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UserComparisonModal from './UserComparisonModal';
import { mockUsers, mockGroup } from '../../../test/mocks/handlers';
import type { GroupMembership } from '../../../shared/types';

const contextGroups: GroupMembership[] = [
  { group: mockGroup, membershipType: 'DIRECT' },
  {
    group: { ...mockGroup, id: 'group456', profile: { name: 'VPN Access', description: '' } },
    membershipType: 'RULE_BASED',
  },
];

/**
 * Side-by-side comparison of two Okta users' groups and app assignments. A thin
 * shell over {@link useUserComparison}; state (search, buckets, similarity, group
 * copy) lives in that hook, not in props.
 */
const meta = {
  title: 'Users/UserComparisonModal',
  component: UserComparisonModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Side-by-side comparison of two Okta users' groups and app assignments.\n\n" +
          'A thin shell: all state (search, load, bucketing, similarity, optimistic ' +
          'group-add) lives in {@link useUserComparison}; this component wires that state ' +
          'into the search phase and the hero/tab-bar/overview/diff subcomponents.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  args: {
    isOpen: true,
    onClose: fn(),
    contextUser: mockUsers[0],
    contextGroups,
    targetTabId: 1,
    onGroupsChanged: fn(),
  },
} satisfies Meta<typeof UserComparisonModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default open state: no compared user selected yet, so the search phase is
 * shown (picking a comparison user is interactive state internal to the modal's
 * hook, not prop-driven).
 */
export const Default: Story = {};

/** `isOpen: false` — the shared `Modal` renders nothing. */
export const Closed: Story = {
  args: { isOpen: false },
};
