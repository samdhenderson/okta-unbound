import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ColumnPicker from './ColumnPicker';
import type { ExportColumn } from '../../export/types';

const catalog: ExportColumn<unknown>[] = [
  { id: 'id', label: 'User ID', group: 'base', defaultEnabled: true, accessor: () => '00uFAKE' },
  { id: 'email', label: 'Email', group: 'profile', defaultEnabled: true, accessor: () => 'x' },
  { id: 'dept', label: 'Department', group: 'profile', defaultEnabled: false, accessor: () => 'x' },
];

describe('ColumnPicker', () => {
  it('renders only non-empty group headings', () => {
    render(<ColumnPicker catalog={catalog} enabled={new Set(['id'])} onToggle={vi.fn()} />);
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    // No custom-group columns → the "Custom" heading is skipped.
    expect(screen.queryByText('Custom')).not.toBeInTheDocument();
  });

  it('reflects the enabled set via aria-pressed', () => {
    render(<ColumnPicker catalog={catalog} enabled={new Set(['id'])} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'User ID' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Email' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the enabled count as the section badge', () => {
    render(
      <ColumnPicker catalog={catalog} enabled={new Set(['id', 'email'])} onToggle={vi.fn()} />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls onToggle with the column id when a chip is clicked', () => {
    const onToggle = vi.fn();
    render(<ColumnPicker catalog={catalog} enabled={new Set(['id'])} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    expect(onToggle).toHaveBeenCalledWith('email');
  });
});
