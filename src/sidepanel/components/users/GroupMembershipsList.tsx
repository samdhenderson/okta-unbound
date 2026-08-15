/**
 * @module sidepanel/components/users/GroupMembershipsList
 * @description Renders a user's group memberships, distinguishing direct vs rule-based membership.
 *
 * Direct/rule-based classification is heuristic — the Okta API does not expose
 * which rule (if any) added a user. A rule-based row renders one block per
 * attributed rule, captioned by the membership's `attribution` so a candidate from
 * a guess never reads as the rule that added the user, each carrying a deep link to
 * the Rules tab and — when the user is supplied — that rule's condition explained
 * **clause by clause** against them
 * ({@link sidepanel/components/groups/detail/ClauseChecklist}) instead of a flat
 * expression dump. The card header exposes an `actions` slot for caller-supplied
 * controls (e.g. the "Add to Group" button in UsersTab).
 *
 * A caller can mark one row as the freshly-added group (e.g. right after
 * UsersTab's "Add to Group" flow succeeds) via `recentlyAddedGroupId`; that row
 * plays a one-shot `animate-affirm-flash` so the confirmation lands on the group
 * that changed rather than only in a banner above the fold.
 *
 * Every classification here is a **deduction** — this endpoint carries no
 * attribution embed (ADR-0020). Supply `onProveMembershipSource` and each row
 * gains a "Prove it" action that replaces its guess with Okta's own answer for
 * that one membership (ADR-0031); see
 * {@link sidepanel/components/users/GroupMembershipsListProof}. It is one API
 * call per row and is never run automatically.
 */
import React, { useId, useState } from 'react';
import { Badge, EntityLink, IconButton, Skeleton, type BadgeVariant } from '../shared';
import Icon from '../overview/shared/Icon';
import ClauseChecklist from '../groups/detail/ClauseChecklist';
import MembershipProofAction, { useMembershipProofs } from './GroupMembershipsListProof';
import { membershipSourceLine, sourceLineLabel } from '../../../shared/membership/sourceLine';
import type { MemberRuleAttribution } from '../../../shared/membership/memberRuleAttribution';
import type { GroupMembership, MembershipRule, OktaUser } from '../../../shared/types';
import { oktaAdminEntityUrl } from '../../../shared/utils/oktaUrl';

/**
 * A rule's condition expression, whichever shape the rule arrived in — the same
 * two-source fallback the classifier uses
 * (`shared/utils/membershipAnalysis.conditionExpressionOf`, which is
 * module-private). The Users tab supplies a `FormattedRule`, which carries
 * `conditionExpression` and no `conditions` at all, so reading only
 * `conditions.expression.value` here rendered nothing on this surface.
 *
 * An empty result is *not* "no conditions, so everything passes": it is reported
 * as unevaluable, and {@link ClauseChecklist} says so.
 */
const conditionExpressionOf = (rule: MembershipRule): string =>
  rule.conditionExpression || rule.conditions?.expression?.value || '';

/** Props for {@link GroupMembershipsList}. */
interface GroupMembershipsListProps {
  /** The user's group memberships, each already classified as direct or rule-based. */
  memberships: GroupMembership[];
  /**
   * The user the memberships belong to. When supplied, a rule-based row explains
   * that rule's condition clause by clause against them; without it the row falls
   * back to showing the raw condition, since an explanation would have nothing to
   * evaluate against.
   */
  user?: OktaUser;
  /** When true, shows a spinner instead of the list. */
  isLoading: boolean;
  /** Group id to visually highlight as the "current" group, if any. */
  currentGroupId?: string;
  /** Okta origin used to build admin-console deep links; links are hidden when absent. */
  oktaOrigin?: string | null;
  /** Caller-supplied header controls, rendered on the right of the title row. */
  actions?: React.ReactNode;
  /**
   * Id of a group that was just successfully added this session; its row plays a
   * one-shot `animate-affirm-flash` (success background/border fading to
   * transparent) instead of the confirmation only showing in a banner. Absent or
   * non-matching ids render no flash.
   */
  recentlyAddedGroupId?: string | null;
  /**
   * Asks Okta which rules manage one membership
   * (`GET /api/v1/groups/{groupId}/users/{userId}/group-rules`), resolving to its
   * three-state answer. Supplied, every row gains a "Prove it" action; omitted,
   * the surface stays exactly as it was.
   *
   * **One API call per row**, so it is invoked only from that click — never for
   * the list, and never on mount.
   */
  onProveMembershipSource?: (groupId: string) => Promise<MemberRuleAttribution>;
}

