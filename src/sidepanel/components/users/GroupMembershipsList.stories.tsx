import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import GroupMembershipsList from './GroupMembershipsList';
import type { GroupMembership, MembershipRule, OktaUser } from '../../../shared/types';

/** An obviously fake user — no real org data ever ships in a story. */
const user: OktaUser = {
  id: '00uFAKE00000000000001',
  status: 'ACTIVE',
  profile: {
    login: 'user@example.com',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    title: 'Intern',
  },
};

const rule = (id: string, name: string, conditionExpression: string): MembershipRule => ({
  id,
  name,
  status: 'ACTIVE',
  conditionExpression,
});

/** `exact` attribution: every rule listed provably matches. Verdict `Rule`. */
const ruleExact: GroupMembership = {
  group: {
    id: '00gFAKE00000000000001',
    type: 'OKTA_GROUP',
    profile: { name: 'Engineering Staff', description: 'All engineering employees' },
  },
  membershipType: 'RULE_BASED',
  attribution: 'exact',
  rules: [rule('0prFAKErule00001', 'Auto-add Engineers', 'user.department == "Engineering"')],
};

/** `inferred`: a clause could not be evaluated, so the rule is plausible only. Verdict `Rule?`. */
const ruleInferred: GroupMembership = {
  group: {
    id: '00gFAKE00000000000002',
    type: 'OKTA_GROUP',
    profile: { name: 'Platform On-call' },
  },
  membershipType: 'RULE_BASED',
  attribution: 'inferred',
  rules: [
    rule(
      '0prFAKErule00002',
      'On-call rotation',
      'user.department == "Engineering" && isMemberOfGroup("00gFAKE00000000000009")',
    ),
  ],
};

/** `ambiguous`: two candidates and nothing to separate them. Verdict `Rule · 2?`. */
const ruleAmbiguous: GroupMembership = {
  group: {
    id: '00gFAKE00000000000003',
    type: 'OKTA_GROUP',
    profile: { name: 'Security Reviewers' },
  },
  membershipType: 'RULE_BASED',
  attribution: 'ambiguous',
  rules: [
    rule('0prFAKErule00003', 'Reviewers — by title', 'user.title == "Intern"'),
    rule('0prFAKErule00004', 'Reviewers — by group', 'isMemberOfGroup("00gFAKE00000000000009")'),
  ],
};

/** No rule targets the group, and every condition was evaluable. Verdict `Direct`. */
const direct: GroupMembership = {
  group: { id: '00gFAKE00000000000004', type: 'OKTA_GROUP', profile: { name: 'Ops Handbook' } },
  membershipType: 'DIRECT',
  attribution: 'exact',
  rules: [],
};

/** A manual add the classifier only deduced. Verdict `Direct?` — never the plain `Direct`. */
const directDeduced: GroupMembership = {
  group: { id: '00gFAKE00000000000005', type: 'OKTA_GROUP', profile: { name: 'Travel Policy' } },
  membershipType: 'DIRECT',
  attribution: 'inferred',
  rules: [],
};

/** An app-mastered group: the application manages its own members. Verdict `App`. */
const appMastered: GroupMembership = {
  group: { id: '00gFAKE00000000000006', type: 'APP_GROUP', profile: { name: 'Salesforce Users' } },
  membershipType: 'RULE_BASED',
  attribution: 'exact',
  rules: [],
};

/** Never classified — the rules it would be checked against never loaded. Verdict `Unresolved`. */
const unresolved: GroupMembership = {
  group: { id: '00gFAKE00000000000007', type: 'OKTA_GROUP', profile: { name: 'Finance Readers' } },
  membershipType: 'UNKNOWN',
  attribution: 'ambiguous',
  rules: [],
};

/** ADR-0031: someone spent a request, and Okta named the rule. The hedge is gone. */
const proven: GroupMembership = {
  group: { id: '00gFAKE00000000000008', type: 'OKTA_GROUP', profile: { name: 'VPN Access' } },
  membershipType: 'RULE_BASED',
  attribution: 'ambiguous',
  rules: [
    rule('0prFAKErule00005', 'Contractors → VPN', 'user.userType == "Contractor"'),
    rule('0prFAKErule00006', 'Engineers → VPN', 'user.department == "Engineering"'),
  ],
  provenance: { source: 'okta', rules: [{ id: '0prFAKErule00006', name: 'Engineers → VPN' }] },
};

const everyVerdict = [
  ruleExact,
  ruleInferred,
  ruleAmbiguous,
  direct,
  directDeduced,
  appMastered,
  unresolved,
  proven,
];

