import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ClauseChecklist from './ClauseChecklist';
import type { OktaUser } from '../../../../shared/types';

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
    // A custom profile attribute whose value really is null (not merely absent).
    projectCode: null,
  },
};

/** The row (`<li>`) whose clause text is `expression`. */
const rowFor = (expression: string): HTMLElement => {
  const code = screen.getByText(expression);
  const row = code.closest('li');
  if (!row) throw new Error(`no clause row for ${expression}`);
  return row;
};

describe('ClauseChecklist', () => {
  it('reports a clause that resolved to true as a pass, with the value that drove it', () => {
    render(<ClauseChecklist expression='user.department == "Engineering"' user={user} />);

    const row = rowFor('user.department == "Engineering"');
    expect(within(row).getByText('Pass')).toBeInTheDocument();
    expect(within(row).getByText('"Engineering"')).toBeInTheDocument();
    expect(screen.getByText(/1 of 1 clause evaluated/)).toBeInTheDocument();
  });

  it('reports a clause that resolved to false as a fail', () => {
    render(<ClauseChecklist expression='user.title == "Staff Engineer"' user={user} />);

    expect(within(rowFor('user.title == "Staff Engineer"')).getByText('Fail')).toBeInTheDocument();
    expect(screen.getByText('Rule does not match')).toBeInTheDocument();
  });

  it('renders an unevaluable clause neutrally — never as a failure', () => {
    render(<ClauseChecklist expression='isMemberOfGroup("00gFAKE1")' user={user} />);

    const row = rowFor('isMemberOfGroup("00gFAKE1")');
    const status = within(row).getByText('Not evaluated');

    expect(within(row).queryByText('Fail')).not.toBeInTheDocument();
    // Neutral treatment: none of the danger tokens, and no colour-only signal.
    expect(status.className).toContain('neutral');
    expect(status.className).not.toContain('danger');
    expect(within(row).getByText(/Needs the user's full group list/)).toBeInTheDocument();
    expect(screen.getByText(/1 needs group context/)).toBeInTheDocument();
  });

  /**
   * D-001. The neutral row above is what a caller with no group list gets, and it
   * stays that way — the fix is a new *optional* prop, so every existing caller's
   * rendering is byte-identical. Supplied, the same clause carries a real verdict.
   */
  it('leaves isMemberOf* unevaluated when no group context is supplied', () => {
    render(<ClauseChecklist expression='isMemberOfAnyGroup("00gFAKE1")' user={user} />);

    expect(
      within(rowFor('isMemberOfAnyGroup("00gFAKE1")')).getByText('Not evaluated'),
    ).toBeVisible();
    expect(screen.getByText('Cannot be determined')).toBeInTheDocument();
  });

  it('resolves isMemberOf* once the user’s complete group list is supplied', () => {
    render(
      <ClauseChecklist
        expression='isMemberOfAnyGroup("00gFAKE1")'
        user={user}
        groupContext={[{ id: '00gFAKE1', name: 'Engineering' }]}
      />,
    );

    expect(within(rowFor('isMemberOfAnyGroup("00gFAKE1")')).getByText('Pass')).toBeInTheDocument();
    expect(screen.getByText('Rule matches this user')).toBeInTheDocument();
    expect(screen.queryByText(/needs group context/)).not.toBeInTheDocument();
  });

  /** A group absent from a *complete* list is a confident "not a member" (ADR-0021). */
  it('fails an isMemberOf* clause naming a group the supplied list does not hold', () => {
    render(
      <ClauseChecklist
        expression='isMemberOfAnyGroup("00gFAKE9")'
        user={user}
        groupContext={[{ id: '00gFAKE1', name: 'Engineering' }]}
      />,
    );

    expect(within(rowFor('isMemberOfAnyGroup("00gFAKE9")')).getByText('Fail')).toBeInTheDocument();
    expect(screen.getByText('Rule does not match')).toBeInTheDocument();
  });

  /** A group list cannot answer a pattern the evaluator declines to run. */
  it('still declines isMemberOfGroupNameRegex even with a group context', () => {
    render(
      <ClauseChecklist
        expression='isMemberOfGroupNameRegex("^Eng.*")'
        user={user}
        groupContext={[{ id: '00gFAKE1', name: 'Engineering' }]}
      />,
    );

    const row = rowFor('isMemberOfGroupNameRegex("^Eng.*")');
    expect(within(row).getByText('Not evaluated')).toBeInTheDocument();
    expect(
      within(row).getByText(/regular expression, which this panel does not run/),
    ).toBeVisible();
  });

  it('keeps evaluating sibling clauses around an unevaluable one', () => {
    render(
      <ClauseChecklist
        expression={
          'user.department == "Engineering" && user.title != "Intern" && isMemberOfGroup("00gFAKE1")'
        }
        user={user}
      />,
    );

    expect(
      within(rowFor('user.department == "Engineering"')).getByText('Pass'),
    ).toBeInTheDocument();
    expect(within(rowFor('user.title != "Intern"')).getByText('Fail')).toBeInTheDocument();
    expect(within(rowFor('isMemberOfGroup("00gFAKE1")')).getByText('Not evaluated')).toBeVisible();
    expect(screen.getByText(/2 of 3 clauses evaluated/)).toBeInTheDocument();
    expect(screen.getByText(/1 not evaluated/)).toBeInTheDocument();
  });

  it('distinguishes a value that could not be read from one that resolved to null', () => {
    render(
      <ClauseChecklist
        expression={'isMemberOfGroup("00gFAKE1") || user.projectCode == "Platform"'}
        user={user}
      />,
    );

    const unreadable = rowFor('isMemberOfGroup("00gFAKE1")');
    expect(within(unreadable).getByText(/no value could be read/)).toBeInTheDocument();
    expect(within(unreadable).queryByText('null')).not.toBeInTheDocument();

    const resolvedNull = rowFor('user.projectCode == "Platform"');
    expect(within(resolvedNull).getByText('null')).toBeInTheDocument();
    expect(within(resolvedNull).getByText(/its value is null/)).toBeInTheDocument();
    expect(within(resolvedNull).queryByText(/no value could be read/)).not.toBeInTheDocument();
  });

  it('discloses truncation instead of showing a silent partial list', () => {
    render(
      <ClauseChecklist
        expression={'user.department == "A" || user.department == "B" || user.department == "C"'}
        user={user}
        maxClauses={2}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Only the first 2 clauses are shown');
    expect(screen.queryByText('user.department == "C"')).not.toBeInTheDocument();
  });

  it('treats an absent condition as not evaluated, not as "matches nothing"', () => {
    render(<ClauseChecklist expression="" user={user} />);

    expect(screen.getByText(/could not be checked clause by clause/)).toBeInTheDocument();
    expect(screen.getByText(/carries no condition expression/)).toBeInTheDocument();
    expect(screen.queryByText('Fail')).not.toBeInTheDocument();
  });

  it('shows no clause as failing when the condition cannot be parsed', () => {
    render(<ClauseChecklist expression="user.department ==" user={user} />);

    expect(screen.getByText(/could not be checked clause by clause/)).toBeInTheDocument();
    expect(screen.getByText(/could not be parsed/)).toBeInTheDocument();
    expect(screen.queryByText('Fail')).not.toBeInTheDocument();
  });

  it('renders untrusted expression text as text, not markup', () => {
    const expression = 'user.department == "<img src=x onerror=alert(1)>"';
    const { container } = render(<ClauseChecklist expression={expression} user={user} />);

    expect(screen.getByText(expression)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});
