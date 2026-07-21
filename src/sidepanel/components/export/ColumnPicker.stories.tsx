import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ColumnPicker from './ColumnPicker';
import type { ExportColumn } from '../../export/types';

/** Fake catalog spanning the `base` and `profile` buckets. */
const catalog: ExportColumn<unknown>[] = [
  { id: 'id', label: 'User ID', group: 'base', defaultEnabled: true, accessor: () => '00uFAKE' },
  { id: 'status', label: 'Status', group: 'base', defaultEnabled: true, accessor: () => 'ACTIVE' },
  { id: 'created', label: 'Created', group: 'base', defaultEnabled: false, accessor: () => '' },
  {
    id: 'email',
    label: 'Email',
    group: 'profile',
    defaultEnabled: true,
    accessor: () => 'user@example.com',
  },
  {
    id: 'firstName',
    label: 'First Name',
    group: 'profile',
    defaultEnabled: true,
    accessor: () => 'Ada',
  },
  {
    id: 'department',
    label: 'Department',
    group: 'profile',
    defaultEnabled: false,
    accessor: () => 'Engineering',
  },
];

/**
 * Inline collapsible column selector — columns grouped by bucket, each a
 * {@link FilterPill} toggle chip. Fully controlled by the Export tab hook.
 */
const meta = {
  title: 'Export/ColumnPicker',
  component: ColumnPicker,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    catalog,
    enabled: new Set(['id', 'status', 'email', 'firstName']),
    onToggle: fn(),
  },
} satisfies Meta<typeof ColumnPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default selection: the descriptor's `defaultEnabled` columns. */
export const Default: Story = {};

/** Only a single column enabled. */
export const Minimal: Story = {
  args: { enabled: new Set(['email']) },
};

/** Every column enabled. */
export const AllEnabled: Story = {
  args: { enabled: new Set(catalog.map((column) => column.id)) },
};
