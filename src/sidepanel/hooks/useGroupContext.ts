import { useState, useEffect } from 'react';
import type { GroupInfo, MessageResponse } from '../../shared/types';

type ConnectionStatus = 'connecting' | 'connected' | 'error';

interface UseGroupContextReturn {
  groupInfo: GroupInfo | null;
  connectionStatus: ConnectionStatus;
  targetTabId: number | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useGroupContext(): UseGroupContextReturn {
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [targetTabId, setTargetTabId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGroupInfo = async () => {
    try {
      console.log('[useGroupContext] Fetching group info...');
      setIsLoading(true);
      setError(null);

      // Get current window's tabs
      const currentWindow = await chrome.windows.getCurrent();
      console.log('[useGroupContext] Current window ID:', currentWindow.id);

      const allTabsInWindow = await chrome.tabs.query({ windowId: currentWindow.id });
      console.log('[useGroupContext] Tabs in current window:', allTabsInWindow.length);

      // Find Okta tabs
      const oktaTabs = allTabsInWindow.filter(
        (tab) =>
          tab.url &&
          (tab.url.includes('okta.com') ||
            tab.url.includes('oktapreview.com') ||
            tab.url.includes('okta-emea.com'))
      );

      console.log(
        '[useGroupContext] Okta tabs found:',
        oktaTabs.length,
        oktaTabs.map((t) => ({ id: t.id, url: t.url, active: t.active }))
      );

      if (oktaTabs.length === 0) {
        throw new Error('Please navigate to an Okta page');
      }

      // Prefer active Okta tab, otherwise use first
      const tab = oktaTabs.find((t) => t.active) || oktaTabs[0];
      console.log('[useGroupContext] Selected Okta tab:', {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        active: tab.active,
      });

      setTargetTabId(tab.id!);

      // Request group info from content script
      console.log('[useGroupContext] Sending getGroupInfo message to tab', tab.id);
      const response: MessageResponse<GroupInfo> = await chrome.tabs.sendMessage(tab.id!, {
        action: 'getGroupInfo',
      });

      console.log('[useGroupContext] Received response:', response);

      if (response.success && response.data) {
        setGroupInfo(response.data);
        setConnectionStatus('connected');
        setError(null);
      } else {
        throw new Error(response.error || 'Could not detect group page');
      }
    } catch (err) {
      console.error('[useGroupContext] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setConnectionStatus('error');
      setGroupInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupInfo();
  }, []);

  return {
    groupInfo,
    connectionStatus,
    targetTabId,
    error,
    isLoading,
    refetch: fetchGroupInfo,
  };
}
