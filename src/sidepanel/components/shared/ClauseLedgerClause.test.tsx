/**
 * Behavior tests for {@link ClauseLedgerClause}'s reading of a clause: a leaf
 * carrying a {@link LeafPredicate} is stated as a sentence, and a leaf without
 * one falls back to the exact clause text.
 *
 * Fixtures come from `explainRuleExpression` with a fake user (`docs/testing.md`),
 * so the sentence asserted here is composed from the same derivation the
 * explainer's own tests pin — not from a hand-written predicate that could
 * describe a clause the explainer never produces.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClauseLedgerClause from './ClauseLedgerClause';
import {
  explainRuleExpression,
  type LeafClauseNode,
} from '../../../shared/rules/explainExpression';
import type { OktaUser } from '../../../shared/types';

const user: OktaUser = {
  id: '00uFAKECLAUSEPHRASE1',
  status: 'ACTIVE',
  profile: {
    login: 'ada_vendor@example.com',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    isContractor: true,
    'cost center': 'CC-9',
  },
};

/** The root leaf of an explained single-clause expression. */
function leafOf(expression: string): LeafClauseNode {
  const { tree } = explainRuleExpression(expression, user);
  if (tree.node !== 'leaf') throw new Error('expected a single-clause expression');
  return tree;
}

/**
 * The clause's rendered sentence, with runs of whitespace collapsed.
 *
 * Located through the bold attribute name the phrase always contains — the
 * sentence is that element's parent — so the assertion is about the words on
 * screen rather than about any class or wrapper.
 */
function sentence(expression: string): string {
  const { container } = render(<ClauseLedgerClause leaf={leafOf(expression)} />);
  const phrase = container.querySelector('b')?.parentElement;
  return (phrase?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('ClauseLedgerClause — clause wording', () => {
  it.each([
    ['user.department == "Engineering"', 'department equals "Engineering"'],
    ['String.toLowerCase(user.department) == "sales"', 'department (lowercased) equals "sales"'],
    [
      'String.toLowerCase(String.removeSpaces(user.department)) == "sales"',
      'department (spaces removed, lowercased) equals "sales"',
    ],
    ['user["cost center"] != "CC-1"', 'cost center does not equal "CC-1"'],
    ['String.len(user.department) > 3', 'length of department is greater than 3'],
    ['Arrays.size(user.department) >= 2', 'count of department is at least 2'],
    ['Arrays.toCsvString(user.department) == "a,b"', 'department (joined as text) equals "a,b"'],
    ['String.stringContains(user.login, "_vendor")', 'login contains "_vendor"'],
    ['!String.stringContains(user.login, "_vendor")', 'login does not contain "_vendor"'],
    ['String.startsWith(user.login, "svc-")', 'login starts with "svc-"'],
    ['!String.endsWith(user.login, "@example.com")', 'login does not end with "@example.com"'],
    ['Arrays.contains(user.department, "Eng")', 'department includes "Eng"'],
    ['!Arrays.isEmpty(user.department)', 'department is not empty'],
    ['user.isContractor', 'isContractor is true'],
    ['!user.isContractor', 'isContractor is false'],
    ['user.department == null', 'department equals null'],
    ['user.department == user.title', 'department equals title'],
    ['!(user.department == "Sales")', 'department does not equal "Sales"'],
  ])('states %s as a sentence', (expression, expected) => {
    expect(sentence(expression)).toBe(expected);
  });

  it('states the sentence instead of the clause text, not as well as it', () => {
    render(<ClauseLedgerClause leaf={leafOf('String.toLowerCase(user.department) == "sales"')} />);

    expect(screen.getByText('department', { selector: 'b' })).toBeInTheDocument();
    expect(
      screen.queryByText('String.toLowerCase(user.department) == "sales"'),
    ).not.toBeInTheDocument();
  });

  it('still prints the full attribute path on the evidence line under the sentence', () => {
    render(<ClauseLedgerClause leaf={leafOf('String.toLowerCase(user.department) == "sales"')} />);

    expect(screen.getByText('user.department')).toBeInTheDocument();
    expect(screen.getByText('"Engineering"')).toBeInTheDocument();
  });

  it('falls back to the exact clause text when the clause has no predicate', () => {
    const leaf = leafOf('String.substring(user.department, 0, 3) == "Eng"');

    expect(leaf.predicate).toBeUndefined();
    const { container } = render(<ClauseLedgerClause leaf={leaf} />);

    expect(container.textContent).toContain('String.substring(user.department, 0, 3) == "Eng"');
  });

  it('never hedges: no qualifier appears in any sentence it composes', () => {
    render(<ClauseLedgerClause leaf={leafOf('String.len(user.department) > 3')} />);

    expect(screen.queryByText(/likely|probably|approximately|\?/)).not.toBeInTheDocument();
  });
});
