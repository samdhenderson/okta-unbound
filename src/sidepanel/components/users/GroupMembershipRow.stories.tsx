import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import GroupMembershipRow from './GroupMembershipRow';
import { NavigationProvider } from '../../contexts/NavigationContext';
import type { GroupMembership, MembershipRule, OktaUser } from '../../../shared/types';

const handlers = { rule: fn(), group: fn(), user: fn(), app: fn(), policy: fn() };

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

/** `exact` attribution: the listed rule provably matches. Verdict `Rule`. */
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

/** Two candidate rules and nothing to separate them. Verdict `Rule · 2?`. */
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

/** No rule targets the group and every condition was evaluable. Verdict `Direct`. */
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

/** The application masters its own membership. Verdict `App`. */
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

/**
 * A group name long enough to lose an argument with the badges beside it — the
 * case the name line's `flex-wrap` exists for.
 */
const longName: GroupMembership = {
  ...ruleAmbiguous,
  group: {
    id: '00gFAKE00000000000008',
    type: 'OKTA_GROUP',
    profile: { name: 'EMEA Engineering — Platform Infrastructure On-Call Escalation' },
  },
};

/** The same ambiguous membership after Okta answered — the hedge is gone (ADR-0031). */
const proven: GroupMembership = {
  ...ruleAmbiguous,
  provenance: {
    source: 'okta',
    rules: [{ id: '0prFAKErule00003', name: 'Reviewers — by title' }],
  },
};

/** One row of the Groups pane: one verdict, one source line, everything else disclosed. */
const meta = {
  title: 'Users/GroupMembershipRow',
  component: GroupMembershipRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One membership, reduced to two statements: a **verdict badge** (`Rule`, `Rule?`, ' +
          '`Rule · n?`, `Direct`, `Direct?`, `App`, `Unresolved` — from `membershipVerdict`) and ' +
          'one **source line** worded by `shared/membership/sourceLine`.\n\n' +
          'The row this replaced stacked the raw membership enum, a second group-type badge, a ' +
          'hedged caption and a "Prove it" strip on top of each other, and left the reader to ' +
          'decide which to believe. Everything past the two statements now lives behind the ' +
          'disclosure, in one order: the full caveat, a card per attributed rule, any apps the ' +
          'group also grants, the **Ask Okta** proof action (ADR-0031), and the Okta deep link.\n\n' +
          'The disclosure is closed by default and held `inert` while closed, which is what keeps ' +
          'the proof action — one API call per press — off a row nobody has opened. Expansion is ' +
          'owned by the pane, not the row, so filtering the list cannot close a row the reader ' +
          'opened.\n\n' +
          '**Related internals:** [Components](?path=/docs/internals-components--docs)',
      },
    },
  },
  // The pane renders these inside one bordered card; this decorator supplies that
  // frame so the row is shown as it actually appears rather than on the page
  // background. `NavigationProvider` makes the rule chips in the disclosure real
  // links rather than their plain-text fallback.
  decorators: [
    (Story: () => React.ReactElement) => (
      <NavigationProvider handlers={handlers}>
        <div className="bg-canvas p-4">
          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <Story />
          </div>
        </div>
      </NavigationProvider>
    ),
  ],
  args: {
    membership: ruleExact,
    user,
    isCurrentGroup: false,
    expanded: false,
    onToggle: fn(),
    oktaOrigin: 'https://example.okta.com',
    proofEnabled: false,
    onProve: fn(),
  },
  argTypes: {
    membership: { description: 'The membership this row is about, as the classifier produced it.' },
    user: {
      description:
        'The user it belongs to; supplied, each rule condition is explained clause by clause against them.',
    },
    isCurrentGroup: {
      description:
        'Whether this group is the one being browsed elsewhere in the panel — highlights the row and adds an "On page" badge.',
    },
    expanded: {
      description:
        'Whether the disclosure is open. Owned by the pane, so filtering cannot close a row.',
    },
    onToggle: { description: "Toggles this row's disclosure, by group id." },
    oktaOrigin: {
      description: 'Origin for the admin-console deep link; the link hides without it.',
    },
    flash: { description: 'One-shot success flash for a group that was just added this session.' },
    appNames: {
      description:
        'Apps this group also grants. **Absent is not empty** — the line is omitted rather than claiming the group grants none.',
    },
    proofEnabled: {
      description: 'Whether the surface can prove a membership at all (a resolver was supplied).',
    },
    proofOutcome: {
      description: "Where this row's proof request has got to, or `undefined` before anyone asked.",
    },
    onProve: {
      description: 'Asks Okta about this one membership — one API call, from a press only.',
    },
  },
} satisfies Meta<typeof GroupMembershipRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A rule-fed membership, collapsed: the name, the source line, and the badge. */
export const Default: Story = {};

// ---------------------------------------------------------------------------
// One story per verdict. Read the badges together: an answer is
// `primary`/`success`, a deduction is `warning` and carries a `?`.
// ---------------------------------------------------------------------------

/** `Rule` — a single rule provably matches this user. */
export const VerdictRule: Story = {};

/** `Rule · 2?` — two candidates, none of them credited. The count is the candidate set. */
export const VerdictRuleAmbiguous: Story = {
  args: { membership: ruleAmbiguous },
};

