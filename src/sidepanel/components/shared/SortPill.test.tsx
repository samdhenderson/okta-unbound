import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SortPill from './SortPill';

describe('SortPill', () => {
  it('exposes its label as the accessible name and reflects the active field as aria-pressed', () => {
    const { rerender } = render(
      <SortPill
        field="name"
        label="Name"
        activeField="status"
        descending={false}
        onToggle={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Name' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');

    rerender(
      <SortPill
        field="name"
        label="Name"
        activeField="name"
        descending={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Name' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the caret only when active and rotates it for descending', () => {
    const { container, rerender } = render(
      <SortPill
        field="name"
        label="Name"
        activeField="status"
        descending={false}
        onToggle={vi.fn()}
      />,
    );
    // Inactive: no caret.
    expect(container.querySelector('svg')).toBeNull();

    // Active ascending: caret present, not rotated.
    rerender(
      <SortPill
        field="name"
        label="Name"
        activeField="name"
        descending={false}
        onToggle={vi.fn()}
      />,
    );
    const ascCaret = container.querySelector('svg');
    expect(ascCaret).not.toBeNull();
    expect(ascCaret?.getAttribute('class')).not.toContain('rotate-180');

    // Active descending: caret rotated.
    rerender(
      <SortPill field="name" label="Name" activeField="name" descending onToggle={vi.fn()} />,
    );
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('rotate-180');
  });

  it('fires onToggle with its field when clicked', async () => {
    const onToggle = vi.fn();
    render(
      <SortPill
        field="status"
        label="Status"
        activeField="name"
        descending={false}
        onToggle={onToggle}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Status' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('status');
  });
});
