import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CauseWorklist from './CauseWorklist';
import type { AccessCause, UndeterminedReason } from './accessCause';
import type { ClauseExplanation } from '../../../../shared/rules/explainExpression';

/**
 * Phase 3.7 — the cause worklist.
 *
 * Fixtures are hand-built rather than produced by `classifyAccessCauses`: the view
 * is what is under test, and the classifier is a separate seam that currently
 * returns `cannot-determine` for everything.
 *
 * The load-bearing property pinned below is that **`cannot-determine` never folds
 * into another group, is never hidden, and is never styled as a failure** — not
 * even as a single row beside a large one.
 */

const failing = (expressionText: string, resolvedValue: string): ClauseExplanation => ({
  expressionText,
  resolvedValue,
  status: 'fail',
});

const blocked = (id: string, name: string): AccessCause => ({
  groupId: id,
  groupName: name,
  remedy: 'blocked-by-attribute',
  ruleId: `0pr${id}`,
  ruleName: 'Platform engineers',
  failingClauses: [failing('user.department == "Platform"', 'Support')],
});

const undetermined = (
  id: string,
  name: string,
  undeterminedReason: UndeterminedReason,
): AccessCause => ({
  groupId: id,
  groupName: name,
  remedy: 'cannot-determine',
  undeterminedReason,
  failingClauses: [],
});

const names = { contextName: 'Jane Doe', comparedName: 'John Smith' };

/** The `<section>` for a remedy, found through its heading. */
const groupFor = (heading: string): HTMLElement => {
  const section = screen.getByRole('heading', { name: heading }).closest('section');
  if (!section) throw new Error(`no group for "${heading}"`);
  return section;
};

describe('CauseWorklist — cannot-determine is a first-class group', () => {
  it('gives a single cannot-determine row its own group beside a large blocked group', () => {
    const causes: AccessCause[] = [
      ...Array.from({ length: 8 }, (_, i) => blocked(`00gFAKEB${i}`, `Squad ${i + 1}`)),
      undetermined('00gFAKEU1', 'Regional Leads', 'unevaluable-clause'),
    ];

    render(<CauseWorklist {...names} causes={causes} />);

    const investigate = groupFor('Needs investigation');
    expect(investigate).toBeInTheDocument();
    expect(within(investigate).getByText('Regional Leads')).toBeInTheDocument();
    expect(within(investigate).getByText('1 group')).toBeInTheDocument();

    // It did NOT fold into the large group next door.
    const blockedGroup = groupFor('Fix a profile attribute');
    expect(within(blockedGroup).queryByText('Regional Leads')).not.toBeInTheDocument();
    expect(within(blockedGroup).getByText('8 groups')).toBeInTheDocument();
  });

  it('is not styled as danger or warning', () => {
    render(
      <CauseWorklist
        {...names}
        causes={[
          blocked('00gFAKE1', 'Engineering'),
          undetermined('00gFAKEU1', 'Regional Leads', 'unevaluable-clause'),
        ]}
      />,
    );

    const investigate = groupFor('Needs investigation');
    expect(investigate.className).not.toMatch(/danger/);
    expect(investigate.className).not.toMatch(/warning/);
    expect(investigate.className).toMatch(/neutral/);

    // Every element inside it, too — no borrowed failure palette anywhere.
    for (const el of investigate.querySelectorAll('*')) {
      expect(el.className.toString()).not.toMatch(/danger|warning/);
    }
  });

  it('renders every remedy that has rows, in remedy order, and none that does not', () => {
    render(
      <CauseWorklist
        {...names}
        causes={[
          blocked('00gFAKE1', 'Engineering'),
          {
            groupId: '00gFAKE2',
            groupName: 'VPN Access',
            remedy: 'excluded-by-rule',
            ruleName: 'All staff get VPN',
            failingClauses: [],
          },
          undetermined('00gFAKEU1', 'Regional Leads', 'no-condition'),
        ]}
      />,
    );

    const headings = screen
      .getAllByRole('heading', { level: 5 })
      .map((h) => h.textContent?.trim() ?? '');
    expect(headings).toEqual([
      'Fix a profile attribute',
      'Remove a rule exclusion',
      'Needs investigation',
    ]);
    // `manual-add` had no rows, so it is simply not rendered.
    expect(screen.queryByText('Add the user manually')).not.toBeInTheDocument();
  });
});

