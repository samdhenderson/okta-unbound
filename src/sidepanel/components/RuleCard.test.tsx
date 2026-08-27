/**
 * Regression cover for `RuleCard`'s memoisation (D-039).
 *
 * Group names resolve asynchronously — `fetchGroupRulesRequest` formats a rule
 * from the org snapshot, and a card can therefore be painted with `groupNames`
 * and `allGroupNamesMap` still empty and be handed the resolved set moments
 * later, with every other field unchanged. These tests pin that the card
 * repaints when that happens: after I-003 an unresolved group and a resolved one
 * are two different components, so a skipped re-render reads as the app not
 * knowing a group it does know.
 *
 * Everything asserted here is rendered output — the chip a reader can click, the
 * "Group name not loaded" sentence, the buttons in the action row — never a
 * render count or a prop identity (ADR-0023).
 */
import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RuleCard from './RuleCard';
import { NavigationProvider } from '../contexts/NavigationContext';
import type { FormattedRule } from '../../shared/types';

const TARGET_GROUP_ID = '00gFAKE0000000000TGT';
const CONDITION_GROUP_ID = '00gFAKE0000000000CND';

/** A rule whose two referenced groups are known only by id. */
const unresolved: FormattedRule = {
  id: '00rFAKE0000000000001',
  name: 'Engineering auto-assign',
  status: 'ACTIVE',
  condition: 'user.department == "Engineering"',
  conditionExpression: `isMemberOfAnyGroup("${CONDITION_GROUP_ID}")`,
  groupIds: [TARGET_GROUP_ID],
  groupNames: undefined,
  allGroupNamesMap: {},
  userAttributes: ['department'],
  created: '2024-01-01T00:00:00.000Z',
  lastUpdated: '2025-01-01T00:00:00.000Z',
  affectsCurrentGroup: false,
};

/**
 * The same rule once the snapshot answered. Every field the card's old
 * comparator looked at — id, name, status, condition, `affectsCurrentGroup`,
 * conflict count — is deliberately identical, so only a comparator that also
 * covers the group fields lets this through.
 */
const resolved: FormattedRule = {
  ...unresolved,
  groupNames: ['Engineering – All'],
  allGroupNamesMap: { [CONDITION_GROUP_ID]: 'Condition Group' },
};

/** Group chips only open a group when a navigation host can honour the jump. */
const renderCard = (props: Partial<ComponentProps<typeof RuleCard>> = {}) =>
  render(
    <NavigationProvider handlers={{ group: vi.fn() }}>
      <RuleCard rule={unresolved} {...props} />
    </NavigationProvider>,
  );

/** Re-render the *same* card with new props, the way a parent state change does. */
const rerenderCard = (
  rerender: ReturnType<typeof renderCard>['rerender'],
  props: Partial<ComponentProps<typeof RuleCard>> = {},
) =>
  rerender(
    <NavigationProvider handlers={{ group: vi.fn() }}>
      <RuleCard rule={unresolved} {...props} />
    </NavigationProvider>,
  );

const expand = () => userEvent.click(screen.getByRole('button', { name: /^Expand / }));

describe('RuleCard', () => {
  it('repaints its target groups when their names arrive after first paint', async () => {
    const { rerender } = renderCard();
    await expand();

    expect(screen.getByText('Group name not loaded')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open group Engineering – All' }),
    ).not.toBeInTheDocument();

    rerenderCard(rerender, { rule: resolved });

    expect(
      screen.getByRole('button', { name: 'Open group Engineering – All' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Group name not loaded')).not.toBeInTheDocument();
  });

  it('repaints a condition-expression group id when its name arrives after first paint', async () => {
    const { rerender } = renderCard();
    await expand();

    expect(screen.getByText(new RegExp(CONDITION_GROUP_ID))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open group Condition Group' }),
    ).not.toBeInTheDocument();

    rerenderCard(rerender, { rule: resolved });

    expect(screen.getByRole('button', { name: 'Open group Condition Group' })).toBeInTheDocument();
  });

  it('shows an action whose handler is wired up after first paint', async () => {
    const { rerender } = renderCard();
    await expand();

    expect(screen.queryByRole('button', { name: 'Deactivate Rule' })).not.toBeInTheDocument();

    rerenderCard(rerender, { onDeactivate: vi.fn() });

    expect(screen.getByRole('button', { name: 'Deactivate Rule' })).toBeInTheDocument();
  });
});
