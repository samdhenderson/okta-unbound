/**
 * @module shared/snapshot/syncMeta.test
 * @description Unit tests for ADR-0040's freshness decisions.
 *
 * These are the rules that decide whether a snapshot may be trusted, so they are
 * tested without a database or a network. Three of them encode a distinction the
 * ADR is explicit about and which a plausible implementation collapses:
 * "not probed" is not "unsupported", a missing `x-total-count` is not agreement,
 * and an incomplete walk is not a snapshot to top up with a delta.
 */
import { describe, it, expect } from 'vitest';
import {
  DRIFT_CHECK_INTERVAL_MS,
  advanceWatermark,
  driftVerdict,
  emptySyncMeta,
  nextSyncMode,
  readTotalCount,
} from './syncMeta';
import type { SyncMeta } from './types';

const ORIGIN = 'https://example.okta.com';

/** A complete, freshly full-walked snapshot — the baseline the cases vary from. */
function complete(now: number, overrides: Partial<SyncMeta> = {}): SyncMeta {
  return {
    ...emptySyncMeta(ORIGIN, 'groups'),
    complete: true,
    lastFullWalkAt: now,
    watermark: '2026-08-24T09:00:00.000Z',
    itemCount: 1000,
    ...overrides,
  };
}

describe('emptySyncMeta', () => {
  it('starts every unknown as null, never as a zero or a false verdict', () => {
    const meta = emptySyncMeta(ORIGIN, 'groups');
    // `deltaSupported: null` is "not probed"; `false` would mean "probed and this
    // org does not honour the filter" and would wrongly force a permanent full walk.
    expect(meta.deltaSupported).toBeNull();
    // `itemCount: null` is "Okta has not told us"; `0` would claim an empty org.
    expect(meta.itemCount).toBeNull();
    expect(meta.watermark).toBeNull();
    expect(meta.cursor).toBeNull();
    expect(meta.complete).toBe(false);
  });
});

describe('advanceWatermark', () => {
  it('takes the highest value seen, regardless of page order', () => {
    expect(
      advanceWatermark(null, [
        '2026-08-24T09:00:00.000Z',
        '2026-08-24T11:30:00.000Z',
        '2026-08-24T10:00:00.000Z',
      ]),
    ).toBe('2026-08-24T11:30:00.000Z');
  });

  it('never moves backwards', () => {
    expect(advanceWatermark('2026-08-24T11:00:00.000Z', ['2026-08-24T09:00:00.000Z'])).toBe(
      '2026-08-24T11:00:00.000Z',
    );
  });

  it('ignores a malformed value rather than letting it become the watermark', () => {
    // A row whose `lastUpdated` is junk must not be able to shove the watermark
    // into the future — every later delta would then query from a time after the
    // real changes and report nothing to do, permanently.
    expect(advanceWatermark('2026-08-24T09:00:00.000Z', ['zzzz-not-a-date', ''])).toBe(
      '2026-08-24T09:00:00.000Z',
    );
    expect(advanceWatermark(null, ['zzzz-not-a-date'])).toBeNull();
  });

  it('ignores absent values', () => {
    expect(advanceWatermark(null, [undefined, null, '2026-08-24T09:00:00.000Z'])).toBe(
      '2026-08-24T09:00:00.000Z',
    );
  });
});

describe('readTotalCount', () => {
  it('reads the header whatever its casing', () => {
    expect(readTotalCount({ 'X-Total-Count': '47' })).toBe(47);
    expect(readTotalCount({ 'x-total-count': '47' })).toBe(47);
  });

  it('returns null for an absent, empty or non-integer header', () => {
    expect(readTotalCount(undefined)).toBeNull();
    expect(readTotalCount({})).toBeNull();
    expect(readTotalCount({ 'x-total-count': '' })).toBeNull();
    expect(readTotalCount({ 'x-total-count': 'many' })).toBeNull();
    expect(readTotalCount({ 'x-total-count': '4.5' })).toBeNull();
  });
});

describe('driftVerdict', () => {
  it('agrees only when the counts match', () => {
    expect(driftVerdict(1000, 1000)).toBe('in-sync');
    expect(driftVerdict(999, 1000)).toBe('drifted');
    expect(driftVerdict(1001, 1000)).toBe('drifted');
  });

  it('reports unknown — never in-sync — when Okta did not say', () => {
    // The failure this guards: treating an absent header as agreement lets a
    // snapshot that has genuinely diverged pass every future check.
    expect(driftVerdict(null, 1000)).toBe('unknown');
    expect(driftVerdict(Number.NaN, 1000)).toBe('unknown');
  });

  it('detects an emptied collection rather than reading it as unknown', () => {
    expect(driftVerdict(0, 1000)).toBe('drifted');
  });
});

describe('nextSyncMode', () => {
  const NOW = 1_800_000_000_000;

  it('full-walks a cold collection', () => {
    expect(nextSyncMode(emptySyncMeta(ORIGIN, 'groups'), NOW)).toBe('full');
  });

  it('full-walks an interrupted walk rather than topping it up with a delta', () => {
    // A suspended walk left pages unfetched. A delta would only ask "what changed
    // since the watermark", so those pages would stay missing while every later
    // check reported agreement.
    const interrupted = complete(NOW, { cursor: '/api/v1/groups?after=abc', complete: false });
    expect(nextSyncMode(interrupted, NOW)).toBe('full');
  });

  it('full-walks when the last walk never completed, even with a cursor cleared', () => {
    expect(nextSyncMode(complete(NOW, { complete: false }), NOW)).toBe('full');
  });

  it('full-walks an org probed as not honouring the delta filter', () => {
    expect(nextSyncMode(complete(NOW, { deltaSupported: false }), NOW)).toBe('full');
  });

  it('deltas a complete, recently checked snapshot', () => {
    expect(nextSyncMode(complete(NOW, { deltaSupported: true }), NOW + 1000)).toBe('delta');
  });

  it('owes a drift check once the last check ages out', () => {
    const meta = complete(NOW, { deltaSupported: true });
    expect(nextSyncMode(meta, NOW + DRIFT_CHECK_INTERVAL_MS - 1)).toBe('delta');
    expect(nextSyncMode(meta, NOW + DRIFT_CHECK_INTERVAL_MS)).toBe('drift-check');
  });

  it('ages the check from the last delta, not only the last full walk', () => {
    const meta = complete(NOW, {
      deltaSupported: true,
      lastDeltaAt: NOW + DRIFT_CHECK_INTERVAL_MS,
    });
    expect(nextSyncMode(meta, NOW + DRIFT_CHECK_INTERVAL_MS + 1)).toBe('delta');
  });

  it('does nothing for a fresh collection with no watermark to query from', () => {
    // An org with zero groups: complete, checked, and nothing to delta against.
    expect(nextSyncMode(complete(NOW, { watermark: null, itemCount: 0 }), NOW)).toBe('none');
  });
});
