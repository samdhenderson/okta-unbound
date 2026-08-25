/**
 * @module sidepanel/components/groups/detail/GroupAppRow
 * @description One app the group is assigned to: what it is, whether it is live,
 * and — behind the disclosure — how it is wired.
 *
 * Replaces the `EntityLink` chip this list used to be. A chip could say only
 * "Slack", so a reader could not tell an `ACTIVE` SAML app from a deactivated
 * bookmark without leaving the page, and there was nothing to interact with
 * beyond a jump to the Apps tab. The row is the same shape as `users/UserAppRow`
 * and `members/MemberRow`: two facts in the header, everything else disclosed.
 *
 * ## What is *not* here
 *
 * Nothing this row shows costs a request, and nothing it does not show is
 * fetched to fill a gap. `AppGrant` carries exactly what
 * `GET /api/v1/groups/{id}/apps` already returned; an absent field is rendered
 * as absent (no badge, no line) rather than as "Unknown", because the schema
 * catches unexpected values precisely so a row degrades instead of vanishing.
 *
 * ## Security
 *
 * App labels, sign-on modes and target group names are end-user-controllable
 * Okta data: escaped React text, never logged. The deep link is built by the
 * shared `OpenInOktaLink` from a validated origin plus a validated id.
 */
import React, { useId } from 'react';
import {
  Badge,
  CopyableId,
  EntityLink,
  Eyebrow,
  IconButton,
  ListRow,
  OpenInOktaLink,
} from '../../shared';
import Icon from '../../overview/shared/Icon';
import { formatDate } from '../../../../shared/utils/dateFormat';
import type { GroupAppRowModel } from '../groupAppSource';

/** Props for {@link GroupAppRow}. */
export interface GroupAppRowProps {
  /** The row's whole rendered model, derived by `groupAppSource`. */
  row: GroupAppRowModel;
  /** Whether this row's disclosure is open. Owned by the list. */
  expanded: boolean;
  /** Called with this app's id when the disclosure control is pressed. */
  onToggle: (appId: string) => void;
  /** Okta org origin for the admin-console deep link; the link hides when absent. */
  oktaOrigin?: string | null;
}

/** One assigned app, with its detail disclosure. */
const GroupAppRow: React.FC<GroupAppRowProps> = ({ row, expanded, onToggle, oktaOrigin }) => {
  // `useId`, not the app id: an Okta id is untrusted data and does not belong in
  // a DOM id (the same reasoning as every other row of this shape).
  const disclosureId = useId();

  return (
    <ListRow
      as="li"
      density="compact"
      dataAttributes={{ 'data-app-id': row.id }}
      body={
        /* `.disclose` animates `grid-template-rows` between 0fr and 1fr, so the
           panel collapses to zero height with no JS measurement and stays
           mounted while closed — held out of the tab order and the accessible
           tree by `inert` rather than unmounted. */
        <div
          id={disclosureId}
          className="disclose"
          data-open={expanded}
          inert={!expanded || undefined}
        >
          <div>
            <div className="space-y-3 border-t border-neutral-200 px-3 pb-3 pt-2">
              <div>
                <Eyebrow as="div" className="mb-1">
                  Application ID
                </Eyebrow>
                <CopyableId
                  value={row.id}
                  label={`Copy application id for ${row.label}`}
                  className="w-full"
                />
              </div>

              {row.signOnMode && (
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="shrink-0 text-neutral-600">Sign-on mode</span>
                  <span className="min-w-0 truncate font-mono text-neutral-900">
                    {row.signOnMode}
                  </span>
                </div>
              )}

              {row.lastUpdated && (
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="shrink-0 text-neutral-600">Last updated</span>
                  <span className="min-w-0 truncate text-neutral-900">
                    {formatDate(row.lastUpdated)}
                  </span>
                </div>
              )}

              {/*
                Push, in the only two states worth a sentence. `unknown` says
                nothing at all: the group load's push enrichment is non-fatal and
                can be skipped, and "not pushed" would turn that skip into a
                claim (`GroupPushSection` owns the same distinction).
              */}
              {row.push.state === 'pushed' && (
                <div className="rounded-md border border-neutral-200 bg-canvas p-3">
                  <Eyebrow as="div" className="mb-1">
                    Membership pushed here
                  </Eyebrow>
                  <p className="text-xs text-neutral-700">
                    {row.push.targetGroupName
                      ? `Writes into ${row.push.targetGroupName}.`
                      : 'The target group was not named in the mapping.'}
                    {row.push.priority !== undefined && ` Priority ${row.push.priority}.`}
                  </p>
                </div>
              )}
              {row.push.state === 'not-pushed' && (
                <p className="text-xs text-neutral-600">
                  This group&apos;s membership is not pushed to this app.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <EntityLink type="app" id={row.id} name={row.label} />
                <OpenInOktaLink oktaOrigin={oktaOrigin} entityType="app" entityId={row.id} />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="flex items-start gap-2">
        <Icon type="app" size="sm" className="mt-0.5 shrink-0 text-neutral-400" />

        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-neutral-900">{row.label}</span>
          {row.signOnMode && (
            <span className="block truncate font-mono text-xs text-neutral-500">
              {row.signOnMode}
            </span>
          )}
        </div>

        {/* Absent is absent: an app whose row did not report a status gets no
            badge, rather than one reading "Unknown". */}
        {row.status && (
          <Badge variant={row.statusVariant} className="shrink-0">
            {row.status}
          </Badge>
        )}
        {row.push.state === 'pushed' && (
          <Badge
            variant="primary"
            title="This group's membership is pushed into a group in this app."
            className="shrink-0"
          >
            Pushed
          </Badge>
        )}

        <IconButton
          label={`${expanded ? 'Hide' : 'Show'} details for ${row.label}`}
          variant="ghost"
          size="sm"
          expanded={expanded}
          controls={disclosureId}
          className="shrink-0"
          onClick={() => onToggle(row.id)}
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

export default GroupAppRow;
