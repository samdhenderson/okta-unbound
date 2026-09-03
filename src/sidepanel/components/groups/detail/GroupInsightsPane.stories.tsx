import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import GroupInsightsPane from './GroupInsightsPane';
import type { FeedingRule } from '../../../hooks/useGroupSource';
import type { OktaUser, MemberMfaResult } from '../../../../shared/types';

/** Twelve members spread across two departments/titles, three with a blank department. */
const members: OktaUser[] = Array.from({ length: 12 }, (_, i) => ({
  id: `user${i + 1}`,
  status: 'ACTIVE',
  profile: {
    login: `user${i + 1}@example.com`,
    email: `user${i + 1}@example.com`,
    firstName: `First${i + 1}`,
    lastName: `Last${i + 1}`,
    department: i < 9 ? (i % 2 === 0 ? 'Engineering' : 'Product') : undefined,
    title: i % 3 === 0 ? 'Manager' : 'Individual Contributor',
  },
}));

/**
 * Two feeding rules: one keys off `department`, the other off nothing an attribute
 * card covers. `FeedingRule` is the full `FormattedRule` now — the shape
 * `getGroupRulesForGroup` already returned — so the fixture carries the whole rule.
 */
const feedingRules: FeedingRule[] = [
  {
    id: '0prFAKE1',
    name: 'Eng & Product — full-time',
    status: 'ACTIVE',
    userAttributes: ['department'],
    condition: 'department in {"Engineering", "Product"}',
    conditionExpression: 'user.department in {"Engineering", "Product"}',
    groupIds: ['00gFAKE1'],
    created: '2024-01-01T00:00:00.000Z',
    lastUpdated: '2025-01-01T00:00:00.000Z',
  },
  {
    id: '0prFAKE2',
    name: 'Managers',
    status: 'ACTIVE',
    userAttributes: ['title'],
    condition: 'title == "Manager"',
    conditionExpression: 'user.title == "Manager"',
    groupIds: ['00gFAKE1'],
    created: '2024-01-01T00:00:00.000Z',
    lastUpdated: '2025-01-01T00:00:00.000Z',
  },
];

const mfaResults = new Map<string, MemberMfaResult>(
  members.map((m, i) => [
    m.id,
    {
      userId: m.id,
      factors: [],
      enrolled: i % 4 !== 0,
      factorCount: i % 4 === 0 ? 0 : 1,
      factorLabels: i % 4 === 0 ? [] : ['Okta Verify'],
    },
  ]),
);

const meta = {
  title: 'Groups/GroupInsightsPane',
  component: GroupInsightsPane,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Group Detail's fifth tab: attribute-spread cards (blank rate, value distribution, " +
          'and drift markers, from `discoverAttributeBreakdowns`), a gated opt-in MFA-coverage ' +
          'scan (never auto-runs), and ' +
          'the group\'s own reference facts folded into a closed "About this group" section. ' +
          "Fully presentational — the caller owns every load (`useGroupSource`'s member " +
          'analysis, `useMemberMfaScan`) and passes its state through, mirroring how every ' +
          'other Group Detail section/pane is composed by `GroupDetailView`.\n\n' +
          '**Not called "Health".** That names a verdict, and this pane delivers the material ' +
          'a reader draws one from — and will hold more of it over time (staleness, orphaned ' +
          'assignments, rule overlap). Naming it for the subject is what lets those land here ' +
          'without the label going stale.\n\n' +
          '**Every attribute gets a card; rules only decide the order.** The rule index used to ' +
          'be a *filter*, so a card existed only for attributes some feeding rule referenced — ' +
          'which hid the drift worth catching most. Rule-referenced attributes still sort first, ' +
          'because those are the ones granting access today.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  argTypes: {
    groupId: { description: "The group's Okta id." },
    memberCount: {
      description: "The group's member count, used for the attribute gate's cost estimate.",
    },
    members: { description: "The group's roster, once analyzed; `null` before then." },
    memberStatus: {
      description: 'Status of the gated member analysis (shared with the Members tab).',
    },
    error: { description: 'Error message when the member analysis failed.' },
    canAnalyze: {
      description: '`false` when no Okta tab is connected; disables both gate buttons.',
    },
    feedingRules: {
      description: 'The feeding rules, layered onto the cards as an annotation and a sort key.',
    },
    mfaResults: { description: 'Per-member MFA scan results, or `null` before a scan has run.' },
    scanStatus: { description: 'Current MFA scan lifecycle status.' },
  },
  args: {
    groupId: '00gFAKEgroup00001',
    memberCount: members.length,
    members: null,
    memberStatus: 'idle',
    error: null,
    onAnalyzeMembers: fn(),
    canAnalyze: true,
    feedingRules,
    onNavigateToRule: fn(),
    mfaResults: null,
    scanStatus: 'idle',
    onRunScan: fn(),
    onRequestConfirm: fn(),
    onCancelConfirm: fn(),
    description: 'Engineering and Product — full-time.',
    created: new Date('2022-03-01T12:00:00Z'),
    lastUpdated: new Date('2025-11-14T09:30:00Z'),
  },
} satisfies Meta<typeof GroupInsightsPane>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Roster not yet loaded — the attribute gate offers "Analyze"; the MFA
 * section nudges to load members first. This is the minority case in
 * practice — `GroupDetailView` auto-loads the roster (and this pane with it)
 * for any group at or under `AUTO_LOAD_MEMBER_CAP` (1,000 members) on open
 * with no click; this state only persists for a larger group or a
 * disconnected Okta tab.
 */
