import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IconButton from './IconButton';

const icon = <svg data-testid="icon" />;

describe('IconButton', () => {
  it('exposes its label as the accessible name and default title', () => {
    render(<IconButton label="Remove filter">{icon}</IconButton>);
    const btn = screen.getByRole('button', { name: 'Remove filter' });
    expect(btn).toHaveAttribute('title', 'Remove filter');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('lets title override the tooltip while keeping the aria-label', () => {
    render(
      <IconButton label="Close" title="Close modal">
        {icon}
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn).toHaveAttribute('title', 'Close modal');
  });

  it('fires onClick when enabled and not when disabled', async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <IconButton label="Clear" onClick={onClick}>
        {icon}
      </IconButton>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <IconButton label="Clear" onClick={onClick} disabled>
        {icon}
      </IconButton>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('reflects toggle state as aria-pressed', () => {
    const { rerender } = render(
      <IconButton label="Pin" active={false}>
        {icon}
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Pin' })).toHaveAttribute('aria-pressed', 'false');
    rerender(
      <IconButton label="Pin" active>
        {icon}
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Pin' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reflects disclosure state as aria-expanded and points at the region it controls', () => {
    const { rerender } = render(
      <IconButton label="Expand" expanded={false} controls="panel-1">
        {icon}
      </IconButton>,
    );
    const collapsed = screen.getByRole('button', { name: 'Expand' });
    expect(collapsed).toHaveAttribute('aria-expanded', 'false');
    expect(collapsed).toHaveAttribute('aria-controls', 'panel-1');

    rerender(
      <IconButton label="Collapse" expanded controls="panel-1">
        {icon}
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Collapse' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('omits the disclosure attributes entirely when it is not a disclosure trigger', () => {
    render(<IconButton label="Close">{icon}</IconButton>);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn).not.toHaveAttribute('aria-expanded');
    expect(btn).not.toHaveAttribute('aria-controls');
  });
});
