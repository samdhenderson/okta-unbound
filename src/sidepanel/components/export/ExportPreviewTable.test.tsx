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
    render(<ExportPreviewTable columns={columns} rows={rows} dropped={0} capped={false} />);
    expect(screen.getByText('Showing 100 of 150 — all 150 rows will export.')).toBeInTheDocument();
  });

  it('renders at most 100 body rows', () => {
    const { container } = render(
      <ExportPreviewTable columns={columns} rows={rows} dropped={0} capped={false} />,
    );
    expect(container.querySelectorAll('tbody tr')).toHaveLength(100);
  });

  it('notes dropped rows and the row cap', () => {
    render(<ExportPreviewTable columns={columns} rows={rows} dropped={4} capped />);
    expect(screen.getByText('4 rows skipped (unrecognized shape)')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('row cap');
  });

  it('deep-links the linkify column when an origin is supplied', () => {
    render(
      <ExportPreviewTable
        columns={columns}
        rows={[{ id: '00uFAKE1', email: 'user@example.com' }]}
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

  it('shows an empty message when there are no rows', () => {
    render(<ExportPreviewTable columns={columns} rows={[]} dropped={0} capped={false} />);
    expect(screen.getByText(/nothing to preview/i)).toBeInTheDocument();
  });
});
