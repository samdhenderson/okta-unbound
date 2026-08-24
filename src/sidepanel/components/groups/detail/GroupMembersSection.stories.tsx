import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupMembersSection from './GroupMembersSection';
import type { OktaUser } from '../../../../shared/types';

/** Obviously-fake members — no real org data ever ships in a story. */
const makeUser = (id: string, firstName: string, lastName: string): OktaUser => ({
  id,
  status: 'ACTIVE',
  profile: {
    login: `${firstName.toLowerCase()}@example.com`,
    email: `${firstName.toLowerCase()}@example.com`,
    firstName,
    lastName,
  },
});

const members: OktaUser[] = [
  makeUser('00uFAKE1', 'Ada', 'Lovelace'),
  makeUser('00uFAKE2', 'Grace', 'Hopper'),
  makeUser('00uFAKE3', 'Katherine', 'Johnson'),
];

const meta = {
  title: 'Groups/GroupMembersSection',
  component: GroupMembersSection,
  tags: ['autodocs'],
  parameters: {
    // A lone `DetailSection` starts its own `<h2>` with no page `<h1>` above it in
    // isolation — same accepted trade-off as `GroupMembershipSourceSection`.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          "The Group Detail view's roster: displays members and, per row, a confirm-gated remove.\n\n" +
          'It piggybacks on the same gated read `GroupMembershipSourceSection` already offers — the roster ' +
          'here is the exact list the member-source analysis fetches, so this section costs nothing beyond ' +
          'that one opt-in paginated read. Before that analysis has run it shows a gated prompt, never an ' +
          'empty list: an empty list would read as "this group has no members," a different fact.\n\n' +
          "Adding a member lives in the action bar's Add-member modal, not here — see `AddGroupMemberModal`.\n\n" +
          '`APP_GROUP` and `BUILT_IN` groups reject membership writes at the Okta API, so the per-row remove ' +
          'control is hidden entirely and replaced with a one-line explanation — see `AppGroupReadOnly` ' +
          'and `BuiltInReadOnly` below.',
      },
    },
  },
  argTypes: {
    groupType: { description: 'Determines whether the per-row remove control renders at all.' },
    memberCount: { description: "The group's member count, used for the pre-load cost estimate." },
    members: { description: 'The roster, once the shared member analysis has populated it.' },
    status: {
      description: "Status of the shared member-source analysis ('idle'/'loading'/'done'/'error').",
    },
  },
  args: {
    groupType: 'OKTA_GROUP',
    memberCount: 3,
    members: null,
    status: 'idle',
    error: null,
    onAnalyze: fn(),
    canAnalyze: true,
    removeTarget: null,
    onRequestRemove: fn(),
    onCancelRemove: fn(),
    onConfirmRemove: fn(),
    removeStatus: 'idle',
    removeError: null,
  },
} satisfies Meta<typeof GroupMembersSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Not loaded yet: the gate states what loading costs (shared with the analysis above). */
export const Default: Story = {};

/** Loading the roster (or waiting on the shared analysis). */
export const Loading: Story = { args: { status: 'loading' } };

/** The underlying member-source read failed; offers a retry. */
export const ErrorState: Story = {
  args: { status: 'error', error: 'Members could not be read.' },
};

/** An empty group: nothing to add or remove, and no gate on offer. */
export const Empty: Story = { args: { memberCount: 0 } };

/** Loaded: the roster with per-member remove. */
export const Loaded: Story = { args: { status: 'done', members } };

/** A remove is armed: the confirm modal is open. */
export const RemoveConfirm: Story = {
  args: { status: 'done', members, removeTarget: members[0] },
};

/** An app-imported group: read-only, with the one-line reason why. */
export const AppGroupReadOnly: Story = {
  args: { groupType: 'APP_GROUP', status: 'done', members },
};

/** A built-in Okta group (e.g. Everyone): read-only, with the one-line reason why. */
export const BuiltInReadOnly: Story = {
  args: { groupType: 'BUILT_IN', status: 'done', members },
};
