/**
 * @module sidepanel/pinContext
 * @description The pinned-context snapshot and the pin-aware resolver that decides
 * which entity the feature tabs (Rules/Users/Groups/Export) operate on.
 *
 * The Overview tab can *pin* the current group/user so the panel holds that entity
 * while the admin navigates another Okta page to cross-reference. Without a pin the
 * feature tabs follow the live, always-on tab context (`useGroupContext`); with one
 * they must follow the frozen snapshot instead — otherwise "View Rules" or an export
 * launched while pinned would silently target whatever the live tab drifted to.
 */
import type { GroupInfo, UserInfo } from '../shared/types';
import { isOktaUrl } from '../shared/utils/oktaUrl';
import type { PageType } from './hooks/useOktaPageContext';

/**
 * The subset of {@link PageType} values that can be pinned. Widening pinning to a
 * new entity kind (e.g. `'app'`) is a one-line change here; the `Extract` keeps
 * this union provably in sync with the canonical `PageType`.
 */
export type PinnablePageType = Extract<PageType, 'group' | 'user'>;

/**
 * A frozen snapshot of the Overview context. When present the panel holds this
 * entity (ignoring live tab navigation) so the user can cross-reference another
 * Okta page without losing their place; unpinning resumes live detection.
 */
export interface PinnedContext {
  pageType: PinnablePageType;
  groupInfo: GroupInfo | null;
  userInfo: UserInfo | null;
  /**
   * Chrome tab id the pinned entity's API calls are routed through. Chrome tab ids
   * are per-session, so a persisted pin's id goes stale as soon as the tab (or the
   * browser) is closed. It is therefore **revalidated on restore** by
   * {@link revalidatePinnedContext}, which may rewrite it to a live Okta tab or
   * drop the pin entirely when no Okta tab is open.
   */
  targetTabId: number;
  oktaOrigin: string | null;
}

/** The live, always-on tab context (from `useGroupContext`) used when unpinned. */
export interface LiveTabContext {
  targetTabId: number | null;
  groupInfo: GroupInfo | null;
  oktaOrigin: string | null;
}

/** The resolved context handed to the feature tabs. */
export interface TabContext {
  /** Chrome tab id to route API calls through. */
  targetTabId: number | null;
  /** The group id the tabs treat as "current" (undefined for a pinned user / no group). */
  currentGroupId: string | undefined;
  /** Okta org origin for building "View in Okta" links. */
  oktaOrigin: string | null;
}

/**
 * Resolve the context the feature tabs should use: the pinned snapshot when a pin
 * is active, otherwise the live always-on context.
 *
 * Deliberately uses the live `useGroupContext` values (not the Overview-only page
 * probe) for the unpinned case, so the tabs keep a live tab id even while the user
 * is away from the Overview tab.
 *
 * @param pinned - The active pin snapshot, or null when following live detection.
 * @param live - The live always-on tab context.
 * @returns The `targetTabId`/`currentGroupId`/`oktaOrigin` the tabs should consume.
 */
export function deriveTabContext(pinned: PinnedContext | null, live: LiveTabContext): TabContext {
  if (pinned) {
    return {
      targetTabId: pinned.targetTabId,
      currentGroupId: pinned.groupInfo?.groupId,
      oktaOrigin: pinned.oktaOrigin,
    };
  }
  return {
    targetTabId: live.targetTabId,
    currentGroupId: live.groupInfo?.groupId,
    oktaOrigin: live.oktaOrigin,
  };
}

/**
 * Revalidate a persisted pin snapshot against the browser's live tabs.
 *
 * A pin is persisted to `chrome.storage.local` so it survives the side panel being
 * closed — but its `targetTabId` is a per-session Chrome id. After a browser restart
 * (or once the pinned tab is closed) that id points at nothing, and restoring the
 * snapshot blindly leaves the panel pinned to a dead tab where every API call fails.
 *
 * The snapshot's *identity* (entity, page type, origin) is still worth keeping, so
 * this only re-targets the transport: if the saved tab is gone — or has navigated
 * off Okta — it re-resolves to a live Okta tab in the current window using the same
 * selection rule as `useOktaTabContext` (prefer the active tab, else the first).
 *
 * Every "is this Okta?" decision goes through `shared/utils/oktaUrl`.
 *
 * @param saved - The pin snapshot loaded from storage.
 * @returns `saved` unchanged when its tab is still a live Okta tab; a copy with
 *   `targetTabId` rewritten to a live Okta tab when one exists; or `null` when no
 *   Okta tab is open in the current window, meaning the caller should drop the pin.
 */
export async function revalidatePinnedContext(saved: PinnedContext): Promise<PinnedContext | null> {
  try {
    const tab = await chrome.tabs.get(saved.targetTabId);
    if (isOktaUrl(tab.url)) return saved;
  } catch {
    // The tab no longer exists — fall through and re-resolve against live tabs.
  }

  try {
    const currentWindow = await chrome.windows.getCurrent();
    const tabsInWindow = await chrome.tabs.query({ windowId: currentWindow.id });
    const oktaTabs = tabsInWindow.filter((tab) => isOktaUrl(tab.url));
    // Prefer the active Okta tab, otherwise the first one (matches useOktaTabContext).
    const liveTab = oktaTabs.find((t) => t.active) ?? oktaTabs[0];
    if (!liveTab || liveTab.id == null) return null;
    return { ...saved, targetTabId: liveTab.id };
  } catch {
    return null;
  }
}
