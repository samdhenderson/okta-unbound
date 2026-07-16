/**
 * @module hooks/useOktaApi/core
 * @description Core primitives every operation module builds on: side-panel →
 * content-script messaging and scheduler-routed Okta API requests.
 *
 * @remarks
 * The two transport methods are deliberately different:
 * - `sendMessage` talks directly to the content script (used for messages the
 *   content script handles itself, e.g. streaming a CSV export to download).
 * - `makeApiRequest` routes through the background `ApiScheduler` so every
 *   Okta call is rate-limited and prioritized. All raw Okta API traffic MUST go
 *   through this path — never bypass it with a direct content-script fetch.
 */

import type { MessageRequest, MessageResponse, OperationCallbacks } from './types';
import type { RequestResult } from '@/shared/scheduler/types';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('useOktaApi');

/**
 * Shared transport surface passed into every operation factory.
 *
 * @remarks
 * Bundles the target tab, the two message transports, cancellation check, and
 * progress/result callbacks so the operation modules stay free of Chrome-runtime
 * plumbing.
 */
export interface CoreApi {
  /** Content-script tab currently connected to an Okta session, or `null` when disconnected. */
  targetTabId: number | null;
  /** Send a message straight to the content script (bypasses the scheduler; not for Okta API calls). */
  sendMessage: <T = unknown>(message: MessageRequest) => Promise<MessageResponse<T>>;
  /** Enqueue an Okta API request via the background scheduler; `priority` orders it against other in-flight work. */
  makeApiRequest: (
    endpoint: string,
    method?: string,
    body?: unknown,
    priority?: 'high' | 'normal' | 'low',
  ) => Promise<RequestResult>;
  /** Resolve the signed-in admin's email/id (for audit logging); falls back to `'unknown'` on failure. */
  getCurrentUser: () => Promise<{ email: string; id: string }>;
  /** Throws if the caller has requested cancellation; call between iterations in long loops. */
  checkCancelled: () => void;
  /** Clear any prior cancellation; call once at the start of a cancellable operation. */
  resetCancellation: () => void;
  /** Progress/result callbacks used to surface operation feedback to the UI. */
  callbacks: OperationCallbacks;
}

/**
 * Build the {@link CoreApi} transport surface for a given Okta tab.
 *
 * @param targetTabId - Content-script tab holding the live Okta session, or `null` if not connected.
 * @param checkCancelled - Cancellation guard threaded through to long-running operations.
 * @param resetCancellation - Clears a prior cancel; operations call it at their start.
 * @param callbacks - Progress/result callbacks forwarded to operations.
 * @returns The {@link CoreApi} consumed by every `create*Operations` factory.
 * @remarks `sendMessage` and `makeApiRequest` both throw if `targetTabId` is `null`.
 */
export function createCoreApi(
  targetTabId: number | null,
  checkCancelled: () => void,
  resetCancellation: () => void,
  callbacks: OperationCallbacks,
): CoreApi {
  /**
   * Send a message to the content script and await its response.
   * @remarks Logs only the action name — never the message body, which may carry payloads/PII.
   */
  const sendMessage = async <T = unknown>(message: MessageRequest): Promise<MessageResponse<T>> => {
    if (!targetTabId) {
      throw new Error('No target tab ID - not connected to Okta page');
    }

    // Log the action only — never the message body (may contain payloads).
    log.debug('Sending message', { action: message.action });
    const response = await chrome.tabs.sendMessage(targetTabId, message);
    log.debug('Received response', { action: message.action, success: response?.success });

    return response;
  };

  /**
   * Enqueue an Okta API request through the background scheduler.
   * @remarks Routes via `chrome.runtime` `scheduleApiRequest` so the scheduler
   * enforces rate limits and honors `priority`. Only the path (query stripped)
   * is logged, never the body.
   */
  const makeApiRequest = async (
    endpoint: string,
    method: string = 'GET',
    body?: unknown,
    priority: 'high' | 'normal' | 'low' = 'normal',
  ): Promise<RequestResult> => {
    if (!targetTabId) {
      throw new Error('No target tab ID - not connected to Okta page');
    }

    log.debug('Scheduling API request via background', {
      endpoint: endpoint.split('?')[0],
      method,
      priority,
    });

    // Route through the background scheduler for rate limit control
    const response = await chrome.runtime.sendMessage({
      action: 'scheduleApiRequest',
      endpoint,
      method,
      body,
      tabId: targetTabId,
      priority,
    });

    log.debug('Received scheduled response', {
      endpoint: endpoint.split('?')[0],
      success: response?.success,
    });
    return response;
  };

  /**
   * Resolve the signed-in admin via `/api/v1/users/me`, for audit attribution.
   * @returns The current user's email and id; `'unknown'` placeholders if the call fails.
   */
  const getCurrentUser = async (): Promise<{ email: string; id: string }> => {
    try {
      const response = await makeApiRequest('/api/v1/users/me');
      if (response.success && response.data) {
        return {
          email: response.data.profile?.email || 'unknown@unknown.com',
          id: response.data.id || 'unknown',
        };
      }
      return { email: 'unknown@unknown.com', id: 'unknown' };
    } catch (error) {
      log.error('Failed to get current user', error);
      return { email: 'unknown@unknown.com', id: 'unknown' };
    }
  };

  return {
    targetTabId,
    sendMessage,
    makeApiRequest,
    getCurrentUser,
    checkCancelled,
    resetCancellation,
    callbacks,
  };
}
