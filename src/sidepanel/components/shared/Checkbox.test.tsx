import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Checkbox from './Checkbox';

describe('Checkbox', () => {
  it('reports the new checked state through onChange', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Include members" />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Include members' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggling a checked box reports false', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked onChange={onChange} label="Include members" />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Include members' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('renders a description alongside the label', () => {
    render(
      <Checkbox checked onChange={() => {}} label="Member list" description="Adds a second CSV" />,
    );
    expect(screen.getByText('Adds a second CSV')).toBeInTheDocument();
  });

  it('uses aria-label when rendered bare (no visible label)', () => {
    render(<Checkbox checked={false} onChange={() => {}} aria-label="Select group" />);
    expect(screen.getByRole('checkbox', { name: 'Select group' })).toBeInTheDocument();
  });

  it('does not fire onChange when disabled', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Locked" disabled />);
    const box = screen.getByRole('checkbox', { name: 'Locked' });
    expect(box).toBeDisabled();
    await userEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
  });
});
