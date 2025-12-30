/**
 * @module hooks/useOktaApi/core
 * @description Core API communication functions
 */

import type { MessageRequest, MessageResponse, OperationCallbacks } from './types';

export interface CoreApi {
  targetTabId: number | null;
  sendMessage: <T = any>(message: MessageRequest) => Promise<MessageResponse<T>>;
  makeApiRequest: (endpoint: string, method?: string, body?: any, priority?: 'high' | 'normal' | 'low') => Promise<any>;
  getCurrentUser: () => Promise<{ email: string; id: string }>;
  checkCancelled: () => void;
  callbacks: OperationCallbacks;
}

/**
 * Create core API functions
 */
export function createCoreApi(
  targetTabId: number | null,
  checkCancelled: () => void,
  callbacks: OperationCallbacks
): CoreApi {
  const sendMessage = async <T = any>(message: MessageRequest): Promise<MessageResponse<T>> => {
    if (!targetTabId) {
      throw new Error('No target tab ID - not connected to Okta page');
    }

    console.log('[useOktaApi] Sending message:', message);
    const response = await chrome.tabs.sendMessage(targetTabId, message);
    console.log('[useOktaApi] Received response:', response);

    return response;
  };

  const makeApiRequest = async (
    endpoint: string,
    method: string = 'GET',
    body?: any,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ) => {
    if (!targetTabId) {
      throw new Error('No target tab ID - not connected to Okta page');
    }

    console.log('[useOktaApi] Scheduling API request via background:', { endpoint, method, priority });

    // Route through the background scheduler for rate limit control
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
      console.error('[useOktaApi] Failed to get current user:', error);
      return { email: 'unknown@unknown.com', id: 'unknown' };
    }
  };

  return {
    targetTabId,
    sendMessage,
    makeApiRequest,
    getCurrentUser,
    checkCancelled,
    callbacks,
  };
}
