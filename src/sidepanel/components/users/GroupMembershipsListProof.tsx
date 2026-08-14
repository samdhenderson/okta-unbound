/**
 * @module sidepanel/components/users/GroupMembershipsListProof
 * @description The per-row "Prove it" affordance on the user-detail memberships
 * list: one explicit request that converts one hedged guess into Okta's own
 * answer.
 *
 * Everything else on that surface is a client-side deduction, because
 * `GET /api/v1/users/{id}/groups` carries no attribution embed (ADR-0020). ADR-0031
 * adds the documented way out — `GET /api/v1/groups/{groupId}/users/{userId}/group-rules`
 * — and this is its UI.
 *
 * ## Why it is a button and never an effect
 *
 * The read is **one call per membership**. A user in forty groups is forty
 * requests, so running it for a whole list would spend an admin's rate limit to
 * answer a question nobody asked. It is gated behind a click, per row, always —
 * which is also what makes it defensible under ADR-0020's rejection of the
 * *cached aggregate* alternative: this answer is fresh, explicit, and about this
 * exact member.
 *
 * ## The three outcomes, kept three
 *
 * Okta naming rules and Okta naming none are both **answers** and both render as
 * facts. Okta saying nothing — an absent embed, a malformed body, or a failed
 * request — renders as no answer at all, leaving the classifier's hedged line
 * standing. Collapsing the last two would manufacture "added directly" out of a
 * failed request, which is the exact defect ADR-0020 §4 removed from this path.
 *
 * Rule names are end-user-controllable Okta data: rendered as escaped React text,
 * never logged here.
 */
import React, { useCallback, useState } from 'react';
import { Button } from '../shared';
import Icon from '../overview/shared/Icon';
import { membershipSourceLine, sourceLineLabel } from '../../../shared/membership/sourceLine';
import { withMembershipProvenance } from '../../../shared/membership/provenance';
import type { MemberRuleAttribution } from '../../../shared/membership/memberRuleAttribution';
import type { GroupMembership } from '../../../shared/types';

/**
 * What has happened to one row's proof request.
 *
 * `unanswered` is deliberately one state and not two: a request that failed and a
 * request Okta answered with nothing are the same thing to a reader — no answer —
 * and neither may be shown as one.
 */
export type MembershipProofOutcome =
  | { status: 'pending' }
  | { status: 'proven'; membership: GroupMembership }
  | { status: 'unanswered' };

/** What {@link useMembershipProofs} hands back to the list. */
export interface MembershipProofs {
  /** The outcome for one group's row, or `undefined` when it was never asked about. */
  outcomeFor: (groupId: string) => MembershipProofOutcome | undefined;
  /** Ask Okta about one membership. A row already in flight is not re-sent. */
  prove: (membership: GroupMembership) => void;
  /** Whether the surface can prove anything at all (a resolver was supplied). */
  enabled: boolean;
}

/**
 * Per-row proof state for the memberships list.
 *
 * Keyed by group id, because that is what identifies a row on this surface — the
 * user is fixed for the whole list, and the resolver closes over them.
 *
 * @param onProve - Asks Okta about one group, resolving to its three-state
 * answer. Omitted, the feature is off and no row renders an action.
 * @returns The {@link MembershipProofs} handle.
 */
export function useMembershipProofs(
  onProve?: (groupId: string) => Promise<MemberRuleAttribution>,
): MembershipProofs {
  const [outcomes, setOutcomes] = useState<Record<string, MembershipProofOutcome>>({});

  const prove = useCallback(
    (membership: GroupMembership) => {
      if (!onProve) return;
      const groupId = membership.group.id;

      setOutcomes((current) => {
        if (current[groupId]?.status === 'pending') return current;
        return { ...current, [groupId]: { status: 'pending' } };
      });

      void onProve(groupId)
        // A rejected request is an absent answer, never a manual add.
        .catch((): MemberRuleAttribution => ({ state: 'unknown' }))
        .then((answer) => {
          const proven = withMembershipProvenance(membership, answer);
          setOutcomes((current) => ({
            ...current,
            [groupId]: proven.provenance
              ? { status: 'proven', membership: proven }
              : { status: 'unanswered' },
          }));
        });
    },
    [onProve],
  );

  const outcomeFor = useCallback((groupId: string) => outcomes[groupId], [outcomes]);

  return { outcomeFor, prove, enabled: Boolean(onProve) };
}

/** Props for {@link MembershipProofAction}. */
interface MembershipProofActionProps {
  /** The membership this row is about, as the classifier produced it. */
  membership: GroupMembership;
  /** Where this row has got to, or `undefined` before anyone asked. */
  outcome?: MembershipProofOutcome;
  /** Invoked to ask Okta about this membership. */
  onProve: (membership: GroupMembership) => void;
}

/**
 * The row's proof strip: the action before an answer, Okta's answer after one,
 * and an honest "no answer" when Okta said nothing.
 *
 * The proven line comes from `membershipSourceLine` — the same function that
 * words every other membership sentence on this surface and on the comparison's
 * diff row — reading the membership *with* its provenance attached, so the fact
 * and the deduction cannot drift into two different vocabularies.
 *
 * @param props - See {@link MembershipProofActionProps}.
 */
const MembershipProofAction: React.FC<MembershipProofActionProps> = ({
  membership,
  outcome,
  onProve,
}) => {
  if (outcome?.status === 'proven') {
    const line = membershipSourceLine(outcome.membership);
    const label = sourceLineLabel(line);
    return (
      <div
        className="mt-3 rounded-md border border-success-light bg-success-light p-3"
        title={`${label} — ${line.description}`}
      >
        <p className="flex items-center gap-2 text-xs font-medium text-success-text">
          <Icon type="check" size="xs" className="shrink-0" />
          {label}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        icon="shield"
        loading={outcome?.status === 'pending'}
        onClick={() => onProve(membership)}
        title="Ask Okta which rules manage this membership (one API call)"
      >
        Prove it
      </Button>
      {outcome?.status === 'unanswered' && (
        // Not a failure of the membership, and not an answer about it: the row
        // above still stands, unchanged and still hedged.
        <span className="text-xs italic text-neutral-500">
          Okta did not answer for this membership — the classification above still stands as a
          deduction.
        </span>
      )}
    </div>
  );
};

export default MembershipProofAction;
