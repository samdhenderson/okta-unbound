/**
 * @module sidepanel/hooks/useOktaTabContext
 * @description Generic engine behind the side panel's per-entity page-context hooks.
 *
 * Finds the active Okta tab, resolves its origin, delegates entity detection to a
 * caller-supplied `loadEntity`, and refetches (debounced) as the user navigates or
 * switches tabs. Retries transient content-script failures with exponential backoff
 * and guards against stale responses clobbering newer ones.
 *
 * Two rules keep a failed probe from becoming a permanent "Disconnected":
 * the same-entity suppression latch is only armed **after a successful probe**
 * (a failure clears it, so the very next event for the same URL still refetches),
 * and a document (re)load — `status: 'complete'` with no `changeInfo.url` — forces
 * a re-probe past the latch, because a reload means a brand-new content script.
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
  /**
   * When `false`, the engine stops re-probing on navigation: tab/activation events
   * only record that a resync is owed, which is then run once the hook becomes
   * enabled again (while the panel is visible). Defaults to `true`. Lets callers
   * scope live detection to, e.g., the active Overview tab.
   */
  enabled?: boolean;
}

export interface OktaTabContext<T> {
  data: T;
  connectionStatus: ConnectionStatus;
  targetTabId: number | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  oktaOrigin: string | null;
  /**
   * `true` when a navigation to a different entity was observed while detection
   * was suppressed (hook disabled or panel hidden) and has not yet been applied.
   * Lets a caller that intentionally holds context (e.g. a pinned Overview) surface
   * a "live page changed" hint. Cleared once a fetch runs.
   */
  resyncPending: boolean;
}

// A freshly-loaded Okta page (or one whose content script was orphaned by an
// extension reload) can take a moment before its `onMessage` listener is live.
// Retry generously — on par with the background scheduler's own budget — so the
// common "panel opened while the page was still settling" race heals silently
// instead of surfacing as a disconnect.
const MAX_RETRIES = 5;
const MAX_RETRY_DELAY_MS = 4000;
const DEBOUNCE_MS = 150;

/**
 * Reduce a tab URL to its entity identity — `origin + pathname + search`, without
 * the `#fragment`. Okta's in-page section tabs (e.g. `#assignments`, `#applications`)
 * only change the fragment, so hash-only navigation yields the same value and the
 * context engine can skip refetching for it.
 *
 * @param url - A tab URL, or `undefined`.
 * @returns The normalized entity URL, or `null` when no URL was given. Falls back
 *   to the raw string if it cannot be parsed.
 */
function normalizeEntityUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/**
 * Shared machinery for the side panel's page-context hooks: find the active Okta
 * tab, resolve its origin, delegate entity detection to `loadEntity`, and refetch
 * (debounced) as the user navigates. The per-entity hooks
 * (`useGroupContext`, `useUserContext`, `useOktaPageContext`) are thin wrappers
 * that supply `loadEntity` and rename `data`.
 *
 * Same-entity navigation is suppressed only against the last **successful** probe,
 * and a document (re)load always forces a fresh probe — so an `error` state is
 * always recoverable by reloading the Okta tab.
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
  const { scope, initialData, commsFailedData, loadEntity, enabled = true } = config;
  const log = useRef(createLogger(scope)).current;

  const [data, setData] = useState<T>(initialData);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [targetTabId, setTargetTabId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [oktaOrigin, setOktaOrigin] = useState<string | null>(null);
  // Surfaced to callers that deliberately hold context (pinned Overview): true once
  // a navigation is observed while suppressed, so a "live page changed" hint can show.
  const [resyncPending, setResyncPending] = useState(false);

  // Track in-flight requests so a stale fetch can't clobber a newer one.
  const fetchIdRef = useRef(0);
  // Entity URL (fragment-stripped) of the last *successful* fetch, to skip hash-only
  // navigation. Latched on success only and cleared on terminal failure: a failed
  // attempt must never suppress a later event for the same URL, or a disconnect
  // becomes unrecoverable (a plain tab reload could never heal it).
  const lastEntityUrlRef = useRef<string | null>(null);
  // Set when a navigation was observed while suppressed (hidden/disabled) and a
  // catch-up fetch is owed once the hook is enabled + visible again.
  const pendingResyncRef = useRef(false);
  // Pending backoff retry, so a manual refetch (or unmount) cancels it instead of
  // racing it.
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchContext = useCallback(
    async (retryCount = 0) => {
      // Cancel any scheduled retry: whoever called us owns the attempt chain now.
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      const currentFetchId = ++fetchIdRef.current;
      const isStale = () => currentFetchId !== fetchIdRef.current;
      // A fresh fetch applies the latest context, clearing any owed resync hint.
      setResyncPending(false);

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

          // Arm the same-entity latch only now that the probe actually landed, so
          // hash-only navigation is skipped without ever suppressing recovery from
          // a failed attempt.
          lastEntityUrlRef.current = normalizeEntityUrl(tab.url);
          setConnectionStatus('connected');
          setError(null);
          setData(entity);
        } catch {
          // Content script not yet listening (page still loading, or the script
          // was orphaned by an extension reload). Retry with capped exponential
          // backoff — it usually appears within a second or two. Keep this at
          // debug: a transient miss that the retry resolves is not noteworthy,
          // and logging every attempt across the page-context hooks floods the
          // console.
          if (retryCount < MAX_RETRIES) {
            const delay = Math.min(Math.pow(2, retryCount) * 500, MAX_RETRY_DELAY_MS);
            log.debug('Content script not ready; retrying', {
              attempt: retryCount + 1,
              delayMs: delay,
            });
            retryTimerRef.current = setTimeout(() => fetchContext(retryCount + 1), delay);
            return; // Leave loading state until the retry settles.
          }

          // Genuinely unreachable after the full budget. Report honestly rather
          // than masquerading as connected (which hid a broken session behind a
          // green dot); the caller can offer a reconnect that reloads the tab.
          // targetTabId is left set so that reconnect knows which tab to reload.
          log.warn('Content script unreachable after retries', { attempts: retryCount + 1 });
          // Terminal failure: drop the latch so the next event for this same URL
          // (typically the user reloading the tab) is allowed through.
          lastEntityUrlRef.current = null;
          setConnectionStatus('error');
          setData(commsFailedData);
          setError('Can’t reach the Okta tab — reload it to reconnect.');
        }
      } catch (err) {
        log.error('Context fetch failed', err);
        // Terminal failure — see above; never leave a latch behind on a failure.
        lastEntityUrlRef.current = null;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setConnectionStatus('error');
        setData(initialData);
        setOktaOrigin(null);
        // No reachable Okta tab — clear the target so a reconnect affordance
        // knows there is nothing to reload (vs. the comms-failure path above,
        // which keeps targetTabId set for exactly that reason).
        setTargetTabId(null);
      } finally {
        if (!isStale()) {
          setIsLoading(false);
        }
      }
    },
    // config values are stable per hook instance
    [scope, initialData, commsFailedData, loadEntity, log],
  );

  // Mirror the latest enablement + fetcher into refs so the always-on listeners
  // read current values without being torn down and re-registered each render.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const fetchContextRef = useRef(fetchContext);
  fetchContextRef.current = fetchContext;

  useEffect(() => {
    // Initial fetch, gated by enablement + panel visibility. When suppressed we
    // remember a sync is owed and run it once the panel is shown / re-enabled.
    if (enabledRef.current && !document.hidden) {
      fetchContextRef.current();
    } else {
      pendingResyncRef.current = true;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchContextRef.current(), DEBOUNCE_MS);
    };

    // Fetch only for a genuine entity change while active + visible; otherwise
    // record that a resync is owed for when the panel next becomes so.
    // `force` bypasses the same-entity latch (document reload — a new content
    // script exists, so re-probing is correct even from a healthy connection);
    // the enabled/hidden deferral still applies either way.
    const requestFetch = (nextUrl?: string, force = false) => {
      if (!force && nextUrl && normalizeEntityUrl(nextUrl) === lastEntityUrlRef.current) {
        return; // hash-only / same-page navigation — nothing to refetch
      }
      if (!enabledRef.current || document.hidden) {
        pendingResyncRef.current = true;
        // A genuine entity change was observed but is being held back — flag it so
        // a pinned caller can offer to switch.
        setResyncPending(true);
        return;
      }
      debouncedFetch();
    };

    // Refetch when the user navigates within, or switches to, an Okta tab.
    const handleTabUpdate = (
      _tabId: number,
      changeInfo: { url?: string; status?: string },
      tab: chrome.tabs.Tab,
    ) => {
      if ((changeInfo.url || changeInfo.status === 'complete') && isOktaUrl(tab.url)) {
        // A `complete` with no URL change is a document (re)load — e.g. F5 — which
        // installs a fresh content script. Force past the same-entity latch so a
        // reload always re-probes (this is the exit path out of `error`). A
        // hash-only navigation arrives as `{ url }` with no status and stays
        // suppressed.
        const isDocumentLoad = changeInfo.status === 'complete' && !changeInfo.url;
        requestFetch(changeInfo.url ?? tab.url, isDocumentLoad);
      }
    };

    const handleTabActivated = (activeInfo: { tabId: number; windowId: number }) => {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (isOktaUrl(tab.url)) requestFetch(tab.url);
      });
    };

    // When the panel is shown again after being hidden, run any owed resync once.
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        enabledRef.current &&
        pendingResyncRef.current
      ) {
        pendingResyncRef.current = false;
        fetchContextRef.current();
      }
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    chrome.tabs.onActivated.addListener(handleTabActivated);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      // Drop any in-flight backoff retry so it can't fire after unmount.
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // Registered once per hook instance; enablement/fetcher reached via refs.
  }, []);

  // Catch up an owed resync when the hook becomes enabled while the panel is shown.
  useEffect(() => {
    if (enabled && !document.hidden && pendingResyncRef.current) {
      pendingResyncRef.current = false;
      fetchContext();
    }
  }, [enabled, fetchContext]);

  return {
    data,
    connectionStatus,
    targetTabId,
    error,
    isLoading,
    refetch: fetchContext,
    oktaOrigin,
    resyncPending,
  };
}
