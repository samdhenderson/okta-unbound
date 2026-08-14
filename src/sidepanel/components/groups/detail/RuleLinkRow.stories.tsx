import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import RuleLinkRow from './RuleLinkRow';

/** The ACTIVE/INACTIVE pill the rules section passes as `trailing`. */
const StatusPill = ({ status }: { status: string }) => (
  <span
    className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
      status === 'ACTIVE'
        ? 'border-success-light bg-success-light text-success-text'
        : 'border-neutral-200 bg-neutral-50 text-neutral-600'
    }`}
  >
    {status}
  </span>
);

const meta = {
  title: 'Groups/RuleLinkRow',
  component: RuleLinkRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One rule in a Group Detail rule list, shared by the membership-source and rules sections so a rule looks and behaves the same wherever it is listed.\n\n' +
          '`onSelect` is the whole switch: with it the row is a real `<button>` whose accessible name names the rule (`Open rule X in the Rules tab`, never a bare "Open") and which shows a chevron; without it the row is an inert container with no chevron and no focus ring.\n\n' +
          'The card is the shared `ListRow` at `compact` density (ADR-0029) — the row previously wrote its own chrome, including a `hover:border-primary hover:bg-primary-light` treatment that is now the one shared `hover:border-neutral-500`.',
      },
    },
  },
  argTypes: {
    name: {
      description: "Rule name — the row's visible label and the basis of its accessible name.",
    },
    trailing: { description: 'Optional right-aligned node (a status pill, a member count).' },
    detail: {
      description: 'Optional secondary line under the name (e.g. the condition expression).',
    },
    onSelect: {
      description: 'Deep-links this rule in the Rules tab. Omit to render a non-interactive row.',
    },
  },
  args: { name: 'All Engineers', onSelect: fn() },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RuleLinkRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Interactive: a button with a chevron and a rule-naming accessible name. */
export const Default: Story = {};

/** No `onSelect`: inert markup, no chevron, nothing focusable. */
export const NonInteractive: Story = {
  args: { onSelect: undefined },
};

/** With the ACTIVE/INACTIVE pill the rules section supplies. */
export const WithStatusPill: Story = {
  args: { trailing: <StatusPill status="ACTIVE" /> },
};

/** The condition expression as a mono secondary line. */
export const WithDetail: Story = {
  args: {
    detail: 'user.department == "Engineering" && user.employeeType == "FULL_TIME"',
    trailing: <StatusPill status="INACTIVE" />,
  },
};

/** A long name truncates rather than pushing the trailing node out of the row. */
export const LongName: Story = {
  args: {
    name: 'Engineering — Platform, Infrastructure, Reliability and Developer Tooling (all regions)',
    trailing: <StatusPill status="ACTIVE" />,
  },
};
