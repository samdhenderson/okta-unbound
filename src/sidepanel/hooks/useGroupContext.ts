/**
 * @module sidepanel/hooks/useGroupContext
 * @description Resolves the Okta group currently shown in the active browser tab.
 *
 * A thin, group-specific specialization of {@link useOktaTabContext} that asks the
 * content script for `getGroupInfo` and surfaces it alongside the shared connection/
 * tab/error state.
 */

import { useCallback } from 'react';
import type { GroupInfo } from '../../shared/types';
import {
  useOktaTabContext,
  type ConnectionStatus,
  type EntityLoadContext,
} from './useOktaTabContext';

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
  /** Re-run the tab detection and group fetch. */
  refetch: () => Promise<void>;
  /** Origin of the connected Okta org (e.g. `https://acme.okta.com`), or `null`. */
  oktaOrigin: string | null;
}

/**
 * Tracks the Okta group (if any) shown in the active tab.
 *
 * @returns The group plus shared tab-context state; see `UseGroupContextReturn`.
 */
export function useGroupContext(): UseGroupContextReturn {
  const loadEntity = useCallback(
    async ({ sendToTab }: EntityLoadContext): Promise<GroupInfo | null> => {
      const response = await sendToTab<GroupInfo>('getGroupInfo');
      return response.success && response.data ? response.data : null;
    },
    [],
  );

  const { data, ...rest } = useOktaTabContext<GroupInfo | null>({
    scope: 'useGroupContext',
    initialData: null,
    commsFailedData: null,
    loadEntity,
  });

  return { groupInfo: data, ...rest };
}
