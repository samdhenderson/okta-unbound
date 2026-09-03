import type { Meta, StoryObj } from '@storybook/react-vite';
import AttributeSpreadBar from './AttributeSpreadBar';
import { NONE_VALUE, OTHER_VALUE, type BreakdownRow } from '../../members/memberAnalytics';

const rows: BreakdownRow[] = [
  { value: 'Engineering', label: 'Engineering', count: 402, pct: 31 },
  { value: 'Sales', label: 'Sales', count: 288, pct: 22 },
  { value: 'Support', label: 'Support', count: 190, pct: 15 },
  { value: 'Finance', label: 'Finance', count: 120, pct: 9 },
  { value: NONE_VALUE, label: '(none)', count: 52, pct: 4 },
  { value: OTHER_VALUE, label: 'Other (14 values)', count: 232, pct: 18 },
];

/**
 * One attribute's value composition as a single segmented bar.
 */
const meta = {
  title: 'Groups/AttributeSpreadBar',
  component: AttributeSpreadBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          "One attribute's value composition as a single segmented bar, replacing the fill " +
          'meter the Insights card used to carry. A fill meter answers "how much of this is ' +
          'populated", which the card already states in words; the bar answers "and how is the ' +
          'populated part *distributed*", which nothing on a collapsed card answered before.\n\n' +
          '**Blanks are not a segment.** A blank is the absence of a value, not a value people ' +
          'share; giving it a slice put "nobody filled this in" on the same footing as "forty ' +
          'people are in Engineering". The blank count gets its own line in the card body.\n\n' +
          '**The tail is hatched, never tinted.** A flat neutral on a bar whose every other ' +
          'segment is a value reads as one more value. The hatch (`CHART_TAIL_HATCH`, built ' +
          'from `--color-neutral-300`/`--color-neutral-100`) reads as an aggregate and survives ' +
          'greyscale, so "this is the rest, not a thing" is not carried by colour alone.\n\n' +
          '**It is `aria-hidden`.** The bar states proportions and no labels, so on its own it ' +
          'is unreadable by anybody — sighted readers get shares without names too. Rather than ' +
          'synthesise an `aria-label` that duplicates the value list badly, it is decoration ' +
          'over content the card states in text one disclosure away.\n\n' +
          '**Storybook renders no Tailwind**, so nothing here asserts segment widths, the ' +
          'hatch, or the bar’s height — those claims are visual and are verified by eye, not ' +
          'by these stories.',
      },
    },
  },
  argTypes: {
    rows: { description: "One attribute's distribution rows." },
    className: { description: 'Layout classes only — never colour.' },
  },
  args: { rows },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AttributeSpreadBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four named values, a blank bucket that is excluded, and a hatched tail. */
export const Default: Story = {};

/** Nothing folded away — every segment is a named value. */
export const NoTail: Story = {
  args: { rows: rows.filter((row) => row.value !== OTHER_VALUE) },
};

/** One value holds the whole group: a single segment, full width. */
export const SingleValue: Story = {
  args: { rows: [{ value: 'Engineering', label: 'Engineering', count: 1284, pct: 100 }] },
};

/**
 * More values than the ramp has stops. The extras reuse the last stop rather
 * than wrapping back to the darkest, which would make the smallest slice the
 * most prominent one.
 */
export const MoreValuesThanRampStops: Story = {
  args: {
    rows: Array.from({ length: 9 }, (_, i) => ({
      value: `V${i}`,
      label: `Value ${i}`,
      count: 100 - i * 8,
      pct: 11,
    })),
  },
};

/**
 * A distribution with nothing to draw — every member is blank. The bar renders
 * nothing at all rather than an empty track pretending to be a reading.
 */
export const OnlyBlanks: Story = {
  args: { rows: [{ value: NONE_VALUE, label: '(none)', count: 1284, pct: 100 }] },
};
