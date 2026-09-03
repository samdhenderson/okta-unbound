/**
 * @module sidepanel/components/groups/detail/GroupMembersSection
 * @description The Group Detail view's roster: the shared member explorer behind
 * this page's gated read, plus a confirm-gated per-row remove.
 *
 * One gate, one read. `useGroupSource`'s member analysis fetches the roster and
 * classifies it in the same pass, so listing the members and explaining where they
 * came from cost exactly one opt-in paginated read between them. Before it has
 * run, this renders a gated prompt rather than an empty list — an empty list would
 * read as "this group has no members," which is not the same unresolved fact as
 * "not read yet."
 *
 * ## Why there is one card here and not two
 *
 * There used to be a `GroupMembershipSourceSection` above this one: its own card,
 * its own `Analyze` button, its own idle/loading/error ladder — all driven by the
 * *same* `useGroupSource` state this section reads. Two gates for one read meant a
 * reader could load the roster and still be looking at an un-analyzed meter, and
 * the duplicate ladder is why six of that component's cases were copies of six of
 * this one's.
 *
 * Its readout is now the strip inside the explorer, where it is a filter as well
 * as a chart; its two pieces of commentary — the indeterminate correction and the
 * per-rule accounting — moved to {@link MemberSourceNotes} and render under that
 * strip. Nothing it said was dropped.
 *
 * ## What this component is now
 *
 * A **gate**, and nothing else. It used to hand-roll its own roster: a private
 * two-line row, a hard `DISPLAY_CAP = 200` slice, and a sentence pointing at Export
 * for the rest. Meanwhile `members/MemberExplorer` — search, faceted filters, MFA
 * scanning, composition reports, windowed paging, sorting — was already mounted one
 * tab over on the Overview, and already imported from this folder in three other
 * places. So the roster is the explorer, and what stays here is the part the
 * explorer must not learn:
 *
 * - **The `SourceStatus` ladder.** That vocabulary belongs to `useGroupSource`.
 *   Teaching a component two surfaces share about one surface's loading hook is how
 *   a shared component stops being shareable.
 * - **The read-only reason**, below.
 * - **The remove confirmation**, because the modal outlives the row that opened it.
 *
 * The 200-row cap is gone, not relaxed: `MemberList` mounts a page at a time and
 * grows on scroll, so DOM size is capped by the viewport rather than by a number
 * that silently hid members 201 and up.
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
 * itself. Rather than let a write fail at the API and surface a raw error, the
 * per-row remove control is **not rendered at all** — `onRemoveMember` is simply
 * withheld from the explorer (ADR-0039) — and replaced with a one-line explanation
 * of why. That sentence is the actual value here, since "why can't I edit this
 * group?" is the question a reader would otherwise have to guess at from a disabled
 * button with no tooltip.
 *
 * Deliberately silent on whether a rule re-adds a removed member: the API
 * reference's claim that it does is unverified, and the Admin Console reportedly
 * writes a rule exclusion instead. Neither sentence ships until one is confirmed.
 */
import React, { useMemo } from 'react';
import { AlertMessage, Button, DetailSection, EmptyState, Modal, Skeleton } from '../../shared';
import MemberExplorer, { type MemberSourceContext } from '../../members/MemberExplorer';
import type { MemberFilter } from '../../members/memberAnalytics';
import MemberSourceNotes from './MemberSourceNotes';
import { toMemberSourceSegments } from '../memberSourceBuckets';
import type {
  GroupMembership,
  GroupSummary,
  MemberMfaResult,
  MfaScanStatus,
  OktaUser,
} from '../../../../shared/types';
import type { MemberSourceBreakdown } from '../../../../shared/membership/groupSource';
import type { MemberSourceIndex } from '../../../../shared/membership/memberSourceIndex';
import type { MemberRuleAttribution } from '../../../../shared/membership/memberRuleAttribution';
import type { SourceStatus } from '../../../hooks/useGroupSource';
import type { MemberWriteStatus } from './useGroupMembersSection';
import { userDisplayName } from '../../../../shared/utils/userDisplay';

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
  /** Okta org origin; without it a member row's disclosure offers no deep link. */
  oktaOrigin?: string | null;

  /**
   * The analyzed manual-vs-rule split, for the explorer's source meter. `null`
   * before the analysis has produced one — the meter and the source filter pills
   * are then absent rather than empty.
   */
  breakdown: MemberSourceBreakdown | null;
  /** Per-member source classification, from the same analysis. */
  memberSourceIndex: MemberSourceIndex | null;
  /** Deep-links a contributing rule in the Rules tab. */
  onNavigateToRule?: (ruleId: string) => void;
  /**
   * Asks Okta which rules manage one member's membership (ADR-0031) — one API
   * call, from a click on an already-open row only. Absent (no live Okta tab) ⇒
   * no row offers the action.
   *
   * Most rows never need it here: `expand=group-rules` hands Okta's own
   * attribution back with the roster for free (ADR-0020), so only members whose
   * embed left the answer unknown are offered the request.
   */
  onProveMemberSource?: (userId: string) => Promise<MemberRuleAttribution>;

  /** Per-member MFA scan results, or null before a scan has run. */
  mfaResults: Map<string, MemberMfaResult> | null;
  /** Current MFA scan lifecycle status. */
  scanStatus: MfaScanStatus;
  /** Start the MFA scan. */
  onRunScan: () => void;
  /** Request the MFA scan confirmation gate (large groups). */
  onRequestConfirm: () => void;
  /** Dismiss the MFA scan confirmation gate. */
  onCancelConfirm: () => void;

  /** The member awaiting a remove confirmation, or `null`. */
  removeTarget: OktaUser | null;
  onRequestRemove: (user: OktaUser) => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  removeStatus: MemberWriteStatus;
  removeError: string | null;
  /**
   * Moves to this group's Insights tab, where the composition reports now live.
   * Absent ⇒ the explorer draws no pointer at all (ADR-0039).
   */
  onOpenInsights?: () => void;
  /**
   * A filter the Insights tab has asked the roster to apply. Passed straight
   * through to the explorer, which treats it as a one-shot request rather than
   * a controlled value — see {@link MemberExplorer}.
   */
  pendingFilter?: MemberFilter | null;
}

