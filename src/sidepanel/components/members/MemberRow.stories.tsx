import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { GroupMembership, MemberMfaResult } from '../../../shared/types';
import MemberRow from './MemberRow';
import { mockUsers } from '../../../test/mocks/fixtures';

const activeUser = mockUsers.find((u) => u.status === 'ACTIVE')!;
const suspendedUser = mockUsers.find((u) => u.status === 'SUSPENDED')!;
const deprovisionedUser = mockUsers.find((u) => u.status === 'DEPROVISIONED')!;

const enrolledMfa: MemberMfaResult = {
  userId: activeUser.id,
  factors: [],
  enrolled: true,
  factorCount: 2,
  factorLabels: ['Okta Verify (Fastpass)', 'SMS'],
};

const noFactorsMfa: MemberMfaResult = {
  userId: activeUser.id,
  factors: [],
  enrolled: false,
  factorCount: 0,
  factorLabels: [],
};

/*
  Obviously-fake attribution fixtures. `provenance` is what separates the two:
  Okta's own answer, which the roster read carries for free via
  `expand=group-rules` — so a row that has it never offers "Ask Okta".
*/
const engineeringGroup = {
  id: '00gFAKE1',
  type: 'OKTA_GROUP' as const,
  profile: { name: 'Engineering' },
};

const feedingRule = {
  id: '0prFAKE1',
  name: 'Engineering department',
  status: 'ACTIVE' as const,
  conditionExpression: 'user.department == "Engineering"',
};

/** Okta itself named the rule — a fact, not a deduction. */
const provenMembership: GroupMembership = {
  group: engineeringGroup,
  membershipType: 'RULE_BASED',
  rules: [feedingRule],
  attribution: 'exact',
  provenance: { source: 'okta', rules: [{ id: '0prFAKE1', name: 'Engineering department' }] },
};

/** No embed came back for this member, so the classification is the classifier's. */
const deducedMembership: GroupMembership = {
  group: engineeringGroup,
  membershipType: 'RULE_BASED',
  rules: [feedingRule],
  attribution: 'inferred',
};

/** Single member card: name, email, login, status badge, and (once scanned) MFA factor tags. */
const meta = {
  title: 'Members/MemberRow',
  component: MemberRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Single member card: name, email, login, a status badge, MFA factor tags, and a ' +
          "disclosure carrying the member's profile attributes and an Okta deep link.\n\n" +
          'Memoized for large lists. The status badge maps the user status to a semantic ' +
          'token set (success / warning / danger, neutral fallback). Factor tags — or a ' +
          '"No MFA" badge for 0-factor users — render only once a scan has completed.\n\n' +
          '**The row is not a link.** It used to become one whenever an org origin was ' +
          "known, which foreclosed the disclosure: a chevron inside an anchor is axe's " +
          '`nested-interactive`. The deep link now lives inside the disclosure, where ' +
          '`GroupMembershipRow` and `UserAppRow` already put it.\n\n' +
          '`expanded` is owned by the **list**, not the row, so filtering a row out and ' +
          'back in does not close it.\n\n' +
          'Pass a `membership` and the row also explains **why** this person is in the group: a ' +
          'verdict badge and one source line collapsed, and the full caveat plus one evidence ' +
          'card per attributed rule — its condition checked clause by clause against *this* ' +
          'member — expanded. Those come from the same components ' +
          '`users/GroupMembershipRow` uses for the mirror-image case, so the two surfaces cannot ' +
          'drift into two vocabularies for one fact.\n\n' +
          "**No `groupContext` is passed here.** This surface holds one group's roster, not each " +
          'member\'s complete group list, so `isMemberOf*` clauses read "Cannot be determined" — ' +
          'which is true. A context built from the one group in hand would instead report every ' +
          'other group a member belongs to as a clause they failed (ADR-0021).',
      },
    },
  },
  argTypes: {
    user: { description: 'The member to render.' },
    mfa: { description: "This member's MFA scan result, if available." },
    mfaScanned: {
      description: 'True once an MFA scan has completed, so "No MFA" can show for 0-factor users.',
    },
    oktaOrigin: {
      description:
        "Okta org origin; when set, the disclosure offers a link to the member's Admin Console profile.",
    },
    expanded: { description: "Whether this row's disclosure is open. Owned by the list." },
    onToggle: {
      description: "Called with the member's id when the disclosure control is pressed.",
    },
    membership: {
      description: 'Why this member is in the group. Absent ⇒ the row says nothing about source.',
    },
    onRemove: {
      description: 'Request removal. Omitted ⇒ no control renders — never a disabled one.',
    },
  },
  args: {
    user: activeUser,
    mfaScanned: false,
    oktaOrigin: null,
    expanded: false,
    onToggle: fn(),
  },
} satisfies Meta<typeof MemberRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Active member, no MFA scan run yet — status badge only. */
export const Default: Story = {};

