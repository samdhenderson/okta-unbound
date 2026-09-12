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
          '**Every attribute gets a card; three signals only decide the order.** The rule index ' +
          'used to be a *filter*, so a card existed only for attributes some feeding rule ' +
          'referenced — which hid the drift worth catching most. It is now the *lightest* of ' +
          'three ranking inputs, behind near-duplicate spellings and a hidden tail; see ' +
          '`AttributeSpreadSection` for the weights.\n\n' +
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
      description:
        'The feeding rules, layered onto the cards as an annotation and the lightest ranking input.',
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
 * Open one of the pane's folded sections.
 *
 * Every section arrives closed, so a story that asserts on a section's *body*
 * has to open it first. A collapsed body is `inert`, which keeps it out of the
 * accessibility tree — so this is not a convenience, it is what makes the
 * queries below reach anything at all.
 */
const openSection = async (canvas: ReturnType<typeof within>, name: RegExp): Promise<void> => {
  await userEvent.click(canvas.getByRole('button', { name }));
};

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

/** Roster loaded and the section opened: a card per discovered attribute, ranked. */
export const AttributeCards: Story = {
  args: { members, memberStatus: 'done' },
  play: async ({ canvas }) => {
    await openSection(canvas, /Attribute spread/);
    await expect(canvas.getByText('department')).toBeVisible();
  },
};

/**
 * How the tab actually arrives: three folded sections, each stating its own
 * headline fact.
 *
 * The fact is the point. A stack of sections that all start closed and say
 * nothing is a column of bare headers, and a reader has to open every one to
 * find out which was worth opening — so the summary line is what makes folding
 * them by default an improvement rather than a extra click.
 */
export const AllSectionsClosed: Story = {
  args: { members, memberStatus: 'done', scanStatus: 'complete', mfaResults },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('2 attributes · 2 flagged')).toBeVisible();
    await expect(
      canvas.getByText('3 of 12 members scanned have no MFA factor enrolled.'),
    ).toBeVisible();

    // Closed, not absent: each heading is a real disclosure control.
    await expect(canvas.getByRole('button', { name: /Attribute spread/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(canvas.getByRole('button', { name: /MFA coverage/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  },
};

/**
 * A roster that has not loaded reports **absent**, never zero.
 *
 * `0 attributes` on a section that never ran its analysis would be a fact nobody
 * established. The folded header says what it actually knows instead.
 */
export const ClosedSummariesWithoutARoster: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Not analyzed yet.')).toBeVisible();
    await expect(canvas.getByText('Load members first.')).toBeVisible();
    await expect(canvas.queryByText(/0 attributes/)).toBeNull();
  },
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
    await openSection(canvas, /Attribute spread/);
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

/** MFA scan complete — the enrollment and factor-type cards, plus a "Rescan" trigger. */
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
 * RETARGETED (`CompositionJumpsToMembers`). The jump lives on the attribute card
 * now, not in a second grid below it.
 *
 * `CompositionReports` drew the same `discoverAttributeBreakdowns` output the
 * cards above it already drew, in an older and smaller card, purely so its values
 * could be clicked. The capability was worth keeping and the duplicate grid was
 * not — so the card's own value rows became the control. A reader looking at a
 * value in the card is already looking at the thing they want to filter by.
 *
 * The row still *leaves*: this pane holds no member list, so a click applies the
 * filter on Members and moves, which the row's accessible name says before
 * anybody clicks it.
 */
export const ValueJumpsToMembersFromCard: Story = {
  args: { members, memberStatus: 'done', onFilterMembers: fn() },
  play: async ({ args, canvas }) => {
    await openSection(canvas, /Attribute spread/);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Show the value breakdown for department' }),
    );

    await userEvent.click(
      canvas.getByRole('button', { name: /^Open Members filtered by Department: Engineering/ }),
    );
    await expect(args.onFilterMembers).toHaveBeenCalledWith(
      expect.objectContaining({ dimension: 'department', value: 'Engineering' }),
    );
  },
};

/**
 * RETARGETED (`CompositionOmittedWithNowhereToGo`). Same rule, applied one level
 * down.
 *
 * The old section was **absent** without a caller to honour a jump, because it
 * was made of nothing but value clicks and an unwired copy would have been a grid
 * of controls that did nothing (ADR-0039). A card is not that — it carries a
 * spread bar, badges and counts that are worth reading with no destination wired
 * — so the card renders and the *rows* stop being controls.
 */
export const ValueRowsInertWithNowhereToGo: Story = {
  args: { members, memberStatus: 'done' },
  play: async ({ canvas }) => {
    await openSection(canvas, /Attribute spread/);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Show the value breakdown for department' }),
    );

    // The value is still stated; it just does not promise to take you anywhere.
    await expect(canvas.getByText('Engineering')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /Open Members filtered by/ })).toBeNull();
  },
};

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
 * The aggregated tail is reachable, in three steps.
 *
 * A card keeps only its leading values and folds the rest into one
 * `Other (N values)` row, which used to be inert text — the card stated a count
 * and then refused to say what was in it, which is exactly where drift hides.
 * Expanding the card lists what it kept; **Show all** opens the same
 * `BreakdownDetailsModal` the Members tab uses, over the full distribution
 * `computeDimensionBreakdown` re-derives from the roster already in hand.
 * **No second fetch**, and the long list is computed only when somebody opens it.
 *
 * Read-only here: no `onFilterMembers` is wired, so the modal's rows stay inert
 * and promise nothing rather than offering a filter with nowhere to apply it.
 */
export const HiddenTailRevealedInThreeStages: Story = {
  args: { members: wideMembers, memberCount: wideMembers.length, memberStatus: 'done' },
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await openSection(canvas, /Attribute spread/);

    // Stage one: the collapsed card measures the tail and says so in words.
    await expect(canvas.getByText('costCenter')).toBeVisible();
    await expect(canvas.getByText('30% hidden in the tail')).toBeVisible();

    // Stage two: this card's own disclosure, named for the attribute it opens.
    await userEvent.click(
      canvas.getByRole('button', { name: 'Show the value breakdown for costCenter' }),
    );

    // Stage three.
    await userEvent.click(canvas.getByRole('button', { name: /Show all 9 values/ }));

    const dialog = await body.findByRole('dialog');
    await expect(within(dialog).getByText('CC-108')).toBeVisible();
    // Every value, not just the hidden three.
    await expect(within(dialog).getByText('CC-100')).toBeVisible();
    await expect(within(dialog).queryByText(/Members tab/)).toBeNull();
  },
};
