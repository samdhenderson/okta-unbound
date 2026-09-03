import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import AttributeHealthCard, { type AttributeHealthCardProps } from './AttributeHealthCard';
import BreakdownDetailsModal from '../../members/BreakdownDetailsModal';
import {
  OTHER_VALUE,
  type AttributeSummary,
  type BreakdownRow,
} from '../../members/memberAnalytics';
import type { AttributeRuleRef } from '../../../../shared/rules/groupAttributeIndex';

const summary: AttributeSummary = {
  key: 'department',
  label: 'Department',
  distinct: 2,
  populated: 9,
  total: 12,
  fillRate: 75,
  rows: [
    { value: 'Engineering', label: 'Engineering', count: 5, pct: 41.7 },
    { value: 'Product', label: 'Product', count: 4, pct: 33.3 },
    { value: '', label: '(none)', count: 3, pct: 25 },
  ],
};

const rules: AttributeRuleRef[] = [{ ruleId: '0prFAKE1', ruleName: 'Eng & Product — full-time' }];

const meta = {
  title: 'Groups/AttributeHealthCard',
  component: AttributeHealthCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    // The card's "Values"/"Depended on by" headings are `<h3>`s with no page
    // heading above them in isolation; the pane that mounts the grid supplies
    // the surrounding levels.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          "One card in the Insights tab's attribute grid: how one profile attribute is " +
          "actually populated across this group's members.\n\n" +
          '**Rules are an annotation, not the filter.** A card used to exist only for ' +
          'attributes a feeding rule referenced, which hid the drift worth catching most — a ' +
          '`department` nobody\u2019s rule reads, spelled four different ways, is invisible ' +
          'until the day someone writes a rule against it. Every discovered attribute gets a ' +
          'card now, and an empty `rules` list renders as **no block** rather than "0 rules", ' +
          'because it is an answer about coupling and not a defect.\n\n' +
          '**Outliers are marked, never corrected.** The value list flags what `outlierValues` ' +
          'judges to be drift from a dominant house style — conservatively, and as a flag on a ' +
          'card rather than a claim that the record is wrong. The marker is the word ' +
          '"Outlier:", not colour alone.',
      },
    },
  },
  argTypes: {
    summary: { description: "The attribute's precomputed distribution." },
    rules: {
      description:
        'The feeding rules that reference this attribute. Empty is an answer — no block renders.',
    },
    onNavigateToRule: { description: 'Deep-links a dependent rule into the Rules tab.' },
  },
  args: { summary, rules, onNavigateToRule: fn() },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AttributeHealthCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One dependent rule, a mixed value spread. */
export const Default: Story = {};

/** Two rules depend on the same attribute. */
export const MultipleRules: Story = {
  args: {
    rules: [
      { ruleId: '0prFAKE1', ruleName: 'Eng & Product — full-time' },
      { ruleId: '0prFAKE2', ruleName: 'Legacy import' },
    ],
  },
};

/** Fully populated — no blank segment. */
export const FullyPopulated: Story = {
  args: {
    summary: {
      ...summary,
      populated: 12,
      fillRate: 100,
      rows: [
        { value: 'Engineering', label: 'Engineering', count: 8, pct: 66.7 },
        { value: 'Product', label: 'Product', count: 4, pct: 33.3 },
      ],
    },
  },
};

/**
 * No feeding rule reads this attribute. That is a fact about coupling, not a
 * defect, so the "Depended on by" block is omitted rather than rendered as
 * "0 rules" — and this is exactly the card the old rule-filtered grid hid.
 */
export const NoDependentRules: Story = {
  args: { rules: [] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/Depended on by/)).toBeNull();
    await expect(canvas.getByText('Values')).toBeVisible();
  },
};

/**
 * Config drift: one dominant spelling and two stragglers. The card marks them —
 * in words, not colour alone — and shows the dominant value beside them so a
 * reader can see what they diverge *from*.
 */
