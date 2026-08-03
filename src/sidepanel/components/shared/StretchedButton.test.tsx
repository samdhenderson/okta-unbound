import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StretchedButton from './StretchedButton';
import IconButton from './IconButton';

describe('StretchedButton', () => {
  it('is a real button carrying its own accessible name and tooltip', () => {
    render(<StretchedButton label="View group details" onClick={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'View group details' });

    expect(btn).toHaveAttribute('type', 'button');
    expect(btn).toHaveAttribute('title', 'View group details');
  });

  it('lets title override the tooltip while keeping the accessible name', () => {
    render(<StretchedButton label="Open" title="Open Engineering" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute(
      'title',
      'Open Engineering',
    );
  });

  it('points at the element that names its card, so repeated labels stay distinguishable', () => {
    render(
      <div>
        <StretchedButton label="Open details" describedBy="card-name" onClick={vi.fn()} />
        <h3 id="card-name">Engineering</h3>
      </div>,
    );
    expect(screen.getByRole('button', { name: 'Open details' })).toHaveAccessibleDescription(
      'Engineering',
    );
  });

  it('activates by click and by keyboard', async () => {
    const onClick = vi.fn();
    render(<StretchedButton label="Open" onClick={onClick} />);

    const btn = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);

    // Reachable and operable by keyboard, for free, because it is a real button.
    btn.focus();
    expect(btn).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('does not fire while disabled', async () => {
    const onClick = vi.fn();
    render(<StretchedButton label="Open" onClick={onClick} disabled />);

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not nest the card content, so sibling controls stay independently clickable', async () => {
    const onOpen = vi.fn();
    const onExpand = vi.fn();
    render(
      <div className="relative">
        <StretchedButton label="Open" onClick={onOpen} />
        <div className="relative z-10">
          <IconButton label="Expand" onClick={onExpand}>
            <svg />
          </IconButton>
        </div>
      </div>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();

    // The overlay is empty: no control is a descendant of it (axe: nested-interactive).
    expect(screen.getByRole('button', { name: 'Open' })).toBeEmptyDOMElement();
  });
});
