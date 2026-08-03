import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import AuthPolicyOverview from './AuthPolicyOverview';
import { useOktaApi, makeUseOktaApiValue } from '../../../../.storybook/mocks/useOktaApi.mock';

/** Fixture rules for a typical app authentication policy (obviously fake ids). */
const sampleRules = [
  { id: 'rulFAKE001', name: 'Allow trusted network', status: 'ACTIVE', priority: 1 },
  { id: 'rulFAKE002', name: 'Require MFA off-network', status: 'ACTIVE', priority: 2 },
  { id: 'rulFAKE003', name: 'Legacy client catch-all', status: 'INACTIVE', priority: 3 },
];

/** Build a `useOktaApi` mock whose `getPolicyRules` resolves to `rules`. */
const withRules = (rules: unknown[]) =>
  makeUseOktaApiValue({ getPolicyRules: fn(async () => rules) });

/**
 * Overview branch for a detected Okta authentication/access policy page: identity,
 * status, and a read-only summary of the policy's rules (count, name, priority,
 * status). Strictly read-only — and deliberately without an "open in Okta" link,
 * since there is no validated admin-URL helper for policies yet.
 */
const meta = {
  title: 'Overview/AuthPolicyOverview',
  component: AuthPolicyOverview,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: {
    policyId: { description: 'Detected Okta policy id.' },
    policyName: { description: 'Detected display name; null when none was resolved.' },
    policyStatus: { description: 'Lifecycle status, when page detection resolved one.' },
    targetTabId: { description: 'Tab hosting the Okta session; every call is routed to it.' },
  },
  args: {
    policyId: 'rstFAKE0123456789abc',
    policyName: 'Contractor MFA',
    policyStatus: 'ACTIVE',
    targetTabId: 1,
  },
  beforeEach: () => {
    useOktaApi.mockReturnValue(withRules(sampleRules));
  },
} satisfies Meta<typeof AuthPolicyOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A policy with three rules, listed in priority order. */
export const Default: Story = {};

/** Page detection resolved no name — the generic heading stands in. */
export const UnnamedPolicy: Story = {
  args: { policyId: 'rstFAKE0123456789unn', policyName: null, policyStatus: undefined },
};

/** A policy with no rules yet. */
export const NoRules: Story = {
  args: { policyId: 'rstFAKE0123456789emp' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(withRules([]));
  },
};

/** Rules still loading — the panel shows its spinner. */
export const Loading: Story = {
  args: { policyId: 'rstFAKE0123456789ldg' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({ getPolicyRules: fn(() => new Promise(() => {})) }),
    );
  },
};

/** The rules read failed (commonly a forbidden policy endpoint) — retryable alert. */
export const RulesUnavailable: Story = {
  args: { policyId: 'rstFAKE0123456789err' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        getPolicyRules: fn(async () => {
          throw new Error('You do not have permission to read this policy.');
        }),
      }),
    );
  },
};
