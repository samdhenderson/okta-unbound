/**
 * @module sidepanel/components/members/MemberRow
 * @description Single member row: name, email, login, status badge, MFA factor
 * tags, and a disclosure explaining the member.
 *
 * Memoized (large lists). The card is
 * {@link sidepanel/components/shared/ListRow} at `compact` density (ADR-0029) —
 * the row used to carry its own hand-written chrome string. The interior follows
 * the typography contract in `docs/design-system.md`, which retired three
 * arbitrary sizes here (`text-[11px]` on the login, `text-[10px]` on the factor
 * tags and the status badge).
 *
 * ## Why the row is no longer a link
 *
 * It used to render `ListRow as="a"` whenever an org origin was known, making the
 * whole card a deep link to the Okta Admin Console. That forecloses everything
 * else: a disclosure chevron — or a remove control — inside an anchor is axe's
 * `nested-interactive`, and `ListRow`'s own guidance names the case ("a button
 * cannot legally contain a checkbox or another button"). So the row stops being a
 * link and the deep link moves **inside** the disclosure, which is where both
 * reference rows already put it (`users/GroupMembershipRow`, `users/UserAppRow`).
 *
 * `StretchedButton` was the other way to keep a whole-row target, and is
 * deliberately not used: its contract requires every sibling control to be
 * `relative z-10`, so a row carrying both a chevron and a remove button would owe
 * two escape hatches for an activation the chevron already owns.
 *
 * ## Why it borrows from `users/`
 *
 * The disclosure explains *this membership* — the source line, the attributed
 * rules, the clause-by-clause condition, and ADR-0031's "Ask Okta". Those are the
 * same four things `users/GroupMembershipRow` says about the mirror-image case
 * (one user's many groups vs one group's many users), so this row composes that
 * surface's components rather than growing a second vocabulary for the same
 * facts — which is the failure `shared/membership/sourceLine` was written to fix.
 * `users/MembershipRuleEvidence` already reaches the other way for
 * `groups/detail/ClauseChecklist`, so the direction is not new.
 *
 * **No `groupContext` is passed**, and that is deliberate. This surface holds one
 * group's roster, not each member's complete group list, so an `isMemberOf*`
 * clause has nothing here to resolve against. `ClauseChecklist` reports those as
 * "Cannot be determined", which is true; a context built from the one group in
 * hand would instead report every *other* group a member belongs to as a clause
 * they failed (ADR-0021).
 *
 * ## Who owns `expanded`
 *
 * The **list**, not the row — the same arrangement as
 * `users/GroupMembershipsList`, and for the same reason: filtering a row out and
 * back in must not close it. That matters more here, where every filter pill
 * click re-filters the list under the reader.
 *
 * ## The restraint pass (2026-08-28)
 *
 * The login line renders **only when it differs from the email** above it. Most
 * Okta orgs provision `login === email`, so the header used to print the same
 * string twice on every row in the list — a real admin tool needs to see the
 * login *when it is a different fact*, not restate one it already stated. The
 * value is never dropped: when the two match, the email line already carries it
 * verbatim.
 *
 * The status badge and the MFA factor/"No MFA" tags now go through the shared
 * {@link sidepanel/components/shared/Badge} rather than a hand-rolled
 * `<span>` + local colour map — the same recipe drift `Badge`'s own module doc
 * describes, just not yet converged here.
 */
import React, { useId } from 'react';
import type { GroupMembership, OktaUser, MemberMfaResult } from '../../../shared/types';
import { Badge, IconButton, ListRow, OpenInOktaLink, userStatusVariant } from '../shared';
import Icon from '../shared/Icon';
import MembershipRuleEvidence from '../users/MembershipRuleEvidence';
import MembershipProofAction, {
  type MembershipProofOutcome,
} from '../users/GroupMembershipsListProof';
import { membershipVerdict } from '../users/membershipVerdict';
import { membershipSourceLine } from '../../../shared/membership/sourceLine';
import { userDisplayName } from '../../../shared/utils/userDisplay';
import { EXCLUDED_ATTRIBUTES, dimensionTitle } from './memberAnalytics';

