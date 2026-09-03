import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import RuleExpressionText from './RuleExpressionText';
import { NavigationProvider } from '../../contexts/NavigationContext';

/** Obviously fake ids — no real org data ever ships in a story. */
const names: Record<string, string> = {
  '00gFAKEGROUP0001': 'Engineering — Platform',
  '00gFAKEGROUP0002': 'Contractors — EMEA',
};

/** The name source a host already holds; unknown ids resolve to nothing. */
const resolveGroupName = (groupId: string): string | undefined => names[groupId];

const meta = {
  title: 'Shared/RuleExpressionText',
  component: RuleExpressionText,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Rule-condition text with its group-id literals resolved to named badges, so `isMemberOfAnyGroup("00gFAKEGROUP0001")` reads as the group rather than as an opaque id.\n\n' +
          'It resolves **nothing it was not already given**: the only names available are the ones the host already holds, through the same `resolveGroupName` shape `ClauseGroupList` takes. There is no fetch here, and an id with no known name renders exactly as it did before — quoted, in mono, inside the expression.\n\n' +
          'A literal becomes a badge only when it resolves to a name. The tokeniser never guesses which quoted literal is a group id; it offers each one to the resolver and badges what comes back named, which is why `user.department == "Engineering"` still prints as itself.\n\n' +
          'The **type treatment is fixed** — mono, `text-xs`, wrapping. Every host used to restate that recipe through `className`, which is a recipe free to drift; the only axis a host picks is `tone`, and `className` takes layout and spacing only.\n\n' +
          'Expression text and group names are untrusted tenant data. The text is **split**, never parsed into markup — every piece is React text and every badge takes its id and name as props.',
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
    text: {
      description: "The condition text to render — a clause's reconstructed expression text.",
    },
    resolveGroupName: {
      description:
        'Names the group ids inside the text. Omitted, or returning `undefined`, the literal keeps its raw quoted form.',
    },
    tone: {
      description:
        'Reading role. `default` for the condition the surface is about; `subdued` for one printed under another it qualifies.',
    },
    className: {
      description:
        'Layout and spacing only — `min-w-0`, `flex-1`, a margin. Type and colour are not overridable.',
    },
  },
  args: {
    text: 'isMemberOfAnyGroup("00gFAKEGROUP0001")',
    resolveGroupName,
  },
} satisfies Meta<typeof RuleExpressionText>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One resolvable id: the badge opens the group and can copy the raw id. */
export const ResolvedGroupId: Story = {};

/**
 * The fallback. No resolver at all — every literal stays exactly as the clause
 * reconstructed it, which is how this text rendered before ids were resolved.
 */
export const NoResolver: Story = {
  args: { resolveGroupName: undefined },
};

/**
 * A resolver that has no name for this id. Same fallback, reached the other way:
 * a name that has not loaded is never a reason to show a half-labelled badge.
 */
export const UnresolvedGroupId: Story = {
  args: { text: 'isMemberOfGroup("00gFAKEGROUP0009")' },
};

/** Some named, some not — one expression can legitimately be both. */
export const PartiallyResolved: Story = {
  args: {
    text: 'isMemberOfAnyGroup("00gFAKEGROUP0001", "00gFAKEGROUP0009", "00gFAKEGROUP0002")',
  },
};

/**
 * A non-group literal is not a group id. The resolver finds no name for
 * `"Engineering"`, so the comparison prints as source — the tokeniser never
 * guesses.
 */
export const NonGroupLiteralsUntouched: Story = {
  args: { text: 'user.department == "Engineering" && user.title != "Intern"' },
};

/**
 * Without a navigation handler for groups the badge degrades to plain text with a
 * tooltip, rather than becoming a control that does nothing. The name is still won.
 */
export const Unlinkable: Story = {
  decorators: [
    (Story) => (
      <NavigationProvider handlers={{}}>
        <Story />
      </NavigationProvider>
    ),
  ],
};

/** A long condition wraps inside its row instead of overflowing the side panel. */
export const LongExpression: Story = {
  args: {
    text: 'isMemberOfAnyGroup("00gFAKEGROUP0001") && !isMemberOfAnyGroup("00gFAKEGROUP0002") && String.stringContains(user.department, "Engineering-Platform-Infrastructure")',
  },
};

/**
 * The two tones in the shape that produced them: a clause, and beneath it the
 * alternatives that would satisfy it. The subdued tone is what keeps the nested
 * condition from competing with the one it qualifies — the difference every host
 * used to spell out with its own `text-neutral-*` class.
 */
export const TonesInContext: Story = {
  render: (args) => (
    <div className="max-w-md space-y-2">
      <RuleExpressionText {...args} text='isMemberOfAnyGroup("00gFAKEGROUP0001")' />
      <div className="border-l-2 border-neutral-200 pl-3">
        <p className="text-xs font-medium text-neutral-600">Any one of these satisfies it:</p>
        <RuleExpressionText
          {...args}
          tone="subdued"
          text='isMemberOfAnyGroup("00gFAKEGROUP0002")'
        />
      </div>
    </div>
  ),
};
