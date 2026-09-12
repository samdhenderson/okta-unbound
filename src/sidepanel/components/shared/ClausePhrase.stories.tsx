import type { Meta, StoryObj } from '@storybook/react-vite';
import ClausePhrase from './ClausePhrase';

const meta = {
  title: 'Shared/ClausePhrase',
  component: ClausePhrase,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One rule clause stated as a sentence, composed from the `LeafPredicate` the explainer derived for it — `String.toLowerCase(user.department) == "sales"` reads as **department** (lowercased) equals `"sales"`.\n\n' +
          "The wording lives here; the decision lives in the type. Every form, operator and transform below comes from a closed set recognised syntactically off the clause's own AST, so nothing branches on a display string and a clause the explainer could not read exactly carries no predicate at all — at which point `ClauseLedgerClause` prints its verbatim text instead.\n\n" +
          'The `user.` prefix is dropped because the subject of every sentence is the user; the evidence line under the clause still prints the full path.',
      },
    },
  },
  argTypes: {
    predicate: { description: 'The structured description to state in words.' },
    className: { description: 'Layout classes only — the type treatment is the component’s.' },
  },
} satisfies Meta<typeof ClausePhrase>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The plain comparison: attribute, verb, operand. */
export const Comparison: Story = {
  args: {
    predicate: {
      form: 'compare',
      subject: { path: 'user.department', transforms: [] },
      operator: 'eq',
      operand: 'Engineering',
    },
  },
};

/** A value transform reads as a parenthetical, never as the function call it came from. */
export const TransformedSubject: Story = {
  args: {
    predicate: {
      form: 'compare',
      subject: { path: 'user.department', transforms: ['toLowerCase'] },
      operator: 'eq',
      operand: 'sales',
    },
  },
};

/** Nested transforms read innermost-first — the order they are applied in. */
export const NestedTransforms: Story = {
  args: {
    predicate: {
      form: 'compare',
      subject: { path: 'user["cost center"]', transforms: ['removeSpaces', 'toLowerCase'] },
      operator: 'ne',
      operand: 'cc-9',
    },
  },
};

/** `String.len` changes what the sentence is about, so it leads the sentence. */
export const LengthForm: Story = {
  args: {
    predicate: {
      form: 'compare',
      subject: { path: 'user.employeeNumber', transforms: ['len'] },
      operator: 'gte',
      operand: 6,
    },
  },
};

/** `Arrays.size`, likewise: the count is the subject. */
export const CountForm: Story = {
  args: {
    predicate: {
      form: 'compare',
      subject: { path: 'user.certifications', transforms: ['size'] },
      operator: 'gt',
      operand: 1,
    },
  },
};

/** A substring test, negated: the `!` is in the verb, not left for the reader to spot. */
export const NegatedContains: Story = {
  args: {
    predicate: {
      form: 'contains',
      subject: { path: 'user.login', transforms: [] },
      operand: '_vendor',
      negated: true,
    },
  },
};

/** `Arrays.contains` reads as "includes", which is what a multi-valued attribute does. */
export const ArrayContains: Story = {
  args: {
    predicate: {
      form: 'array-contains',
      subject: { path: 'user.certifications', transforms: [] },
      operand: 'CISSP',
      negated: false,
    },
  },
};

/** Emptiness, stated either way round. */
export const NotEmpty: Story = {
  args: {
    predicate: {
      form: 'empty',
      subject: { path: 'user.certifications', transforms: [] },
      negated: true,
    },
  },
};

/** A bare boolean attribute: "is false", asserted rather than implied by a missing `!`. */
export const BooleanAttribute: Story = {
  args: {
    predicate: {
      form: 'boolean-attribute',
      subject: { path: 'user.isContractor', transforms: [] },
      negated: true,
    },
  },
};

/** Two attributes compared with each other — both are subjects, neither is an operand. */
export const TwoSubjects: Story = {
  args: {
    predicate: {
      form: 'compare-subjects',
      left: { path: 'user.department', transforms: [] },
      operator: 'eq',
      right: { path: 'user.division', transforms: [] },
    },
  },
};

/** `null` is a value the rule really compares against, and prints as the word. */
export const NullOperand: Story = {
  args: {
    predicate: {
      form: 'compare',
      subject: { path: 'user.projectCode', transforms: [] },
      operator: 'eq',
      operand: null,
    },
  },
};
