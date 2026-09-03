/**
 * @module background/snapshotBridge.test
 * @description Unit tests for the scheduler-backed {@link createSchedulerPageRequest}
 * transport, focused on what a walk's page result carries.
 *
 * The header bag is the subject: D-087 narrowed the content script to an
 * allow-list of the five keys with named consumers, and left this bridge relaying
 * that bag on **both** arms. Nothing in `snapshotSync` reads the failure arm's
 * headers yet, so without a pin the relay looks like an accident and the next
 * reader deletes it. These cases say it is a decision.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ApiScheduler } from '../shared/scheduler/apiScheduler';
import { createSchedulerPageRequest, syncSnapshot } from './snapshotBridge';
import { ensureRateLimitThreshold } from './rateLimitThreshold';
import { syncOrg } from '../shared/snapshot/snapshotSync';

vi.mock('./rateLimitThreshold', () => ({ ensureRateLimitThreshold: vi.fn() }));
vi.mock('../shared/snapshot/snapshotSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shared/snapshot/snapshotSync')>()),
  syncOrg: vi.fn().mockResolvedValue([]),
}));

const TAB_ID = 7;
const URL = '/api/v1/groups?limit=200';
const REASON = 'Org inventory sync: groups';

/** An `ApiScheduler` double whose only job is to answer one `scheduleRequest`. */
function schedulerReturning(result: unknown): ApiScheduler {
  return { scheduleRequest: vi.fn().mockResolvedValue(result) } as unknown as ApiScheduler;
}

describe('createSchedulerPageRequest', () => {
  it('routes through the scheduler at low priority with the caller’s reason', async () => {
    const scheduler = schedulerReturning({ success: true, data: [], headers: {} });

    await createSchedulerPageRequest(scheduler, TAB_ID)(URL, REASON);

    expect(scheduler.scheduleRequest).toHaveBeenCalledWith(
      URL,
      'GET',
      undefined,
      TAB_ID,
      'low',
      REASON,
    );
  });

  it('relays the success arm’s headers, which the drift check reads', async () => {
    const scheduler = schedulerReturning({
      success: true,
      data: [{ id: '00gFAKE1' }],
      headers: { 'x-total-count': '9814' },
    });

    await expect(createSchedulerPageRequest(scheduler, TAB_ID)(URL, REASON)).resolves.toEqual({
      success: true,
      data: [{ id: '00gFAKE1' }],
      headers: { 'x-total-count': '9814' },
    });
  });

  it('relays the failure arm’s headers too, so a 429’s reset survives the hop (D-087)', async () => {
    const scheduler = schedulerReturning({
      success: false,
      error: 'Too many requests',
      data: { errorSummary: 'Too many requests' },
      headers: { 'x-rate-limit-remaining': '0', 'x-rate-limit-reset': '1700000000' },
    });

    await expect(createSchedulerPageRequest(scheduler, TAB_ID)(URL, REASON)).resolves.toEqual({
      success: false,
      error: 'Too many requests',
      data: { errorSummary: 'Too many requests' },
      headers: { 'x-rate-limit-remaining': '0', 'x-rate-limit-reset': '1700000000' },
    });
  });

  it('turns a rejected schedule into a failure result rather than throwing', async () => {
    const scheduler = {
      scheduleRequest: vi.fn().mockRejectedValue(new Error('port closed')),
    } as unknown as ApiScheduler;

    await expect(createSchedulerPageRequest(scheduler, TAB_ID)(URL, REASON)).resolves.toEqual({
      success: false,
      error: 'port closed',
    });
  });
});

/**
 * The org's rate-limit warning threshold has to be armed on the path a snapshot
 * actually takes, and `syncSnapshot` is the only place that is true of.
 *
 * The gap this pins was real and invisible: `ensureRateLimitThreshold` was called
 * at the `syncSnapshot` **message** handler in `background/index.ts`, which covers
 * exactly one of the three routes into this function. `snapshotScheduler` imports
 * `syncSnapshot` directly and drives the other two — a tab-settle debounce and the
 * periodic `chrome.alarms` handler — so the largest fan-out the extension issues
 * ran on the hardcoded 10% default whenever no side panel was open to arm the
 * probe. On a CIAM org, whose default warning threshold is 60 rather than 90,
 * that is the difference between backing off at 45% remaining and at 10%.
 *
 * The probe is what keeps this extension from being the traffic that trips the
 * org's own alarm and emails every super admin, so the assertion is that it is
 * armed on the shared choke point rather than at any one caller (ADR-0059 §3).
 */
describe('syncSnapshot arms the org threshold probe', () => {
  const ORIGIN = 'https://example.okta.com';

  beforeEach(() => {
    vi.mocked(ensureRateLimitThreshold).mockClear();
    vi.mocked(syncOrg).mockClear().mockResolvedValue([]);
    (chrome.tabs.get as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockResolvedValue({ id: TAB_ID, url: `${ORIGIN}/admin/groups` });
  });

  it('arms the probe on the path every trigger route shares, not just the message one', async () => {
    const scheduler = schedulerReturning({ success: true, data: [], headers: {} });

    await syncSnapshot(scheduler, ORIGIN, TAB_ID, Date.now(), true);

    expect(ensureRateLimitThreshold).toHaveBeenCalledWith(scheduler, TAB_ID);
  });

  it('does not arm it for a tab that has navigated off the org', async () => {
    // No walk happens, so there is no traffic to protect — and the tab is no
    // longer evidence of which org we would be asking (`docs/security.md` §6).
    (chrome.tabs.get as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockResolvedValue({ id: TAB_ID, url: 'https://elsewhere.example.com/' });
    const scheduler = schedulerReturning({ success: true, data: [], headers: {} });

    await expect(syncSnapshot(scheduler, ORIGIN, TAB_ID, Date.now(), true)).rejects.toThrow();
    expect(ensureRateLimitThreshold).not.toHaveBeenCalled();
  });
});