/** The Groups pane of the user-detail rung: one verdict and one source line per row. */
const meta = {
  title: 'Users/GroupMembershipsList',
  component: GroupMembershipsList,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // heading-order disabled: this story renders the pane as a page fragment out
    // of its heading context (no surrounding app shell), so axe flags the
    // isolated row headings.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'The **Groups pane** of the user-detail rung: every group the user is in, what put them ' +
          'there, and how much that answer is worth.\n\n' +
          'The pane follows the rung’s shared spine — summary line → filter → source pills → rows → ' +
          'empty state. The summary names every bucket that has rows in it and omits the ones that ' +
          'do not; dropping a category silently would be worse than showing no summary at all.\n\n' +
          'A row says exactly two things: one **verdict badge** (`Rule`, `Rule?`, `Rule · n?`, ' +
          '`Direct`, `Direct?`, `App`, `Unresolved` — see `membershipVerdict`) and one **source ' +
          'line** worded by `shared/membership/sourceLine`. The raw membership enum and the second ' +
          'group-type badge are gone: group type only matters when it explains the source, which ' +
          'the `App` verdict already does.\n\n' +
          'Everything else is behind the row’s disclosure, in one order: the full caveat, a card per ' +
          'attributed rule (the rule, the profile attributes its condition **reads**, and the ' +
          'condition explained clause by clause against the user), any apps the group also grants, ' +
          'the **Ask Okta** proof action (ADR-0031 — one API call, and never on a collapsed row), ' +
          'and the Okta deep link.\n\n' +
          'Every badge here is a *deduction*: `GET /api/v1/users/{id}/groups` carries no attribution ' +
          'embed (ADR-0020). A row carrying `provenance` is the exception — that is Okta’s own ' +
          'answer, and it is the only way a hedged row loses its `?`.',
      },
    },
  },
  // The pane is chromeless, like its two sibling panes: the rung's
  // `UserDetailPanel` owns the one card all three share. This decorator supplies
  // that card so the story shows the pane as it actually appears, rather than as
  // a bare list on the page background.
  decorators: [
    (Story: () => React.ReactElement) => (
      <div className="bg-canvas p-4">
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    memberships: [ruleExact, direct, appMastered],
    user,
    isLoading: false,
  },
  argTypes: {
    memberships: {
      description: "The user's group memberships, each already classified as direct or rule-based.",
    },
    user: {
      description:
        'The user the memberships belong to; enables the per-clause explanation of each rule condition.',
    },
    isLoading: { description: 'When true, shows row skeletons instead of the list.' },
    currentGroupId: {
      description:
        'Group id to mark as the group being browsed elsewhere in the panel — the row is highlighted and carries an "On page" badge.',
    },
    oktaOrigin: {
      description:
        'Okta origin used to build admin-console deep links; the disclosure’s "Open in Okta" link hides when absent.',
    },
    recentlyAddedGroupId: {
      description:
        'Id of a group just successfully added this session; its row plays a one-shot `animate-affirm-flash` success flash.',
    },
    appsByGroupId: {
      description:
        'Applications each group grants, keyed by group id. **Absent is not empty** — a group with no entry renders no "Also grants" line rather than claiming it grants none.',
    },
    onProveMembershipSource: {
      description:
        'Asks Okta which rules manage one membership (`GET /api/v1/groups/{groupId}/users/{userId}/group-rules`). Supplied, each opened row gains an "Ask Okta" action. **One API call per row**, so it only ever runs from that click.',
    },
  },
} satisfies Meta<typeof GroupMembershipsList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A rule-fed, a direct and an app-mastered membership. */
export const Default: Story = {};

/**
 * Every verdict on screen at once — the comparison that makes a wrong mapping
 * visible. Read down the badges: an answer is `primary`/`success`, a deduction is
 * `warning` and carries a `?`, and the proven row (`VPN Access`) has neither.
 */
export const AllVerdicts: Story = {
  args: { memberships: everyVerdict },
};

/**
 * One row opened. The disclosure is the whole explanation, in order: the caveat,
 * the rule that granted the membership with the attributes its condition reads,
 * the "Ask Okta" proof action, and the Okta link.
 */
export const OpenDisclosure: Story = {
  args: {
    memberships: [ruleExact, direct],
    oktaOrigin: 'https://example.okta.com',
    onProveMembershipSource: async () => ({ state: 'no-rules' }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Show how Engineering Staff was granted' }),
    );
    await expect(
      canvas.getByRole('button', { name: 'Hide how Engineering Staff was granted' }),
    ).toHaveAttribute('aria-expanded', 'true');
  },
};

/** Skeleton rows while the memberships load, so nothing shifts when they land. */
export const Loading: Story = {
  args: { memberships: [], isLoading: true },
};

/** The user belongs to no groups at all — no filter, no pills, one sentence. */
export const Empty: Story = {
  args: { memberships: [] },
};

/**
 * The *other* empty state: the user has memberships, but none matches the filter.
 * It offers the way back rather than leaving the reader to clear the field.
 */
export const FilteredToNothing: Story = {
  args: { memberships: everyVerdict },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Filter group memberships'), 'no-such-group');
    await expect(await canvas.findByText('No memberships match')).toBeInTheDocument();
  },
};

