/**
 * @module sidepanel/components/rules/RulesSearchRow.test
 * @description Behavior of the Rules rung's search field and its filter disclosure.
 *
 * The search case is retargeted verbatim from `RulesToolbar.test.tsx` — same query, same
 * controlled-input expectation — against the component that now owns the field (ADR-0022:
 * the unit was replaced, the suite followed it). The toggle cases are new, and cover the
 * control the split introduced.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RulesSearchRow from './RulesSearchRow';

/** Default props; each test overrides only what it exercises. */
function renderRow(over: Partial<React.ComponentProps<typeof RulesSearchRow>> = {}) {
  const props: React.ComponentProps<typeof RulesSearchRow> = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    filtersOpen: false,
    onToggleFilters: vi.fn(),
    activeFilterCount: 0,
    ...over,
  };
  return { props, ...render(<RulesSearchRow {...props} />) };
}

describe('RulesSearchRow search', () => {
  it('renders the current query and reports each keystroke', async () => {
    const uev = userEvent.setup();
    const { props } = renderRow({ searchQuery: 'Eng' });

    const field = screen.getByPlaceholderText(/Search rules/i);
    expect(field).toHaveValue('Eng');

    await uev.type(field, 'i');
    // Controlled input: the parent owns the value, so it receives the full next one.
    expect(props.onSearchChange).toHaveBeenCalledWith('Engi');
  });
});

describe('RulesSearchRow filter disclosure', () => {
  it('reports its pressed state and toggles', async () => {
    const uev = userEvent.setup();
    const { props } = renderRow();

    const toggle = screen.getByRole('button', { name: /Filters/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await uev.click(toggle);
    expect(props.onToggleFilters).toHaveBeenCalledTimes(1);
  });

  it('is pressed while the panel is open', () => {
    renderRow({ filtersOpen: true });
    expect(screen.getByRole('button', { name: /Filters/ })).toHaveAttribute('aria-pressed', 'true');
  });

  /*
    The badge is the only trace of an applied filter once the panel is closed, which is
    exactly the state in which a filter is silently shortening the list below.
  */
  it('states the applied-filter count in its name, and says nothing at zero', () => {
    const { unmount } = renderRow({ activeFilterCount: 0 });
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();

    unmount();
    renderRow({ activeFilterCount: 2 });
    // Not `Filters2`: the badge is a digit with nothing naming what it counts, so the
    // accessible name spells it out and the badge itself is `aria-hidden`.
    expect(screen.getByRole('button', { name: 'Filters, 2 applied' })).toBeInTheDocument();
  });
});
