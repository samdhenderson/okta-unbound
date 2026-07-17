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
 * The scheduler/rate-limit route is unchanged — this module only relocates the
 * existing fetch verbatim.
 *
 * @see `content/index` for the message routing that consumes this primitive.
 */

import type { ApiResponse } from '../shared/types';
import { createLogger } from '../shared/utils/logger';

const log = createLogger('Content');

/** HTTP methods the content script is permitted to send to the Okta origin. */
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

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
 * @returns A normalized success/error response with headers and status.
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
    return { success: false, error: 'Rejected request: endpoint must be a same-origin path' };
  }

  const normalizedMethod = (method || 'GET').toUpperCase();
  if (!ALLOWED_METHODS.has(normalizedMethod)) {
    log.warn('Rejected API request: unsupported HTTP method', { method: normalizedMethod });
    return { success: false, error: 'Rejected request: unsupported HTTP method' };
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
