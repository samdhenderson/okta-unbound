import { useCallback } from 'react';
import type { GroupInfo, UserInfo } from '../../shared/types';
import {
  useOktaTabContext,
  type ConnectionStatus,
  type EntityLoadContext,
} from './useOktaTabContext';

type PageType = 'group' | 'user' | 'app' | 'admin' | 'unknown';

export interface AppInfo {
  appId: string;
  appName: string;
  appLabel?: string;
}

/** The entity state the page-context hook detects for the active Okta tab. */
interface PageDetection {
  pageType: PageType;
  groupInfo: GroupInfo | null;
  userInfo: UserInfo | null;
  appInfo: AppInfo | null;
}

export interface OktaPageContext extends PageDetection {
  connectionStatus: ConnectionStatus;
  targetTabId: number | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  oktaOrigin: string | null;
}

// Stable references (used as effect deps inside the base hook).
const UNKNOWN: PageDetection = {
  pageType: 'unknown',
  groupInfo: null,
  userInfo: null,
  appInfo: null,
};
const ADMIN: PageDetection = { pageType: 'admin', groupInfo: null, userInfo: null, appInfo: null };

/**
 * Detects which kind of Okta entity page (group / user / app) the active tab is
 * on by probing the content script for all three, and exposes the matching info.
 * Thin wrapper over {@link useOktaTabContext}.
 */
export function useOktaPageContext(): OktaPageContext {
  const loadEntity = useCallback(
    async ({ sendToTab }: EntityLoadContext): Promise<PageDetection> => {
      const [groupResponse, userResponse, appResponse] = await Promise.all([
        sendToTab<GroupInfo>('getGroupInfo'),
        sendToTab<UserInfo>('getUserInfo'),
        sendToTab<AppInfo>('getAppInfo'),
      ]);

      if (groupResponse.success && groupResponse.data) {
        return { pageType: 'group', groupInfo: groupResponse.data, userInfo: null, appInfo: null };
      }
      if (userResponse.success && userResponse.data) {
        return { pageType: 'user', groupInfo: null, userInfo: userResponse.data, appInfo: null };
      }
      if (appResponse.success && appResponse.data) {
        return { pageType: 'app', groupInfo: null, userInfo: null, appInfo: appResponse.data };
      }
      return ADMIN;
    },
    [],
  );

  const { data, ...rest } = useOktaTabContext<PageDetection>({
    scope: 'useOktaPageContext',
    initialData: UNKNOWN,
    commsFailedData: ADMIN,
    loadEntity,
  });

  return { ...data, ...rest };
}
