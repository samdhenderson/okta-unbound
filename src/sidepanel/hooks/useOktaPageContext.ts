/**
 * @module sidepanel/hooks/useOktaPageContext
 * @description Detects whether the active Okta tab is a group / user / app / admin page.
 *
 * A thin wrapper over `useOktaTabContext` that probes the content script for all
 * three entity kinds at once and exposes whichever one matched.
 */

import { useCallback } from 'react';
import type { GroupInfo, UserInfo } from '../../shared/types';
import {
  useOktaTabContext,
  type ConnectionStatus,
  type EntityLoadContext,
} from './useOktaTabContext';

/** Kind of Okta page the side panel detects for the active tab. */
export type PageType = 'group' | 'user' | 'app' | 'admin' | 'unknown';

/** Identifying details for an Okta application page. */
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

/** Detected page entity merged with the shared tab-context connection state. */
export interface OktaPageContext extends PageDetection {
  connectionStatus: ConnectionStatus;
  targetTabId: number | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  oktaOrigin: string | null;
  /** See {@link OktaTabContext.resyncPending}. */
  resyncPending: boolean;
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
 * on by probing the content script for all three in parallel, and exposes the
 * matching info. Falls back to `admin` when none match. Thin wrapper over
 * {@link useOktaTabContext}.
 *
 * @param enabled - When `false`, live re-detection on navigation is suspended
 *   (a resync is deferred until re-enabled while the panel is visible). Defaults
 *   to `true`. Used to scope detection to the active Overview tab.
 * @returns The detected `pageType` with the corresponding `groupInfo` /
 *   `userInfo` / `appInfo` (the others `null`), plus shared connection state
 *   (`connectionStatus`, `targetTabId`, `error`, `isLoading`, `refetch`,
 *   `oktaOrigin`).
 */
export function useOktaPageContext(enabled = true): OktaPageContext {
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
    enabled,
  });

  return { ...data, ...rest };
}
