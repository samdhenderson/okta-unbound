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
 * The push-mapping rows are {@link sidepanel/components/shared/ListRow} at `tight`
 * density (ADR-0029), which matches their previous `px-2 py-1.5` exactly. They lose
 * their `bg-neutral-50` tint to the shared `card` fill: `ListRow`'s `className` is
 * layout-only by contract, so a per-row colour override is the drift the primitive
 * exists to stop, and the row's border already separates it from the panel.
 */
import React from 'react';
import { CopyButton, ListRow } from '../shared';
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

/** One label-above-value field. */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-xs font-medium text-neutral-600">{label}</div>
    <div className="mt-0.5 text-xs text-neutral-900">{children}</div>
  </div>
);

/** Renders the row's inline preview of the group record. */
const GroupListItemDetails: React.FC<GroupListItemDetailsProps> = ({ group, breakdown }) => (
  <div className="space-y-3 border-t border-neutral-200 px-3 py-3">
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

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Group ID">
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-900">
            {group.id}
          </code>
          <CopyButton label="Copy ID" getText={() => group.id} />
        </div>
      </Field>

      {group.type === 'APP_GROUP' && group.sourceAppName && (
        <Field label="Source application">{group.sourceAppName}</Field>
      )}

      {group.created && <Field label="Created">{formatDate(group.created)}</Field>}
      {group.lastUpdated && <Field label="Last updated">{formatDate(group.lastUpdated)}</Field>}
    </div>

    {group.pushMappings && group.pushMappings.length > 0 && (
      <div>
        <div className="mb-1.5 text-xs font-medium text-neutral-600">Push mappings</div>
        <ul className="space-y-1.5">
          {group.pushMappings.map((mapping) => (
            <ListRow
              key={mapping.mappingId}
              as="li"
              density="tight"
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-neutral-900">
                  {mapping.appName || mapping.appId}
                </div>
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
                  className="shrink-0 rounded-md bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600"
                  title="Okta assignment priority — not an activation status"
                >
                  Priority {mapping.priority}
                </span>
              )}
            </ListRow>
          ))}
        </ul>
      </div>
    )}
  </div>
);

export default GroupListItemDetails;
