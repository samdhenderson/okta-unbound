import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import BlastRadiusCascade from './BlastRadiusCascade';
import type { CascadeLine } from './cascadeLines';

/** Obviously fake ids — no real org data ever ships in a story. */
const line = (
  over: Partial<CascadeLine> & Pick<CascadeLine, 'ruleId' | 'ruleName'>,
): CascadeLine => ({
  direction: 'toward-match',
  matchedBy: 'name',
  targetGroupNames: ['Finance'],
  ...over,
});

/** The rules that read a group this edit moves, and what each of them assigns. */
const meta = {
  title: 'Users/BlastRadiusCascade',
  component: BlastRadiusCascade,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '**Every line is structure, not a prediction.** This rule reads this group; it named it this way; ' +
          'it assigns these groups. None of it claims the rule will fire — that is the second hop ' +
          '`docs/claims.md` forbids chasing, and the footer names that absence once rather than hedging ' +
          'every line with a “may”.\n\n' +
          '**No count, and no negative.** The trigger that opens this carries no tally, and a group with no ' +
          'cascade renders nothing at all. The scan under-reports by design — a negated connective and a ' +
          'regex pattern the safe engine declines both yield no group references — so a count or an ' +
          'emptiness claim would assert a completeness the engine cannot back.\n\n' +
          '**One component serves both row types.** A group row passes the single group it is about; a rule ' +
          'row passes one block per affected group it assigns into. The per-group caption appears only with ' +
          'more than one block, because with one the trigger already named it.\n\n' +
          'Related internals: `shared/membership/blastRadius`, `sidepanel/components/users/cascadeLines`.',
      },
    },
  },
  args: {
    groups: [
      {
        groupId: '00gFAKEnewhires1',
        groupName: 'New Hires',
        lines: [line({ ruleId: '0prFAKErule00061', ruleName: 'Downstream feeder' })],
      },
    ],
  },
} satisfies Meta<typeof BlastRadiusCascade>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One group, one rule that reads it. No caption — the trigger named the group. */
export const OneRule: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Downstream feeder')).toBeInTheDocument();
    await expect(canvas.getByText(/Finance/)).toBeInTheDocument();
    await expect(canvas.getByText('Toward matching')).toBeInTheDocument();
    await expect(canvas.getByText(/prediction stops at one hop/i)).toBeInTheDocument();
    await expect(canvas.queryByText('New Hires')).toBeNull();
  },
};

/**
 * All three directions. `Uses it both ways` is an assertion about the rule's text
 * — one rule testing the group in both senses — not a shrug: it earns a visible
 * badge rather than a blank slot, because absent is not zero.
 */
export const EveryDirection: Story = {
  args: {
    groups: [
      {
        groupId: '00gFAKEnewhires1',
        groupName: 'New Hires',
        lines: [
          line({ ruleId: '0prFAKErule00071', ruleName: 'Downstream feeder' }),
          line({
            ruleId: '0prFAKErule00072',
            ruleName: 'Contractor guard',
            direction: 'away-from-match',
            targetGroupNames: ['Vendors', 'Temp Access'],
          }),
          line({
            ruleId: '0prFAKErule00073',
            ruleName: 'Both ways rule',
            direction: 'undetermined',
            targetGroupNames: [],
          }),
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Toward matching')).toBeInTheDocument();
    await expect(canvas.getByText('Away from matching')).toBeInTheDocument();
    await expect(canvas.getByText('Uses it both ways')).toBeInTheDocument();
    // A rule that assigns nothing shows no "Assigns" line rather than an empty
    // one — scoped to that rule's own row, since the others legitimately have one.
    const bothWays = canvas.getByText('Both ways rule').closest('li');
    await expect(bothWays?.textContent).not.toMatch(/Assigns/);
  },
};

/**
 * A pattern match says so. With a literal id or name the link to the group above
 * is self-evident; with a prefix, substring or regex it is not, and the pattern
 * itself is already on screen in the rule's own condition.
 */
export const PatternMatch: Story = {
  args: {
    groups: [
      {
        groupId: '00gFAKEnewhires1',
        groupName: 'New Hires',
        lines: [
          line({
            ruleId: '0prFAKErule00081',
            ruleName: 'Prefix feeder',
            matchedBy: 'nameStartsWith',
          }),
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Matched by name pattern/)).toBeInTheDocument();
  },
};

/** Two groups, so each block is captioned. The one-hop line still appears once. */
export const TwoGroups: Story = {
  args: {
    groups: [
      {
        groupId: '00gFAKEnewhires1',
        groupName: 'New Hires',
        lines: [line({ ruleId: '0prFAKErule00091', ruleName: 'Downstream feeder' })],
      },
      {
        groupId: '00gFAKEemea00001',
        groupName: 'EMEA',
        lines: [
          line({
            ruleId: '0prFAKErule00092',
            ruleName: 'EMEA tooling',
            targetGroupNames: ['EMEA-Tools'],
          }),
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('New Hires')).toBeInTheDocument();
    await expect(canvas.getByText('EMEA')).toBeInTheDocument();
    await expect(canvas.getAllByText(/prediction stops at one hop/i)).toHaveLength(1);
  },
};

/** The 360px floor: a long rule name wraps rather than truncating. */
export const Compact: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
  args: {
    groups: [
      {
        groupId: '00gFAKEnewhires1',
        groupName: 'New Hires',
        lines: [
          line({
            ruleId: '0prFAKErule00101',
            ruleName: 'EMEA sales enablement — contractors only, phase two',
            targetGroupNames: ['emea-sales-enablement-contractors-2026'],
          }),
        ],
      },
    ],
  },
};
