import type { Meta, StoryObj } from '@storybook/react-vite';
import ExportPreviewTable from './ExportPreviewTable';
import type { ExportColumn } from '../../export/types';

/** A minimal fake user row shape for the preview. */
interface FakeRow {
  id: string;
  status: string;
  email: string;
}

const columns: ExportColumn<unknown>[] = [
  {
    id: 'id',
    label: 'User ID',
    group: 'base',
    defaultEnabled: true,
    accessor: (r) => (r as FakeRow).id,
  },
  {
    id: 'status',
    label: 'Status',
    group: 'base',
    defaultEnabled: true,
    accessor: (r) => (r as FakeRow).status,
  },
  {
    id: 'email',
    label: 'Email',
    group: 'profile',
    defaultEnabled: true,
    accessor: (r) => (r as FakeRow).email,
  },
];

const rows: FakeRow[] = Array.from({ length: 12 }, (_, i) => ({
  id: `00uFAKE${String(i).padStart(4, '0')}`,
  status: i % 3 === 0 ? 'SUSPENDED' : 'ACTIVE',
  email: `user${i}@example.com`,
}));

/**
 * Read-only preview of the first rows an export will produce, with a summary
 * banner and optional dropped / capped diagnostics. The `User ID` column
 * deep-links into the Okta Admin Console when a `linkify` config is supplied.
 */
const meta = {
  title: 'Export/ExportPreviewTable',
  component: ExportPreviewTable,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Read-only preview of the first rows an export will produce.\n\n' +
          'Renders the enabled columns using the exact projection the engine uses, with a ' +
          'summary banner, an optional dropped-rows note, and an info alert when the row cap ' +
          'was hit. When the descriptor declares a `linkify` column, that cell deep-links into ' +
          'the Okta Admin Console. Empty results self-diagnose: it distinguishes "the server ' +
          'returned nothing" from "every row was dropped by schema validation".',
      },
    },
  },
  argTypes: {
    columns: { description: 'Enabled columns, in catalog order (headers + projection order).' },
    rows: { description: 'All fetched rows; only the first 100 are shown.' },
    fetched: { description: 'Total raw rows the server returned (before validation).' },
    dropped: { description: 'Rows skipped for failing schema validation.' },
    capped: { description: "Whether the descriptor's row cap was hit." },
    linkify: { description: 'Optional deep-link configuration for one column.' },
    oktaOrigin: { description: 'Okta org origin used to build the deep links.' },
  },
  args: {
    columns,
    rows,
    fetched: rows.length,
    dropped: 0,
    capped: false,
    linkify: { entityType: 'user', idColumnId: 'id' },
    oktaOrigin: 'https://example.okta.com',
  },
} satisfies Meta<typeof ExportPreviewTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A typical preview with deep-linked ids. */
export const Default: Story = {};

/** Some rows failed schema validation and were skipped. */
export const WithDropped: Story = {
  args: { fetched: rows.length + 3, dropped: 3 },
};

/** The export hit the descriptor's row cap. */
export const Capped: Story = {
  args: { capped: true },
};

/** No rows matched the current filter (server returned nothing). */
export const Empty: Story = {
  args: { rows: [], fetched: 0 },
};

/** Rows were returned but all failed validation (self-diagnosing empty state). */
export const AllDropped: Story = {
  args: { rows: [], fetched: 12, dropped: 12 },
};
