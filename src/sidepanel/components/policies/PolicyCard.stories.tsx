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

/**
 * Expanded, with the lazily-fetched rules rendered and the policy's own id offered
 * with a copy control named after the policy and its id — several cards can be
 * open at once, and two policies can share a display name (I-010).
 */
export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show rules for Any two factors' }));
    await waitFor(() => expect(canvas.getByText('Trusted device, no prompt')).toBeInTheDocument());
    await expect(
      canvas.getByRole('button', {
        name: `Copy policy id for Any two factors (${samplePolicy.id})`,
      }),
    ).toBeInTheDocument();
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

/**
 * Two policies sharing a display name, different ids — legitimate in Okta. The
 * copy control folds the id in, so the two copy controls stay distinguishable
 * by accessible name alone (I-010). The disclosure control does not yet —
 * see the comment on `PolicyCard`'s `IconButton` label for why that half is a
 * documented residual rather than fixed here.
 */
export const DuplicateNamesStayDistinguishable: Story = {
  render: (args) => (
    <div className="space-y-2">
      <PolicyCard {...args} policy={{ ...samplePolicy, id: 'rstFAKE000000000001' }} />
      <PolicyCard {...args} policy={{ ...samplePolicy, id: 'rstFAKE000000000004' }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggles = canvas.getAllByRole('button', { name: 'Show rules for Any two factors' });
    expect(toggles).toHaveLength(2);
    await userEvent.click(toggles[0]);
    await userEvent.click(toggles[1]);

    await expect(
      canvas.getByRole('button', {
        name: 'Copy policy id for Any two factors (rstFAKE000000000001)',
      }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', {
        name: 'Copy policy id for Any two factors (rstFAKE000000000004)',
      }),
    ).toBeInTheDocument();
  },
};