/** Props for {@link MemberRow}. */
interface MemberRowProps {
  /** The member to render. */
  user: OktaUser;
  /** This member's MFA scan result, if available. */
  mfa?: MemberMfaResult;
  /** True once an MFA scan has completed, so we can show "No MFA" for 0-factor users. */
  mfaScanned?: boolean;
  /** Okta org origin; when set, the disclosure offers an Admin Console deep link. */
  oktaOrigin?: string | null;
  /** Whether this row's disclosure is open. Owned by the list — see the module docs. */
  expanded: boolean;
  /** Called with this member's id when the disclosure control is pressed. */
  onToggle: (userId: string) => void;
  /**
   * Request removal of this member from the group. **Omitted means the control
   * is not rendered at all** — never rendered `disabled` (ADR-0039). Surfaces
   * where a membership write would be rejected (`APP_GROUP`, `BUILT_IN`) leave
   * it out and explain why once, above the list, rather than per row.
   */
  onRemove?: (user: OktaUser) => void;
  /**
   * Why this member is in the group, as the classifier produced it. Absent ⇒ the
   * disclosure carries the profile and the deep link only — the row says nothing
   * about source rather than guessing at one.
   */
  membership?: GroupMembership;
  /** Whether the surface can prove a membership at all (a resolver was supplied). */
  proofEnabled?: boolean;
  /** Where this row's proof request has got to, or `undefined` before anyone asked. */
  proofOutcome?: MembershipProofOutcome;
  /**
   * Asks Okta about this one membership (ADR-0031) — one API call, from a click
   * only. Called with this member's id as the row key: a `GroupMembership`
   * describes a group, not the person it was granted to, and every row on this
   * surface shares one group.
   */
  onProve?: (membership: GroupMembership, rowKey: string) => void;
}

/**
 * The member's browseable profile attributes — the same set the composition
 * facets offer, so a value that looks wrong in a row is a value the reader can
 * go and filter on. Identity/PII fields are excluded there and excluded here;
 * they carry no spread, and the two that matter are already on the row header.
 *
 * @param user - The member.
 * @returns `[key, value]` pairs with a non-empty scalar value, key-sorted.
 */
function browseableAttributes(user: OktaUser): Array<[string, string]> {
  const profile = user.profile as Record<string, unknown>;
  return Object.entries(profile)
    .filter(([key]) => !EXCLUDED_ATTRIBUTES.has(key))
    .map(([key, raw]): [string, string] => {
      if (typeof raw === 'string') return [key, raw.trim()];
      if (typeof raw === 'number' || typeof raw === 'boolean') return [key, String(raw)];
      // Objects, arrays and null have no scalar rendering here, and inventing
      // one ("[object Object]") would read as a real value.
      return [key, ''];
    })
    .filter(([, value]) => value !== '')
    .sort(([a], [b]) => a.localeCompare(b));
}

