import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import MembershipRuleEvidence from './MembershipRuleEvidence';
import { NavigationProvider } from '../../contexts/NavigationContext';
import type { MembershipRule, OktaUser } from '../../../shared/types';

const handlers = { rule: fn(), group: fn(), user: fn(), app: fn(), policy: fn() };

/** An obviously fake user. Note what is *not* on the profile: `costCenter`. */
const user: OktaUser = {
  id: '00uFAKE00000000000001',
  status: 'ACTIVE',
  profile: {
    login: 'user@example.com',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    title: 'Intern',
    countryCode: 'GB',
  },
};

const rule = (id: string, name: string, conditionExpression: string): MembershipRule => ({
  id,
  name,
  status: 'ACTIVE',
  conditionExpression,
});

/** One attribute, one comparison — the shape most rules actually take. */
const singleClause = rule(
  '0prFAKErule00001',
  'Auto-add Engineers',
  'user.department == "Engineering"',
);

/** Three clauses over three attributes, so the checklist has something to check. */
const multiClause = rule(
  '0prFAKErule00002',
  'EMEA engineering interns',
  'user.department == "Engineering" && user.countryCode == "GB" && user.title == "Intern"',
);

/** Reads an attribute this user simply does not have — a `Fail`, not a "we could not tell". */
const missingAttribute = rule('0prFAKErule00003', 'Cost-centre 4100', 'user.costCenter == "4100"');

/** A clause the evaluator cannot resolve at all: neutral, never `danger`. */
const unevaluable = rule(
  '0prFAKErule00004',
  'Contractor VPN',
  'isMemberOfGroup("00gFAKE00000000000009")',
);

/** One attributed rule inside a Groups-pane row's disclosure. */
const meta = {
  title: 'Users/MembershipRuleEvidence',
  component: MembershipRuleEvidence,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The evidence card behind one membership: a link to the rule, the profile attributes its ' +
          'condition **reads**, and the condition itself.\n\n' +
          'It carries **no caption of its own**. The row above already wears the verdict badge that ' +
          'says how much the attribution is worth, and repeating that hedge once per rule is exactly ' +
          'how this surface used to read.\n\n' +
          'The `Reads` chips come from walking the parsed AST, not from a regex over the text: ' +
          '`user.department == "user.title"` names **one** attribute, and any pattern match over the ' +
          'expression reports two. An **unparseable** condition therefore yields no chips at all ' +
          'rather than an empty `Reads` row, which would state as fact that the rule reads nothing.\n\n' +
          'With a `user`, the condition is rendered by `ClauseChecklist` — one row per clause, with ' +
          'the profile value that drove it. Without one there is nothing to evaluate against, so the ' +
          'raw condition is shown instead of an explanation nobody could trust.\n\n' +
          '**Related internals:** [Shared](?path=/docs/internals-shared--docs)',
      },
    },
  },
  // The card lives inside a row's disclosure, on the canvas surface. The
  // `NavigationProvider` is what makes the rule name a real link rather than its
  // plain-text fallback.
  decorators: [
    (Story: () => React.ReactElement) => (
      <NavigationProvider handlers={handlers}>
        <div className="bg-white p-4">
          <Story />
        </div>
      </NavigationProvider>
    ),
  ],
  args: {
    rule: singleClause,
    user,
  },
  argTypes: {
    rule: { description: 'One rule this membership is attributed to.' },
    user: {
      description:
        'The user to explain the condition against. Omitted, the raw condition is shown — an explanation would have nothing to evaluate.',
    },
  },
} satisfies Meta<typeof MembershipRuleEvidence>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A user is supplied, so the condition is explained clause by clause against them. */
export const Default: Story = {};

/** The same rule with the clause checklist resolving to `Pass`. */
export const EvaluatedAgainstUser: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The chips name the attribute the condition reads…
    await expect(canvas.getByText('department')).toBeInTheDocument();
    // …and the checklist states the outcome in words, never in colour alone.
    await expect(canvas.getByText('Pass')).toBeInTheDocument();
  },
};

/**
 * No user, so the card falls back to the raw condition text. This is not a
 * degraded explanation — it is the absence of one, which is the honest rendering
 * when there is nothing to evaluate against.
 */
export const WithoutUser: Story = {
  args: { user: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('user.department == "Engineering"')).toBeInTheDocument();
    await expect(canvas.queryByText('Pass')).toBeNull();
  },
};

/**
 * Three clauses over three attributes. Each gets its own row with the value that
 * drove it, which is the whole reason this replaced a flat `<code>` dump.
 */
export const MultiClauseCondition: Story = {
  args: { rule: multiClause },
};

/** The same multi-clause rule with no user: one block of text, and no verdicts. */
export const MultiClauseWithoutUser: Story = {
  args: { rule: multiClause, user: undefined },
};

/**
 * The condition reads `costCenter`, which this user does not have. The chip still
 * names the attribute — the rule genuinely reads it — and the clause resolves to
 * a stated `Fail` rather than to a blank row.
 */
export const AttributeTheUserLacks: Story = {
  args: { rule: missingAttribute },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('costCenter')).toBeInTheDocument();
  },
};

/**
 * A clause the evaluator cannot resolve — a group-membership call. It renders
 * **neutrally**, because "we could not check this" must never borrow the
 * treatment reserved for "this person does not qualify".
 */
export const UnevaluableClause: Story = {
  args: { rule: unevaluable },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Not evaluated')).toBeInTheDocument();
  },
};

/**
 * The 360px floor. A long condition wraps inside the card rather than clipping —
 * a condition you cannot finish reading is the one thing this card must not do.
 */
export const Compact: Story = {
  args: { rule: multiClause },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
