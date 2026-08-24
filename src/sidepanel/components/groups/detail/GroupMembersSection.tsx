/**
 * @module sidepanel/components/groups/detail/GroupMembersSection
 * @description The Group Detail view's roster: displays members and, per row, a
 * confirm-gated remove.
 *
 * Piggybacks on the same gated read {@link GroupMembershipSourceSection} already
 * offers — the roster this section lists is the exact `OktaUser[]` the member-source
 * analysis fetches, so opening this section costs nothing beyond that one opt-in
 * paginated read. Before that analysis has run, the section renders a gated prompt
 * (mirroring the source section's own idle state) rather than an empty list — an
 * empty list would read as "this group has no members," which is not the same
 * unresolved fact as "not read yet."
 *
 * Adding a member does not live here — it's the action bar's
 * {@link module:sidepanel/components/groups/detail/GroupActionBar}
 * "Add" button, which opens
 * {@link module:sidepanel/components/groups/detail/AddGroupMemberModal.AddGroupMemberModal}
 * (ADR-0039). This section used to carry its own inline add search field; it was
 * removed once the modal shipped, so there is exactly one add affordance rather
 * than two.
 *
 * Presentational: the caller owns
 * {@link sidepanel/components/groups/detail/useGroupMembersSection.useGroupMembersSection}
 * and passes its state through, so every mutation state (the remove confirm,
 * in-flight/error flags) lives outside this component.
 *
 * ## Why `APP_GROUP` and `BUILT_IN` are read-only here
 *
 * Okta rejects a direct membership write on both — `APP_GROUP` membership is
 * imported from the app that owns the group (`useOktaApi/groupCleanup.ts` already
 * refuses to touch one), and `BUILT_IN` groups (e.g. Everyone) are managed by Okta
 * itself. Rather than let a write fail at the API and surface a raw error, this
 * section's per-row remove control is hidden entirely and replaced with a
 * one-line explanation of why — that sentence is the actual value here, since
 * "why can't I edit this group?" is the question a reader would otherwise have
 * to guess at from a disabled button with no tooltip.
 *
 * Deliberately silent on whether a rule re-adds a removed member: the API
 * reference's claim that it does is unverified, and the Admin Console reportedly
 * writes a rule exclusion instead. Neither sentence ships until one is confirmed.
 */
import React from 'react';
import {
  AlertMessage,
  Button,
  DetailSection,
  EmptyState,
  IconButton,
  ListRow,
  Modal,
  Skeleton,
} from '../../shared';
import Icon from '../../overview/shared/Icon';
import type { GroupSummary, OktaUser } from '../../../../shared/types';
import type { SourceStatus } from '../../../hooks/useGroupSource';
import type { MemberWriteStatus } from './useGroupMembersSection';
import { userDisplayName } from '../../../../shared/utils/userDisplay';

/** Members beyond this count are not rendered — see {@link GroupMembersSection}. */
const DISPLAY_CAP = 200;

/** One-line explanation for why a group type's membership can't be edited here. */
const READ_ONLY_REASON: Partial<Record<GroupSummary['type'], string>> = {
  APP_GROUP:
    "Membership here is imported from the app that owns this group, so Okta doesn't allow editing it directly.",
  BUILT_IN: "This is one of Okta's built-in groups — its membership is managed by Okta, not here.",
};

/** Props for {@link GroupMembersSection}. */
export interface GroupMembersSectionProps {
  /** Determines whether add/remove controls render at all — see the module doc. */
  groupType: GroupSummary['type'];
  /** The group's member count, used for the pre-analysis cost estimate. */
  memberCount: number;
  /** The roster, once the shared member analysis has populated it. */
  members: OktaUser[] | null;
  /** Status of the shared member-source analysis this section reads from. */
  status: SourceStatus;
  /** Error message when that analysis failed. */
  error: string | null;
  /** Runs the shared member-source analysis (identical to the source section's own gate). */
  onAnalyze: () => void;
  /** `false` when no Okta tab is connected, which disables every gate/write. */
  canAnalyze?: boolean;

  /** The member awaiting a remove confirmation, or `null`. */
  removeTarget: OktaUser | null;
  onRequestRemove: (user: OktaUser) => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  removeStatus: MemberWriteStatus;
  removeError: string | null;
}

