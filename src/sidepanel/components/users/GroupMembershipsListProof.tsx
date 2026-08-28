/**
 * @module sidepanel/components/users/GroupMembershipsListProof
 * @description The per-row "Ask Okta" affordance on the user-detail memberships
 * list: one explicit request that converts one hedged guess into Okta's own
 * answer.
 *
 * It lives **inside the row's disclosure** (never on a collapsed row), so the
 * cost is offered to a reader who has already opened the row they care about
 * rather than once per group in a list nobody has looked at yet.
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
import Icon from '../shared/Icon';
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
  /** The outcome for one row, or `undefined` when it was never asked about. */
  outcomeFor: (rowKey: string) => MembershipProofOutcome | undefined;
  /**
   * Ask Okta about one membership. A row already in flight is not re-sent.
   *
   * `rowKey` identifies the row the answer belongs to, defaulting to the group —
   * see the hook's note on why a roster must override it.
   */
  prove: (membership: GroupMembership, rowKey?: string) => void;
  /** Whether the surface can prove anything at all (a resolver was supplied). */
  enabled: boolean;
}

/**
 * Per-row proof state for a list of memberships.
 *
 * **The row key is the caller's**, because the two surfaces that need this vary
 * along opposite axes. The user-detail memberships list holds one user's many
 * groups, so the group identifies the row and the default is right. A group's
 * roster holds one group's many *users*: every row there carries the same group
 * id, so the default would collapse them onto one entry and one member's answer
 * would light up every row. That surface passes the member's id instead.
 *
 * A `GroupMembership` deliberately does not name the member it belongs to — it
 * describes a group and how it was granted — which is why the key is an argument
 * at call time rather than a function of the membership.
 *
 * @param onProve - Asks Okta about one membership, resolving to its three-state
 * answer. Receives the row key alongside it, since that is the only place the
 * varying half of the membership is named — a roster's resolver needs the member
 * and the membership cannot supply one. Omitted, the feature is off and no row
 * renders an action.
 * @returns The {@link MembershipProofs} handle.
 */
export function useMembershipProofs(
  onProve?: (membership: GroupMembership, rowKey: string) => Promise<MemberRuleAttribution>,
): MembershipProofs {
  const [outcomes, setOutcomes] = useState<Record<string, MembershipProofOutcome>>({});

  const prove = useCallback(
    (membership: GroupMembership, key?: string) => {
      if (!onProve) return;
      const rowKey = key ?? membership.group.id;

      setOutcomes((current) => {
        if (current[rowKey]?.status === 'pending') return current;
        return { ...current, [rowKey]: { status: 'pending' } };
      });

      void onProve(membership, rowKey)
        // A rejected request is an absent answer, never a manual add.
        .catch((): MemberRuleAttribution => ({ state: 'unknown' }))
        .then((answer) => {
          const proven = withMembershipProvenance(membership, answer);
          setOutcomes((current) => ({
            ...current,
            [rowKey]: proven.provenance
              ? { status: 'proven', membership: proven }
              : { status: 'unanswered' },
          }));
        });
    },
    [onProve],
  );

  const outcomeFor = useCallback((rowKey: string) => outcomes[rowKey], [outcomes]);

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
        className="mt-3 rounded-md border border-success-light bg-success-light p-(--sp-card)"
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
    <div className="mt-3 flex flex-wrap items-center gap-(--sp-inline)">
      <Button
        variant="secondary"
        size="sm"
        icon="shield"
        loading={outcome?.status === 'pending'}
        onClick={() => onProve(membership)}
        title="Ask Okta which rules manage this membership (one API call)"
      >
        Ask Okta
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