/**
 * Renders the group's roster through the shared member explorer, behind the single
 * gate that loads and classifies it, with a per-row confirm-gated remove.
 */
const GroupMembersSection: React.FC<GroupMembersSectionProps> = ({
  groupType,
  memberCount,
  members,
  status,
  error,
  onAnalyze,
  canAnalyze = true,
  oktaOrigin,
  breakdown,
  memberSourceIndex,
  onNavigateToRule,
  onProveMemberSource,
  mfaResults,
  scanStatus,
  onRunScan,
  onRequestConfirm,
  onCancelConfirm,
  removeTarget,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove,
  removeStatus,
  removeError,
  onOpenInsights,
  pendingFilter,
}) => {
  const hasMembers = memberCount > 0;
  const readOnlyReason = READ_ONLY_REASON[groupType];

  /*
    Index *and* breakdown, or neither. The explorer draws the meter from the
    segments and resolves its pills through the index; one without the other would
    either be a meter nothing can filter or a filter with nothing to label it.
  */
  const memberSource = useMemo<MemberSourceContext | undefined>(() => {
    if (!breakdown || !memberSourceIndex) return undefined;
    return { index: memberSourceIndex, segments: toMemberSourceSegments(breakdown) };
  }, [breakdown, memberSourceIndex]);

  /*
    The explorer's resolver is handed the membership and the row key; here only
    the row key — the member — varies, because the group is this whole page.
  */
  const proveMemberSource = useMemo(
    () =>
      onProveMemberSource
        ? (_membership: GroupMembership, userId: string) => onProveMemberSource(userId)
        : undefined,
    [onProveMemberSource],
  );

  return (
    /* Untitled: the tab is already labelled "Members", and a card headed
       "Members" inside it is the tab-level echo of ADR-0032's *the header
       describes the entity; the body must not repeat it*. */
    <DetailSection
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
          {memberCount === 1 ? '' : 's'} once, then classifies each against the rules that assign
          into this group — one read for both.
        </p>
      ) : status === 'loading' ? (
        <Skeleton variant="row" size="md" count={4} label="Loading members…" />
      ) : status === 'error' ? (
        <AlertMessage
          message={{ text: error || 'Failed to load members.', type: 'danger' }}
          action={{ label: 'Retry', onClick: onAnalyze }}
        />
      ) : !members || members.length === 0 ? (
        <EmptyState icon="users" title="No members" description="This group's roster is empty." />
      ) : (
        <MemberExplorer
          members={members}
          oktaOrigin={oktaOrigin}
          mfaResults={mfaResults}
          scanStatus={scanStatus}
          onRunScan={onRunScan}
          onRequestConfirm={onRequestConfirm}
          onCancelConfirm={onCancelConfirm}
          memberSource={memberSource}
          sourceDetail={
            breakdown ? (
              <MemberSourceNotes breakdown={breakdown} onNavigateToRule={onNavigateToRule} />
            ) : undefined
          }
          onProveMemberSource={proveMemberSource}
          onOpenInsights={onOpenInsights}
          pendingFilter={pendingFilter}
          /* Withheld, not disabled, on the read-only group types (ADR-0039). */
          onRemoveMember={readOnlyReason ? undefined : onRequestRemove}
        />
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
