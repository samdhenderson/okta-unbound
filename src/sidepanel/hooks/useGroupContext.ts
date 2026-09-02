/**
 * @module sidepanel/hooks/useGroupContext
 * @description Narrows the panel's single page-context engine to "the group shown
 * in the active browser tab".
 *
 * This used to be a second, group-specific {@link useOktaTabContext} instance
 * running beside {@link useOktaPageContext}: same tab lookup, same
 * `getOktaOrigin`, same content-script round trip, on every navigation. ADR-0058
 * folded the two into one engine, so this is now a **pure selector** over the
 * engine's result — no probe, no listener, no state of its own.
 *
 * The narrowing is the whole body: `pageType === 'group'` is true exactly when
 * the engine's `getGroupInfo` probe came back with data, which is the condition
 * the old hook stored its `groupInfo` under.
 */

import { useMemo } from 'react';
import type { GroupInfo } from '../../shared/types';
import type { OktaPageContext } from './useOktaPageContext';
import type { ConnectionStatus } from './useOktaTabContext';

/** Value returned by {@link useGroupContext}. */
interface UseGroupContextReturn {
  /** The group detected in the active tab, or `null` if none/not on a group page. */
  groupInfo: GroupInfo | null;
  /** Connection state to the Okta tab (connecting/connected/failed). */
  connectionStatus: ConnectionStatus;
  /** Tab id of the connected Okta session, or `null`. */
  targetTabId: number | null;
  /** Error message from the last load attempt, or `null`. */
  error: string | null;
  /** True while the group context is being (re)loaded. */
  isLoading: boolean;
  /** Re-run the tab detection and page probe. */
  refetch: () => Promise<void>;
  /** Origin of the connected Okta org (e.g. `https://acme.okta.com`), or `null`. */
  oktaOrigin: string | null;
}

/**
 * Narrows a live page context to its group, if it is on a group page.
 *
 * Takes the engine's result rather than starting one: two engines could in
 * principle disagree about which tab was active, and the fix for that is to only
 * ever have one (ADR-0058). A failed probe reports `groupInfo: null` with
 * `connectionStatus: 'error'` — the same pair the standalone hook reported, since
 * a failure now yields `pageType: 'unknown'` rather than `'admin'`.
 *
 * @param page - The panel's single {@link useOktaPageContext} result.
 * @returns The group plus the shared tab-context state; see `UseGroupContextReturn`.
 */
export function useGroupContext(page: OktaPageContext): UseGroupContextReturn {
  const {
    pageType,
    groupInfo,
    connectionStatus,
    targetTabId,
    error,
    isLoading,
    refetch,
    oktaOrigin,
  } = page;

  return useMemo(
    () => ({
      groupInfo: pageType === 'group' ? groupInfo : null,
      connectionStatus,
      targetTabId,
      error,
      isLoading,
      refetch,
      oktaOrigin,
    }),
    [pageType, groupInfo, connectionStatus, targetTabId, error, isLoading, refetch, oktaOrigin],
  );
}
