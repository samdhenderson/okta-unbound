import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import BreakdownDetailsModal from './BreakdownDetailsModal';
import { NONE_VALUE, OTHER_VALUE } from './memberAnalytics';
import type { BreakdownRow } from './memberAnalytics';

const sampleRows: BreakdownRow[] = [
  { value: 'Engineering', label: 'Engineering', count: 420, pct: 42 },
  { value: 'Sales', label: 'Sales', count: 210, pct: 21 },
  { value: 'Marketing', label: 'Marketing', count: 150, pct: 15 },
  { value: 'Support', label: 'Support', count: 90, pct: 9 },
  { value: NONE_VALUE, label: '(none)', count: 60, pct: 6 },
  { value: OTHER_VALUE, label: 'Other (3 values)', count: 60, pct: 6 },
];

/** Modal showing the full value distribution for one composition dimension. */
const meta = {
  title: 'Overview/Members/BreakdownDetailsModal',
  component: BreakdownDetailsModal,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    isOpen: true,
    onClose: fn(),
    title: 'Department',
    rows: sampleRows,
    activeValues: new Set<string>(),
    onRowClick: fn(),
  },
} satisfies Meta<typeof BreakdownDetailsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Full value distribution for a dimension, with a "Copy all" affordance. */
export const Default: Story = {};

/** One value is currently active as a member-list filter. */
export const WithActiveFilter: Story = {
  args: { activeValues: new Set(['Sales']) },
};

/** No values at all — the copy button disables itself. */
export const Empty: Story = {
  args: { rows: [], title: 'Cost center' },
};

/** Closed state renders nothing. */
export const Closed: Story = {
  args: { isOpen: false },
};
