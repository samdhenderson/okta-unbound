import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComparisonDiffTab from './ComparisonDiffTab';
import type { ParityRow } from './comparisonAnalytics';

/**
 * The parity row: every row states who holds the item and what closes the gap.
 *
 * This replaces the three-bucket suite. Three of its assertions were about real
 * defects and are carried forward here against the new row — a long detail never
 * displaces the action, the detail does not stretch across the row, and the list
 * is not capped at a fixed height — because those were reported bugs, not
 * artefacts of the old structure.
 *
 * Fixtures use obviously fake placeholders only.
 */

const baseProps = {
  contextName: 'Alice Context',
  comparedName: 'Bob Compared',
  noun: 'group',
  emptyText: 'Neither user is in any groups.',
};

const row = (over: Partial<ParityRow> = {}): ParityRow => ({
  id: '00gFAKE1',
  label: 'VPN Access',
  inContext: false,
  inCompared: true,
  ...over,
});

/** The <li> for an item, found through the `title` on its label span. */
const rowFor = (label: string): HTMLElement => {
  const li = screen.getByTitle(label).closest('li');
  if (!li) throw new Error(`no row for "${label}"`);
  return li;
};

describe('the row states the comparison', () => {
  it('marks a shared item with = and a difference with ≠', () => {
    render(
      <ComparisonDiffTab
        {...baseProps}
        rows={[
          row({ id: 'g1', label: 'Shared Group', inContext: true, inCompared: true }),
          row({ id: 'g2', label: 'Only Bob' }),
        ]}
      />,
    );

    // `All`, because the default filter hides shared rows.
    return userEvent.click(screen.getByRole('button', { name: /^All/ })).then(() => {
      expect(within(rowFor('Shared Group')).getByText('=')).toBeInTheDocument();
      expect(within(rowFor('Only Bob')).getByText('≠')).toBeInTheDocument();
    });
  });

  it('gives the marker a label and keeps it out of the tab order', () => {
    render(<ComparisonDiffTab {...baseProps} rows={[row()]} />);

    const marker = within(rowFor('VPN Access')).getByRole('img', {
      name: /only one user has this/i,
    });
    // It borrows the button silhouette but must never be a control.
    expect(marker.tagName).toBe('SPAN');
    expect(marker).not.toHaveAttribute('tabindex');
  });

  it('offers the action on the side that LACKS the item, in each direction', () => {
    const toContext = vi.fn((r: ParityRow) => (
      <button type="button">Add to Alice {r.label}</button>
    ));
    const toCompared = vi.fn((r: ParityRow) => <button type="button">Add to Bob {r.label}</button>);

    render(
      <ComparisonDiffTab
        {...baseProps}
        rows={[
          row({ id: 'g1', label: 'Only Bob', inContext: false, inCompared: true }),
          row({ id: 'g2', label: 'Only Alice', inContext: true, inCompared: false }),
        ]}
        renderContextAction={toContext}
        renderComparedAction={toCompared}
      />,
    );

    expect(
      within(rowFor('Only Bob')).getByRole('button', { name: 'Add to Alice Only Bob' }),
    ).toBeInTheDocument();
    expect(
      within(rowFor('Only Alice')).getByRole('button', { name: 'Add to Bob Only Alice' }),
    ).toBeInTheDocument();
  });

  it('states a non-answer rather than a button that would fail', () => {
    // An app-mastered group: the host returns null because adding a member
    // through the group API would be rejected.
    render(<ComparisonDiffTab {...baseProps} rows={[row()]} renderContextAction={() => null} />);

    expect(within(rowFor('VPN Access')).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTitle('Alice Context does not have this')).toBeInTheDocument();
  });

  it('NAMES BOTH sides, so neither has to be inferred from position', () => {
    // INVERTED (ADR-0022, "behavior that legitimately changes"). This case used to
    // assert the opposite — that only the holder was named and the other side was
    // identified by elimination. That was the defect: the unnamed side was the one
    // you were about to act on, and the Add button's arrow pointed away from it,
    // so the row read as the reverse of what clicking it did. The inverted case is
    // the record of the fix.
    render(<ComparisonDiffTab {...baseProps} rows={[row()]} />);

    const li = rowFor('VPN Access');
    // Bob holds it, Alice does not — and both are stated.
    expect(within(li).getByText('Bob Compared')).toBeInTheDocument();
    expect(within(li).getByText('Alice Context')).toBeInTheDocument();
  });

  it('hands each cell the name of the user who would RECEIVE the item', () => {
    // Retargeted from a case that pinned `CellDirection` ('right' for the left
    // cell, 'left' for the right) so the caller could point an arrow inward at the
    // `≠`. That type is gone: the arrow pointed away from the recipient, which is
    // the bug. What the caller needs instead is who receives — always this cell's
    // own user — so the control can say so.
    const toContext = vi.fn((_row: ParityRow, _recipientName: string) => null);
    const toCompared = vi.fn((_row: ParityRow, _recipientName: string) => null);

    render(
      <ComparisonDiffTab
        {...baseProps}
        rows={[
          row({ id: 'g1', label: 'Only Bob', inContext: false, inCompared: true }),
          row({ id: 'g2', label: 'Only Alice', inContext: true, inCompared: false }),
        ]}
        renderContextAction={toContext}
        renderComparedAction={toCompared}
      />,
    );

    expect(toContext.mock.calls[0][1]).toBe('Alice Context');
    expect(toCompared.mock.calls[0][1]).toBe('Bob Compared');
  });
});