describe('CauseWorklist — undetermined reasons', () => {
  const cases: Array<[UndeterminedReason, RegExp]> = [
    ['unevaluable-clause', /could not be evaluated here, so this user may still qualify/],
    ['needs-group-context', /depends on other group memberships/],
    ['ambiguous-attribution', /More than one rule could account/],
    ['no-rule-inventory', /could not be loaded, so nothing could be checked/],
    ['no-condition', /carries no condition to check/],
  ];

  it.each(cases)('renders distinct copy for %s', (reason, expected) => {
    render(
      <CauseWorklist {...names} causes={[undetermined('00gFAKEU1', 'Regional Leads', reason)]} />,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('gives every reason a different sentence', () => {
    const sentences = cases.map(([reason]) => {
      const { unmount } = render(
        <CauseWorklist {...names} causes={[undetermined('00gFAKEU1', 'Regional Leads', reason)]} />,
      );
      const text = groupFor('Needs investigation').textContent ?? '';
      unmount();
      return text;
    });
    expect(new Set(sentences).size).toBe(cases.length);
  });
});

describe('CauseWorklist — absent vs empty causes', () => {
  it('says the causes were not computed when the prop is absent', () => {
    render(<CauseWorklist {...names} />);

    expect(screen.getByText('Causes not computed')).toBeInTheDocument();
    expect(screen.queryByText('No access differences to explain')).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing has been ruled out/)).toBeInTheDocument();
  });

  it('says there is nothing to explain when the prop is an empty array', () => {
    render(<CauseWorklist {...names} causes={[]} />);

    expect(screen.getByText('No access differences to explain')).toBeInTheDocument();
    expect(screen.queryByText('Causes not computed')).not.toBeInTheDocument();
    expect(screen.queryByText(/Nothing has been ruled out/)).not.toBeInTheDocument();
  });
});

describe('CauseWorklist — rows', () => {
  it('previews the failing clauses with the value that drove them', () => {
    render(<CauseWorklist {...names} causes={[blocked('00gFAKE1', 'Engineering')]} />);

    expect(screen.getByText('1 failing clause')).toBeInTheDocument();
    expect(screen.getByText('user.department == "Platform"')).toBeInTheDocument();
    expect(screen.getByText(/Resolved value: "Support"/)).toBeInTheDocument();
  });

  it('caps the clause preview and says how many more there are', () => {
    render(
      <CauseWorklist
        {...names}
        causes={[
          {
            ...blocked('00gFAKE1', 'Engineering'),
            failingClauses: [
              failing('user.a == "1"', 'x'),
              failing('user.b == "2"', 'x'),
              failing('user.c == "3"', 'x'),
              failing('user.d == "4"', 'x'),
              failing('user.e == "5"', 'x'),
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText('5 failing clauses')).toBeInTheDocument();
    expect(screen.getByText('user.c == "3"')).toBeInTheDocument();
    expect(screen.queryByText('user.d == "4"')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more failing clauses')).toBeInTheDocument();
  });

  it('deep-links into the clause checklist for that cause', async () => {
    const onViewClauses = vi.fn();
    const cause = blocked('00gFAKE1', 'Engineering');
    render(<CauseWorklist {...names} causes={[cause]} onViewClauses={onViewClauses} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open clause checklist' }));
    expect(onViewClauses).toHaveBeenCalledWith(cause);
  });

  it('offers no jump when the host cannot navigate to the checklist', () => {
    render(<CauseWorklist {...names} causes={[blocked('00gFAKE1', 'Engineering')]} />);

    expect(screen.queryByRole('button', { name: 'Open clause checklist' })).not.toBeInTheDocument();
    // The evidence is still there — the row does not go silent.
    expect(screen.getByText('user.department == "Platform"')).toBeInTheDocument();
  });

  it('renders a very long group name in full, wrapped rather than dropped', () => {
    const longName =
      'Engineering — Platform — Identity and Access Management — Contractors — EMEA — Read Only — Provisioned via Workday — Do Not Delete';
    render(<CauseWorklist {...names} causes={[blocked('00gFAKE1', longName)]} />);

    const heading = screen.getByText(longName);
    expect(heading).toHaveAttribute('title', longName);
    expect(heading.className).toMatch(/break-words/);
  });
});
