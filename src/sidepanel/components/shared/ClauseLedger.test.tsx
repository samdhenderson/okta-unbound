/**
 * Behavior tests for {@link ClauseLedger} (and, through it,
 * {@link useClauseLedger}): the raw/tree toggle, the Kleene-shortcut note, the
 * four-attribute-states evidence line, and the reason sentence sourced from a
 * reason code rather than hardcoded prose.
 *
 * Fixtures are built by calling `explainRuleExpression` with fake users/groups
 * (`docs/testing.md`) — obviously fake ids and emails only.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClauseLedger from './ClauseLedger';
import { UNEVALUABLE_REASON_TEXT } from '../../../shared/rules/unevaluableReasonText';
import type { OktaUser } from '../../../shared/types';
import type { RuleGroupContext } from '../../../shared/ruleEvaluator';

const user: OktaUser = {
  id: '00uFAKELEDGERTEST1',
  status: 'ACTIVE',
  profile: {
    login: 'ada@example.com',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    title: 'Intern',
    projectCode: null,
  },
};

const groups: RuleGroupContext = [{ id: '00gFAKELEDGERTEST1', name: 'Engineering' }];

describe('ClauseLedger', () => {
  it('shows the tree view by default and switches to the raw view on toggle', async () => {
    const user2 = userEvent.setup();
    render(<ClauseLedger expression='user.department == "Engineering"' user={user} />);

    // Tree view: the clause row's status chip is present.
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.queryByText('Resolved value')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Raw expression' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user2.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Resolved value')).toBeInTheDocument();
    expect(screen.queryByText('Pass')).not.toBeInTheDocument();
  });

  it('opens straight to the raw view when defaultShowRaw is set', () => {
    render(
      <ClauseLedger expression='user.department == "Engineering"' user={user} defaultShowRaw />,
    );

    expect(screen.getByRole('button', { name: 'Raw expression' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Resolved value')).toBeInTheDocument();
  });

  it('states the Kleene-shortcut note when a passing alternative already decides an OR', () => {
    render(
      <ClauseLedger
        expression='user.department == "Engineering" || isMemberOfGroupNameRegex("(?=.*Ops).*")'
        user={user}
        groupContext={groups}
      />,
    );

    expect(
      screen.getByText(
        'One alternative passes, so the OR passes — the unevaluated check cannot change it.',
      ),
    ).toBeInTheDocument();
  });

  it('never states a Kleene note when every child was fully evaluated', () => {
    render(
      <ClauseLedger
        expression='user.department == "Engineering" && user.title == "Staff Engineer"'
        user={user}
      />,
    );

    expect(screen.queryByText(/so the (OR|AND) (passes|fails)/)).not.toBeInTheDocument();
  });

  it('renders an absent attribute as the words "not set", never a dash or zero', () => {
    render(
      <ClauseLedger expression='user.costCenter == "CC-9"' user={user} groupContext={groups} />,
    );

    expect(screen.getByText('not set')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('renders an explicit null attribute as the word "null", distinct from absent', () => {
    render(
      <ClauseLedger
        expression='user.projectCode == "Platform"'
        user={user}
        groupContext={groups}
      />,
    );

    expect(screen.getByText('null')).toBeInTheDocument();
    expect(screen.queryByText('not set')).not.toBeInTheDocument();
  });

  it("sources the not-evaluated reason from the leaf's reasonCode, never a hardcoded sentence", () => {
    render(<ClauseLedger expression='isMemberOfGroup("00gFAKELEDGERTEST9")' user={user} />);

    // No groupContext supplied → reasonCode is `group-membership-fn`. Asserted
    // against the reason-text table itself, not a copy of its prose, so this
    // test cannot drift from what the copy actually says.
    expect(screen.getByText(UNEVALUABLE_REASON_TEXT['group-membership-fn'])).toBeInTheDocument();
  });

  it('ticks a satisfied group reference only when a groupContext was supplied', () => {
    const { rerender } = render(
      <ClauseLedger
        expression='isMemberOfAnyGroup("00gFAKELEDGERTEST1")'
        user={user}
        groupContext={groups}
      />,
    );

    // With context: the clause resolves to a real verdict, so its reference row
    // is rendered — its group name and a copy-id control are both present.
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy group id/ })).toBeInTheDocument();

    // Without context: the same clause cannot resolve at all, so no reference
    // row (and therefore no tick either way) is rendered.
    rerender(<ClauseLedger expression='isMemberOfAnyGroup("00gFAKELEDGERTEST1")' user={user} />);
    expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copy group id/ })).not.toBeInTheDocument();
  });

  it('names the whole-rule verdict and never rounds a match down in the summary chip', () => {
    render(<ClauseLedger expression='user.department == "Engineering"' user={user} />);
    expect(screen.getByText('Rule matches this user')).toBeInTheDocument();
  });

  it('names a genuine no-match verdict, distinct from an unevaluable one', () => {
    render(<ClauseLedger expression='user.title == "Staff Engineer"' user={user} />);
    expect(screen.getByText('Rule does not match')).toBeInTheDocument();
  });

  it('names an unevaluable verdict as "cannot be determined", never as a match or no-match', () => {
    render(<ClauseLedger expression="user.department ==" user={user} />);
    expect(screen.getByText('Cannot be determined')).toBeInTheDocument();
  });

  it('states the evaluated/not-evaluated/needs-group-context counts above the tree', () => {
    render(
      <ClauseLedger
        expression={
          'user.department == "Engineering" && user.title != "Intern" && isMemberOfGroup("00gFAKELEDGERTEST9")'
        }
        user={user}
      />,
    );

    expect(screen.getByText(/2 of 3 clauses evaluated/)).toBeInTheDocument();
    expect(screen.getByText(/1 not evaluated/)).toBeInTheDocument();
    expect(screen.getByText(/1 needs group context/)).toBeInTheDocument();
  });

  it('treats an absent condition as not evaluated, never as "matches nothing"', () => {
    render(<ClauseLedger expression="" user={user} />);

    expect(screen.getByText(UNEVALUABLE_REASON_TEXT['empty'])).toBeInTheDocument();
    expect(screen.queryByText('Fail')).not.toBeInTheDocument();
  });

  it('reports an unparseable condition as not evaluated, with its own reason', () => {
    render(<ClauseLedger expression="user.department ==" user={user} />);

    expect(screen.getByText(UNEVALUABLE_REASON_TEXT['parse-error'])).toBeInTheDocument();
    expect(screen.queryByText('Fail')).not.toBeInTheDocument();
  });

  it('discloses truncation via an AlertMessage when the clause cap drops siblings', () => {
    // 70 flat OR'd clauses — past the explainer's default 64-clause cap — with no
    // nesting at all, so this exercises the sibling-drop path rather than the
    // depth-collapse path.
    const hugeExpression = Array.from(
      { length: 70 },
      (_, i) => `user.department == "Team ${i}"`,
    ).join(' || ');

    render(<ClauseLedger expression={hugeExpression} user={user} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