describe('filtering and search', () => {
  const rows = [
    row({ id: 'g1', label: 'Only Bob' }),
    row({ id: 'g2', label: 'Shared Group', inContext: true, inCompared: true }),
    row({ id: 'g3', label: 'Also Shared', inContext: true, inCompared: true }),
  ];

  it('opens on the differences, so the actionable rows are not buried', () => {
    render(<ComparisonDiffTab {...baseProps} rows={rows} />);

    expect(screen.getByTitle('Only Bob')).toBeInTheDocument();
    expect(screen.queryByTitle('Shared Group')).not.toBeInTheDocument();
  });

  it('counts each filter so the split is visible without switching', () => {
    render(<ComparisonDiffTab {...baseProps} rows={rows} />);

    expect(screen.getByRole('button', { name: /Differences 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Shared 2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All 3/ })).toBeInTheDocument();
  });

  it('shows the shared rows on demand', async () => {
    render(<ComparisonDiffTab {...baseProps} rows={rows} />);

    await userEvent.click(screen.getByRole('button', { name: /^Shared/ }));
    expect(screen.getByTitle('Shared Group')).toBeInTheDocument();
    expect(screen.queryByTitle('Only Bob')).not.toBeInTheDocument();
  });

  it('filters by name within the current selection', async () => {
    render(<ComparisonDiffTab {...baseProps} rows={rows} />);

    await userEvent.click(screen.getByRole('button', { name: /^All/ }));
    await userEvent.type(screen.getByLabelText('Filter groups by name'), 'shared');

    expect(screen.getByTitle('Shared Group')).toBeInTheDocument();
    expect(screen.getByTitle('Also Shared')).toBeInTheDocument();
    expect(screen.queryByTitle('Only Bob')).not.toBeInTheDocument();
  });

  it('distinguishes "nothing here" from "nothing matches"', async () => {
    const { rerender } = render(<ComparisonDiffTab {...baseProps} rows={[]} />);
    expect(screen.getByText('Neither user is in any groups.')).toBeInTheDocument();

    rerender(<ComparisonDiffTab {...baseProps} rows={rows} />);
    await userEvent.type(screen.getByLabelText('Filter groups by name'), 'zzz');
    expect(screen.getByText('No groups match this filter.')).toBeInTheDocument();
  });
});

describe('carried forward from the bucket suite', () => {
  it('never lets a long detail displace the row action', () => {
    render(
      <ComparisonDiffTab
        {...baseProps}
        rows={[row()]}
        renderContextAction={() => <button type="button">Add</button>}
        renderMeta={() => (
          <span>Likely added by rule: Contractors → VPN Access, Remote Access Baseline</span>
        )}
      />,
    );

    const li = rowFor('VPN Access');
    const action = within(li).getByRole('button', { name: 'Add' });
    const detail = within(li).getByText(/Likely added by rule/);

    // The detail shares the label's column — that column is what truncates — and
    // the action lives outside it, so no length of rule name can push it away.
    // Found from the label rather than from the detail's own parent: the detail
    // now sits in a fixed-height slot inside the column, so its parent is one
    // level below the column this is about.
    const column = within(li).getByTitle('VPN Access').parentElement;
    expect(column).toContainElement(detail);
    expect(column).not.toContainElement(action);
  });

  it('stacks the detail in a column that does not stretch it across the row', () => {
    render(
      <ComparisonDiffTab
        {...baseProps}
        rows={[row()]}
        renderMeta={() => <span>Managed by app</span>}
      />,
    );

    const li = rowFor('VPN Access');
    const column = within(li).getByTitle('VPN Access').parentElement;
    expect(column).toContainElement(within(li).getByText('Managed by app'));
    // Flex children stretch by default, which turned every source chip into a
    // full-width grey bar spanning the row.
    expect(column?.className).toContain('items-start');
    expect(column?.className).toContain('flex-col');
  });

  it('lets the list grow instead of capping it at a fixed height', () => {
    render(
      <ComparisonDiffTab
        {...baseProps}
        rows={[row({ id: 'g1', label: 'A' }), row({ id: 'g2', label: 'B' })]}
      />,
    );

    const list = rowFor('A').closest('ul');
    // A fixed cap is what made 9 rows scroll inside a 176px box while the page
    // below sat empty.
    expect(list?.className).not.toContain('max-h-44');
    expect(list?.className).toContain('flex-1');
  });
});