/** Suspended member — warning-colored status badge. */
export const Suspended: Story = {
  args: { user: suspendedUser },
};

/** Deprovisioned member — danger-colored status badge. */
export const Deprovisioned: Story = {
  args: { user: deprovisionedUser },
};

/** MFA scan complete and this member has enrolled factors — factor tags render. */
export const WithMfaFactors: Story = {
  args: { mfaScanned: true, mfa: enrolledMfa },
};

/** MFA scan complete but this member has zero factors — "No MFA" badge renders. */
export const NoMfaEnrolled: Story = {
  args: { mfaScanned: true, mfa: noFactorsMfa },
};

/** With an org origin, the disclosure offers an Admin Console deep link. */
export const WithOktaOrigin: Story = {
  args: { oktaOrigin: 'https://example.okta.com', mfaScanned: true, mfa: enrolledMfa },
};

/**
 * The disclosure open: the member's browseable profile attributes — the same set
 * the composition facets offer, so an odd value here is one you can go and
 * filter on — over the Okta deep link.
 */
export const Expanded: Story = {
  args: {
    expanded: true,
    oktaOrigin: 'https://example.okta.com',
    mfaScanned: true,
    mfa: enrolledMfa,
  },
};

/**
 * The row exposes exactly one interactive control in its header, and it is the
 * disclosure toggle — the regression guard for the anchor this row used to be.
 *
 * This assertion is not redundant with the axe pass. Restoring the old
 * whole-row anchor was tried against this file: **axe flagged nothing** on any
 * of the other stories, and only the structural check below failed. Whatever
 * the addon's `nested-interactive` configuration is, it does not catch a
 * `<button>` inside an `<a>` here, so the shape has to be asserted directly.
 */
export const TogglesFromTheChevronOnly: Story = {
  args: { oktaOrigin: 'https://example.okta.com' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // The violation this row used to have, stated structurally: an interactive
    // control inside an anchor. Asserting "no link anywhere" would be wrong —
    // the disclosure legitimately holds one — and asserting on the closed
    // panel's accessibility would test `inert`'s implementation rather than
    // this row's shape.
    await expect(canvasElement.querySelector('a button')).toBeNull();
    await expect(canvasElement.querySelector('a [role="button"]')).toBeNull();

    const toggle = canvas.getByRole('button', { name: /Show details for/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(args.onToggle).toHaveBeenCalledWith(activeUser.id);
  },
};

/**
 * Okta's own attribution, which the roster read carries for free via
 * `expand=group-rules` — so the row states the rule as a fact and never offers
 * "Ask Okta". Spending a request to re-learn a fact already in hand is exactly
 * what ADR-0031 gates against.
 */
export const ExplainedByOkta: Story = {
  args: { membership: provenMembership, expanded: true, oktaOrigin: 'https://example.okta.com' },
};

/**
 * No embed came back for this member, so the classification is a deduction and
 * the disclosure offers the one call that settles it (ADR-0031). The condition is
 * checked clause by clause against this member; `isMemberOf*` clauses would read
 * "Cannot be determined" here, since a roster does not know each member's other
 * groups.
 */
export const DeducedWithProofOnOffer: Story = {
  args: {
    membership: deducedMembership,
    expanded: true,
    proofEnabled: true,
    onProve: fn(),
    oktaOrigin: 'https://example.okta.com',
  },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Ask Okta' }));
    await expect(args.onProve).toHaveBeenCalledWith(deducedMembership, activeUser.id);
  },
};

/**
 * The remove control sits in the header beside the chevron, not inside the
 * disclosure: a destructive verb a reader has to expand a row to find is worse UX
 * than one in plain sight. Omitting `onRemove` renders no control at all rather
 * than a permanently disabled one (ADR-0039).
 */
export const WithRemove: Story = {
  args: { onRemove: fn() },
  play: async ({ args, canvas }) => {
    const remove = canvas.getByRole('button', { name: /^Remove .* from this group$/ });
    await userEvent.click(remove);
    await expect(args.onRemove).toHaveBeenCalledWith(activeUser);
  },
};
