/**
 * Core API functionality for useOktaApi
 *
 * This module provides the foundational API request functions used by all
 * other modules. It handles message passing to the content script and
 * request scheduling through the background service worker.
 */

import type { MessageRequest, MessageResponse, UseOktaApiOptions, ApiResponse } from './types';

/**
 * Creates the core API functions used by all other modules
 */
export function createCoreApi(options: UseOktaApiOptions, dependencies: {
  setIsCancelled: (cancelled: boolean) => void;
  abortController: AbortController | null;
  isCancelled: boolean;
}) {
  const { targetTabId, onResult, onProgress } = options;
  const { setIsCancelled, abortController, isCancelled } = dependencies;

  /**
   * Send a message to the content script
   */
  const sendMessage = async <T = any>(message: MessageRequest): Promise<MessageResponse<T>> => {
    if (!targetTabId) {
      throw new Error('No target tab ID - not connected to Okta page');
    }

    console.log('[useOktaApi] Sending message:', message);
    const response = await chrome.tabs.sendMessage(targetTabId, message);
    console.log('[useOktaApi] Received response:', response);

    return response;
  };

  /**
   * Make an API request through the background scheduler
   */
  const makeApiRequest = async (
    endpoint: string,
    method: string = 'GET',
    body?: any,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<ApiResponse> => {
    if (!targetTabId) {
      throw new Error('No target tab ID - not connected to Okta page');
    }

    console.log('[useOktaApi] Scheduling API request via background:', { endpoint, method, priority });

    const response = await chrome.runtime.sendMessage({
      action: 'scheduleApiRequest',
      endpoint,
      method,
      body,
      tabId: targetTabId,
      priority,
    });

    console.log('[useOktaApi] Received scheduled response:', response);
    return response;
  };

  /**
   * Cancel the current operation
   */
  const cancelOperation = () => {
    console.log('[useOktaApi] Cancelling operation');
    setIsCancelled(true);
    if (abortController) {
      abortController.abort();
    }
    onResult?.('Operation cancelled by user', 'warning');
  };

  /**
   * Check if operation was cancelled (throws if cancelled)
   */
  const checkCancelled = () => {
    if (isCancelled) {
      throw new Error('Operation cancelled');
    }
  };

  /**
   * Get current user for audit logging
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
    } catch (error) {
      console.error('[useOktaApi] Failed to get current user:', error);
    }
    return { email: 'unknown@unknown.com', id: 'unknown' };
  };

  return {
    sendMessage,
    makeApiRequest,
    cancelOperation,
    checkCancelled,
    getCurrentUser,
    onResult,
    onProgress,
    targetTabId,
  };
}

export type CoreApi = ReturnType<typeof createCoreApi>;
