/**
 * @module sidepanel/components/users/GroupMembershipRow
 * @description One row of the Groups pane: what the group is, one verdict, one
 * source line — and everything else behind the disclosure.
 *
 * The row this replaces stacked three separate hedges on top of each other, put
 * the raw membership enum and a second group-type badge beside them, and offered
 * a "Prove it" action on every **collapsed** row. Four statements about
 * provenance, and the reader left to work out which to believe. Here the
 * collapsed row says exactly two things — {@link membershipVerdict}'s badge and
 * `membershipSourceLine`'s sentence — and the evidence, the caveat, the proof
 * action and the deep link all live inside the disclosure.
 *
 * ## Why the evidence is closed by default
 *
 * This list is as long as the user has groups. Open blocks meant a twelve-group
 * user scrolled past twelve clause checklists to reach the one they came for.
 * `.disclose` animates `grid-template-rows` with no JS measurement and holds the
 * panel `inert` while collapsed, so nothing inside it is tabbable, announced, or
 * clickable until it is open — which is also what keeps ADR-0031's proof action
 * off a row nobody has opened.
 *
 * ## Security
 *
 * Group names, rule names and condition text are untrusted, end-user-controllable
 * Okta data. They are rendered as escaped React text and never logged; the
 * condition is parsed by the shared rule parser, never by a regex or `eval`
 * (ADR-0017).
 */
import React, { useId } from 'react';
import { Badge, IconButton, ListRow, OpenInOktaLink } from '../shared';
import Icon from '../overview/shared/Icon';
import MembershipRuleEvidence from './MembershipRuleEvidence';
import MembershipProofAction, { type MembershipProofOutcome } from './GroupMembershipsListProof';
import { membershipVerdict } from './membershipVerdict';
import { membershipSourceLine } from '../../../shared/membership/sourceLine';
import type { RuleGroupContext } from '../../../shared/ruleEvaluator';
import type { GroupMembership, OktaUser } from '../../../shared/types';

/** Props for {@link GroupMembershipRow}. */
export interface GroupMembershipRowProps {
  /** The membership this row is about, as the classifier produced it. */
  membership: GroupMembership;
  /**
   * The user the membership belongs to. Supplied, each attributed rule's
   * condition is explained clause by clause against them; omitted, the raw
   * condition is shown, since an explanation would have nothing to evaluate.
   */
  user?: OktaUser;
  /**
   * The same user's **complete** group list, built once by the pane and passed
   * through unchanged, so an explained condition's `isMemberOf*` clauses resolve
   * rather than reading "Cannot be determined".
   *
   * The row never derives this: it holds one membership, and a context built from
   * one membership would report every *other* group the user is in as a clause
   * they failed (ADR-0021).
   */
  groupContext?: RuleGroupContext;
  /** Whether this group is the one being browsed elsewhere in the panel. */
  isCurrentGroup: boolean;
  /** Whether the disclosure is open. Owned by the pane, so filtering cannot close a row. */
  expanded: boolean;
  /** Toggles this row's disclosure. */
  onToggle: (groupId: string) => void;
  /** Okta origin used to build the admin-console deep link; the link hides when absent. */
  oktaOrigin?: string | null;
  /** Plays the one-shot success flash for a group that was just added this session. */
  flash?: boolean;
  /**
   * Applications this group grants, when the caller knows them. **Absent is not
   * empty** — the line is omitted entirely rather than claiming the group grants
   * nothing (`docs/components.md`, "Unknown is not zero").
   */
  appNames?: string[];
  /** Whether the surface can prove a membership at all (a resolver was supplied). */
  proofEnabled: boolean;
  /** Where this row's proof request has got to, or `undefined` before anyone asked. */
  proofOutcome?: MembershipProofOutcome;
  /** Asks Okta about this one membership (ADR-0031) — one API call, from a click only. */
  onProve: (membership: GroupMembership) => void;
}

/**
 * One membership row: name, verdict, source line, and a disclosure holding the
 * evidence.
 *
 * @param props - See {@link GroupMembershipRowProps}.
 */
