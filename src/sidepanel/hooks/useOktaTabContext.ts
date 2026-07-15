/**
 * @module sidepanel/hooks/useOktaTabContext
 * @description Generic engine behind the side panel's per-entity page-context hooks.
 *
 * Finds the active Okta tab, resolves its origin, delegates entity detection to a
 * caller-supplied `loadEntity`, and refetches (debounced) as the user navigates or
 * switches tabs. Retries transient content-script failures with exponential backoff
 * and guards against stale responses clobbering newer ones.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MessageResponse } from '../../shared/types';
import { createLogger } from '../../shared/utils/logger';
import { isOktaUrl } from '../../shared/utils/oktaUrl';

export type ConnectionStatus = 'connecting' | 'connected' | 'error';

/** Tools handed to an entity loader so it can talk to the content script. */
export interface EntityLoadContext {
  tabId: number;
  /** Send an action to the content script in the target tab. */
  sendToTab: <R>(action: string) => Promise<MessageResponse<R>>;
  /** True once a newer fetch has superseded this one — bail early if so. */
  isStale: () => boolean;
  log: ReturnType<typeof createLogger>;
}

export interface OktaTabContextConfig<T> {
  /** Logger scope, e.g. 'useGroupContext'. */
  scope: string;
  /** Initial data, also restored when no Okta tab is reachable (hard error). */
  initialData: T;
  /** Data to store after content-script comms fail past the retry budget. */
  commsFailedData: T;
  /**
   * Fetch the entity-specific state from the content script. Runs after a tab is
   * selected and the Okta origin has been resolved. Throwing triggers the retry
   * path; returning stores the data and marks the connection as connected.
   */
  loadEntity: (ctx: EntityLoadContext) => Promise<T>;
}

export interface OktaTabContext<T> {
  data: T;
  connectionStatus: ConnectionStatus;
  targetTabId: number | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  oktaOrigin: string | null;
}

const MAX_RETRIES = 3;
const DEBOUNCE_MS = 150;

/**
 * Shared machinery for the side panel's page-context hooks: find the active Okta
 * tab, resolve its origin, delegate entity detection to `loadEntity`, and refetch
 * (debounced) as the user navigates. The per-entity hooks
 * (`useGroupContext`, `useUserContext`, `useOktaPageContext`) are thin wrappers
 * that supply `loadEntity` and rename `data`.
 *
 * @typeParam T - The entity-detection shape produced by `loadEntity` and exposed
 *   as `data`.
 * @param config - Logger scope, initial / comms-failed fallbacks, and the
 *   `loadEntity` fetcher. All fields must be stable per hook instance (they are
 *   effect dependencies).
 * @returns The detected `data` plus connection status, target tab id, error /
 *   loading flags, a `refetch` trigger, and the resolved `oktaOrigin`.
 */
export function useOktaTabContext<T>(config: OktaTabContextConfig<T>): OktaTabContext<T> {
  const { scope, initialData, commsFailedData, loadEntity } = config;
  const log = useRef(createLogger(scope)).current;

  const [data, setData] = useState<T>(initialData);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [targetTabId, setTargetTabId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [oktaOrigin, setOktaOrigin] = useState<string | null>(null);

  // Track in-flight requests so a stale fetch can't clobber a newer one.
  const fetchIdRef = useRef(0);

  const fetchContext = useCallback(
    async (retryCount = 0) => {
      const currentFetchId = ++fetchIdRef.current;
      const isStale = () => currentFetchId !== fetchIdRef.current;

      try {
        log.debug('Fetching context', { attempt: retryCount + 1 });
        setIsLoading(true);
        setError(null);

        const currentWindow = await chrome.windows.getCurrent();
        const allTabsInWindow = await chrome.tabs.query({ windowId: currentWindow.id });
        const oktaTabs = allTabsInWindow.filter((tab) => isOktaUrl(tab.url));

        if (oktaTabs.length === 0) {
          throw new Error('Please open an Okta admin page in this window');
        }

        // Prefer the active Okta tab, otherwise the first one.
        const tab = oktaTabs.find((t) => t.active) || oktaTabs[0];

        if (isStale()) {
          log.debug('Skipping stale request');
          return;
        }

        setTargetTabId(tab.id!);

        const sendToTab = <R>(action: string): Promise<MessageResponse<R>> =>
          chrome.tabs.sendMessage(tab.id!, { action });

        try {
          const originResponse = await sendToTab<string>('getOktaOrigin');
          if (originResponse.success && originResponse.data) {
            setOktaOrigin(originResponse.data);
          }

          if (isStale()) return;

          const entity = await loadEntity({ tabId: tab.id!, sendToTab, isStale, log });

          if (isStale()) return;

          setConnectionStatus('connected');
          setError(null);
          setData(entity);
        } catch (messageErr) {
          // Content script not responding — retry with exponential backoff.
          log.warn('Content script communication error', messageErr);

          if (retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
            log.debug('Retrying content script', { delayMs: delay });
            setTimeout(() => fetchContext(retryCount + 1), delay);
            return; // Leave loading state until the retry settles.
          }

          // Past the retry budget: treat as connected-but-degraded.
          log.warn('Max retries reached; showing as connected');
          setConnectionStatus('connected');
          setData(commsFailedData);
          setError('Connected to Okta, but extension communication delayed');
        }
      } catch (err) {
        log.error('Context fetch failed', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setConnectionStatus('error');
        setData(initialData);
        setOktaOrigin(null);
      } finally {
        if (!isStale()) {
          setIsLoading(false);
        }
      }
    },
    // config values are stable per hook instance
    [scope, initialData, commsFailedData, loadEntity, log],
  );

  useEffect(() => {
    fetchContext();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchContext(), DEBOUNCE_MS);
    };

    // Refetch when the user navigates within, or switches to, an Okta tab.
    const handleTabUpdate = (
      _tabId: number,
      changeInfo: { url?: string; status?: string },
      tab: chrome.tabs.Tab,
    ) => {
      if ((changeInfo.url || changeInfo.status === 'complete') && isOktaUrl(tab.url)) {
        debouncedFetch();
      }
    };

    const handleTabActivated = (activeInfo: { tabId: number; windowId: number }) => {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (isOktaUrl(tab.url)) debouncedFetch();
      });
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [fetchContext]);

  return {
    data,
    connectionStatus,
    targetTabId,
    error,
    isLoading,
    refetch: fetchContext,
    oktaOrigin,
  };
}
