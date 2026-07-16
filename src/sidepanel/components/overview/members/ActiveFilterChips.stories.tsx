import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ActiveFilterChips from './ActiveFilterChips';
import type { MemberFilter } from './memberAnalytics';

const sampleFilters: MemberFilter[] = [
  { dimension: 'status', value: 'ACTIVE', label: 'Status: Active' },
  { dimension: 'department', value: 'Engineering', label: 'Department: Engineering' },
];

/** Removable chips summarizing the member explorer's active facet filters. */
const meta = {
  title: 'Overview/Members/ActiveFilterChips',
  component: ActiveFilterChips,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    filters: sampleFilters,
    onRemove: fn(),
    onClearAll: fn(),
  },
} satisfies Meta<typeof ActiveFilterChips>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two active filter chips with a "Clear all" action. */
export const Default: Story = {};

/** A single active filter. */
export const SingleFilter: Story = {
  args: { filters: [sampleFilters[0]] },
};

/** Many active filters wrapping across lines. */
export const ManyFilters: Story = {
  args: {
    filters: [
      { dimension: 'status', value: 'ACTIVE', label: 'Status: Active' },
      { dimension: 'department', value: 'Engineering', label: 'Department: Engineering' },
      { dimension: 'title', value: 'Developer', label: 'Title: Developer' },
      { dimension: 'city', value: 'Austin', label: 'City: Austin' },
      { dimension: 'mfa', value: 'enrolled', label: 'MFA: Enrolled' },
    ],
  },
};

/** No active filters — the component renders nothing. */
export const Empty: Story = {
  args: { filters: [] },
};
