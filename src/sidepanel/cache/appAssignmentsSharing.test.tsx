/**
 * Regression test for the `['appAssignments', appId]` entity-cache key collision.
 *
 * The Applications tab's expanded row and the detected-app Overview both cache an
 * app's assignment data, and — because every tab stays mounted (ADR-0018) — both can
 * be live at once against the same module-level `entityCache` singleton. They used to
 * write **two different shapes under one key**: the row stored
 * `{ users, groups }` while the Overview stored `{ counts, accessPolicyId }`.
 * Whichever populated first corrupted the other's read, and in the Overview→row
 * direction that meant `data.users` was `undefined` and the row crashed on
 * `undefined.toLocaleString()`.
 *
 * Both now share one key holding one shape, so the entry is not just safe but
 * genuinely warm: whichever screen the user reaches first spares the other a request.
 * These tests drive the two consumers in both orders against a single cache.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({
  getAppById: vi.fn(async () => null as unknown),
  getAppAssignmentCounts: vi.fn(async () => null as unknown),
  isLoading: false,
}));

vi.mock('../hooks/useOktaApi', () => ({ useOktaApi: () => api }));
vi.mock('../../sidepanel/hooks/useOktaApi', () => ({ useOktaApi: () => api }));

import AppOverview from '../components/overview/AppOverview';
import AppListItem from '../components/apps/AppListItem';
import { resetEntityCache } from './entityCache';
import type { AppAssignmentCounts } from '../hooks/useOktaApi/appOperations';

const APP_ID = '0oaFAKE000000000001';
const COUNTS = { users: 1284, groups: 12 };

beforeEach(() => {
  vi.clearAllMocks();
  resetEntityCache();
  api.getAppById.mockResolvedValue({ id: APP_ID, label: 'Payroll', status: 'ACTIVE' });
  api.getAppAssignmentCounts.mockResolvedValue(COUNTS);
});

/** The Applications-tab row, expanded so its lazy counts read fires. */
async function renderExpandedRow() {
  const view = render(
    <AppListItem
      app={{ id: APP_ID, label: 'Payroll', status: 'ACTIVE', signOnMode: 'SAML_2_0' }}
      fetchAssignmentCounts={
        api.getAppAssignmentCounts as unknown as (id: string) => Promise<AppAssignmentCounts | null>
      }
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Expand' }));
  return view;
}

/** The row renders "1,284 users" as sibling text nodes inside one badge span. */
const rowCountBadge = () =>
  screen.getAllByText((_content, el) => el?.textContent === '1,284 users' && el.tagName === 'SPAN');

describe('app assignment counts shared between the Overview and the Apps tab', () => {
  it('renders the row counts when the Overview populated the cache first', async () => {
    render(<AppOverview appId={APP_ID} appName="Payroll" targetTabId={1} onExport={vi.fn()} />);
    await screen.findByText('1,284');

    // Previously the Overview left `{ counts, accessPolicyId }` under this key, so the
    // row read `data.users === undefined` and threw on `.toLocaleString()`.
    const { unmount } = await renderExpandedRow();
    await waitFor(() => expect(rowCountBadge().length).toBeGreaterThan(0));
    unmount();
  });

  it('renders the Overview counts when the Apps tab populated the cache first', async () => {
    const { unmount } = await renderExpandedRow();
    await waitFor(() => expect(rowCountBadge().length).toBeGreaterThan(0));
    unmount();

    render(<AppOverview appId={APP_ID} appName="Payroll" targetTabId={1} onExport={vi.fn()} />);
    expect(await screen.findByText('1,284')).toBeInTheDocument();
  });

  it('fetches the counts once across both consumers', async () => {
    render(<AppOverview appId={APP_ID} appName="Payroll" targetTabId={1} onExport={vi.fn()} />);
    await screen.findByText('1,284');
    const afterOverview = api.getAppAssignmentCounts.mock.calls.length;

    const { unmount } = await renderExpandedRow();
    await waitFor(() => expect(rowCountBadge().length).toBeGreaterThan(0));
    unmount();

    // One shared entry, one walk of `/apps/{id}/users` + `/apps/{id}/groups`.
    expect(api.getAppAssignmentCounts).toHaveBeenCalledTimes(afterOverview);
  });

  it('issues one GET /api/v1/apps/{id} per app overview', async () => {
    render(<AppOverview appId={APP_ID} appName="Payroll" targetTabId={1} onExport={vi.fn()} />);
    await screen.findByText('1,284');

    // The access-policy id is derived from this record's `_links`, not re-fetched.
    expect(api.getAppById).toHaveBeenCalledTimes(1);
  });
});
