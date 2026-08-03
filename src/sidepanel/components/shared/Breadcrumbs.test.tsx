/**
 * Tests for Breadcrumbs — the trail primitive behind in-tab push/pop navigation.
 *
 * Pins the navigation landmark, the "last crumb is the current page" contract
 * (`aria-current="page"`, not a button), and that ancestor crumbs invoke their
 * handler.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Breadcrumbs, { type BreadcrumbItem } from './Breadcrumbs';

const ITEMS: BreadcrumbItem[] = [
  { key: 'root', label: 'Groups', onSelect: vi.fn() },
  { key: 'g1', label: 'Engineering', onSelect: vi.fn() },
  { key: 'g2', label: 'Members' },
];

describe('Breadcrumbs', () => {
  it('renders a navigation landmark with an ordered list of crumbs', () => {
    render(<Breadcrumbs items={ITEMS} />);

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders ancestor crumbs as buttons and the last crumb as the current page', () => {
    render(<Breadcrumbs items={ITEMS} />);

    expect(screen.getByRole('button', { name: 'Groups' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Engineering' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Members' })).not.toBeInTheDocument();
    expect(screen.getByText('Members')).toHaveAttribute('aria-current', 'page');
  });

  it('invokes onSelect when an ancestor crumb is activated', async () => {
    const onSelect = vi.fn();
    render(
      <Breadcrumbs
        items={[
          { key: 'root', label: 'Groups', onSelect },
          { key: 'g1', label: 'Engineering' },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Groups' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('accepts a custom landmark label', () => {
    render(<Breadcrumbs items={ITEMS} ariaLabel="Group navigation" />);

    expect(screen.getByRole('navigation', { name: 'Group navigation' })).toBeInTheDocument();
  });

  it('renders nothing for an empty trail', () => {
    const { container } = render(<Breadcrumbs items={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
