/**
 * @module sidepanel/components/rules/CurrentGroupRuleRelations.test
 * @description The two rule→group directions must never leak into each other.
 *
 * "Assigns members into this group" (the rule targets the group) and "references
 * this group by ID in a condition" (the group is an input to the rule) are
 * opposite edges. These pin that each rule lands in the right list — including a
 * rule that legitimately does both — and that each empty list states its own
 * fact rather than rendering a bare zero. The reference list's honesty caveat
 * (only the 2 id-taking membership functions are detected) is pinned too,
 * because dropping it would make the UI claim a completeness it does not have.
 */
import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CurrentGroupRuleRelations from './CurrentGroupRuleRelations';
import type { FormattedRule } from '../../../shared/types';

const CURRENT_GROUP = '00gCURRENTFAKE000001';
const OTHER_GROUP = '00gOTHERFAKE00000002';

function rule(over: Partial<FormattedRule> = {}): FormattedRule {
  return {
    id: 'r1',
    name: 'Some Rule',
    status: 'ACTIVE',
    condition: 'department == "Eng"',
    conditionExpression: 'user.department=="Eng"',
    groupIds: [OTHER_GROUP],
    groupNames: ['Somewhere Else'],
    userAttributes: ['department'],
    created: '2020-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    ...over,
  };
}

/** The rule that feeds the current group (relation A). */
const assigningRule = rule({
  id: 'r-assign',
  name: 'Feeds Current Group',
  groupIds: [CURRENT_GROUP],
});

/** The rule that only reads the current group in its condition (relation B). */
const referencingRule = rule({
  id: 'r-reference',
  name: 'Reads Current Group',
  conditionExpression: `isMemberOfAnyGroup("${CURRENT_GROUP}")`,
  groupIds: [OTHER_GROUP],
});

/** The rule that does both: reads the group and also assigns back into it. */
const bothRule = rule({
  id: 'r-both',
  name: 'Reads And Feeds Current Group',
  conditionExpression: `isMemberOfGroup("${CURRENT_GROUP}") AND user.userType=="Employee"`,
  groupIds: [CURRENT_GROUP],
});

function renderPanel(over: Partial<ComponentProps<typeof CurrentGroupRuleRelations>> = {}) {
  const props: ComponentProps<typeof CurrentGroupRuleRelations> = {
    rules: [],
    currentGroupId: CURRENT_GROUP,
    onFocusRule: vi.fn(),
    ...over,
  };
  return { props, ...render(<CurrentGroupRuleRelations {...props} />) };
}

/** The list region under a section heading, so each list can be asserted alone. */
function listUnder(headingPattern: RegExp): HTMLElement {
  const heading = screen.getByRole('heading', { name: headingPattern });
  const section = heading.parentElement;
  if (!section) throw new Error('heading has no container');
  return section as HTMLElement;
}

const ASSIGNS = /Assigns members into this group/;
const REFERENCES = /References this group by ID in a condition/;

describe('CurrentGroupRuleRelations', () => {
  it('renders nothing when no group is detected on the page', () => {
    const { container } = renderPanel({ currentGroupId: undefined, rules: [assigningRule] });
    expect(container).toBeEmptyDOMElement();
  });

  it('lists an assigning rule under (A) only', () => {
    renderPanel({ rules: [assigningRule] });

    expect(within(listUnder(ASSIGNS)).getByText('Feeds Current Group')).toBeInTheDocument();
    expect(
      within(listUnder(REFERENCES)).queryByText('Feeds Current Group'),
    ).not.toBeInTheDocument();
    // …and (B) says so in words, not as a zero.
    expect(
      within(listUnder(REFERENCES)).getByText(/No loaded rule references this group by ID/),
    ).toBeInTheDocument();
  });

  it('lists a condition-referencing rule under (B) only', () => {
    renderPanel({ rules: [referencingRule] });

    expect(within(listUnder(REFERENCES)).getByText('Reads Current Group')).toBeInTheDocument();
    expect(within(listUnder(ASSIGNS)).queryByText('Reads Current Group')).not.toBeInTheDocument();
    expect(
      within(listUnder(ASSIGNS)).getByText(/No loaded rule assigns users to this group/),
    ).toBeInTheDocument();
  });

  it('lists a rule that both feeds and reads the group in both sections', () => {
    renderPanel({ rules: [bothRule] });

    expect(
      within(listUnder(ASSIGNS)).getByText('Reads And Feeds Current Group'),
    ).toBeInTheDocument();
    expect(
      within(listUnder(REFERENCES)).getByText('Reads And Feeds Current Group'),
    ).toBeInTheDocument();
  });

  it('counts the two relations separately, never as one total', () => {
    renderPanel({ rules: [assigningRule, referencingRule, bothRule] });

    // A: the assigning rule + the one that does both. B: the referencing rule + the same.
    expect(
      screen.getByRole('heading', { name: /Assigns members into this group \(2\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /References this group by ID in a condition \(2\)/ }),
    ).toBeInTheDocument();
  });

  it('states both empty facts distinctly when no rule relates to the group', () => {
    renderPanel({ rules: [rule({ id: 'r-unrelated', name: 'Unrelated Rule' })] });

    expect(
      screen.getByText(/No loaded rule assigns users to this group\. Members are added manually/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No loaded rule references this group by ID in its condition\./),
    ).toBeInTheDocument();
    expect(screen.queryByText('Unrelated Rule')).not.toBeInTheDocument();
    // No bare counts on either heading when a list is empty.
    expect(screen.getByRole('heading', { name: 'Assigns members into this group' })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'References this group by ID in a condition' }),
    ).toBeVisible();
  });

  it('does not claim the reference list is complete', () => {
    renderPanel({ rules: [referencingRule] });

    // The 5 name-based membership functions are not detected — the copy must say so.
    expect(within(listUnder(REFERENCES)).getByText(/isMemberOfGroupName/)).toBeInTheDocument();
    expect(
      within(listUnder(REFERENCES)).getByText(/Only references by group ID are detected/),
    ).toBeInTheDocument();
  });

  it('ignores a condition that names a different group by id', () => {
    renderPanel({
      rules: [
        rule({
          id: 'r-other',
          name: 'Reads Other Group',
          conditionExpression: `isMemberOfAnyGroup("${OTHER_GROUP}")`,
        }),
      ],
    });

    expect(screen.queryByText('Reads Other Group')).not.toBeInTheDocument();
  });

  it('jumps to a rule card from either list', async () => {
    const uev = userEvent.setup();
    const { props } = renderPanel({ rules: [assigningRule, referencingRule] });

    await uev.click(within(listUnder(ASSIGNS)).getByRole('button', { name: 'View' }));
    expect(props.onFocusRule).toHaveBeenCalledWith('r-assign');

    await uev.click(within(listUnder(REFERENCES)).getByRole('button', { name: 'View' }));
    expect(props.onFocusRule).toHaveBeenCalledWith('r-reference');
  });
});
