/**
 * @module sidepanel/components/groups/CrossGroupSearch.stories
 * @description Storybook stories for {@link CrossGroupSearch}.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import CrossGroupSearch from './CrossGroupSearch';
import { mockUsers } from '../../../test/mocks/handlers';
import type { OktaUser } from '../../../shared/types';

const groupMembersCache = new Map<string, OktaUser[]>([
  ['g1', mockUsers.slice(0, 40)],
  ['g2', mockUsers.slice(20, 60)],
  ['g3', mockUsers.slice(50, 70)],
]);

const groupNames = new Map<string, string>([
  ['g1', 'Engineering'],
  ['g2', 'Product'],
  ['g3', 'Sales'],
]);

/** Real search over the cache so typing 2+ characters in the canvas shows matches. */
const searchUserAcrossGroups = fn(
  (query: string, cache: Map<string, OktaUser[]>, names: Map<string, string>) => {
    const q = query.toLowerCase();
    const matches: Array<{ groupId: string; groupName: string; user: OktaUser }> = [];
    for (const [groupId, users] of cache) {
      for (const user of users) {
        const haystack =
          `${user.profile.firstName} ${user.profile.lastName} ${user.profile.email} ${user.profile.login}`.toLowerCase();
        if (haystack.includes(q)) {
          matches.push({ groupId, groupName: names.get(groupId) ?? groupId, user });
        }
      }
    }
    return matches;
  },
);

/** Search-and-bulk-remove panel operating over cached group memberships. */
const meta = {
  title: 'Groups/CrossGroupSearch',
  component: CrossGroupSearch,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Search-and-bulk-remove panel operating over cached group memberships.\n\n' +
          'Typing 2+ characters surfaces every (group, user) match across the cached ' +
          'membership corpus, so an admin can find a user everywhere they appear and ' +
          'remove them from several groups at once. When nothing is cached it shows a ' +
          '"load members first" hint.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Scheduler & messaging](?path=/docs/internals-scheduler-messaging--docs), ' +
          '[Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  argTypes: {
    groupMembersCache: { description: 'Cached members keyed by group id — the corpus searched.' },
    groupNames: { description: 'Group id → display name, used to label matches.' },
    searchUserAcrossGroups: {
      description: 'Returns every (group, user) match for the query against the cache.',
    },
    onRemoveUserFromGroups: {
      description: 'Removes a user from the given groups (called per user during bulk remove).',
    },
    onClose: { description: 'Dismisses the panel.' },
  },
  args: {
    groupMembersCache,
    groupNames,
    searchUserAcrossGroups,
    onRemoveUserFromGroups: fn(async () => {}),
    onClose: fn(),
  },
} satisfies Meta<typeof CrossGroupSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: three cached groups, empty query. Type a name to see cross-group matches. */
export const Default: Story = {};

/** A single cached group. */
export const SingleGroupCached: Story = {
  args: {
    groupMembersCache: new Map<string, OktaUser[]>([['g1', mockUsers.slice(0, 25)]]),
    groupNames: new Map<string, string>([['g1', 'Engineering']]),
  },
};

/** Nothing cached yet — shows the "load members first" hint. */
export const Empty: Story = {
  args: {
    groupMembersCache: new Map<string, OktaUser[]>(),
    groupNames: new Map<string, string>(),
  },
};
