import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ClauseLedgerBranch from './ClauseLedgerBranch';
import { NavigationProvider } from '../../contexts/NavigationContext';
import type { ConnectiveNode, LeafClauseNode } from '../../../shared/rules/explainExpression';

const meta = {
  title: 'Shared/ClauseLedgerBranch',
  component: ClauseLedgerBranch,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One `&&`/`||` connective group of a `ClauseLedger` tree: its label, its children indented under a rail, and — when the structured fields say a not-evaluated child could not change the answer — the one Kleene-shortcut sentence explaining why.\n\n' +
          'The note is read entirely off `verdict`, `undecidedChildCount` and `decidedByChildIndices`, never by re-parsing rendered text, and it never appears when `decidedByChildIndices` is empty.',
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
    node: { description: 'The connective group to render.' },
    resolveGroupName: { description: 'Names group ids inside descendant clauses.' },
  },
} satisfies Meta<typeof ClauseLedgerBranch>;

export default meta;
type Story = StoryObj<typeof meta>;

const passingLeaf: LeafClauseNode = {
  node: 'leaf',
  expressionText: 'user.department == "Engineering"',
  resolvedValue: 'Engineering',
  status: 'pass',
  reads: [{ path: 'user.department', value: 'Engineering' }],
};

const undecidedLeaf: LeafClauseNode = {
  node: 'leaf',
  expressionText: 'isMemberOfGroupNameRegex("(?=.*Ops).*")',
  resolvedValue: undefined,
  status: 'not-evaluated',
  reasonCode: 'regex-unsupported-syntax',
  reads: [],
};

/** An OR already decided by a passing alternative: the Kleene note fires. */
export const OrDecidedByPassingChild: Story = {
  args: {
    node: {
      node: 'connective',
      kind: 'or',
      children: [passingLeaf, undecidedLeaf],
      verdict: 'pass',
      decidedByChildIndices: [0],
      undecidedChildCount: 1,
      depth: 0,
    } satisfies ConnectiveNode,
  },
};

const failingLeaf: LeafClauseNode = {
  ...passingLeaf,
  expressionText: 'user.title == "Staff Engineer"',
  resolvedValue: 'Intern',
  status: 'fail',
  reads: [{ path: 'user.title', value: 'Intern' }],
};

/** An AND already decided by a failing child: the equivalent failing-side note. */
export const AndDecidedByFailingChild: Story = {
  args: {
    node: {
      node: 'connective',
      kind: 'and',
      children: [failingLeaf, undecidedLeaf],
      verdict: 'fail',
      decidedByChildIndices: [0],
      undecidedChildCount: 1,
      depth: 0,
    } satisfies ConnectiveNode,
  },
};

/** Every child evaluated on its own merits: no shortcut, so no note. */
export const NoKleeneNoteWhenFullyEvaluated: Story = {
  args: {
    node: {
      node: 'connective',
      kind: 'and',
      children: [passingLeaf, failingLeaf],
      verdict: 'fail',
      decidedByChildIndices: [],
      undecidedChildCount: 0,
      depth: 0,
    } satisfies ConnectiveNode,
  },
};

/**
 * A subtree collapsed by the depth cap (`truncation: 'depth'`): every clause is
 * still on screen with its verdict — only the nesting under one of them was
 * folded up — and the warning says exactly that.
 */
export const TruncatedSubtree: Story = {
  args: {
    node: {
      node: 'connective',
      kind: 'and',
      children: [passingLeaf, failingLeaf],
      verdict: 'fail',
      decidedByChildIndices: [1],
      undecidedChildCount: 0,
      depth: 0,
      truncation: 'depth',
    } satisfies ConnectiveNode,
  },
};

/**
 * The other truncation (`truncation: 'clause-cap'`): clauses past the cap were
 * dropped outright, so the warning has to say clauses are **missing from the
 * list** rather than merely nested out of view. The count that was kept is on
 * `summary.totalClauses`, above this branch.
 */
export const TruncatedClauseCap: Story = {
  args: {
    node: {
      node: 'connective',
      kind: 'and',
      children: [passingLeaf, failingLeaf],
      verdict: 'fail',
      decidedByChildIndices: [1],
      undecidedChildCount: 0,
      depth: 0,
      truncation: 'clause-cap',
    } satisfies ConnectiveNode,
  },
};