export const RosterNotLoaded: Story = {};

/** Reading and classifying every member. */
export const RosterLoading: Story = { args: { memberStatus: 'loading' } };

/** The member analysis failed and offers a retry. */
export const RosterError: Story = {
  args: { memberStatus: 'error', error: 'Members could not be read.' },
};

/** Roster loaded: a card per discovered attribute, rule-referenced ones first. */
export const AttributeCards: Story = {
  args: { members, memberStatus: 'done' },
};

/**
 * No feeding rule references any user attribute — and the cards render anyway.
 *
 * This is the case the old rule-filtered grid rendered as "No feeding rule
 * assigning into this group references a user attribute", i.e. nothing. It is
 * precisely where undetected drift lives: an attribute nobody's rule reads today
 * is one somebody writes a rule against tomorrow.
 */
export const NoDependentAttributes: Story = {
  args: { members, memberStatus: 'done', feedingRules: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('department')).toBeVisible();
    await expect(canvas.queryByText(/Depended on by/)).toBeNull();
  },
};

/** Roster loaded, MFA scan idle — the trigger is enabled (below `MFA_AUTO_THRESHOLD`). */
export const MfaIdle: Story = {
  args: { members, memberStatus: 'done' },
};

/** A large-group MFA scan gated behind confirmation. */
export const MfaConfirming: Story = {
  args: { members, memberStatus: 'done', scanStatus: 'confirming' },
};

/** MFA scan in progress. */
export const MfaScanning: Story = {
  args: { members, memberStatus: 'done', scanStatus: 'scanning' },
};

/** MFA scan complete — the no-factors coverage summary plus a "Rescan" trigger. */
export const MfaComplete: Story = {
  args: { members, memberStatus: 'done', scanStatus: 'complete', mfaResults },
};

/** The MFA scan failed and offers a retry via the same trigger. */
export const MfaError: Story = {
  args: { members, memberStatus: 'done', scanStatus: 'error' },
};

/** No Okta tab connected — both gate buttons disable. */
export const Disabled: Story = { args: { canAnalyze: false } };

/**
 * Forty members over nine cost centres — more distinct values than a card's
 * summary keeps, so three of them get folded into `Other (3 values)`.
 */
const wideMembers: OktaUser[] = Array.from({ length: 40 }, (_, i) => ({
  id: `wide${i + 1}`,
  status: 'ACTIVE',
  profile: {
    login: `wide${i + 1}@example.com`,
    email: `wide${i + 1}@example.com`,
    firstName: `First${i + 1}`,
    lastName: `Last${i + 1}`,
    department: i % 2 === 0 ? 'Engineering' : 'Product',
    costCenter: `CC-${100 + (i % 9)}`,
  },
}));

/**
 * The aggregated tail is reachable.
 *
 * A card keeps only its leading values and folds the rest into one
 * `Other (N values)` row, which used to be inert text — the card stated a count
 * and then refused to say what was in it, which is exactly where drift hides.
 * The row now opens the same `BreakdownDetailsModal` the Members tab uses, over
 * the full distribution `computeDimensionBreakdown` re-derives from the roster
 * already in hand. **No second fetch**, and the long list is computed only when
 * somebody opens it.
 *
 * Read-only: this tab has no member list, so no row is wired to a filter and the
 * modal does not offer one.
 */
export const OtherRowRevealsHiddenValues: Story = {
  args: { members: wideMembers, memberCount: wideMembers.length, memberStatus: 'done' },
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // The card names the tail's size and nothing in it.
    await expect(canvas.getByText('costCenter')).toBeVisible();
    await expect(canvas.queryByText('CC-108')).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: /Other \(3 values\)/ }));

    const dialog = await body.findByRole('dialog');
    await expect(within(dialog).getByText('CC-108')).toBeVisible();
    // Every value, not just the hidden three.
    await expect(within(dialog).getByText('CC-100')).toBeVisible();
    await expect(within(dialog).queryByText(/filter the member list/)).toBeNull();
  },
};
