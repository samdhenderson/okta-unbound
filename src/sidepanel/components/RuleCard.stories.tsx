import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { FormattedRule } from '../../shared/types';
import RuleCard from './RuleCard';

const baseRule: FormattedRule = {
  id: '00rABCDEF1234567890',
  name: 'Engineering – Auto-assign by department',
  status: 'ACTIVE',
  condition: 'user.department == "Engineering"',
  conditionExpression: 'user.department == "Engineering"',
  groupIds: ['00g1a2b3c4d5e6f7g8h9', '00g9z8y7x6w5v4u3t2s1'],
  groupNames: ['Engineering – All', 'Slack – Eng Channel'],
  allGroupNamesMap: {
    '00g1a2b3c4d5e6f7g8h9': 'Engineering – All',
    '00g9z8y7x6w5v4u3t2s1': 'Slack – Eng Channel',
  },
  userAttributes: ['department'],
  created: '2024-01-15T09:00:00.000Z',
  lastUpdated: '2026-06-01T14:30:00.000Z',
  affectsCurrentGroup: false,
};

/** One group rule as a list row, with a way into its detail rung. */
const meta = {
  title: 'Rules/RuleCard',
  component: RuleCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A single Okta group rule as a list row: name, status, the badges that say how it relates to the group you arrived from, and its condition in human-readable form.\n\n' +
          '**It used to be the detail view.** The card carried an expandable body holding the condition expression, the referenced attributes, the target groups, the conflicts and the metadata — and, flex-wrapped at the bottom, four write verbs. That body is [RuleDetailView](?path=/docs/rules-ruledetailview--docs) now, under a real `ActionBar`: ADR-0030 §2 is explicit that verbs whose object is the whole entity do not belong inside a section of a card.\n\n' +
          "**Pressing the row opens it, through a `StretchedButton`.** An invisible full-bleed `<button>` rather than a click handler on a `<div>`, so Enter/Space, focus and disabled semantics come for free and the row's heading stays a heading. Its accessible name is the same on every row, so it points at *this* row's name via `aria-describedby`.\n\n" +
          '**The status is stated in text, not hue.** It was a coloured dot with no label — the one fact the row most needed to carry, available only to a reader who could see the colour and knew the convention.\n\n' +
          '**Related internals:** [ListRow](?path=/docs/shared-listrow--docs), [StretchedButton](?path=/docs/shared-stretchedbutton--docs)',
      },
    },
  },
  argTypes: {
    rule: { description: 'The formatted rule to display.' },
    onOpenRule: {
      description: "Open this rule's detail rung. Wired by the Rules tab, which has one to push.",
    },
    onOpenInRulesTab: {
      description:
        'Jump to this rule on the Rules tab. Wired by surfaces showing a rule somewhere else, whose own view stack has no rule rung to push.',
    },
    isHighlighted: {
      description: 'When true, the row flashes once on arrival (deep-link target).',
    },
  },
  args: {
    rule: baseRule,
    onOpenRule: fn(),
    isHighlighted: false,
  },
} satisfies Meta<typeof RuleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An active rule with no conflicts. Pressing anywhere on the row opens its rung. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open rule' }));
    await expect(args.onOpenRule).toHaveBeenCalledWith(baseRule);
  },
};

/**
 * The row names the rule it opens. `label` is identical on every row in a list, so the
 * overlay is described by this row's own heading — a reader hears "Open rule, Engineering
 * – Auto-assign by department" rather than fifty controls called the same thing.
 */
export const NamesTheRuleItOpens: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const open = canvas.getByRole('button', { name: 'Open rule' });
    const describedBy = open.getAttribute('aria-describedby');
    await expect(describedBy).toBeTruthy();
    await expect(canvas.getByText(baseRule.name)).toHaveAttribute('id', describedBy);
  },
};

/** Inactive rule — the status is a neutral badge that says so, not a grey dot. */
export const Inactive: Story = {
  args: { rule: { ...baseRule, status: 'INACTIVE' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('INACTIVE')).toBeInTheDocument();
  },
};

/** Assigns into the group you arrived from — takes `ListRow`'s shared `selected` state. */
export const AffectsCurrentGroup: Story = {
  args: { rule: { ...baseRule, affectsCurrentGroup: true } },
};

/** A detected conflict is counted on the row; the detail is on the rule's rung. */
export const WithConflicts: Story = {
  args: {
    rule: {
      ...baseRule,
      conflicts: [
        {
          rule1: { id: baseRule.id, name: baseRule.name },
          rule2: { id: '00rZYXWVUT0987654321', name: 'Contractors – Auto-assign by department' },
          reason: 'Both rules assign users to "Engineering – All" based on overlapping conditions.',
          severity: 'high',
          affectedGroups: ['00g1a2b3c4d5e6f7g8h9'],
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('1 Conflict')).toBeInTheDocument();
  },
};

/**
 * The Group Detail rules section's wiring: the press leaves this tab, so the control says
 * where it lands rather than promising a detail view that opens in place.
 */
export const OpensInTheRulesTab: Story = {
  args: { onOpenRule: undefined, onOpenInRulesTab: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open rule in the Rules tab' }));
    await expect(args.onOpenInRulesTab).toHaveBeenCalledWith(baseRule.id);
  },
};

/**
 * Neither handler wired: the row is inert *by design*, and renders no affordance — no
 * chevron, no overlay, nothing that looks pressable and is not (ADR-0039).
 */
export const NotOpenable: Story = {
  args: { onOpenRule: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument();
  },
};

/** A deep-link target, flashing once on arrival. */
export const Highlighted: Story = {
  args: { isHighlighted: true },
};
