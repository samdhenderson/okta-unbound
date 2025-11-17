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
  oktaOrigin: string | null;
}

export function useGroupContext(): UseGroupContextReturn {
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [targetTabId, setTargetTabId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [oktaOrigin, setOktaOrigin] = useState<string | null>(null);

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

      // Find Okta admin tabs (any Okta page)
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
        throw new Error('Please open an Okta admin page in this window');
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

      // Fetch Okta origin from the tab
      console.log('[useGroupContext] Fetching Okta origin from tab', tab.id);
      const originResponse: MessageResponse<string> = await chrome.tabs.sendMessage(tab.id!, {
        action: 'getOktaOrigin',
      });

      if (originResponse.success && originResponse.data) {
        setOktaOrigin(originResponse.data);
        console.log('[useGroupContext] Okta origin:', originResponse.data);
      }

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
        // Connection successful, but not on a group page
        setGroupInfo(null);
        setConnectionStatus('connected');
        setError(null);
        console.log('[useGroupContext] Connected to Okta, but not on a group page');
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

    // Listen for tab updates (when user navigates to different Okta pages)
    const handleTabUpdate = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      // Only refetch if the URL changed and it's an Okta tab
      if (changeInfo.url && tab.url &&
          (tab.url.includes('okta.com') ||
           tab.url.includes('oktapreview.com') ||
           tab.url.includes('okta-emea.com'))) {
        console.log('[useGroupContext] Okta tab URL changed, refetching group info');
        fetchGroupInfo();
      }
    };

    // Listen for new tabs being activated
    const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url &&
            (tab.url.includes('okta.com') ||
             tab.url.includes('oktapreview.com') ||
             tab.url.includes('okta-emea.com'))) {
          console.log('[useGroupContext] Okta tab activated, refetching group info');
          fetchGroupInfo();
        }
      });
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, []);

  return {
    groupInfo,
    connectionStatus,
    targetTabId,
    error,
    isLoading,
    refetch: fetchGroupInfo,
    oktaOrigin,
  };
}
