import { useState, useEffect, useCallback, useRef } from 'react';
import type { GroupInfo, UserInfo, MessageResponse } from '../../shared/types';

type PageType = 'group' | 'user' | 'app' | 'admin' | 'unknown';
type ConnectionStatus = 'connecting' | 'connected' | 'error';

export interface AppInfo {
  appId: string;
  appName: string;
  appLabel?: string;
}

export interface OktaPageContext {
  pageType: PageType;
  groupInfo: GroupInfo | null;
  userInfo: UserInfo | null;
  appInfo: AppInfo | null;
  connectionStatus: ConnectionStatus;
  targetTabId: number | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  oktaOrigin: string | null;
}

export function useOktaPageContext(): OktaPageContext {
  const [pageType, setPageType] = useState<PageType>('unknown');
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [targetTabId, setTargetTabId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [oktaOrigin, setOktaOrigin] = useState<string | null>(null);

  // Track in-flight requests to prevent race conditions
  const fetchIdRef = useRef(0);

  const fetchPageContext = useCallback(async (retryCount = 0) => {
    const currentFetchId = ++fetchIdRef.current;

    try {
      console.log('[useOktaPageContext] Fetching page context... (attempt', retryCount + 1, ')');
      setIsLoading(true);
      setError(null);

      // Get current window's tabs
      const currentWindow = await chrome.windows.getCurrent();
      const allTabsInWindow = await chrome.tabs.query({ windowId: currentWindow.id });

      // Find Okta admin tabs
      const oktaTabs = allTabsInWindow.filter(
        (tab) =>
          tab.url &&
          (tab.url.includes('okta.com') ||
            tab.url.includes('oktapreview.com') ||
            tab.url.includes('okta-emea.com'))
      );

      console.log('[useOktaPageContext] Okta tabs found:', oktaTabs.length);

      if (oktaTabs.length === 0) {
        throw new Error('Please open an Okta admin page in this window');
      }

      // Prefer active Okta tab, otherwise use first
      const tab = oktaTabs.find((t) => t.active) || oktaTabs[0];
      console.log('[useOktaPageContext] Selected tab:', { id: tab.id, url: tab.url });

      // Check if this request is still relevant
      if (currentFetchId !== fetchIdRef.current) {
        console.log('[useOktaPageContext] Skipping stale request');
        return;
      }

      setTargetTabId(tab.id!);

      // Try to communicate with content script
      try {
        // Fetch Okta origin
        const originResponse: MessageResponse<string> = await chrome.tabs.sendMessage(tab.id!, {
          action: 'getOktaOrigin',
        });

        if (originResponse.success && originResponse.data) {
          setOktaOrigin(originResponse.data);
        }

        // Check if still relevant
        if (currentFetchId !== fetchIdRef.current) {
          return;
        }

        // Try to detect page type by requesting all context types
        const [groupResponse, userResponse, appResponse]: [
          MessageResponse<GroupInfo>,
          MessageResponse<UserInfo>,
          MessageResponse<AppInfo>
        ] = await Promise.all([
          chrome.tabs.sendMessage(tab.id!, { action: 'getGroupInfo' }),
          chrome.tabs.sendMessage(tab.id!, { action: 'getUserInfo' }),
          chrome.tabs.sendMessage(tab.id!, { action: 'getAppInfo' }),
        ]);

        // Check if still relevant
        if (currentFetchId !== fetchIdRef.current) {
          return;
        }

        // Successfully connected
        setConnectionStatus('connected');
        setError(null);

        // Determine page type and set appropriate context
        if (groupResponse.success && groupResponse.data) {
          setPageType('group');
          setGroupInfo(groupResponse.data);
          setUserInfo(null);
          setAppInfo(null);
          console.log('[useOktaPageContext] Detected group page:', groupResponse.data.groupName);
        } else if (userResponse.success && userResponse.data) {
          setPageType('user');
          setUserInfo(userResponse.data);
          setGroupInfo(null);
          setAppInfo(null);
          console.log('[useOktaPageContext] Detected user page:', userResponse.data.userName);
        } else if (appResponse.success && appResponse.data) {
          setPageType('app');
          setAppInfo(appResponse.data);
          setGroupInfo(null);
          setUserInfo(null);
          console.log('[useOktaPageContext] Detected app page:', appResponse.data.appName);
        } else {
          setPageType('admin');
          setGroupInfo(null);
          setUserInfo(null);
          setAppInfo(null);
          console.log('[useOktaPageContext] On Okta admin, but not on a specific entity page');
        }
      } catch (messageErr) {
        // Content script not responding - retry with exponential backoff
        console.warn('[useOktaPageContext] Content script communication error:', messageErr);

        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
          console.log(`[useOktaPageContext] Retrying in ${delay}ms...`);
          setTimeout(() => fetchPageContext(retryCount + 1), delay);
          return;
        } else {
          setConnectionStatus('connected');
          setPageType('admin');
          setGroupInfo(null);
          setUserInfo(null);
          setAppInfo(null);
          setError('Connected to Okta, but extension communication delayed');
        }
      }
    } catch (err) {
      console.error('[useOktaPageContext] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setConnectionStatus('error');
      setPageType('unknown');
      setGroupInfo(null);
      setUserInfo(null);
      setAppInfo(null);
      setOktaOrigin(null);
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchPageContext();

    // Debounce timer
    let debounceTimer: NodeJS.Timeout | null = null;

    const debouncedFetch = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        fetchPageContext();
      }, 150);
    };

    // Listen for tab updates
    const handleTabUpdate = (_tabId: number, changeInfo: { url?: string; status?: string }, tab: chrome.tabs.Tab) => {
      if (changeInfo.url && tab.url &&
          (tab.url.includes('okta.com') ||
           tab.url.includes('oktapreview.com') ||
           tab.url.includes('okta-emea.com'))) {
        console.log('[useOktaPageContext] Okta tab URL changed, refetching (debounced)');
        debouncedFetch();
      }

      if (changeInfo.status === 'complete' && tab.url &&
          (tab.url.includes('okta.com') ||
           tab.url.includes('oktapreview.com') ||
           tab.url.includes('okta-emea.com'))) {
        console.log('[useOktaPageContext] Okta tab loaded, verifying context (debounced)');
        debouncedFetch();
      }
    };

    const handleTabActivated = (activeInfo: { tabId: number; windowId: number }) => {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url &&
            (tab.url.includes('okta.com') ||
             tab.url.includes('oktapreview.com') ||
             tab.url.includes('okta-emea.com'))) {
          console.log('[useOktaPageContext] Okta tab activated, refetching context (debounced)');
          debouncedFetch();
        }
      });
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [fetchPageContext]);

  return {
    pageType,
    groupInfo,
    userInfo,
    appInfo,
    connectionStatus,
    targetTabId,
    error,
    isLoading,
    refetch: fetchPageContext,
    oktaOrigin,
  };
}
