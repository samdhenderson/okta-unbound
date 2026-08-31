import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import CreateFeedingRuleModal from './CreateFeedingRuleModal';

/** The confirm step behind the Group Detail strip's one irreversible verb. */
const meta = {
  title: 'Groups/CreateFeedingRuleModal',
  component: CreateFeedingRuleModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "The confirm step for the Group Detail rung's *Create feeding rule* verb — the action " +
          '`GroupActionBar` puts behind **More** because a rule *grants* memberships as it matches ' +
          'and deleting it afterwards leaves every one of them in place (ADR-0039 §2).\n\n' +
          'Fully controlled: the draft, its checks and the write all live in `useCreateFeedingRule`. ' +
          'Three things are always said before the confirm — the consequence, the mitigation ' +
          '(Okta creates the rule **inactive**, so nothing is granted until somebody activates it), ' +
          'and what is **not predicted**: how many people the rule would add. Under ADR-0036 a ' +
          'withheld prediction is a peer of an answer and carries its reason; a count invented from ' +
          'an inventory this rung does not hold would be exactly the assertion that ADR forbids.\n\n' +
          'The expression notice is a `warning` and never blocks the write: this panel parses a ' +
          'documented subset of Okta EL, so “could not read that” is a fact about the panel rather ' +
          'than a verdict on the rule (ADR-0017).\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  args: {
    isOpen: true,
    groupName: 'Engineering',
    name: '',
    onNameChange: fn(),
    nameError: null,
    expression: '',
    onExpressionChange: fn(),
    expressionNotice: null,
    canSubmit: false,
    isCreating: false,
    error: null,
    createdRuleName: null,
    createdRuleId: null,
    onClose: fn(),
    onConfirm: fn(),
    onNavigateToRule: fn(),
  },
  argTypes: {
    isOpen: { description: 'Whether the dialog is open.' },
    groupName: { description: 'The group the drafted rule assigns users into.' },
    name: { description: 'Controlled rule-name draft.' },
    onNameChange: { description: 'Called with the new rule name on each keystroke.' },
    nameError: { description: 'Why the drafted name is unacceptable (length), or null.' },
    expression: { description: 'Controlled match-expression draft.' },
    onExpressionChange: { description: 'Called with the new expression on each keystroke.' },
    expressionNotice: {
      description: 'Non-blocking notice about an expression this panel could not parse, or null.',
    },
    canSubmit: { description: 'Whether the confirm button may fire.' },
    isCreating: { description: 'True while the create request is in flight.' },
    error: { description: 'Message from a failed create, or null.' },
    createdRuleName: {
      description: 'The created rule’s name once the write landed — switches to the success step.',
    },
    createdRuleId: { description: 'The created rule’s id once the write landed, or null.' },
    onClose: { description: 'Close the dialog (Cancel, Done, Escape, overlay, header close).' },
    onConfirm: { description: 'Run the create.' },
    onNavigateToRule: {
      description: 'Deep-links the created rule in the Rules tab; omitted renders no jump control.',
    },
  },
} satisfies Meta<typeof CreateFeedingRuleModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An empty draft: the confirm is disabled, and the consequence is already on screen. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('button', { name: 'Create rule' })).toBeDisabled();
    await expect(body.getByText(/does not take those memberships back/)).toBeVisible();
  },
};

/** A complete draft. The confirm is live, and the withheld prediction is stated, not omitted. */
export const Ready: Story = {
  args: {
    name: 'Engineering intake',
    expression: 'user.department == "Engineering"',
    canSubmit: true,
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('button', { name: 'Create rule' })).toBeEnabled();
    await expect(body.getByText(/not predicted here/)).toBeVisible();
  },
};

/**
 * An expression this panel cannot parse. A `warning`, not a `danger`, and the
 * confirm stays live — Okta is the authority on its own expression language.
 */
export const UnparsedExpression: Story = {
  args: {
    name: 'Contractor intake',
    expression: 'user.employeeType ?? ',
    expressionNotice:
      'The condition could not be parsed here. Okta is the authority on its own expression language — this panel reads a subset of it, so the rule may still be valid.',
    canSubmit: true,
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('button', { name: 'Create rule' })).toBeEnabled();
  },
};

/** The drafted name is longer than Okta accepts — the field carries the reason. */
export const NameTooLong: Story = {
  args: {
    name: 'Engineering intake for everyone in the whole organisation',
    expression: 'user.department == "Engineering"',
    nameError: 'Okta allows 50 characters; this is 57.',
  },
};

/** The create is in flight — the confirm shows its own spinner. */
export const Creating: Story = {
  args: {
    name: 'Engineering intake',
    expression: 'user.department == "Engineering"',
    isCreating: true,
  },
};

/** Okta rejected the create; the draft is kept so it can be corrected and retried. */
export const ErrorState: Story = {
  args: {
    name: 'Engineering intake',
    expression: 'user.department == "Engineering"',
    canSubmit: true,
    error: 'A rule with this name already exists.',
  },
};

/** The write landed. The rule is inactive, and the jump that activates it is offered. */
export const Created: Story = {
  args: {
    createdRuleName: 'Engineering intake',
    createdRuleId: '0prFAKE000000000001',
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText(/Nobody has been added/)).toBeVisible();
    await expect(body.getByRole('button', { name: /Open in Rules tab/ })).toBeVisible();
  },
};

/** No Rules tab to jump to — the deep link is absent rather than dead (ADR-0039 §3). */
export const CreatedWithoutNavigation: Story = {
  args: {
    createdRuleName: 'Engineering intake',
    createdRuleId: '0prFAKE000000000001',
    onNavigateToRule: undefined,
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.queryByRole('button', { name: /Open in Rules tab/ })).toBeNull();
    await expect(body.getByRole('button', { name: 'Done' })).toBeVisible();
  },
};
