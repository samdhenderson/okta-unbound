import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ClauseLedgerClause from './ClauseLedgerClause';
import { NavigationProvider } from '../../contexts/NavigationContext';
import { ATTRIBUTE_ABSENT, type LeafClauseNode } from '../../../shared/rules/explainExpression';

const resolveGroupName = (groupId: string): string | undefined =>
  ({ '00gFAKECLAUSE1': 'Engineering — Platform' })[groupId];

const meta = {
  title: 'Shared/ClauseLedgerClause',
  component: ClauseLedgerClause,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One leaf of a `ClauseLedger` tree — the clause text, or, for a group-membership clause, a plain-language label whose polarity is stated in words; its outcome chip; the group references it named; and the profile evidence that drove it.\n\n' +
          'An attribute read is one of three states this component ever sees: a present value, an explicit `null`, or an absent attribute rendered as the words "not set" — never a dash, never `0`.',
      },
    },
  },
  decorators: [
    (Story) => (
      <NavigationProvider handlers={{ group: fn() }}>
        <Story />
      </NavigationProvider>
    ),
  ],
  argTypes: {
    leaf: { description: 'The leaf clause to render.' },
    resolveGroupName: {
      description: 'Names group ids inside the clause text and its group references.',
    },
  },
  args: { resolveGroupName },
} satisfies Meta<typeof ClauseLedgerClause>;

export default meta;
type Story = StoryObj<typeof meta>;

const passLeaf: LeafClauseNode = {
  node: 'leaf',
  expressionText: 'user.department == "Engineering"',
  resolvedValue: 'Engineering',
  status: 'pass',
  reads: [{ path: 'user.department', value: 'Engineering' }],
};

/** A clause that resolved to true, with the profile value that drove it. */
export const Pass: Story = { args: { leaf: passLeaf } };

/** A clause that genuinely resolved to false — the only outcome shown as a failure. */
export const Fail: Story = {
  args: {
    leaf: {
      ...passLeaf,
      expressionText: 'user.title == "Staff Engineer"',
      resolvedValue: 'Intern',
      status: 'fail',
      reads: [{ path: 'user.title', value: 'Intern' }],
    },
  },
};

/** A clause the evaluator could not resolve — neutral, never `danger`, with its reason stated. */
export const NotEvaluated: Story = {
  args: {
    leaf: {
      node: 'leaf',
      expressionText: 'isMemberOfGroup("00gFAKECLAUSE9")',
      resolvedValue: undefined,
      status: 'not-evaluated',
      reasonCode: 'group-membership-fn',
      reads: [],
    },
  },
};

/** A group-membership clause: the plain-language "Member of" label, with its chip row. */
export const GroupMembershipClause: Story = {
  args: {
    leaf: {
      node: 'leaf',
      expressionText: 'isMemberOfAnyGroup("00gFAKECLAUSE1")',
      resolvedValue: undefined,
      status: 'pass',
      groupRequirement: 'member',
      groupReferences: [
        {
          match: 'id',
          value: '00gFAKECLAUSE1',
          satisfied: true,
          matchedGroupName: 'Engineering — Platform',
        },
      ],
      reads: [],
    },
  },
};

/** The negated polarity: "Not a member of" — stated in words, not just inferred from a failing chip. */
export const NonMemberPolarity: Story = {
  args: {
    leaf: {
      node: 'leaf',
      expressionText: '!isMemberOfAnyGroup("00gFAKECLAUSE1")',
      resolvedValue: undefined,
      status: 'fail',
      groupRequirement: 'non-member',
      groupReferences: [
        {
          match: 'id',
          value: '00gFAKECLAUSE1',
          satisfied: true,
          matchedGroupName: 'Engineering — Platform',
        },
      ],
      reads: [],
    },
  },
};

/** A long clause with wrapping chips and evidence at the panel's narrowest width. */
export const CompactPanel: Story = {
  args: {
    leaf: {
      node: 'leaf',
      expressionText:
        'isMemberOfAnyGroupName("Engineering-Platform-Infrastructure", "Engineering-Developer-Experience")',
      resolvedValue: true,
      status: 'pass',
      groupRequirement: 'member',
      groupReferences: [
        {
          match: 'name',
          value: 'Engineering-Platform-Infrastructure',
          satisfied: true,
          matchedGroupName: 'Engineering-Platform-Infrastructure',
        },
        { match: 'name', value: 'Engineering-Developer-Experience', satisfied: false },
      ],
      reads: [],
    },
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};

/** `null` and absent are two different facts: neither collapses to a dash. */
export const NullVersusAbsentAttribute: Story = {
  args: {
    leaf: {
      node: 'leaf',
      expressionText: 'user.projectCode == "Platform" && user.costCenter == "CC-9"',
      resolvedValue: null,
      status: 'fail',
      reads: [
        { path: 'user.projectCode', value: null },
        { path: 'user.costCenter', value: ATTRIBUTE_ABSENT },
      ],
    },
  },
};
