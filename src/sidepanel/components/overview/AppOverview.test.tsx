/**
 * @module sidepanel/components/overview/AppOverview.test
 * @description Tests the detected-app Overview branch: its export deep-links route
 * to the correct app-scoped descriptors, and the enrichment reads (status, sign-on
 * mode, assignment counts, app-specific auth policy) render — degrading to an em
 * dash rather than an error state when a read is unavailable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// One stable api object, mirroring the memoized real facade (see GroupOverview.test).
const api = vi.hoisted(() => ({
  getAppById: vi.fn(async () => null as unknown),
  getAppAssignmentCounts: vi.fn(async () => null as unknown),
  getAppAccessPolicyId: vi.fn(async () => null as unknown),
  isLoading: false,
}));

vi.mock('../../hooks/useOktaApi', () => ({
  useOktaApi: () => api,
}));

import AppOverview from './AppOverview';

beforeEach(() => {
  vi.clearAllMocks();
  api.getAppById.mockResolvedValue(null);
  api.getAppAssignmentCounts.mockResolvedValue(null);
  api.getAppAccessPolicyId.mockResolvedValue(null);
});

describe('AppOverview', () => {
  it('deep-links each export to its app-scoped descriptor with the app as context', async () => {
    const onExport = vi.fn();
    render(<AppOverview appId="0oaABC" appName="Salesforce" onExport={onExport} />);

    expect(screen.getByText('Salesforce')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Export App Users' }));
    expect(onExport).toHaveBeenCalledWith('app-users', '0oaABC', 'Salesforce');

    await userEvent.click(screen.getByRole('button', { name: 'Export App Groups' }));
    expect(onExport).toHaveBeenCalledWith('app-groups', '0oaABC', 'Salesforce');
  });

  it('issues no enrichment reads without a target tab', async () => {
    render(<AppOverview appId="0oaNOTAB" appName="Salesforce" onExport={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Salesforce')).toBeInTheDocument());
    expect(api.getAppById).not.toHaveBeenCalled();
    expect(api.getAppAssignmentCounts).not.toHaveBeenCalled();
    expect(api.getAppAccessPolicyId).not.toHaveBeenCalled();
  });

  it('renders status, sign-on mode and the assignment counts', async () => {
    api.getAppById.mockResolvedValue({
      id: '0oaENRICH',
      label: 'Salesforce',
      status: 'ACTIVE',
      signOnMode: 'SAML_2_0',
    });
    api.getAppAssignmentCounts.mockResolvedValue({ users: 42, groups: 7 });

    render(
      <AppOverview appId="0oaENRICH" appName="Salesforce" targetTabId={1} onExport={vi.fn()} />,
    );

    expect(await screen.findByText('ACTIVE')).toBeInTheDocument();
    expect(await screen.findByText('SAML_2_0')).toBeInTheDocument();
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(api.getAppById).toHaveBeenCalledWith('0oaENRICH');
    expect(api.getAppAssignmentCounts).toHaveBeenCalledWith('0oaENRICH');
  });

  it('notes an app-specific authentication policy without linking to it', async () => {
    api.getAppAccessPolicyId.mockResolvedValue('rstFAKE0123456789abc');

    render(
      <AppOverview appId="0oaPOLICY" appName="Salesforce" targetTabId={1} onExport={vi.fn()} />,
    );

    expect(await screen.findByText('Has app-specific authentication policy')).toBeInTheDocument();
    // Policies have no validated admin-URL helper yet — deliberately no link.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('omits the policy note when the app has no access policy', async () => {
    api.getAppAssignmentCounts.mockResolvedValue({ users: 1, groups: 0 });

    render(
      <AppOverview appId="0oaNOPOL" appName="Salesforce" targetTabId={1} onExport={vi.fn()} />,
    );

    await screen.findByText('1');
    expect(screen.queryByText('Has app-specific authentication policy')).not.toBeInTheDocument();
  });

  it('degrades to em dashes (not an error state) when the enrichment reads fail', async () => {
    render(<AppOverview appId="0oaFAIL" appName="Salesforce" targetTabId={1} onExport={vi.fn()} />);

    await waitFor(() => expect(api.getAppAssignmentCounts).toHaveBeenCalled());
    // Identity + exports survive; the two count cards show the em dash.
    expect(screen.getByText('Salesforce')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export App Users' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2));
  });
});