/** `Direct` — no rule targets the group and every condition was evaluable. */
export const VerdictDirect: Story = {
  args: { membership: direct },
};

/** `Direct?` — the classifier only *likely* thinks this was a manual add. */
export const VerdictDirectDeduced: Story = {
  args: { membership: directDeduced },
};

/** `App` — the application masters the group, which is the whole explanation. */
export const VerdictAppMastered: Story = {
  args: { membership: appMastered },
};

/** `Unresolved` — never classified. Not "direct", and not a failure of the group. */
export const VerdictUnresolved: Story = {
  args: { membership: unresolved },
};

/** Okta's own answer, attached: an unhedged `Rule` on a membership that was `Rule · 2?`. */
export const VerdictProven: Story = {
  args: { membership: proven },
};

// ---------------------------------------------------------------------------
// Disclosure
// ---------------------------------------------------------------------------

/** Closed, which is how every row starts — twelve open clause checklists is the state this avoids. */
export const Collapsed: Story = {
  args: { expanded: false },
};

/**
 * Open: the caveat in full, the rule card with the attributes its condition
 * reads and the clause-by-clause explanation, and the Okta link.
 */
export const Expanded: Story = {
  args: { expanded: true },
};

/** The group being browsed elsewhere in the panel: highlighted, and marked "On page". */
export const CurrentGroupHighlighted: Story = {
  args: { isCurrentGroup: true },
};

/**
 * The one-shot success flash a just-added group plays, so the confirmation lands
 * on the row that changed rather than only in a banner above the fold.
 */
export const RecentlyAddedFlash: Story = {
  args: { membership: direct, flash: true },
  parameters: { motion: 'on' },
};

// ---------------------------------------------------------------------------
// The link across to the Apps pane
// ---------------------------------------------------------------------------

/** `Also grants:` — the caller already knew the answer; this row never fetches it. */
export const WithAppGrants: Story = {
  args: { expanded: true, appNames: ['Salesforce', 'Figma'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Also grants:')).toBeInTheDocument();
  },
};

/**
 * The same row with no `appNames` at all. **Absent is not empty**: the line is
 * gone rather than claiming the group grants nothing.
 */
export const WithoutAppGrants: Story = {
  args: { expanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Also grants:')).toBeNull();
  },
};

// ---------------------------------------------------------------------------
// The four proof states (ADR-0031)
// ---------------------------------------------------------------------------

/** No resolver was supplied, so the row offers no action it could not honour. */
export const ProofDisabled: Story = {
  args: { membership: ruleAmbiguous, expanded: true, proofEnabled: false },
};

/** The action, before anyone has spent the request. One call, from this press only. */
export const ProofIdle: Story = {
  args: { membership: ruleAmbiguous, expanded: true, proofEnabled: true },
};

/** In flight. The button carries its own spinner rather than blanking the row. */
export const ProofPending: Story = {
  args: {
    membership: ruleAmbiguous,
    expanded: true,
    proofEnabled: true,
    proofOutcome: { status: 'pending' },
  },
};

/** Okta answered and named the rule — stated as a fact, in the same vocabulary as the row. */
export const ProofResolved: Story = {
  args: {
    membership: ruleAmbiguous,
    expanded: true,
    proofEnabled: true,
    proofOutcome: { status: 'proven', membership: proven },
  },
};

/**
 * The honest failure mode: Okta was asked and said nothing, so the row's hedged
 * classification stands untouched and the action can be pressed again. It is
 * never rendered as "added directly".
 */
export const ProofUnanswered: Story = {
  args: {
    membership: ruleAmbiguous,
    expanded: true,
    proofEnabled: true,
    proofOutcome: { status: 'unanswered' },
  },
};

/** The disclosure opening, driven from the chevron the way a reader opens it. */
export const OpeningTheDisclosure: Story = {
  args: { expanded: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Show how Engineering Staff was granted',
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(args.onToggle).toHaveBeenCalledWith(ruleExact.group.id);
  },
};

/**
 * The 360px floor, where the group name, the verdict and the "On page" badge
 * share one line and the chevron holds its own column. This is why the verdict
 * labels are two words at most and the candidate count lives in the disclosure.
 */
export const Compact: Story = {
  args: { membership: ruleAmbiguous, isCurrentGroup: true },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};

/**
 * The worst case for the name line: a long group name, both badges, and the
 * narrow floor. The badges wrap under the name rather than squeezing it to a few
 * characters, and neither of them is dropped or clipped. The name still carries
 * `truncate` — its `title` is what makes the full text reachable on hover/focus
 * once the single unbroken token clips (I-011).
 */
export const LongGroupName: Story = {
  args: { membership: longName, isCurrentGroup: true },
  parameters: { viewport: { value: 'sidepanelCompact' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByText(longName.group.profile.name);
    await expect(name).toBeInTheDocument();
    await expect(name).toHaveAttribute('title', longName.group.profile.name);
    await expect(canvas.getByText('Rule · 2?')).toBeInTheDocument();
    await expect(canvas.getByText('On page')).toBeInTheDocument();
  },
};
