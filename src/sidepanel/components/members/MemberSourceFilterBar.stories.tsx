import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import MemberSourceFilterBar from './MemberSourceFilterBar';
import type { MemberSourceBucket } from '../groups/memberSourceBuckets';
import { CHART_OTHER_COLOR, INDIGO_RAMP } from '../../theme/chartPalette';

const engineering: MemberSourceBucket = {
  key: 'rule:0prFAKE1',
  label: 'Engineering department',
  description: 'Solely explained by this rule.',
  count: 42,
  percent: 42,
  barClass: '',
  dotClass: '',
  color: INDIGO_RAMP[0],
};

const platform: MemberSourceBucket = {
  key: 'rule:0prFAKE2',
  label: 'Platform department',
  description: 'Solely explained by this rule.',
  count: 18,
  percent: 18,
  barClass: '',
  dotClass: '',
  color: INDIGO_RAMP[1],
};

const manual: MemberSourceBucket = {
  key: 'direct',
  label: 'Manual',
  description: 'Added directly — no rule accounts for this membership.',
  count: 30,
  percent: 30,
  barClass: 'bg-neutral-400',
  dotClass: 'bg-neutral-400',
};

const segments: MemberSourceBucket[] = [
  engineering,
  platform,
  {
    key: 'multiRule',
    label: 'Multiple rules',
    description: 'Matched by more than one rule, so no single rule explains it.',
    count: 5,
    percent: 5,
    barClass: 'bg-primary-dark',
    dotClass: 'bg-primary-dark',
  },
  {
    key: 'unattributed',
    label: 'Indeterminate',
    description: 'A targeting rule could not be evaluated here, so the source is unconfirmed.',
    count: 5,
    percent: 5,
    barClass: 'bg-warning',
    dotClass: 'bg-warning',
  },
  manual,
];

/** The membership-source meter, with a filter pill per segment. */
const meta = {
  title: 'Members/MemberSourceFilterBar',
  component: MemberSourceFilterBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The same split `MemberSourceMeter` reads out, where the reader can act on it: the bar ' +
          'for proportion at a glance, and one pill per segment to narrow the member list to the ' +
          'people in it.\n\n' +
          '**The bar is not the click target.** "Click a segment to filter" is the obvious reading ' +
          'of a meter and the wrong control here — at the 360px panel floor a one-member segment ' +
          'is a `min-w-1` sliver, which is not a button. The pills carry the same colour swatch, ' +
          'so the mapping stays legible, and each is a full-size target with its own accessible ' +
          'name and count.\n\n' +
          'The bar stays `aria-hidden`, as it is in `MemberSourceMeter`: every number it encodes ' +
          'is printed on the pills beside it, so a screen reader gets the whole answer as text ' +
          'rather than an unlabelled graphic.\n\n' +
          'Zero-count segments are dropped rather than drawn as an empty slice or offered as a ' +
          'pill that would filter to nobody.\n\n' +
          '**This is the whole readout on the Members tab** — `MemberSourceMeter` is not rendered ' +
          'beside it, because a legend and a pill row carrying the same numbers is the same fact ' +
          'twice down a 360px column. So each pill states its bucket, its count *and* its share, ' +
          'and an aggregated tail says how many rules it folded in — as a line of text, not a ' +
          '`title`, because a fact nobody can read without hovering is not stated.',
      },
    },
  },
  argTypes: {
    segments: {
      description: 'The exclusive segments, in render order, from `toMemberSourceSegments`.',
    },
    activeKeys: { description: 'Bucket keys currently filtered on.' },
    total: { description: 'Total analyzed members, shown on the "All" pill.' },
  },
  args: {
    segments,
    activeKeys: new Set<string>(),
    onToggle: fn(),
    onClearAll: fn(),
    total: 100,
  },
} satisfies Meta<typeof MemberSourceFilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing filtered: "All" is the pressed pill. */
export const Default: Story = {};

/** One rule's slice selected — "All" releases, that pill presses. */
export const Filtered: Story = {
  args: { activeKeys: new Set(['rule:0prFAKE1']) },
};

/** Source filters compose: two slices selected at once reads as a union. */
export const MultipleSelected: Story = {
  args: { activeKeys: new Set(['direct', 'unattributed']) },
};

/**
 * A group nothing has split yet — one rule explains everyone. A single full-width
 * segment still gets its pill, because "all 100 are rule-managed" is an answer.
 */
export const SingleSegment: Story = {
  args: {
    segments: [{ ...engineering, count: 100, percent: 100 }],
  },
};

/**
 * A zero-count segment is dropped entirely, not drawn as an empty slice or offered
 * as a pill that filters to nobody. Only the two non-empty buckets render.
 */
export const DropsEmptySegments: Story = {
  args: {
    segments: [
      { ...engineering, count: 60, percent: 60 },
      { ...platform, count: 0, percent: 0 },
      { ...manual, count: 40, percent: 40 },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: /Platform department/ })).toBeNull();
    await expect(
      canvas.getByRole('button', { name: /Engineering department 60 \(60%\)/ }),
    ).toBeVisible();
  },
};

/**
 * Past the chart ramp's stops the remaining rules fold into `Other rules`. The
 * count of what got folded is printed, never silently truncated — the invariant
 * `memberSourceBuckets` states for the meter, kept here because this is the only
 * readout on the Members tab.
 */
export const AggregatedTail: Story = {
  args: {
    segments: [
      { ...engineering, count: 55, percent: 55 },
      {
        key: 'otherRules',
        label: 'Other rules',
        description: 'Rules past the chart ramp, folded together.',
        count: 45,
        percent: 45,
        barClass: '',
        dotClass: '',
        color: CHART_OTHER_COLOR,
        aggregatedRuleCount: 3,
      },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Other rules 45 \(45%\)/ })).toBeVisible();
    await expect(canvas.getByText(/folds in \+3 more rules/)).toBeVisible();
  },
};

/**
 * Every bucket's label and share, as text. The bar above them is `aria-hidden`,
 * so these pills are the entire accessible answer.
 */
export const StatesEveryShare: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('button', { name: /Engineering department 42 \(42%\)/ }),
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Multiple rules 5 \(5%\)/ })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Indeterminate 5 \(5%\)/ })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Manual 30 \(30%\)/ })).toBeVisible();
  },
};

/** Pressing a pill reports its bucket key and label; "All" clears instead. */
export const TogglesAndClears: Story = {
  args: { activeKeys: new Set(['direct']) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: /Manual 30/ }));
    await expect(args.onToggle).toHaveBeenCalledWith('direct', 'Manual');

    await userEvent.click(canvas.getByRole('button', { name: /All 100/ }));
    await expect(args.onClearAll).toHaveBeenCalled();

    // The swatch is decoration: the bar is `aria-hidden` and every count it
    // encodes is on a pill, so nothing here depends on seeing a colour.
    await expect(canvasElement.querySelector('[aria-hidden="true"].flex.h-2')).not.toBeNull();
  },
};
