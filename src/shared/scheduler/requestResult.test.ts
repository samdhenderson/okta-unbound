/**
 * @module shared/scheduler/requestResult.test
 * @description Unit tests for the `RequestResult` union's runtime half (D-007a).
 *
 * Three properties, each of which used to be unavailable to a caller:
 * - a failure always carries a `status`, so the four failure modes stop reading
 *   identically — including the ones that never saw an HTTP response, which
 *   carry {@link NO_HTTP_STATUS} rather than omitting the field;
 * - `isSessionExpired` means 401 and nothing else — a 403 or a 429 must not be
 *   answered with "sign in again";
 * - narrowing on `success` is what exposes the status (a type-level property,
 *   asserted here by construction rather than by a runtime expectation).
 */
import { describe, it, expect } from 'vitest';
import { isSessionExpired, normalizeRequestResult, NO_HTTP_STATUS } from './requestResult';
import type { RequestResult } from './types';

describe('NO_HTTP_STATUS', () => {
  it('cannot collide with a real HTTP status', () => {
    // HTTP defines nothing below 100, so the sentinel is unambiguous.
    expect(NO_HTTP_STATUS).toBe(0);
    expect(NO_HTTP_STATUS).toBeLessThan(100);
  });
});

describe('isSessionExpired', () => {
  it('is true for a 401 failure', () => {
    expect(isSessionExpired({ success: false, status: 401, error: 'Unauthorized' })).toBe(true);
  });

  it.each([
    ['403 — a permission problem, not an identity one', 403],
    ['429 — a live session being throttled', 429],
    ['404 — a missing entity', 404],
    ['500 — an Okta-side failure', 500],
    ['the no-HTTP-response sentinel — nothing is known about the session', NO_HTTP_STATUS],
  ])('is false for %s', (_label, status) => {
    expect(isSessionExpired({ success: false, status })).toBe(false);
  });

  it('is false for a successful result whatever its status', () => {
    expect(isSessionExpired({ success: true, status: 401, data: {} })).toBe(false);
    expect(isSessionExpired({ success: true, status: 200, data: {} })).toBe(false);
  });
});

describe('normalizeRequestResult', () => {
  it('gives a status-less failure the sentinel', () => {
    // The content-script router replies exactly this shape for a request with
    // no endpoint, and it is the reason this normalizer exists.
    const result = normalizeRequestResult({ success: false, error: 'Missing endpoint' });

    expect(result).toEqual({ success: false, error: 'Missing endpoint', status: NO_HTTP_STATUS });
  });

  it('leaves a real HTTP status alone', () => {
    const result = normalizeRequestResult({ success: false, status: 429, error: 'Too many' });

    expect(result).toEqual({ success: false, status: 429, error: 'Too many' });
  });

  it('passes a success through untouched', () => {
    const raw = {
      success: true,
      data: [{ id: '00gFAKE1' }],
      headers: { link: '<x>' },
      status: 200,
    };

    expect(normalizeRequestResult(raw)).toEqual(raw);
  });

  it('turns a dropped (undefined) payload into a failure rather than passing it on', () => {
    expect(normalizeRequestResult(undefined)).toEqual({
      success: false,
      status: NO_HTTP_STATUS,
    });
  });

  it('preserves the headers and error body a failure did arrive with', () => {
    const result = normalizeRequestResult({
      success: false,
      error: 'Too many requests',
      status: 429,
      headers: { 'x-rate-limit-reset': '1700000000' },
      data: { errorSummary: 'Too many requests' },
    });

    expect(result).toMatchObject({
      status: 429,
      headers: { 'x-rate-limit-reset': '1700000000' },
      data: { errorSummary: 'Too many requests' },
    });
  });
});

describe('the union discriminates', () => {
  it('exposes a non-optional status once narrowed to the failure arm', () => {
    const results: RequestResult[] = [
      { success: true, data: { id: '0oaFAKE1' }, status: 200 },
      { success: false, status: 429, error: 'Too many requests' },
      { success: false, status: NO_HTTP_STATUS, error: 'Failed to fetch' },
    ];

    // `status` below is typed `number`, not `number | undefined` — the whole
    // point of the failure arm. A regression to the old single interface makes
    // this line a type error, and `npm run type-check` red.
    const statuses = results.filter((r) => !r.success).map((r): number => r.status);

    expect(statuses).toEqual([429, NO_HTTP_STATUS]);
  });
});
