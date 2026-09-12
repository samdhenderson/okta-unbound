import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ClauseLedgerClause from './ClauseLedgerClause';
import { NavigationProvider } from '../../contexts/NavigationContext';
import {
  ATTRIBUTE_ABSENT,
  type LeafClauseNode,
  type LeafPredicate,
} from '../../../shared/rules/explainExpression';

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
          'One leaf of a `ClauseLedger` tree — the clause stated in words; its outcome chip; the group references it named; and the profile evidence that drove it.\n\n' +
          'A clause carrying a `predicate` is read as a sentence (**department** (lowercased) equals `"sales"`) rather than printed as the expression it came from; a group-membership clause gets its own plain-language label whose polarity is stated in words; and a clause the explainer could not describe exactly falls back to its verbatim text. The raw expression is always one toggle away in the ledger itself.\n\n' +
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
  predicate: {
    form: 'compare',
    subject: { path: 'user.department', transforms: [] },
    operator: 'eq',
    operand: 'Engineering',
  },
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
      predicate: {
        form: 'compare',
        subject: { path: 'user.title', transforms: [] },
        operator: 'eq',
        operand: 'Staff Engineer',
      },
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

/** A described clause, built around one predicate — the fixtures below vary only that. */
const described = (
  expressionText: string,
  predicate: LeafPredicate,
  reads: LeafClauseNode['reads'],
): LeafClauseNode => ({
  node: 'leaf',
  expressionText,
  resolvedValue: undefined,
  status: 'pass',
  reads,
  predicate,
});

/** A value-transforming comparison: the transform is a parenthetical, not a function call. */
export const TransformedComparison: Story = {
  args: {
    leaf: described(
      'String.toLowerCase(user.department) == "sales"',
      {
        form: 'compare',
        subject: { path: 'user.department', transforms: ['toLowerCase'] },
        operator: 'eq',
        operand: 'sales',
      },
      [{ path: 'user.department', value: 'Sales' }],
    ),
  },
};

/** Nested transforms read innermost-first, in the order they are applied. */
export const NestedTransforms: Story = {
  args: {
    leaf: described(
      'String.toLowerCase(String.removeSpaces(user["cost center"])) == "cc-9"',
      {
        form: 'compare',
        subject: { path: 'user["cost center"]', transforms: ['removeSpaces', 'toLowerCase'] },
        operator: 'eq',
        operand: 'cc-9',
      },
      [{ path: 'user["cost center"]', value: 'CC 9' }],
    ),
  },
};

/** A negated substring test: the `!` is in the verb, never left for the reader to spot. */
export const NegatedContains: Story = {
  args: {
    leaf: described(
      '!String.stringContains(user.login, "_vendor")',
      {
        form: 'contains',
        subject: { path: 'user.login', transforms: [] },
        operand: '_vendor',
        negated: true,
      },
      [{ path: 'user.login', value: 'ada_vendor@example.com' }],
    ),
  },
};

/** `String.len` and `Arrays.size` change what the sentence is about, so they lead it. */
export const LengthAndCountForms: Story = {
  args: {
    leaf: described(
      'String.len(user.employeeNumber) >= 6',
      {
        form: 'compare',
        subject: { path: 'user.employeeNumber', transforms: ['len'] },
        operator: 'gte',
        operand: 6,
      },
      [{ path: 'user.employeeNumber', value: '00421' }],
    ),
  },
};

/** The count form, over a multi-valued attribute. */
export const CountForm: Story = {
  args: {
    leaf: described(
      'Arrays.size(user.certifications) > 1',
      {
        form: 'compare',
        subject: { path: 'user.certifications', transforms: ['size'] },
        operator: 'gt',
        operand: 1,
      },
      [{ path: 'user.certifications', value: ['CISSP', 'AWS-SA'] }],
    ),
  },
};

/** A bare boolean attribute, negated: "is false", stated rather than implied. */
export const BooleanAttribute: Story = {
  args: {
    leaf: described(
      '!user.isContractor',
      {
        form: 'boolean-attribute',
        subject: { path: 'user.isContractor', transforms: [] },
        negated: true,
      },
      [{ path: 'user.isContractor', value: true }],
    ),
  },
};

/** No predicate: a clause the explainer could not state exactly keeps its verbatim text. */
export const UndescribedClauseKeepsItsText: Story = {
  args: {
    leaf: {
      node: 'leaf',
      expressionText: 'String.substring(user.department, 0, 3) == "Eng"',
      resolvedValue: 'Engineering',
      status: 'pass',
      reads: [{ path: 'user.department', value: 'Engineering' }],
    },
  },
};
