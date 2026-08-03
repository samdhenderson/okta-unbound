/**
 * Unit tests for the READ-ONLY Applications tab.
 *
 * The `useOktaApi` facade is mocked (as `overview/GroupOverview.test.tsx` does) so
 * these assertions target AppsTab's own orchestration — the auto-load, the search
 * and status filtering, the error banner, and the two empty states — rather than
 * the scheduler transport, which `useOktaApi/appOperations.test.ts` already covers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppsTab from './AppsTab';
import type { OktaAppListItem } from '../../shared/schemas/okta';

const api = vi.hoisted(() => ({
  getAllApps: vi.fn(),
  getAppAssignmentCounts: vi.fn(),
  isLoading: false,
}));

vi.mock('../hooks/useOktaApi', () => ({
  useOktaApi: () => api,
}));

const SAMPLE_APPS: OktaAppListItem[] = [
  {
    id: '0oaFAKE0001',
    name: 'salesforce',
    label: 'Salesforce',
    status: 'ACTIVE',
    signOnMode: 'SAML_2_0',
    created: '2026-01-15T00:00:00.000Z',
  },
  {
    id: '0oaFAKE0002',
    name: 'workday',
    label: 'Workday HR',
    status: 'INACTIVE',
    signOnMode: 'SAML_2_0',
    created: '2026-03-01T00:00:00.000Z',
  },
] as OktaAppListItem[];

beforeEach(() => {
  vi.clearAllMocks();
  api.getAllApps.mockResolvedValue(SAMPLE_APPS);
  api.getAppAssignmentCounts.mockResolvedValue({ users: 12, groups: 3 });
});

/** Resolve a never-settling promise on demand, to observe the loading state. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('AppsTab', () => {
  it('shows the loading state, then renders the loaded apps', async () => {
    const gate = deferred<OktaAppListItem[]>();
    api.getAllApps.mockReturnValue(gate.promise);

    render(<AppsTab targetTabId={1} oktaOrigin="https://example.okta.com" />);

    expect(await screen.findByText('Loading applications from Okta...')).toBeInTheDocument();

    gate.resolve(SAMPLE_APPS);

    expect(await screen.findByText('Salesforce')).toBeInTheDocument();
    expect(screen.getByText('Workday HR')).toBeInTheDocument();
    expect(api.getAllApps).toHaveBeenCalledTimes(1);
  });

  it('filters the list by the search query', async () => {
    const user = userEvent.setup();
    render(<AppsTab targetTabId={1} />);

    expect(await screen.findByText('Salesforce')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search applications'), 'workday');

    await waitFor(() => expect(screen.queryByText('Salesforce')).not.toBeInTheDocument());
    expect(screen.getByText('Workday HR')).toBeInTheDocument();
  });

  it('filters the list by the status bucket', async () => {
    const user = userEvent.setup();
    render(<AppsTab targetTabId={1} />);

    expect(await screen.findByText('Salesforce')).toBeInTheDocument();

    const statusGroup = screen.getByRole('group', { name: 'Filter by status' });
    await user.click(within(statusGroup).getByRole('button', { name: 'Inactive' }));

    await waitFor(() => expect(screen.queryByText('Salesforce')).not.toBeInTheDocument());
    expect(screen.getByText('Workday HR')).toBeInTheDocument();
  });

  it('shows the no-matches empty state and clears the filters', async () => {
    const user = userEvent.setup();
    render(<AppsTab targetTabId={1} />);

    expect(await screen.findByText('Salesforce')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search applications'), 'nothing-matches-this');

    expect(await screen.findByText('No applications match your filters')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Salesforce')).toBeInTheDocument();
  });

  it('shows the nothing-loaded empty state for an org with no apps', async () => {
    api.getAllApps.mockResolvedValue([]);

    render(<AppsTab targetTabId={1} />);

    expect(await screen.findByText('No applications loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load applications' })).toBeInTheDocument();
  });

  it('banners a load failure as a dismissible danger alert', async () => {
    const user = userEvent.setup();
    api.getAllApps.mockRejectedValue(new Error('Failed to fetch apps'));

    render(<AppsTab targetTabId={1} />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Failed to fetch apps')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('does not load when no Okta tab is connected', async () => {
    render(<AppsTab targetTabId={null} />);

    expect(await screen.findByText('No applications loaded')).toBeInTheDocument();
    expect(api.getAllApps).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Refresh/ })).toBeDisabled();
  });

  it('defers the auto-load while the tab is mounted but not the visible one', async () => {
    // App keeps every visited tab mounted and hides the inactive ones. Paging the
    // whole app inventory from a tab nobody is looking at is exactly the
    // background traffic that must not happen.
    const { rerender } = render(<AppsTab targetTabId={1} isActive={false} />);

    await waitFor(() => expect(api.getAllApps).not.toHaveBeenCalled());

    rerender(<AppsTab targetTabId={1} isActive />);
    expect(await screen.findByText('Salesforce')).toBeInTheDocument();
    expect(api.getAllApps).toHaveBeenCalledTimes(1);
  });
});
