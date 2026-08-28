import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UserComparisonPanel from './UserComparisonPanel';
import { mockUsers, mockGroup } from '../../../test/mocks/fixtures';
import type { GroupMembership } from '../../../shared/types';

const contextGroups: GroupMembership[] = [
  { group: mockGroup, membershipType: 'DIRECT', rules: [], attribution: 'exact' },
  {
    group: { ...mockGroup, id: 'group456', profile: { name: 'VPN Access', description: '' } },
    membershipType: 'RULE_BASED',
    rules: [],
    attribution: 'exact',
  },
];

const meta = {
  title: 'Users/UserComparisonPanel',
  component: UserComparisonPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "View-stack host for the two-user comparison — the Users tab's mount site.\n\n" +
          'The Users-tab comparison host, and since the Overview dialog was retired the only ' +
          'one: it owns the `useUserComparison` instance ' +
          'and renders the shared `UserComparisonView` with **no dialog chrome**, because the ' +
          "Users tab shows the comparison as a pushed view (ADR-0016). The tab's one " +
          '`PageHeader` above it carries the title, the breadcrumb trail and the back ' +
          'affordance, so this component renders only the surface.\n\n' +
          'It stays mounted while the tab is at the root of its stack, which makes two props ' +
          'load-bearing rather than cosmetic:\n\n' +
          '- `isActive` is false while popped, and that is what drives the reset. A mounted ' +
          'view with no reset would show the previous comparison on the next push.\n' +
          '- `searchEnabled` is false while popped **or** while the whole tab is hidden, so a ' +
          'mounted comparison never becomes a background caller of the user-search API ' +
          '(ADR-0018). It also gates scroll preservation, because "pushed and the tab is ' +
          'shown" is exactly "the comparison is the thing on screen": the panel keeps its ' +
          'own offset on the app root scroller it shares with the detail rung, so a push ' +
          'opens at the top and a return lands where you left it.\n\n' +
          'Because state lives in the hook, these stories render the search phase: the ' +
          'comparison phase is reached by picking a user, which needs a live Okta tab. See ' +
          '`Users/UserComparisonView` for prop-driven stories of every phase.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  args: {
    isActive: true,
    searchEnabled: true,
    contextUser: mockUsers[10],
    contextGroups,
    targetTabId: 1,
    onGroupsChanged: fn(),
  },
  argTypes: {
    isActive: {
      description:
        'Whether a comparison view is currently pushed. Going false resets the comparison.',
    },
    searchEnabled: {
      description:
        'Whether the debounced user search may reach Okta — pushed *and* the Users tab shown.',
    },
    contextUser: {
      description: 'The "context" user being compared from (the tab\'s selected user).',
    },
    contextGroups: {
      description: "The context user's group memberships, used as the left-hand baseline.",
    },
    targetTabId: {
      description: 'Tab id of the Okta admin tab; API calls are scheduled against it.',
    },
    onGroupsChanged: {
      description: 'Called after a group is copied onto the context user so the tab can refresh.',
    },
  },
} satisfies Meta<typeof UserComparisonPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pushed and visible: the search phase, with no dialog chrome around it. */
export const Pushed: Story = {};

/**
 * Mounted but popped — what the Users tab renders behind the `hidden` wrapper.
 * The component still returns its markup (the tab hides it with a class swap); the
 * point of the story is that this state is inert, not invisible.
 */
export const PoppedButMounted: Story = {
  args: { isActive: false, searchEnabled: false },
};

/**
 * Pushed, but the Users tab is not the selected top-level tab. The comparison keeps
 * its state and stays on screen behind the hidden tab, and issues no searches.
 */
export const PushedWhileTabHidden: Story = {
  args: { isActive: true, searchEnabled: false },
};
