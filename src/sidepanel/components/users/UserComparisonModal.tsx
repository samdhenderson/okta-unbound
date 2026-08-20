/**
 * @module sidepanel/components/users/UserComparisonModal
 * @description Dialog host for the two-user comparison — the Overview tab's mount site.
 *
 * A thin shell around {@link UserComparisonView}: it owns the
 * {@link sidepanel/hooks/useUserComparison.useUserComparison} instance, the dialog
 * chrome (title, Close) and nothing else.
 *
 * The Users tab shows the same comparison as a **pushed view** instead
 * ({@link UserComparisonPanel}, ADR-0016). {@link UserOverview} has no view stack —
 * giving it one would be a much larger change than the comparison warrants — so the
 * dialog stays for that mount site, and the shared surface between the two is
 * {@link UserComparisonView}.
 *
 * The hook is instantiated **here**, above `Modal`, because `Modal` unmounts its
 * children when closed: calling it inside would make an unmount, rather than
 * `useUserComparison`'s `isActive`-keyed reset effect, the thing that clears a
 * finished comparison. That mount lifetime is unchanged from before the split.
 */
import React from 'react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import UserComparisonView from './UserComparisonView';
import { useUserComparison } from '../../hooks/useUserComparison';
import type { OktaUser, GroupMembership } from '../../../shared/types';

/** Props for {@link UserComparisonModal}. */
interface UserComparisonModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Closes the modal. */
  onClose: () => void;
  /** The "context" user being compared from (the user currently in focus). */
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
  /** Called after a group is successfully copied onto the context user so the parent can refresh. */
  onGroupsChanged: () => void;
  /**
   * Publishes a context-user profile save back to whoever owns that user. The
   * Overview rung holds its user in the entity cache, so it republishes there;
   * absent, the left column stays read-only rather than accepting an edit
   * nothing would re-render from.
   */
  onContextUserUpdated?: (user: OktaUser) => void;
}

/**
 * Modal that compares the context user against a second, searched-for user,
 * showing shared/unique groups and app assignments and allowing missing groups
 * to be copied onto the context user.
 */
const UserComparisonModal: React.FC<UserComparisonModalProps> = ({
  isOpen,
  onClose,
  contextUser,
  contextGroups,
  oktaOrigin,
  targetTabId,
  onGroupsChanged,
  onContextUserUpdated,
}) => {
  const comparison = useUserComparison({
    isActive: isOpen,
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={comparison.comparedUser ? 'Side-by-side comparison' : 'Compare with another user'}
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <UserComparisonView
        contextUser={contextUser}
        comparison={comparison}
        oktaOrigin={oktaOrigin}
      />
    </Modal>
  );
};

export default UserComparisonModal;
