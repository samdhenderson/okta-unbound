/**
 * @module sidepanel/components/rules/RulesFilterPanel.test
 * @description Behavior of the Rules rung's filter chips and sort selector.
 *
 * Retargeted from `RulesToolbar.test.tsx` when that component split in two: the search
 * field moved into the strip's `subRow` (see `RulesSearchRow.test.tsx`) and everything
 * here moved behind the strip's filter disclosure. ADR-0022's "the unit was replaced and
 * the suite is retargeted assertion-by-assertion" carve-out — every chip and sort case
 * below is the one the toolbar suite had, with the same queries and the same
 * expectations, against the component that now owns them.
 *
 * The panel is presentational — every interaction is reported upward — so these assert
 * the rendered controls and the callbacks they fire, not any filtering.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RulesFilterPanel, { countActiveRuleFilters } from './RulesFilterPanel';

/** Default props; each test overrides only what it exercises. */
function renderPanel(over: Partial<React.ComponentProps<typeof RulesFilterPanel>> = {}) {
  const props: React.ComponentProps<typeof RulesFilterPanel> = {
    activeFilter: 'all',
    onFilterChange: vi.fn(),
    conflictsCount: 0,
    showCurrentGroup: false,
    sortMode: 'default',
    onSortChange: vi.fn(),
    ...over,
  };
  return { props, ...render(<RulesFilterPanel {...props} />) };
}

describe('RulesFilterPanel filter chips', () => {
  it('renders the always-on chips and marks the active one pressed', () => {
    renderPanel({ activeFilter: 'active' });

    expect(screen.getByRole('button', { name: 'All Rules' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Active Only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Conflicts/ })).toBeInTheDocument();
  });

  it('reports the chosen filter', async () => {
    const uev = userEvent.setup();
    const { props } = renderPanel();

    await uev.click(screen.getByRole('button', { name: 'Active Only' }));
    expect(props.onFilterChange).toHaveBeenCalledWith('active');

    await uev.click(screen.getByRole('button', { name: 'All Rules' }));
    expect(props.onFilterChange).toHaveBeenCalledWith('all');
  });

  it('disables the Conflicts chip until conflicts exist, and shows the count', async () => {
    const uev = userEvent.setup();
    const { props, unmount } = renderPanel({ conflictsCount: 0 });

    const emptyChip = screen.getByRole('button', { name: 'Conflicts (0)' });
    expect(emptyChip).toBeDisabled();
    await uev.click(emptyChip);
    expect(props.onFilterChange).not.toHaveBeenCalled();

    unmount();
    const second = renderPanel({ conflictsCount: 3 });
    const chip = screen.getByRole('button', { name: 'Conflicts (3)' });
    expect(chip).toBeEnabled();
    await uev.click(chip);
    expect(second.props.onFilterChange).toHaveBeenCalledWith('conflicts');
  });

  it('hides the Current Group chip until a group is detected', () => {
    const { unmount } = renderPanel({ showCurrentGroup: false });
    expect(screen.queryByRole('button', { name: 'Current Group' })).not.toBeInTheDocument();

    unmount();
    renderPanel({ showCurrentGroup: true, activeFilter: 'current-group' });
    expect(screen.getByRole('button', { name: 'Current Group' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('reports the current-group filter when its chip is clicked', async () => {
    const uev = userEvent.setup();
    const { props } = renderPanel({ showCurrentGroup: true });

    await uev.click(screen.getByRole('button', { name: 'Current Group' }));
    expect(props.onFilterChange).toHaveBeenCalledWith('current-group');
  });
});

describe('RulesFilterPanel sort selector', () => {
  it('offers every sort mode and reflects the active one', () => {
    renderPanel({ sortMode: 'similarity' });

    const select = screen.getByRole('combobox', { name: 'Sort rules' });
    expect(select).toHaveValue('similarity');
    expect(screen.getByRole('option', { name: 'Default order' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Group similar' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Name (A–Z)' })).toBeInTheDocument();
  });

  it('reports the chosen sort mode', async () => {
    const uev = userEvent.setup();
    const { props } = renderPanel();

    await uev.selectOptions(screen.getByRole('combobox', { name: 'Sort rules' }), 'name');
    expect(props.onSortChange).toHaveBeenCalledWith('name');
  });
});

/**
 * New with the split: once this panel is closed, the badge on the strip's filter toggle
 * is the *only* statement that a filter is narrowing the list, so what it counts is
 * load-bearing rather than cosmetic.
 */
describe('countActiveRuleFilters', () => {
  it('counts nothing in the resting state', () => {
    expect(countActiveRuleFilters('all', 'default')).toBe(0);
  });

  it('counts a filter chip', () => {
    expect(countActiveRuleFilters('paused', 'default')).toBe(1);
  });

  it('counts a non-default sort, which reorders the list without removing anything', () => {
    expect(countActiveRuleFilters('all', 'similarity')).toBe(1);
  });

  it('counts both together', () => {
    expect(countActiveRuleFilters('conflicts', 'name')).toBe(2);
  });
});
