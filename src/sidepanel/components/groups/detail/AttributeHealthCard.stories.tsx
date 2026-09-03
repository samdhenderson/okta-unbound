import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import AttributeHealthCard, { type AttributeHealthCardProps } from './AttributeHealthCard';
import BreakdownDetailsModal from '../../members/BreakdownDetailsModal';
import {
  attributeSignals,
  NONE_VALUE,
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
    { value: NONE_VALUE, label: '(none)', count: 3, pct: 25 },
  ],
  driftValues: [],
};

const rules: AttributeRuleRef[] = [{ ruleId: '0prFAKE1', ruleName: 'Eng & Product — full-time' }];

const meta = {
  title: 'Groups/AttributeHealthCard',
  component: AttributeHealthCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    // The card's "Depended on by" heading is an `<h3>` with no page heading above
    // it in isolation; the pane that mounts the grid supplies the surrounding
    // levels.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          "One card in the Insights tab's attribute grid: how one profile attribute is " +
          "actually populated across this group's members.\n\n" +
          '**One anatomy, ranked.** Every attribute gets the same card. Severity is carried by ' +
          '*order* and by *badges*, never by a second card shape for the bad ones — a reader ' +
          'would otherwise have to learn two layouts and diff them, and the quiet attributes ' +
          'would read as a different kind of thing when the only difference is that today ' +
          'nothing is wrong with them.\n\n' +
          '**Three stages.** Collapsed (title, badges, spread bar, value count) → expanded (the ' +
          'value list, the blank line, the dependent rules) → the modal reveal over the full ' +
          'distribution, via `onShowOther`.\n\n' +
          '**The badges survive the collapse.** A collapsed card that hid its reasons would ' +
          'leave the ranking looking arbitrary — an order with no visible cause. Each badge is ' +
          'a phrase, never a bare number, and none of them needs its colour to be understood.\n\n' +
          '**The disclosure is a real control.** The header is covered by a `StretchedButton` ' +
          'carrying `aria-expanded`/`aria-controls`: a real `<button>`, focusable and ' +
          'Enter/Space operable. The overlay is scoped to the header, so clicking inside the ' +
          'body it just opened does not collapse it.\n\n' +
          '**Outliers are marked, never corrected.** The value list flags what `outlierValues` ' +
          'judges to be drift from a dominant house style — conservatively, and as a flag ' +
          'rather than a claim the record is wrong. The marker is the word "Outlier:", not ' +
          'colour alone. The drift **badge** is a wider claim: near-duplicate spellings ' +
          'anywhere in the attribute, including inside the tail this card never names.\n\n' +
          '**Storybook renders no Tailwind**, so no story here asserts the bar’s geometry, its ' +
          'segment widths, or the hatch — those remain visual claims, checked by eye.',
      },
    },
  },
  argTypes: {
    summary: { description: "The attribute's precomputed distribution." },
    signals: { description: 'Why this attribute ranks where it does. Rendered as badges.' },
    rules: {
      description:
        'The feeding rules that reference this attribute. Empty is an answer — no block renders.',
    },
    onNavigateToRule: { description: 'Deep-links a dependent rule into the Rules tab.' },
    onShowOther: { description: 'Opens the full distribution, tail included.' },
    defaultExpanded: { description: 'Starts the card expanded. For stories and tests.' },
  },
  args: { summary, rules, signals: attributeSignals(summary, 1), onNavigateToRule: fn() },
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

/** Stage one: title, badges, spread bar, value count. Nothing else. */
export const Collapsed: Story = {};

/**
 * The badges are in stage one on purpose.
 *
 * This is the specific failure being avoided: a collapsed card that shows only a
 * name and a bar tells a reader nothing about why the pane sorted it where it
 * did, so the ranking reads as arbitrary and the whole stack gets skimmed or
 * ignored. The reason travels with the card.
 */
export const CollapsedKeepsItsBadges: Story = {
  play: async ({ canvas, canvasElement }) => {
    // The reason is legible without opening anything…
    await expect(canvas.getByText('A rule depends on it')).toBeVisible();
    // …and it is a phrase, not a bare number.
    await expect(canvas.queryByText('1')).toBeNull();

    // The disclosure states it is closed, and the region it names is `inert` —
    // so the value list is out of the tab order and the accessibility tree.
    // (This runner loads no CSS, so the *visual* collapse is not assertable
    // here; the ARIA state is what actually carries the meaning anyway.)
    const toggle = canvas.getByRole('button', { name: /Show the value breakdown/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const regionId = toggle.getAttribute('aria-controls');
    const region = regionId ? canvasElement.ownerDocument.getElementById(regionId) : null;
    await expect(region).not.toBeNull();
    await expect(region).toHaveAttribute('inert');
  },
};

/** Stage two: the same card, opened. */
export const Expanded: Story = {
  args: { defaultExpanded: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Engineering')).toBeVisible();
    await expect(canvas.getByText('Depended on by 1 rule')).toBeVisible();
    // A blank is not a value: it gets its own line, not a row in the list.
    await expect(canvas.getByText(/Blank in 3 of 12 members/)).toBeVisible();
    // Badges are still there — they belong to every stage.
    await expect(canvas.getByText('A rule depends on it')).toBeVisible();
  },
};

/**
 * The disclosure is operable from the keyboard, because it is a real button
 * rather than a `<div onClick>`: it takes focus, `Enter` activates it, and
 * `aria-expanded` tracks the region it names through `aria-controls`.
 */
export const KeyboardOperable: Story = {
  play: async ({ canvas }) => {
    const toggle = canvas.getByRole('button', { name: /Show the value breakdown/ });

    toggle.focus();
    await expect(toggle).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    const opened = canvas.getByRole('button', { name: /Hide the value breakdown/ });
    await expect(opened).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('Engineering')).toBeVisible();

    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('button', { name: /Show the value breakdown/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  },
};

/** Two rules depend on the same attribute. */
export const MultipleRules: Story = {
  args: {
    defaultExpanded: true,
    signals: attributeSignals(summary, 2),
    rules: [
      { ruleId: '0prFAKE1', ruleName: 'Eng & Product — full-time' },
      { ruleId: '0prFAKE2', ruleName: 'Legacy import' },
    ],
  },
};

/** Fully populated — no blank line at all. */
export const FullyPopulated: Story = {
  args: {
    defaultExpanded: true,
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
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/Blank in/)).toBeNull();
  },
};

/**
 * Nothing is flagged about this attribute — and it renders as the **same card**,
 * with no badges. It is demoted by its position in the pane's stack, under the
 * "Nothing flagged" rule, not by being given a different shape.
 */
export const Quiet: Story = {
  args: { signals: [], rules: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('department')).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Show the value breakdown/ })).toBeVisible();
  },
};

