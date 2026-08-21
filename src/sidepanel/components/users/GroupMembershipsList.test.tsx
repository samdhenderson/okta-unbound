/**
 * Behaviour tests for the Groups pane.
 *
 * Retargeted, not rewritten, when the rung's rows moved into this pane
 * (ADR-0022 §3): every assertion below is the one that was here before, with the
 * queries pointed at where the same fact now lives. The two structural moves are
 * that a row's evidence sits behind a disclosure it names ("Show how {group} was
 * granted") and that ADR-0031's proof action is **inside** that disclosure,
 * renamed "Ask Okta" — so a test that presses it opens the row first, exactly as
 * a reader does.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupMembershipsList from './GroupMembershipsList';
import type { MemberRuleAttribution } from '../../../shared/membership/memberRuleAttribution';
import type { GroupMembership, OktaUser } from '../../../shared/types';

const user: OktaUser = {
  id: '00uFAKE1',
  status: 'ACTIVE',
  profile: {
    login: 'ada@example.com',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    title: 'Intern',
  },
};

/**
 * The shape the Users tab actually supplies: a `FormattedRule`, which carries
 * `conditionExpression` and has no `conditions` object at all.
 */
const formattedRuleMembership: GroupMembership = {
  group: {
    id: '00gFAKE1',
    type: 'OKTA_GROUP',
    profile: { name: 'Engineering' },
  },
  membershipType: 'RULE_BASED',
  attribution: 'exact',
  rules: [
    {
      id: '0prFAKE1',
      name: 'Auto-add Engineers',
      status: 'ACTIVE',
      conditionExpression: 'user.department == "Engineering"',
    },
  ],
};

const base = { memberships: [formattedRuleMembership], isLoading: false };

/** Open one row's disclosure, by the name the chevron announces. */
const openRow = (groupName: string) =>
  userEvent.click(screen.getByRole('button', { name: `Show how ${groupName} was granted` }));

/** One row's subtree, via the row-identity attribute `ListRow` carries. */
const rowFor = (groupId: string): HTMLElement => {
  const row = document.querySelector<HTMLElement>(`[data-group-id="${groupId}"]`);
  if (!row) throw new Error(`no row rendered for group ${groupId}`);
  return row;
};

