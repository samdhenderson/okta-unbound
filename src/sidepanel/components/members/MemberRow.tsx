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
 * ## Who owns `expanded`
 *
 * The **list**, not the row — the same arrangement as
 * `users/GroupMembershipsList`, and for the same reason: filtering a row out and
 * back in must not close it. That matters more here, where every filter pill
 * click re-filters the list under the reader.
 */
import React, { useId } from 'react';
import type { OktaUser, MemberMfaResult } from '../../../shared/types';
import {
  IconButton,
  ListRow,
  OpenInOktaLink,
  userStatusVariant,
  type UserStatusVariant,
} from '../shared';
import Icon from '../overview/shared/Icon';
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
}

/** Per-variant badge color classes (token palette, keyed by the shared variant map). */
const VARIANT_CLASSES: Record<UserStatusVariant, string> = {
  success: 'bg-success-light text-success-text',
  info: 'bg-primary-light text-primary-text',
  warning: 'bg-warning-light text-warning-text',
  danger: 'bg-danger-light text-danger-text',
  neutral: 'bg-neutral-100 text-neutral-700',
};

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
}) => {
  const badgeClass = VARIANT_CLASSES[userStatusVariant(user.status)];
  // The shared helper, not a local `first + last || login`: the remove control's
  // accessible name is what a caller's test pins, and it has to be the same
  // string the header shows.
  const fullName = userDisplayName(user);

  // `useId`, never the user id: an Okta id is untrusted data and does not belong
  // in a DOM id (the same reasoning as `users/GroupMembershipRow`).
  const disclosureId = useId();
  const attributes = browseableAttributes(user);

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
            <div className="space-y-3 border-t border-neutral-200 px-3 pb-3 pt-2">
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
          <div className="truncate font-mono text-xs text-neutral-500">{user.profile.login}</div>
          {mfaScanned && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {mfa && mfa.factorLabels.length > 0 ? (
                mfa.factorLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-md bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-text"
                  >
                    {label}
                  </span>
                ))
              ) : (
                <span className="rounded-md bg-danger-light px-2 py-0.5 text-xs font-medium text-danger-text">
                  No MFA
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
            {user.status}
          </span>
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
