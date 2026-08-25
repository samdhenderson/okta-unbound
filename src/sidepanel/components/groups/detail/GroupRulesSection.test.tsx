import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupRulesSection from './GroupRulesSection';
import type { FormattedRule } from '../../../../shared/types';

const ASSIGNS = 'Assigns members into this group';
const REFERENCES = 'References this group in a condition';

/**
 * Both lists take the full `FormattedRule` now — the shape `RuleCard` renders and
 * the shape both producing hooks already held. The fixture grew accordingly; no
 * assertion below depends on the added fields except where stated.
 */
const rule = (
  over: Partial<FormattedRule> & Pick<FormattedRule, 'id' | 'name'>,
): FormattedRule => ({
  status: 'ACTIVE',
  condition: 'department == "Engineering"',
  conditionExpression: 'user.department == "Engineering"',
  groupIds: ['00gFAKE1'],
  userAttributes: ['department'],
  created: '2024-01-01T00:00:00.000Z',
  lastUpdated: '2025-01-01T00:00:00.000Z',
  ...over,
});

const base = {
  assigningRules: [rule({ id: 'r1', name: 'All Engineers' })],
  assigningStatus: 'done' as const,
  assigningError: null,
  referencingRules: [rule({ id: 'r2', name: 'Contractors gate', status: 'INACTIVE' })],
  referencingStatus: 'done' as const,
  referencingError: null,
};

/**
 * Expand one rule's card. The name is anchored to the disclosure's own label
 * rather than matched loosely on the rule name — the collapsed body also holds a
 * "Copy rule id for …" control, and jsdom does not honour `inert`, so a loose
 * match finds both.
 */
function expandRule(scope: ReturnType<typeof within>, name: string) {
  return userEvent.click(scope.getByRole('button', { name: `Expand ${name}` }));
}

/** The panel a disclosure toggle names, resolved through `aria-controls`. */
function disclosureFor(toggle: HTMLElement): HTMLElement {
  const id = toggle.getAttribute('aria-controls');
  const panel = id ? document.getElementById(id) : null;
  if (!panel) throw new Error('the disclosure toggle names no panel');
  return panel;
}

/** The list under a given sub-heading, so the two axes can be asserted apart. */
function listUnder(heading: string) {
  const block = screen.getByText(new RegExp(`^${heading}`)).parentElement as HTMLElement;
  return within(block);
}

