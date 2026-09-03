/**
 * @module sidepanel/components/groups/GroupsListActionBar.test
 * @description The two structural properties of the groups-list strip that a
 * story cannot state.
 *
 * Everything about *which verb is where* is asserted in
 * `GroupsListActionBar.stories.tsx`, which runs as a headless-browser render test
 * (ADR-0011), and this file deliberately does not duplicate it (ADR-0023). What
 * is here is the pair that needs a **re-render** to mean anything — you cannot
 * compare two selection sizes inside one story — plus the accessible explanation
 * a disabled control owes its reader.
 *
 * Note what jsdom can and cannot see. It loads no stylesheet and defines no
 * `ResizeObserver`, so the strip renders its no-measurement fallback: every
 * bar-eligible action stays in its row and no measurement probe is rendered. That
 * makes the *structure* completely deterministic, which is exactly what the
 * no-reflow property is about — and it makes any claim about tone, elevation or
 * pixels meaningless here, which is why none is made.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import GroupsListActionBar from './GroupsListActionBar';

const handlers = {
  onSelectAll: vi.fn(),
  onDeselectAll: vi.fn(),
  onCompare: vi.fn(),
  onMerge: vi.fn(),
  onTogglePanel: vi.fn(),
  onExportSelection: vi.fn(),
  onExportGroupsList: vi.fn(),
};

const bar = (selectedCount: number, filteredCount = 42) => (
  <GroupsListActionBar
    selectedCount={selectedCount}
    filteredCount={filteredCount}
    activePanel="none"
    crossSearchBadge={0}
    {...handlers}
  />
);

/** The strip's band — the box whose direct children are its rows. */
const band = (): HTMLElement => {
  const node = screen.getByTestId('groups-list-action-bar');
  return node;
};

const register = (): HTMLElement =>
  screen.getByRole('group', { name: 'Selection actions for the groups list' });

describe('the selection register shares its row rather than stacking a new one', () => {
  /*
    The defect this shape exists to prevent: a register that materialises on the
    first tick pushes everything below the band down by a row — under the pointer
    that was ticking a checkbox — so the reader's next click lands on the row
    beneath the one they meant.

    Asserted as *structure*, not as pixels: the band's rows are its direct
    children, so "no new row appeared" is "the child count did not change", and
    "the register was not remounted" is "it is the same DOM node". jsdom has no
    layout, so a height assertion here would be a number that is always zero.
  */
  it('adds no row to the band when the first group is ticked', () => {
    const { rerender } = render(bar(0));

    const before = band().children.length;
    const registerBefore = register();
    // Non-vacuity: the register is already a row before anything is selected.
    expect(registerBefore).toBeInTheDocument();

    rerender(bar(1));

    expect(band().children.length).toBe(before);
    expect(register()).toBe(registerBefore);
  });

  it('keeps the same row count all the way to a full selection', () => {
    const { rerender } = render(bar(0));
    const rows = band().children.length;

    for (const selected of [1, 2, 3, 6, 42]) {
      rerender(bar(selected));
      expect({ selected, rows: band().children.length }).toEqual({ selected, rows });
    }
  });

  it('grows the register in place instead of moving verbs into the action row', () => {
    const { rerender } = render(bar(0));
    expect(within(register()).getAllByRole('button')).toHaveLength(1);

    rerender(bar(3));

    // Deselect all, Select all (42), Compare (3) — the selection verbs joined the
    // row that was already there.
    expect(
      within(register())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Deselect all', 'Select all (42)', 'Compare (3)']);
  });
});

describe('position one of the register is a selection control (ADR-0051 §2)', () => {
  it.each([0, 1, 2, 3, 6, 42])('leads with a selection control at %i selected', (selected) => {
    render(bar(selected));

    const first = within(register()).getAllByRole('button')[0];
    expect(first.textContent).toBe(selected > 0 ? 'Deselect all' : 'Select all (42)');
  });

  it('never leads with Merge, whatever the selection size', () => {
    const { rerender } = render(bar(0));

    for (const selected of [2, 3, 6, 42]) {
      rerender(bar(selected));
      const first = within(register()).getAllByRole('button')[0];
      expect({ selected, first: first.textContent }).toEqual({ selected, first: 'Deselect all' });
    }
  });
});

describe('a disabled control says why', () => {
  it('explains a full selection rather than vanishing or swapping label', () => {
    render(bar(42));

    const selectAll = screen.getByRole('button', { name: 'Select all (42)' });
    // Still there, still stating the filtered count — the strip's only statement
    // of how many rows the filter matches.
    expect(selectAll).toBeDisabled();
    expect(selectAll).toHaveAccessibleDescription(
      'All 42 groups matching the filter are already selected',
    );
    // It does not become `Deselect all`; that is a separate, still-enabled control.
    expect(screen.getByRole('button', { name: 'Deselect all' })).toBeEnabled();
  });

  it('explains an empty filter differently from a full selection', () => {
    render(bar(0, 0));

    expect(screen.getByRole('button', { name: 'Select all (0)' })).toHaveAccessibleDescription(
      'No groups match the current filter',
    );
    expect(screen.getByRole('button', { name: 'Export list' })).toHaveAccessibleDescription(
      'No groups match the current filter, so there is nothing to export',
    );
  });
});
