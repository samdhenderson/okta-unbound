/**
 * @module content/apiRequest
 * @description Same-origin authenticated fetch primitive for the Okta content script.
 *
 * This is the single choke point through which every content-script API call flows.
 * It enforces the two boundary guards that keep the authenticated session safe:
 * a same-origin-path check (no absolute or protocol-relative URLs) and an
 * allow-listed HTTP method. It scrapes the per-request XSRF token from the page DOM
 * at fetch time (never persisted, never logged) and returns a normalized
 * {@link ApiResponse}.
 *
 * NOTE: This is the content-script transport, not the background `ApiScheduler`.
 * It does no rate limiting itself; it only reports what Okta said — status,
 * headers, and a normalized error — so the scheduler's `RateLimitDetector` has
 * something to steer by.
 *
 * @see `content/index` for the message routing that consumes this primitive.
 */

import type { ApiResponse } from '../shared/types';
import { NO_HTTP_STATUS } from '../shared/scheduler/requestResult';
import { createLogger } from '../shared/utils/logger';

const log = createLogger('Content');

/** HTTP methods the content script is permitted to send to the Okta origin. */
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Build a failure response that never had an HTTP status to report — a rejected
 * boundary guard, or a `fetch` that threw.
 *
 * The `status` argument is required rather than defaulted so this file cannot
 * grow a status-less failure by omission: the scheduler's `RequestFailure` arm
 * promises every failure carries one, and this is the producer that keeps it.
 *
 * @param error - Human-readable summary. Never a response body, token, or PII.
 * @param status - Almost always {@link NO_HTTP_STATUS}.
 * @returns The normalized failure response.
 */
function failure(error: string, status: number): ApiResponse {
  return { success: false, error, status };
}

/**
 * Read the XSRF token from the page DOM.
 *
 * The token is scraped fresh at fetch time from the `_xsrfToken` element; it is
 * never persisted, forwarded across messages, or logged.
 *
 * @returns The token text, or an empty string when the element is absent.
 */
function getXsrfToken(): string {
  const xsrfElement = document.getElementById('_xsrfToken');
  return xsrfElement ? xsrfElement.textContent || '' : '';
}

/**
 * Whether `endpoint` is a plain same-origin path (`/api/...`). Rejects absolute
 * URLs and protocol-relative `//host` forms so a malformed or hostile message
 * can never redirect the authenticated fetch off the Okta org.
 */
export function isSameOriginPath(endpoint: string): boolean {
  if (typeof endpoint !== 'string' || !endpoint.startsWith('/') || endpoint.startsWith('//')) {
    return false;
  }
  try {
    return new URL(endpoint, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Perform an authenticated same-origin fetch against the Okta org and normalize
 * the result into an {@link ApiResponse}.
 *
 * Guards: the endpoint must be a same-origin path and the method must be
 * allow-listed. Requests include the page's session credentials plus the scraped
 * XSRF header; DELETE responses and non-JSON bodies are handled defensively.
 *
 * @param endpoint - Same-origin API path (must start with a single `/`).
 * @param method - HTTP method; defaults to `GET`.
 * @param body - Optional JSON body (ignored for `GET`).
 * @returns A normalized success/error response with headers and status. Every
 * failure carries a `status` — the real one when Okta answered, else
 * {@link NO_HTTP_STATUS} — so the scheduler's `RequestFailure` arm can promise
 * one is always there. `headers` is present whenever Okta answered at all,
 * success or not, so the scheduler's `RateLimitDetector` can read
 * `X-Rate-Limit-*` off a 429; it is absent only when there was no response
 * (a rejected boundary guard or a `fetch` that threw).
 */
export async function handleMakeApiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: unknown,
): Promise<ApiResponse> {
  log.debug('makeApiRequest called', {
    endpoint: endpoint.split('?')[0],
    method,
    hasBody: !!body,
  });

  if (!isSameOriginPath(endpoint)) {
    log.warn('Rejected API request: endpoint is not a same-origin path');
    return failure('Rejected request: endpoint must be a same-origin path', NO_HTTP_STATUS);
  }

  const normalizedMethod = (method || 'GET').toUpperCase();
  if (!ALLOWED_METHODS.has(normalizedMethod)) {
    log.warn('Rejected API request: unsupported HTTP method', { method: normalizedMethod });
    return failure('Rejected request: unsupported HTTP method', NO_HTTP_STATUS);
  }

  try {
    const url = window.location.origin + endpoint;

    // Extract XSRF token from the page
    const xsrfToken = getXsrfToken();
    // Never log the token or any preview of it — only whether one was found.
    log.debug('XSRF token check', { present: xsrfToken.length > 0 });

    const options: RequestInit = {
      method: normalizedMethod,
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'X-Requested-With': 'XMLHttpRequest',
        ...(xsrfToken && { 'X-Okta-Xsrftoken': xsrfToken }),
      },
      credentials: 'include',
      cache: 'no-store',
      mode: 'cors',
      redirect: 'follow',
    };

    if (body && normalizedMethod !== 'GET') {
      options.body = JSON.stringify(body);
    }

    log.debug('About to call fetch()');
    const response = await fetch(url, options);
    log.debug('fetch() completed');

    log.debug('Okta API response', {
      endpoint: endpoint.split('?')[0],
      status: response.status,
      ok: response.ok,
    });

    // Parse response headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Handle DELETE requests (empty response)
    if (normalizedMethod === 'DELETE' && response.ok) {
      return {
        success: true,
        data: null,
        headers,
        status: response.status,
      };
    }

    // Try to parse JSON
    let data: unknown = null;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        log.warn('Failed to parse JSON response');
      }
    }

    if (!response.ok) {
      const errorBody = data as { errorSummary?: string; message?: string } | null;
      return {
        success: false,
        error:
          errorBody?.errorSummary ||
          errorBody?.message ||
          `Request failed with status ${response.status}`,
        status: response.status,
        data,
        // Headers travel with a failure too (D-064). A 429 is exactly the
        // response whose `X-Rate-Limit-*` headers the scheduler's
        // `RateLimitDetector` needs; dropping them here left rate limiting
        // steered only by requests that succeeded.
        headers,
      };
    }

    return {
      success: true,
      data,
      headers,
      status: response.status,
    };
  } catch (error) {
    log.error('makeApiRequest error', error);
    // The fetch never produced a response (offline, DNS, reset, CORS refusal),
    // so there is no HTTP status to report — say that explicitly rather than
    // omitting the field and leaving the caller nothing to branch on.
    return failure(error instanceof Error ? error.message : 'Unknown error', NO_HTTP_STATUS);
  }
}
