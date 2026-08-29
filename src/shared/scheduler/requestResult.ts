/**
 * @module shared/scheduler/requestResult
 * @description The runtime half of {@link RequestResult}: the no-HTTP-response
 * sentinel, the boundary normalizer that guarantees it, and the one predicate
 * allowed to decide that a failure means "the Okta session is gone".
 *
 * `RequestResult` (`shared/scheduler/types`) is a discriminated union whose
 * failure arm carries a **non-optional** `status`. Not every failure has an HTTP
 * status to carry — a `fetch` that throws, or a boundary guard that rejects a
 * request before it is ever sent, never sees a response — so those failures
 * carry {@link NO_HTTP_STATUS} rather than omitting the field. An absent field
 * gives a caller no reason to look; an explicit sentinel does.
 *
 * @see `shared/scheduler/types` for the union itself.
 */

import type { RequestResult } from './types';

/**
 * Status used by a failure that never produced an HTTP response at all: the
 * `fetch` threw (offline, DNS, connection reset, CORS refusal), or a
 * content-script boundary guard rejected the request before sending it.
 *
 * `0` is the platform's own convention for this (`XMLHttpRequest.status` is `0`
 * for a network error, as is an opaque `Response.status`), and it cannot collide
 * with a real status — HTTP defines none below 100.
 *
 * **It is falsy.** Compare it explicitly (`status === NO_HTTP_STATUS`); never
 * test a failure's status for truthiness.
 */
export const NO_HTTP_STATUS = 0;

/**
 * HTTP status Okta returns when the admin session backing a request is no longer
 * valid. See {@link isSessionExpired} for why nothing else counts.
 */
const HTTP_UNAUTHORIZED = 401;

/**
 * Does this result mean the Okta session has expired?
 *
 * **401 only, and deliberately so.** 401 is the one status that says *"we do not
 * know who you are"* — the session cookie the content script rides on is gone or
 * stale, and no amount of retrying the same request will change that; the admin
 * has to re-authenticate in the Okta tab. Everything else is a different problem
 * with a different remedy, and folding it in here would prescribe the wrong one:
 *
 * - **403** is *"we know who you are and you may not do this"* — an admin whose
 *   role lacks the permission. Prompting them to re-authenticate is a dead end;
 *   they would sign back in and get the same 403.
 * - **429** is a live session being throttled. It wants backoff (`D-007c`), not
 *   a sign-in.
 * - {@link NO_HTTP_STATUS} is a transport failure. Nothing is known about the
 *   session at all — asserting it expired would be a guess.
 *
 * @param result - Any settled {@link RequestResult}.
 * @returns `true` only for a failure carrying HTTP 401.
 */
export function isSessionExpired(result: RequestResult): boolean {
  return !result.success && result.status === HTTP_UNAUTHORIZED;
}

/**
 * Normalize an untyped transport payload into a {@link RequestResult}.
 *
 * The scheduler receives each result back over `chrome.tabs.sendMessage`, which
 * is typed as `any` and carries whatever the content script on the other side
 * happens to send — including, from an older or mismatched build, a failure with
 * no `status` at all. This is the one place that can keep the union's promise
 * honest, so every failure leaves here with a status: the one it arrived with,
 * or {@link NO_HTTP_STATUS}.
 *
 * Nothing else about the payload is inspected or reshaped — the scheduler stays
 * response-shape-agnostic, and the Okta JSON is still validated at the
 * content-script zod boundary (ADR-0006).
 *
 * @param raw - The message payload returned by the content script.
 * @returns The same result, with a guaranteed `status` on the failure arm.
 */
export function normalizeRequestResult(raw: unknown): RequestResult {
  const candidate = (raw ?? {}) as Partial<RequestResult> & { status?: unknown };
  if (candidate.success === true) {
    return candidate as RequestResult;
  }
  return {
    ...(candidate as object),
    success: false,
    status: typeof candidate.status === 'number' ? candidate.status : NO_HTTP_STATUS,
  };
}
