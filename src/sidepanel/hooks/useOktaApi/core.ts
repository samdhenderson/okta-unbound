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
import type { RequestResult, RequestPriority } from '@/shared/scheduler/types';
import { runBatch, type BatchProgress, type BatchOutcome } from '@/shared/scheduler/runBatch';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('useOktaApi');

/**
 * Global progress lifecycle hooks the operation runner drives. Supplied by
 * `useOktaApi` from `ProgressContext` (or no-ops outside a provider).
 */
export interface ProgressBridge {
  /** Begin a named operation over `total` items. */
  start: (name: string, total: number) => void;
  /** Report live batch counts. */
  reportBatch: (progress: BatchProgress, message?: string) => void;
  /** End the operation. */
  complete: () => void;
}

/** Options for {@link CoreApi.runOperation}. */
export interface RunOperationOptions<T> {
  /** Max concurrent tasks; defaults to the scheduler cap (5). */
  concurrency?: number;
  /** Return `true` from a settled error to stop launching further work (e.g. a 403 wall). */
  stopOnError?: (error: unknown, item: T, index: number) => boolean;
  /** Derive the status message shown in the activity bar from the live counts. */
  message?: (progress: BatchProgress) => string;
}

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
    priority?: RequestPriority,
  ) => Promise<RequestResult>;
  /** Resolve the signed-in admin's email/id (for audit logging); falls back to `'unknown'` on failure. */
  getCurrentUser: () => Promise<{ email: string; id: string }>;
  /** Throws if the caller has requested cancellation; call between iterations in long loops. */
  checkCancelled: () => void;
  /** Clear any prior cancellation; call once at the start of a cancellable operation. */
  resetCancellation: () => void;
  /**
   * Run a list of Okta calls as one tracked, cancellable operation.
   *
   * Owns the global progress lifecycle (start → live counts → complete) and runs
   * the work through {@link runBatch} with bounded concurrency and the shared
   * cancellation guard, so every operation gets the full activity view and one
   * Cancel. This is the standard way to perform any multi-call read or write.
   *
   * @param name - Operation label shown in the activity bar.
   * @param items - Work items.
   * @param task - Per-item worker; issues its own scheduler request(s).
   * @param options - See {@link RunOperationOptions}.
   * @returns The {@link BatchOutcome}; never throws for cancellation (inspect `cancelled`).
   */
  runOperation: <T, R>(
    name: string,
    items: T[],
    task: (item: T, index: number) => Promise<R>,
    options?: RunOperationOptions<T>,
  ) => Promise<BatchOutcome<T, R>>;
  /** Progress/result callbacks used to surface operation feedback to the UI. */
  callbacks: OperationCallbacks;
}

/**
 * Build the {@link CoreApi} transport surface for a given Okta tab.
 *
 * @param targetTabId - Content-script tab holding the live Okta session, or `null` if not connected.
 * @param checkCancelled - Cancellation guard threaded through to long-running operations.
 * @param resetCancellation - Clears a prior cancel; operations call it at their start.
 * @param progress - Global progress lifecycle bridge used by {@link CoreApi.runOperation}.
 * @param callbacks - Progress/result callbacks forwarded to operations.
 * @returns The {@link CoreApi} consumed by every `create*Operations` factory.
 * @remarks `sendMessage` and `makeApiRequest` both throw if `targetTabId` is `null`.
 */
export function createCoreApi(
  targetTabId: number | null,
  checkCancelled: () => void,
  resetCancellation: () => void,
  progress: ProgressBridge,
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
    priority: RequestPriority = 'normal',
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

  /**
   * Run `items` through `task` as one tracked, cancellable operation. See
   * {@link CoreApi.runOperation}.
   */
  const runOperation = async <T, R>(
    name: string,
    items: T[],
    task: (item: T, index: number) => Promise<R>,
    options: RunOperationOptions<T> = {},
  ): Promise<BatchOutcome<T, R>> => {
    resetCancellation();
    progress.start(name, items.length);
    try {
      return await runBatch(items, task, {
        concurrency: options.concurrency,
        stopOnError: options.stopOnError,
        throwIfCancelled: checkCancelled,
        onProgress: (p) => progress.reportBatch(p, options.message?.(p)),
      });
    } finally {
      progress.complete();
    }
  };

  return {
    targetTabId,
    sendMessage,
    makeApiRequest,
    getCurrentUser,
    checkCancelled,
    resetCancellation,
    runOperation,
    callbacks,
  };
}
