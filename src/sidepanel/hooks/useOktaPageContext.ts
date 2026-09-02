/**
 * @module sidepanel/hooks/useOktaPageContext
 * @description The side panel's **single** live page-context engine: detects whether
 * the active Okta tab is a group / user / app / policy / admin page.
 *
 * A thin wrapper over `useOktaTabContext` that probes the content script for all
 * four entity kinds at once and exposes whichever one matched.
 *
 * Since ADR-0058 this is the one always-on `useOktaTabContext` instance in the
 * panel: `App` calls it once and {@link useGroupContext} is a pure selector over
 * its result rather than a second probe. One engine means one `getOktaOrigin`, one
 * entity probe and one connection latch per navigation, and the masthead and the
 * feature tabs can no longer disagree about which page the browser is on.
 *
 * Two fields describe the outcome and they are deliberately **not** merged
 * (ADR-0058):
 *
 * - `connectionStatus` says whether the probe succeeded at all.
 * - `pageType` says what the page is, and is only meaningful once
 *   `connectionStatus === 'connected'`. A probe that failed reports
 *   `'unknown'` — never `'admin'`, which would claim the successful answer
 *   "this is an admin console page that is not an entity" for a probe that
 *   learnt nothing.
 */

import { useCallback } from 'react';
import type { AppInfo, GroupInfo, UserInfo, PolicyInfo } from '../../shared/types';
import {
  useOktaTabContext,
  type ConnectionStatus,
  type EntityLoadContext,
} from './useOktaTabContext';

/** Kind of Okta page the side panel detects for the active tab. */
export type PageType = 'group' | 'user' | 'app' | 'policy' | 'admin' | 'unknown';

/** The entity state the page-context hook detects for the active Okta tab. */
interface PageDetection {
  pageType: PageType;
  groupInfo: GroupInfo | null;
  userInfo: UserInfo | null;
  appInfo: AppInfo | null;
  policyInfo: PolicyInfo | null;
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

/** No entity detected — the base every positive detection overrides one field of. */
const NO_ENTITY = { groupInfo: null, userInfo: null, appInfo: null, policyInfo: null } as const;

// Stable references (used as effect deps inside the base hook).
const UNKNOWN: PageDetection = { pageType: 'unknown', ...NO_ENTITY };
const ADMIN: PageDetection = { pageType: 'admin', ...NO_ENTITY };

/**
 * Detects which kind of Okta entity page (group / user / app / policy) the active
 * tab is on by probing the content script for all four in parallel, and exposes the
 * matching info. Falls back to `admin` when none match **and the probe succeeded**.
 * Thin wrapper over {@link useOktaTabContext}, and the panel's only instance of it
 * (ADR-0058).
 *
 * @param enabled - When `false`, live re-detection on navigation is suspended
 *   (a resync is deferred until re-enabled while the panel is visible). Defaults
 *   to `true`, which is what `App` uses.
 *
 *   It is **not** gated on any tab — {@link ContextBar} renders above the rail on
 *   every one of them, and a tab-gated feed would leave the bar misdescribing the
 *   live page from the other eight (ADR-0032). ADR-0018's rule is that no hidden
 *   *tab* issues Okta traffic; ADR-0026's visibility gate lives inside
 *   {@link useOktaTabContext} and still stops a hidden panel probing.
 *
 *   It is no longer gated on `!isPinned` either. Under two engines a pin could
 *   freeze this one because connection health came from the *other* one; with a
 *   single engine, freezing it would freeze the health readout too, and a pinned
 *   panel reporting a permanent green "connected" is exactly the defect the
 *   always-on group engine existed to prevent. The pin is therefore applied where
 *   identity is *selected*, in `App`, not by suspending detection (ADR-0058).
 * @returns The detected `pageType` with the corresponding `groupInfo` /
 *   `userInfo` / `appInfo` / `policyInfo` (the others `null`), plus shared
 *   connection state (`connectionStatus`, `targetTabId`, `error`, `isLoading`,
 *   `refetch`, `oktaOrigin`). `pageType` is only meaningful while
 *   `connectionStatus === 'connected'`.
 */
export function useOktaPageContext(enabled = true): OktaPageContext {
  const loadEntity = useCallback(
    async ({ sendToTab }: EntityLoadContext): Promise<PageDetection> => {
      const [groupResponse, userResponse, appResponse, policyResponse] = await Promise.all([
        sendToTab<GroupInfo>('getGroupInfo'),
        sendToTab<UserInfo>('getUserInfo'),
        sendToTab<AppInfo>('getAppInfo'),
        sendToTab<PolicyInfo>('getPolicyInfo'),
      ]);

      if (groupResponse.success && groupResponse.data) {
        return { ...NO_ENTITY, pageType: 'group', groupInfo: groupResponse.data };
      }
      if (userResponse.success && userResponse.data) {
        return { ...NO_ENTITY, pageType: 'user', userInfo: userResponse.data };
      }
      if (appResponse.success && appResponse.data) {
        return { ...NO_ENTITY, pageType: 'app', appInfo: appResponse.data };
      }
      if (policyResponse.success && policyResponse.data) {
        return { ...NO_ENTITY, pageType: 'policy', policyInfo: policyResponse.data };
      }
      return ADMIN;
    },
    [],
  );

  const { data, ...rest } = useOktaTabContext<PageDetection>({
    scope: 'useOktaPageContext',
    initialData: UNKNOWN,
    // A probe that never landed knows nothing about the page, so it reports
    // `unknown`. It used to report `admin`, which is the *successful* answer
    // "this is an admin console page carrying no entity" — so a dead content
    // script rendered a masthead indistinguishable from a healthy landing page
    // (ADR-0058).
    commsFailedData: UNKNOWN,
    loadEntity,
    enabled,
  });

  return { ...data, ...rest };
}
