import type { Meta, StoryObj } from '@storybook/react-vite';
import ClauseChecklist from './ClauseChecklist';
import type { OktaUser } from '../../../../shared/types';

/** An obviously fake user — no real org data ever ships in a story. */
const user: OktaUser = {
  id: '00uFAKE1',
  status: 'ACTIVE',
  profile: {
    login: 'ada@example.com',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    title: 'Intern',
    // A custom profile attribute whose value really is null (not merely absent).
    projectCode: null,
  },
};

/** 70 clauses — past the explainer's 64-row cap, so the checklist discloses truncation. */
const hugeExpression = Array.from({ length: 70 }, (_, i) => `user.department == "Team ${i}"`).join(
  ' || ',
);

const meta = {
  title: 'Groups/ClauseChecklist',
  component: ClauseChecklist,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Explains one rule condition against one user, clause by clause: the clause text in mono, the profile value that drove it, and a pass / fail / **not evaluated** outcome.\n\n' +
          'Two distinctions carry the whole feature. A clause the evaluator could not resolve renders **neutrally** — never with the `danger` treatment reserved for a clause that genuinely resolved to `false`, because "we could not check this" is not "this person does not qualify". And a value that was never readable (`undefined`) reads differently from an attribute that resolved to Okta\'s `null`.\n\n' +
          'A condition that never parsed — including an absent one — renders as a neutral "could not be checked" note with its reason, never as an empty checklist implying everything passed. A condition past the clause cap says how much it is showing.\n\n' +
          '**Related internals:** [Shared](?path=/docs/internals-shared--docs)',
      },
    },
  },
  argTypes: {
    expression: {
      description:
        "The rule's condition expression (untrusted Okta rule text). May be empty — that is reported as not evaluated.",
    },
    user: { description: 'The user the condition is explained against.' },
    maxClauses: { description: "Cap on clause rows; defaults to the explainer's 64." },
  },
  args: { expression: 'user.department == "Engineering"', user },
} satisfies Meta<typeof ClauseChecklist>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A single clause that resolved to true, with the profile value that drove it. */
export const Pass: Story = {};

/** A single clause that genuinely resolved to false — the only thing shown as a failure. */
export const Fail: Story = {
  args: { expression: 'user.title == "Staff Engineer"' },
};

/**
 * A group-membership call the evaluator cannot resolve. It renders neutrally as
 * "Not evaluated" and is counted as needing group context — never as a failure.
 */
export const NotEvaluated: Story = {
  args: { expression: 'isMemberOfGroup("00gFAKE1")' },
};

/** Pass, fail and not-evaluated side by side: an unevaluable sibling never taints the rest. */
export const Mixed: Story = {
  args: {
    expression:
      'user.department == "Engineering" && user.title != "Intern" && isMemberOfGroup("00gFAKE1")',
  },
};

/** `undefined` (nothing resolvable) next to `null` (the attribute really is null). */
export const UnreadableVersusNullValue: Story = {
  args: { expression: 'isMemberOfGroup("00gFAKE1") || user.projectCode == "Platform"' },
};

/** Past the clause cap: the checklist says it is showing a partial list. */
export const Truncated: Story = {
  args: { expression: hugeExpression },
};

/** A rule with no condition expression: reported as not evaluated, never as "matches nothing". */
export const Empty: Story = {
  args: { expression: '' },
};

/** Text the evaluator could not parse at all — still no clause is shown as failing. */
export const Unparseable: Story = {
  args: { expression: 'user.department ==' },
};

/** A long clause wraps inside its own row instead of overflowing the panel. */
export const LongExpression: Story = {
  args: {
    expression:
      'String.stringContains(user.department, "Engineering-Platform-Infrastructure-Reliability-And-Tooling") && user.title != "Intern"',
  },
};
