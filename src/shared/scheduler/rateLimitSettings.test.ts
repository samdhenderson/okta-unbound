/**
 * Tests for the org rate-limit threshold arithmetic and its boundary schema.
 *
 * Pure functions, so these pin the two things that decide behaviour in the
 * field: the consumed→remaining conversion (an off-by-one-direction here would
 * make the scheduler cool down at 85% *remaining* instead of 15%, i.e. never
 * run), and the refusal to act on a value that is absent, malformed, or outside
 * the band — where the only acceptable answer is `null`, meaning "keep the
 * configured default".
 */
import { describe, it, expect } from 'vitest';
import {
  WARNING_THRESHOLD_ENDPOINT,
  WARNING_THRESHOLD_MARGIN,
  minRemainingFromWarningThreshold,
  parseWarningThreshold,
} from './rateLimitSettings';

describe('WARNING_THRESHOLD_ENDPOINT', () => {
  it('is a same-origin GET path the background message guard will accept', () => {
    // `isValidScheduleRequest` requires a single leading slash.
    expect(WARNING_THRESHOLD_ENDPOINT).toBe('/api/v1/rate-limit-settings/warning-threshold');
    expect(WARNING_THRESHOLD_ENDPOINT.startsWith('/')).toBe(true);
    expect(WARNING_THRESHOLD_ENDPOINT.startsWith('//')).toBe(false);
  });
});

describe('minRemainingFromWarningThreshold', () => {
  it.each([
    // Okta's Workforce default: warn at 90% consumed → stop at 85% consumed.
    [90, 15],
    // Okta's CIAM default.
    [60, 45],
    [100, 5],
    [50, 55],
  ])('turns a consumed threshold of %i into %i%% remaining', (threshold, remaining) => {
    expect(minRemainingFromWarningThreshold(threshold)).toBe(remaining);
  });

  it('backs off by the margin in percentage points, not proportionally', () => {
    expect(WARNING_THRESHOLD_MARGIN).toBe(5);
    // A proportional 5% would give 100 - 90*0.95 = 14.5 for the Workforce
    // default and 100 - 60*0.95 = 43 for the CIAM one. Fixed percentage points
    // give 15 and 45. Both readings agree nowhere, so these two assertions
    // together pin which one is implemented.
    expect(minRemainingFromWarningThreshold(90)).toBe(15);
    expect(minRemainingFromWarningThreshold(60)).toBe(45);
    // The offset from the org's own line is the same at both ends.
    expect(minRemainingFromWarningThreshold(90) - (100 - 90)).toBe(WARNING_THRESHOLD_MARGIN);
    expect(minRemainingFromWarningThreshold(60) - (100 - 60)).toBe(WARNING_THRESHOLD_MARGIN);
  });

  it('is always more conservative than the org would be', () => {
    for (const threshold of [10, 45, 60, 90, 100]) {
      // Remaining at our trigger exceeds remaining at the org's, so we stop
      // first. That is the whole reason for the margin.
      expect(minRemainingFromWarningThreshold(threshold)).toBeGreaterThan(100 - threshold);
    }
  });
});

describe('parseWarningThreshold', () => {
  it('reads the field out of a well-formed body', () => {
    expect(parseWarningThreshold({ warningThreshold: 90 })).toBe(90);
  });

  it('tolerates extra keys Okta may add', () => {
    expect(parseWarningThreshold({ warningThreshold: 60, _links: { self: {} } })).toBe(60);
  });

  it.each([
    ['a missing field', {}],
    ['a null value', { warningThreshold: null }],
    ['a string value', { warningThreshold: '90' }],
    ['a non-object body', 'warningThreshold=90'],
    ['null', null],
    ['undefined', undefined],
    ['an array', [{ warningThreshold: 90 }]],
  ])('returns null for %s', (_name, body) => {
    expect(parseWarningThreshold(body)).toBeNull();
  });

  it.each([
    ['below the plausible floor', 9],
    ['zero', 0],
    ['negative', -10],
    ['above 100', 101],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('returns null for a value %s (%s), rather than clamping it', (_name, value) => {
    // Clamping would act on a number the org never set, and hide the
    // disagreement. Returning null keeps the configured default, visibly.
    expect(parseWarningThreshold({ warningThreshold: value })).toBeNull();
  });

  it('accepts the exact band boundaries', () => {
    expect(parseWarningThreshold({ warningThreshold: 10 })).toBe(10);
    expect(parseWarningThreshold({ warningThreshold: 100 })).toBe(100);
  });
});
