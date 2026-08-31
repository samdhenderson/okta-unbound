/**
 * Regression cover for `RuleCard`'s memoisation (D-039), and for the row's one job.
 *
 * ## RETARGETED — the subject shrank, the risk did not
 *
 * D-039 was a hand-written `memo` comparator that listed eight rule fields while the
 * render read roughly twice that, so a card handed the same rule with newly-resolved
 * group names kept painting the stale ones. The comparator is gone (the card takes the
 * default shallow compare now, and the docblock says why), but the async shape that
 * produced the bug has not changed: `fetchGroupRulesRequest` formats a rule from the org
 * snapshot, so a rule can be painted and then handed a fuller version of itself moments
 * later with every field the old comparator checked identical.
 *
 * Two of the three original cases asserted that through **group chips in the card's
 * expanded body**. That body is `RuleDetailView` now, so those assertions moved there
 * verbatim rather than being deleted — see `rules/RuleDetailView.test.tsx` (ADR-0022:
 * the unit was replaced and the suite retargeted assertion-by-assertion). What stays here
 * is the same property asserted against what the *row* renders, plus the third case —
 * an action whose handler arrives after first paint — retargeted to the row's only verb.
 *
 * Everything asserted is rendered output — the badge a reader sees, the control they can
 * press — never a render count or a prop identity (ADR-0023).
 */
import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RuleCard from './RuleCard';
import type { FormattedRule } from '../../shared/types';

const TARGET_GROUP_ID = '00gFAKE0000000000TGT';

/** A rule as first painted: no conflicts detected yet, status straight off the API. */
const initial: FormattedRule = {
  id: '00rFAKE0000000000001',
  name: 'Engineering auto-assign',
  status: 'ACTIVE',
  condition: 'user.department == "Engineering"',
  conditionExpression: 'user.department == "Engineering"',
  groupIds: [TARGET_GROUP_ID],
  groupNames: undefined,
  allGroupNamesMap: {},
  userAttributes: ['department'],
  created: '2024-01-01T00:00:00.000Z',
  lastUpdated: '2025-01-01T00:00:00.000Z',
  affectsCurrentGroup: false,
};

/**
 * The same rule after the conflict pass ran over the loaded set. Conflict detection is a
 * second, later pass over rules already on screen, so this arrives with the id, name,
 * status and condition all unchanged.
 */
const withConflict: FormattedRule = {
  ...initial,
  conflicts: [
    {
      rule1: { id: initial.id, name: initial.name },
      rule2: { id: '00rFAKE0000000000002', name: 'Contractors auto-assign' },
      reason: 'Both rules assign users to the same group on overlapping conditions.',
      severity: 'high',
      affectedGroups: [TARGET_GROUP_ID],
    },
  ],
};

const renderCard = (props: Partial<ComponentProps<typeof RuleCard>> = {}) =>
  render(<RuleCard rule={initial} {...props} />);

/** Re-render the *same* card with new props, the way a parent state change does. */
const rerenderCard = (
  rerender: ReturnType<typeof renderCard>['rerender'],
  props: Partial<ComponentProps<typeof RuleCard>> = {},
) => rerender(<RuleCard rule={initial} {...props} />);

describe('RuleCard', () => {
  it('repaints when a later pass adds a conflict to a rule already on screen', () => {
    const { rerender } = renderCard();
    expect(screen.queryByText(/Conflict/)).not.toBeInTheDocument();

    rerenderCard(rerender, { rule: withConflict });

    expect(screen.getByText('1 Conflict')).toBeInTheDocument();
  });

  it('repaints when the rule it was handed changes status underneath it', () => {
    const { rerender } = renderCard();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();

    rerenderCard(rerender, { rule: { ...initial, status: 'INACTIVE' } });

    expect(screen.getByText('INACTIVE')).toBeInTheDocument();
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
  });

  it('shows the way in once its handler is wired up after first paint', () => {
    const { rerender } = renderCard();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerenderCard(rerender, { onOpenRule: vi.fn() });

    expect(screen.getByRole('button', { name: 'Open rule' })).toBeInTheDocument();
  });

  it('opens the rule when the row is pressed', async () => {
    const onOpenRule = vi.fn();
    renderCard({ onOpenRule });

    await userEvent.click(screen.getByRole('button', { name: 'Open rule' }));

    expect(onOpenRule).toHaveBeenCalledWith(initial);
  });

  /*
    The two consumers open two different things. The Group Detail rules section has no
    rule rung of its own to push — its stack is showing a *group* — so its press leaves
    the tab, and the control has to say so.
  */
  it('says where the press lands when it deep-links across tabs', async () => {
    const onOpenInRulesTab = vi.fn();
    renderCard({ onOpenInRulesTab });

    await userEvent.click(screen.getByRole('button', { name: 'Open rule in the Rules tab' }));

    expect(onOpenInRulesTab).toHaveBeenCalledWith(initial.id);
  });

  /*
    ADR-0039: no control without a handler behind it. A row with neither handler is inert
    by design, so it must not render an affordance — the chevron included.
  */
  it('renders no affordance when it can open nothing', () => {
    renderCard();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(initial.name)).toBeInTheDocument();
  });

  /*
    `StretchedButton`'s accessible name is identical on every row in a list, so the one
    thing that tells two rows apart is the `aria-describedby` pointing at this row's own
    heading. If that link breaks, a screen-reader user hears the same control fifty times.
  */
  it('names the specific rule its overlay opens', () => {
    renderCard({ onOpenRule: vi.fn() });

    const describedBy = screen
      .getByRole('button', { name: 'Open rule' })
      .getAttribute('aria-describedby');

    expect(describedBy).toBeTruthy();
    expect(screen.getByText(initial.name)).toHaveAttribute('id', describedBy);
  });
});
