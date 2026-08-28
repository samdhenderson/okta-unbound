import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import RuleLinkRow from './RuleLinkRow';
import { Badge } from '../../shared';

/**
 * One rule row, shared by the attribute-health and membership-source cards so a
 * rule looks and behaves the same wherever it is listed. Renders as a real
 * `<button>` (with a `press`/`press-subtle` pointer-down acknowledgement, ADR-0046)
 * when `onSelect` deep-links into the Rules tab, or as inert markup without one.
 */
const meta = {
  title: 'Groups/RuleLinkRow',
  component: RuleLinkRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A rule name, an optional secondary detail line, and an optional trailing node ' +
          '(a status pill, a member count) — with or without a click that opens the rule ' +
          'in the Rules tab. Without `onSelect` the row is non-interactive markup, so a ' +
          'caller with nowhere to navigate never ships a button that goes nowhere.',
      },
    },
  },
  argTypes: {
    name: { description: "Rule name — the row's visible label and accessible name." },
    trailing: { description: 'Optional right-aligned node (a status pill, a member count).' },
    detail: {
      description: 'Optional secondary line under the name (e.g. a condition expression).',
    },
    onSelect: {
      description: 'Deep-links this rule in the Rules tab. Omit to render a non-interactive row.',
    },
  },
  args: {
    name: 'All Engineers',
    onSelect: fn(),
  },
} satisfies Meta<typeof RuleLinkRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The interactive form: a real button naming the rule it opens. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Open rule All Engineers in the Rules tab' }),
    ).toBeInTheDocument();
  },
};

/** No `onSelect` — inert markup, not a button that goes nowhere. */
export const Static: Story = {
  args: { onSelect: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(canvas.getByText('All Engineers')).toBeInTheDocument();
  },
};

/** A secondary detail line, e.g. the rule's condition expression. */
export const WithDetail: Story = {
  args: { detail: 'user.department == "Engineering"' },
};

/** A trailing node — here, a status pill. */
export const WithTrailing: Story = {
  args: { trailing: <Badge variant="success">ACTIVE</Badge> },
};

/** Hover state (forced via the pseudo-states addon). */
export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
};
