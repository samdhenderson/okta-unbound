import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import PoliciesListPanel from './PoliciesListPanel';
import { resetEntityCache } from '../../cache/entityCache';
import type { OktaPolicyListItem, OktaPolicyRule } from '../../../shared/schemas/okta';

/** Obviously-fake app authentication policies. */
const samplePolicies = [
  {
    id: 'rstFAKE000000000001',
    name: 'Any two factors',
    status: 'ACTIVE',
    type: 'ACCESS_POLICY',
    priority: 1,
    description: 'Requires two factors for high-risk applications',
  },
  {
    id: 'rstFAKE000000000002',
    name: 'Contractor sign-on',
    status: 'INACTIVE',
    type: 'ACCESS_POLICY',
    priority: 2,
    description: 'Device-bound access for external contractors',
  },
  {
    id: 'rstFAKE000000000003',
    name: 'Default Policy',
    status: 'ACTIVE',
    type: 'ACCESS_POLICY',
    priority: 3,
    system: true,
  },
] as OktaPolicyListItem[];

const sampleRules = [
  {
    id: '0prFAKE000000000001',
    name: 'Catch-all Rule',
    status: 'ACTIVE',
    priority: 1,
    system: true,
  },
] as OktaPolicyRule[];

/** The Auth Policies tab's list region: loading, empty, and populated states. */
const meta = {
  title: 'Policies/PoliciesListPanel',
  component: PoliciesListPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The Auth Policies tab's list region.\n\n" +
          'Wraps a scrollable list of policy cards and picks the right empty state: "nothing ' +
          'loaded" — which also carries the admin-role caveat, since a `403` on the policies ' +
          'endpoint is indistinguishable from an org with no policies — versus "nothing matches ' +
          'the search".',
      },
    },
  },
  argTypes: {
    isLoading: { description: 'Whether a policy load is in flight.' },
    policies: { description: 'Policies after the search filter — what actually renders.' },
    hasPolicies: { description: 'Whether any policies are loaded (picks the empty state).' },
    onLoad: { description: "Load the policy list (the empty state's action)." },
    loadRules: { description: "Fetches a policy's rules for the expanded card." },
  },
  args: {
    isLoading: false,
    policies: samplePolicies,
    hasPolicies: true,
    onLoad: fn(),
    loadRules: fn(async () => sampleRules),
  },
  beforeEach: () => {
    resetEntityCache();
  },
} satisfies Meta<typeof PoliciesListPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three policies. */
export const Default: Story = {};

/** The load is in flight. */
export const Loading: Story = {
  args: { isLoading: true, policies: [], hasPolicies: false },
};

/** Nothing came back — the empty state naming the admin-role caveat. */
export const NoPolicies: Story = {
  args: { policies: [], hasPolicies: false },
};

/** Policies are loaded but the search matches none of them. */
export const NoSearchMatches: Story = {
  args: { policies: [], hasPolicies: true },
};
