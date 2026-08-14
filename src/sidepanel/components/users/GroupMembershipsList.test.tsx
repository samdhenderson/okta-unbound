import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupMembershipsList from './GroupMembershipsList';
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

describe('GroupMembershipsList', () => {
  it('renders the condition of a rule that only carries `conditionExpression`', () => {
    render(<GroupMembershipsList {...base} user={user} />);

    // Previously this surface rendered nothing at all: it read
    // `rule.conditions.expression.value`, which a FormattedRule never has.
    expect(screen.getByText('user.department == "Engineering"')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  it('explains an unevaluable condition neutrally rather than as a failure', () => {
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
                conditionExpression: 'isMemberOfGroup("00gFAKE2")',
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText('Not evaluated')).toBeInTheDocument();
    expect(screen.queryByText('Fail')).not.toBeInTheDocument();
  });

  it('keeps the View Rule deep link beside the explanation', async () => {
    const onNavigateToRule = vi.fn();
    render(<GroupMembershipsList {...base} user={user} onNavigateToRule={onNavigateToRule} />);

    await userEvent.click(screen.getByRole('button', { name: 'View Rule' }));
    expect(onNavigateToRule).toHaveBeenCalledWith('0prFAKE1');
  });

  it('falls back to the raw condition when no user is supplied to explain it against', () => {
    render(<GroupMembershipsList {...base} />);

    expect(screen.getByText('user.department == "Engineering"')).toBeInTheDocument();
    expect(screen.queryByText('Pass')).not.toBeInTheDocument();
  });

  it('still reads a raw Okta rule shape, which nests the expression under `conditions`', () => {
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

    expect(screen.getByText('user.title == "Intern"')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  it('explains every attributed rule, and never captions a guess as the answer', () => {
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
                conditionExpression: 'isMemberOfGroup("00gFAKE2")',
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getAllByText('Possible rule:')).toHaveLength(2);
    expect(screen.queryByText('Added by Rule:')).not.toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.getByText('Not evaluated')).toBeInTheDocument();
  });

  it('says a rule carries no condition instead of implying it matches nothing', () => {
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

    expect(screen.getByText(/carries no condition expression/)).toBeInTheDocument();
    expect(screen.queryByText('Fail')).not.toBeInTheDocument();
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

  /**
   * `DIRECT` is deliberately absent from this describe: it already had its own
   * sentence and still uses it (pinned by `UsersTab.test.tsx`). This change only
   * fills the branches that rendered nothing.
   */

  /**
   * The caveat a reader needs before acting on any of these is longer than the
   * line itself, so it rides on `title` rather than being dropped.
   */
  it('carries the full caveat on hover', () => {
    withSource({ membershipType: 'UNKNOWN', rules: [], attribution: 'ambiguous' });

    expect(screen.getByTitle(/the answer is missing/i)).toBeInTheDocument();
  });
});