/** One member row: name/email/login, plus a remove button unless the section is read-only. */
const MemberListRow: React.FC<{
  user: OktaUser;
  readOnly: boolean;
  onRequestRemove: (user: OktaUser) => void;
}> = ({ user, readOnly, onRequestRemove }) => (
  <ListRow as="li" density="compact">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-neutral-900">
          {userDisplayName(user)}
        </div>
        <div className="truncate text-xs text-neutral-600">{user.profile.email}</div>
      </div>
      {!readOnly && (
        <IconButton
          label={`Remove ${userDisplayName(user)} from this group`}
          variant="danger"
          size="sm"
          onClick={() => onRequestRemove(user)}
        >
          <Icon type="trash" size="sm" />
        </IconButton>
      )}
    </div>
  </ListRow>
);

/**
 * Renders the group's roster with a per-row, confirm-gated remove, gated behind
 * the same member-source analysis {@link GroupMembershipSourceSection} offers.
 */
const GroupMembersSection: React.FC<GroupMembersSectionProps> = ({
  groupType,
  memberCount,
  members,
  status,
  error,
  onAnalyze,
  canAnalyze = true,
  removeTarget,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove,
  removeStatus,
  removeError,
}) => {
  const hasMembers = memberCount > 0;
  const readOnlyReason = READ_ONLY_REASON[groupType];
  const readOnly = readOnlyReason !== undefined;
  const visibleMembers = members ? members.slice(0, DISPLAY_CAP) : [];
  const truncated = (members?.length ?? 0) > DISPLAY_CAP;

  return (
    <DetailSection
      title="Members"
      description="The group's roster, read from the same analysis above."
      actions={
        status === 'idle' && hasMembers ? (
          <Button
            variant="secondary"
            size="sm"
            icon="users"
            onClick={onAnalyze}
            disabled={!canAnalyze}
          >
            Load members
          </Button>
        ) : undefined
      }
    >
      {readOnlyReason && <p className="mb-3 text-xs text-neutral-500">{readOnlyReason}</p>}

      {!hasMembers ? (
        <p className="text-sm text-neutral-500">This group has no members.</p>
      ) : status === 'idle' ? (
        <p className="text-sm text-neutral-500">
          Not loaded yet. Reads all {memberCount.toLocaleString()} member
          {memberCount === 1 ? '' : 's'} once — the same read the analysis above uses, so loading
          here costs nothing extra once that analysis has already run.
        </p>
      ) : status === 'loading' ? (
        <Skeleton variant="row" size="md" count={4} label="Loading members…" />
      ) : status === 'error' ? (
        <AlertMessage
          message={{ text: error || 'Failed to load members.', type: 'danger' }}
          action={{ label: 'Retry', onClick: onAnalyze }}
        />
      ) : (
        <div className="space-y-3">
          {visibleMembers.length === 0 ? (
            <EmptyState
              icon="users"
              title="No members"
              description="This group's roster is empty."
            />
          ) : (
            <>
              <ul className="space-y-1.5">
                {visibleMembers.map((user) => (
                  <MemberListRow
                    key={user.id}
                    user={user}
                    readOnly={readOnly}
                    onRequestRemove={onRequestRemove}
                  />
                ))}
              </ul>
              {truncated && (
                <p className="text-xs text-neutral-500">
                  Showing the first {DISPLAY_CAP} of {members?.length.toLocaleString()} members. Use
                  Export members above for the full list.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <Modal
        isOpen={removeTarget !== null}
        onClose={onCancelRemove}
        title="Remove member"
        footer={
          <>
            <Button variant="secondary" onClick={onCancelRemove}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onConfirmRemove}
              loading={removeStatus === 'loading'}
              disabled={removeStatus === 'loading'}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          This will remove <strong>{removeTarget ? userDisplayName(removeTarget) : ''}</strong> from
          this group. This action cannot be undone.
        </p>
        {removeError && (
          <AlertMessage message={{ text: removeError, type: 'danger' }} className="mt-3" />
        )}
      </Modal>
    </DetailSection>
  );
};

export default GroupMembersSection;
