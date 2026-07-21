import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EntityPicker from './EntityPicker';
import type { EntityExport } from '../../export/types';
import { z } from 'zod';

const descriptors: EntityExport[] = [
  {
    id: 'users',
    displayName: 'Users',
    icon: 'user',
    description: 'All users in the org.',
    context: { kind: 'whole-org' },
    endpoint: '/api/v1/users',
    defaultQuery: {},
    schema: z.unknown(),
    columnCatalog: [],
    filter: { kind: 'none' },
  },
];

describe('EntityPicker', () => {
  it('renders a selectable row per descriptor', () => {
    render(<EntityPicker descriptors={descriptors} onSelect={vi.fn()} />);
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('All users in the org.')).toBeInTheDocument();
  });

  it('reports the chosen descriptor id on click', () => {
    const onSelect = vi.fn();
    render(<EntityPicker descriptors={descriptors} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Users/ }));
    expect(onSelect).toHaveBeenCalledWith('users');
  });

  it('reports selection on keyboard activation', () => {
    const onSelect = vi.fn();
    render(<EntityPicker descriptors={descriptors} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Users/ }), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('users');
  });

  it('shows an empty state when no descriptors are registered', () => {
    render(<EntityPicker descriptors={[]} onSelect={vi.fn()} />);
    expect(screen.getByText('No exports available')).toBeInTheDocument();
  });
});
