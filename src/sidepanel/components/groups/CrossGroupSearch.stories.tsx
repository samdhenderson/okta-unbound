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
  parameters: { layout: 'fullscreen' },
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
export const EmptyCache: Story = {
  args: {
    groupMembersCache: new Map<string, OktaUser[]>(),
    groupNames: new Map<string, string>(),
  },
};
