/**
 * @module sidepanel/components/rules/RulesMergeBanner.test
 * @description Behavior of the collapsible, expandable mergeable-rules banner.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RulesMergeBanner from './RulesMergeBanner';
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

describe('RulesMergeBanner', () => {
  it('renders nothing when there are no clusters', () => {
    const { container } = render(<RulesMergeBanner clusters={[]} onMerge={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('starts collapsed and reveals the sets once expanded', async () => {
    const uev = userEvent.setup();
    render(<RulesMergeBanner clusters={[cluster]} onMerge={vi.fn()} />);

    // Header is visible; the set's rules are not yet in the DOM.
    expect(screen.getByText('1 set of duplicate-condition rules')).toBeInTheDocument();
    expect(screen.queryByText('Eng West')).not.toBeInTheDocument();

    await uev.click(screen.getByRole('button', { name: /duplicate-condition rules/ }));
    expect(screen.getByText('2 rules → 2 target groups')).toBeInTheDocument();
  });

  it('expands a set to show its shared condition, member rules, and status', async () => {
    const uev = userEvent.setup();
    render(<RulesMergeBanner clusters={[cluster]} onMerge={vi.fn()} />);

    await uev.click(screen.getByRole('button', { name: /duplicate-condition rules/ }));
    await uev.click(screen.getByRole('button', { name: /2 rules → 2 target groups/ }));

    expect(screen.getByText("user.department == 'eng'")).toBeInTheDocument();
    expect(screen.getByText('Eng West')).toBeInTheDocument();
    expect(screen.getByText('Eng East')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('links to a member rule via onFocusRule', async () => {
    const uev = userEvent.setup();
    const onFocusRule = vi.fn();
    render(<RulesMergeBanner clusters={[cluster]} onMerge={vi.fn()} onFocusRule={onFocusRule} />);

    await uev.click(screen.getByRole('button', { name: /duplicate-condition rules/ }));
    await uev.click(screen.getByRole('button', { name: /2 rules → 2 target groups/ }));
    await uev.click(screen.getAllByRole('button', { name: 'View' })[0]);

    expect(onFocusRule).toHaveBeenCalledWith('r1');
  });

  it('starts the merge (preview) for a set', async () => {
    const uev = userEvent.setup();
    const onMerge = vi.fn();
    render(<RulesMergeBanner clusters={[cluster]} onMerge={onMerge} />);

    await uev.click(screen.getByRole('button', { name: /duplicate-condition rules/ }));
    await uev.click(screen.getByRole('button', { name: /Review & merge/ }));

    expect(onMerge).toHaveBeenCalledWith(cluster);
  });
});
