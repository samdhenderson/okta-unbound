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
import { describe, it, expect, vi } from 'vitest';
import type { ApiScheduler } from '../shared/scheduler/apiScheduler';
import { createSchedulerPageRequest } from './snapshotBridge';

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
