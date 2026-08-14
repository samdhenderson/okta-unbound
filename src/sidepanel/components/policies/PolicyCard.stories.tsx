import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import PolicyCard from './PolicyCard';
import { resetEntityCache } from '../../cache/entityCache';
import type { OktaPolicyListItem, OktaPolicyRule } from '../../../shared/schemas/okta';

/** An obviously-fake app authentication policy. */
const samplePolicy = {
  id: 'rstFAKE000000000001',
  name: 'Any two factors',
  status: 'ACTIVE',
  type: 'ACCESS_POLICY',
  priority: 1,
  description: 'Requires two factors for high-risk applications',
  system: false,
} as OktaPolicyListItem;

/** Rules returned when the card is expanded. */
const sampleRules = [
  { id: '0prFAKE000000000001', name: 'Trusted device, no prompt', status: 'ACTIVE', priority: 1 },
  {
    id: '0prFAKE000000000002',
    name: 'Catch-all Rule',
    status: 'ACTIVE',
    priority: 2,
    system: true,
  },
] as OktaPolicyRule[];

/**
 * Expandable, strictly read-only card for a single app authentication policy.
 */
const meta = {
  title: 'Policies/PolicyCard',
  component: PolicyCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Expandable, read-only card for a single app authentication policy.\n\n' +
          'Collapsed it shows the policy name, status pill, evaluation priority, a `System` badge ' +
          "for Okta-managed policies and the description. Expanding lazily fetches the policy's " +
          'rules through the entity cache (keyed `["policyRules", id]`), so collapsing and ' +
          're-expanding — or re-mounting after a tab switch — costs no second request. The card ' +
          'renders no activate/deactivate or any other mutation affordance.',
      },
    },
  },
  argTypes: {
    policy: { description: 'The validated policy to display.' },
    loadRules: { description: "Fetches a policy's rules (the tab passes `api.getPolicyRules`)." },
  },
  args: {
    policy: samplePolicy,
    loadRules: fn(async () => sampleRules),
  },
  beforeEach: () => {
    // Rules are cached per policy id in a module-level cache that outlives a story.
    resetEntityCache();
  },
} satisfies Meta<typeof PolicyCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Collapsed — nothing has been fetched yet. */
export const Default: Story = {};

/** An Okta-managed catch-all policy: `System` badge, no description. */
export const SystemPolicy: Story = {
  args: {
    policy: {
      id: 'rstFAKE000000000003',
      name: 'Default Policy',
      status: 'ACTIVE',
      type: 'ACCESS_POLICY',
      priority: 99,
      system: true,
    } as OktaPolicyListItem,
  },
};

/** A deactivated policy — neutral status pill. */
export const Inactive: Story = {
  args: {
    policy: {
      ...samplePolicy,
      id: 'rstFAKE000000000002',
      status: 'INACTIVE',
    } as OktaPolicyListItem,
  },
};

/** Expanded, with the lazily-fetched rules rendered. */
export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show rules for Any two factors' }));
    await waitFor(() => expect(canvas.getByText('Trusted device, no prompt')).toBeInTheDocument());
  },
};

/**
 * The whole header expands the card, not just the chevron.
 *
 * Worth pinning because the two controls are nested: the `IconButton` sits inside
 * the header region that carries the toggle, and a button's click — keyboard
 * activation included — bubbles. Wiring a handler to both would fire twice and
 * cancel out, leaving a chevron that looks broken. This asserts one click opens
 * it and the next closes it, from the header itself.
 */
export const HeaderClickToggles: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByText('Any two factors'));
    await waitFor(() => expect(canvas.getByText('Trusted device, no prompt')).toBeInTheDocument());

    await userEvent.click(canvas.getByText('Any two factors'));
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-testid="policy-rules-disclosure"]'),
      ).toHaveAttribute('data-open', 'false'),
    );
  },
};

/** Expanded when the rules fetch fails — the inline `danger` state. */
export const RulesLoadFailure: Story = {
  args: {
    loadRules: fn(async () => {
      throw new Error('Policy rules unavailable');
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show rules for Any two factors' }));
    await waitFor(() => expect(canvas.getByText(/Could not load rules/)).toBeInTheDocument());
  },
};
