import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import RuleLifecycleActions from './RuleLifecycleActions';
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

/** The rule strip's disclosure tier: the verbs that change real memberships. */
const meta = {
  title: 'Rules/RuleLifecycleActions',
  component: RuleLifecycleActions,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'What sits behind **More** on the rule rung. Shown here on its own; in the app it is the ' +
          '`expansion` slot of [RuleActionBar](?path=/docs/rules-ruleactionbar--docs), sharing the ' +
          'strip’s chrome.\n\n' +
          '**Why both lifecycle verbs are in here.** On the user rung the asymmetry is obvious — ' +
          '*Add group* is reversible, *Suspend* is not. A rule looks symmetric and is not: Okta’s ' +
          'rule engine *only ever adds* (D-052). Activating writes memberships into every target ' +
          'group, and deactivating later leaves every one of those people exactly where they are — ' +
          'now unattributed, indistinguishable from a manual add. Neither press undoes the other, so ' +
          'both fail ADR-0039’s consequence test.\n\n' +
          '**That is a change in behaviour, not only in placement.** *Activate Rule* used to fire ' +
          'immediately from the rule card, with no gate at all.\n\n' +
          '**Only one of the two is ever offered.** The other is not something you can do to a rule ' +
          'in this state, and a disabled button offering it would be a control with no path to ' +
          'firing (ADR-0039 §3).\n\n' +
          '**Deactivate keeps its existing gate rather than gaining a second one.** It opens ' +
          '`RuleImpactModal`, which computes and *names* who stops being attributed — strictly ' +
          'better than the generic sentence a `Modal` here could offer, and adding one would be two ' +
          'confirms for one verb. That is why only activation has a dialog in these stories.\n\n' +
          '`Each asks to confirm` is stated once for the band; repeating it per button would read as ' +
          'a warning about one verb rather than a property of all.',
      },
    },
  },
  args: {
    rule: rule(),
    isLifecycleLoading: false,
    isConfirmingActivate: false,
    onRequestActivate: fn(),
    onCancelActivate: fn(),
    onConfirmActivate: fn(),
    onRequestDeactivate: fn(),
    onAddTargetGroup: fn(),
  },
  argTypes: {
    rule: { description: 'The rule these verbs act on.' },
    isLifecycleLoading: {
      description: 'True while a confirmed write is in flight — disables every trigger.',
    },
    isConfirmingActivate: { description: 'Whether the activation confirm is armed.' },
    onAddTargetGroup: {
      description: 'Starts the consolidation wizard. Omitted when not wired.',
    },
  },
} satisfies Meta<typeof RuleLifecycleActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An ACTIVE rule: the lifecycle row offers the destructive verb, and says what it leaves behind. */
export const Active: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /Deactivate rule/ })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /Activate rule/ })).not.toBeInTheDocument();
    await expect(canvas.getByText(/Everyone it already added stays/)).toBeInTheDocument();
  },
};

/**
 * An INACTIVE rule. The consequence sentence names the groups the rule would start
 * filling, so the cost is stated in terms of this rule rather than in the abstract.
 */
export const Inactive: Story = {
  args: { rule: rule({ status: 'INACTIVE' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /Activate rule/ })).toBeInTheDocument();
    await expect(canvas.getByText(/removes nobody/)).toBeInTheDocument();
  },
};

/**
 * The activation confirm. It does not merely ask "are you sure" — it states the fact that
 * makes the press irreversible, in the same words the band uses.
 */
export const ConfirmingActivate: Story = {
  args: { rule: rule({ status: 'INACTIVE' }), isConfirmingActivate: true },
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body).getByRole('dialog');
    await expect(dialog).toHaveTextContent(/only ever adds members/);
  },
};

/** A confirmed write is in flight — every trigger is disabled until it settles. */
export const LifecycleRunning: Story = {
  args: { isLifecycleLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /Deactivate rule/ })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Add target group' })).toBeDisabled();
  },
};

/**
 * Consolidation is not wired, so its row — and the divider that separates it from the
 * lifecycle row — are absent rather than disabled.
 */
export const WithoutConsolidation: Story = {
  args: { onAddTargetGroup: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole('button', { name: 'Add target group' }),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText(/Creates a replacement rule/)).not.toBeInTheDocument();
  },
};

/** Arming and dismissing the confirm, with the write firing only on the second press. */
export const ConfirmGatesTheWrite: Story = {
  name: 'The confirm actually gates the write',
  args: { rule: rule({ status: 'INACTIVE' }) },
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a story render fn is a component
    const [armed, setArmed] = useState(false);
    return (
      <RuleLifecycleActions
        {...args}
        isConfirmingActivate={armed}
        onRequestActivate={() => setArmed(true)}
        onCancelActivate={() => setArmed(false)}
        onConfirmActivate={() => {
          setArmed(false);
          args.onConfirmActivate();
        }}
      />
    );
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole('button', { name: /Activate rule/ }));
    await userEvent.click(body.getByRole('button', { name: 'Cancel' }));
    await expect(args.onConfirmActivate).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole('button', { name: /Activate rule/ }));
    await userEvent.click(body.getByRole('button', { name: 'Activate' }));
    await expect(args.onConfirmActivate).toHaveBeenCalled();
  },
};

/** The 360px panel floor: each consequence sentence wraps above its button rather than crowding it. */
export const Narrow: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
