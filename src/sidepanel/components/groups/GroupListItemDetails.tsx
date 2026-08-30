/**
 * @module sidepanel/components/groups/GroupListItemDetails
 * @description The inline disclosure panel a group row reveals when its chevron is expanded.
 *
 * Deliberately a *preview*, not a second detail view: the row has two open
 * affordances and they answer different questions. The chevron answers "what
 * else is on this record?" without leaving the list — the untruncated
 * description, the id, Okta's own timestamps, the push mappings, and the member
 * source legend **if** one has already been computed. Drilling into the row body
 * opens the full Group Detail view, which is where anything that costs a request
 * lives.
 *
 * Nothing here fetches. Every field is already on the loaded {@link GroupSummary}.
 *
 * ## A push target is named, or its name is stated as missing
 *
 * A mapping's `appName` is optional, and this panel used to fall back to printing
 * `appId` in the name's own slot — an opaque `0oa…` that read as though it *were*
 * the app's name. Named mappings now go through the shared `EntityLink` (which
 * opens the app and copies its id); un-named ones say so, beside the raw id in the
 * identifier register (I-003). Neither path fetches: the name is used if the group
 * load already had it, and invented otherwise never.
 */
import React from 'react';
import { CopyableId, CopyButton, EntityLink } from '../shared';
import Icon from '../shared/Icon';
import MemberSourceMeter from './detail/MemberSourceMeter';
import type { GroupSummary } from '../../../shared/types';
import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';
import { formatDate } from '../../../shared/utils/dateFormat';

/** Props for {@link GroupListItemDetails}. */
interface GroupListItemDetailsProps {
  /** The group whose record is being previewed. */
  group: GroupSummary;
  /** An already-computed member-source split, or `null` when none is cached. */
  breakdown: MemberSourceBreakdown | null;
}

/**
 * A push target this panel knows only by id.
 *
 * Deliberately not an `EntityLink`: that chip needs a name, and passing the id in
 * as the name is the defect being fixed. The absence is stated in the muted-italic
 * non-answer register, and the id goes through `CopyableId` so it reads as an
 * identifier and can be pasted into a search.
 */
const UnnamedPushApp: React.FC<{
  /** The Okta app id the mapping pushes into. */
  appId: string;
}> = ({ appId }) => (
  <span
    className="inline-flex max-w-full items-center gap-1 text-xs"
    title="Okta returned no name for this application, so only its id is known here."
  >
    <Icon type="app" size="xs" className="shrink-0 text-neutral-500" />
    <span className="shrink-0 italic text-neutral-600">App name not loaded</span>
    <CopyableId value={appId} label={`Copy application id ${appId}`} />
  </span>
);

/** One label-above-value field. */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-xs font-medium text-neutral-600">{label}</div>
    <div className="mt-0.5 text-xs text-neutral-900">{children}</div>
  </div>
);

/** Renders the row's inline preview of the group record. */
const GroupListItemDetails: React.FC<GroupListItemDetailsProps> = ({ group, breakdown }) => (
  <div className="space-y-(--sp-rung) border-t border-neutral-200 p-(--sp-card)">
    {group.description?.trim() && (
      <Field label="Description">
        <p className="text-neutral-700">{group.description}</p>
      </Field>
    )}

    {breakdown && (
      <div>
        <div className="mb-1.5 text-xs font-medium text-neutral-600">Membership source</div>
        <MemberSourceMeter breakdown={breakdown} />
      </div>
    )}

    <div className="grid grid-cols-1 gap-(--sp-field) sm:grid-cols-2">
      <Field label="Group ID">
        <div className="flex items-center gap-(--sp-inline)">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-900">
            {group.id}
          </code>
          <CopyButton label="Copy ID" getText={() => group.id} />
        </div>
      </Field>

      {group.created && <Field label="Created">{formatDate(group.created)}</Field>}
      {group.lastUpdated && <Field label="Profile updated">{formatDate(group.lastUpdated)}</Field>}
      {group.lastMembershipUpdated && (
        <Field label="Membership changed">{formatDate(group.lastMembershipUpdated)}</Field>
      )}
    </div>

    {group.pushMappings && group.pushMappings.length > 0 && (
      <div>
        <div className="mb-1.5 text-xs font-medium text-neutral-600">Push mappings</div>
        <ul className="space-y-(--sp-inline)">
          {group.pushMappings.map((mapping) => (
            <li
              key={mapping.mappingId}
              className="flex items-center justify-between gap-(--sp-field) rounded-md border border-neutral-200 bg-neutral-50 px-(--sp-row-x) py-(--sp-row-y)"
            >
              <div className="min-w-0">
                {mapping.appName ? (
                  <EntityLink
                    type="app"
                    id={mapping.appId}
                    name={mapping.appName}
                    copyId
                    // Several mappings can share a screen and two apps can share a
                    // label, so the copy control names the id, not the app (I-009).
                    copyIdLabel={`Copy application id ${mapping.appId}`}
                  />
                ) : (
                  <UnnamedPushApp appId={mapping.appId} />
                )}
                {mapping.targetGroupName && (
                  <div className="truncate text-xs text-neutral-600">
                    Target group: {mapping.targetGroupName}
                  </div>
                )}
              </div>
              {/*
                No status pill: the app-group assignment endpoint returns no
                activation status, so there is nothing honest to show. `priority`
                is a real returned field and is labelled as exactly that.
              */}
              {mapping.priority !== undefined && (
                <span
                  className="shrink-0 rounded-md bg-neutral-200 px-1.5 py-0.5 text-xs font-medium text-neutral-600"
                  title="Okta assignment priority — not an activation status"
                >
                  Priority {mapping.priority}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

export default GroupListItemDetails;