/** Props for {@link RuleEvidence}. */
interface RuleEvidenceProps {
  /** One rule this membership is attributed to. */
  rule: MembershipRule;
  /** The user to explain the rule's condition against; omitted, the raw condition is shown. */
  user?: OktaUser;
}

/**
 * One attributed rule inside the evidence disclosure: a link to it, and its
 * condition explained clause by clause against the user.
 *
 * It deliberately carries **no caption**. The chip above the disclosure already
 * says how much the attribution is worth ("Added by Rule:" / "Possible rule:"),
 * and repeating that phrase once per rule was how this surface used to read —
 * three hedges stacked down the row for a single hedged answer.
 */
const RuleEvidence: React.FC<RuleEvidenceProps> = ({ rule, user }) => (
  <div className="rounded-md border border-neutral-200 bg-white p-3">
    <EntityLink type="rule" id={rule.id} name={rule.name} />
    <div className="mt-2">
      <span className="mb-1 block text-xs font-semibold text-neutral-600">Condition</span>
      {user ? (
        <ClauseChecklist expression={conditionExpressionOf(rule)} user={user} />
      ) : (
        <code className="block overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs text-neutral-900">
          {conditionExpressionOf(rule) || 'No condition expression'}
        </code>
      )}
    </div>
  </div>
);

/**
 * Maps a membership type to its {@link Badge} variant.
 *
 * This used to return `badge badge-info` / `badge-success` / `badge-muted` —
 * class names whose CSS was dropped in the Tailwind v4 migration and never
 * replaced, so the badge rendered as unstyled inline text. The shared primitive
 * is what stops that being expressible.
 */
const membershipTypeVariant = (type: string): BadgeVariant => {
  switch (type) {
    case 'RULE_BASED':
      return 'primary';
    case 'DIRECT':
      return 'success';
    default:
      return 'neutral';
  }
};

/**
 * A membership's answer, and — when there is rule evidence behind it — a way to
 * check that evidence without it occupying the row until asked for.
 *
 * The chip is always visible and is the whole answer for most rows: a proven
 * classification reads as a chip, a deduction or a missing one reads muted, and
 * the fuller caveat rides on `title`. That split is `membershipSourceLine`'s
 * `proven`, shared with the comparison view so the same evidence never reads two
 * different ways on two screens.
 *
 * The evidence sits behind a disclosure because this list is as long as the user
 * has groups. Always-open blocks meant a twelve-group user scrolled past twelve
 * clause checklists to find the one they came for; closed by default, the row is
 * one line and the proof is one click. `.disclose` animates `grid-template-rows`
 * with no JS measurement and holds the panel `inert` while collapsed, so nothing
 * inside it is tabbable or announced until it is open.
 */