/**
 * No feeding rule reads this attribute. That is a fact about coupling, not a
 * defect, so the "Depended on by" block is omitted rather than rendered as
 * "0 rules" — and this is exactly the card the old rule-filtered grid hid.
 */
export const NoDependentRules: Story = {
  args: { rules: [], signals: [], defaultExpanded: true },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/Depended on by/)).toBeNull();
    await expect(canvas.getByText('Engineering')).toBeVisible();
  },
};

const driftSummary: AttributeSummary = {
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
  driftValues: ['Engineering', 'engineering', 'ENGINEERING'],
};

/**
 * Config drift: one dominant spelling and two stragglers.
 *
 * Two different claims are on this card at once and they are not the same thing.
 * The **badge** counts near-duplicate spellings anywhere in the attribute — a
 * cheap, always-honest test. The `Outlier:` markers in the list are
 * `outlierValues`' narrower claim, which needs a dominant value to diverge
 * *from* and shows it alongside so a reader can see what it is.
 */
export const WithDrift: Story = {
  args: {
    rules: [],
    summary: driftSummary,
    signals: attributeSignals(driftSummary, 0),
    defaultExpanded: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('3 near-duplicate values')).toBeVisible();
    await expect(canvas.getAllByText('Outlier:')).toHaveLength(2);
    // The dominant value is never itself an outlier.
    await expect(canvas.getByText('Engineering')).toBeVisible();
  },
};

const spreadSummary: AttributeSummary = {
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
  driftValues: [],
};

/**
 * A legitimate three-way split. There is no house style to diverge from and no
 * two values differ only in case, so nothing is flagged — a false positive here
 * accuses a correct record of being wrong.
 */
export const LegitimateSpreadIsNotDrift: Story = {
  args: {
    rules: [],
    summary: spreadSummary,
    signals: attributeSignals(spreadSummary, 0),
    defaultExpanded: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/outlier/i)).toBeNull();
    await expect(canvas.queryByText(/near-duplicate/)).toBeNull();
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
  driftValues: [],
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
 * distribution. No `onRowClick` — nothing here can honour a filter.
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
 * All three stages, in order.
 *
 * Collapsed the card names the tail's size and nothing in it; expanded it lists
 * the values it kept; the modal names the six it folded away. Each stage answers
 * a question the previous one raised, which is what keeps the collapsed card
 * short without making it evasive.
 */
export const ThreeStages: Story = {
  args: {
    rules: [],
    summary: truncated,
    signals: attributeSignals(truncated, 0),
  },
  render: (args) => <OtherDrillIn {...args} />,
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Stage one: the tail is measured on the collapsed card, and it says so.
    await expect(canvas.getByText('30% hidden in the tail')).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Show the value breakdown/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    // Stage two.
    await userEvent.click(canvas.getByRole('button', { name: /Show the value breakdown/ }));
    await expect(canvas.getByText('CC-1000')).toBeVisible();
    // The card names the tail's size and still none of its contents.
    await expect(canvas.queryByText('CC-2006')).toBeNull();

    // Stage three.
    await userEvent.click(canvas.getByRole('button', { name: /Show all 9 values/ }));
    const dialog = await body.findByRole('dialog');
    await expect(within(dialog).getByText('CC-2006')).toBeVisible();
    await expect(within(dialog).getByText('CC-2001')).toBeVisible();

    // Read-only here: nothing offers a filter it could not apply.
    await expect(within(dialog).queryByText(/filter the member list/)).toBeNull();
    await expect(within(dialog).getByRole('button', { name: /CC-2006/ })).toBeDisabled();
  },
};

/**
 * Without a handler the third stage is not offered at all — the same "drill-in
 * only when wired" contract `BreakdownReport` keeps, so no surface ever ships a
 * control that goes nowhere.
 */
export const NoRevealWhenUnwired: Story = {
  args: {
    rules: [],
    summary: truncated,
    signals: attributeSignals(truncated, 0),
    defaultExpanded: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Other (6 values)')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /Show all/ })).toBeNull();
  },
};
