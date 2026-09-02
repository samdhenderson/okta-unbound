/**
 * Regression test for the `appAssignmentCounts` entity-cache key collision.
 *
 * Two screens used to cache an app's assignment data under one key while
 * writing **two different shapes** into it: the Applications-tab row stored
 * `{ users, groups }` and the detected-app Overview stored
 * `{ counts, accessPolicyId }`. Because every tab stays mounted (ADR-0018) both
 * could be live at once against the same module-level `entityCache` singleton,
 * so whichever populated first corrupted the other's read — and in the
 * Overview→row direction that meant `data.users` was `undefined` and the row
 * crashed on `undefined.toLocaleString()`.
 *
 * The Overview tab is gone, so this is now a **single-consumer** test, reduced
 * from the two-order version deliberately rather than deleted (ADR-0022). What
 * it keeps is the part a second consumer would break: the *shape* stored under
 * the key, asserted against the cache itself. A future screen writing a wrapper
 * object into this entry fails here rather than in whatever component reads it
 * second.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({
  getAppAssignmentCounts: vi.fn(async () => null as unknown),
  isLoading: false,
}));

vi.mock('../hooks/useOktaApi', () => ({ useOktaApi: () => api }));
vi.mock('../../sidepanel/hooks/useOktaApi', () => ({ useOktaApi: () => api }));

import AppListItem from '../components/apps/AppListItem';
import { peek, resetEntityCache } from './entityCache';
import { cacheKeys } from './keys';
import type { AppAssignmentCounts } from '../hooks/useOktaApi/appOperations';

const APP_ID = '0oaFAKE000000000001';
const COUNTS = { users: 1284, groups: 12 };

beforeEach(() => {
  vi.clearAllMocks();
  resetEntityCache();
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

describe('the shared app assignment-counts cache entry', () => {
  it('holds the counts themselves, not a wrapper around them', async () => {
    const { unmount } = await renderExpandedRow();
    await waitFor(() => expect(rowCountBadge().length).toBeGreaterThan(0));
    // The collision was a *shape* disagreement, so the shape is what is pinned.
    // A second consumer storing `{ counts, accessPolicyId }` here again fails
    // this line rather than crashing whichever screen reads the entry second.
    expect(peek(cacheKeys.appAssignmentCounts(APP_ID))).toEqual(COUNTS);
    unmount();
  });

  it('fetches once, then serves the entry warm', async () => {
    const first = await renderExpandedRow();
    await waitFor(() => expect(rowCountBadge().length).toBeGreaterThan(0));
    first.unmount();

    const second = await renderExpandedRow();
    await waitFor(() => expect(rowCountBadge().length).toBeGreaterThan(0));
    expect(api.getAppAssignmentCounts).toHaveBeenCalledTimes(1);
    second.unmount();
  });
});
