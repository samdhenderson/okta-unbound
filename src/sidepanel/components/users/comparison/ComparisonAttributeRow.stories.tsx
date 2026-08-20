import type { ComponentType } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import ComparisonAttributeRow from './ComparisonAttributeRow';
import type { AttributeParityRow, AttributeVerdict } from './attributeParity';

/** One attribute parity row, as `attributeParityRows` would emit it. */
const row = (
  name: string,
  label: string,
  contextValue: string,
  comparedValue: string,
  verdict: AttributeVerdict,
  over: Partial<AttributeParityRow> = {},
): AttributeParityRow => ({
  key: `profile.${name}`,
  name,
  label,
  kind: 'base',
  contextValue,
  comparedValue,
  verdict,
  categoryKey: 'organization',
  hiddenByConfig: false,
  ...over,
});

/** A row is an `<li>`; every story supplies the list it belongs to. */
const inList = (Story: ComponentType) => (
  <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
    <Story />
  </ul>
);

/** One attribute, and how the two users' values for it compare. */
const meta = {
  title: 'Users/Comparison/ComparisonAttributeRow',
  component: ComparisonAttributeRow,
  tags: ['autodocs'],
  decorators: [inList],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "One row of the comparison's Attributes tab: the attribute's name and annotations, then the two " +
          "users' **values** with an equality marker between them.\n\n" +
          'The strip is a three-track grid (`minmax(0,1fr) 2rem minmax(0,1fr)`) with `min-h-9` cells rather than ' +
          '`flex-1` boxes — under flex a padded cell keeps its own chrome before the free space is split, which ' +
          'put the marker 9px off-centre and made the `=` column stagger down the list.\n\n' +
          'The marker is **not a control**: a `role="img"` span showing `=` or `≠`. Two different glyphs, so the ' +
          'state never depends on colour. Both sides are always named, and there is no arrow.\n\n' +
          '**Values wrap; they never truncate.** A truncated value is actively dangerous in a diff — two values ' +
          'differing only in their tails would render identically beside a `≠` nobody could explain. An unset ' +
          'value is stated as `— not set` in the muted italic non-answer register `AppScopeIndicator` and ' +
          '`GroupSourceIndicator` share.\n\n' +
          'There is deliberately **no per-row action**: writing a profile attribute needs prior-state capture and ' +
          'audit logging, which is a separate change.',
      },
    },
  },
  args: {
    row: row('department', 'Department', 'Engineering', 'Design', 'differs'),
    contextName: 'Ada Context',
    comparedName: 'Bo Compared',
    showApiNames: false,
  },
  argTypes: {
    row: {
      description: "The attribute and both users' values for it, from `attributeParityRows`.",
    },
    contextName: { description: 'Display name of the context user (baseline) — the LEFT cell.' },
    comparedName: { description: 'Display name of the compared user — the RIGHT cell.' },
    showApiNames: {
      description:
        'Render the Okta name in mono instead of the human label (`config.showApiNames`).',
    },
    readers: {
      description:
        'Names of the rules that read this attribute and currently grant either user access. Absent renders no chip.',
    },
  },
} satisfies Meta<typeof ComparisonAttributeRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `differs` — both users have a value and the values disagree. */
export const Differs: Story = {};

/** `same` — both users hold the same value, so the marker is `=`. */
export const Same: Story = {
  args: { row: row('userType', 'User type', 'Employee', 'Employee', 'same') },
};

/** `onlyContext` — the compared user's cell states the non-answer rather than sitting empty. */
export const OnlyContext: Story = {
  args: { row: row('manager', 'Manager', 'dana@example.com', '', 'onlyContext') },
};

/** `onlyCompared` — the mirror image, on the other side. */
export const OnlyCompared: Story = {
  args: { row: row('costCenter', 'Cost center', '', 'CC-42', 'onlyCompared') },
};

/**
 * `bothEmpty` — the org defines the attribute and neither user has a value. That
 * is an agreement, not a difference, so the marker is `=`.
 */
export const BothEmpty: Story = {
  args: { row: row('nickName', 'Nickname', '', '', 'bothEmpty') },
};

/** A currently-granting rule reads this attribute — the chip that makes the diff an explanation. */
export const WithRuleChip: Story = {
  args: { readers: ['Engineering → VPN Access', 'Contractors → VPN Access'] },
};

/** `showApiNames` swaps the human label for the Okta name, in mono. */
export const ApiName: Story = {
  args: { showApiNames: true },
};

/** A row the display config hides, revealed on demand and marked as such. */
export const HiddenByConfig: Story = {
  args: {
    row: row('employeeNumber', 'Employee number', 'E-0001', 'E-0002', 'differs', {
      hiddenByConfig: true,
    }),
  },
};

/**
 * Long values at 360px — the case the no-truncation rule exists for. Both cells
 * wrap and stay the same height, and the marker stays on the centre line.
 */
export const LongValuesCompact: Story = {
  args: {
    row: row(
      'streetAddress',
      'Street address',
      '1 Example Street, Exampleton, EX1 2AB, Exampleshire',
      '1 Example Street, Exampleton, EX1 2AC, Exampleshire',
      'differs',
    ),
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