/**
 * The filter reads the source line as well as the group name, so a rule name
 * finds the group it granted even when the two share no words.
 */
export const FilteredByRuleName: Story = {
  args: { memberships: everyVerdict },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Filter group memberships'), 'auto-add');
    await expect(canvas.getByRole('heading', { name: 'Engineering Staff' })).toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: 'Ops Handbook' })).not.toBeInTheDocument();
  },
};

/** One bucket at a time. The pills are the summary line's own terms. */
export const FilteredToOneBucket: Story = {
  args: { memberships: everyVerdict },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Direct' }));
    await expect(canvas.getByRole('heading', { name: 'Ops Handbook' })).toBeInTheDocument();
  },
};

/** The group being browsed elsewhere in the panel: highlighted, and marked "On page". */
export const CurrentGroupHighlighted: Story = {
  args: { memberships: everyVerdict, currentGroupId: ruleExact.group.id },
};

/** With an org origin known, each opened row can deep-link into the Admin Console. */
export const WithOktaOriginLinks: Story = {
  args: { oktaOrigin: 'https://example.okta.com' },
};

/**
 * `appsByGroupId` is the link across to the Apps pane. It is supplied by whoever
 * already knows the answer — this pane never fetches it — and a group with **no
 * entry** renders no line at all rather than claiming it grants nothing.
 */
export const WithAppGrants: Story = {
  args: {
    memberships: [ruleExact, direct],
    appsByGroupId: { [ruleExact.group.id]: ['Salesforce', 'Figma'] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Show how Engineering Staff was granted' }),
    );
    await expect(canvas.getByText(/Salesforce, Figma/)).toBeInTheDocument();
  },
};

/**
 * ADR-0031's way out of a guess. The action lives **inside** the disclosure, so
 * the request is offered to a reader who has already opened the row they care
 * about — never once per group in a list nobody has looked at.
 */
export const ProvableAgainstOkta: Story = {
  args: {
    memberships: [ruleAmbiguous, direct],
    onProveMembershipSource: async () => ({
      state: 'rules',
      rules: [{ id: '0prFAKErule00003', name: 'Reviewers — by title' }],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Show how Security Reviewers was granted' }),
    );
    // Scoped to the row: every row carries its own action, and the proof is
    // deliberately about this membership alone.
    const rowElement = canvas
      .getByRole('heading', { name: 'Security Reviewers' })
      .closest('[data-group-id]') as HTMLElement;
    const row = within(rowElement);
    await userEvent.click(row.getByRole('button', { name: /Ask Okta/ }));
    await expect(await row.findByText(/Okta confirms/)).toBeInTheDocument();
  },
};

/**
 * Okta answering "no rule manages this membership" is an **authoritative manual
 * add**. Okta saying *nothing* is a different story (`ProofUnanswered`) and must
 * never be shown this way.
 */
export const ProvenManualAdd: Story = {
  args: {
    memberships: [ruleAmbiguous],
    onProveMembershipSource: async () => ({ state: 'no-rules' }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Show how Security Reviewers was granted' }),
    );
    await userEvent.click(canvas.getByRole('button', { name: /Ask Okta/ }));
    await expect(await canvas.findByText('Okta confirms: added directly')).toBeInTheDocument();
  },
};

/**
 * The honest failure mode: Okta was asked and did not answer, so the row's own
 * hedged classification stands untouched and the action can be retried.
 */
export const ProofUnanswered: Story = {
  args: {
    memberships: [ruleAmbiguous],
    onProveMembershipSource: async () => ({ state: 'unknown' }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Show how Security Reviewers was granted' }),
    );
    await userEvent.click(canvas.getByRole('button', { name: /Ask Okta/ }));
    await expect(await canvas.findByText(/Okta did not answer/)).toBeInTheDocument();
  },
};

/**
 * No user to explain the conditions against, so each rule card falls back to the
 * raw condition text — an explanation would have nothing to evaluate.
 */
export const WithoutUser: Story = {
  args: { memberships: [ruleExact], user: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Show how Engineering Staff was granted' }),
    );
    await expect(canvas.getByText('user.department == "Engineering"')).toBeInTheDocument();
  },
};

/**
 * The row for a just-added group plays a one-shot success flash
 * (`animate-affirm-flash`) so the confirmation lands on the group that changed,
 * not only in a banner above the fold.
 */
export const RecentlyAddedGroupFlash: Story = {
  args: { recentlyAddedGroupId: direct.group.id },
  parameters: { motion: 'on' },
};

/**
 * The 360px floor, which is where a verdict badge and a group name compete for
 * the same line. This is why the labels are two words at most and the candidate
 * count lives in the disclosure rather than in the pill.
 */
export const Compact: Story = {
  args: { memberships: everyVerdict, currentGroupId: ruleAmbiguous.group.id },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
