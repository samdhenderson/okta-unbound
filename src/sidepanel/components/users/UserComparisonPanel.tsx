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
  /** Tab id of the Okta admin tab; API calls are scheduled against it. */
  targetTabId: number;
  /** Called after a group is copied onto the context user so the tab can refresh it. */
  onGroupsChanged: () => void;
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
  targetTabId,
  onGroupsChanged,
}) => {
  const comparison = useUserComparison({
    isActive,
    searchEnabled,
    contextUser,
    contextGroups,
    targetTabId,
    onGroupsChanged,
  });

  return <UserComparisonView contextUser={contextUser} comparison={comparison} />;
};

export default UserComparisonPanel;
