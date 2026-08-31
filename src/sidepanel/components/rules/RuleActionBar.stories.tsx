import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import RuleActionBar from './RuleActionBar';
import type { FormattedRule } from '../../../shared/types';

const rule = (over: Partial<FormattedRule> = {}): FormattedRule => ({
  id: '00rFAKE0000000000001',
  name: 'Engineering – Auto-assign by department',
  status: 'ACTIVE',
  condition: 'user.department == "Engineering"',
  conditionExpression: 'user.department == "Engineering"',
  groupIds: ['00g1a2b3c4d5e6f7g8h9', '00g9z8y7x6w5v4u3t2s1'],
  groupNames: ['Engineering – All', 'Slack – Eng Channel'],
  userAttributes: ['department'],
  created: '2024-01-15T09:00:00.000Z',
  lastUpdated: '2026-06-01T14:30:00.000Z',
  ...over,
});

/** The rule-detail rung's action strip: one read-only verb, the rest behind **More**. */
const meta = {
  title: 'Rules/RuleActionBar',
  component: RuleActionBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Every verb whose object is the whole rule (ADR-0030). They used to be four buttons ' +
          'flex-wrapped at the bottom of `RuleCard`’s expanded body — a page-level verb rendered as ' +
          'though it were a property of a section of a card, which is the exact failure ADR-0030 §2 ' +
          'exists to stop.\n\n' +
          '**The split is not the obvious one.** A rule looks like it has a reversible pair — ' +
          'activate and deactivate — and it does not. Okta’s rule engine *only ever adds*: ' +
          'activating writes memberships that deactivating will not take back, and deactivating ' +
          'strands memberships that reactivating will not re-attribute (D-052). Neither press undoes ' +
          'the other, so both fail ADR-0039’s consequence test and both start behind **More**, with ' +
          'the consequence stated beside the control.\n\n' +
          '*Add target group* joins them there for the reason ADR-0051 §2 records learning the hard ' +
          'way: **a wizard in front of a verb does not move that verb into the row.** The ' +
          'consolidation wizard previews everything and still ends by creating a replacement rule ' +
          'and retiring this one.\n\n' +
          'What is left for the row is genuinely read-only: *Preview impact*, which works out who ' +
          'would stop being attributed and writes nothing. It is also the `primary` — this is a ' +
          '**detail** rung, so ADR-0059’s list-rung rule does not apply, and `primary` means what ' +
          'ADR-0030 always said it meant: the page’s one main verb.\n\n' +
          '**There is no Delete and no Edit condition, deliberately.** Rule deletion exists only as ' +
          'the retire half of the consolidation sequence, which owns its own preview and undo ' +
          'capture, and the app performs no in-place rule edit at all. ADR-0039 §3 is explicit that ' +
          'the fix for a verb with no live handler is to declare the descriptor when one exists — ' +
          'not to ship a control with no path to firing.\n\n' +
          '**Related internals:** [ActionBar](?path=/docs/shared-actionbar--docs), ' +
          '[RuleLifecycleActions](?path=/docs/rules-rulelifecycleactions--docs)',
      },
    },
  },
  args: {
    rule: rule(),
    onPreviewImpact: fn(),
    tierOpen: false,
    onTierOpenChange: fn(),
    isLifecycleLoading: false,
    isConfirmingActivate: false,
    onRequestActivate: fn(),
    onCancelActivate: fn(),
    onConfirmActivate: fn(),
    onRequestDeactivate: fn(),
    onAddTargetGroup: fn(),
    // Nothing scrolls in a story, so the strip renders at its resting geometry.
    sticky: false,
  },
  argTypes: {
    rule: { description: 'The rule every verb in the strip acts on.' },
    onPreviewImpact: {
      description: 'Opens the read-only impact preview. Omitted when the rule targets no groups.',
    },
    tierOpen: {
      description:
        'Whether the disclosure tier is showing. Owned by the tab, so a rung change collapses it.',
    },
    onTierOpenChange: {
      description: 'Called with the tier’s next open state when **More** is pressed.',
    },
    isLifecycleLoading: { description: 'True while a confirmed lifecycle write is in flight.' },
    isConfirmingActivate: { description: 'Whether the activation confirm is armed.' },
    onAddTargetGroup: {
      description: 'Starts the consolidation wizard. Omitted when not wired.',
    },
    sticky: {
      description: 'Pin the strip below the header. `false` in stories — nothing scrolls.',
    },
  },
} satisfies Meta<typeof RuleActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The row only: one read-only verb, with everything that writes behind **More**. */
export const Default: Story = {};

/** An ACTIVE rule with the tier open — the lifecycle verb is the destructive one. */
export const TierOpenActive: Story = {
  args: { tierOpen: true },
};

/** An INACTIVE rule: the same row offers activation, and says what activating costs. */
export const TierOpenInactive: Story = {
  args: { tierOpen: true, rule: rule({ status: 'INACTIVE' }) },
};

/** The activation confirm is armed, so its modal is open. */
export const ConfirmingActivate: Story = {
  args: { tierOpen: true, rule: rule({ status: 'INACTIVE' }), isConfirmingActivate: true },
};

/** A lifecycle write is in flight — every verb in the tier is disabled. */
export const TierOpenLifecycleRunning: Story = {
  args: { tierOpen: true, isLifecycleLoading: true },
};

/** Consolidation is not wired, so the tier offers no *Add target group* row at all. */
export const WithoutConsolidation: Story = {
  args: { tierOpen: true, onAddTargetGroup: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole('button', { name: 'Add target group' }),
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /Deactivate rule/ })).toBeInTheDocument();
  },
};

/**
 * A rule that assigns to no groups. There is no population to compute a change for, so
 * *Preview impact* is **omitted rather than disabled** — no verb without an object
 * (ADR-0051 §3) — and the strip is left with no `primary` at all rather than promoting
 * something else to fill the slot.
 *
 * The fact itself is not lost: the detail view states it in prose, which is why removing
 * the verb here does not remove the finding.
 */
export const NoTargetGroups: Story = {
  args: { rule: rule({ groupIds: [], groupNames: [] }), onPreviewImpact: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Preview impact' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'More' })).toBeInTheDocument();
  },
};

/**
 * **More** is a real disclosure: `aria-expanded` flips and `aria-controls` points at the
 * tier, so the region it reveals is reachable from the button that reveals it.
 *
 * The control is the shared `ActionBar`'s, not this component's — this story is what
 * proves `RuleActionBar` still wires a working disclosure through it.
 */
export const MoreIsADisclosure: Story = {
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a story render fn is a component
    const [open, setOpen] = useState(false);
    return <RuleActionBar {...args} tierOpen={open} onTierOpenChange={setOpen} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const more = canvas.getByRole('button', { name: 'More' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByRole('button', { name: /Deactivate rule/ })).toBeVisible();

    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'false');
  },
};

/**
 * The 360px panel floor with the tier open — the width this strip's shape was designed
 * against. The row is short enough that nothing overflows here; what the floor tests is
 * the tier, whose consequence sentences wrap beside their buttons rather than pushing
 * them off the panel edge.
 *
 * The viewport preset resizes the **explorer preview** only — the headless story runner
 * renders at its own window width (ADR-0014), so this story is the visual proof of the
 * floor and `actionBarFit`'s table-driven tests are the automated one.
 */
export const NarrowTierOpen: Story = {
  args: { tierOpen: true },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
