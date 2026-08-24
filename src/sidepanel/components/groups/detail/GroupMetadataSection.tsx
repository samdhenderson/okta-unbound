/**
 * @module sidepanel/components/groups/detail/GroupMetadataSection
 * @description The group's own reference facts: description, id, and Okta's timestamps.
 *
 * It renders only fields Okta actually returns: the description, the group id
 * (copyable, since it is what every API call and rule condition keys off),
 * `created`, and `lastUpdated`. A missing timestamp renders as "Not reported by
 * Okta" rather than a placeholder date.
 *
 * The description moved here when the page header took over the group's identity: the
 * header's expanded region carries the facts you navigate by — name, type, member count —
 * and a description is reference material, not a wayfinding aid. It is not dropped, since
 * nothing else in the app renders it.
 *
 * There is deliberately no "last membership change" field: Okta exposes none, and
 * the one that used to be rendered here was always `undefined` outside fixtures.
 *
 * Body-only: it answers the rarest questions of the four Group Detail tabs, so its
 * one caller, {@link module:sidepanel/components/groups/detail/GroupHealthPane},
 * folds this component's *content* into a `CollapsibleSection` titled "About this
 * group" (default closed) rather than its own always-visible card — this component
 * carries no section chrome of its own so it nests there cleanly.
 */
import React from 'react';
import { CopyButton } from '../../shared';
import { formatDate } from '../../../../shared/utils/dateFormat';

/** Props for {@link GroupMetadataSection}. */
interface GroupMetadataSectionProps {
  /** The group's Okta id. */
  groupId: string;
  /** The group's Okta description, if it has one. */
  description?: string;
  /** When Okta created the group, if the payload carried it. */
  created?: Date;
  /** When Okta last updated the group *profile*, if the payload carried it. */
  lastUpdated?: Date;
}

/** One label-above-value field. */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-xs font-medium text-neutral-600">{label}</div>
    <div className="mt-0.5 text-sm text-neutral-900">{children}</div>
  </div>
);

/** Renders the group's description and id plus its Okta-reported timestamps. */
const GroupMetadataSection: React.FC<GroupMetadataSectionProps> = ({
  groupId,
  description,
  created,
  lastUpdated,
}) => (
  <div className="space-y-3">
    <Field label="Description">
      {description?.trim() ? (
        description
      ) : (
        <span className="text-neutral-500 italic">No description in Okta.</span>
      )}
    </Field>

    <Field label="Group ID">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-900">
          {groupId}
        </code>
        <CopyButton label="Copy ID" getText={() => groupId} />
      </div>
    </Field>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Created">
        {created ? (
          formatDate(created)
        ) : (
          <span className="text-neutral-500 italic">Not reported by Okta</span>
        )}
      </Field>
      <Field label="Last updated">
        {lastUpdated ? (
          formatDate(lastUpdated)
        ) : (
          <span className="text-neutral-500 italic">Not reported by Okta</span>
        )}
      </Field>
    </div>
  </div>
);

export default GroupMetadataSection;