/** Renders one member card with its disclosure. */
const MemberRow: React.FC<MemberRowProps> = ({
  user,
  mfa,
  mfaScanned,
  oktaOrigin,
  expanded,
  onToggle,
  onRemove,
  membership,
  proofEnabled = false,
  proofOutcome,
  onProve,
}) => {
  // The shared helper, not a local `first + last || login`: the remove control's
  // accessible name is what a caller's test pins, and it has to be the same
  // string the header shows.
  const fullName = userDisplayName(user);

  // `useId`, never the user id: an Okta id is untrusted data and does not belong
  // in a DOM id (the same reasoning as `users/GroupMembershipRow`).
  const disclosureId = useId();
  const attributes = browseableAttributes(user);
  const line = membership ? membershipSourceLine(membership) : null;
  const verdict = membership ? membershipVerdict(membership) : null;
  // Most Okta orgs provision `login === email` — see the module doc's restraint
  // note. An exact-string compare so any real difference (case, a suffix) still
  // shows both lines.
  const loginDiffersFromEmail = user.profile.login !== user.profile.email;

  return (
    <ListRow
      density="compact"
      dataAttributes={{ 'data-user-id': user.id }}
      body={
        /* `.disclose` animates `grid-template-rows` between 0fr and 1fr, so the
             body collapses to zero height with no JS measurement and stays mounted
             while closed — held out of the tab order and the accessible tree by
             `inert` rather than unmounted. */
        <div
          id={disclosureId}
          className="disclose"
          data-open={expanded}
          inert={!expanded || undefined}
        >
          <div>
            <div className="space-y-3 border-t border-neutral-200 px-(--sp-row-x) pb-3 pt-2">
              {/* 1. The caveat in full — the header line only had room for its first clause. */}
              {line && <p className="text-xs text-pretty text-neutral-600">{line.description}</p>}

              {/* 2. The evidence: one card per attributed rule, its condition
                     evaluated against *this* member. */}
              {membership?.rules.map((rule) => (
                <MembershipRuleEvidence key={rule.id} rule={rule} user={user} />
              ))}

              {attributes.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-medium text-neutral-600">Profile</div>
                  <dl className="space-y-0.5">
                    {attributes.map(([key, value]) => (
                      <div key={key} className="flex items-baseline justify-between gap-3">
                        <dt className="shrink-0 text-xs text-neutral-600">{dimensionTitle(key)}</dt>
                        <dd className="min-w-0 truncate font-mono text-xs text-neutral-900">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/*
                3. The way out of a deduction. On this surface most rows never need
                it: `expand=group-rules` hands Okta's own attribution back with the
                roster, for free (ADR-0020), so the action is offered only where
                that embed left the answer unknown — spending a request to re-learn
                a fact already in hand is exactly what ADR-0031 gates against.
              */}
              {membership && onProve && proofEnabled && !membership.provenance && (
                <MembershipProofAction
                  membership={membership}
                  outcome={proofOutcome}
                  onProve={(target) => onProve(target, user.id)}
                />
              )}

              <OpenInOktaLink oktaOrigin={oktaOrigin} entityType="user" entityId={user.id} />
            </div>
          </div>
        </div>
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-neutral-900">{fullName}</div>
          <div className="truncate text-xs text-neutral-600">{user.profile.email}</div>
          {/* Most orgs provision login === email; printing both would restate the
              same fact twice on every row of a list that can run to thousands. */}
          {loginDiffersFromEmail && (
            <div className="truncate font-mono text-xs text-neutral-500">{user.profile.login}</div>
          )}
          {/*
            One source line, not three. The caption stays its own node so it is
            findable as a phrase and so a label expecting a value ("Added by
            rule:") is not glued to the rule names that follow it — the same
            shape `users/GroupMembershipRow` uses for the mirror-image case.
          */}
          {line && (
            <p className="mt-0.5 truncate text-xs text-neutral-600">
              <span>{line.caption}</span>
              {line.detail && <span> {line.detail}</span>}
            </p>
          )}
          {mfaScanned && (
            <div className="mt-1.5 flex flex-wrap gap-(--sp-inline)">
              {mfa && mfa.factorLabels.length > 0 ? (
                mfa.factorLabels.map((label) => (
                  <Badge key={label} variant="info">
                    {label}
                  </Badge>
                ))
              ) : (
                <Badge variant="danger">No MFA</Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-(--sp-inline)">
          {/*
            `flex-wrap` because this is a side panel: at the 360px floor the
            verdict and the status no longer fit one line beside a long name, and
            wrapping beats squeezing the name to a few characters.
          */}
          {verdict && (
            <Badge variant={verdict.variant} title={verdict.title}>
              {verdict.label}
            </Badge>
          )}
          <Badge variant={userStatusVariant(user.status)}>{user.status}</Badge>
          {onRemove && (
            /* In the header, beside the chevron — not inside the disclosure. A
               destructive verb a reader has to expand a row to find is worse UX
               than one in plain sight, and the row is no longer an anchor, so
               there is no `nested-interactive` cost to a second control here. */
            <IconButton
              label={`Remove ${fullName} from this group`}
              variant="danger"
              size="sm"
              onClick={() => onRemove(user)}
            >
              <Icon type="trash" size="sm" />
            </IconButton>
          )}
          <IconButton
            label={`${expanded ? 'Hide' : 'Show'} details for ${fullName}`}
            variant="ghost"
            size="sm"
            expanded={expanded}
            controls={disclosureId}
            onClick={() => onToggle(user.id)}
          >
            <Icon
              type="chevron-right"
              size="sm"
              className={`transition-transform duration-(--dur-quick) ${expanded ? 'rotate-90' : ''}`}
            />
          </IconButton>
        </div>
      </div>
    </ListRow>
  );
};

export default React.memo(MemberRow);
