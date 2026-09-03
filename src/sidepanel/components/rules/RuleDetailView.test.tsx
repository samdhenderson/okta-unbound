/**
 * The rule detail rung's body.
 *
 * Two of these cases are **retargeted** from `RuleCard.test.tsx`, where they pinned D-039
 * against the card's expanded body: group names resolve asynchronously, so a rule can be
 * painted with `groupNames` and `allGroupNamesMap` still empty and be handed the resolved
 * set moments later. That body is this view now, so the assertions moved with it rather
 * than being dropped (ADR-0022 — the unit was replaced, and the retarget is
 * assertion-by-assertion: same queries, same expectations, new host).
 *
 * The rest cover what is new here — that a rule targeting nothing says so, and that the
 * "In Okta" section does not pretend Okta has a per-rule route.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RuleDetailView from './RuleDetailView';
import { NavigationProvider } from '../../contexts/NavigationContext';
import type { FormattedRule } from '../../../shared/types';

const TARGET_GROUP_ID = '00gFAKE0000000000TGT';
const CONDITION_GROUP_ID = '00gFAKE0000000000CND';
const ORIGIN = 'https://example.okta.com';

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
 * The same rule once the org snapshot answered. Every other field is deliberately
 * identical — the resolution is the only change, which is exactly the update D-039's
 * comparator used to swallow.
 */
const resolved: FormattedRule = {
  ...unresolved,
  groupNames: ['Engineering – All'],
  allGroupNamesMap: { [CONDITION_GROUP_ID]: 'Condition Group' },
};

const strip = {
  tierOpen: false,
  onTierOpenChange: vi.fn(),
  isConfirmingActivate: false,
  onRequestActivate: vi.fn(),
  onCancelActivate: vi.fn(),
  onConfirmActivate: vi.fn(),
  onRequestDeactivate: vi.fn(),
};

/** Group chips only open a group when a navigation host can honour the jump. */
const renderView = (rule: FormattedRule = unresolved, oktaOrigin: string | null = null) =>
  render(
    <NavigationProvider handlers={{ group: vi.fn() }}>
      <RuleDetailView rule={rule} oktaOrigin={oktaOrigin} sticky={false} {...strip} />
    </NavigationProvider>,
  );

const rerenderView = (rerender: ReturnType<typeof renderView>['rerender'], rule: FormattedRule) =>
  rerender(
    <NavigationProvider handlers={{ group: vi.fn() }}>
      <RuleDetailView rule={rule} oktaOrigin={null} sticky={false} {...strip} />
    </NavigationProvider>,
  );

describe('RuleDetailView', () => {
  it('repaints its target groups when their names arrive after first paint', () => {
    const { rerender } = renderView();

    expect(screen.getByText('Group name not loaded')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open group Engineering – All' }),
    ).not.toBeInTheDocument();

    rerenderView(rerender, resolved);

    expect(
      screen.getByRole('button', { name: 'Open group Engineering – All' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Group name not loaded')).not.toBeInTheDocument();
  });

  it('repaints a condition-expression group id when its name arrives after first paint', () => {
    const { rerender } = renderView();

    expect(screen.getByText(new RegExp(CONDITION_GROUP_ID))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open group Condition Group' }),
    ).not.toBeInTheDocument();

    rerenderView(rerender, resolved);

    expect(screen.getByRole('button', { name: 'Open group Condition Group' })).toBeInTheDocument();
  });

  /*
    I-003: an unresolved group must not be printed where a name belongs, or it becomes
    indistinguishable from a group actually called `00gFAKE…`. The gap is stated and the id
    renders as an identifier with its own copy control.
  */
  it('states an unresolved target group rather than printing its id as a name', () => {
    renderView();

    expect(screen.getByText('Group name not loaded')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Copy group id ${TARGET_GROUP_ID}` }),
    ).toBeInTheDocument();
  });

  /*
    I-017: the local chip this replaced could copy the id but not open it, so the
    unresolved half of a target list had strictly less reach than the resolved half
    sitting beside it. A valid id is a valid destination whether or not this view
    learned the name.
  */
  it('opens an unresolved target group by id', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <NavigationProvider handlers={{ group: onNavigate }}>
        <RuleDetailView rule={unresolved} oktaOrigin={null} sticky={false} {...strip} />
      </NavigationProvider>,
    );

    await user.click(
      screen.getByRole('button', {
        name: `Group name not loaded — open group ${TARGET_GROUP_ID}`,
      }),
    );

    expect(onNavigate).toHaveBeenCalledWith(TARGET_GROUP_ID);
  });

  it('shows the attributes the condition reads', () => {
    renderView();

    expect(screen.getByText('Profile attributes it reads')).toBeInTheDocument();
    expect(screen.getByText('department')).toBeInTheDocument();
  });

  /*
    A rule that matches users and assigns them nowhere is a finding, not an empty list.
    It is also why the strip omits *Preview impact* here — without the sentence the page
    would be missing the fact and the reason its verb went away.
  */
  it('says so when the rule assigns to no groups', () => {
    renderView({ ...unresolved, groupIds: [], groupNames: [] });

    expect(screen.getByText(/assigns to no groups/)).toBeInTheDocument();
    expect(screen.queryByText('Group name not loaded')).not.toBeInTheDocument();
  });

  it('lists a detected conflict with the rule it collides with', () => {
    renderView({
      ...unresolved,
      conflicts: [
        {
          rule1: { id: unresolved.id, name: unresolved.name },
          rule2: { id: '00rFAKE0000000000002', name: 'Contractors auto-assign' },
          reason: 'Both rules assign users to the same group on overlapping conditions.',
          severity: 'high',
          affectedGroups: [TARGET_GROUP_ID],
        },
      ],
    });

    expect(screen.getByText('Conflicts')).toBeInTheDocument();
    expect(screen.getByText('Contractors auto-assign')).toBeInTheDocument();
    expect(screen.getByText(/overlapping conditions/)).toBeInTheDocument();
  });

  it('omits the conflicts section when there are none', () => {
    renderView();
    expect(screen.queryByText('Conflicts')).not.toBeInTheDocument();
  });

  /*
    Okta's Admin Console has no per-rule route, so the link goes to the org's rules list
    and the copy says exactly that. Claiming to "open this rule" would be a link that
    lands somewhere else.
  */
  it('does not claim the Okta link opens this rule', () => {
    renderView(unresolved, ORIGIN);

    const link = screen.getByRole('link', { name: /Open the rules page/ });
    expect(link).toHaveAttribute('href', `${ORIGIN}/admin/groups#rules`);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/no direct link to a single rule/)).toBeInTheDocument();
  });

  it('omits the Okta section entirely when no org origin is known', () => {
    renderView();
    expect(screen.queryByRole('link', { name: /Open the rules page/ })).not.toBeInTheDocument();
  });

  /*
    ADR-0032: the header carries the rule's name, status and id. The body must not say any
    of it a second time.
  */
  it('does not repeat the identity the header already carries', () => {
    renderView();

    expect(screen.queryByText(unresolved.name)).not.toBeInTheDocument();
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
  });
});