const MembershipSourceRow: React.FC<{
  membership: GroupMembership;
  user?: OktaUser;
}> = ({ membership, user }) => {
  const line = membershipSourceLine(membership);
  const label = sourceLineLabel(line);
  const [open, setOpen] = useState(false);
  const evidenceId = useId();
  const rules = membership.rules;
  const hasEvidence = rules.length > 0;

  return (
    <div className="mt-3">
      <div className="flex items-start justify-between gap-2">
        <span
          className={
            line.proven
              ? 'min-w-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700'
              : 'min-w-0 text-xs italic text-neutral-500'
          }
          title={`${label} — ${line.description}`}
        >
          {/* Its own node so the caption stays findable as a phrase, and so a
              label expecting a value ("Added by Rule:") is not glued to it. */}
          <span>{line.caption}</span>
          {line.detail && <span> {line.detail}</span>}
        </span>

        {hasEvidence && (
          <IconButton
            label={open ? 'Hide the condition' : 'Check the condition'}
            variant="ghost"
            size="sm"
            expanded={open}
            controls={evidenceId}
            className="shrink-0"
            onClick={() => setOpen((v: boolean) => !v)}
          >
            <Icon
              type="chevron-right"
              size="sm"
              className={`transition-transform duration-(--dur-quick) ${open ? 'rotate-90' : ''}`}
            />
          </IconButton>
        )}
      </div>

      {hasEvidence && (
        <div id={evidenceId} className="disclose" data-open={open} inert={!open || undefined}>
          <div>
            <div className="space-y-2 pt-2">
              {rules.map((rule) => (
                <RuleEvidence key={rule.id} rule={rule} user={user} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Displays a list of group memberships for a user, with direct/rule-based badges,
 * rule-condition detail for rule-based rows, and optional admin-console deep links.
 */
const GroupMembershipsList: React.FC<GroupMembershipsListProps> = ({
  memberships,
  user,
  isLoading,
  currentGroupId,
  oktaOrigin,
  actions,
  recentlyAddedGroupId,
  onProveMembershipSource,
}) => {
  const proofs = useMembershipProofs(onProveMembershipSource);

  const highlightCurrentGroup = (groupId: string) => {
    return currentGroupId && groupId === currentGroupId;
  };

  return (
    <div className="rounded-md border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">
          Group Memberships ({memberships.length})
        </h3>
        {actions}
      </div>

      {isLoading ? (
        // The rows are a known `p-4` card, so the placeholder previews them rather
        // than spinning. Sits inside the same `p-4 space-y-3` body the rows use, so
        // nothing shifts when they land.
        <div className="p-4">
          <Skeleton variant="row" size="lg" count={4} label="Loading group memberships..." />
        </div>
      ) : memberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-neutral-500 text-sm">This user is not a member of any groups</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {memberships.map((membership) => (
            <div
              key={membership.group.id}
              className={`
                rounded-md border p-4 transition-all duration-(--dur-instant)
                ${
                  highlightCurrentGroup(membership.group.id)
                    ? 'border-primary bg-primary-light ring-1 ring-primary/20'
                    : 'border-neutral-200 bg-white hover:border-neutral-500'
                }
                ${membership.group.id === recentlyAddedGroupId ? 'animate-affirm-flash' : ''}
              `}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h4 className="font-semibold text-neutral-900 text-sm">
                      {membership.group.profile.name}
                    </h4>
                    {highlightCurrentGroup(membership.group.id) && (
                      <span className="px-2 py-0.5 rounded-md bg-primary text-white text-xs font-bold">
                        Current Group
                      </span>
                    )}
                    {oktaOrigin && (
                      <IconButton
                        label="Open group in Okta admin"
                        onClick={() => {
                          const url = oktaAdminEntityUrl(oktaOrigin, 'group', membership.group.id);
                          if (url) window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                        variant="ghost"
                        size="md"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </IconButton>
                    )}
                  </div>
                  {membership.group.profile.description && (
                    <p className="text-xs text-neutral-600">
                      {membership.group.profile.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Badge variant={membershipTypeVariant(membership.membershipType)}>
                    {membership.membershipType.replace('_', ' ')}
                  </Badge>
                  <Badge variant="neutral">{membership.group.type}</Badge>
                </div>
              </div>

              {/*
                One path for every membership, instead of three branches that
                between them left three cases rendering nothing at all. The chip
                is the answer; rule evidence, when there is any, is one click
                below it rather than pushed into the row whether or not anyone
                wanted it.
              */}
              <MembershipSourceRow membership={membership} user={user} />

              {/*
                The deduction above stays exactly as it was; this is the way out
                of it. One explicit call asks Okta about this one membership and
                states the answer as a fact (ADR-0031). It is deliberately last:
                the row reads as "here is what we worked out — and here is what
                Okta says", not the other way round.
              */}
              {proofs.enabled && (
                <MembershipProofAction
                  membership={membership}
                  outcome={proofs.outcomeFor(membership.group.id)}
                  onProve={proofs.prove}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupMembershipsList;
