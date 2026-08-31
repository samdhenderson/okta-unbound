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

  /*
    Companion to the assertion above, added with the strip's *Create feeding
    rule* verb (I-013). The empty state is the most natural place to grow a
    second copy of that verb, and it must not: creating a rule has no symmetric
    undo, so ADR-0039 §2 puts it in the action strip's disclosure tier behind a
    confirm `Modal`, not inline in a section that wires no write at all. This
    section still states the fact and offers no control for it — the same rule
    "renders no write verb it cannot perform" pins for Activate/Deactivate.
  */
  it('states the empty fact without growing a create control of its own', () => {
    render(<GroupRulesSection {...base} assigningRules={[]} referencingRules={[]} />);

    expect(screen.getByText(/Members are added manually or by app push/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rule/i })).not.toBeInTheDocument();
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
    RETARGETED, twice over. The deep link was once the whole row; then it became a
    secondary control inside the card's disclosure; now the row is the jump again —
    but it lands on the rule's own **detail rung** rather than on a list scrolled to
    a collapsed card. Same handler, same argument, and the same title string, which
    is why this assertion survives the move unchanged: the row states where the
    press goes, because it leaves this tab to get there.
  */
  it('deep-links a rule by pressing its row', async () => {
    const onNavigateToRule = vi.fn();
    render(<GroupRulesSection {...base} onNavigateToRule={onNavigateToRule} />);

    await userEvent.click(await screen.findByTitle('Open rule Contractors gate in the Rules tab'));

    expect(onNavigateToRule).toHaveBeenCalledWith('r2');
  });

  it('offers no jump control when no navigation handler is supplied', () => {
    render(<GroupRulesSection {...base} />);
    expect(screen.queryByRole('button', { name: /Open rule/ })).not.toBeInTheDocument();
    expect(screen.getByText('All Engineers')).toBeInTheDocument();
  });

  /*
    RETARGETED, and narrowed on purpose. This used to open the card's disclosure and
    assert the raw condition *expression* was on the page — the point being that
    "what does the rule say?" did not need a navigation to answer.

    The disclosure is gone: the rule's full body is the Rules tab's detail rung now,
    because four write verbs flex-wrapped inside a list row's disclosure is the exact
    ADR-0030 §2 failure that rung exists to fix. What survives here is the row's own
    summary — the condition in human-readable form, with no interaction needed. The
    expression itself is covered where it now lives, in `rules/RuleDetailView.test.tsx`.
  */
  it("shows each rule's condition on the row, with nothing to open first", () => {
    render(<GroupRulesSection {...base} />);

    expect(listUnder(ASSIGNS).getByText('department == "Engineering"')).toBeInTheDocument();
  });

  /*
    ADR-0039: this section cannot activate or deactivate a rule, so it must render no
    control that would — not a disabled one, and not one that swallows the click. The
    verbs live on the rule's rung now, which makes this structurally true rather than
    conditionally true; it is asserted anyway, because "the row renders no verbs" is
    the property, not "the verbs happen to be elsewhere today".

    REMOVED alongside it: `offers the Okta deep link only when an org origin is known`.
    Its subject is deleted — the card has no "View in Okta" control, and this section no
    longer takes an `oktaOrigin` to feed one. Okta has no per-rule route at all, so that
    link was always the org's rules list; it is stated as such on the detail rung, and
    covered by `rules/RuleDetailView.test.tsx`'s
    `does not claim the Okta link opens this rule`.
  */
  it('renders no write verb it cannot perform', () => {
    render(<GroupRulesSection {...base} onNavigateToRule={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Deactivate/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Open rule/ }).length).toBe(2);
  });

  it("shows each rule's Okta status verbatim", () => {
    render(<GroupRulesSection {...base} />);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('INACTIVE')).toBeInTheDocument();
  });
});
