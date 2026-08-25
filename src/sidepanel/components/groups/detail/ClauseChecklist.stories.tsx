import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ClauseChecklist from './ClauseChecklist';
import { NavigationProvider } from '../../../contexts/NavigationContext';
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
          'A group id inside the clause text is shown as a **named badge** when `groupContext` names it — the same list the explainer was already given, so no fetch happens to do it. An id it cannot name keeps its raw quoted form.\n\n' +
          '**Related internals:** [Shared](?path=/docs/internals-shared--docs)',
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
    expression: {
      description:
        "The rule's condition expression (untrusted Okta rule text). May be empty — that is reported as not evaluated.",
    },
    user: { description: 'The user the condition is explained against.' },
    maxClauses: { description: "Cap on clause rows; defaults to the explainer's 64." },
    groupContext: {
      description:
        "The user's **complete** group list, which turns `isMemberOf*` from a neutral “Not evaluated” into a real verdict. Omit it rather than passing a subset — a group missing from the list is read as a confident “they are not in it”.",
    },
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
 * A group-membership call with **no `groupContext` supplied**, so the evaluator
 * has nothing to resolve it against. It renders neutrally as "Not evaluated" and
 * is counted as needing group context — never as a failure.
 */
export const NotEvaluated: Story = {
  args: { expression: 'isMemberOfGroup("00gFAKE1")' },
};

/**
 * The same clause once the caller supplies the user's complete group list: it
 * resolves instead of declining, and the id inside the clause text is shown as
 * the group's name. This is what the Users tab's Groups pane now shows, because
 * that pane holds the whole list already.
 */
export const GroupClauseResolved: Story = {
  args: {
    expression: 'isMemberOfAnyGroup("00gFAKE1")',
    groupContext: [{ id: '00gFAKE1', name: 'Engineering' }],
  },
};

/**
 * One clause, two ids, one of them not in the list: the named group becomes a
 * badge and the unknown one keeps its raw quoted id. A name that is not in hand
 * is never a reason to hide the id an admin can still go look up.
 */
export const GroupIdsPartiallyNamed: Story = {
  args: {
    expression: 'isMemberOfAnyGroup("00gFAKE1", "00gFAKE9")',
    groupContext: [{ id: '00gFAKE1', name: 'Engineering' }],
  },
};

/**
 * A group *absent* from that complete list is a confident "not a member", not an
 * unknown — which is exactly why a partial list must never be passed.
 */
export const GroupClauseResolvedToFail: Story = {
  args: {
    expression: 'isMemberOfAnyGroup("00gFAKE9")',
    groupContext: [{ id: '00gFAKE1', name: 'Engineering' }],
  },
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
