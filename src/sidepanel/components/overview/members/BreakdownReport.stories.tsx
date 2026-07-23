import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import BreakdownReport from './BreakdownReport';
import { NONE_VALUE, OTHER_VALUE } from './memberAnalytics';
import type { BreakdownRow } from './memberAnalytics';

const sampleRows: BreakdownRow[] = [
  { value: 'Engineering', label: 'Engineering', count: 420, pct: 42 },
  { value: 'Sales', label: 'Sales', count: 210, pct: 21 },
  { value: 'Marketing', label: 'Marketing', count: 150, pct: 15 },
  { value: NONE_VALUE, label: '(none)', count: 60, pct: 6 },
  { value: OTHER_VALUE, label: 'Other (4 values)', count: 160, pct: 16 },
];

/** Dependency-free list of horizontal proportion bars for a value distribution. */
const meta = {
  title: 'Overview/Members/BreakdownReport',
  component: BreakdownReport,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Dependency-free list of horizontal proportion bars for a value distribution.\n\n' +
          'Each row is a clickable filter toggle that highlights when its value is an ' +
          'active member-list filter; the aggregated "Other" row is clickable only when an ' +
          '`onShowOther` handler is supplied, revealing a "View →" affordance. Bars are ' +
          'plain divs sized by percentage using existing color tokens. With no rows it ' +
          'falls back to an empty-state message (`emptyMessage`, default "No data").',
      },
    },
  },
  argTypes: {
    rows: { description: 'Pre-computed, sorted rows (top-N + optional "Other").' },
    activeValues: {
      description: 'Canonical values currently selected as filters (for highlight).',
    },
    onRowClick: { description: 'Called when a clickable value row is toggled.' },
    onShowOther: {
      description: 'Called when the aggregated "Other" row is clicked, to reveal its values.',
    },
    emptyMessage: { description: 'Optional empty-state message when there are no rows.' },
  },
  args: {
    rows: sampleRows,
    activeValues: new Set<string>(),
    onRowClick: fn(),
  },
} satisfies Meta<typeof BreakdownReport>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Standard distribution with a "(none)" and an aggregated "Other" row. */
export const Default: Story = {};

/** No rows at all — falls back to the empty-state message. */
export const Empty: Story = {
  args: { rows: [] },
};

/** A custom empty-state message. */
export const EmptyWithCustomMessage: Story = {
  args: { rows: [], emptyMessage: 'No breakdown available yet.' },
};

/** One row is highlighted as an active member-list filter. */
export const WithActiveRow: Story = {
  args: { activeValues: new Set(['Engineering']) },
};

/** The aggregated "Other" row becomes clickable and reveals a "View →" affordance. */
export const WithExpandableOther: Story = {
  args: { onShowOther: fn() },
};
