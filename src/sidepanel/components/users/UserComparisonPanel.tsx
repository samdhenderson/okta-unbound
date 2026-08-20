/**
 * @module sidepanel/components/users/UserComparisonPanel
 * @description View-stack host for the two-user comparison — the Users tab's mount site.
 *
 * The Users-tab counterpart of {@link UserComparisonModal}: it owns the
 * {@link sidepanel/hooks/useUserComparison.useUserComparison} instance and renders
 * the shared {@link UserComparisonView} with no dialog chrome, because the tab shows
 * the comparison as a **pushed view** (ADR-0016) — one `PageHeader` above it carries
 * the title, the breadcrumb trail and the back affordance.
 *
 * It stays mounted while the tab is at the root of its view stack, exactly as the
 * browse body stays mounted while a view is pushed, so the comparison's own state is
 * cleared by `useUserComparison`'s reset effect rather than by an unmount, and so the
 * element focus is restored to on `pop` is still in the document. That makes two
 * obligations concrete, both of which are the host's to meet:
 *
 * - {@link UserComparisonPanelProps.isActive} — false while popped, which is what
 *   drives the reset. A stale comparison is otherwise exactly what a mounted view
 *   would show on the next push.
 * - {@link UserComparisonPanelProps.searchEnabled} — false while popped *or* while
 *   the whole tab is hidden, so a mounted comparison never becomes a background
 *   caller of the Okta user-search API (ADR-0018).
 */
import React from 'react';
import UserComparisonView from './UserComparisonView';
import { useUserComparison } from '../../hooks/useUserComparison';
import type { OktaUser, GroupMembership } from '../../../shared/types';

/** Props for {@link UserComparisonPanel}. */
export interface UserComparisonPanelProps {
  /**
   * Whether a comparison view is currently pushed. Going false resets the
   * comparison, so the next push starts from a pristine search phase.
   */
  isActive: boolean;
  /**
   * Whether the debounced user search may reach Okta — i.e. the comparison is
   * pushed *and* the Users tab is the selected tab (ADR-0018).
   */
  searchEnabled: boolean;
  /** The "context" user being compared from (the tab's selected user). */
  contextUser: OktaUser;
  /** The context user's group memberships, used as the left-hand comparison baseline. */
  contextGroups: GroupMembership[];
  /**
   * Okta org origin. Two uses: the deep link offered for a group the user must
   * *leave* (absent, the link simply does not render), and the cache/storage key
   * for the org profile schema and the admin's profile display configuration
   * behind the Attributes tab (absent, both fall back to defaults).
   */
  oktaOrigin?: string | null;
  /** Tab id of the Okta admin tab; API calls are scheduled against it. */
  targetTabId: number;
  /** Called after a group is copied onto the context user so the tab can refresh it. */
  onGroupsChanged: () => void;
  /**
   * Publishes a context-user profile save back to whoever owns that user.
   *
   * The context user is the Users tab's `selectedUser`, held in React state
   * rather than in the entity cache, so a save here is invisible to the rest of
   * the tab unless it is lifted. **Without this prop the left column is
   * deliberately read-only** — an edit that reached Okta with nothing to publish
   * it would leave both this panel and the Profile pane rendering values Okta no
   * longer holds, silently.
   */
  onContextUserUpdated?: (user: OktaUser) => void;
}

/**
 * Hosts the comparison surface inside the Users tab's view stack.
 *
 * @param props - See {@link UserComparisonPanelProps}.
 */
const UserComparisonPanel: React.FC<UserComparisonPanelProps> = ({
  isActive,
  searchEnabled,
  contextUser,
  contextGroups,
  oktaOrigin,
  targetTabId,
  onGroupsChanged,
  onContextUserUpdated,
}) => {
  const comparison = useUserComparison({
    isActive,
    searchEnabled,
    contextUser,
    contextGroups,
    targetTabId,
    // Also what keys the org profile schema and the admin's profile display
    // config behind the Attributes tab, not only the deep link below.
    oktaOrigin,
    onGroupsChanged,
    onContextUserUpdated,
  });

  return (
    <UserComparisonView contextUser={contextUser} comparison={comparison} oktaOrigin={oktaOrigin} />
  );
};

export default UserComparisonPanel;
