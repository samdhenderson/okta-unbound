/**
 * @module sidepanel/components/rules/RulesDuplicatesPanel.test
 * @description Behavior of the duplicate-condition panel and its per-set disclosures.
 *
 * Retargeted from `RulesMergeBanner.test.tsx` when the panel lost its outer collapsible
 * to the strip's `Duplicates (N)` verb (ADR-0022: the unit was replaced, and each
 * assertion moved rather than being dropped). Every case below is the one it was, minus
 * the click that used to open the outer disclosure. The one assertion that had no home
 * left — "starts collapsed" — is noted where it went.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RulesDuplicatesPanel from './RulesDuplicatesPanel';
import type { MergeableRuleGroup } from '../../../shared/rules/consolidation';
import type { OktaGroupRule } from '../../../shared/types';

/** Build a raw rule with a shared expression + target groups. */
function rawRule(id: string, name: string, groupIds: string[], status = 'ACTIVE'): OktaGroupRule {
  return {
    id,
    name,
    status: status as OktaGroupRule['status'],
    type: 'group_rule',
    created: '2024-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    conditions: { expression: { value: "user.department == 'Eng'", type: 'urn' } },
    actions: { assignUserToGroups: { groupIds } },
  };
}

const cluster: MergeableRuleGroup = {
  expression: "user.department == 'eng'",
  rules: [rawRule('r1', 'Eng West', ['g1']), rawRule('r2', 'Eng East', ['g2'], 'INACTIVE')],
  unionGroupIds: ['g1', 'g2'],
};

describe('RulesDuplicatesPanel', () => {
  it('renders nothing when there are no clusters', () => {
    const { container } = render(<RulesDuplicatesPanel clusters={[]} onMerge={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  /*
    Was "starts collapsed and reveals the sets once expanded". The outer collapsible is
    gone — the strip's `Duplicates (N)` verb holds this panel closed now, and that it does
    so is asserted by `RulesListActionBar.stories.tsx`'s `TheOpenPanelSaysSo` play
    function, not here. What survives is the half this component still owns: the heading
    counts the sets, and a set's member rules stay behind its own chevron.
  */
  it('heads the panel with the set count, with member rules still behind each set', () => {
    render(<RulesDuplicatesPanel clusters={[cluster]} onMerge={vi.fn()} />);

    expect(screen.getByText('1 set of duplicate-condition rules')).toBeInTheDocument();
    expect(screen.getByText('2 rules → 2 target groups')).toBeInTheDocument();
    expect(screen.queryByText('Eng West')).not.toBeInTheDocument();
  });

  it('expands a set to show its shared condition, member rules, and status', async () => {
    const uev = userEvent.setup();
    render(<RulesDuplicatesPanel clusters={[cluster]} onMerge={vi.fn()} />);

    await uev.click(screen.getByRole('button', { name: /2 rules → 2 target groups/ }));

    expect(screen.getByText("user.department == 'eng'")).toBeInTheDocument();
    expect(screen.getByText('Eng West')).toBeInTheDocument();
    expect(screen.getByText('Eng East')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('links to a member rule via onFocusRule', async () => {
    const uev = userEvent.setup();
    const onFocusRule = vi.fn();
    render(
      <RulesDuplicatesPanel clusters={[cluster]} onMerge={vi.fn()} onFocusRule={onFocusRule} />,
    );

    await uev.click(screen.getByRole('button', { name: /2 rules → 2 target groups/ }));
    await uev.click(screen.getAllByRole('button', { name: 'View' })[0]);

    expect(onFocusRule).toHaveBeenCalledWith('r1');
  });

  it('starts the merge (preview) for a set', async () => {
    const uev = userEvent.setup();
    const onMerge = vi.fn();
    render(<RulesDuplicatesPanel clusters={[cluster]} onMerge={onMerge} />);

    await uev.click(screen.getByRole('button', { name: /Review & merge/ }));

    expect(onMerge).toHaveBeenCalledWith(cluster);
  });
});
