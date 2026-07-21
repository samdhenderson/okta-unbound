import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExportPreviewTable from './ExportPreviewTable';
import type { ExportColumn } from '../../export/types';

interface Row {
  id: string;
  email: string;
}

const columns: ExportColumn<unknown>[] = [
  {
    id: 'id',
    label: 'User ID',
    group: 'base',
    defaultEnabled: true,
    accessor: (r) => (r as Row).id,
  },
  {
    id: 'email',
    label: 'Email',
    group: 'profile',
    defaultEnabled: true,
    accessor: (r) => (r as Row).email,
  },
];

const rows: Row[] = Array.from({ length: 150 }, (_, i) => ({
  id: `00uFAKE${i}`,
  email: `user${i}@example.com`,
}));

describe('ExportPreviewTable', () => {
  it('shows the summary banner with the capped preview count and full total', () => {
    render(
      <ExportPreviewTable
        columns={columns}
        rows={rows}
        fetched={rows.length}
        dropped={0}
        capped={false}
      />,
    );
    expect(screen.getByText('Showing 100 of 150 — all 150 rows will export.')).toBeInTheDocument();
  });

  it('renders at most 100 body rows', () => {
    const { container } = render(
      <ExportPreviewTable
        columns={columns}
        rows={rows}
        fetched={rows.length}
        dropped={0}
        capped={false}
      />,
    );
    expect(container.querySelectorAll('tbody tr')).toHaveLength(100);
  });

  it('notes dropped rows and the row cap', () => {
    render(
      <ExportPreviewTable
        columns={columns}
        rows={rows}
        fetched={rows.length + 4}
        dropped={4}
        capped
      />,
    );
    expect(screen.getByText('4 rows skipped (unrecognized shape)')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('row cap');
  });

  it('deep-links the linkify column when an origin is supplied', () => {
    render(
      <ExportPreviewTable
        columns={columns}
        rows={[{ id: '00uFAKE1', email: 'user@example.com' }]}
        fetched={1}
        dropped={0}
        capped={false}
        linkify={{ entityType: 'user', idColumnId: 'id' }}
        oktaOrigin="https://example.okta.com"
      />,
    );
    const link = screen.getByRole('link', { name: '00uFAKE1' });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('href', expect.stringContaining('00uFAKE1'));
  });

  it('shows a "server returned nothing" message when no rows were fetched', () => {
    render(
      <ExportPreviewTable columns={columns} rows={[]} fetched={0} dropped={0} capped={false} />,
    );
    expect(screen.getByText(/server returned no rows/i)).toBeInTheDocument();
  });

  it('self-diagnoses when rows were fetched but all dropped by validation', () => {
    render(
      <ExportPreviewTable columns={columns} rows={[]} fetched={12} dropped={12} capped={false} />,
    );
    expect(screen.getByText(/all were skipped as unrecognized/i)).toBeInTheDocument();
  });
});
