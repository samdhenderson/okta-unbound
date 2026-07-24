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

/**
 * A frozen snapshot of the Overview context. When present the panel holds this
 * entity (ignoring live tab navigation) so the user can cross-reference another
 * Okta page without losing their place; unpinning resumes live detection.
 */
export interface PinnedContext {
  pageType: 'group' | 'user';
  groupInfo: GroupInfo | null;
  userInfo: UserInfo | null;
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