describe('GroupMembershipsList', () => {
  it('renders the condition of a rule that only carries `conditionExpression`', async () => {
    render(<GroupMembershipsList {...base} user={user} />);
    await openRow('Engineering');

    // Previously this surface rendered nothing at all: it read
    // `rule.conditions.expression.value`, which a FormattedRule never has.
    expect(screen.getByText('user.department == "Engineering"')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  it('names the profile attributes a condition reads, from the parsed condition', async () => {
    render(<GroupMembershipsList {...base} user={user} />);
    await openRow('Engineering');

    expect(screen.getByText('Reads')).toBeInTheDocument();
    expect(screen.getByText('department')).toBeInTheDocument();
  });

  it('reads an attribute named inside a string literal as text, not as an attribute', async () => {
    render(
      <GroupMembershipsList
        {...base}
        user={user}
        memberships={[
          {
            ...formattedRuleMembership,
            rules: [
              {
                ...formattedRuleMembership.rules[0],
                conditionExpression: 'user.department == "user.title"',
              },
            ],
          },
        ]}
      />,
    );
    await openRow('Engineering');

    // One attribute is read; the other is a value the rule compares against.
    expect(screen.getByText('department')).toBeInTheDocument();
    expect(screen.queryByText('title')).not.toBeInTheDocument();
  });

  /**
   * Retargeted for D-001, not weakened (ADR-0022 §3). This case used to reach the
   * unevaluable branch through `isMemberOfGroup("00gFAKE2")`, which the pane can
   * now answer from the user's own membership list — so it would be asserting the
   * bug rather than the invariant. The invariant is unchanged and still pinned,
   * against a condition that stays genuinely unevaluable: the evaluator declines
   * to run tenant-authored regular expressions whatever group list it is handed.
   */
  it('explains an unevaluable condition neutrally rather than as a failure', async () => {
    render(
      <GroupMembershipsList
        {...base}
        user={user}
        memberships={[
          {
            ...formattedRuleMembership,
            rules: [
              {
                ...formattedRuleMembership.rules[0],
                conditionExpression: 'isMemberOfGroupNameRegex("^Eng.*")',
              },
            ],
          },
        ]}
      />,
    );
    await openRow('Engineering');

    expect(screen.getByText('Not evaluated')).toBeInTheDocument();
    expect(screen.queryByText('Fail')).not.toBeInTheDocument();
  });

  /**
   * The deep link is an `EntityLink` (ADR-0030's typed chip) rather than a
   * bespoke "View Rule" button, so it navigates through `NavigationContext`
   * instead of a threaded callback — which is why this surface no longer takes
   * one. Without a provider every kind reports unreachable and the chip degrades
   * to plain text, so what is asserted here is that the rule is still named and
   * still identified as a rule.
   */
  it('states the answer on the row and keeps the evidence collapsed until asked', async () => {
    render(<GroupMembershipsList {...base} user={user} />);

    // The answer is one line, always visible.
    expect(screen.getByText('Added by Rule:')).toBeInTheDocument();

    // The evidence is present but collapsed — this list is as long as the user
    // has groups, and twelve open clause checklists is what it used to cost to
    // find the one row you came for.
    const toggle = screen.getByRole('button', { name: 'Show how Engineering was granted' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(
      screen.getByRole('button', { name: 'Hide how Engineering was granted' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('falls back to the raw condition when no user is supplied to explain it against', async () => {
    render(<GroupMembershipsList {...base} />);
    await openRow('Engineering');

    expect(screen.getByText('user.department == "Engineering"')).toBeInTheDocument();
    expect(screen.queryByText('Pass')).not.toBeInTheDocument();
  });

  it('still reads a raw Okta rule shape, which nests the expression under `conditions`', async () => {
    render(
      <GroupMembershipsList
        {...base}
        user={user}
        memberships={[
          {
            ...formattedRuleMembership,
            rules: [
              {
                id: '0prFAKE1',
                name: 'Auto-add Engineers',
                status: 'ACTIVE',
                conditions: {
                  expression: { value: 'user.title == "Intern"', type: 'urn:okta:expression:1.0' },
                },
              },
            ],
          },
        ]}
      />,
    );
    await openRow('Engineering');

    expect(screen.getByText('user.title == "Intern"')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  it('explains every attributed rule, and never captions a guess as the answer', async () => {
    render(
      <GroupMembershipsList
        {...base}
        user={user}
        memberships={[
          {
            ...formattedRuleMembership,
            attribution: 'ambiguous',
            rules: [
              {
                id: '0prFAKE1',
                name: 'Auto-add Engineers',
                status: 'ACTIVE',
                conditionExpression: 'user.department == "Engineering"',
              },
              {
                id: '0prFAKE2',
                name: 'On-call rotation',
                status: 'ACTIVE',
                // Retargeted for D-001 for the same reason as the case above:
                // an `isMemberOfGroup` call is now answerable from the pane's own
                // membership list, so it no longer exercises "not evaluated".
                conditionExpression: 'isMemberOfGroupNameRegex("^On-call.*")',
              },
            ],
          },
        ]}
      />,
    );
    await openRow('Engineering');

    // The caption is stated ONCE, on the row's source line, rather than repeated
    // per rule — the hedge belongs to the answer, not to each piece of evidence,
    // and stacking it three times for one hedged answer was how this row used to
    // read. Both rules are still named and still explained; none is credited.
    expect(screen.getByText('Possible rule:')).toBeInTheDocument();
    expect(screen.queryByText('Added by Rule:')).not.toBeInTheDocument();
    expect(screen.getByText(/Auto-add Engineers, On-call rotation/)).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.getByText('Not evaluated')).toBeInTheDocument();
  });

  it('says a rule carries no condition instead of implying it matches nothing', async () => {
    render(
      <GroupMembershipsList
        {...base}
        user={user}
        memberships={[
          {
            ...formattedRuleMembership,
            rules: [{ id: '0prFAKE1', name: 'Auto-add Engineers', status: 'ACTIVE' }],
          },
        ]}
      />,
    );
    await openRow('Engineering');

    expect(screen.getByText(/carries no condition expression/)).toBeInTheDocument();
    expect(screen.queryByText('Fail')).not.toBeInTheDocument();
  });
});

/**
 * D-001. This pane holds the user's whole group list, so a rule clause asking
 * whether they are in some *other* group is a question it can answer — yet every
 * `isMemberOf*` clause here used to render "Cannot be determined" while Compare
 * Users, handed the identical rule and user, resolved it. These pin the wiring
 * that closes that gap, and the two ways it could go wrong: a filtered view must
 * not narrow the context, and a clause the evaluator genuinely declines must stay
 * unevaluated.
 */
describe('GroupMembershipsList — isMemberOf* resolves against the loaded memberships', () => {
  /** The rule-based row, whose condition asks about a group the user is also in. */
  const gatedByPeerGroup: GroupMembership = {
    ...formattedRuleMembership,
    rules: [
      {
        ...formattedRuleMembership.rules[0],
        conditionExpression: 'isMemberOfAnyGroup("00gFAKE2")',
      },
    ],
  };

  /** The peer membership that answers the clause above. */
  const peerGroup: GroupMembership = {
    group: { id: '00gFAKE2', type: 'OKTA_GROUP', profile: { name: 'Ops Handbook' } },
    membershipType: 'DIRECT',
    rules: [],
    attribution: 'exact',
  };

  const renderPane = (memberships: GroupMembership[]) =>
    render(<GroupMembershipsList {...base} user={user} memberships={memberships} />);

  it('resolves a clause about a group the user is in, instead of declining to answer', async () => {
    renderPane([gatedByPeerGroup, peerGroup]);
    await openRow('Engineering');

    const row = within(rowFor('00gFAKE1'));
    expect(row.getByText('Pass')).toBeInTheDocument();
    expect(row.getByText('Rule matches this user')).toBeInTheDocument();
    expect(row.queryByText('Cannot be determined')).not.toBeInTheDocument();
    expect(row.queryByText('Not evaluated')).not.toBeInTheDocument();
  });

  /**
   * The other half of ADR-0021's two-valued contract: given the user's complete
   * list, a group absent from it is a confident "they are not in it". Reporting
   * that as `fail` is only correct *because* the list is complete.
   */
  it('reports a group the user is genuinely not in as a fail, not as unknown', async () => {
    renderPane([
      {
        ...formattedRuleMembership,
        rules: [
          {
            ...formattedRuleMembership.rules[0],
            conditionExpression: 'isMemberOfAnyGroup("00gFAKEabsent")',
          },
        ],
      },
      peerGroup,
    ]);
    await openRow('Engineering');

    const row = within(rowFor('00gFAKE1'));
    expect(row.getByText('Fail')).toBeInTheDocument();
    expect(row.getByText('Rule does not match')).toBeInTheDocument();
  });

  /**
   * The hazard the wiring has to avoid. The context is built from `memberships`,
   * never from the filtered `visible` list — a subset would report a group the
   * user really is in as a clause they failed, which is worse than the "Cannot be
   * determined" this whole item replaces.
   */
  it('does not narrow the context when a filter hides the group a clause asks about', async () => {
    renderPane([gatedByPeerGroup, peerGroup]);

    await userEvent.type(screen.getByLabelText('Filter group memberships'), 'engineering');
    expect(screen.queryByRole('heading', { name: 'Ops Handbook' })).not.toBeInTheDocument();

    await openRow('Engineering');

    // Out of view is not out of the group.
    expect(within(rowFor('00gFAKE1')).getByText('Pass')).toBeInTheDocument();
  });

  /** Same for a source-bucket pill, which narrows the list a different way. */
  it('does not narrow the context when a bucket pill hides that group', async () => {
    renderPane([gatedByPeerGroup, peerGroup]);

    await userEvent.click(screen.getByRole('button', { name: 'Rule' }));
    expect(screen.queryByRole('heading', { name: 'Ops Handbook' })).not.toBeInTheDocument();

    await openRow('Engineering');

    expect(within(rowFor('00gFAKE1')).getByText('Pass')).toBeInTheDocument();
  });

  /**
   * The fallback stays exactly as it was. A group list answers `isMemberOf*`; it
   * does not answer a clause the evaluator refuses to run, so this one still
   * declines — with the reason spelled out, and never as a failure.
   */
  it('still declines a clause no group list could answer', async () => {
    renderPane([
      {
        ...formattedRuleMembership,
        rules: [
          {
            ...formattedRuleMembership.rules[0],
            conditionExpression: 'isMemberOfGroupNameRegex("^Ops.*")',
          },
        ],
      },
      peerGroup,
    ]);
    await openRow('Engineering');

    const row = within(rowFor('00gFAKE1'));
    expect(row.getByText('Not evaluated')).toBeInTheDocument();
    expect(row.getByText('Cannot be determined')).toBeInTheDocument();
    expect(row.queryByText('Fail')).not.toBeInTheDocument();
  });
});

/**
 * The row's verdict badge — one word standing in for a whole hedged sentence.
 * `membershipVerdict.test.ts` pins the mapping itself; these pin that the badge
 * reaches the reader and that the two things it replaced are gone.
 */
describe('GroupMembershipsList — the row says one thing about provenance', () => {
  it('wears one verdict badge for the membership', () => {
    render(<GroupMembershipsList {...base} user={user} />);

    // Scoped to the row: "Rule" is also a filter pill in the pane header.
    expect(within(rowFor('00gFAKE1')).getByText('Rule')).toBeInTheDocument();
  });

  it('never shows the raw membership enum or a second group-type badge', () => {
    render(
      <GroupMembershipsList
        {...base}
        user={user}
        memberships={[
          {
            ...formattedRuleMembership,
            group: { id: '00gFAKE9', type: 'APP_GROUP', profile: { name: 'Salesforce Users' } },
            rules: [],
          },
        ]}
      />,
    );

    const row = within(rowFor('00gFAKE9'));
    expect(row.queryByText('RULE BASED')).not.toBeInTheDocument();
    expect(row.queryByText('APP_GROUP')).not.toBeInTheDocument();
    // Group type is only interesting when it explains the source, which the
    // `App` verdict already does.
    expect(row.getByText('App')).toBeInTheDocument();
  });

  it('marks the group being browsed elsewhere rather than repeating its name', () => {
    render(
      <GroupMembershipsList
        {...base}
        user={user}
        currentGroupId={formattedRuleMembership.group.id}
      />,
    );

    expect(screen.getByText('On page')).toBeInTheDocument();
  });
});

/**
 * The pane's accounting line and its filters. The summary is the one number a
 * reader is invited to trust, so what it must never do is drop a category.
 */
describe('GroupMembershipsList — the pane header', () => {
  const memberships: GroupMembership[] = [
    formattedRuleMembership,
    {
      group: { id: '00gFAKE2', type: 'OKTA_GROUP', profile: { name: 'Ops Handbook' } },
      membershipType: 'DIRECT',
      rules: [],
      attribution: 'exact',
    },
    {
      group: { id: '00gFAKE3', type: 'APP_GROUP', profile: { name: 'Salesforce Users' } },
      membershipType: 'RULE_BASED',
      rules: [],
      attribution: 'exact',
    },
    {
      group: { id: '00gFAKE4', type: 'OKTA_GROUP', profile: { name: 'Finance Readers' } },
      membershipType: 'UNKNOWN',
      rules: [],
      attribution: 'ambiguous',
    },
  ];

  it('names every non-zero bucket, so no membership goes unaccounted for', () => {
    render(<GroupMembershipsList {...base} user={user} memberships={memberships} />);

    expect(
      screen.getByText('1 by rule · 1 direct · 1 app-mastered · 1 unresolved'),
    ).toBeInTheDocument();
  });

  it('omits a bucket with no rows rather than printing a zero', () => {
    render(<GroupMembershipsList {...base} user={user} />);

    expect(screen.getByText('1 by rule')).toBeInTheDocument();
  });

  it('filters on the group name', async () => {
    render(<GroupMembershipsList {...base} user={user} memberships={memberships} />);

    await userEvent.type(screen.getByLabelText('Filter group memberships'), 'ops');

    expect(screen.getByRole('heading', { name: 'Ops Handbook' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Engineering' })).not.toBeInTheDocument();
  });

  it('filters on the rule that granted the membership, not just the group name', async () => {
    render(<GroupMembershipsList {...base} user={user} memberships={memberships} />);

    await userEvent.type(screen.getByLabelText('Filter group memberships'), 'auto-add');

    expect(screen.getByRole('heading', { name: 'Engineering' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ops Handbook' })).not.toBeInTheDocument();
  });

  it('narrows to one source bucket when a pill is pressed', async () => {
    render(<GroupMembershipsList {...base} user={user} memberships={memberships} />);

    await userEvent.click(screen.getByRole('button', { name: 'Direct' }));

    expect(screen.getByRole('heading', { name: 'Ops Handbook' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Engineering' })).not.toBeInTheDocument();
  });

  it('offers the way back when a filter matches nothing', async () => {
    render(<GroupMembershipsList {...base} user={user} memberships={memberships} />);

    await userEvent.type(screen.getByLabelText('Filter group memberships'), 'no-such-group');
    expect(screen.getByText('No memberships match')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByRole('heading', { name: 'Engineering' })).toBeInTheDocument();
  });

  it('says the user is in no groups at all, which is not the same as a filter matching nothing', () => {
    render(<GroupMembershipsList {...base} user={user} memberships={[]} />);

    expect(screen.getByText('This user is not a member of any groups')).toBeInTheDocument();
    expect(screen.queryByText('No memberships match')).not.toBeInTheDocument();
    // Nothing to filter, so the header offers no filter.
    expect(screen.queryByLabelText('Filter group memberships')).not.toBeInTheDocument();
  });

  it('keeps a row open across a filter change', async () => {
    render(<GroupMembershipsList {...base} user={user} memberships={memberships} />);

    await openRow('Engineering');
    await userEvent.type(screen.getByLabelText('Filter group memberships'), 'engineering');

    expect(
      screen.getByRole('button', { name: 'Hide how Engineering was granted' }),
    ).toBeInTheDocument();
  });
});

/**
 * The hole this surface carried for a long time: only `RULE_BASED`-with-rules and
 * `DIRECT` drew an explanation, so three real membership shapes fell past every
 * branch and rendered blank space — while the comparison view, given the identical
 * membership, showed a full sentence. These pin that a reader is never shown
 * nothing, and that the wording is the shared one rather than a second opinion.
 */
describe('GroupMembershipsList — memberships with no rule to name', () => {
  const withSource = (over: Partial<GroupMembership>) =>
    render(
      <GroupMembershipsList
        {...base}
        user={user}
        memberships={[{ ...formattedRuleMembership, ...over }]}
      />,
    );

  it('says the source was never determined rather than showing nothing', () => {
    withSource({ membershipType: 'UNKNOWN', rules: [], attribution: 'ambiguous' });

    expect(screen.getByText('Source not determined')).toBeInTheDocument();
  });

  it('never calls an unclassified membership a manual add', () => {
    withSource({ membershipType: 'UNKNOWN', rules: [], attribution: 'ambiguous' });

    expect(screen.queryByText(/added directly/i)).not.toBeInTheDocument();
  });

  it('names an app-mastered group as application-managed', () => {
    withSource({
      group: { id: '00gFAKE9', type: 'APP_GROUP', profile: { name: 'Salesforce Users' } },
      rules: [],
    });

    expect(screen.getByText('Managed by app')).toBeInTheDocument();
  });

  it('admits when a rule-managed membership has no rule attributed to it', () => {
    withSource({ rules: [] });

    expect(screen.getByText('Rule-managed, rule not identified')).toBeInTheDocument();
  });

  it('explains a direct membership in the shared wording', () => {
    withSource({ membershipType: 'DIRECT', rules: [] });

    expect(screen.getByText('Added directly')).toBeInTheDocument();
  });

  it('softens a direct membership the classifier only deduced', () => {
    withSource({ membershipType: 'DIRECT', rules: [], attribution: 'inferred' });

    expect(screen.getByText('Likely added directly')).toBeInTheDocument();
  });

  /**
   * The caveat a reader needs before acting on any of these is longer than the
   * line itself, so it rides on the verdict badge's `title` rather than being
   * dropped.
   */
  it('carries the full caveat on hover', () => {
    withSource({ membershipType: 'UNKNOWN', rules: [], attribution: 'ambiguous' });

    expect(screen.getByTitle(/the answer is missing/i)).toBeInTheDocument();
  });
});

/**
 * The per-row "Ask Okta" action (ADR-0031). Every other line on this surface is a
 * deduction — this is the one call that replaces one of them with Okta's own
 * answer, and the assertions below are about what the row is then allowed to
 * claim.
 *
 * The most important one is the negative: Okta *saying nothing* must not read
 * like Okta saying "no rule". They are one API failure apart.
 */
describe('GroupMembershipsList — proving one membership against Okta', () => {
  const guessed: GroupMembership = {
    ...formattedRuleMembership,
    attribution: 'ambiguous',
  };

  const withProof = (
    onProveMembershipSource: (groupId: string) => Promise<MemberRuleAttribution>,
    memberships: GroupMembership[] = [guessed],
  ) =>
    render(
      <GroupMembershipsList
        {...base}
        user={user}
        memberships={memberships}
        onProveMembershipSource={onProveMembershipSource}
      />,
    );

  const askOkta = () => screen.getAllByRole('button', { name: /Ask Okta/ });

  it('offers no action at all unless a resolver is supplied — it is never free', async () => {
    render(<GroupMembershipsList {...base} user={user} />);
    await openRow('Engineering');

    expect(screen.queryByRole('button', { name: /Ask Okta/ })).not.toBeInTheDocument();
  });

  /**
   * The action is inside the disclosure. `inert` is what holds it out of the tab
   * order and the accessibility tree while the row is closed — jsdom does not
   * implement that, so the attribute itself is what this asserts.
   */
  it('is unreachable until the row is opened', async () => {
    withProof(vi.fn().mockResolvedValue({ state: 'no-rules' as const }));

    expect(askOkta()[0].closest('[inert]')).not.toBeNull();

    await openRow('Engineering');

    expect(askOkta()[0].closest('[inert]')).toBeNull();
  });

  it('asks about one group only when clicked, and only that group', async () => {
    const onProve = vi.fn().mockResolvedValue({ state: 'no-rules' as const });
    withProof(onProve, [
      guessed,
      {
        ...guessed,
        group: { ...guessed.group, id: '00gFAKE2', profile: { name: 'Ops Handbook' } },
      },
    ]);

    // Two rows, two offers, and nothing asked until one is pressed.
    expect(askOkta()).toHaveLength(2);
    expect(onProve).not.toHaveBeenCalled();

    await openRow('Engineering');
    await userEvent.click(within(rowFor('00gFAKE1')).getByRole('button', { name: /Ask Okta/ }));

    expect(onProve).toHaveBeenCalledTimes(1);
    expect(onProve).toHaveBeenCalledWith(guessed.group.id);
  });

  it('states Okta’s named rule as a fact once proven', async () => {
    withProof(() =>
      Promise.resolve({ state: 'rules', rules: [{ id: '0prFAKEhr', name: 'HR sync' }] }),
    );

    await openRow('Engineering');
    await userEvent.click(askOkta()[0]);

    expect(await screen.findByText(/Okta confirms: added by rule: HR sync/)).toBeInTheDocument();
  });

  it('states an Okta "no rule" answer as an authoritative manual add', async () => {
    withProof(() => Promise.resolve({ state: 'no-rules' }));

    await openRow('Engineering');
    await userEvent.click(askOkta()[0]);

    expect(await screen.findByText('Okta confirms: added directly')).toBeInTheDocument();
  });

  // The distinction the whole feature turns on.
  it('never turns "Okta said nothing" into "Okta says no rule"', async () => {
    withProof(() => Promise.resolve({ state: 'unknown' }));

    await openRow('Engineering');
    await userEvent.click(askOkta()[0]);

    expect(await screen.findByText(/Okta did not answer/)).toBeInTheDocument();
    expect(screen.queryByText(/Okta confirms/)).not.toBeInTheDocument();
  });

  it('treats a failed request the same way — no answer, not an answer', async () => {
    withProof(() => Promise.reject(new Error('rate limited')));

    await openRow('Engineering');
    await userEvent.click(askOkta()[0]);

    expect(await screen.findByText(/Okta did not answer/)).toBeInTheDocument();
    expect(screen.queryByText(/Okta confirms/)).not.toBeInTheDocument();
    // The row's own hedged classification is untouched by the failure.
    expect(screen.getAllByText('Possible rule:')).toHaveLength(1);
  });

  it('leaves the per-rule explanation standing beside Okta’s answer', async () => {
    withProof(() =>
      Promise.resolve({ state: 'rules', rules: [{ id: '0prFAKEhr', name: 'HR sync' }] }),
    );

    await openRow('Engineering');
    await userEvent.click(askOkta()[0]);
    await screen.findByText(/Okta confirms/);

    // The clause-by-clause explanation of the candidate rule is still there: the
    // proof adds Okta's answer, it does not delete the evidence behind the guess.
    expect(screen.getByText('user.department == "Engineering"')).toBeInTheDocument();
    expect(screen.getByText('Possible rule:')).toBeInTheDocument();
  });

  it('carries the full caveat about whose answer it is on hover', async () => {
    withProof(() => Promise.resolve({ state: 'no-rules' }));

    await openRow('Engineering');
    await userEvent.click(askOkta()[0]);

    expect(
      await screen.findByTitle(/Okta answering rather than the classifier/),
    ).toBeInTheDocument();
  });
});
