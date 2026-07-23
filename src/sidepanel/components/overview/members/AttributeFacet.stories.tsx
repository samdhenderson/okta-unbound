import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import AttributeFacet from './AttributeFacet';
import { discoverAttributeBreakdowns, NONE_VALUE, OTHER_VALUE } from './memberAnalytics';
import type { AttributeSummary } from './memberAnalytics';
import { mockUsers } from '../../../../test/mocks/handlers';

// Real distribution discovered from the fixture members (all share one department/title).
const discovered = discoverAttributeBreakdowns(mockUsers);
const departmentSummary = discovered.find((a) => a.key === 'department') ?? discovered[0];

// Hand-built summary with several named values plus "(none)" and an aggregated "Other" tail.
const manyValuesSummary: AttributeSummary = {
  key: 'title',
  label: 'Title',
  distinct: 9,
  populated: 940,
  total: 1000,
  fillRate: 94,
  rows: [
    { value: 'Software Engineer', label: 'Software Engineer', count: 320, pct: 32 },
    { value: 'Product Manager', label: 'Product Manager', count: 210, pct: 21 },
    { value: 'Designer', label: 'Designer', count: 150, pct: 15 },
    { value: 'Support Engineer', label: 'Support Engineer', count: 90, pct: 9 },
    { value: NONE_VALUE, label: '(none)', count: 60, pct: 6 },
    { value: OTHER_VALUE, label: 'Other (5 values)', count: 170, pct: 17 },
  ],
};

/** Compact card visualizing one profile attribute's value distribution as clickable filters. */
const meta = {
  title: 'Overview/Members/AttributeFacet',
  component: AttributeFacet,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          "Compact card visualizing one profile attribute's value distribution as " +
          'clickable filters.\n\n' +
          'Shows a segmented "spread bar" plus a short legend of the leading values; every ' +
          'segment/legend entry toggles a member-list filter, and "View all" opens the full ' +
          'distribution. Named values use an indigo ramp while "(none)"/"Other" use ' +
          'neutrals; a low fill rate surfaces a "% set" suffix next to the value count.',
      },
    },
  },
  argTypes: {
    summary: { description: 'The attribute and its precomputed value distribution.' },
    activeValues: {
      description: 'Canonical values currently active as filters for this attribute.',
    },
    onToggleValue: { description: 'Toggle a value as a member-list filter.' },
    onExpand: { description: 'Open the full value distribution for this attribute.' },
  },
  args: {
    summary: departmentSummary,
    activeValues: new Set<string>(),
    onToggleValue: fn(),
    onExpand: fn(),
  },
} satisfies Meta<typeof AttributeFacet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Single-value distribution discovered from the fixture members. */
export const Default: Story = {};

/** Several named values plus "(none)" and an aggregated "Other" tail. */
export const ManyValues: Story = {
  args: { summary: manyValuesSummary },
};

/** One value is currently active as a member-list filter. */
export const WithActiveFilter: Story = {
  args: {
    summary: manyValuesSummary,
    activeValues: new Set(['Product Manager']),
  },
};

/** Low fill rate surfaces the "% set" suffix next to the value count. */
export const LowFillRate: Story = {
  args: {
    summary: {
      ...manyValuesSummary,
      fillRate: 62,
    },
  },
};