export const WithOutliers: Story = {
  args: {
    rules: [],
    summary: {
      key: 'department',
      label: 'Department',
      distinct: 3,
      populated: 100,
      total: 100,
      fillRate: 100,
      rows: [
        { value: 'Engineering', label: 'Engineering', count: 94, pct: 94 },
        { value: 'engineering', label: 'engineering', count: 4, pct: 4 },
        { value: 'ENGINEERING', label: 'ENGINEERING', count: 2, pct: 2 },
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('2 outliers')).toBeVisible();
    await expect(canvas.getAllByText('Outlier:')).toHaveLength(2);
    // The dominant value is never itself an outlier.
    await expect(canvas.getByText('Engineering')).toBeVisible();
  },
};

/**
 * A legitimate three-way split. There is no house style to diverge from, so
 * nothing is flagged — a false positive here accuses a correct record of being
 * wrong.
 */
export const LegitimateSpreadIsNotDrift: Story = {
  args: {
    rules: [],
    summary: {
      key: 'department',
      label: 'Department',
      distinct: 3,
      populated: 100,
      total: 100,
      fillRate: 100,
      rows: [
        { value: 'Engineering', label: 'Engineering', count: 40, pct: 40 },
        { value: 'Sales', label: 'Sales', count: 35, pct: 35 },
        { value: 'Support', label: 'Support', count: 25, pct: 25 },
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/outlier/i)).toBeNull();
  },
};

/**
 * A truncated attribute: `discoverAttributeBreakdowns` keeps the leading values
 * and folds the rest into one `Other (N values)` row. Those N are exactly where
 * drift hides, so with no way to open the row the card would state a number it
 * refuses to explain.
 */
const truncated: AttributeSummary = {
  key: 'costCenter',
  label: 'Cost center',
  distinct: 9,
  populated: 40,
  total: 40,
  fillRate: 100,
  rows: [
    { value: 'CC-1000', label: 'CC-1000', count: 12, pct: 30 },
    { value: 'CC-1001', label: 'CC-1001', count: 10, pct: 25 },
    { value: 'CC-1002', label: 'CC-1002', count: 6, pct: 15 },
    { value: OTHER_VALUE, label: 'Other (6 values)', count: 12, pct: 30 },
  ],
};

/** The full distribution the pane re-derives with `computeDimensionBreakdown`. */
const fullRows: BreakdownRow[] = [
  { value: 'CC-1000', label: 'CC-1000', count: 12, pct: 30 },
  { value: 'CC-1001', label: 'CC-1001', count: 10, pct: 25 },
  { value: 'CC-1002', label: 'CC-1002', count: 6, pct: 15 },
  { value: 'CC-2001', label: 'CC-2001', count: 3, pct: 7.5 },
  { value: 'CC-2002', label: 'CC-2002', count: 3, pct: 7.5 },
  { value: 'CC-2003', label: 'CC-2003', count: 2, pct: 5 },
  { value: 'CC-2004', label: 'CC-2004', count: 2, pct: 5 },
  { value: 'CC-2005', label: 'CC-2005', count: 1, pct: 2.5 },
  { value: 'CC-2006', label: 'CC-2006', count: 1, pct: 2.5 },
];

/**
 * The pane's wiring in miniature: the card's `onShowOther` opens the same
 * read-only `BreakdownDetailsModal` the Members tab uses, over the untruncated
 * distribution. No `onRowClick` — the Insights tab has no member list to filter.
 */
const OtherDrillIn = (props: AttributeHealthCardProps) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AttributeHealthCard {...props} onShowOther={() => setOpen(true)} />
      <BreakdownDetailsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Cost center"
        rows={fullRows}
        activeValues={new Set()}
      />
    </>
  );
};

/**
 * The aggregated tail is reachable. Clicking `Other (6 values)` reveals the six
 * values the summary declined to name — read-only, because this tab has no
 * member list a value could filter.
 */
export const OtherRowRevealsItsValues: Story = {
  args: { rules: [], summary: truncated },
  render: (args) => <OtherDrillIn {...args} />,
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // The tail is named but not itemised on the card.
    await expect(canvas.queryByText('CC-2006')).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: /Other \(6 values\)/ }));

    const dialog = await body.findByRole('dialog');
    await expect(within(dialog).getByText('CC-2006')).toBeVisible();
    await expect(within(dialog).getByText('CC-2001')).toBeVisible();

    // Read-only: no member list here, so no row promises a filter.
    await expect(within(dialog).queryByText(/filter the member list/)).toBeNull();
    await expect(within(dialog).getByRole('button', { name: /CC-2006/ })).toBeDisabled();
  },
};

/**
 * Without a handler the same row stays inert text — the "clickable only when
 * wired" contract `BreakdownReport` already keeps, so no surface ever offers a
 * drill-in that goes nowhere.
 */
export const OtherRowInertWhenUnwired: Story = {
  args: { rules: [], summary: truncated },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Other (6 values)')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /Other \(6 values\)/ })).toBeNull();
  },
};
