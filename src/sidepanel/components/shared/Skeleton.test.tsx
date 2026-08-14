import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Skeleton from './Skeleton';

describe('Skeleton', () => {
  it('exposes exactly one accessible status node, defaulting to "Loading"', () => {
    render(<Skeleton />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('accepts a custom accessible label', () => {
    render(<Skeleton variant="row" count={3} label="Loading members" />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Loading members' })).toBeInTheDocument();
  });

  it('hides every visual bone from assistive tech', () => {
    const { container } = render(<Skeleton variant="row" count={3} />);
    const bones = container.querySelectorAll('[aria-hidden="true"]');
    expect(bones).toHaveLength(3);
    bones.forEach((bone) => expect(bone).toHaveAttribute('aria-hidden', 'true'));
  });

  it('renders count repeated blocks without a loop at the call site', () => {
    const { container, rerender } = render(<Skeleton variant="text" count={1} />);
    expect(container.querySelectorAll('.skeleton')).toHaveLength(1);

    rerender(<Skeleton variant="text" count={5} />);
    expect(container.querySelectorAll('.skeleton')).toHaveLength(5);
  });

  it('wraps repeats in the staggered rise-in container, not each animating independently', () => {
    const { container, rerender } = render(<Skeleton variant="row" count={1} />);
    expect(container.querySelector('.rise-in-stagger')).toBeNull();

    rerender(<Skeleton variant="row" count={4} />);
    expect(container.querySelector('.rise-in-stagger')).not.toBeNull();
  });

  it('draws a single bar per lineRow block, where a row block draws a full anatomy', () => {
    // The variants' whole difference: `lineRow` stands in for a one-line row, so
    // drawing `row`'s title / two badges / meta line / trailing block there would
    // be several times too tall and would lurch when the real rows arrive.
    const { container: lineContainer } = render(<Skeleton variant="lineRow" count={2} />);
    expect(lineContainer.querySelectorAll('.skeleton')).toHaveLength(2);

    const { container: rowContainer } = render(<Skeleton variant="row" count={2} />);
    expect(rowContainer.querySelectorAll('.skeleton')).toHaveLength(10);
  });

  it('renders the row and card variants as bordered blocks', () => {
    const { container: rowContainer } = render(<Skeleton variant="row" />);
    expect(rowContainer.querySelector('.border-neutral-200')).not.toBeNull();

    const { container: cardContainer } = render(<Skeleton variant="card" />);
    expect(cardContainer.querySelector('.border-neutral-200')).not.toBeNull();
  });
});