describe('GroupRulesSection', () => {
  it('lists the two rule relationships separately rather than summing them', async () => {
    render(<GroupRulesSection {...base} />);

    expect(listUnder(ASSIGNS).getByText('All Engineers')).toBeInTheDocument();
    expect(listUnder(ASSIGNS).queryByText('Contractors gate')).not.toBeInTheDocument();

    expect(listUnder(REFERENCES).getByText('Contractors gate')).toBeInTheDocument();
    expect(listUnder(REFERENCES).queryByText('All Engineers')).not.toBeInTheDocument();
  });

  it('counts each list independently in its heading', () => {
    render(
      <GroupRulesSection
        {...base}
        assigningRules={[rule({ id: 'r1', name: 'A' }), rule({ id: 'r3', name: 'B' })]}
      />,
    );

    expect(screen.getByText(`${ASSIGNS} (2)`)).toBeInTheDocument();
    expect(screen.getByText(`${REFERENCES} (1)`)).toBeInTheDocument();
  });

  it('shows a distinct empty message per axis', () => {
    render(<GroupRulesSection {...base} assigningRules={[]} referencingRules={[]} />);

    expect(screen.getByText(/No rule assigns users to this group/)).toBeInTheDocument();
    expect(screen.getByText(/No rule condition references this group by id/)).toBeInTheDocument();
  });

  it('does not overclaim: says name-based references are not detected', () => {
    render(<GroupRulesSection {...base} />);
    expect(screen.getByText(/matching on group name is not listed/)).toBeInTheDocument();
  });

  it('renders a spinner while an axis is still loading', () => {
    render(<GroupRulesSection {...base} referencingStatus="loading" referencingRules={[]} />);
    expect(screen.getAllByText('Loading rules…').length).toBe(1);
    expect(screen.getByText('All Engineers')).toBeInTheDocument();
  });

  it('renders a danger alert for the failing axis only', () => {
    render(
      <GroupRulesSection
        {...base}
        referencingStatus="error"
        referencingError="Rules listing unavailable"
        referencingRules={[]}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Rules listing unavailable');
    expect(screen.getByText('All Engineers')).toBeInTheDocument();
  });

  /*
    RETARGETED. The deep link used to be the whole row: clicking a rule's name
    navigated away to the Rules tab, which is why the one question this tab exists
    to answer — what the rule says — could only be answered by leaving it. The
    rows are `RuleCard`s now and the jump is a secondary control *inside* the
    expanded card. Same handler, same argument, same "absent handler ⇒ absent
    control" rule; only where the control lives has moved.
  */
  it('deep-links a rule from inside its expanded card', async () => {
    const onNavigateToRule = vi.fn();
    render(<GroupRulesSection {...base} onNavigateToRule={onNavigateToRule} />);

    await expandRule(listUnder(REFERENCES), 'Contractors gate');
    const jump = await screen.findByTitle('Open rule Contractors gate in the Rules tab');
    await userEvent.click(jump);
    expect(onNavigateToRule).toHaveBeenCalledWith('r2');
  });

  it('offers no jump control when no navigation handler is supplied', () => {
    render(<GroupRulesSection {...base} />);
    expect(screen.queryByText('Open in Rules tab')).not.toBeInTheDocument();
    expect(screen.getByText('All Engineers')).toBeInTheDocument();
  });

  /*
    New, and the point of the change: the rule's own condition is on the page
    rather than one navigation away.

    Asserted through the disclosure this rule's own toggle controls, not by text
    search. `RuleCard` keeps its body mounted while closed (`.disclose` + `inert`,
    so it collapses without unmounting), and jsdom honours neither `inert` nor
    CSS — a bare `getByText` would pass against a card nobody opened, and would
    match the *other* rule's card besides.
  */
  it('shows the rule itself, not just a link to it', async () => {
    render(<GroupRulesSection {...base} />);

    const toggle = listUnder(ASSIGNS).getByRole('button', { name: 'Expand All Engineers' });
    const disclosure = disclosureFor(toggle);
    expect(disclosure).toHaveAttribute('data-open', 'false');

    await userEvent.click(toggle);

    expect(disclosure).toHaveAttribute('data-open', 'true');
    expect(within(disclosure).getByText('user.department == "Engineering"')).toBeInTheDocument();
  });

  /*
    ADR-0039: this section wires none of the card's write verbs, so it must render
    no control for them — not a disabled one, and not one that swallows the click.
    `RuleCard` rendered Activate/Deactivate unconditionally until this commit,
    which was invisible while `RulesTab` was its only consumer.
  */
  it('renders no write verb it cannot perform', async () => {
    render(<GroupRulesSection {...base} />);

    await expandRule(listUnder(ASSIGNS), 'All Engineers');
    expect(screen.queryByRole('button', { name: /Deactivate Rule/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate Rule/ })).not.toBeInTheDocument();
  });

  /*
    The org origin reaches the card or the link is absent — never a dead "View in
    Okta" pointing at nothing. `GroupDetailView` did not pass one at all until this
    was wired, so every deep link on the page was silently unrendered.
  */
  it('offers the Okta deep link only when an org origin is known', async () => {
    const { rerender } = render(<GroupRulesSection {...base} />);
    await expandRule(listUnder(ASSIGNS), 'All Engineers');
    expect(screen.queryByRole('link', { name: /View in Okta/ })).not.toBeInTheDocument();

    rerender(<GroupRulesSection {...base} oktaOrigin="https://example.okta.com" />);
    expect(screen.getAllByRole('link', { name: /View in Okta/ }).length).toBeGreaterThan(0);
  });

  it("shows each rule's Okta status verbatim", () => {
    render(<GroupRulesSection {...base} />);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('INACTIVE')).toBeInTheDocument();
  });
});
