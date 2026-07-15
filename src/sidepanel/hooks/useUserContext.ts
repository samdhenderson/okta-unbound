/**
 * @module sidepanel/hooks/useUserContext
 * @description Tracks the Okta user shown in the active tab.
 *
 * Thin wrapper over `useOktaTabContext` whose `loadEntity` asks the content
 * script for the current page's user info.
 */

import { useCallback } from 'react';
import type { UserInfo } from '../../shared/types';
import {
  useOktaTabContext,
  type ConnectionStatus,
  type EntityLoadContext,
} from './useOktaTabContext';

/** Return shape of {@link useUserContext}. */
interface UseUserContextReturn {
  userInfo: UserInfo | null;
  connectionStatus: ConnectionStatus;
  targetTabId: number | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  oktaOrigin: string | null;
}

/**
 * Tracks the Okta user (if any) shown in the active tab. Thin wrapper over
 * {@link useOktaTabContext}.
 *
 * @returns `userInfo` (the current page's user, or `null` when the tab is not a
 *   user page) plus shared connection state (`connectionStatus`, `targetTabId`,
 *   `error`, `isLoading`, `refetch`, `oktaOrigin`).
 */
export function useUserContext(): UseUserContextReturn {
  const loadEntity = useCallback(
    async ({ sendToTab }: EntityLoadContext): Promise<UserInfo | null> => {
      const response = await sendToTab<UserInfo>('getUserInfo');
      return response.success && response.data ? response.data : null;
    },
    [],
  );

  const { data, ...rest } = useOktaTabContext<UserInfo | null>({
    scope: 'useUserContext',
    initialData: null,
    commsFailedData: null,
    loadEntity,
  });

  return { userInfo: data, ...rest };
}
