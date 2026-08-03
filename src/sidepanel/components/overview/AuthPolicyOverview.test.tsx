/**
 * @module sidepanel/components/overview/AuthPolicyOverview.test
 * @description Tests the detected-policy Overview branch: identity + status render,
 * the policy's rules load read-only in priority order, and the loading / empty /
 * error states behave. Also pins the deliberate absence of an "open in Okta" link
 * (no validated admin-URL helper exists for policies yet).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// One stable api object, mirroring the memoized real facade (see GroupOverview.test).
const api = vi.hoisted(() => ({
  getPolicyRules: vi.fn(async () => [] as unknown[]),
  isLoading: false,
}));

vi.mock('../../hooks/useOktaApi', () => ({
  useOktaApi: () => api,
}));

import AuthPolicyOverview from './AuthPolicyOverview';

const POLICY_ID = 'rstFAKE0123456789abc';

const baseProps = {
  policyId: POLICY_ID,
  policyName: 'Contractor MFA',
  targetTabId: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getPolicyRules.mockResolvedValue([]);
});

describe('AuthPolicyOverview', () => {
  it('renders the policy identity and status, and reads its rules once', async () => {
    api.getPolicyRules.mockResolvedValue([
      { id: 'r1', name: 'Deny legacy clients', status: 'ACTIVE', priority: 1 },
    ]);

    render(<AuthPolicyOverview {...baseProps} policyStatus="ACTIVE" />);

    expect(screen.getByText('Contractor MFA')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(await screen.findByText('Deny legacy clients')).toBeInTheDocument();
    expect(api.getPolicyRules).toHaveBeenCalledWith(POLICY_ID);
    expect(api.getPolicyRules).toHaveBeenCalledTimes(1);
  });

  it('falls back to a generic heading when no policy name was detected', async () => {
    render(<AuthPolicyOverview {...baseProps} policyId="rstFAKE0123456789xyz" policyName={null} />);

    expect(screen.getByText('Authentication policy')).toBeInTheDocument();
  });

  it('lists rules in priority order with their status, unprioritized last', async () => {
    api.getPolicyRules.mockResolvedValue([
      { id: 'r3', name: 'Catch all', status: 'INACTIVE' },
      { id: 'r2', name: 'Require MFA', status: 'ACTIVE', priority: 2 },
      { id: 'r1', name: 'Allow trusted network', status: 'ACTIVE', priority: 1 },
    ]);

    render(<AuthPolicyOverview {...baseProps} policyId="rstFAKE0123456789ord" />);

    await screen.findByText('Allow trusted network');
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names[0]).toContain('Allow trusted network');
    expect(names[1]).toContain('Require MFA');
    expect(names[2]).toContain('Catch all');
    expect(names[0]).toContain('Priority 1');
    expect(names[2]).toContain('No priority');
  });

  it('summarizes the rule counts (total and active)', async () => {
    api.getPolicyRules.mockResolvedValue([
      { id: 'r1', name: 'One', status: 'ACTIVE', priority: 1 },
      { id: 'r2', name: 'Two', status: 'INACTIVE', priority: 2 },
      { id: 'r3', name: 'Three', status: 'ACTIVE', priority: 3 },
    ]);

    render(<AuthPolicyOverview {...baseProps} policyId="rstFAKE0123456789cnt" />);

    await screen.findByText('One');
    // Total Rules = 3, Active Rules = 2.
    expect(screen.getByText('Total Rules').closest('div')?.textContent).toContain('3');
    expect(screen.getByText('Active Rules').closest('div')?.textContent).toContain('2');
  });

  it('falls back to the rule id when a rule has no name', async () => {
    api.getPolicyRules.mockResolvedValue([{ id: 'ruleWithNoName', status: 'ACTIVE', priority: 1 }]);

    render(<AuthPolicyOverview {...baseProps} policyId="rstFAKE0123456789nid" />);

    expect(await screen.findByText('ruleWithNoName')).toBeInTheDocument();
  });

  it('shows an empty message when the policy has no rules', async () => {
    render(<AuthPolicyOverview {...baseProps} policyId="rstFAKE0123456789emp" />);

    expect(await screen.findByText('No rules found for this policy')).toBeInTheDocument();
  });

  it('shows a spinner while the rules are loading', () => {
    api.getPolicyRules.mockImplementation(() => new Promise(() => {}));

    render(<AuthPolicyOverview {...baseProps} policyId="rstFAKE0123456789ldg" />);

    expect(screen.getByText('Loading policy rules...')).toBeInTheDocument();
  });

  it('surfaces a retryable danger alert when the rules read throws', async () => {
    api.getPolicyRules.mockRejectedValue(new Error('Policy read forbidden'));

    render(<AuthPolicyOverview {...baseProps} policyId="rstFAKE0123456789err" />);

    expect(await screen.findByText('Policy read forbidden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // Identity still renders — the failure is scoped to the rules panel.
    expect(screen.getByText('Contractor MFA')).toBeInTheDocument();
  });

  it('renders no external Okta link (no validated policy admin-URL helper yet)', async () => {
    render(<AuthPolicyOverview {...baseProps} policyId="rstFAKE0123456789lnk" />);

    await screen.findByText('No rules found for this policy');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