const GroupMembershipRow: React.FC<GroupMembershipRowProps> = ({
  membership,
  user,
  groupContext,
  isCurrentGroup,
  expanded,
  onToggle,
  oktaOrigin,
  flash = false,
  appNames,
  proofEnabled,
  proofOutcome,
  onProve,
}) => {
  const { group, rules } = membership;
  const line = membershipSourceLine(membership);
  const verdict = membershipVerdict(membership);
  // `useId`, not the group id: a DOM id built from untrusted Okta data is a
  // selector waiting to break, and React already hands out a unique one.
  const disclosureId = useId();
  const groupName = group.profile.name;

  return (
    <ListRow
      density="compact"
      state={isCurrentGroup ? 'highlighted' : 'default'}
      flash={flash}
      dataAttributes={{ 'data-group-id': group.id }}
      body={
        /*
          `.disclose` animates `grid-template-rows` between 0fr and 1fr, so the
          panel collapses to zero height with no JS measurement and stays mounted
          while closed — held out of the tab order and the accessibility tree by
          `inert`, which is what stops a collapsed row offering the proof action.
        */
        <div
          id={disclosureId}
          className="disclose"
          data-open={expanded}
          inert={!expanded || undefined}
        >
          <div>
            <div className="space-y-3 border-t border-neutral-200 px-3 pb-3 pt-2">
              {/* 1. The caveat in full — the collapsed row only had room for its first clause. */}
              <p className="text-xs text-pretty text-neutral-600">{line.description}</p>

              {/* 2. The evidence: one card per attributed rule. */}
              {rules.map((rule) => (
                <MembershipRuleEvidence
                  key={rule.id}
                  rule={rule}
                  user={user}
                  groupContext={groupContext}
                />
              ))}

              {/*
                3. The link across to the Apps pane, and only when the caller
                actually knows the answer — this row never fetches it.
              */}
              {appNames && appNames.length > 0 && (
                <p className="text-xs text-neutral-600">
                  <span className="font-medium text-neutral-700">Also grants:</span>{' '}
                  {appNames.join(', ')}
                </p>
              )}

              {/*
                4. The way out of the deduction. One explicit call asks Okta about
                this one membership and states the answer as a fact (ADR-0031). It
                sits below the evidence deliberately: the row reads as "here is
                what we worked out — and here is what Okta says".
              */}
              {proofEnabled && (
                <MembershipProofAction
                  membership={membership}
                  outcome={proofOutcome}
                  onProve={onProve}
                />
              )}

              {/* 5. Okta's own page for the group. */}
              <OpenInOktaLink oktaOrigin={oktaOrigin} entityType="group" entityId={group.id} />
            </div>
          </div>
        </div>
      }
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-neutral-900">{groupName}</h4>
            {isCurrentGroup && (
              <Badge variant="primary" className="shrink-0">
                On page
              </Badge>
            )}
          </div>

          {/*
            One source line, not three. The caption stays its own node so it is
            findable as a phrase and so a label expecting a value ("Added by
            Rule:") is not glued to the rule names that follow it.
          */}
          <p className="mt-0.5 truncate text-xs text-neutral-600">
            <span>{line.caption}</span>
            {line.detail && <span> {line.detail}</span>}
          </p>
        </div>

        <Badge variant={verdict.variant} title={verdict.title} className="shrink-0">
          {verdict.label}
        </Badge>

        <IconButton
          label={`${expanded ? 'Hide' : 'Show'} how ${groupName} was granted`}
          variant="ghost"
          size="sm"
          expanded={expanded}
          controls={disclosureId}
          className="shrink-0"
          onClick={() => onToggle(group.id)}
        >
          <Icon
            type="chevron-right"
            size="sm"
            className={`transition-transform duration-(--dur-quick) ${expanded ? 'rotate-90' : ''}`}
          />
        </IconButton>
      </div>
    </ListRow>
  );
};

export default GroupMembershipRow;
