import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupMembersSection from './GroupMembersSection';
import type { MembershipRule, OktaUser } from '../../../../shared/types';
import {
  summarizeMemberSources,
  type GroupIdentity,
} from '../../../../shared/membership/groupSource';
import { buildMemberSourceIndex } from '../../../../shared/membership/memberSourceIndex';

/** Obviously-fake members — no real org data ever ships in a story. */
const makeUser = (
  id: string,
  firstName: string,
  lastName: string,
  department?: string,
): OktaUser => ({
  id,
  status: 'ACTIVE',
  profile: {
    login: `${firstName.toLowerCase()}@example.com`,
    email: `${firstName.toLowerCase()}@example.com`,
    firstName,
    lastName,
    ...(department ? { department } : {}),
  },
});

const members: OktaUser[] = [
  makeUser('00uFAKE1', 'Ada', 'Lovelace'),
  makeUser('00uFAKE2', 'Grace', 'Hopper'),
  makeUser('00uFAKE3', 'Katherine', 'Johnson'),
];

/*
  A roster with a real mix of sources, classified by the real classifier rather
  than a hand-written index — so the meter, the pills and the counts in this story
  can only agree with each other if the production path agrees with itself.
*/
const identity: GroupIdentity = { id: '00gFAKE1', name: 'Engineering', type: 'OKTA_GROUP' };

const rules: MembershipRule[] = [
  {
    id: '0prFAKE1',
    name: 'Engineering department',
    status: 'ACTIVE',
    conditionExpression: 'user.department == "Engineering"',
    actions: { assignUserToGroups: { groupIds: ['00gFAKE1'] } },
  },
  {
    id: '0prFAKE2',
    name: 'Platform department',
    status: 'ACTIVE',
    conditionExpression: 'user.department == "Platform"',
    actions: { assignUserToGroups: { groupIds: ['00gFAKE1'] } },
  },
];

const mixedMembers: OktaUser[] = [
  makeUser('00uFAKE1', 'Ada', 'Lovelace', 'Engineering'),
  makeUser('00uFAKE2', 'Grace', 'Hopper', 'Engineering'),
  makeUser('00uFAKE3', 'Katherine', 'Johnson', 'Engineering'),
  makeUser('00uFAKE4', 'Annie', 'Easley', 'Platform'),
  makeUser('00uFAKE5', 'Mary', 'Jackson', 'Support'),
  makeUser('00uFAKE6', 'Dorothy', 'Vaughan'),
];

const mixedBreakdown = summarizeMemberSources(identity, mixedMembers, rules);
const mixedIndex = buildMemberSourceIndex(identity, mixedMembers, rules);

const meta = {
  title: 'Groups/GroupMembersSection',
  component: GroupMembersSection,
  tags: ['autodocs'],
  parameters: {
    // The roster's own outline starts at `<h3>` with no page heading above it
    // in isolation — the pane that mounts this supplies the surrounding levels.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          "The Group Detail view's roster: who is in the group, why, and — per row — a " +
          'confirm-gated remove.\n\n' +
          'One gate, one read: `useGroupSource`\u2019s member analysis fetches the roster and classifies ' +
          'it in the same pass. Before it has run this shows a gated prompt, never an empty list: an ' +
          'empty list would read as "this group has no members," a different fact.\n\n' +
          'There used to be a second card above this one (`GroupMembershipSourceSection`) with its own ' +
          'gate and its own idle/loading/error ladder over the *same* state — so a reader could load the ' +
          'roster and still be looking at an un-analyzed meter. Its readout is the strip inside the ' +
          'roster now; its two notes are `MemberSourceNotes`.\n\n' +
          "Adding a member lives in the action bar's Add-member modal, not here — see `AddGroupMemberModal`.\n\n" +
          '`APP_GROUP` and `BUILT_IN` groups reject membership writes at the Okta API, so the per-row remove ' +
          'control is hidden entirely and replaced with a one-line explanation — see `AppGroupReadOnly` ' +
          'and `BuiltInReadOnly` below.\n\n' +
          '**The roster itself is `MemberExplorer`**, the same component the Overview tab mounts: search, ' +
          'faceted filters, MFA scanning, composition reports and windowed paging. What stays in this ' +
          'component is the part the explorer must not learn — the `SourceStatus` gate, the read-only ' +
          'reason, and the remove confirmation (which outlives the row that opened it).\n\n' +
          'Pass `breakdown` **and** `memberSourceIndex` and the explorer gains a membership-source meter ' +
          'whose segments are also filters — see `WithSourceMeter`. Pass neither and it has no meter and ' +
          'no source pills, which is the honest rendering for a roster nothing has classified, not a ' +
          'degraded one.',
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
    breakdown: null,
    memberSourceIndex: null,
    mfaResults: null,
    scanStatus: 'idle',
    onRunScan: fn(),
    onRequestConfirm: fn(),
    onCancelConfirm: fn(),
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

/**
 * Not loaded yet: the gate states what loading costs (shared with the
 * analysis above). This is the minority case in practice — `GroupDetailView`
 * auto-loads any group at or under `AUTO_LOAD_MEMBER_CAP` (1,000 members) on
 * open with no click; `idle` only persists for a larger group or a
 * disconnected Okta tab.
 */
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

/**
 * The membership-source meter, and the same split as filters.
 *
 * Three members match the Engineering rule, one matches Platform, and two match
 * nothing — a manual add and a member with no department at all. The bar shows the
 * proportion; the pills beside it narrow the list to a slice. The bar itself is
 * never the click target: at the 360px panel floor a one-member segment is a
 * `min-w-1` sliver, which is not a button.
 */
export const WithSourceMeter: Story = {
  args: {
    status: 'done',
    members: mixedMembers,
    memberCount: mixedMembers.length,
    breakdown: mixedBreakdown,
    memberSourceIndex: mixedIndex,
  },
};
