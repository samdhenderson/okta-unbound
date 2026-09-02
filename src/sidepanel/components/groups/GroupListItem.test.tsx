/**
 * Behavior tests for the redesigned compact group row.
 *
 * The three things worth pinning here are the ones the redesign changed: the two
 * open affordances must stay distinguishable by accessible name, the disclosure
 * must be a real button with `aria-expanded`/`aria-controls`, and the member
 * source meter must render only from an already-computed breakdown — a row that
 * fetches is the bug this design exists to prevent.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import GroupListItem from './GroupListItem';
import { writeMemberSource } from '../../cache/memberSourceCache';
import type { GroupSummary } from '../../../shared/types';
import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';

const group = (over: Partial<GroupSummary> = {}): GroupSummary => ({
  id: '00gFAKEgroup0000001',
  name: 'Engineering',
  description: 'All engineering staff',
  type: 'OKTA_GROUP',
  memberCount: 128,
  hasRules: false,
  ruleCount: 0,
  ...over,
});

const breakdown = (over: Partial<MemberSourceBreakdown> = {}): MemberSourceBreakdown => ({
  total: 128,
  direct: 32,
  ruleBased: 96,
  unattributed: 0,
  byRule: [],
  ...over,
});

function renderRow(props: Partial<React.ComponentProps<typeof GroupListItem>> = {}) {
  const merged = {
    group: group(),
    selected: false,
    onToggleSelect: vi.fn(),
    ...props,
  };
  return { ...render(<GroupListItem {...merged} />), props: merged };
}

describe('GroupListItem identity line', () => {
  it('shows the Okta description under the name', () => {
    renderRow();
    expect(screen.getByRole('heading', { name: 'Engineering' })).toBeInTheDocument();
    expect(screen.getByText('All engineering staff')).toBeInTheDocument();
  });

  it('falls back to the group id when the description is blank', () => {
    renderRow({ group: group({ description: '   ' }) });
    const id = screen.getByText('00gFAKEgroup0000001');
    expect(id).toBeInTheDocument();
    expect(id).toHaveAttribute('title', expect.stringContaining('no description set'));
  });
});

describe('GroupListItem signal region', () => {
  it('carries the exact member count', () => {
    renderRow({ group: group({ memberCount: 1 }) });
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
  });

  it('keeps the two rule relationships distinct instead of summing them', () => {
    renderRow({ group: group({ hasRules: true, ruleCount: 2, usedInRuleCount: 3 }) });

    expect(screen.getByText('Fed by 2 rules')).toBeInTheDocument();
    expect(screen.getByText('Used in 3 rules')).toBeInTheDocument();
    expect(screen.queryByText(/5 rules/)).not.toBeInTheDocument();
  });

  it('omits the "used in" fact while the rules payload is unknown', () => {
    renderRow({ group: group({ ruleCount: 1, usedInRuleCount: undefined }) });
    expect(screen.getByText('Fed by 1 rule')).toBeInTheDocument();
    expect(screen.queryByText(/Used in/)).not.toBeInTheDocument();
  });

  it('summarizes push mappings by app count, with the names in the tooltip', () => {
    renderRow({
      group: group({
        pushMappings: [
          {
            mappingId: 'm1',
            sourceUserGroupId: 'g',
            targetGroupName: 'Mirror',
            appId: 'a1',
            appName: 'Slack',
          },
          {
            mappingId: 'm2',
            sourceUserGroupId: 'g',
            targetGroupName: 'Mirror',
            appId: 'a2',
            appName: 'Workday',
          },
        ],
      }),
    });

    const fact = screen.getByText('Pushed to 2 apps');
    expect(fact).toHaveAttribute('title', 'Pushed to: Slack, Workday');
  });
});

describe('GroupListItem member-source meter', () => {
  it('says the source is not analyzed rather than rendering an empty meter', () => {
    renderRow();
    expect(screen.getByText('Source not analyzed')).toBeInTheDocument();
  });

  it('renders the split once a breakdown is in the session cache', () => {
    writeMemberSource('00gFAKEgroup0000001', breakdown());
    renderRow();

    expect(screen.getByText('Rule-managed 96 · Manual 32')).toBeInTheDocument();
    expect(screen.queryByText('Source not analyzed')).not.toBeInTheDocument();
  });

  it('carves indeterminate members out of the rule-managed bucket', () => {
    writeMemberSource(
      '00gFAKEgroup0000001',
      breakdown({ total: 10, direct: 4, ruleBased: 6, unattributed: 2 }),
    );
    renderRow({ group: group({ memberCount: 10 }) });

    // 6 rule-based of which 2 are unconfirmed => 4 confirmed, never 6 + 2.
    expect(screen.getByText('Rule-managed 4 · Manual 4 · Indeterminate 2')).toBeInTheDocument();
  });

  it('picks up a breakdown computed after the row rendered', () => {
    renderRow();
    expect(screen.getByText('Source not analyzed')).toBeInTheDocument();

    act(() => {
      writeMemberSource('00gFAKEgroup0000001', breakdown());
    });

    expect(screen.getByText('Rule-managed 96 · Manual 32')).toBeInTheDocument();
  });

  it('offers the analyze action only while nothing is cached', async () => {
    const onAnalyzeSource = vi.fn();
    const { rerender, props } = renderRow({ onAnalyzeSource });

    await userEvent.click(screen.getByRole('button', { name: 'Analyze member source' }));
    expect(onAnalyzeSource).toHaveBeenCalledWith(props.group);

    act(() => {
      writeMemberSource('00gFAKEgroup0000001', breakdown());
    });
    rerender(<GroupListItem {...props} onAnalyzeSource={onAnalyzeSource} />);

    expect(screen.queryByRole('button', { name: 'Analyze member source' })).not.toBeInTheDocument();
  });

  it('says nothing about sources for an empty group', () => {
    renderRow({ group: group({ memberCount: 0 }), onAnalyzeSource: vi.fn() });

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('members')).toBeInTheDocument();
    expect(screen.queryByText('Source not analyzed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Analyze member source' })).not.toBeInTheDocument();
  });
});

describe('GroupListItem open affordances', () => {
  it('gives the chevron and the row body distinct accessible names', () => {
    renderRow({ onOpenDetail: vi.fn() });

    expect(screen.getByRole('button', { name: 'Expand Engineering' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View group details' })).toBeInTheDocument();
  });

  it('drills into the detail view from the row body', async () => {
    const onOpenDetail = vi.fn();
    const { props } = renderRow({ onOpenDetail });

    await userEvent.click(screen.getByRole('button', { name: 'View group details' }));
    expect(onOpenDetail).toHaveBeenCalledWith(props.group);
  });

  it('omits the row-body affordance when there is nowhere to drill into', () => {
    renderRow();
    expect(screen.queryByRole('button', { name: 'View group details' })).not.toBeInTheDocument();
  });

  it('expands inline through a real disclosure button', async () => {
    const { container } = renderRow({ group: group({ created: new Date('2020-01-01') }) });

    const trigger = screen.getByRole('button', { name: 'Expand Engineering' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    const regionId = trigger.getAttribute('aria-controls');
    expect(regionId).toBeTruthy();
    expect(container.querySelector(`#${CSS.escape(regionId as string)}`)).not.toBeNull();

    await userEvent.click(trigger);

    const toggled = screen.getByRole('button', { name: 'Collapse Engineering' });
    expect(toggled).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Copy ID' })).toBeInTheDocument();
  });

  it('auto-expands a deep-linked row', () => {
    renderRow({ isHighlighted: true });
    expect(screen.getByRole('button', { name: 'Collapse Engineering' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

describe('GroupListItem selection', () => {
  it('labels its checkbox with the group name and toggles by id', async () => {
    const onToggleSelect = vi.fn();
    renderRow({ onToggleSelect });

    await userEvent.click(screen.getByLabelText('Select Engineering'));
    expect(onToggleSelect).toHaveBeenCalledWith('00gFAKEgroup0000001');
  });

  it('keeps the checkbox visible (not hover-revealed) while selected', () => {
    const { container } = renderRow({ selected: true });
    const wrapper = screen.getByLabelText('Select Engineering').parentElement as HTMLElement;

    expect(wrapper.className).not.toContain('opacity-0');
    expect(container.querySelector('[data-group-id]')?.className).toContain('border-primary');
  });

  it('hides the unselected checkbox until hover or focus', () => {
    renderRow();
    const wrapper = screen.getByLabelText('Select Engineering').parentElement as HTMLElement;

    expect(wrapper.className).toContain('opacity-0');
    expect(wrapper.className).toContain('group-hover/row:opacity-100');
    expect(wrapper.className).toContain('group-focus-within/row:opacity-100');
  });
});

describe('GroupListItem memoisation', () => {
  it('re-renders every field its comparator claims to watch', () => {
    const base = group();
    const props = { group: base, selected: false, onToggleSelect: vi.fn() };
    const { rerender } = render(<GroupListItem {...props} />);

    rerender(
      <GroupListItem
        {...props}
        group={{
          ...base,
          description: 'Now with a new description',
          memberCount: 7,
          ruleCount: 4,
          usedInRuleCount: 1,
        }}
      />,
    );

    expect(screen.getByText('Now with a new description')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Fed by 4 rules')).toBeInTheDocument();
    expect(screen.getByText('Used in 1 rule')).toBeInTheDocument();
  });

  it('re-renders when the source app or push mappings change', () => {
    const base = group({ type: 'APP_GROUP', sourceAppName: 'Salesforce' });
    const props = { group: base, selected: false, onToggleSelect: vi.fn() };
    const { rerender } = render(<GroupListItem {...props} />);
    expect(screen.getByText('Salesforce')).toBeInTheDocument();

    rerender(
      <GroupListItem
        {...props}
        group={{
          ...base,
          sourceAppName: 'Workday',
          pushMappings: [
            {
              mappingId: 'm1',
              sourceUserGroupId: 'g',
              targetGroupName: 'Mirror',
              appId: 'a1',
              appName: 'AD',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Workday')).toBeInTheDocument();
    expect(screen.getByText('Pushed to 1 app')).toBeInTheDocument();
  });

  it('re-renders when the drill-in handler appears', () => {
    const props = { group: group(), selected: false, onToggleSelect: vi.fn() };
    const { rerender } = render(<GroupListItem {...props} />);
    expect(screen.queryByRole('button', { name: 'View group details' })).not.toBeInTheDocument();

    rerender(<GroupListItem {...props} onOpenDetail={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'View group details' })).toBeInTheDocument();
  });
});

describe('GroupListItem chrome', () => {
  it('exposes the group id on the row root for deep-link scrolling', () => {
    const { container } = renderRow();
    expect(container.querySelector('[data-group-id="00gFAKEgroup0000001"]')).not.toBeNull();
  });

  it('renders the type badge and, for an app group, its source app', () => {
    renderRow({ group: group({ type: 'APP_GROUP', sourceAppName: 'Salesforce' }) });
    const row = within(screen.getByText('Engineering').closest('[data-group-id]') as HTMLElement);

    expect(row.getByText('APP')).toBeInTheDocument();
    expect(row.getByText('Salesforce')).toBeInTheDocument();
  });

  it('only offers the Okta deep link when an origin is known', () => {
    const { rerender, props } = renderRow();
    expect(screen.queryByRole('button', { name: 'Open in Okta' })).not.toBeInTheDocument();

    rerender(<GroupListItem {...props} oktaOrigin="https://example.okta.com" />);
    expect(screen.getByRole('button', { name: 'Open in Okta' })).toBeInTheDocument();
  });
});
