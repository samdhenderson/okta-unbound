/**
 * @module sidepanel/components/rules/RulesToolbar.test
 * @description Behavior of the Rules tab's search field, filter chips, and sort selector.
 *
 * The toolbar is presentational — every interaction is reported upward — so these
 * assert the rendered controls and the callbacks they fire, not any filtering.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RulesToolbar from './RulesToolbar';

/** Default props; each test overrides only what it exercises. */
function renderToolbar(over: Partial<React.ComponentProps<typeof RulesToolbar>> = {}) {
  const props: React.ComponentProps<typeof RulesToolbar> = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    activeFilter: 'all',
    onFilterChange: vi.fn(),
    conflictsCount: 0,
    showCurrentGroup: false,
    sortMode: 'default',
    onSortChange: vi.fn(),
    ...over,
  };
  return { props, ...render(<RulesToolbar {...props} />) };
}

describe('RulesToolbar search', () => {
  it('renders the current query and reports each keystroke', async () => {
    const uev = userEvent.setup();
    const { props } = renderToolbar({ searchQuery: 'Eng' });

    const field = screen.getByPlaceholderText(/Search rules/i);
    expect(field).toHaveValue('Eng');

    await uev.type(field, 'i');
    // Controlled input: the parent owns the value, so it receives the full next one.
    expect(props.onSearchChange).toHaveBeenCalledWith('Engi');
  });
});

describe('RulesToolbar filter chips', () => {
  it('renders the always-on chips and marks the active one pressed', () => {
    renderToolbar({ activeFilter: 'active' });

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
    const { props } = renderToolbar();

    await uev.click(screen.getByRole('button', { name: 'Active Only' }));
    expect(props.onFilterChange).toHaveBeenCalledWith('active');

    await uev.click(screen.getByRole('button', { name: 'All Rules' }));
    expect(props.onFilterChange).toHaveBeenCalledWith('all');
  });

  it('disables the Conflicts chip until conflicts exist, and shows the count', async () => {
    const uev = userEvent.setup();
    const { props, unmount } = renderToolbar({ conflictsCount: 0 });

    const emptyChip = screen.getByRole('button', { name: 'Conflicts (0)' });
    expect(emptyChip).toBeDisabled();
    await uev.click(emptyChip);
    expect(props.onFilterChange).not.toHaveBeenCalled();

    unmount();
    const second = renderToolbar({ conflictsCount: 3 });
    const chip = screen.getByRole('button', { name: 'Conflicts (3)' });
    expect(chip).toBeEnabled();
    await uev.click(chip);
    expect(second.props.onFilterChange).toHaveBeenCalledWith('conflicts');
  });

  it('hides the Current Group chip until a group is detected', () => {
    const { unmount } = renderToolbar({ showCurrentGroup: false });
    expect(screen.queryByRole('button', { name: 'Current Group' })).not.toBeInTheDocument();

    unmount();
    renderToolbar({ showCurrentGroup: true, activeFilter: 'current-group' });
    expect(screen.getByRole('button', { name: 'Current Group' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('reports the current-group filter when its chip is clicked', async () => {
    const uev = userEvent.setup();
    const { props } = renderToolbar({ showCurrentGroup: true });

    await uev.click(screen.getByRole('button', { name: 'Current Group' }));
    expect(props.onFilterChange).toHaveBeenCalledWith('current-group');
  });
});

describe('RulesToolbar sort selector', () => {
  it('offers every sort mode and reflects the active one', () => {
    renderToolbar({ sortMode: 'similarity' });

    const select = screen.getByRole('combobox', { name: 'Sort rules' });
    expect(select).toHaveValue('similarity');
    expect(screen.getByRole('option', { name: 'Default order' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Group similar' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Name (A–Z)' })).toBeInTheDocument();
  });

  it('reports the chosen sort mode', async () => {
    const uev = userEvent.setup();
    const { props } = renderToolbar();

    await uev.selectOptions(screen.getByRole('combobox', { name: 'Sort rules' }), 'name');
    expect(props.onSortChange).toHaveBeenCalledWith('name');
  });
});
