import { useCallback } from 'react';
import type { GroupInfo } from '../../shared/types';
import {
  useOktaTabContext,
  type ConnectionStatus,
  type EntityLoadContext,
} from './useOktaTabContext';

interface UseGroupContextReturn {
  groupInfo: GroupInfo | null;
  connectionStatus: ConnectionStatus;
  targetTabId: number | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  oktaOrigin: string | null;
}

/**
 * Tracks the Okta group (if any) shown in the active tab. Thin wrapper over
 * {@link useOktaTabContext}.
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
