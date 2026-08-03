import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import AuthPoliciesTab from './AuthPoliciesTab';
import { useOktaApi, makeUseOktaApiValue } from '../../../.storybook/mocks/useOktaApi.mock';
import { resetEntityCache } from '../cache/entityCache';
import type { OktaPolicyListItem, OktaPolicyRule } from '../../shared/schemas/okta';

/** A small, obviously-fake set of app authentication policies. */
const samplePolicies = [
  {
    id: 'rstFAKE000000000001',
    name: 'Any two factors',
    status: 'ACTIVE',
    type: 'ACCESS_POLICY',
    priority: 1,
    description: 'Requires two factors for high-risk applications',
    system: false,
    created: '2026-01-15T09:00:00.000Z',
    lastUpdated: '2026-06-02T11:30:00.000Z',
  },
  {
    id: 'rstFAKE000000000002',
    name: 'Contractor sign-on',
    status: 'INACTIVE',
    type: 'ACCESS_POLICY',
    priority: 2,
    description: 'Device-bound access for external contractors',
    system: false,
    created: '2026-02-01T09:00:00.000Z',
  },
  {
    id: 'rstFAKE000000000003',
    name: 'Default Policy',
    status: 'ACTIVE',
    type: 'ACCESS_POLICY',
    priority: 3,
    description: 'Catch-all policy applied to apps with no explicit policy',
    system: true,
  },
] as OktaPolicyListItem[];

/** Rules returned for whichever policy the reader expands. */
const sampleRules = [
  {
    id: '0prFAKE000000000001',
    name: 'Trusted device, no prompt',
    status: 'ACTIVE',
    priority: 1,
  },
  { id: '0prFAKE000000000002', name: 'Off-network step-up', status: 'ACTIVE', priority: 2 },
  {
    id: '0prFAKE000000000003',
    name: 'Catch-all Rule',
    status: 'ACTIVE',
    priority: 3,
    system: true,
  },
] as OktaPolicyRule[];

/**
 * Auth Policies tab shell: a READ-ONLY browser for the org's app authentication
 * (sign-on) policies, loaded on arrival and filtered client-side.
 */
const meta = {
  title: 'Policies/AuthPoliciesTab',
  component: AuthPoliciesTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // heading-order disabled: this story renders the tab as a page fragment out of
    // its heading context (no surrounding app shell), so axe flags the isolated headings.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          "Auth Policies tab shell: browse and search the org's app authentication policies.\n\n" +
          'Read-only by construction — the tab reaches only for `listPolicies` and (lazily, per ' +
          "expanded card) `getPolicyRules`, and renders no mutation affordance. Because Okta's " +
          'policy endpoints are commonly forbidden for non-super-admins, a `403` is ' +
          'indistinguishable from an empty org: the empty state says so explicitly.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Storage & cache](?path=/docs/internals-storage-cache--docs), ' +
          '[Scheduler & messaging](?path=/docs/internals-scheduler-messaging--docs)',
      },
    },
  },
  argTypes: {
    targetTabId: {
      description: 'Chrome tab id of the connected Okta tab; the load is skipped when absent.',
    },
    oktaOrigin: {
      description: 'Okta org origin of the connected tab (reserved for future deep links).',
    },
  },
  args: {
    targetTabId: 1,
    oktaOrigin: 'https://example.okta.com',
  },
  beforeEach: () => {
    // The policy list and each policy's rules live in the module-level entity
    // cache, which outlives a single story — clear it so each variant fetches.
    resetEntityCache();
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        listPolicies: fn(async () => samplePolicies),
        getPolicyRules: fn(async () => sampleRules),
      }),
    );
  },
} satisfies Meta<typeof AuthPoliciesTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three policies loaded — the populated list with its search box. */
export const Default: Story = {};

/** The policy load is still in flight — full-panel spinner. */
export const Loading: Story = {
  beforeEach: () => {
    resetEntityCache();
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        listPolicies: fn(() => new Promise<OktaPolicyListItem[]>(() => {})),
      }),
    );
  },
};

/**
 * No policies came back. Indistinguishable from a `403` for an admin role without
 * policy read access, so the empty state names both possibilities.
 */
export const Empty: Story = {
  beforeEach: () => {
    resetEntityCache();
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({ listPolicies: fn(async () => [] as OktaPolicyListItem[]) }),
    );
  },
};

/** The policy load failed — dismissible `danger` banner above the empty list. */
export const ErrorState: Story = {
  beforeEach: () => {
    resetEntityCache();
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        listPolicies: fn(async () => {
          throw new Error('Failed to fetch auth policies');
        }),
      }),
    );
  },
};

/** A policy expanded to reveal its lazily-fetched rules. */
export const ExpandedRules: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('button', { name: 'Show rules for Any two factors' });
    await userEvent.click(toggle);
    await waitFor(() => expect(canvas.getByText('Trusted device, no prompt')).toBeInTheDocument());
  },
};

/** A policy whose rules fail to load — the inline per-policy `danger` state on expand. */
export const RulesLoadFailure: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('button', { name: 'Show rules for Any two factors' });
    await userEvent.click(toggle);
    await waitFor(() => expect(canvas.getByText(/Could not load rules/)).toBeInTheDocument());
  },
  beforeEach: () => {
    resetEntityCache();
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        listPolicies: fn(async () => samplePolicies),
        getPolicyRules: fn(async () => {
          throw new Error('Policy rules unavailable');
        }),
      }),
    );
  },
};

/** No Okta tab connected — nothing is fetched; the header offers "Load Policies". */
export const Disconnected: Story = {
  args: { targetTabId: undefined },
};
