import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
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
  title: 'Members/BreakdownReport',
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
    rowIntent: {
      description:
        'What a value row does: `toggle` a facet on the list beside it, or `navigate` away to the Members tab.',
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

/**
 * A row that **leaves** says so before it is clicked.
 *
 * On the Insights tab this report is not sitting above the list it filters:
 * activating a row switches to Members and applies the filter there. A reader
 * who expected the toggle behaviour would simply find themselves somewhere else,
 * so in `navigate` intent every row carries its destination — "Filter Members →"
 * visibly on the row, and the whole sentence, including the value and how many
 * members it covers, in the accessible name.
 *
 * Deliberately not a confirm dialog: applying a filter is read-only and
 * symmetrically undone, and a modal in front of every value would make the
 * reveal unusable. `aria-pressed` is dropped too — the row is no longer a
 * toggle, and announcing a pressed state for a navigation would be a lie.
 */
export const NavigatesToMembers: Story = {
  args: { rowIntent: 'navigate' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The destination is on the row, not discovered by taking it.
    const row = canvas.getByRole('button', {
      name: 'Filter Members by Engineering — 420 members. Opens the Members tab.',
    });
    await expect(row).toBeVisible();

    // Not a toggle, so it must not claim a pressed state.
    await expect(row).not.toHaveAttribute('aria-pressed');
  },
};

/** The same rows in `toggle` intent still announce their pressed state, and promise no jump. */
export const ToggleIntentKeepsPressedState: Story = {
  args: { activeValues: new Set(['Engineering']) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('button', { pressed: true })).toHaveLength(1);
    await expect(canvas.queryByText(/Filter Members/)).toBeNull();
  },
};
